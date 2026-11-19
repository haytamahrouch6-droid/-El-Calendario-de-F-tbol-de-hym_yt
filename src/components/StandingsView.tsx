import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Trophy,
} from 'lucide-react';
import { CompetitionId, FootballMatch, MatchStatus } from '../types/match';
import {
  formatFullDateFromKeyEs,
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

export interface WorldLeagueEntry {
  path: string;
  fullName: string;
  country: string;
  leagueName: string;
  featured: boolean;
}

interface StandingRow {
  rank: number;
  teamName: string;
  logoUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

interface StandingTableGroup {
  groupName: string | null;
  rows: StandingRow[];
}

interface StandingsResponsePayload {
  path: string;
  title: string;
  tables: StandingTableGroup[];
  flashscoreUrl: string;
}

interface LeagueMatchApiItem {
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
  flashscoreUrl?: string;
  notes?: string;
}

interface LeagueMatchesResponsePayload {
  path: string;
  title: string;
  desktopUrl: string;
  totalCount: number;
  matches: LeagueMatchApiItem[];
}

interface StandingsViewProps {
  timeZone: string;
  onImportMatches: (matches: FootballMatch[]) => void;
}

type LeagueDetailTab = 'matches' | 'results' | 'standings';

const DEFAULT_LEAGUE_PATH = '/clasificacion/QeI1Oeyi/dWdJXP6U/';

export const StandingsView: React.FC<StandingsViewProps> = ({
  timeZone,
  onImportMatches,
}) => {
  const [leagues, setLeagues] = useState<WorldLeagueEntry[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState<boolean>(true);
  const [leaguesError, setLeaguesError] = useState<string>('');

  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [leagueSearch, setLeagueSearch] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<string>(DEFAULT_LEAGUE_PATH);
  const [detailTab, setDetailTab] = useState<LeagueDetailTab>('matches');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');

  const [standings, setStandings] = useState<StandingsResponsePayload | null>(
    null
  );
  const [standingsLoading, setStandingsLoading] = useState<boolean>(false);
  const [standingsError, setStandingsError] = useState<string>('');

  const [leagueMatches, setLeagueMatches] =
    useState<LeagueMatchesResponsePayload | null>(null);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string>('');

  const loadWorldLeagues = useCallback(async () => {
    setLeaguesLoading(true);
    setLeaguesError('');
    try {
      const res = await fetch('/api/flashscore/leagues');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudieron cargar las ligas del mundo.'
        );
      }
      const list = Array.isArray(data.leagues) ? data.leagues : [];
      setLeagues(list);
    } catch (err) {
      setLeaguesError(
        err instanceof Error
          ? err.message
          : 'Error al obtener las ligas mundiales.'
      );
    } finally {
      setLeaguesLoading(false);
    }
  }, []);

  const loadStandings = useCallback(async (path: string) => {
    setStandingsLoading(true);
    setStandingsError('');
    try {
      const res = await fetch(
        `/api/flashscore/standings?path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo cargar la clasificación seleccionada.'
        );
      }
      const typedData = data as StandingsResponsePayload;
      if (Array.isArray(typedData.tables)) {
        const logoEntries: Array<{ name: string; logoUrl?: string }> = [];
        for (const grp of typedData.tables) {
          for (const r of grp.rows) {
            if (r.logoUrl) {
              logoEntries.push({ name: r.teamName, logoUrl: r.logoUrl });
            }
          }
        }
        if (logoEntries.length > 0) {
          registerTeamLogos(logoEntries);
        }
      }
      setStandings(typedData);
    } catch (err) {
      setStandingsError(
        err instanceof Error
          ? err.message
          : 'Error al consultar la clasificación.'
      );
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  const loadLeagueMatches = useCallback(async (path: string) => {
    setMatchesLoading(true);
    setMatchesError('');
    try {
      const res = await fetch(
        `/api/flashscore/league-matches?path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudieron cargar los partidos de esta liga.'
        );
      }
      const typedData = data as LeagueMatchesResponsePayload;
      if (Array.isArray(typedData.matches)) {
        const logoEntries: Array<{ name: string; logoUrl?: string }> = [];
        for (const m of typedData.matches) {
          if (m.homeLogoUrl) {
            logoEntries.push({ name: m.homeTeamName, logoUrl: m.homeLogoUrl });
          }
          if (m.awayLogoUrl) {
            logoEntries.push({ name: m.awayTeamName, logoUrl: m.awayLogoUrl });
          }
        }
        if (logoEntries.length > 0) {
          registerTeamLogos(logoEntries);
        }
      }
      setLeagueMatches(typedData);
      setSelectedMonthFilter('ALL');
      setSelectedDateFilter('ALL');
    } catch (err) {
      setMatchesError(
        err instanceof Error
          ? err.message
          : 'Error al consultar los partidos de la liga.'
      );
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorldLeagues();
  }, [loadWorldLeagues]);

  useEffect(() => {
    loadStandings(selectedPath);
    loadLeagueMatches(selectedPath);
  }, [selectedPath, loadStandings, loadLeagueMatches]);

  const featuredLeagues = useMemo(
    () => leagues.filter((l) => l.featured),
    [leagues]
  );

  const countries = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leagues) {
      map.set(l.country, (map.get(l.country) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([name, count]) => ({ name, count }));
  }, [leagues]);

  const filteredLeagues = useMemo(() => {
    const q = leagueSearch.trim().toLowerCase();
    return leagues.filter((l) => {
      if (selectedCountry !== 'ALL' && l.country !== selectedCountry) {
        return false;
      }
      if (!q) return true;
      return `${l.country} ${l.leagueName} ${l.fullName}`
        .toLowerCase()
        .includes(q);
    });
  }, [leagues, selectedCountry, leagueSearch]);

  const activeLeagueMeta = useMemo(
    () => leagues.find((l) => l.path === selectedPath) ?? null,
    [leagues, selectedPath]
  );

  const parsedMatches = useMemo(() => {
    const list = leagueMatches?.matches ?? [];
    return list.map((m) => {
      const parsed: ParsedScheduleMatch = {
        competition: m.competition || 'otros',
        round: m.round || activeLeagueMeta?.fullName || 'Fútbol internacional',
        homeTeam: resolveTeamInfo(m.homeTeamName, m.homeShortCode, m.homeLogoUrl),
        awayTeam: resolveTeamInfo(m.awayTeamName, m.awayShortCode, m.awayLogoUrl),
        kickoffIso: m.kickoffIso,
        stadium: m.stadium || 'Por confirmar',
        broadcast: m.broadcast || 'Flashscore.es',
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        flashscoreUrl: m.flashscoreUrl,
        notes: m.notes,
      };
      return {
        id: m.id,
        dateKey: getDateKeyInTimezone(m.kickoffIso, timeZone),
        parsed,
      };
    });
  }, [leagueMatches, activeLeagueMeta, timeZone]);

  const upcomingAndLiveMatches = useMemo(
    () => parsedMatches.filter((m) => m.parsed.status !== 'finished'),
    [parsedMatches]
  );

  const finishedMatches = useMemo(
    () =>
      [...parsedMatches]
        .filter((m) => m.parsed.status === 'finished')
        .sort(
          (a, b) =>
            new Date(b.parsed.kickoffIso).getTime() -
            new Date(a.parsed.kickoffIso).getTime()
        ),
    [parsedMatches]
  );

  const activeMatchList =
    detailTab === 'results' ? finishedMatches : upcomingAndLiveMatches;

  const availableMonthsForTab = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeMatchList) {
      const monthKey = item.dateKey.slice(0, 7);
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    }
    const entries = [...counts.entries()];
    entries.sort((a, b) =>
      detailTab === 'results' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
    return entries.map(([monthKey, count]) => {
      const [y, m] = monthKey.split('-').map(Number);
      const label = new Intl.DateTimeFormat('es-ES', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(y, m - 1, 15)));
      return {
        monthKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count,
      };
    });
  }, [activeMatchList, detailTab]);

  const monthScopedMatches = useMemo(() => {
    if (selectedMonthFilter === 'ALL') return activeMatchList;
    return activeMatchList.filter(
      (m) => m.dateKey.slice(0, 7) === selectedMonthFilter
    );
  }, [activeMatchList, selectedMonthFilter]);

  const availableDatesForTab = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of monthScopedMatches) {
      counts.set(item.dateKey, (counts.get(item.dateKey) ?? 0) + 1);
    }
    const entries = [...counts.entries()];
    entries.sort((a, b) =>
      detailTab === 'results' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
    return entries.map(([dateKey, count]) => ({
      dateKey,
      label: formatShortDateFromKeyEs(dateKey),
      count,
    }));
  }, [monthScopedMatches, detailTab]);

  const visibleLeagueMatches = useMemo(() => {
    if (selectedDateFilter === 'ALL') return monthScopedMatches;
    return monthScopedMatches.filter((m) => m.dateKey === selectedDateFilter);
  }, [monthScopedMatches, selectedDateFilter]);

  const groupedByDay = useMemo(() => {
    const groups: Array<{
      dateKey: string;
      items: typeof activeMatchList;
    }> = [];
    const idxMap = new Map<string, number>();

    for (const item of visibleLeagueMatches) {
      const idx = idxMap.get(item.dateKey);
      if (idx === undefined) {
        idxMap.set(item.dateKey, groups.length);
        groups.push({ dateKey: item.dateKey, items: [item] });
      } else {
        groups[idx].items.push(item);
      }
    }

    groups.sort((a, b) =>
      detailTab === 'results'
        ? b.dateKey.localeCompare(a.dateKey)
        : a.dateKey.localeCompare(b.dateKey)
    );
    return groups;
  }, [visibleLeagueMatches, detailTab]);

  const handleImportVisibleLeagueMatches = () => {
    if (visibleLeagueMatches.length === 0) return;
    onImportMatches(
      visibleLeagueMatches.map((item, idx) =>
        buildMatchFromParsed(item.parsed, idx)
      )
    );
  };

  const handleImportSingle = (parsed: ParsedScheduleMatch) => {
    onImportMatches([buildMatchFromParsed(parsed, 0)]);
  };

  const isLoadingActivePanel =
    detailTab === 'standings' ? standingsLoading : matchesLoading;

  return (
    <section
      aria-label="Todas las ligas del mundo: partidos por días, resultados y clasificación"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Trophy className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
              Todas las ligas del mundo · Partidos, días, meses y clasificación
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {leagues.length > 0
                ? `${leagues.length} ligas de ${countries.length} países y regiones`
                : 'Cargando catálogo mundial de Flashscore.es...'}
              {activeLeagueMeta && ` · ${activeLeagueMeta.fullName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {detailTab !== 'standings' && visibleLeagueMatches.length > 0 && (
            <button
              type="button"
              onClick={handleImportVisibleLeagueMatches}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                Añadir al calendario ({visibleLeagueMatches.length})
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={isLoadingActivePanel}
            onClick={() => {
              loadStandings(selectedPath);
              loadLeagueMatches(selectedPath);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingActivePanel ? 'animate-spin' : ''}`}
            />
            <span>Actualizar</span>
          </button>

          {(leagueMatches?.desktopUrl || standings?.flashscoreUrl) && (
            <a
              href={leagueMatches?.desktopUrl || standings?.flashscoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>Flashscore.es</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Ligas principales destacadas */}
      {featuredLeagues.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto">
          {featuredLeagues.map((league) => {
            const isActive = league.path === selectedPath;
            return (
              <button
                key={league.path}
                type="button"
                onClick={() => setSelectedPath(league.path)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {league.leagueName}
              </button>
            );
          })}
        </div>
      )}

      {/* Split Layout: Catálogo Mundial (Izquierda) + Partidos / Días / Clasificación (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Catálogo mundial de países y ligas */}
        <div className="p-4 flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={leagueSearch}
              onChange={(e) => setLeagueSearch(e.target.value)}
              placeholder="Buscar país o liga del mundo..."
              aria-label="Buscar liga o país de todo el mundo"
              className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              aria-label="Filtrar ligas por país"
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">
                Todos los países ({leagues.length} ligas)
              </option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {leaguesError ? (
            <div className="p-3 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg space-y-2">
              <div>{leaguesError}</div>
              <button
                type="button"
                onClick={loadWorldLeagues}
                className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded"
              >
                Reintentar
              </button>
            </div>
          ) : leaguesLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-9 bg-slate-200/70 dark:bg-slate-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="max-h-[420px] lg:max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#11161D]">
              {filteredLeagues.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron ligas con ese filtro.
                </div>
              ) : (
                filteredLeagues.map((league) => {
                  const isActive = league.path === selectedPath;
                  return (
                    <button
                      key={league.path}
                      type="button"
                      onClick={() => setSelectedPath(league.path)}
                      className={`w-full px-3 py-2.5 text-left transition-colors flex flex-col gap-0.5 ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {league.country}
                      </span>
                      <span
                        className={`text-xs truncate ${
                          isActive ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {league.leagueName}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Panel derecho: Subtabs Partidos / Resultados / Clasificación */}
        <div className="min-w-0 flex flex-col">
          {/* Sub-barra de la liga activa */}
          <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
                {leagueMatches?.title ||
                  standings?.title ||
                  activeLeagueMeta?.fullName ||
                  'Liga seleccionada'}
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {upcomingAndLiveMatches.length} próximos ·{' '}
                {finishedMatches.length} resultados · Zona {timeZone}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {detailTab !== 'standings' && availableMonthsForTab.length > 1 && (
                <select
                  value={selectedMonthFilter}
                  onChange={(e) => {
                    setSelectedMonthFilter(e.target.value);
                    setSelectedDateFilter('ALL');
                  }}
                  aria-label="Filtrar partidos de esta liga por mes"
                  className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">
                    Todos los meses ({availableMonthsForTab.length})
                  </option>
                  {availableMonthsForTab.map((m) => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.label} ({m.count})
                    </option>
                  ))}
                </select>
              )}

              {detailTab !== 'standings' && availableDatesForTab.length > 1 && (
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  aria-label="Filtrar partidos de esta liga por día"
                  className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">
                    Todos los días ({availableDatesForTab.length})
                  </option>
                  {availableDatesForTab.map((d) => (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.label} ({d.count})
                    </option>
                  ))}
                </select>
              )}

              <div
                role="tablist"
                aria-label="Secciones de la liga"
                className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === 'matches'}
                  onClick={() => {
                    setDetailTab('matches');
                    setSelectedMonthFilter('ALL');
                    setSelectedDateFilter('ALL');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    detailTab === 'matches'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Próximos ({upcomingAndLiveMatches.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === 'results'}
                  onClick={() => {
                    setDetailTab('results');
                    setSelectedMonthFilter('ALL');
                    setSelectedDateFilter('ALL');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    detailTab === 'results'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Resultados ({finishedMatches.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === 'standings'}
                  onClick={() => setDetailTab('standings')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    detailTab === 'standings'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Clasificación
                </button>
              </div>
            </div>
          </div>

          {detailTab !== 'standings' && availableMonthsForTab.length > 1 && (
            <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161D] flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonthFilter('ALL');
                  setSelectedDateFilter('ALL');
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                  selectedMonthFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Todos los meses ({activeMatchList.length})
              </button>
              {availableMonthsForTab.map((m) => (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedMonthFilter(m.monthKey);
                    setSelectedDateFilter('ALL');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                    selectedMonthFilter === m.monthKey
                      ? 'bg-slate-900 text-white dark:bg-emerald-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {m.label} ({m.count})
                </button>
              ))}
            </div>
          )}

          {/* Contenido del tab seleccionado */}
          {detailTab === 'standings' ? (
            standingsError ? (
              <div className="p-6 text-xs text-red-700 dark:text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>{standingsError}</span>
                <button
                  type="button"
                  onClick={() => loadStandings(selectedPath)}
                  className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  Reintentar
                </button>
              </div>
            ) : standingsLoading ? (
              <div className="p-5 space-y-2.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                  <div
                    key={row}
                    className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : !standings || standings.tables.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                Esta competición no tiene tabla de clasificación activa en este momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {standings.tables.map((group, gIdx) => {
                  const totalTeams = group.rows.length;
                  return (
                    <div key={`${group.groupName ?? 'main'}-${gIdx}`}>
                      {group.groupName && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {group.groupName}
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
                              <th className="py-2.5 pl-5 pr-2 w-10">#</th>
                              <th className="py-2.5 px-2">Equipo</th>
                              <th className="py-2.5 px-2 text-right w-11">
                                PJ
                              </th>
                              <th className="py-2.5 px-2 text-right w-10">
                                G
                              </th>
                              <th className="py-2.5 px-2 text-right w-10">
                                E
                              </th>
                              <th className="py-2.5 px-2 text-right w-10">
                                P
                              </th>
                              <th className="py-2.5 px-2 text-right w-16 hidden sm:table-cell">
                                Goles
                              </th>
                              <th className="py-2.5 px-2 text-right w-12 hidden md:table-cell">
                                DG
                              </th>
                              <th className="py-2.5 pl-2 pr-5 text-right w-12 text-slate-800 dark:text-slate-200">
                                Pts
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                            {group.rows.map((row) => {
                              const team = resolveTeamInfo(
                                row.teamName,
                                undefined,
                                row.logoUrl
                              );
                              const isTopZone =
                                standings.tables.length === 1 &&
                                totalTeams >= 10 &&
                                row.rank <= 4;
                              const isBottomZone =
                                standings.tables.length === 1 &&
                                totalTeams >= 14 &&
                                row.rank >= totalTeams - 2;

                              return (
                                <tr
                                  key={`${row.rank}-${row.teamName}`}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                                >
                                  <td
                                    className={`py-2.5 pl-5 pr-2 font-mono tabular-nums font-semibold ${
                                      isTopZone
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : isBottomZone
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {row.rank}
                                  </td>
                                  <td className="py-2.5 px-2 min-w-[160px]">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <TeamCrest team={team} size="sm" />
                                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                                        {row.teamName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                    {row.played}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                    {row.won}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                    {row.drawn}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                    {row.lost}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                                    {row.goalsFor}:{row.goalsAgainst}
                                  </td>
                                  <td
                                    className={`py-2.5 px-2 text-right font-mono tabular-nums hidden md:table-cell ${
                                      row.goalDiff > 0
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : row.goalDiff < 0
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {row.goalDiff > 0
                                      ? `+${row.goalDiff}`
                                      : row.goalDiff}
                                  </td>
                                  <td className="py-2.5 pl-2 pr-5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                    {row.points}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : matchesError ? (
            <div className="p-6 text-xs text-red-700 dark:text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{matchesError}</span>
              <button
                type="button"
                onClick={() => loadLeagueMatches(selectedPath)}
                className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                Reintentar
              </button>
            </div>
          ) : matchesLoading ? (
            <div className="p-5 space-y-2.5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                <div
                  key={row}
                  className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"
                />
              ))}
            </div>
          ) : groupedByDay.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {detailTab === 'results'
                  ? 'No hay resultados recientes disponibles en esta liga.'
                  : 'No hay próximos partidos programados en esta liga por ahora.'}
              </div>
              {detailTab === 'matches' && finishedMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDetailTab('results')}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Ver los {finishedMatches.length} resultados jugados
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {groupedByDay.map((group) => (
                <div key={group.dateKey}>
                  <div className="px-5 py-2.5 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span className="capitalize">
                        {formatFullDateFromKeyEs(group.dateKey)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {group.items.length}{' '}
                      {group.items.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {group.items.map((item) => {
                      const match = item.parsed;
                      const timeStr = formatTimeInTimezone(
                        match.kickoffIso,
                        timeZone
                      );
                      const hasScore =
                        (match.status === 'live' ||
                          match.status === 'finished') &&
                        match.homeScore !== undefined &&
                        match.awayScore !== undefined;
                      const roundTag = match.round.includes('·')
                        ? match.round.split('·').slice(1).join('·').trim()
                        : match.round;

                      return (
                        <div
                          key={item.id}
                          className="px-5 py-3 flex flex-col sm:grid sm:grid-cols-[1fr_116px_1fr_auto] sm:items-center gap-2 sm:gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          <div className="flex items-center sm:justify-end gap-2 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate sm:text-right order-2 sm:order-1">
                              {match.homeTeam.name}
                            </span>
                            <div className="order-1 sm:order-2 shrink-0">
                              <TeamCrest team={match.homeTeam} size="sm" />
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-0.5 font-mono tabular-nums px-2 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                            <span
                              className={`text-xs sm:text-sm font-bold ${
                                match.status === 'live'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : hasScore
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {hasScore
                                ? `${match.homeScore} - ${match.awayScore}`
                                : timeStr}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[105px]">
                              {match.status === 'live'
                                ? 'En directo'
                                : match.status === 'finished'
                                  ? `${roundTag} · Final`
                                  : roundTag}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest team={match.awayTeam} size="sm" />
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {match.awayTeam.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleImportSingle(match)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Agenda</span>
                            </button>

                            {match.flashscoreUrl && (
                              <a
                                href={match.flashscoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Ver ${match.homeTeam.name} vs ${match.awayTeam.name} en Flashscore.es`}
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
