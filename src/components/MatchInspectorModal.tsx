import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Calendar,
  Edit3,
  ExternalLink,
  MapPin,
  Radio,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import { COMPETITIONS } from '../data/initialMatches';
import { FootballMatch, MatchStatus } from '../types/match';
import {
  formatFullDateFromKeyEs,
  formatTimeInTimezone,
  getDateKeyInTimezone,
} from '../utils/dateUtils';
import { matchOfficialChannels } from './LiveChannelsSection';
import { TeamCrest } from './TeamCrest';

interface MatchInspectorModalProps {
  match: FootballMatch | null;
  timeZone: string;
  onClose: () => void;
  onUpdateMatch: (updated: FootballMatch) => void;
  onEditMatch: (match: FootballMatch) => void;
  onDeleteMatch: (matchId: string) => void;
}

export const MatchInspectorModal: React.FC<MatchInspectorModalProps> = ({
  match,
  timeZone,
  onClose,
  onUpdateMatch,
  onEditMatch,
  onDeleteMatch,
}) => {
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MatchStatus>('scheduled');
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (match) {
      setNotes(match.notes ?? '');
      setStatus(match.status);
      setHomeScore(String(match.homeScore ?? 0));
      setAwayScore(String(match.awayScore ?? 0));
      setConfirmDelete(false);
    }
  }, [match]);

  if (!match) return null;

  const comp = COMPETITIONS[match.competition];
  const dateKey = getDateKeyInTimezone(match.kickoffIso, timeZone);
  const timeStr = formatTimeInTimezone(match.kickoffIso, timeZone);
  const utcTimeStr = formatTimeInTimezone(match.kickoffIso, 'UTC');
  const matchingChannels = matchOfficialChannels(match.broadcast);

  const handleSaveStatusAndNotes = (
    nextStatus: MatchStatus,
    nextHomeScore: string,
    nextAwayScore: string,
    nextNotes: string
  ) => {
    const hasScore = nextStatus === 'live' || nextStatus === 'finished';
    onUpdateMatch({
      ...match,
      status: nextStatus,
      homeScore: hasScore ? Math.max(0, Number(nextHomeScore) || 0) : undefined,
      awayScore: hasScore ? Math.max(0, Number(nextAwayScore) || 0) : undefined,
      notes: nextNotes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/50">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha del partido ${match.homeTeam.name} contra ${match.awayTeam.name}`}
        className="relative z-10 w-full max-w-md h-full bg-white dark:bg-[#11161D] border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: comp?.accentHex ?? '#475569' }}
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
              {match.round}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha del partido"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Matchup showcase */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center text-center gap-2">
                <TeamCrest team={match.homeTeam} size="lg" />
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {match.homeTeam.name}
                </span>
              </div>

              <div className="text-center px-2">
                {status === 'live' || status === 'finished' ? (
                  <div
                    className={`font-mono tabular-nums text-2xl font-bold ${
                      status === 'live'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {homeScore} - {awayScore}
                  </div>
                ) : (
                  <div className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                    {timeStr}
                  </div>
                )}
                <div
                  className={`text-[11px] mt-0.5 ${
                    status === 'live'
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {status === 'live'
                    ? 'En directo'
                    : status === 'finished'
                      ? 'Finalizado'
                      : 'Hora inicio'}
                </div>
              </div>

              <div className="flex flex-col items-center text-center gap-2">
                <TeamCrest team={match.awayTeam} size="lg" />
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {match.awayTeam.name}
                </span>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {formatFullDateFromKeyEs(dateKey)} ·{' '}
                <span className="font-mono tabular-nums font-medium">
                  {timeStr}
                </span>
                {timeZone !== 'UTC' && (
                  <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {' '}
                    ({utcTimeStr} UTC)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{match.stadium}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 min-w-0">
                <div>{match.broadcast}</div>
                {matchingChannels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {matchingChannels.map((ch) => (
                      <a
                        key={ch.id}
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        <span>Ver en {ch.name}</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick action switches */}
          <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                onUpdateMatch({ ...match, bookmarked: !match.bookmarked })
              }
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                match.bookmarked
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${match.bookmarked ? 'fill-current' : ''}`}
              />
              <span>{match.bookmarked ? 'Guardado' : 'Guardar'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateMatch({ ...match, isHymStream: !match.isHymStream })
              }
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                match.isHymStream
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{match.isHymStream ? 'En directo hym_yt' : 'Marcar directo'}</span>
            </button>
          </div>

          {/* Marcador y Estado */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Estado y marcador
              </span>
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('scheduled');
                    handleSaveStatusAndNotes('scheduled', homeScore, awayScore, notes);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    status === 'scheduled'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Programado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus('live');
                    handleSaveStatusAndNotes('live', homeScore, awayScore, notes);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    status === 'live'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  En directo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus('finished');
                    handleSaveStatusAndNotes('finished', homeScore, awayScore, notes);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    status === 'finished'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Finalizado
                </button>
              </div>
            </div>

            {(status === 'live' || status === 'finished') && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 truncate">
                    {match.homeTeam.shortCode}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={homeScore}
                    onChange={(e) => {
                      setHomeScore(e.target.value);
                      handleSaveStatusAndNotes(
                        status,
                        e.target.value,
                        awayScore,
                        notes
                      );
                    }}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <span className="text-sm font-mono text-slate-400 pt-4">-</span>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 truncate">
                    {match.awayTeam.shortCode}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={awayScore}
                    onChange={(e) => {
                      setAwayScore(e.target.value);
                      handleSaveStatusAndNotes(
                        status,
                        homeScore,
                        e.target.value,
                        notes
                      );
                    }}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notas para el canal */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label
              htmlFor="match-notes"
              className="block text-xs font-semibold text-slate-900 dark:text-white"
            >
              Notas de producción (hym_yt)
            </label>
            <textarea
              id="match-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                handleSaveStatusAndNotes(status, homeScore, awayScore, notes)
              }
              placeholder="Ideas para título, miniatura, hora de previa o jugadores a seguir..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  handleSaveStatusAndNotes(status, homeScore, awayScore, notes)
                }
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors"
              >
                Guardar nota
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDeleteMatch(match.id)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors whitespace-nowrap"
              >
                Confirmar borrado
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onEditMatch(match)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar datos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
