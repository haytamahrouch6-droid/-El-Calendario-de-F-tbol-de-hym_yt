import React from 'react';
import { Bookmark, Plus, Radio, Tv } from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  APP_TODAY_ISO,
  formatFullDateFromKeyEs,
  formatRelativeDayLabel,
  formatTimeInTimezone,
  getDateKeyInTimezone,
} from '../utils/dateUtils';
import { TeamCrest } from './TeamCrest';

interface ListViewProps {
  matches: FootballMatch[];
  timeZone: string;
  onInspectMatch: (match: FootballMatch) => void;
  onToggleBookmark: (matchId: string) => void;
  onToggleHymStream: (matchId: string) => void;
  onOpenNewMatch: () => void;
  onResetFilters: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  matches,
  timeZone,
  onInspectMatch,
  onToggleBookmark,
  onToggleHymStream,
  onOpenNewMatch,
  onResetFilters,
}) => {
  const sortedMatches = [...matches].sort(
    (a, b) =>
      new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
  );

  if (sortedMatches.length === 0) {
    return (
      <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-14 text-center space-y-4">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No se encontraron partidos
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Ningún encuentro coincide con la búsqueda o los filtros de
            competición seleccionados.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={onOpenNewMatch}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir partido</span>
          </button>
        </div>
      </div>
    );
  }

  // Group chronologically by dateKey
  const groups: Array<{ dateKey: string; items: FootballMatch[] }> = [];
  for (const match of sortedMatches) {
    const key = getDateKeyInTimezone(match.kickoffIso, timeZone);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dateKey === key) {
      lastGroup.items.push(match);
    } else {
      groups.push({ dateKey: key, items: [match] });
    }
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const relLabel = formatRelativeDayLabel(group.dateKey, APP_TODAY_ISO);
        const isToday = group.dateKey === APP_TODAY_ISO;

        return (
          <section
            key={group.dateKey}
            className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            {/* Date group header */}
            <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {relLabel && (
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {relLabel} ·
                  </span>
                )}
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  {formatFullDateFromKeyEs(group.dateKey)}
                </h3>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {group.items.length}{' '}
                {group.items.length === 1 ? 'partido' : 'partidos'}
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {group.items.map((match) => {
                const comp = COMPETITIONS[match.competition];
                const timeStr = formatTimeInTimezone(
                  match.kickoffIso,
                  timeZone
                );

                return (
                  <div
                    key={match.id}
                    onClick={() => onInspectMatch(match)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onInspectMatch(match);
                      }
                    }}
                    className="px-5 py-3.5 grid grid-cols-1 md:grid-cols-[72px_180px_1fr_200px_110px] items-center gap-3 md:gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                  >
                    {/* Hora o Estado */}
                    <div className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {match.status === 'live' ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          En directo
                        </span>
                      ) : match.status === 'finished' ? (
                        <span className="text-slate-500 dark:text-slate-400">
                          Finalizado
                        </span>
                      ) : (
                        timeStr
                      )}
                    </div>

                    {/* Competición (texto limpio sin pill) */}
                    <div className="flex items-center gap-2 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{
                          backgroundColor: comp?.accentHex ?? '#475569',
                        }}
                      />
                      <span className="truncate">{match.round}</span>
                    </div>

                    {/* Enfrentamiento */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end md:justify-start">
                        <TeamCrest team={match.homeTeam} size="sm" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {match.homeTeam.name}
                        </span>
                      </div>

                      <div
                        className={`shrink-0 font-mono tabular-nums text-xs font-bold px-2 ${
                          match.status === 'live'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {match.status === 'live' || match.status === 'finished'
                          ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
                          : 'vs'}
                      </div>

                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <TeamCrest team={match.awayTeam} size="sm" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {match.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    {/* Canal / Estadio */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                      <Tv className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {match.broadcast} · {match.stadium}
                      </span>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHymStream(match.id);
                        }}
                        title={
                          match.isHymStream
                            ? 'Quitar de directos hym_yt'
                            : 'Marcar como directo hym_yt'
                        }
                        aria-label="Alternar directo en hym_yt"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                          match.isHymStream
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Radio className="w-3 h-3" />
                        {match.isHymStream && <span>Directo</span>}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(match.id);
                        }}
                        title={
                          match.bookmarked
                            ? 'Quitar de guardados'
                            : 'Guardar partido'
                        }
                        aria-label="Alternar guardado en agenda"
                        className={`p-1.5 rounded transition-colors ${
                          match.bookmarked
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            match.bookmarked ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
