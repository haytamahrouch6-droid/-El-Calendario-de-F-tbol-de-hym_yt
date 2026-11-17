import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  Check,
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
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('today');
  const [onlyMainLeagues, setOnlyMainLeagues] = useState<boolean>(false);
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
      const mapped: RobotMatchItem[] = rawList.map(
        (
          m: {
            id?: string;
            competition: ParsedScheduleMatch['competition'];
            round: string;
            homeTeamName: string;
            homeShortCode?: string;
            awayTeamName: string;
            awayShortCode?: string;
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
          const parsed: ParsedScheduleMatch = {
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
          };
          return {
            id: m.id || `robot-${index}-${m.kickoffIso}`,
            dateKey: getDateKeyInTimezone(m.kickoffIso, timeZone),
            parsed,
          };
        }
      );

      setAllMatches(mapped);
      setShowAllRows(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al consultar el Robot de horarios.'
      );
    } finally {
      setLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    if (open && allMatches.length === 0 && !loading) {
      loadAllSchedules();
    }
  }, [open, allMatches.length, loading, loadAllSchedules]);

  // Recalculate dateKey if timezone changes while modal stays mounted
  const normalizedMatches = useMemo(() => {
    return allMatches.map((item) => ({
      ...item,
      dateKey: getDateKeyInTimezone(item.parsed.kickoffIso, timeZone),
    }));
  }, [allMatches, timeZone]);

  const baseLeagueFiltered = useMemo(() => {
    if (!onlyMainLeagues) return normalizedMatches;
    return normalizedMatches.filter((m) => m.parsed.competition !== 'otros');
  }, [normalizedMatches, onlyMainLeagues]);

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let liveCount = 0;
    for (const item of baseLeagueFiltered) {
      if (item.parsed.status === 'live') liveCount += 1;
      counts.set(item.dateKey, (counts.get(item.dateKey) ?? 0) + 1);
    }
    return { counts, liveCount, total: baseLeagueFiltered.length };
  }, [baseLeagueFiltered]);

  const dayTabs: DayTabOption[] = useMemo(() => {
    const tabs: DayTabOption[] = [
      {
        id: 'live',
        label: 'En directo',
        sublabel: 'Ahora',
        count: dayCounts.liveCount,
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
      label: 'Todos (7 días)',
      sublabel: 'Semana',
      count: dayCounts.total,
    });

    return tabs;
  }, [todayKey, dayCounts]);

  const activeDayId = useMemo(() => {
    if (selectedDay === 'today') return todayKey;
    return selectedDay;
  }, [selectedDay, todayKey]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return baseLeagueFiltered.filter((item) => {
      if (activeDayId === 'live') {
        if (item.parsed.status !== 'live') return false;
      } else if (activeDayId !== 'all') {
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
        aria-label="Robot de partidos por días"
        className="relative z-10 w-full max-w-3xl bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bot className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                Robot de partidos por días
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Elige el día para ver los partidos y horarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={loadAllSchedules}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar robot de horarios"
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

          {/* Buscador + filtros simples */}
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
                  {onlyMainLeagues ? 'Solo principales' : 'Todas las ligas'}
                </span>
              </button>

              <button
                type="button"
                disabled={filteredMatches.length === 0}
                onClick={toggleSelectAllFiltered}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                {allFilteredSelected ? 'Deseleccionar día' : 'Seleccionar día'}
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
                onClick={loadAllSchedules}
                className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-md whitespace-nowrap"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-700 dark:text-emerald-400" />
              <span>Cargando partidos de hoy y los próximos 7 días...</span>
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
