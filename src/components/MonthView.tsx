import React from 'react';
import { Bookmark, Plus, Radio, Tv } from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  APP_TODAY_ISO,
  WEEKDAYS_SHORT_ES,
  formatFullDateFromKeyEs,
  formatRelativeDayLabel,
  formatTimeInTimezone,
  getDateKeyInTimezone,
  getMonthGridDays,
} from '../utils/dateUtils';
import { TeamCrest } from './TeamCrest';

interface MonthViewProps {
  currentYear: number;
  currentMonthIndex: number;
  selectedDateKey: string;
  matches: FootballMatch[];
  timeZone: string;
  onSelectDateKey: (dateKey: string) => void;
  onInspectMatch: (match: FootballMatch) => void;
  onAddMatchForDate: (dateKey: string) => void;
  onToggleBookmark: (matchId: string) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentYear,
  currentMonthIndex,
  selectedDateKey,
  matches,
  timeZone,
  onSelectDateKey,
  onInspectMatch,
  onAddMatchForDate,
  onToggleBookmark,
}) => {
  const days = getMonthGridDays(currentYear, currentMonthIndex);

  const matchesByDate = new Map<string, FootballMatch[]>();
  for (const match of matches) {
    const key = getDateKeyInTimezone(match.kickoffIso, timeZone);
    const list = matchesByDate.get(key) ?? [];
    list.push(match);
    matchesByDate.set(key, list);
  }

  for (const [, list] of matchesByDate) {
    list.sort(
      (a, b) =>
        new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
    );
  }

  const selectedDayMatches = matchesByDate.get(selectedDateKey) ?? [];
  const selectedRelLabel = formatRelativeDayLabel(selectedDateKey, APP_TODAY_ISO);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
      {/* Rejilla mensual */}
      <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Cabecera de días */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
          {WEEKDAYS_SHORT_ES.map((day) => (
            <div
              key={day}
              className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 text-left border-r last:border-r-0 border-slate-200 dark:border-slate-800"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayMatches = matchesByDate.get(day.dateKey) ?? [];
            const isToday = day.dateKey === APP_TODAY_ISO;
            const isSelected = day.dateKey === selectedDateKey;
            const visibleMatches = dayMatches.slice(0, 3);
            const overflowCount = dayMatches.length - visibleMatches.length;

            return (
              <div
                key={day.dateKey}
                onClick={() => onSelectDateKey(day.dateKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDateKey(day.dateKey);
                  }
                }}
                aria-label={`${formatFullDateFromKeyEs(day.dateKey)}, ${dayMatches.length} partidos`}
                className={`group min-h-[118px] p-2 border-b border-r border-slate-200 dark:border-slate-800 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                  idx % 7 === 6 ? 'border-r-0' : ''
                } ${
                  isSelected
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                    : day.inCurrentMonth
                      ? 'bg-white dark:bg-[#11161D] hover:bg-slate-50/70 dark:hover:bg-slate-900/40'
                      : 'bg-slate-50/60 dark:bg-[#0D1117] text-slate-400 dark:text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono tabular-nums ${
                      isToday
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                        : isSelected
                          ? 'bg-emerald-700 text-white font-semibold'
                          : day.inCurrentMonth
                            ? 'text-slate-700 dark:text-slate-300 font-medium'
                            : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddMatchForDate(day.dateKey);
                    }}
                    title="Añadir partido este día"
                    aria-label={`Añadir partido el ${day.dateKey}`}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {visibleMatches.map((match) => {
                    const comp = COMPETITIONS[match.competition];
                    const timeStr = formatTimeInTimezone(
                      match.kickoffIso,
                      timeZone
                    );

                    return (
                      <button
                        key={match.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDateKey(day.dateKey);
                          onInspectMatch(match);
                        }}
                        className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] leading-tight text-left bg-slate-100/80 dark:bg-slate-800/70 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-xs shrink-0"
                          style={{
                            backgroundColor: comp?.accentHex ?? '#475569',
                          }}
                        />
                        <span
                          className={`font-mono tabular-nums text-[10px] shrink-0 ${
                            match.status === 'live'
                              ? 'font-bold text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {match.status === 'live' || match.status === 'finished'
                            ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}`
                            : timeStr}
                        </span>
                        <span className="font-medium truncate">
                          {match.homeTeam.shortCode} - {match.awayTeam.shortCode}
                        </span>
                        {match.isHymStream && (
                          <Radio
                            className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto"
                            aria-label="Directo en hym_yt"
                          />
                        )}
                      </button>
                    );
                  })}

                  {overflowCount > 0 && (
                    <div className="px-1.5 pt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                      +{overflowCount} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel de agenda del día seleccionado */}
      <aside
        aria-label="Partidos del día seleccionado"
        className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {selectedRelLabel && (
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                {selectedRelLabel}
              </div>
            )}
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white leading-snug">
              {formatFullDateFromKeyEs(selectedDateKey)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {selectedDayMatches.length}{' '}
              {selectedDayMatches.length === 1
                ? 'partido programado'
                : 'partidos programados'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAddMatchForDate(selectedDateKey)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir</span>
          </button>
        </div>

        {selectedDayMatches.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No hay partidos visibles para esta fecha con los filtros activos.
            </p>
            <button
              type="button"
              onClick={() => onAddMatchForDate(selectedDateKey)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Programar partido</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
            {selectedDayMatches.map((match) => {
              const comp = COMPETITIONS[match.competition];
              const timeStr = formatTimeInTimezone(match.kickoffIso, timeZone);

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
                  className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer space-y-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                >
                  {/* Unboxed metadata header */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{
                          backgroundColor: comp?.accentHex ?? '#475569',
                        }}
                      />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                        {match.round}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {match.isHymStream && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <Radio className="w-3 h-3" />
                          <span>Directo</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(match.id);
                        }}
                        aria-label={
                          match.bookmarked
                            ? 'Quitar de guardados'
                            : 'Guardar partido'
                        }
                        className={`p-1 rounded transition-colors ${
                          match.bookmarked
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
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

                  {/* Teams + Score/Time */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <TeamCrest team={match.homeTeam} size="sm" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {match.homeTeam.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TeamCrest team={match.awayTeam} size="sm" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {match.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {match.status === 'live' ? (
                        <div className="space-y-0.5">
                          <div className="font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                            {match.homeScore ?? 0} - {match.awayScore ?? 0}
                          </div>
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            En directo
                          </div>
                        </div>
                      ) : match.status === 'finished' ? (
                        <div className="space-y-0.5">
                          <div className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {match.homeScore ?? 0} - {match.awayScore ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Finalizado
                          </div>
                        </div>
                      ) : (
                        <div className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                          {timeStr}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Broadcast & stadium line */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                    <Tv className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {match.broadcast} · {match.stadium}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
};
