import React, { useState } from 'react';
import { Bookmark, Calendar, Radio } from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch } from '../types/match';
import {
  APP_TODAY_ISO,
  formatDaysUntilLabel,
  formatFullDateFromKeyEs,
  formatRelativeDayLabel,
  formatTimeInTimezone,
  getDateKeyInTimezone,
} from '../utils/dateUtils';
import { TeamCrest } from './TeamCrest';

interface FeaturedMatchBannerProps {
  match: FootballMatch | null;
  timeZone: string;
  onInspectMatch: (match: FootballMatch) => void;
  onToggleBookmark: (matchId: string) => void;
}

export const FeaturedMatchBanner: React.FC<FeaturedMatchBannerProps> = ({
  match,
  timeZone,
  onInspectMatch,
  onToggleBookmark,
}) => {
  const [imgError, setImgError] = useState(false);

  if (!match) return null;

  const comp = COMPETITIONS[match.competition];
  const dateKey = getDateKeyInTimezone(match.kickoffIso, timeZone);
  const timeStr = formatTimeInTimezone(match.kickoffIso, timeZone);
  const relLabel = formatRelativeDayLabel(dateKey, APP_TODAY_ISO);
  const dateDisplay = relLabel
    ? `${relLabel} · ${formatFullDateFromKeyEs(dateKey)}`
    : formatFullDateFromKeyEs(dateKey);
  const countdown = formatDaysUntilLabel(match.kickoffIso);

  return (
    <section
      aria-label="Próximo partido destacado"
      className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-white"
    >
      {/* Background stadium photograph + measured scrim */}
      <div className="absolute inset-0">
        {!imgError ? (
          <img
            src="/src/assets/images/stadium_matchday_banner_1794822734275.jpg"
            alt="Estadio de fútbol iluminado al anochecer antes del saque inicial"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/55" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 px-6 py-5 lg:px-8 lg:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-3 min-w-0">
          {/* Unboxed metadata line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
            <span className="font-semibold text-emerald-400">
              {match.status === 'live'
                ? 'Partido en directo'
                : 'Próximo partido destacado'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{comp?.label ?? match.round}</span>
            <span aria-hidden="true">·</span>
            <span>{match.round}</span>
            <span aria-hidden="true">·</span>
            <span>{match.stadium}</span>
          </div>

          {/* Matchup headline */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <TeamCrest team={match.homeTeam} size="lg" />
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                {match.homeTeam.name}
              </span>
            </div>

            {match.status === 'live' || match.status === 'finished' ? (
              <span className="font-mono tabular-nums text-xl font-bold text-emerald-400 px-1">
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </span>
            ) : (
              <span className="font-mono text-sm text-slate-400 px-1">vs</span>
            )}

            <div className="flex items-center gap-2.5">
              <TeamCrest team={match.awayTeam} size="lg" />
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* Schedule & broadcast unboxed line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-white font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {dateDisplay} · {timeStr}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-300">
              {match.status === 'live'
                ? 'En directo'
                : match.status === 'finished'
                  ? 'Finalizado'
                  : countdown}
            </span>
            <span aria-hidden="true">·</span>
            <span>Emisión: {match.broadcast}</span>
            {match.isHymStream && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                  <Radio className="w-3.5 h-3.5" />
                  Directo en hym_yt
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleBookmark(match.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
              match.bookmarked
                ? 'bg-emerald-700/90 border-emerald-500 text-white hover:bg-emerald-700'
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${match.bookmarked ? 'fill-current' : ''}`}
            />
            <span>{match.bookmarked ? 'En tu agenda' : 'Guardar partido'}</span>
          </button>

          <button
            type="button"
            onClick={() => onInspectMatch(match)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Ver ficha del partido
          </button>
        </div>
      </div>
    </section>
  );
};
