import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ExtractedMatchPayload {
  competition: 'laliga' | 'champions' | 'premier' | 'seleccion' | 'copadelrey' | 'otros';
  round: string;
  homeTeamName: string;
  homeShortCode: string;
  awayTeamName: string;
  awayShortCode: string;
  kickoffIso: string;
  stadium: string;
  broadcast: string;
}

function normalizeCompetition(value: string | undefined): ExtractedMatchPayload['competition'] {
  const v = (value ?? '').toLowerCase();
  if (v.includes('laliga') || v.includes('la liga')) return 'laliga';
  if (v.includes('champions') || v.includes('ucl')) return 'champions';
  if (v.includes('premier')) return 'premier';
  if (v.includes('selecci') || v.includes('nations') || v.includes('mundial') || v.includes('euro')) {
    return 'seleccion';
  }
  if (v.includes('copa')) return 'copadelrey';
  return 'otros';
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

function extractJsonArrayFromText(rawText: string): unknown[] {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const startIdx = candidate.indexOf('[');
  const endIdx = candidate.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('No se encontró un listado JSON válido en la respuesta.');
  }
  const parsed = JSON.parse(candidate.slice(startIdx, endIdx + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('La respuesta no tiene formato de lista.');
  }
  return parsed;
}

function sanitizeExtractedMatches(items: unknown[]): ExtractedMatchPayload[] {
  const results: ExtractedMatchPayload[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const homeTeamName = String(obj.homeTeamName ?? '').trim();
    const awayTeamName = String(obj.awayTeamName ?? '').trim();
    const kickoffRaw = String(obj.kickoffIso ?? '').trim();
    if (!homeTeamName || !awayTeamName || !kickoffRaw) continue;

    const parsedDate = new Date(kickoffRaw);
    if (Number.isNaN(parsedDate.getTime())) continue;

    results.push({
      competition: normalizeCompetition(String(obj.competition ?? '')),
      round: String(obj.round ?? 'Jornada oficial').trim() || 'Jornada oficial',
      homeTeamName,
      homeShortCode:
        String(obj.homeShortCode ?? '').trim().toUpperCase().slice(0, 3) ||
        makeShortCode(homeTeamName),
      awayTeamName,
      awayShortCode:
        String(obj.awayShortCode ?? '').trim().toUpperCase().slice(0, 3) ||
        makeShortCode(awayTeamName),
      kickoffIso: parsedDate.toISOString(),
      stadium: String(obj.stadium ?? 'Por confirmar').trim() || 'Por confirmar',
      broadcast: String(obj.broadcast ?? 'Por confirmar').trim() || 'Por confirmar',
    });
  }
  return results;
}

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getMadridDateKey(offsetDays: number): string {
  const now = new Date();
  const madridParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = Number(madridParts.find((p) => p.type === 'year')?.value ?? '2026');
  const m = Number(madridParts.find((p) => p.type === 'month')?.value ?? '11');
  const d = Number(madridParts.find((p) => p.type === 'day')?.value ?? '17');

  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  const sy = shifted.getUTCFullYear();
  const sm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${sy}-${sm}-${sd}`;
}

function madridLocalToUtcIso(dateKey: string, hour: number, minute: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcGuess));

  const tzYear = Number(parts.find((p) => p.type === 'year')?.value);
  const tzMonth = Number(parts.find((p) => p.type === 'month')?.value);
  const tzDay = Number(parts.find((p) => p.type === 'day')?.value);
  const tzHourRaw = Number(parts.find((p) => p.type === 'hour')?.value);
  const tzHour = tzHourRaw === 24 ? 0 : tzHourRaw;
  const tzMinute = Number(parts.find((p) => p.type === 'minute')?.value);

  const renderedUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
  const offsetMs = renderedUtc - utcGuess;
  return new Date(utcGuess - offsetMs).toISOString();
}

function normalizeFlashscoreCompetition(
  leagueTitle: string
): ExtractedMatchPayload['competition'] {
  const v = leagueTitle.toLowerCase();
  if (v.includes('españa') && v.includes('laliga ea sports')) return 'laliga';
  if (v.includes('copa del rey')) return 'copadelrey';
  if (
    v.includes('europa: champions league') ||
    v.includes('uefa champions league')
  ) {
    return 'champions';
  }
  if (v.includes('inglaterra: premier league')) return 'premier';
  if (
    v.includes('nations league') ||
    v.includes('amistosos internacionales') ||
    v.includes('copa del mundo') ||
    v.includes('eurocopa') ||
    v.includes('copa de áfrica') ||
    v.includes('copa américa')
  ) {
    return 'seleccion';
  }
  return 'otros';
}

interface FlashscoreMatchPayload extends ExtractedMatchPayload {
  id: string;
  status: 'scheduled' | 'live' | 'finished';
  homeScore?: number;
  awayScore?: number;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  liveLabel?: string;
  flashscoreUrl: string;
  notes?: string;
}

const teamLogoUrlCache = new Map<string, string>();
const inFlightDesktopFetches = new Map<string, Promise<string>>();

function toFlashscoreLogoUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9_-]+\.(png|webp|jpg|jpeg|svg)$/i.test(trimmed)) {
    return `https://static.flashscore.com/res/image/data/${trimmed}`;
  }
  return undefined;
}

function registerTeamLogo(teamName: string, logoUrl?: string): void {
  if (!teamName || !logoUrl) return;
  const exactKey = teamName.trim().toLowerCase();
  if (exactKey) {
    teamLogoUrlCache.set(exactKey, logoUrl);
  }
  const normKey = normalizeTeamMatchKey(teamName);
  if (normKey) {
    teamLogoUrlCache.set(normKey, logoUrl);
  }
}

function lookupTeamLogo(teamName: string): string | undefined {
  if (!teamName) return undefined;
  const exact = teamLogoUrlCache.get(teamName.trim().toLowerCase());
  if (exact) return exact;
  const normKey = normalizeTeamMatchKey(teamName);
  return normKey ? teamLogoUrlCache.get(normKey) : undefined;
}

function extractAndRegisterLogosFromDesktopHtml(desktopHtml: string): void {
  if (!desktopHtml) return;
  for (const key of ['fixtures', 'summary-fixtures', 'results', 'summary-results']) {
    const regex = new RegExp(
      `cjs\\.initialFeeds\\[['"]${key}['"]\\]\\s*=\\s*\\{\\s*data:\\s*\\\`([\\s\\S]*?)\\\``
    );
    const match = desktopHtml.match(regex);
    if (!match) continue;
    const chunks = match[1].split('~AA÷');
    for (let i = 1; i < chunks.length; i++) {
      const parts = chunks[i].split('¬');
      const kv: Record<string, string> = {};
      for (let j = 1; j < parts.length; j++) {
        const sep = parts[j].indexOf('÷');
        if (sep > -1) {
          kv[parts[j].slice(0, sep)] = parts[j].slice(sep + 1);
        }
      }
      const homeName = decodeHtmlEntities((kv.AE || kv.FH || '').trim());
      const awayName = decodeHtmlEntities((kv.AF || kv.FK || '').trim());
      const homeLogo = toFlashscoreLogoUrl(kv.OA);
      const awayLogo = toFlashscoreLogoUrl(kv.OB);
      if (homeName && homeLogo) registerTeamLogo(homeName, homeLogo);
      if (awayName && awayLogo) registerTeamLogo(awayName, awayLogo);
    }
  }
}

async function fetchDesktopHtmlDeduped(desktopUrl: string): Promise<string> {
  if (!desktopUrl) return '';
  const pending = inFlightDesktopFetches.get(desktopUrl);
  if (pending) return pending;

  const task = fetch(desktopUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  })
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '')
    .finally(() => {
      inFlightDesktopFetches.delete(desktopUrl);
    });

  inFlightDesktopFetches.set(desktopUrl, task);
  return task;
}

async function fetchFlashscoreDayMatches(
  day: number,
  filterParam: string
): Promise<{ dateKey: string; matches: FlashscoreMatchPayload[] }> {
  const sParam =
    filterParam === 'live'
      ? 2
      : filterParam === 'finished'
        ? 3
        : filterParam === 'scheduled'
          ? 4
          : 1;

  const targetUrl = `https://m.flashscore.es/?d=${day}&s=${sParam}`;
  const upstream = await fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  });

  if (!upstream.ok) {
    throw new Error(`No se pudo conectar con Flashscore.es (HTTP ${upstream.status}).`);
  }

  const html = await upstream.text();
  const scoreDataMatch = html.match(/<div id="score-data">([\s\S]*?)<\/div>/i);
  const scoreHtml = scoreDataMatch ? scoreDataMatch[1] : '';
  const dateKey = getMadridDateKey(day);

  const matches: FlashscoreMatchPayload[] = [];
  const seen = new Set<string>();

  const tokenRegex =
    /<h4>([\s\S]*?)<\/h4>|<span([^>]*)>([\s\S]*?)<\/span>([\s\S]*?)<a\s+href="([^"]+)"\s+class="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentLeague = 'Fútbol internacional';
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(scoreHtml)) !== null) {
    if (match[1] !== undefined) {
      const cleanLeague = decodeHtmlEntities(
        stripHtmlTags(match[1].replace(/<a[\s\S]*?<\/a>/gi, ''))
      );
      if (cleanLeague) {
        currentLeague = cleanLeague;
      }
      continue;
    }

    const timeLabel = decodeHtmlEntities(stripHtmlTags(match[3] ?? ''));
    const teamsRaw = decodeHtmlEntities(stripHtmlTags(match[4] ?? ''));
    const href = match[5] ?? '';
    const statusClass = (match[6] ?? '').toLowerCase();
    const scoreRaw = decodeHtmlEntities(stripHtmlTags(match[7] ?? ''));

    const teamParts = teamsRaw.split(' - ').map((t) => t.trim()).filter(Boolean);
    if (teamParts.length < 2) continue;
    const homeTeamName = teamParts.slice(0, Math.ceil(teamParts.length / 2)).join(' - ');
    const awayTeamName = teamParts.slice(Math.ceil(teamParts.length / 2)).join(' - ');
    if (!homeTeamName || !awayTeamName) continue;

    let status: 'scheduled' | 'live' | 'finished' = 'scheduled';
    if (statusClass.includes('live')) {
      status = 'live';
    } else if (statusClass.includes('fin')) {
      status = 'finished';
    }

    let homeScore: number | undefined;
    let awayScore: number | undefined;
    const scoreNums = scoreRaw.match(/(\d+)\s*-\s*(\d+)/);
    if (scoreNums && (status === 'live' || status === 'finished')) {
      homeScore = Number(scoreNums[1]);
      awayScore = Number(scoreNums[2]);
    }

    let kickoffIso: string;
    const hhmm = timeLabel.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      kickoffIso = madridLocalToUtcIso(
        dateKey,
        Number(hhmm[1]),
        Number(hhmm[2])
      );
    } else if (day === 0) {
      kickoffIso = new Date().toISOString();
    } else {
      kickoffIso = madridLocalToUtcIso(dateKey, 12, 0);
    }

    const idMatch = href.match(/\/partido\/([^/?#]+)/i);
    const matchKey = idMatch ? idMatch[1] : `${homeTeamName}-${awayTeamName}-${kickoffIso}`;
    if (seen.has(matchKey)) continue;
    seen.add(matchKey);

    const cleanPath = href.split('?')[0];
    const flashscoreUrl = cleanPath.startsWith('http')
      ? cleanPath
      : `https://www.flashscore.es${cleanPath}`;

    matches.push({
      id: `fs-${matchKey}`,
      competition: normalizeFlashscoreCompetition(currentLeague),
      round: currentLeague,
      homeTeamName,
      homeShortCode: makeShortCode(homeTeamName),
      awayTeamName,
      awayShortCode: makeShortCode(awayTeamName),
      kickoffIso,
      stadium: 'Por confirmar',
      broadcast: 'Flashscore.es',
      status,
      homeScore,
      awayScore,
      homeLogoUrl: lookupTeamLogo(homeTeamName),
      awayLogoUrl: lookupTeamLogo(awayTeamName),
      liveLabel: timeLabel || undefined,
      flashscoreUrl,
      notes:
        status === 'live' && timeLabel
          ? `En directo (${timeLabel}) · Flashscore.es`
          : `Seguimiento y horarios en Flashscore.es`,
    });
  }

  return { dateKey, matches };
}

async function fetchFutbolHorariosMatches(): Promise<ExtractedMatchPayload[]> {
  const upstream = await fetch('https://futbolhorarios.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; hym-yt-calendar/1.0)' },
  });
  if (!upstream.ok) {
    throw new Error(
      `No se pudo conectar con futbolhorarios.com (HTTP ${upstream.status}).`
    );
  }

  const html = await upstream.text();
  const articles = html.match(/<article class="match"[\s\S]*?<\/article>/g) ?? [];
  const seen = new Set<string>();
  const matches: ExtractedMatchPayload[] = [];

  for (const article of articles) {
    const timeRaw = decodeHtmlEntities(
      (article.match(/<div class="when">([^<]+)/) ?? [])[1] ?? ''
    );
    const league = decodeHtmlEntities(
      (article.match(/<div class="when">[\s\S]*?<small>([^<]+)<\/small>/) ?? [])[1] ?? ''
    );
    const teams = [
      ...article.matchAll(/<div class="team">[\s\S]*?<a[^>]*>([^<]+)<\/a><\/div>/g),
    ].map((m) => decodeHtmlEntities(m[1]));
    const tag = decodeHtmlEntities(
      (article.match(/<span class="league-tag">([^<]+)<\/span>/) ?? [])[1] ?? ''
    );
    const broadcastRaw = decodeHtmlEntities(
      (article.match(/<div class="channels">([^<]+)<\/div>/) ?? [])[1] ?? ''
    )
      .replace(/^TV:\s*/i, '')
      .trim();
    const venue = decodeHtmlEntities(
      (article.match(/<div class="venue">([^<]+)<\/div>/) ?? [])[1] ?? ''
    );

    const hm = timeRaw.match(/(\d{2}):(\d{2})/);
    const dm = tag.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
    if (!hm || !dm || teams.length < 2) continue;

    const day = dm[1].padStart(2, '0');
    const month = MONTHS_ES[dm[2].toLowerCase()] ?? '11';
    const year = dm[3];
    const kickoffIso = `${year}-${month}-${day}T${hm[1]}:${hm[2]}:00Z`;
    if (Number.isNaN(new Date(kickoffIso).getTime())) continue;

    const dedupeKey = `${teams[0].toLowerCase()}|${teams[1].toLowerCase()}|${kickoffIso}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    matches.push({
      competition: normalizeCompetition(league),
      round: league || 'Próximos partidos',
      homeTeamName: teams[0],
      homeShortCode: makeShortCode(teams[0]),
      awayTeamName: teams[1],
      awayShortCode: makeShortCode(teams[1]),
      kickoffIso,
      stadium: venue || 'Por confirmar',
      broadcast: broadcastRaw || 'Consultar guía local',
    });
  }

  return matches;
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

function normalizeTeamMatchKey(name: string): string {
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

function areTeamsEquivalent(nameA: string, nameB: string): boolean {
  const a = normalizeTeamMatchKey(nameA);
  const b = normalizeTeamMatchKey(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    return true;
  }
  const aNoReal = a.startsWith('real') && a.length > 7 ? a.slice(4) : a;
  const bNoReal = b.startsWith('real') && b.length > 7 ? b.slice(4) : b;
  if (aNoReal === bNoReal) return true;
  return false;
}

const COMPETITION_PRIORITY_MAP: Record<ExtractedMatchPayload['competition'], number> = {
  laliga: 0,
  champions: 1,
  copadelrey: 2,
  premier: 3,
  seleccion: 4,
  otros: 5,
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Sincronización directa desde https://www.flashscore.es/ (soporta day=all, day=upcoming o day=-7..7)
  app.get('/api/flashscore/matches', async (req, res) => {
    try {
      const filterParam = String(req.query.filter ?? 'all').toLowerCase();
      const dayParam = String(req.query.day ?? '');

      if (dayParam === 'all' || dayParam === 'upcoming') {
        const isUpcomingOnly = dayParam === 'upcoming';
        const dayOffsets = isUpcomingOnly
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];

        const [settled, fhMatches] = await Promise.all([
          Promise.allSettled(
            dayOffsets.map((d) =>
              fetchFlashscoreDayMatches(d, isUpcomingOnly ? 'all' : filterParam)
            )
          ),
          fetchFutbolHorariosMatches().catch(() => [] as ExtractedMatchPayload[]),
        ]);

        const merged: FlashscoreMatchPayload[] = [];
        const seenIds = new Set<string>();
        const indicesByDate = new Map<string, number[]>();

        for (const result of settled) {
          if (result.status !== 'fulfilled') continue;
          for (const item of result.value.matches) {
            if (isUpcomingOnly) {
              if (filterParam === 'scheduled' && item.status !== 'scheduled') {
                continue;
              }
              if (item.status === 'finished') {
                continue;
              }
            }
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            const idx = merged.length;
            merged.push(item);
            const dk = item.kickoffIso.slice(0, 10);
            const bucket = indicesByDate.get(dk);
            if (bucket) bucket.push(idx);
            else indicesByDate.set(dk, [idx]);
          }
        }

        if (fhMatches.length > 0) {
          for (const fh of fhMatches) {
            const fhDate = fh.kickoffIso.slice(0, 10);
            const candidates = indicesByDate.get(fhDate) ?? [];
            const matchIdx = candidates.find((idx) => {
              const existing = merged[idx];
              return (
                areTeamsEquivalent(existing.homeTeamName, fh.homeTeamName) &&
                areTeamsEquivalent(existing.awayTeamName, fh.awayTeamName)
              );
            });
            if (matchIdx !== undefined) {
              if (fh.stadium && fh.stadium !== 'Por confirmar') {
                merged[matchIdx].stadium = fh.stadium;
              }
              if (fh.broadcast && fh.broadcast !== 'Consultar guía local') {
                merged[matchIdx].broadcast = fh.broadcast;
              }
            }
          }
        }

        merged.sort((a, b) => {
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (b.status === 'live' && a.status !== 'live') return 1;
          const prioDiff =
            (COMPETITION_PRIORITY_MAP[a.competition] ?? 5) -
            (COMPETITION_PRIORITY_MAP[b.competition] ?? 5);
          if (prioDiff !== 0) return prioDiff;
          return (
            new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
          );
        });

        res.json({
          dateKey: getMadridDateKey(0),
          day: dayParam,
          filter: filterParam,
          totalCount: merged.length,
          matches: merged,
          sources: [
            {
              uri: 'https://www.flashscore.es/',
              title: isUpcomingOnly
                ? 'Flashscore.es — Todos los próximos partidos (8 días)'
                : 'Flashscore.es — Todos los partidos (15 días completos)',
            },
          ],
        });
        return;
      }

      const rawDay = Number(req.query.day ?? 0);
      const day = Number.isFinite(rawDay)
        ? Math.max(-7, Math.min(7, Math.trunc(rawDay)))
        : 0;

      const [{ dateKey, matches }, fhMatches] = await Promise.all([
        fetchFlashscoreDayMatches(day, filterParam),
        day === 0
          ? fetchFutbolHorariosMatches().catch(() => [] as ExtractedMatchPayload[])
          : Promise.resolve([] as ExtractedMatchPayload[]),
      ]);

      if (fhMatches.length > 0 && matches.length > 0) {
        for (const fsMatch of matches) {
          const fhFound = fhMatches.find(
            (fh) =>
              fh.kickoffIso.slice(0, 10) === fsMatch.kickoffIso.slice(0, 10) &&
              areTeamsEquivalent(fsMatch.homeTeamName, fh.homeTeamName) &&
              areTeamsEquivalent(fsMatch.awayTeamName, fh.awayTeamName)
          );
          if (fhFound) {
            if (fhFound.stadium && fhFound.stadium !== 'Por confirmar') {
              fsMatch.stadium = fhFound.stadium;
            }
            if (fhFound.broadcast && fhFound.broadcast !== 'Consultar guía local') {
              fsMatch.broadcast = fhFound.broadcast;
            }
          }
        }
      }

      matches.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        const prioDiff =
          (COMPETITION_PRIORITY_MAP[a.competition] ?? 5) -
          (COMPETITION_PRIORITY_MAP[b.competition] ?? 5);
        if (prioDiff !== 0) return prioDiff;
        return (
          new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
        );
      });

      res.json({
        dateKey,
        day,
        filter: filterParam,
        totalCount: matches.length,
        matches,
        sources: [
          {
            uri: 'https://www.flashscore.es/',
            title: 'Flashscore.es — Resultados y horarios de fútbol en directo',
          },
        ],
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al obtener partidos desde Flashscore.es.';
      res.status(500).json({ error: message });
    }
  });

  // Sincronización global: TODOS los horarios próximos (Flashscore.es 8 días + FutbolHorarios.com)
  app.get('/api/schedules/sync-all', async (_req, res) => {
    try {
      const dayOffsets = [0, 1, 2, 3, 4, 5, 6, 7];
      const [fsSettled, fhResult] = await Promise.all([
        Promise.allSettled(
          dayOffsets.map((d) => fetchFlashscoreDayMatches(d, 'all'))
        ),
        fetchFutbolHorariosMatches().catch(() => [] as ExtractedMatchPayload[]),
      ]);

      const merged: FlashscoreMatchPayload[] = [];
      const seenIds = new Set<string>();
      const indicesByDate = new Map<string, number[]>();

      for (const result of fsSettled) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value.matches) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          const idx = merged.length;
          merged.push(item);
          const dateKey = item.kickoffIso.slice(0, 10);
          const bucket = indicesByDate.get(dateKey);
          if (bucket) {
            bucket.push(idx);
          } else {
            indicesByDate.set(dateKey, [idx]);
          }
        }
      }

      for (let i = 0; i < fhResult.length; i++) {
        const fh = fhResult[i];
        const fhDate = fh.kickoffIso.slice(0, 10);
        const candidates = indicesByDate.get(fhDate) ?? [];
        const existingIdx = candidates.find((idx) => {
          const existing = merged[idx];
          return (
            areTeamsEquivalent(existing.homeTeamName, fh.homeTeamName) &&
            areTeamsEquivalent(existing.awayTeamName, fh.awayTeamName)
          );
        });

        if (existingIdx !== undefined) {
          const existing = merged[existingIdx];
          if (fh.stadium && fh.stadium !== 'Por confirmar') {
            existing.stadium = fh.stadium;
          }
          if (fh.broadcast && fh.broadcast !== 'Consultar guía local') {
            existing.broadcast = fh.broadcast;
          }
        } else {
          const newIdx = merged.length;
          merged.push({
            ...fh,
            id: `fh-sync-${i}-${fhDate}`,
            status: 'scheduled',
            flashscoreUrl: 'https://www.flashscore.es/',
            notes: 'Sincronizado desde FutbolHorarios.com',
          });
          const bucket = indicesByDate.get(fhDate);
          if (bucket) {
            bucket.push(newIdx);
          } else {
            indicesByDate.set(fhDate, [newIdx]);
          }
        }
      }

      merged.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        const prioDiff =
          (COMPETITION_PRIORITY_MAP[a.competition] ?? 5) -
          (COMPETITION_PRIORITY_MAP[b.competition] ?? 5);
        if (prioDiff !== 0) return prioDiff;
        return (
          new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
        );
      });

      res.json({
        totalCount: merged.length,
        matches: merged,
        sources: [
          {
            uri: 'https://www.flashscore.es/',
            title: 'Flashscore.es — Todos los horarios y marcadores (8 días)',
          },
          {
            uri: 'https://futbolhorarios.com/',
            title: 'FutbolHorarios.com — Estadios y canales de TV',
          },
        ],
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al sincronizar todos los horarios.';
      res.status(500).json({ error: message });
    }
  });

  // Clasificación mundial: catálogo de TODAS las ligas del mundo en Flashscore.es
  interface WorldLeagueEntry {
    path: string;
    fullName: string;
    country: string;
    leagueName: string;
    featured: boolean;
  }

  const FEATURED_WORLD_LEAGUES: WorldLeagueEntry[] = [
    {
      path: '/clasificacion/QeI1Oeyi/dWdJXP6U/',
      fullName: 'ESPAÑA: LaLiga EA Sports',
      country: 'ESPAÑA',
      leagueName: 'LaLiga EA Sports',
      featured: true,
    },
    {
      path: '/clasificacion/nkBfW7fc/42oxhTin/',
      fullName: 'ESPAÑA: LaLiga Hypermotion',
      country: 'ESPAÑA',
      leagueName: 'LaLiga Hypermotion',
      featured: true,
    },
    {
      path: '/clasificacion/SY30SsKF/CfoA8Dmm/',
      fullName: 'INGLATERRA: Premier League',
      country: 'INGLATERRA',
      leagueName: 'Premier League',
      featured: true,
    },
    {
      path: '/clasificacion/tfRdlhP9/vT1iNRGq/',
      fullName: 'EUROPA: Champions League - Fase de liga',
      country: 'EUROPA',
      leagueName: 'Champions League - Fase de liga',
      featured: true,
    },
    {
      path: '/clasificacion/WdNk9YwP/CfujcOgK/',
      fullName: 'ITALIA: Serie A',
      country: 'ITALIA',
      leagueName: 'Serie A',
      featured: true,
    },
    {
      path: '/clasificacion/KY7LrA6d/jg0MwVuC/',
      fullName: 'ALEMANIA: Bundesliga',
      country: 'ALEMANIA',
      leagueName: 'Bundesliga',
      featured: true,
    },
    {
      path: '/clasificacion/0Mp0HlJb/CQF28KxR/',
      fullName: 'FRANCIA: Ligue 1',
      country: 'FRANCIA',
      leagueName: 'Ligue 1',
      featured: true,
    },
    {
      path: '/clasificacion/nHciQpuf/zm1be8bD/',
      fullName: 'PAÍSES BAJOS: Eredivisie',
      country: 'PAÍSES BAJOS',
      leagueName: 'Eredivisie',
      featured: true,
    },
    {
      path: '/clasificacion/pv7V3RRE/hdLUdQGi/',
      fullName: 'BRASIL: Serie A',
      country: 'BRASIL',
      leagueName: 'Serie A (Brasileirão)',
      featured: true,
    },
    {
      path: '/clasificacion/ddvHY2Wh/zXvIHwg3/',
      fullName: 'MÉXICO: Liga MX - Apertura',
      country: 'MÉXICO',
      leagueName: 'Liga MX - Apertura',
      featured: true,
    },
    {
      path: '/clasificacion/Q74g9dNP/40zsPsC5/',
      fullName: 'INGLATERRA: Championship',
      country: 'INGLATERRA',
      leagueName: 'Championship',
      featured: true,
    },
  ];

  let cachedWorldLeagues: { expiresAt: number; leagues: WorldLeagueEntry[] } | null = null;
  const cachedStandingsMap = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();
  const leagueDesktopUrlCache = new Map<string, string>();
  const cachedLeagueMatchesMap = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();

  function parseCountryAndLeague(rawName: string): {
    country: string;
    leagueName: string;
  } {
    const idx = rawName.indexOf(':');
    if (idx === -1) {
      return { country: 'INTERNACIONAL', leagueName: rawName.trim() };
    }
    return {
      country: rawName.slice(0, idx).trim() || 'INTERNACIONAL',
      leagueName: rawName.slice(idx + 1).trim() || rawName.trim(),
    };
  }

  app.get('/api/flashscore/leagues', async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedWorldLeagues && cachedWorldLeagues.expiresAt > now) {
        res.json({
          totalCount: cachedWorldLeagues.leagues.length,
          leagues: cachedWorldLeagues.leagues,
        });
        return;
      }

      const dayOffsets = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
      const settled = await Promise.allSettled(
        dayOffsets.map(async (d) => {
          const upstream = await fetch(`https://m.flashscore.es/?d=${d}&s=1`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
              'Accept-Language': 'es-ES,es;q=0.9',
            },
          });
          if (!upstream.ok) return '';
          return upstream.text();
        })
      );

      const leagueMap = new Map<string, WorldLeagueEntry>();
      const featuredPaths = new Set<string>();
      for (const feat of FEATURED_WORLD_LEAGUES) {
        leagueMap.set(feat.path, feat);
        featuredPaths.add(feat.path);
      }

      for (const result of settled) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const html = result.value;
        for (const m of html.matchAll(/<h4>([\s\S]*?)<\/h4>/gi)) {
          const inner = m[1];
          const hrefMatch = inner.match(/href="(\/clasificacion\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/?)"/i);
          if (!hrefMatch) continue;
          const path = hrefMatch[1].endsWith('/')
            ? hrefMatch[1]
            : `${hrefMatch[1]}/`;
          if (leagueMap.has(path)) continue;

          const cleanName = decodeHtmlEntities(
            stripHtmlTags(inner.replace(/<a[\s\S]*?<\/a>/gi, ''))
          );
          if (!cleanName) continue;

          const { country, leagueName } = parseCountryAndLeague(cleanName);
          leagueMap.set(path, {
            path,
            fullName: cleanName,
            country,
            leagueName,
            featured: featuredPaths.has(path),
          });
        }
      }

      const leagues = [...leagueMap.values()].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        const cDiff = a.country.localeCompare(b.country, 'es');
        if (cDiff !== 0) return cDiff;
        return a.leagueName.localeCompare(b.leagueName, 'es');
      });

      cachedWorldLeagues = {
        expiresAt: now + 10 * 60 * 1000,
        leagues,
      };

      res.json({
        totalCount: leagues.length,
        leagues,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el catálogo de ligas mundiales.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/flashscore/standings', async (req, res) => {
    try {
      const rawPath = String(req.query.path ?? '/clasificacion/QeI1Oeyi/dWdJXP6U/').trim();
      const normalizedPath = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
      if (!/^\/clasificacion\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/$/.test(normalizedPath)) {
        res.status(400).json({ error: 'Ruta de clasificación no válida.' });
        return;
      }

      const now = Date.now();
      const cached = cachedStandingsMap.get(normalizedPath);
      if (cached && cached.expiresAt > now) {
        res.json(cached.payload);
        return;
      }

      const upstream = await fetch(`https://m.flashscore.es${normalizedPath}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
      if (!upstream.ok) {
        throw new Error(
          `No se pudo obtener la clasificación (HTTP ${upstream.status}).`
        );
      }

      const html = await upstream.text();
      let desktopUrl = leagueDesktopUrlCache.get(normalizedPath) ?? '';
      const desktopSlugMatch = html.match(
        /https:\/\/www\.flashscore\.esTRANS_URL_SOCCER_WEB([^"?]+)clasificacion/i
      );
      if (desktopSlugMatch) {
        desktopUrl = `https://www.flashscore.es/futbol${desktopSlugMatch[1]}`;
        leagueDesktopUrlCache.set(normalizedPath, desktopUrl);
      }
      const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const rawTitle = h3Match
        ? decodeHtmlEntities(stripHtmlTags(h3Match[1]))
        : 'Clasificación';
      const title = rawTitle
        .replace(/^Fútbol\s*»\s*/i, '')
        .replace(/\s*»\s*Clasificación$/i, '')
        .trim();

      const tableMatches = [
        ...html.matchAll(/<table[^>]*class="[^"]*standings[^"]*"[^>]*>([\s\S]*?)<\/table>/gi),
      ];

      interface StandingRowPayload {
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

      const tables: Array<{
        groupName: string | null;
        rows: StandingRowPayload[];
      }> = [];

      for (const tblMatch of tableMatches) {
        const tblHtml = tblMatch[1];
        const headerLeft = tblHtml.match(/<th[^>]*class="[^"]*left[^"]*"[^>]*>([\s\S]*?)<\/th>/i);
        const headerLabel = headerLeft
          ? decodeHtmlEntities(stripHtmlTags(headerLeft[1]))
          : '';
        const groupName =
          headerLabel && headerLabel.toLowerCase() !== 'equipo'
            ? headerLabel
            : null;

        const tbodyMatch = tblHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
        const rowSource = tbodyMatch ? tbodyMatch[1] : tblHtml;
        const rows: StandingRowPayload[] = [];

        for (const trMatch of rowSource.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
          const cells = [
            ...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
          ].map((c) => decodeHtmlEntities(stripHtmlTags(c[1])));
          if (cells.length < 8) continue;

          const rank = Number.parseInt(cells[0].replace(/[^\d]/g, ''), 10);
          const teamName = cells[1];
          const played = Number.parseInt(cells[2], 10) || 0;
          const won = Number.parseInt(cells[3], 10) || 0;
          const drawn = Number.parseInt(cells[4], 10) || 0;
          const lost = Number.parseInt(cells[5], 10) || 0;
          const goalsParts = cells[6].split(':').map((n) => Number.parseInt(n, 10));
          const goalsFor = Number.isFinite(goalsParts[0]) ? goalsParts[0] : 0;
          const goalsAgainst = Number.isFinite(goalsParts[1]) ? goalsParts[1] : 0;
          const points = Number.parseInt(cells[7], 10) || 0;

          if (!teamName || !Number.isFinite(rank)) continue;

          rows.push({
            rank,
            teamName,
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDiff: goalsFor - goalsAgainst,
            points,
          });
        }

        if (rows.length > 0) {
          tables.push({ groupName, rows });
        }
      }

      const hasMissingLogos = tables.some((grp) =>
        grp.rows.some((r) => !lookupTeamLogo(r.teamName))
      );
      if (hasMissingLogos && desktopUrl) {
        const desktopHtml = await fetchDesktopHtmlDeduped(desktopUrl);
        extractAndRegisterLogosFromDesktopHtml(desktopHtml);
      }

      for (const grp of tables) {
        for (const r of grp.rows) {
          const logo = lookupTeamLogo(r.teamName);
          if (logo) {
            r.logoUrl = logo;
          }
        }
      }

      const payload = {
        path: normalizedPath,
        title,
        tables,
        flashscoreUrl: `https://www.flashscore.es${normalizedPath}`,
      };

      cachedStandingsMap.set(normalizedPath, {
        expiresAt: now + 60 * 1000,
        payload,
      });

      res.json(payload);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al consultar la clasificación.';
      res.status(500).json({ error: message });
    }
  });

  function parseDesktopFeedMatches(
    feedData: string,
    defaultRound: string,
    competition: ExtractedMatchPayload['competition'],
    fallbackStatus: 'scheduled' | 'live' | 'finished'
  ): FlashscoreMatchPayload[] {
    if (!feedData) return [];
    const chunks = feedData.split('~AA÷');
    const results: FlashscoreMatchPayload[] = [];
    for (let i = 1; i < chunks.length; i++) {
      const ev = chunks[i];
      const parts = ev.split('¬');
      const matchId = (parts[0] ?? '').trim();
      if (!matchId) continue;

      const kv: Record<string, string> = {};
      for (let j = 1; j < parts.length; j++) {
        const sep = parts[j].indexOf('÷');
        if (sep > -1) {
          kv[parts[j].slice(0, sep)] = parts[j].slice(sep + 1);
        }
      }

      const homeTeamName = decodeHtmlEntities((kv.AE || kv.FH || '').trim());
      const awayTeamName = decodeHtmlEntities((kv.AF || kv.FK || '').trim());
      const tsSec = Number(kv.AD || kv.ADE || 0);
      if (!homeTeamName || !awayTeamName || !Number.isFinite(tsSec) || tsSec <= 0) {
        continue;
      }

      const kickoffIso = new Date(tsSec * 1000).toISOString();
      const ab = kv.AB;
      const status: 'scheduled' | 'live' | 'finished' =
        ab === '2'
          ? 'live'
          : ab === '3'
            ? 'finished'
            : ab === '1'
              ? 'scheduled'
              : fallbackStatus;

      const homeScore =
        kv.AG !== undefined && kv.AG !== '' && Number.isFinite(Number(kv.AG))
          ? Number(kv.AG)
          : undefined;
      const awayScore =
        kv.AH !== undefined && kv.AH !== '' && Number.isFinite(Number(kv.AH))
          ? Number(kv.AH)
          : undefined;

      const round = decodeHtmlEntities(
        kv.ER ? `${defaultRound} · ${kv.ER}` : defaultRound
      );
      const homeLogoUrl = toFlashscoreLogoUrl(kv.OA);
      const awayLogoUrl = toFlashscoreLogoUrl(kv.OB);
      if (homeLogoUrl) registerTeamLogo(homeTeamName, homeLogoUrl);
      if (awayLogoUrl) registerTeamLogo(awayTeamName, awayLogoUrl);

      results.push({
        id: `fs-${matchId}`,
        competition,
        round,
        homeTeamName,
        homeShortCode: (kv.WM || makeShortCode(homeTeamName)).slice(0, 4).toUpperCase(),
        awayTeamName,
        awayShortCode: (kv.WN || makeShortCode(awayTeamName)).slice(0, 4).toUpperCase(),
        kickoffIso,
        stadium: 'Por confirmar',
        broadcast: 'Flashscore.es',
        status,
        homeScore: status === 'scheduled' ? undefined : homeScore,
        awayScore: status === 'scheduled' ? undefined : awayScore,
        homeLogoUrl: homeLogoUrl || lookupTeamLogo(homeTeamName),
        awayLogoUrl: awayLogoUrl || lookupTeamLogo(awayTeamName),
        flashscoreUrl: `https://www.flashscore.es/partido/${matchId}/`,
        notes: kv.ER
          ? `${defaultRound} · ${kv.ER} · Flashscore.es`
          : `${defaultRound} · Flashscore.es`,
      });
    }
    return results;
  }

  let featuredLogosWarmPromise: Promise<void> | null = null;
  let featuredLogosWarmedAt = 0;

  async function ensureFeaturedLeagueLogosWarmed(): Promise<void> {
    const now = Date.now();
    if (featuredLogosWarmedAt > 0 && now - featuredLogosWarmedAt < 30 * 60 * 1000) {
      return;
    }
    if (featuredLogosWarmPromise) {
      return featuredLogosWarmPromise;
    }

    featuredLogosWarmPromise = (async () => {
      try {
        await Promise.allSettled(
          FEATURED_WORLD_LEAGUES.map(async (league) => {
            let desktopUrl = leagueDesktopUrlCache.get(league.path) ?? '';
            if (!desktopUrl) {
              const mRes = await fetch(`https://m.flashscore.es${league.path}`, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                  'Accept-Language': 'es-ES,es;q=0.9',
                },
              });
              if (mRes.ok) {
                const mHtml = await mRes.text();
                const slugMatch = mHtml.match(
                  /https:\/\/www\.flashscore\.esTRANS_URL_SOCCER_WEB([^"?]+)clasificacion/i
                );
                if (slugMatch) {
                  desktopUrl = `https://www.flashscore.es/futbol${slugMatch[1]}`;
                  leagueDesktopUrlCache.set(league.path, desktopUrl);
                }
              }
            }
            if (desktopUrl) {
              const dHtml = await fetchDesktopHtmlDeduped(desktopUrl);
              extractAndRegisterLogosFromDesktopHtml(dHtml);
            }
          })
        );
        featuredLogosWarmedAt = Date.now();
      } finally {
        featuredLogosWarmPromise = null;
      }
    })();

    return featuredLogosWarmPromise;
  }

  // Diccionario global de escudos oficiales de clubes y selecciones
  app.get('/api/flashscore/logos', async (_req, res) => {
    try {
      await ensureFeaturedLeagueLogosWarmed();
      res.json({
        totalCount: teamLogoUrlCache.size,
        logos: Object.fromEntries(teamLogoUrlCache.entries()),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el diccionario de escudos.';
      res.status(500).json({ error: message });
    }
  });

  // Partidos completos por días y jornadas para CUALQUIER liga del mundo
  app.get('/api/flashscore/league-matches', async (req, res) => {
    try {
      const rawPath = String(
        req.query.path ?? '/clasificacion/QeI1Oeyi/dWdJXP6U/'
      ).trim();
      const normalizedPath = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
      if (
        !/^\/clasificacion\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/$/.test(normalizedPath)
      ) {
        res.status(400).json({ error: 'Ruta de liga no válida.' });
        return;
      }

      const now = Date.now();
      const cached = cachedLeagueMatchesMap.get(normalizedPath);
      if (cached && cached.expiresAt > now) {
        res.json(cached.payload);
        return;
      }

      let desktopUrl = leagueDesktopUrlCache.get(normalizedPath) ?? '';
      let leagueTitle =
        cachedWorldLeagues?.leagues.find((l) => l.path === normalizedPath)
          ?.fullName ?? 'Competición internacional';

      if (!desktopUrl) {
        const mRes = await fetch(`https://m.flashscore.es${normalizedPath}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9',
          },
        });
        if (mRes.ok) {
          const mHtml = await mRes.text();
          const slugMatch = mHtml.match(
            /https:\/\/www\.flashscore\.esTRANS_URL_SOCCER_WEB([^"?]+)clasificacion/i
          );
          if (slugMatch) {
            desktopUrl = `https://www.flashscore.es/futbol${slugMatch[1]}`;
            leagueDesktopUrlCache.set(normalizedPath, desktopUrl);
          }
          const h3Match = mHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
          if (h3Match) {
            leagueTitle = decodeHtmlEntities(stripHtmlTags(h3Match[1]))
              .replace(/^Fútbol\s*»\s*/i, '')
              .replace(/\s*»\s*Clasificación$/i, '')
              .trim();
          }
        }
      }

      const competition = normalizeFlashscoreCompetition(leagueTitle);
      const mergedMap = new Map<string, FlashscoreMatchPayload>();

      const [desktopHtml, fhMatches] = await Promise.all([
        desktopUrl ? fetchDesktopHtmlDeduped(desktopUrl) : Promise.resolve(''),
        fetchFutbolHorariosMatches().catch(() => [] as ExtractedMatchPayload[]),
      ]);

      if (desktopHtml) {
        const feedConfigs: Array<{
          key: string;
          fallbackStatus: 'scheduled' | 'live' | 'finished';
        }> = [
          { key: 'fixtures', fallbackStatus: 'scheduled' },
          { key: 'summary-fixtures', fallbackStatus: 'scheduled' },
          { key: 'results', fallbackStatus: 'finished' },
          { key: 'summary-results', fallbackStatus: 'finished' },
        ];

        for (const cfg of feedConfigs) {
          const regex = new RegExp(
            `cjs\\.initialFeeds\\[['"]${cfg.key}['"]\\]\\s*=\\s*\\{\\s*data:\\s*\\\`([\\s\\S]*?)\\\``
          );
          const match = desktopHtml.match(regex);
          if (!match) continue;
          const parsed = parseDesktopFeedMatches(
            match[1],
            leagueTitle,
            competition,
            cfg.fallbackStatus
          );
          for (const item of parsed) {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }
        }
      }

      // Fallback al feed móvil de 15 días si no hubo feeds en la ficha web
      if (mergedMap.size === 0) {
        const dayOffsets = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
        const normalizedTarget = leagueTitle.toLowerCase();
        const settled = await Promise.allSettled(
          dayOffsets.map((d) => fetchFlashscoreDayMatches(d, 'all'))
        );
        for (const resDay of settled) {
          if (resDay.status !== 'fulfilled') continue;
          for (const item of resDay.value.matches) {
            if (
              item.round.toLowerCase() === normalizedTarget ||
              item.round.toLowerCase().includes(normalizedTarget)
            ) {
              if (!mergedMap.has(item.id)) {
                mergedMap.set(item.id, {
                  ...item,
                  homeLogoUrl: item.homeLogoUrl || lookupTeamLogo(item.homeTeamName),
                  awayLogoUrl: item.awayLogoUrl || lookupTeamLogo(item.awayTeamName),
                });
              }
            }
          }
        }
      }

      const matches = [...mergedMap.values()];
      if (fhMatches.length > 0 && matches.length > 0) {
        for (const item of matches) {
          const itemDate = item.kickoffIso.slice(0, 10);
          const fhFound = fhMatches.find(
            (fh) =>
              fh.kickoffIso.slice(0, 10) === itemDate &&
              areTeamsEquivalent(item.homeTeamName, fh.homeTeamName) &&
              areTeamsEquivalent(item.awayTeamName, fh.awayTeamName)
          );
          if (fhFound) {
            if (fhFound.stadium && fhFound.stadium !== 'Por confirmar') {
              item.stadium = fhFound.stadium;
            }
            if (fhFound.broadcast && fhFound.broadcast !== 'Consultar guía local') {
              item.broadcast = fhFound.broadcast;
            }
          }
        }
      }

      matches.sort(
        (a, b) =>
          new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      );

      const payload = {
        path: normalizedPath,
        title: leagueTitle,
        desktopUrl: desktopUrl || `https://www.flashscore.es${normalizedPath}`,
        totalCount: matches.length,
        matches,
      };

      cachedLeagueMatchesMap.set(normalizedPath, {
        expiresAt: now + 60 * 1000,
        payload,
      });

      res.json(payload);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al consultar los partidos de la liga.';
      res.status(500).json({ error: message });
    }
  });

  // Sincronización directa desde https://futbolhorarios.com/
  app.get('/api/futbolhorarios/upcoming', async (_req, res) => {
    try {
      const matches = await fetchFutbolHorariosMatches();

      res.json({
        matches,
        sources: [
          {
            uri: 'https://futbolhorarios.com/',
            title: 'FutbolHorarios.com — Partidos de hoy y próximos días',
          },
        ],
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al obtener partidos desde futbolhorarios.com.';
      res.status(500).json({ error: message });
    }
  });

  // Robot de horarios: sincronización web con Google Search Grounding
  app.post('/api/schedules/sync', async (req, res) => {
    try {
      const query = String(req.body?.query ?? '').trim();
      if (!query) {
        res.status(400).json({ error: 'Indica una competición, equipo o consulta para buscar horarios.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'El servicio de búsqueda automática requiere GEMINI_API_KEY configurado en los secretos del entorno. Puedes usar la pestaña "Extraer desde texto" para importar carteleras al instante.',
        });
        return;
      }

      const prompt = `Hoy es 2026-11-16. Busca en la web los próximos partidos oficiales y sus horarios exactos para la consulta: "${query}".
Devuelve ÚNICAMENTE un array JSON válido (sin texto adicional antes ni después) donde cada objeto represente un partido con estas propiedades exactas:
- "competition": uno de "laliga" | "champions" | "premier" | "seleccion" | "copadelrey" | "otros"
- "round": nombre de la competición y jornada (ej. "LaLiga · Jornada 14" o "Champions League · J5")
- "homeTeamName": nombre oficial del equipo local
- "homeShortCode": abreviatura de 3 letras en mayúsculas (ej. "RMA")
- "awayTeamName": nombre oficial del equipo visitante
- "awayShortCode": abreviatura de 3 letras en mayúsculas (ej. "BAR")
- "kickoffIso": fecha y hora exacta en formato ISO 8601 UTC terminada en Z (ej. "2026-11-21T20:00:00Z")
- "stadium": nombre del estadio si está confirmado, o "Por confirmar"
- "broadcast": canales de TV / emisión confirmados, o "Por confirmar"

Incluye hasta 12 partidos próximos ordenados cronológicamente.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text ?? '[]';
      const rawItems = extractJsonArrayFromText(rawText);
      const matches = sanitizeExtractedMatches(rawItems);

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((chunk) => chunk.web)
        .filter((w): w is { uri?: string; title?: string } => Boolean(w?.uri))
        .map((w) => ({
          uri: w.uri as string,
          title: w.title || w.uri || 'Fuente verificada',
        }));

      res.json({ matches, sources });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al consultar los horarios en la web.';
      res.status(500).json({ error: message });
    }
  });

  // Robot de horarios: extracción estructurada desde texto pegado
  app.post('/api/schedules/parse', async (req, res) => {
    try {
      const rawInput = String(req.body?.text ?? '').trim();
      if (!rawInput) {
        res.status(400).json({ error: 'Pega el texto de la cartelera para extraer los partidos.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'No hay GEMINI_API_KEY configurado para extracción inteligente de texto libre.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extrae todos los partidos de fútbol del siguiente texto. Si los horarios dicen UTC mantenlos en UTC; si indican otra zona horaria (ej. CET/España) conviértelos correctamente a ISO 8601 UTC (terminado en Z). Año de referencia: 2026.\n\nTexto:\n${rawInput}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                competition: {
                  type: Type.STRING,
                  description:
                    'Uno de: laliga, champions, premier, seleccion, copadelrey, otros',
                },
                round: { type: Type.STRING },
                homeTeamName: { type: Type.STRING },
                homeShortCode: { type: Type.STRING },
                awayTeamName: { type: Type.STRING },
                awayShortCode: { type: Type.STRING },
                kickoffIso: {
                  type: Type.STRING,
                  description: 'ISO 8601 UTC timestamp ending in Z',
                },
                stadium: { type: Type.STRING },
                broadcast: { type: Type.STRING },
              },
              required: [
                'competition',
                'homeTeamName',
                'awayTeamName',
                'kickoffIso',
              ],
            },
          },
        },
      });

      const jsonStr = (response.text ?? '[]').trim();
      const parsed = JSON.parse(jsonStr);
      const matches = sanitizeExtractedMatches(Array.isArray(parsed) ? parsed : []);
      res.json({ matches });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el texto de horarios.';
      res.status(500).json({ error: message });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
