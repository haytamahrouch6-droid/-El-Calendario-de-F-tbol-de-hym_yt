import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { COMPETITIONS, TEAMS_PRESETS } from '../data/initialMatches';
import { CompetitionId, FootballMatch, MatchStatus, TeamInfo } from '../types/match';
import {
  APP_TODAY_ISO,
  formatTimeInTimezone,
  getDateKeyInTimezone,
  localDateTimeToUtcIso,
} from '../utils/dateUtils';

interface MatchFormModalProps {
  open: boolean;
  initialMatch: FootballMatch | null;
  defaultDateKey: string | null;
  timeZone: string;
  onClose: () => void;
  onSave: (match: FootballMatch) => void;
}

const TEAM_COLORS = [
  '#1E293B',
  '#1D4ED8',
  '#B91C1C',
  '#15803D',
  '#CA8A04',
  '#6D28D9',
  '#0284C7',
  '#EA580C',
];

function makeShortCode(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
    .trim()
    .toUpperCase();
  if (!cleaned) return 'EQU';
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    return (words[0].slice(0, 1) + words[1].slice(0, 2)).padEnd(3, 'X');
  }
  return cleaned.slice(0, 3).padEnd(3, 'X');
}

export const MatchFormModal: React.FC<MatchFormModalProps> = ({
  open,
  initialMatch,
  defaultDateKey,
  timeZone,
  onClose,
  onSave,
}) => {
  const [competition, setCompetition] = useState<CompetitionId>('laliga');
  const [round, setRound] = useState('LaLiga · Jornada 14');
  const [homeName, setHomeName] = useState('Real Madrid');
  const [homeCode, setHomeCode] = useState('RMA');
  const [homeColor, setHomeColor] = useState('#1E293B');
  const [awayName, setAwayName] = useState('FC Barcelona');
  const [awayCode, setAwayCode] = useState('BAR');
  const [awayColor, setAwayColor] = useState('#1D4ED8');
  const [dateKey, setDateKey] = useState(APP_TODAY_ISO);
  const [timeStr, setTimeStr] = useState('21:00');
  const [stadium, setStadium] = useState('Santiago Bernabéu');
  const [broadcast, setBroadcast] = useState('Movistar LaLiga');
  const [status, setStatus] = useState<MatchStatus>('scheduled');
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [bookmarked, setBookmarked] = useState(true);
  const [isHymStream, setIsHymStream] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (initialMatch) {
      setCompetition(initialMatch.competition);
      setRound(initialMatch.round);
      setHomeName(initialMatch.homeTeam.name);
      setHomeCode(initialMatch.homeTeam.shortCode);
      setHomeColor(initialMatch.homeTeam.primaryColor);
      setAwayName(initialMatch.awayTeam.name);
      setAwayCode(initialMatch.awayTeam.shortCode);
      setAwayColor(initialMatch.awayTeam.primaryColor);
      setDateKey(getDateKeyInTimezone(initialMatch.kickoffIso, timeZone));
      setTimeStr(formatTimeInTimezone(initialMatch.kickoffIso, timeZone));
      setStadium(initialMatch.stadium);
      setBroadcast(initialMatch.broadcast);
      setStatus(initialMatch.status);
      setHomeScore(String(initialMatch.homeScore ?? 0));
      setAwayScore(String(initialMatch.awayScore ?? 0));
      setBookmarked(initialMatch.bookmarked);
      setIsHymStream(initialMatch.isHymStream);
      setNotes(initialMatch.notes ?? '');
    } else {
      setCompetition('laliga');
      setRound('LaLiga · Jornada 14');
      setHomeName('');
      setHomeCode('');
      setHomeColor('#1E293B');
      setAwayName('');
      setAwayCode('');
      setAwayColor('#1D4ED8');
      setDateKey(defaultDateKey || APP_TODAY_ISO);
      setTimeStr('21:00');
      setStadium('');
      setBroadcast('Movistar LaLiga');
      setStatus('scheduled');
      setHomeScore('0');
      setAwayScore('0');
      setBookmarked(true);
      setIsHymStream(false);
      setNotes('');
    }
  }, [open, initialMatch, defaultDateKey, timeZone]);

  if (!open) return null;

  const presetList = Object.values(TEAMS_PRESETS);

  const handleSelectPreset = (side: 'home' | 'away', teamName: string) => {
    const found = presetList.find((t) => t.name === teamName);
    if (side === 'home') {
      setHomeName(teamName);
      if (found) {
        setHomeCode(found.shortCode);
        setHomeColor(found.primaryColor);
      } else {
        setHomeCode(makeShortCode(teamName));
      }
    } else {
      setAwayName(teamName);
      if (found) {
        setAwayCode(found.shortCode);
        setAwayColor(found.primaryColor);
      } else {
        setAwayCode(makeShortCode(teamName));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeName.trim() || !awayName.trim()) {
      setErrorMsg('Indica tanto el equipo local como el visitante.');
      return;
    }
    if (!dateKey || !timeStr) {
      setErrorMsg('Indica la fecha y la hora del partido.');
      return;
    }

    const foundHome = presetList.find(
      (t) => t.name.toLowerCase() === homeName.trim().toLowerCase()
    );
    const foundAway = presetList.find(
      (t) => t.name.toLowerCase() === awayName.trim().toLowerCase()
    );

    const homeTeam: TeamInfo = {
      name: homeName.trim(),
      shortCode: (homeCode.trim() || makeShortCode(homeName)).toUpperCase().slice(0, 3),
      primaryColor: homeColor,
      secondaryColor: foundHome?.secondaryColor ?? '#F8FAFC',
    };

    const awayTeam: TeamInfo = {
      name: awayName.trim(),
      shortCode: (awayCode.trim() || makeShortCode(awayName)).toUpperCase().slice(0, 3),
      primaryColor: awayColor,
      secondaryColor: foundAway?.secondaryColor ?? '#F8FAFC',
    };

    const kickoffIso = localDateTimeToUtcIso(dateKey, timeStr, timeZone);

    const hasScore = status === 'live' || status === 'finished';

    onSave({
      id: initialMatch?.id ?? `m-custom-${Date.now()}`,
      competition,
      round: round.trim() || COMPETITIONS[competition]?.label || 'Partido',
      homeTeam,
      awayTeam,
      kickoffIso,
      stadium: stadium.trim() || 'Por confirmar',
      broadcast: broadcast.trim() || 'Por confirmar',
      status,
      homeScore: hasScore ? Math.max(0, Number(homeScore) || 0) : undefined,
      awayScore: hasScore ? Math.max(0, Number(awayScore) || 0) : undefined,
      bookmarked,
      isHymStream,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialMatch ? 'Editar partido' : 'Añadir nuevo partido'}
        className="relative z-10 w-full max-w-xl bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {initialMatch ? 'Editar partido' : 'Añadir partido al calendario'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <datalist id="teams-presets-list">
            {Object.entries(TEAMS_PRESETS).map(([presetKey, team]) => (
              <option key={presetKey} value={team.name} />
            ))}
          </datalist>

          {errorMsg && (
            <div className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Competición y Jornada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Competición
              </label>
              <select
                value={competition}
                onChange={(e) => {
                  const next = e.target.value as CompetitionId;
                  setCompetition(next);
                  if (!initialMatch) {
                    setRound(COMPETITIONS[next]?.shortLabel ?? '');
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {(Object.keys(COMPETITIONS) as CompetitionId[]).map((id) => (
                  <option key={id} value={id}>
                    {COMPETITIONS[id].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Jornada o ronda
              </label>
              <input
                type="text"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                placeholder="Ej. LaLiga · Jornada 14"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Local y Visitante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Equipo local
              </label>
              <input
                type="text"
                list="teams-presets-list"
                value={homeName}
                onChange={(e) => handleSelectPreset('home', e.target.value)}
                placeholder="Ej. Real Madrid"
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={3}
                  value={homeCode}
                  onChange={(e) => setHomeCode(e.target.value.toUpperCase())}
                  placeholder="RMA"
                  className="w-16 px-2 py-1 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center"
                />
                <div className="flex items-center gap-1">
                  {TEAM_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setHomeColor(hex)}
                      aria-label={`Color local ${hex}`}
                      className={`w-4 h-4 rounded-xs transition-transform ${
                        homeColor === hex ? 'ring-2 ring-offset-1 ring-emerald-600 scale-110' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Equipo visitante
              </label>
              <input
                type="text"
                list="teams-presets-list"
                value={awayName}
                onChange={(e) => handleSelectPreset('away', e.target.value)}
                placeholder="Ej. FC Barcelona"
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={3}
                  value={awayCode}
                  onChange={(e) => setAwayCode(e.target.value.toUpperCase())}
                  placeholder="BAR"
                  className="w-16 px-2 py-1 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center"
                />
                <div className="flex items-center gap-1">
                  {TEAM_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setAwayColor(hex)}
                      aria-label={`Color visitante ${hex}`}
                      className={`w-4 h-4 rounded-xs transition-transform ${
                        awayColor === hex ? 'ring-2 ring-offset-1 ring-emerald-600 scale-110' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fecha, Hora y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Hora de inicio
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="scheduled">Programado</option>
                <option value="live">En directo</option>
                <option value="finished">Finalizado</option>
              </select>
            </div>
          </div>

          {(status === 'live' || status === 'finished') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Goles local ({homeCode || 'LOC'})
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Goles visitante ({awayCode || 'VIS'})
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          )}

          {/* Estadio y Emisión */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Estadio
              </label>
              <input
                type="text"
                value={stadium}
                onChange={(e) => setStadium(e.target.value)}
                placeholder="Ej. Santiago Bernabéu"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Canal / Emisión
              </label>
              <input
                type="text"
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                placeholder="Ej. Movistar LaLiga, DAZN..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bookmarked}
                onChange={(e) => setBookmarked(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-700"
              />
              <span>Guardar en mi agenda</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isHymStream}
                onChange={(e) => setIsHymStream(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-700"
              />
              <span>Hacer directo en hym_yt</span>
            </label>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Notas para vídeo o directo (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Previa 30 minutos antes en YouTube..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {initialMatch ? 'Guardar cambios' : 'Añadir partido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
