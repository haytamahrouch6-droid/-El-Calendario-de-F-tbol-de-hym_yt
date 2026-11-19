import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  formatFullDateFromKeyEs,
  formatShortDateFromKeyEs,
  formatTimeInTimezone,
  getDateKeyInTimezone,
  shiftDateKey,
} from '../utils/dateUtils';
import {
  ParsedScheduleMatch,
  buildMatchFromParsed,
  resolveTeamInfo,
} from '../utils/scheduleParser';
import { registerTeamLogos } from '../utils/teamCrestRegistry';
import { TeamCrest } from './TeamCrest';

interface ScheduleRobotModalProps {
  open: boolean;
  timeZone: string;
  onClose: () => void;
  onImportMatches: (newMatches: FootballMatch[]) => void;
}

interface RobotMatchItem {
  id: string;
  dateKey: string;
  parsed: ParsedScheduleMatch;
}

interface DayTabOption {
  id: string;
  label: string;
  sublabel: string;
  count: number;
}

const INITIAL_RENDER_LIMIT = 80;

export const ScheduleRobotModal: React.FC<ScheduleRobotModalProps> = ({
  open,
  timeZone,
  onClose,
  onImportMatches,
}) => {
  const [allMatches, setAllMatches] = useState<RobotMatchItem[]>([]);
  const [full15Matches, setFull15Matches] = useState<RobotMatchItem[] | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [loading15, setLoading15] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('upcoming');
  const [onlyMainLeagues, setOnlyMainLeagues] = useState<boolean>(false);
  const [competitionFilter, setCompetitionFilter] = useState<
    'all' | ParsedScheduleMatch['competition']
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllRows, setShowAllRows] = useState<boolean>(false);

  const todayKey = useMemo(
    () => getDateKeyInTimezone(new Date().toISOString(), timeZone),
    [timeZone]
  );

  const loadAllSchedules = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg(
        'Estás sin conexión a internet. Conéctate para actualizar los partidos por día.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/schedules/sync-all');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'No se pudieron cargar los horarios de los próximos días.'
        );
      }

      const rawList = Array.isArray(data.matches) ? data.matches : [];
      const logoEntries: Array<{ name: string; logoUrl?: string }> = [];
      const mapped: RobotMatchItem[] = rawList.map(
        (
          m: {
            id?: string;
            competition: ParsedScheduleMatch['competition'];
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
            status?: ParsedScheduleMatch['status'];
            homeScore?: number;
            awayScore?: number;
            liveLabel?: string;
            flashscoreUrl?: string;
            notes?: string;
          },
          index: number
        ) => {
          if (m.homeLogoUrl) logoEntries.push({ name: m.homeTeamName, logoUrl: m.homeLogoUrl });
          if (m.awayLogoUrl) logoEntries.push({ name: m.awayTeamName, logoUrl: m.awayLogoUrl });
          const parsed: ParsedScheduleMatch = {
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
          return {
            id: m.id || `robot-${index}-${m.kickoffIso}`,
            dateKey: getDateKeyInTimezone(m.kickoffIso, timeZone),
            parsed,
          };
        }
      );

      if (logoEntries.length > 0) registerTeamLogos(logoEntries);
      setAllMatches(mapped);
      setShowAllRows(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al consultar el Robot de partidos.'
      );
    } finally {
      setLoading(false);
    }
  }, [timeZone]);

  const loadAll15Days = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg(
        'Estás sin conexión a internet. Conéctate para cargar los 15 días de Flashscore.es.'
      );
      return;
    }

    setLoading15(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/flashscore/matches?day=all&filter=all');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            'No se pudieron cargar los 15 días completos desde Flashscore.es.'
        );
      }

      const rawList = Array.isArray(data.matches) ? data.matches : [];
      const logoEntries: Array<{ name: string; logoUrl?: string }> = [];
      const mapped: RobotMatchItem[] = rawList.map(
        (
          m: {
            id?: string;
            competition: ParsedScheduleMatch['competition'];
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
            status?: ParsedScheduleMatch['status'];
            homeScore?: number;
            awayScore?: number;
            liveLabel?: string;
            flashscoreUrl?: string;
            notes?: string;
          },
          index: number
        ) => {
          if (m.homeLogoUrl) logoEntries.push({ name: m.homeTeamName, logoUrl: m.homeLogoUrl });
          if (m.awayLogoUrl) logoEntries.push({ name: m.awayTeamName, logoUrl: m.awayLogoUrl });
          return {
            id: m.id || `robot15-${index}-${m.kickoffIso}`,
            dateKey: getDateKeyInTimezone(m.kickoffIso, timeZone),
            parsed: {
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
            },
          };
        }
      );

      if (logoEntries.length > 0) registerTeamLogos(logoEntries);
      setFull15Matches(mapped);
      setShowAllRows(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al consultar los 15 días en Flashscore.es.'
      );
    } finally {
      setLoading15(false);
    }
  }, [timeZone]);

  const pastDateKeysSet = useMemo(() => {
    const set = new Set<string>();
    for (let offset = -7; offset <= -1; offset++) {
      set.add(shiftDateKey(todayKey, offset));
    }
    return set;
  }, [todayKey]);

  const needsFull15Dataset =
    selectedDay === 'all15' || pastDateKeysSet.has(selectedDay);

  useEffect(() => {
    if (open && allMatches.length === 0 && !loading) {
      loadAllSchedules();
    }
  }, [open, allMatches.length, loading, loadAllSchedules]);

  useEffect(() => {
    if (open && needsFull15Dataset && full15Matches === null && !loading15) {
      loadAll15Days();
    }
  }, [open, needsFull15Dataset, full15Matches, loading15, loadAll15Days]);

  const activeSourceMatches = useMemo(() => {
    if (needsFull15Dataset && full15Matches) {
      return full15Matches;
    }
    return allMatches;
  }, [needsFull15Dataset, full15Matches, allMatches]);

  // Recalculate dateKey if timezone changes while modal stays mounted
  const normalizedMatches = useMemo(() => {
    return activeSourceMatches.map((item) => ({
      ...item,
      dateKey: getDateKeyInTimezone(item.parsed.kickoffIso, timeZone),
    }));
  }, [activeSourceMatches, timeZone]);

  const baseLeagueFiltered = useMemo(() => {
    return normalizedMatches.filter((m) => {
      if (onlyMainLeagues && m.parsed.competition === 'otros') return false;
      if (
        competitionFilter !== 'all' &&
        m.parsed.competition !== competitionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [normalizedMatches, onlyMainLeagues, competitionFilter]);

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let liveCount = 0;
    let upcomingCount = 0;
    for (const item of baseLeagueFiltered) {
      if (item.parsed.status === 'live') liveCount += 1;
      if (item.parsed.status === 'scheduled') upcomingCount += 1;
      counts.set(item.dateKey, (counts.get(item.dateKey) ?? 0) + 1);
    }
    return {
      counts,
      liveCount,
      upcomingCount,
      total: baseLeagueFiltered.length,
    };
  }, [baseLeagueFiltered]);

  const calendarOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string }> = [
      { id: 'upcoming', label: 'Próximos (Hoy a +7d)' },
      { id: 'live', label: 'En directo ahora' },
      { id: 'all15', label: 'Calendario completo (-7d a +7d)' },
    ];
    for (let offset = -7; offset <= 7; offset++) {
      const key = shiftDateKey(todayKey, offset);
      const short = formatShortDateFromKeyEs(key);
      const prefix =
        offset === -1
          ? 'Ayer · '
          : offset === 0
            ? 'Hoy · '
            : offset === 1
              ? 'Mañana · '
              : '';
      opts.push({ id: key, label: `${prefix}${short}` });
    }
    return opts;
  }, [todayKey]);

  const dayTabs: DayTabOption[] = useMemo(() => {
    const yesterdayKey = shiftDateKey(todayKey, -1);
    const tabs: DayTabOption[] = [
      {
        id: 'live',
        label: 'En directo',
        sublabel: 'Ahora',
        count: dayCounts.liveCount,
      },
      {
        id: 'upcoming',
        label: 'Próximos',
        sublabel: 'Hoy a +7d',
        count: dayCounts.upcomingCount,
      },
      {
        id: yesterdayKey,
        label: 'Ayer',
        sublabel: formatShortDateFromKeyEs(yesterdayKey),
        count: full15Matches ? (dayCounts.counts.get(yesterdayKey) ?? 0) : 0,
      },
    ];

    for (let offset = 0; offset <= 7; offset++) {
      const key = shiftDateKey(todayKey, offset);
      const short = formatShortDateFromKeyEs(key);
      const label =
        offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : short;
      tabs.push({
        id: key,
        label,
        sublabel: offset <= 1 ? short : `+${offset}d`,
        count: dayCounts.counts.get(key) ?? 0,
      });
    }

    tabs.push({
      id: 'all',
      label: 'Todos (8 días)',
      sublabel: 'Hoy a +7d',
      count: dayCounts.total,
    });

    tabs.push({
      id: 'all15',
      label: 'Todos (15 días)',
      sublabel: '-7d a +7d',
      count: full15Matches ? full15Matches.length : dayCounts.total,
    });

    return tabs;
  }, [todayKey, dayCounts, full15Matches]);

  const activeDayId = useMemo(() => {
    if (selectedDay === 'today') return todayKey;
    return selectedDay;
  }, [selectedDay, todayKey]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseLeagueFiltered.filter((item) => {
      if (activeDayId === 'live') {
        if (item.parsed.status !== 'live') return false;
      } else if (activeDayId === 'upcoming') {
        if (item.parsed.status !== 'scheduled') return false;
      } else if (activeDayId !== 'all' && activeDayId !== 'all15') {
        if (item.dateKey !== activeDayId) return false;
      }

      if (!q) return true;
      return `${item.parsed.round} ${item.parsed.homeTeam.name} ${item.parsed.awayTeam.name} ${item.parsed.broadcast}`
        .toLowerCase()
        .includes(q);
    });
  }, [baseLeagueFiltered, activeDayId, searchQuery]);

  const visibleMatches = useMemo(() => {
    if (showAllRows || searchQuery.trim().length > 0) {
      return filteredMatches;
    }
    return filteredMatches.slice(0, INITIAL_RENDER_LIMIT);
  }, [filteredMatches, showAllRows, searchQuery]);

  const groupedByDay = useMemo(() => {
    const groups: Array<{ dateKey: string; items: RobotMatchItem[] }> = [];
    const indexMap = new Map<string, number>();

    for (const item of visibleMatches) {
      const idx = indexMap.get(item.dateKey);
      if (idx === undefined) {
        indexMap.set(item.dateKey, groups.length);
        groups.push({ dateKey: item.dateKey, items: [item] });
      } else {
        groups[idx].items.push(item);
      }
    }

    groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return groups;
  }, [visibleMatches]);

  if (!open) return null;

  const allFilteredSelected =
    filteredMatches.length > 0 &&
    filteredMatches.every((m) => selectedIds.has(m.id));

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredMatches.forEach((m) => next.delete(m.id));
      } else {
        filteredMatches.forEach((m) => next.add(m.id));
      }
      return next;
    });
  };

  const handleImportSelected = () => {
    const chosen = normalizedMatches
      .filter((m) => selectedIds.has(m.id))
      .map((m, idx) => buildMatchFromParsed(m.parsed, idx));
    if (chosen.length === 0) return;
    onImportMatches(chosen);
    onClose();
  };

  const handleImportActiveDay = () => {
    if (filteredMatches.length === 0) return;
    const chosen = filteredMatches.map((m, idx) =>
      buildMatchFromParsed(m.parsed, idx)
    );
    onImportMatches(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Robot de partidos"
        className="relative z-10 w-full max-w-3xl bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bot className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                Robot de partidos · Flashscore.es
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Calendario completo (-7 a +7 días) y FutbolHorarios.com
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://www.flashscore.es/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>Flashscore.es</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            <button
              type="button"
              disabled={loading || loading15}
              onClick={() => {
                if (needsFull15Dataset) loadAll15Days();
                else loadAllSchedules();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading || loading15 ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar robot de partidos"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selector de días */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {dayTabs.map((tab) => {
              const isSelected = activeDayId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(tab.id === todayKey ? 'today' : tab.id);
                    setShowAllRows(false);
                  }}
                  className={`flex flex-col items-start px-3 py-1.5 rounded-lg border text-left transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-emerald-700 border-emerald-700 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isSelected
                          ? 'text-emerald-100'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isSelected
                        ? 'text-emerald-100/90'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tab.sublabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Buscador + calendario Flashscore.es + filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar equipo, liga o canal..."
                aria-label="Buscar partidos por equipo, liga o canal"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <select
                value={activeDayId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDay(val === todayKey ? 'today' : val);
                  setShowAllRows(false);
                }}
                aria-label="Calendario Flashscore.es (-7 a +7 días)"
                className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {calendarOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={competitionFilter}
                onChange={(e) =>
                  setCompetitionFilter(
                    e.target.value as 'all' | ParsedScheduleMatch['competition']
                  )
                }
                aria-label="Filtrar por liga en el robot"
                className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="all">Todas las ligas</option>
                {(
                  Object.keys(
                    COMPETITIONS
                  ) as ParsedScheduleMatch['competition'][]
                ).map((compId) => (
                  <option key={compId} value={compId}>
                    {COMPETITIONS[compId].label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setOnlyMainLeagues((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  onlyMainLeagues
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>
                  {onlyMainLeagues ? 'Solo principales' : 'Principales'}
                </span>
              </button>

              <button
                type="button"
                disabled={filteredMatches.length === 0}
                onClick={toggleSelectAllFiltered}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                {allFilteredSelected ? 'Deseleccionar' : 'Seleccionar visibles'}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de partidos */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMsg && (
            <div className="px-4 py-3 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between gap-3">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => {
                  if (needsFull15Dataset) loadAll15Days();
                  else loadAllSchedules();
                }}
                className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-md whitespace-nowrap"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading || loading15 ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-700 dark:text-emerald-400" />
              <span>
                {loading15
                  ? 'Cargando los 15 días completos desde Flashscore.es...'
                  : 'Cargando partidos de hoy y los próximos 7 días...'}
              </span>
            </div>
          ) : groupedByDay.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {activeDayId === 'live'
                ? 'No hay partidos en directo en este momento. Elige «Hoy» o cualquier otro día.'
                : 'No hay partidos para el día o filtro seleccionado.'}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDay.map((group) => {
                const isTodayGroup = group.dateKey === todayKey;
                const isTomorrowGroup =
                  group.dateKey === shiftDateKey(todayKey, 1);
                const dayPrefix = isTodayGroup
                  ? 'Hoy · '
                  : isTomorrowGroup
                    ? 'Mañana · '
                    : '';

                return (
                  <div
                    key={group.dateKey}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>
                          {dayPrefix}
                          {formatFullDateFromKeyEs(group.dateKey)}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {group.items.length}{' '}
                        {group.items.length === 1 ? 'partido' : 'partidos'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {group.items.map((item) => {
                        const checked = selectedIds.has(item.id);
                        const match = item.parsed;
                        const timeStr =
                          match.status === 'live' && match.liveLabel
                            ? match.liveLabel
                            : formatTimeInTimezone(match.kickoffIso, timeZone);
                        const comp = COMPETITIONS[match.competition];
                        const hasScore =
                          (match.status === 'live' ||
                            match.status === 'finished') &&
                          match.homeScore !== undefined &&
                          match.awayScore !== undefined;

                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            role="checkbox"
                            aria-checked={checked}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleItem(item.id);
                              }
                            }}
                            className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                              checked
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/25'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                checked
                                  ? 'bg-emerald-700 border-emerald-700 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                            </span>

                            <div className="w-16 shrink-0 font-mono tabular-nums text-xs">
                              <div
                                className={`font-semibold ${
                                  match.status === 'live'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {timeStr}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {match.status === 'live'
                                  ? 'Directo'
                                  : match.status === 'finished'
                                    ? 'Final'
                                    : 'Hora'}
                              </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <TeamCrest team={match.homeTeam} size="sm" />
                                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {match.homeTeam.name}
                                </span>
                                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                                  {hasScore
                                    ? `${match.homeScore} - ${match.awayScore}`
                                    : 'vs'}
                                </span>
                                <TeamCrest team={match.awayTeam} size="sm" />
                                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {match.awayTeam.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {match.competition === 'otros'
                                  ? match.round
                                  : (comp?.shortLabel ?? match.round)}{' '}
                                · {match.broadcast}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!showAllRows &&
                !searchQuery.trim() &&
                filteredMatches.length > INITIAL_RENDER_LIMIT && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Mostrando {visibleMatches.length} de{' '}
                      {filteredMatches.length} partidos
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllRows(true)}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Ver los {filteredMatches.length} partidos
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {filteredMatches.length} partidos en pantalla · Zona {timeZone}
          </span>

          <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Cerrar
            </button>

            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleImportSelected}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Añadir seleccionados ({selectedIds.size})
              </button>
            ) : (
              <button
                type="button"
                disabled={filteredMatches.length === 0}
                onClick={handleImportActiveDay}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                Añadir visibles ({filteredMatches.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
