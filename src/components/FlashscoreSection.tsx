import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
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
import { TeamCrest } from './TeamCrest';

interface FlashscoreSectionProps {
  timeZone: string;
  onImportMatches: (matches: FootballMatch[]) => void;
}

type FlashscoreTabId =
  | 'live'
  | 'today'
  | 'tomorrow'
  | 'plus2'
  | 'plus3'
  | 'week'
  | 'yesterday';

interface FlashscoreTabConfig {
  id: FlashscoreTabId;
  label: string;
  day: number | 'all';
  filter: 'all' | 'live';
}

const FLASHSCORE_TABS: FlashscoreTabConfig[] = [
  { id: 'live', label: 'En directo', day: 0, filter: 'live' },
  { id: 'today', label: 'Hoy', day: 0, filter: 'all' },
  { id: 'tomorrow', label: 'Mañana', day: 1, filter: 'all' },
  { id: 'plus2', label: '+2 días', day: 2, filter: 'all' },
  { id: 'plus3', label: '+3 días', day: 3, filter: 'all' },
  { id: 'week', label: 'Todos (7 días)', day: 'all', filter: 'all' },
  { id: 'yesterday', label: 'Ayer', day: -1, filter: 'all' },
];

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
  awayTeamName: string;
  awayShortCode?: string;
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
  const [searchText, setSearchText] = useState<string>('');
  const [items, setItems] = useState<ParsedScheduleMatch[]>([]);
  const [dateKey, setDateKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);

  const currentTabConfig =
    FLASHSCORE_TABS.find((t) => t.id === activeTab) ?? FLASHSCORE_TABS[1];

  const loadMatches = useCallback(async (tab: FlashscoreTabConfig) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg(
        'Sin conexión a internet. Los marcadores de Flashscore.es se actualizarán cuando recuperes la red.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `/api/flashscore/matches?day=${tab.day}&filter=${tab.filter}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudieron obtener los horarios de Flashscore.es.'
        );
      }

      const rawList: FlashscoreApiMatch[] = Array.isArray(data.matches)
        ? data.matches
        : [];
      const mapped: ParsedScheduleMatch[] = rawList.map((m) => ({
        competition: m.competition || 'otros',
        round: m.round || 'Fútbol internacional',
        homeTeam: resolveTeamInfo(m.homeTeamName, m.homeShortCode),
        awayTeam: resolveTeamInfo(m.awayTeamName, m.awayShortCode),
        kickoffIso: m.kickoffIso,
        stadium: m.stadium || 'Por confirmar',
        broadcast: m.broadcast || 'Flashscore.es',
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        liveLabel: m.liveLabel,
        flashscoreUrl: m.flashscoreUrl,
        notes: m.notes,
      }));

      setItems(mapped);
      setDateKey(typeof data.dateKey === 'string' ? data.dateKey : '');
      setShowAll(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al consultar Flashscore.es.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches(currentTabConfig);
  }, [currentTabConfig, loadMatches]);

  const sortedAndFiltered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) =>
          `${item.round} ${item.homeTeam.name} ${item.awayTeam.name}`
            .toLowerCase()
            .includes(q)
        )
      : items;

    return [...filtered].sort((a, b) => {
      const prioDiff =
        (COMPETITION_PRIORITY[a.competition] ?? 5) -
        (COMPETITION_PRIORITY[b.competition] ?? 5);
      if (prioDiff !== 0) return prioDiff;
      return (
        new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      );
    });
  }, [items, searchText]);

  const visibleItems = useMemo(() => {
    if (showAll || searchText.trim().length > 0) return sortedAndFiltered;
    return sortedAndFiltered.slice(0, 32);
  }, [sortedAndFiltered, showAll, searchText]);

  const groupedByLeague = useMemo(() => {
    const groups: Array<{ league: string; matches: ParsedScheduleMatch[] }> = [];
    const indexMap = new Map<string, number>();

    for (const item of visibleItems) {
      const existingIdx = indexMap.get(item.round);
      if (existingIdx === undefined) {
        indexMap.set(item.round, groups.length);
        groups.push({ league: item.round, matches: [item] });
      } else {
        groups[existingIdx].matches.push(item);
      }
    }
    return groups;
  }, [visibleItems]);

  const handleImportVisible = () => {
    if (visibleItems.length === 0) return;
    const built = visibleItems.map((item, idx) => buildMatchFromParsed(item, idx));
    onImportMatches(built);
  };

  const handleImportSingle = (item: ParsedScheduleMatch) => {
    onImportMatches([buildMatchFromParsed(item, 0)]);
  };

  return (
    <section
      id="flashscore-directo"
      aria-label="Horarios y marcadores en directo de Flashscore.es"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
              Horarios y resultados en directo · Flashscore.es
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cartelera conectada con Flashscore.es
              {activeTab === 'week'
                ? ' · Todos los próximos 7 días'
                : dateKey
                  ? ` · ${formatShortDateFromKeyEs(dateKey)}`
                  : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => loadMatches(currentTabConfig)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Actualizar</span>
          </button>

          <a
            href="https://www.flashscore.es/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Abrir Flashscore.es</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Jornada en Flashscore.es"
          className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg overflow-x-auto max-w-full"
        >
          {FLASHSCORE_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
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

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Filtrar equipo o competición..."
              aria-label="Filtrar partidos de Flashscore.es"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="button"
            disabled={loading || visibleItems.length === 0}
            onClick={handleImportVisible}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              Añadir al calendario ({visibleItems.length})
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      {errorMsg ? (
        <div className="px-5 py-6 text-xs text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => loadMatches(currentTabConfig)}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="px-5 py-8 flex items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
          <span>Cargando partidos y horarios desde Flashscore.es...</span>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          {activeTab === 'live'
            ? 'No hay partidos en directo en este momento en Flashscore.es. Prueba la pestaña "Hoy" o "Mañana".'
            : 'No se encontraron partidos que coincidan con el filtro seleccionado.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {groupedByLeague.map((group) => (
            <div key={group.league}>
              <div className="px-5 py-2 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="truncate">{group.league}</span>
                <span className="font-mono tabular-nums text-slate-400 shrink-0">
                  {group.matches.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {group.matches.map((item, idx) => {
                  const timeStr =
                    item.status === 'live' && item.liveLabel
                      ? item.liveLabel
                      : formatTimeInTimezone(item.kickoffIso, timeZone);
                  const hasScore =
                    (item.status === 'live' || item.status === 'finished') &&
                    item.homeScore !== undefined &&
                    item.awayScore !== undefined;

                  return (
                    <div
                      key={`${item.homeTeam.name}-${item.awayTeam.name}-${item.kickoffIso}-${idx}`}
                      className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Hora / Minuto */}
                        <div className="w-24 shrink-0 font-mono tabular-nums text-xs">
                          {activeTab === 'week' && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {formatShortDateFromKeyEs(
                                getDateKeyInTimezone(item.kickoffIso, timeZone)
                              )}
                            </div>
                          )}
                          {item.status === 'live' ? (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {timeStr}
                            </span>
                          ) : (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {timeStr}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {item.status === 'live'
                              ? 'En directo'
                              : item.status === 'finished'
                                ? 'Finalizado'
                                : 'Programado'}
                          </div>
                        </div>

                        {/* Equipos y marcador */}
                        <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <TeamCrest team={item.homeTeam} size="sm" />
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {item.homeTeam.name}
                            </span>
                          </div>

                          <span
                            className={`font-mono tabular-nums text-xs px-1.5 py-0.5 rounded shrink-0 ${
                              item.status === 'live'
                                ? 'font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                                : hasScore
                                  ? 'font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                                  : 'text-slate-400'
                            }`}
                          >
                            {hasScore
                              ? `${item.homeScore} - ${item.awayScore}`
                              : 'vs'}
                          </span>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <TeamCrest team={item.awayTeam} size="sm" />
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {item.awayTeam.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
                  );
                })}
              </div>
            </div>
          ))}

          {!showAll && sortedAndFiltered.length > visibleItems.length && (
            <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-3">
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Mostrando {visibleItems.length} de {sortedAndFiltered.length} partidos
              </span>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                Ver todos los partidos ({sortedAndFiltered.length})
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
