import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Tv,
} from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { CompetitionId, FootballMatch, MatchStatus } from '../types/match';
import {
  formatShortDateFromKeyEs,
  formatTimeInTimezone,
  getDateKeyInTimezone,
} from '../utils/dateUtils';
import {
  ParsedScheduleMatch,
  buildMatchFromParsed,
  resolveTeamInfo,
} from '../utils/scheduleParser';
import { registerTeamLogos } from '../utils/teamCrestRegistry';
import { TeamCrest } from './TeamCrest';

interface FlashscoreSectionProps {
  timeZone: string;
  onImportMatches: (matches: FootballMatch[]) => void;
}

type FlashscoreTabId =
  | 'today'
  | 'live'
  | 'tomorrow'
  | 'upcoming'
  | 'yesterday'
  | 'all15'
  | 'custom';

type StatusFilterId = 'all' | 'live' | 'finished' | 'scheduled';

interface FlashscoreTabConfig {
  id: FlashscoreTabId;
  label: string;
  day: number | 'all' | 'upcoming';
  filter: 'all' | 'live' | 'scheduled';
}

const QUICK_TABS: FlashscoreTabConfig[] = [
  { id: 'today', label: 'Hoy', day: 0, filter: 'all' },
  { id: 'live', label: 'En vivo', day: 0, filter: 'live' },
  { id: 'tomorrow', label: 'Mañana', day: 1, filter: 'all' },
  { id: 'upcoming', label: 'Próximos (8 días)', day: 'upcoming', filter: 'scheduled' },
  { id: 'yesterday', label: 'Ayer', day: -1, filter: 'all' },
  { id: 'all15', label: 'Todos (15 días)', day: 'all', filter: 'all' },
];

const DAY_OFFSETS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];

function getMadridDateLabelForOffset(offset: number): string {
  const now = new Date();
  const madridToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = madridToday.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + offset));
  const key = target.toISOString().slice(0, 10);
  const shortLabel = formatShortDateFromKeyEs(key);
  if (offset === 0) return `Hoy · ${shortLabel}`;
  if (offset === -1) return `Ayer · ${shortLabel}`;
  if (offset === 1) return `Mañana · ${shortLabel}`;
  return shortLabel;
}

const COMPETITION_PRIORITY: Record<CompetitionId, number> = {
  laliga: 0,
  champions: 1,
  copadelrey: 2,
  premier: 3,
  seleccion: 4,
  otros: 5,
};

interface FlashscoreApiMatch {
  id: string;
  competition: CompetitionId;
  round: string;
  homeTeamName: string;
  homeShortCode?: string;
  homeLogoUrl?: string;
  awayTeamName: string;
  awayShortCode?: string;
  awayLogoUrl?: string;
  kickoffIso: string;
  stadium?: string;
  broadcast?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  liveLabel?: string;
  flashscoreUrl: string;
  notes?: string;
}

export const FlashscoreSection: React.FC<FlashscoreSectionProps> = ({
  timeZone,
  onImportMatches,
}) => {
  const [activeTab, setActiveTab] = useState<FlashscoreTabId>('today');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>('all');
  const [competitionFilter, setCompetitionFilter] = useState<
    'all' | CompetitionId
  >('all');
  const [searchText, setSearchText] = useState<string>('');
  const [items, setItems] = useState<ParsedScheduleMatch[]>([]);
  const [dateKey, setDateKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdatedStr, setLastUpdatedStr] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showAllMultiDay, setShowAllMultiDay] = useState<boolean>(false);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(
    new Set()
  );

  const dayOptions = useMemo(
    () =>
      DAY_OFFSETS.map((offset) => ({
        offset,
        label: getMadridDateLabelForOffset(offset),
      })),
    []
  );

  const activeQueryParams = useMemo<{
    day: number | 'all' | 'upcoming';
    filter: 'all' | 'live' | 'scheduled';
  }>(() => {
    if (activeTab === 'live') return { day: 0, filter: 'live' };
    if (activeTab === 'upcoming') return { day: 'upcoming', filter: 'scheduled' };
    if (activeTab === 'all15') return { day: 'all', filter: 'all' };
    if (activeTab === 'yesterday') return { day: -1, filter: 'all' };
    if (activeTab === 'tomorrow') return { day: 1, filter: 'all' };
    if (activeTab === 'custom') return { day: selectedDayOffset, filter: 'all' };
    return { day: 0, filter: 'all' };
  }, [activeTab, selectedDayOffset]);

  const loadMatches = useCallback(
    async (
      params: {
        day: number | 'all' | 'upcoming';
        filter: 'all' | 'live' | 'scheduled';
      },
      silent = false
    ) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          setErrorMsg(
            'Sin conexión a internet. Los marcadores de Flashscore.es se actualizarán cuando recuperes la red.'
          );
        }
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setErrorMsg('');
      }

      try {
        const res = await fetch(
          `/api/flashscore/matches?day=${params.day}&filter=${params.filter}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error ||
              'No se pudieron obtener los partidos desde Flashscore.es.'
          );
        }

        const rawList: FlashscoreApiMatch[] = Array.isArray(data.matches)
          ? data.matches
          : [];
        const logoEntries: Array<{ name: string; logoUrl?: string }> = [];
        const mapped: ParsedScheduleMatch[] = rawList.map((m) => {
          if (m.homeLogoUrl) logoEntries.push({ name: m.homeTeamName, logoUrl: m.homeLogoUrl });
          if (m.awayLogoUrl) logoEntries.push({ name: m.awayTeamName, logoUrl: m.awayLogoUrl });
          return {
            competition: m.competition || 'otros',
            round: m.round || 'Fútbol internacional',
            homeTeam: resolveTeamInfo(m.homeTeamName, m.homeShortCode, m.homeLogoUrl),
            awayTeam: resolveTeamInfo(m.awayTeamName, m.awayShortCode, m.awayLogoUrl),
            kickoffIso: m.kickoffIso,
            stadium: m.stadium || 'Por confirmar',
            broadcast: m.broadcast || 'Flashscore.es',
            status: m.status,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            liveLabel: m.liveLabel,
            flashscoreUrl: m.flashscoreUrl,
            notes: m.notes,
          };
        });

        if (logoEntries.length > 0) registerTeamLogos(logoEntries);
        setItems(mapped);
        setDateKey(typeof data.dateKey === 'string' ? data.dateKey : '');
        setLastUpdatedStr(
          new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        if (!silent) {
          setShowAllMultiDay(false);
          setCollapsedLeagues(new Set());
        }
        setErrorMsg('');
      } catch (err) {
        if (!silent) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Error al consultar Flashscore.es.'
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    setStatusFilter('all');
    loadMatches(activeQueryParams, false);
  }, [activeQueryParams, loadMatches]);

  // Refresco automático cada 45s cuando se consulta Hoy o En vivo
  useEffect(() => {
    if (!autoRefresh) return;
    if (
      activeTab !== 'today' &&
      activeTab !== 'live' &&
      !(activeTab === 'custom' && selectedDayOffset === 0)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        loadMatches(activeQueryParams, true);
      }
    }, 45000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, activeTab, selectedDayOffset, activeQueryParams, loadMatches]);

  const statusCounts = useMemo(() => {
    let live = 0;
    let finished = 0;
    let scheduled = 0;
    for (const item of items) {
      if (
        competitionFilter !== 'all' &&
        item.competition !== competitionFilter
      ) {
        continue;
      }
      if (item.status === 'live') live += 1;
      else if (item.status === 'finished') finished += 1;
      else scheduled += 1;
    }
    return {
      all: live + finished + scheduled,
      live,
      finished,
      scheduled,
    };
  }, [items, competitionFilter]);

  const sortedAndFiltered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (
        competitionFilter !== 'all' &&
        item.competition !== competitionFilter
      ) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return `${item.round} ${item.homeTeam.name} ${item.awayTeam.name} ${item.broadcast}`
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      const prioDiff =
        (COMPETITION_PRIORITY[a.competition] ?? 5) -
        (COMPETITION_PRIORITY[b.competition] ?? 5);
      if (prioDiff !== 0) return prioDiff;
      return (
        new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      );
    });
  }, [items, searchText, statusFilter, competitionFilter]);

  // Cualquier jornada individual (-7 a +7) muestra el 100% de partidos al instante.
  // En "Próximos (8 días)" o "Todos (15 días)" con miles de partidos se muestran 200 inicialmente con expansión completa en 1 clic.
  const isMultiDayTab = activeTab === 'all15' || activeTab === 'upcoming';

  const visibleItems = useMemo(() => {
    if (
      !isMultiDayTab ||
      showAllMultiDay ||
      searchText.trim().length > 0 ||
      statusFilter !== 'all' ||
      competitionFilter !== 'all'
    ) {
      return sortedAndFiltered;
    }
    return sortedAndFiltered.slice(0, 200);
  }, [
    sortedAndFiltered,
    isMultiDayTab,
    showAllMultiDay,
    searchText,
    statusFilter,
    competitionFilter,
  ]);

  const groupedByLeague = useMemo(() => {
    const groups: Array<{
      league: string;
      competition: CompetitionId;
      hasLive: boolean;
      matches: ParsedScheduleMatch[];
    }> = [];
    const indexMap = new Map<string, number>();

    for (const item of visibleItems) {
      const existingIdx = indexMap.get(item.round);
      if (existingIdx === undefined) {
        indexMap.set(item.round, groups.length);
        groups.push({
          league: item.round,
          competition: item.competition,
          hasLive: item.status === 'live',
          matches: [item],
        });
      } else {
        groups[existingIdx].matches.push(item);
        if (item.status === 'live') {
          groups[existingIdx].hasLive = true;
        }
      }
    }

    groups.sort((a, b) => {
      if (a.hasLive && !b.hasLive) return -1;
      if (!a.hasLive && b.hasLive) return 1;
      return (
        (COMPETITION_PRIORITY[a.competition] ?? 5) -
        (COMPETITION_PRIORITY[b.competition] ?? 5)
      );
    });

    return groups;
  }, [visibleItems]);

  const toggleLeagueCollapsed = (league: string) => {
    setCollapsedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(league)) next.delete(league);
      else next.add(league);
      return next;
    });
  };

  const handleImportVisible = () => {
    if (sortedAndFiltered.length === 0) return;
    const toImport = sortedAndFiltered.map((item, idx) =>
      buildMatchFromParsed(item, idx)
    );
    onImportMatches(toImport);
  };

  const handleImportSingle = (item: ParsedScheduleMatch) => {
    onImportMatches([buildMatchFromParsed(item, 0)]);
  };

  const handleSelectQuickTab = (tab: FlashscoreTabConfig) => {
    setActiveTab(tab.id);
    if (typeof tab.day === 'number') {
      setSelectedDayOffset(tab.day);
    }
  };

  const handleSelectCustomDay = (offset: number) => {
    setSelectedDayOffset(offset);
    if (offset === 0) setActiveTab('today');
    else if (offset === -1) setActiveTab('yesterday');
    else if (offset === 1) setActiveTab('tomorrow');
    else setActiveTab('custom');
  };

  return (
    <section
      id="flashscore-directo"
      aria-label="Flashscore.es y Koora Live — Todos los partidos de fútbol"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Radio className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
              Flashscore.es · Todos los partidos y Koora Live
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {activeTab === 'all15'
                ? 'Cartelera completa (15 días · -7 a +7)'
                : activeTab === 'upcoming'
                  ? 'Todos los próximos partidos (Hoy a +7 días)'
                  : dateKey
                    ? formatShortDateFromKeyEs(dateKey)
                    : 'Jornada actual'}
              {items.length > 0 &&
                ` · ${items.length} partidos totales · ${statusCounts.live} en vivo · ${statusCounts.finished} finalizados · ${statusCounts.scheduled} próximos`}
              {lastUpdatedStr && ` · Act. ${lastUpdatedStr}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              autoRefresh
                ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>{autoRefresh ? 'Auto · 45s' : 'Auto pausado'}</span>
          </button>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => loadMatches(activeQueryParams, false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`}
            />
            <span>Actualizar</span>
          </button>

          <a
            href="#canales-directo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Tv className="w-3.5 h-3.5 shrink-0" />
            <span>Ver canales gratis</span>
          </a>

          <a
            href="https://www.flashscore.es/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Flashscore.es</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      </div>

      {/* Controls Bar: Quick Tabs + 15-Day Date Selector + Competition + Search + Import */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              role="tablist"
              aria-label="Jornada en Flashscore.es"
              className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg overflow-x-auto max-w-full"
            >
              {QUICK_TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectQuickTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <select
              value={
                activeTab === 'all15'
                  ? 'all'
                  : activeTab === 'upcoming'
                    ? 'upcoming'
                    : String(selectedDayOffset)
              }
              onChange={(e) => {
                if (e.target.value === 'all') {
                  setActiveTab('all15');
                } else if (e.target.value === 'upcoming') {
                  setActiveTab('upcoming');
                } else {
                  handleSelectCustomDay(Number(e.target.value));
                }
              }}
              aria-label="Elegir fecha de Flashscore.es"
              className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {dayOptions.map((opt) => (
                <option key={opt.offset} value={String(opt.offset)}>
                  {opt.label}
                </option>
              ))}
              <option value="upcoming">Todos los próximos (Hoy a +7 días)</option>
              <option value="all">Todos los días (-7 a +7)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={competitionFilter}
              onChange={(e) =>
                setCompetitionFilter(e.target.value as 'all' | CompetitionId)
              }
              aria-label="Filtrar por competición"
              className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 shrink-0"
            >
              <option value="all">Todas las ligas</option>
              {(Object.keys(COMPETITIONS) as CompetitionId[]).map((compId) => (
                <option key={compId} value={compId}>
                  {COMPETITIONS[compId].label}
                </option>
              ))}
            </select>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar equipo, país o liga..."
                aria-label="Filtrar todos los partidos de Flashscore.es"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="button"
              disabled={loading || sortedAndFiltered.length === 0}
              onClick={handleImportVisible}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar todos ({sortedAndFiltered.length})</span>
            </button>
          </div>
        </div>

        {/* Status Segmented Filter */}
        {activeTab !== 'live' && items.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'Todos', count: statusCounts.all },
                  { id: 'live', label: 'En vivo', count: statusCounts.live },
                  {
                    id: 'finished',
                    label: 'Finalizados',
                    count: statusCounts.finished,
                  },
                  {
                    id: 'scheduled',
                    label: 'Próximos',
                    count: statusCounts.scheduled,
                  },
                ] as Array<{ id: StatusFilterId; label: string; count: number }>
              ).map((opt) => {
                const active = statusFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap font-mono tabular-nums ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-emerald-700'
                        : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label} ({opt.count})
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {groupedByLeague.length} competiciones · {sortedAndFiltered.length}{' '}
              partidos
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      {errorMsg ? (
        <div className="px-5 py-6 text-xs text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => loadMatches(activeQueryParams, false)}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="px-5 py-8 text-center space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'live' || statusFilter === 'live'
              ? 'No hay partidos en vivo en este instante en Flashscore.es.'
              : 'No se encontraron partidos que coincidan con los filtros seleccionados.'}
          </div>
          {(statusFilter !== 'all' ||
            competitionFilter !== 'all' ||
            activeTab === 'live' ||
            searchText.trim()) && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('today');
                setSelectedDayOffset(0);
                setStatusFilter('all');
                setCompetitionFilter('all');
                setSearchText('');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Ver todos los partidos de hoy
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {groupedByLeague.map((group) => {
            const isCollapsed = collapsedLeagues.has(group.league);
            return (
              <div key={group.league}>
                <button
                  type="button"
                  onClick={() => toggleLeagueCollapsed(group.league)}
                  className="w-full px-5 py-2 bg-slate-50/80 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 text-left transition-colors"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {group.league}
                      {group.hasLive ? ' · En vivo' : ''}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-400 shrink-0">
                    {group.matches.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {group.matches.map((item, idx) => {
                      const timeStr =
                        item.status === 'live' && item.liveLabel
                          ? item.liveLabel
                          : formatTimeInTimezone(item.kickoffIso, timeZone);
                      const hasScore =
                        (item.status === 'live' ||
                          item.status === 'finished') &&
                        item.homeScore !== undefined &&
                        item.awayScore !== undefined;
                      const hasBroadcast =
                        item.broadcast && item.broadcast !== 'Flashscore.es';

                      return (
                        <div
                          key={`${item.homeTeam.name}-${item.awayTeam.name}-${item.kickoffIso}-${idx}`}
                          className={`px-5 py-3 flex flex-col md:grid md:grid-cols-[1fr_132px_1fr_auto] md:items-center gap-2.5 md:gap-4 transition-colors ${
                            item.status === 'live'
                              ? 'bg-emerald-50/35 dark:bg-emerald-950/15 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          {/* Equipo Local */}
                          <div className="flex items-center md:justify-end gap-2 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate md:text-right order-2 md:order-1">
                              {item.homeTeam.name}
                            </span>
                            <div className="order-1 md:order-2 shrink-0">
                              <TeamCrest team={item.homeTeam} size="sm" />
                            </div>
                          </div>

                          {/* Bloque Central Estilo Koora Live */}
                          <div className="flex md:flex-col items-center justify-between md:justify-center gap-2 md:gap-0.5 font-mono tabular-nums px-2 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                            <div
                              className={`text-sm sm:text-base font-bold leading-tight ${
                                item.status === 'live'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : hasScore
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {hasScore
                                ? `${item.homeScore} - ${item.awayScore}`
                                : timeStr}
                            </div>

                            <div className="text-[10px] font-medium whitespace-nowrap">
                              {isMultiDayTab && (
                                <span className="text-slate-500 dark:text-slate-400 mr-1">
                                  {formatShortDateFromKeyEs(
                                    getDateKeyInTimezone(
                                      item.kickoffIso,
                                      timeZone
                                    )
                                  )}{' '}
                                  ·
                                </span>
                              )}
                              {item.status === 'live' ? (
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {timeStr} · En vivo
                                </span>
                              ) : item.status === 'finished' ? (
                                <span className="text-slate-500 dark:text-slate-400">
                                  Finalizado
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">
                                  Programado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Equipo Visitante */}
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest team={item.awayTeam} size="sm" />
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {item.awayTeam.name}
                            </span>
                          </div>

                          {/* Emisión y Acciones */}
                          <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-1 md:pt-0 border-t border-slate-100 dark:border-slate-800/60 md:border-0">
                            <a
                              href="#canales-directo"
                              title={
                                hasBroadcast
                                  ? `Emitido en: ${item.broadcast}`
                                  : 'Ver canales gratuitos y plataformas oficiales'
                              }
                              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 truncate max-w-[130px] whitespace-nowrap"
                            >
                              {hasBroadcast ? item.broadcast : 'Canales gratis'}
                            </a>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleImportSingle(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Agenda</span>
                              </button>

                              {item.flashscoreUrl && (
                                <a
                                  href={item.flashscoreUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Ver ${item.homeTeam.name} vs ${item.awayTeam.name} en Flashscore.es`}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isMultiDayTab &&
            !showAllMultiDay &&
            sortedAndFiltered.length > visibleItems.length && (
              <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-3">
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Mostrando {visibleItems.length} de {sortedAndFiltered.length}{' '}
                  partidos ({activeTab === 'upcoming' ? 'Próximos 8 días' : '15 días'})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllMultiDay(true)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                >
                  Mostrar los {sortedAndFiltered.length} partidos
                </button>
              </div>
            )}
        </div>
      )}
    </section>
  );
};
