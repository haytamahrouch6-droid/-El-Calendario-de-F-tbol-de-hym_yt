import React from 'react';
import { Bookmark, Plus, Radio, Tv } from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  APP_TODAY_ISO,
  formatTimeInTimezone,
  getDateKeyInTimezone,
  getWeekDaysFromKey,
} from '../utils/dateUtils';
import { TeamCrest } from './TeamCrest';

interface WeekViewProps {
  selectedDateKey: string;
  matches: FootballMatch[];
  timeZone: string;
  onSelectDateKey: (dateKey: string) => void;
  onInspectMatch: (match: FootballMatch) => void;
  onAddMatchForDate: (dateKey: string) => void;
  onToggleBookmark: (matchId: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  selectedDateKey,
  matches,
  timeZone,
  onSelectDateKey,
  onInspectMatch,
  onAddMatchForDate,
  onToggleBookmark,
}) => {
  const weekDays = getWeekDaysFromKey(selectedDateKey);

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

  return (
    <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {weekDays.map((day) => {
          const dayMatches = matchesByDate.get(day.dateKey) ?? [];
          const isToday = day.dateKey === APP_TODAY_ISO;
          const isSelected = day.dateKey === selectedDateKey;

          return (
            <div
              key={day.dateKey}
              className={`min-h-[360px] flex flex-col ${
                isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/15' : ''
              }`}
            >
              {/* Column header */}
              <div
                onClick={() => onSelectDateKey(day.dateKey)}
                className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-md font-mono tabular-nums text-xs font-semibold flex items-center justify-center ${
                      isToday
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      {day.weekdayShort}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {day.monthShort}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddMatchForDate(day.dateKey);
                  }}
                  aria-label={`Añadir partido el ${day.dateKey}`}
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Match list */}
              <div className="p-2.5 space-y-2 flex-1">
                {dayMatches.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-8 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-600">
                      Sin partidos
                    </span>
                  </div>
                ) : (
                  dayMatches.map((match) => {
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
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-1.5 h-1.5 rounded-xs shrink-0"
                              style={{
                                backgroundColor: comp?.accentHex ?? '#475569',
                              }}
                            />
                            <span className="truncate">{comp?.shortLabel}</span>
                          </span>
                          <span
                            className={`font-mono tabular-nums font-medium ${
                              match.status === 'live'
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {match.status === 'live'
                              ? 'En directo'
                              : match.status === 'finished'
                                ? 'Final'
                                : timeStr}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <TeamCrest team={match.homeTeam} size="sm" />
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {match.homeTeam.shortCode}
                              </span>
                            </div>
                            {(match.status === 'live' ||
                              match.status === 'finished') && (
                              <span
                                className={`font-mono tabular-nums text-xs font-bold ${
                                  match.status === 'live'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {match.homeScore ?? 0}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <TeamCrest team={match.awayTeam} size="sm" />
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {match.awayTeam.shortCode}
                              </span>
                            </div>
                            {(match.status === 'live' ||
                              match.status === 'finished') && (
                              <span
                                className={`font-mono tabular-nums text-xs font-bold ${
                                  match.status === 'live'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {match.awayScore ?? 0}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 truncate">
                            <Tv className="w-3 h-3 shrink-0" />
                            <span className="truncate">{match.broadcast}</span>
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {match.isHymStream && (
                              <Radio
                                className="w-3 h-3 text-emerald-600 dark:text-emerald-400"
                                aria-label="Directo hym_yt"
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBookmark(match.id);
                              }}
                              aria-label="Guardar partido"
                              className={
                                match.bookmarked
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-400 hover:text-slate-700'
                              }
                            >
                              <Bookmark
                                className={`w-3 h-3 ${
                                  match.bookmarked ? 'fill-current' : ''
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
