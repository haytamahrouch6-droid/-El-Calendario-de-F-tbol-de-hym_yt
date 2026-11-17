import React, { useState } from 'react';
import { ArrowRight, Radio } from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  APP_TODAY_ISO,
  WEEKDAYS_SHORT_ES,
  formatMonthTitleEs,
  formatTimeInTimezone,
  getDateKeyInTimezone,
  getMonthGridDays,
} from '../utils/dateUtils';

interface AllMonthsViewProps {
  matches: FootballMatch[];
  timeZone: string;
  selectedDateKey: string;
  onOpenMonth: (year: number, monthIndex: number) => void;
  onSelectDayInMonth: (dateKey: string) => void;
  onInspectMatch: (match: FootballMatch) => void;
}

type RangeMode = 'season' | '2026' | '2027';

function getMonthsForRange(
  range: RangeMode
): Array<{ year: number; monthIndex: number }> {
  if (range === '2026') {
    return Array.from({ length: 12 }, (_, m) => ({ year: 2026, monthIndex: m }));
  }
  if (range === '2027') {
    return Array.from({ length: 12 }, (_, m) => ({ year: 2027, monthIndex: m }));
  }
  // Temporada 2026-27: Agosto 2026 -> Julio 2027 (12 meses)
  return [
    { year: 2026, monthIndex: 7 },
    { year: 2026, monthIndex: 8 },
    { year: 2026, monthIndex: 9 },
    { year: 2026, monthIndex: 10 },
    { year: 2026, monthIndex: 11 },
    { year: 2027, monthIndex: 0 },
    { year: 2027, monthIndex: 1 },
    { year: 2027, monthIndex: 2 },
    { year: 2027, monthIndex: 3 },
    { year: 2027, monthIndex: 4 },
    { year: 2027, monthIndex: 5 },
    { year: 2027, monthIndex: 6 },
  ];
}

export const AllMonthsView: React.FC<AllMonthsViewProps> = ({
  matches,
  timeZone,
  selectedDateKey,
  onOpenMonth,
  onSelectDayInMonth,
  onInspectMatch,
}) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('season');

  const monthsList = getMonthsForRange(rangeMode);

  // Index matches by monthKey (YYYY-MM) and dateKey (YYYY-MM-DD)
  const matchesByMonth = new Map<string, FootballMatch[]>();
  const matchesByDate = new Map<string, FootballMatch[]>();

  for (const m of matches) {
    const dKey = getDateKeyInTimezone(m.kickoffIso, timeZone);
    const mKey = dKey.slice(0, 7);

    const mArr = matchesByMonth.get(mKey) ?? [];
    mArr.push(m);
    matchesByMonth.set(mKey, mArr);

    const dArr = matchesByDate.get(dKey) ?? [];
    dArr.push(m);
    matchesByDate.set(dKey, dArr);
  }

  for (const [, arr] of matchesByMonth) {
    arr.sort(
      (a, b) =>
        new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
    );
  }

  return (
    <div className="space-y-5">
      {/* Range selector bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Vista anual · Todos los meses
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Haz clic en cualquier día o mes para abrir la programación completa de esa jornada.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Seleccionar bloque de 12 meses"
          className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={rangeMode === 'season'}
            onClick={() => setRangeMode('season')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              rangeMode === 'season'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Temporada 2026–27
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rangeMode === '2026'}
            onClick={() => setRangeMode('2026')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap font-mono tabular-nums ${
              rangeMode === '2026'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Año 2026
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rangeMode === '2027'}
            onClick={() => setRangeMode('2027')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap font-mono tabular-nums ${
              rangeMode === '2027'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Año 2027
          </button>
        </div>
      </div>

      {/* 12-Month Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {monthsList.map(({ year, monthIndex }) => {
          const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          const monthMatches = matchesByMonth.get(monthKey) ?? [];
          const streamCount = monthMatches.filter((m) => m.isHymStream).length;
          const gridDays = getMonthGridDays(year, monthIndex);
          const isCurrentMonth = year === 2026 && monthIndex === 10;

          // Pick up to 2 featured matches for this month (preferring stream/bookmarked)
          const highlights = [...monthMatches]
            .sort((a, b) => {
              const scoreA = (a.isHymStream ? 2 : 0) + (a.bookmarked ? 1 : 0);
              const scoreB = (b.isHymStream ? 2 : 0) + (b.bookmarked ? 1 : 0);
              if (scoreB !== scoreA) return scoreB - scoreA;
              return (
                new Date(a.kickoffIso).getTime() -
                new Date(b.kickoffIso).getTime()
              );
            })
            .slice(0, 2);

          return (
            <section
              key={monthKey}
              className={`bg-white dark:bg-[#11161D] border rounded-xl overflow-hidden flex flex-col ${
                isCurrentMonth
                  ? 'border-emerald-500/70 dark:border-emerald-700'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Month Header */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                      {formatMonthTitleEs(year, monthIndex)}
                    </h4>
                    {isCurrentMonth && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        · Actual
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                    {monthMatches.length}{' '}
                    {monthMatches.length === 1 ? 'partido' : 'partidos'}
                    {streamCount > 0 ? ` · ${streamCount} directos` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenMonth(year, monthIndex)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Abrir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mini 7-col calendar */}
              <div className="p-4 flex-1 space-y-4">
                <div>
                  <div className="grid grid-cols-7 text-center mb-1">
                    {WEEKDAYS_SHORT_ES.map((wd) => (
                      <div
                        key={wd}
                        className="text-[10px] font-medium text-slate-400 dark:text-slate-500 py-0.5"
                      >
                        {wd.slice(0, 1)}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-y-0.5 text-center">
                    {gridDays.map((day) => {
                      const dayCount = (matchesByDate.get(day.dateKey) ?? []).length;
                      const isToday = day.dateKey === APP_TODAY_ISO;
                      const isSelected = day.dateKey === selectedDateKey;

                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          onClick={() => onSelectDayInMonth(day.dateKey)}
                          title={
                            dayCount > 0
                              ? `${day.dateKey}: ${dayCount} partidos`
                              : day.dateKey
                          }
                          className={`mx-auto w-7 h-7 rounded-md text-[11px] font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
                            isToday
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                              : isSelected && day.inCurrentMonth
                                ? 'bg-emerald-700 text-white font-semibold'
                                : day.inCurrentMonth
                                  ? dayCount > 0
                                    ? 'text-slate-900 dark:text-white font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  : 'text-slate-300 dark:text-slate-700'
                          }`}
                        >
                          <span className="leading-none">{day.dayNumber}</span>
                          {dayCount > 0 && day.inCurrentMonth && !isToday && (
                            <span className="w-3 h-0.5 bg-emerald-600 dark:bg-emerald-400 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Month highlights */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  {highlights.length === 0 ? (
                    <div className="text-[11px] text-slate-400 dark:text-slate-600 py-1">
                      Sin partidos programados aún
                    </div>
                  ) : (
                    highlights.map((m) => {
                      const comp = COMPETITIONS[m.competition];
                      const dKey = getDateKeyInTimezone(m.kickoffIso, timeZone);
                      const dayNum = dKey.slice(8, 10);
                      const timeStr = formatTimeInTimezone(m.kickoffIso, timeZone);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onInspectMatch(m)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-1.5 h-1.5 rounded-xs shrink-0"
                              style={{
                                backgroundColor: comp?.accentHex ?? '#475569',
                              }}
                            />
                            <span className="font-mono tabular-nums text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                              {dayNum} · {timeStr}
                            </span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                              {m.homeTeam.shortCode} vs {m.awayTeam.shortCode}
                            </span>
                          </div>
                          {m.isHymStream && (
                            <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
