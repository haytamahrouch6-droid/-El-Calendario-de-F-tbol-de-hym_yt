import { TEAMS_PRESETS } from '../data/initialMatches';
import {
  CompetitionId,
  FootballMatch,
  MatchStatus,
  TeamInfo,
} from '../types/match';

export interface ParsedScheduleMatch {
  competition: CompetitionId;
  round: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  kickoffIso: string;
  stadium: string;
  broadcast: string;
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  liveLabel?: string;
  flashscoreUrl?: string;
  notes?: string;
}

const FALLBACK_COLORS = [
  '#1E293B',
  '#1D4ED8',
  '#B91C1C',
  '#15803D',
  '#0284C7',
  '#6D28D9',
  '#CA8A04',
  '#EA580C',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function makeShortCode(name: string): string {
  const clean = name
    .replace(/\b(CF|FC|RCD|RC|CA|UD|CD|SD|Club|de|del|la)\b/gi, ' ')
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
    .trim()
    .toUpperCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].slice(0, 1) + words[1].slice(0, 2)).padEnd(3, 'X').slice(0, 3);
  }
  if (words.length === 1) {
    return words[0].slice(0, 3).padEnd(3, 'X');
  }
  return 'EQP';
}

export function resolveTeamInfo(
  name: string,
  shortCodeHint?: string,
  logoUrlHint?: string
): TeamInfo {
  const cleanName = name.trim();
  const lower = cleanName.toLowerCase();
  const presets = Object.values(TEAMS_PRESETS);

  const exact = presets.find((p) => p.name.toLowerCase() === lower);
  if (exact) {
    return logoUrlHint ? { ...exact, logoUrl: logoUrlHint } : exact;
  }

  const partial = presets.find(
    (p) =>
      lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower)
  );
  if (partial) {
    return {
      ...partial,
      name: cleanName,
      ...(logoUrlHint ? { logoUrl: logoUrlHint } : {}),
    };
  }

  return {
    name: cleanName,
    shortCode: (shortCodeHint || makeShortCode(cleanName)).toUpperCase().slice(0, 3),
    primaryColor: hashColor(cleanName),
    secondaryColor: '#F8FAFC',
    ...(logoUrlHint ? { logoUrl: logoUrlHint } : {}),
  };
}

const CLUB_NOISE_WORDS = new Set([
  'fc',
  'cf',
  'rcd',
  'rc',
  'ud',
  'cd',
  'sd',
  'ca',
  'ac',
  'as',
  'sc',
  'sv',
  'ss',
  'us',
  'osc',
  'afc',
  'ogc',
  'sbv',
  'es',
  'ad',
  'rb',
  'tsg',
  'vfb',
  'bsc',
  'club',
  'racing',
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'a',
  '1',
  'balompie',
  'sad',
  'deportivo',
]);

const BILINGUAL_TEAM_ALIASES: Array<[RegExp, string]> = [
  [/\batl\b\.?/g, 'atletico'],
  [/\butd\b\.?/g, 'united'],
  [/\bmunchen\b/g, 'munich'],
  [/\bkoln\b/g, 'colonia'],
  [/\b(?:a|la)\s+coruna\b/g, 'coruna'],
  [/\bpsg\b/g, 'parissaintgermain'],
  [/\bdenmark\b/g, 'dinamarca'],
  [/\bnorway\b/g, 'noruega'],
  [/\bwales\b/g, 'gales'],
  [/\bromania\b/g, 'rumania'],
  [/\bpoland\b/g, 'polonia'],
  [/\bsweden\b/g, 'suecia'],
  [/\bhungary\b/g, 'hungria'],
  [/\bnorthern\s+ireland\b/g, 'irlandadelnorte'],
  [/\brepublic\s+of\s+ireland\b/g, 'irlanda'],
  [/\bukraine\b/g, 'ucrania'],
  [/\bsouth\s+korea\b/g, 'coreadelsur'],
  [/\bbrazil\b/g, 'brasil'],
  [/\bjapan\b/g, 'japon'],
  [/\bsingapore\b/g, 'singapur'],
  [/\bbahrain\b/g, 'barein'],
  [/\bkyrgyz\s+republic\b/g, 'kirguistan'],
  [/\bpalestine\b/g, 'palestina'],
  [/\blebanon\b/g, 'libano'],
  [/\bsyria\b/g, 'siria'],
  [/\bsaudi\s+arabia\b/g, 'arabiasaudi'],
  [/\buzbekistan\b/g, 'uzbekistan'],
  [/\brussia\b/g, 'rusia'],
  [/\biraq\b/g, 'irak'],
  [/\bunited\s+arab\s+emirates\b/g, 'emiratosarabesunidos'],
  [/\bdominican\s+republic\b/g, 'republicadominicana'],
  [/\bsunderland\b/g, 'sunderland'],
  [/\bleicester\b/g, 'leicester'],
];

export function normalizeTeamMatchKey(name: string): string {
  let cleaned = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const [pattern, replacement] of BILINGUAL_TEAM_ALIASES) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  const tokens = cleaned
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !CLUB_NOISE_WORDS.has(t));
  if (tokens.length > 0) {
    return tokens.join('');
  }
  return cleaned.replace(/[^a-z0-9]/g, '');
}

export function areTeamsEquivalent(nameA: string, nameB: string): boolean {
  const a = normalizeTeamMatchKey(nameA);
  const b = normalizeTeamMatchKey(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    return true;
  }
  const aNoReal = a.startsWith('real') && a.length > 7 ? a.slice(4) : a;
  const bNoReal = b.startsWith('real') && b.length > 7 ? b.slice(4) : b;
  return aNoReal === bNoReal;
}

function normalizeCompetition(text: string): CompetitionId {
  const lower = text.toLowerCase();
  if (lower.includes('laliga') || lower.includes('la liga')) return 'laliga';
  if (lower.includes('champions')) return 'champions';
  if (lower.includes('premier')) return 'premier';
  if (lower.includes('selecci') || lower.includes('nations')) return 'seleccion';
  if (lower.includes('copa')) return 'copadelrey';
  return 'otros';
}

function cleanEscudoPrefix(raw: string): string {
  // Handles formats like "Escudo de Athletic Club Athletic Club" -> "Athletic Club"
  let str = raw.replace(/^Escudo de\s+/i, '').trim();
  str = str.replace(/\s+Escudo de\s+.*$/i, '').trim();

  // Check if the team name is duplicated consecutively ("Athletic Club Athletic Club")
  const tokens = str.split(/\s+/);
  if (tokens.length >= 2 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    const firstHalf = tokens.slice(0, half).join(' ');
    const secondHalf = tokens.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }
  return str;
}

/**
 * Deterministic parser for structured football schedule blocks
 * (such as official LaLiga schedule pastes).
 */
export function parseScheduleTextDeterministic(rawText: string): ParsedScheduleMatch[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedScheduleMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\bvs\b/i.test(line)) continue;

    // Split teams around " vs "
    const vsParts = line.split(/\s+vs\s+/i);
    if (vsParts.length < 2) continue;

    // If single-line pipe separated: "Team A vs Team B | 20/11/2026 20:00 UTC | LaLiga | TV"
    let homeRaw = vsParts[0];
    let awayRaw = vsParts[1];
    let metaLine = '';

    if (awayRaw.includes('|')) {
      const pipeIndex = awayRaw.indexOf('|');
      metaLine = awayRaw.slice(pipeIndex + 1);
      awayRaw = awayRaw.slice(0, pipeIndex);
    } else if (i + 1 < lines.length && /\d{2}\/\d{2}\/\d{4}/.test(lines[i + 1])) {
      metaLine = lines[i + 1];
      i += 1;
    }

    const homeName = cleanEscudoPrefix(homeRaw);
    const awayName = cleanEscudoPrefix(awayRaw);
    if (!homeName || !awayName) continue;

    // Extract DD/MM/YYYY HH:MM
    const dateMatch = metaLine.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!dateMatch) continue;

    const [, dd, mm, yyyy, hh, min] = dateMatch;
    const kickoffIso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`;
    if (Number.isNaN(new Date(kickoffIso).getTime())) continue;

    const compMatch = metaLine.match(/Competición:\s*([^|]+)/i);
    const tvMatch = metaLine.match(/TV:\s*([^|]+)/i);

    const roundText = compMatch ? compMatch[1].trim() : 'LaLiga';
    const broadcastText = tvMatch ? tvMatch[1].trim() : 'Por confirmar';

    results.push({
      competition: normalizeCompetition(roundText),
      round: roundText,
      homeTeam: resolveTeamInfo(homeName),
      awayTeam: resolveTeamInfo(awayName),
      kickoffIso,
      stadium: 'Por confirmar',
      broadcast: broadcastText,
    });
  }

  return results;
}

export function buildMatchFromParsed(
  parsed: ParsedScheduleMatch,
  idx: number
): FootballMatch {
  const defaultStatus: MatchStatus =
    new Date(parsed.kickoffIso).getTime() < new Date('2026-11-16T09:51:00Z').getTime()
      ? 'finished'
      : 'scheduled';

  return {
    id: `m-robot-${Date.now()}-${idx}`,
    competition: parsed.competition,
    round: parsed.round,
    homeTeam: parsed.homeTeam,
    awayTeam: parsed.awayTeam,
    kickoffIso: parsed.kickoffIso,
    stadium: parsed.stadium,
    broadcast: parsed.broadcast,
    status: parsed.status ?? defaultStatus,
    homeScore: parsed.homeScore,
    awayScore: parsed.awayScore,
    bookmarked: false,
    isHymStream: false,
    notes: parsed.notes,
  };
}
