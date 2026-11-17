import React, { useState } from 'react';
import {
  Bookmark,
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  Globe,
  Radio,
  RotateCcw,
  Smartphone,
  X,
} from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { CompetitionId } from '../types/match';
import { UserProfile } from './ProfileModal';
import {
  APP_TODAY_ISO,
  TIMEZONE_OPTIONS,
  WEEKDAYS_SHORT_ES,
  formatMonthTitleEs,
  getMonthGridDays,
} from '../utils/dateUtils';

interface SidebarProps {
  currentYear: number;
  currentMonthIndex: number;
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  onSelectMonth: (year: number, monthIndex: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToToday: () => void;
  activeCompetitions: CompetitionId[];
  onToggleCompetition: (id: CompetitionId) => void;
  onResetCompetitions: () => void;
  onlyBookmarked: boolean;
  onToggleOnlyBookmarked: () => void;
  onlyHymStreams: boolean;
  onToggleOnlyHymStreams: () => void;
  competitionCounts: Record<CompetitionId, number>;
  bookmarkedCount: number;
  hymStreamCount: number;
  matchDateKeysSet: Set<string>;
  timeZone: string;
  onChangeTimeZone: (tz: string) => void;
  onExportIcs: () => void;
  onExportJson: () => void;
  onResetMatches: () => void;
  onOpenRobot: () => void;
  isPwaInstalled: boolean;
  onOpenInstallModal: () => void;
  profile: UserProfile;
  onOpenProfile: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const MONTHS_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr',
  'May', 'Jun', 'Jul', 'Ago',
  'Sep', 'Oct', 'Nov', 'Dic',
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentYear,
  currentMonthIndex,
  selectedDateKey,
  onSelectDateKey,
  onSelectMonth,
  onPrevMonth,
  onNextMonth,
  onJumpToToday,
  activeCompetitions,
  onToggleCompetition,
  onResetCompetitions,
  onlyBookmarked,
  onToggleOnlyBookmarked,
  onlyHymStreams,
  onToggleOnlyHymStreams,
  competitionCounts,
  bookmarkedCount,
  hymStreamCount,
  matchDateKeysSet,
  timeZone,
  onChangeTimeZone,
  onExportIcs,
  onExportJson,
  onResetMatches,
  onOpenRobot,
  isPwaInstalled,
  onOpenInstallModal,
  profile,
  onOpenProfile,
  mobileOpen,
  onCloseMobile,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const miniDays = getMonthGridDays(currentYear, currentMonthIndex);

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#11161D] border-r border-slate-200 dark:border-slate-800/90 text-slate-900 dark:text-slate-100">
      {/* Perfil de hym_yt */}
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onOpenProfile();
            onCloseMobile();
          }}
          aria-label="Abrir mi perfil"
          className="flex items-center gap-3 min-w-0 flex-1 text-left p-1.5 -m-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
        >
          <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-950 flex items-center justify-center">
            {!avatarError ? (
              <img
                src="/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png"
                alt="Perfil oficial de HYM_YT Fútbol en Directo"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display font-bold text-sm text-white">
                HYM
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
                {profile.displayName}
              </span>
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0 group-hover:underline">
                Mi perfil
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {profile.tagline}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú lateral"
          className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable interior */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Mini Calendario */}
        <section aria-label="Navegación rápida del mes">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {formatMonthTitleEs(currentYear, currentMonthIndex)}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevMonth}
                aria-label="Mes anterior"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onNextMonth}
                aria-label="Mes siguiente"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center mb-1">
            {WEEKDAYS_SHORT_ES.map((day) => (
              <div
                key={day}
                className="text-[11px] font-medium text-slate-400 dark:text-slate-500 py-1"
              >
                {day.slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {miniDays.map((day) => {
              const isToday = day.dateKey === APP_TODAY_ISO;
              const isSelected = day.dateKey === selectedDateKey;
              const hasMatch = matchDateKeysSet.has(day.dateKey);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => {
                    onSelectDateKey(day.dateKey);
                    onCloseMobile();
                  }}
                  className={`relative mx-auto w-7 h-7 rounded-md text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-emerald-700 text-white font-semibold'
                      : isToday
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                        : day.inCurrentMonth
                          ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span>{day.dayNumber}</span>
                  {hasMatch && !isSelected && (
                    <span
                      className={`w-3 h-0.5 rounded-none mt-0.5 ${
                        isToday ? 'bg-emerald-400' : 'bg-emerald-600 dark:bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onJumpToToday}
            className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            Ir a hoy · 16 nov
          </button>

          {/* Selector rápido de todos los meses del año */}
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Meses ({currentYear})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectMonth(currentYear - 1, currentMonthIndex)}
                  aria-label="Año anterior"
                  className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMonth(currentYear + 1, currentMonthIndex)}
                  aria-label="Año siguiente"
                  className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTHS_SHORT_ES.map((label, mIdx) => {
                const isActive = mIdx === currentMonthIndex;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onSelectMonth(currentYear, mIdx);
                      onCloseMobile();
                    }}
                    className={`py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Vistas rápidas de agenda */}
        <section className="pt-5 border-t border-slate-200 dark:border-slate-800/90 space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Agenda personal
          </h2>

          <button
            type="button"
            onClick={onToggleOnlyBookmarked}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              onlyBookmarked
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Partidos guardados</span>
            </span>
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              {bookmarkedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleOnlyHymStreams}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              onlyHymStreams
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Directos en hym_yt</span>
            </span>
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              {hymStreamCount}
            </span>
          </button>
        </section>

        {/* Competiciones */}
        <section className="pt-5 border-t border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Competiciones
            </h2>
            {activeCompetitions.length > 0 && (
              <button
                type="button"
                onClick={onResetCompetitions}
                className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                Ver todas
              </button>
            )}
          </div>

          <div className="space-y-1">
            {(Object.keys(COMPETITIONS) as CompetitionId[]).map((compId) => {
              const meta = COMPETITIONS[compId];
              const isSelected = activeCompetitions.includes(compId);
              const count = competitionCounts[compId] ?? 0;

              return (
                <button
                  key={compId}
                  type="button"
                  onClick={() => onToggleCompetition(compId)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: meta.accentHex }}
                    />
                    <span className="truncate">{meta.label}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Zona Horaria */}
        <section className="pt-5 border-t border-slate-200 dark:border-slate-800/90">
          <label
            htmlFor="timezone-select"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Zona horaria</span>
          </label>
          <select
            id="timezone-select"
            value={timeZone}
            onChange={(e) => onChangeTimeZone(e.target.value)}
            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </section>
      </div>

      {/* Footer de utilidades reales */}
      <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800/90 space-y-1.5">
        {!isPwaInstalled && (
          <button
            type="button"
            onClick={() => {
              onOpenInstallModal();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Descargar app móvil</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onOpenRobot();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md transition-colors whitespace-nowrap"
        >
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span>Robot de horarios</span>
        </button>
        <button
          type="button"
          onClick={onExportIcs}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Exportar calendario (.ics)</span>
        </button>
        <button
          type="button"
          onClick={onExportJson}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap"
        >
          <FileJson className="w-3.5 h-3.5 shrink-0" />
          <span>Exportar partidos (.json)</span>
        </button>
        <button
          type="button"
          onClick={onResetMatches}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>Restablecer partidos base</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[268px] shrink-0 h-full">
        {content}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-[280px] max-w-[85vw] h-full">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
