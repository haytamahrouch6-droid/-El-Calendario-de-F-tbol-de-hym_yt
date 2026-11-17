import 'dotenv/config';
import express from 'express';
import fs from 'fs';
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
  liveLabel?: string;
  flashscoreUrl: string;
  notes?: string;
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

  // Sincronización directa desde https://www.flashscore.es/ (soporta day=all o day=-3..7)
  app.get('/api/flashscore/matches', async (req, res) => {
    try {
      const filterParam = String(req.query.filter ?? 'all').toLowerCase();

      if (String(req.query.day ?? '') === 'all') {
        const dayOffsets = [0, 1, 2, 3, 4, 5, 6, 7];
        const settled = await Promise.allSettled(
          dayOffsets.map((d) => fetchFlashscoreDayMatches(d, filterParam))
        );
        const merged: FlashscoreMatchPayload[] = [];
        const seenIds = new Set<string>();
        for (const result of settled) {
          if (result.status !== 'fulfilled') continue;
          for (const item of result.value.matches) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            merged.push(item);
          }
        }
        merged.sort((a, b) => {
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
          day: 'all',
          filter: filterParam,
          totalCount: merged.length,
          matches: merged,
          sources: [
            {
              uri: 'https://www.flashscore.es/',
              title: 'Flashscore.es — Semana completa de horarios y marcadores',
            },
          ],
        });
        return;
      }

      const rawDay = Number(req.query.day ?? 0);
      const day = Number.isFinite(rawDay)
        ? Math.max(-7, Math.min(7, Math.trunc(rawDay)))
        : 0;

      const { dateKey, matches } = await fetchFlashscoreDayMatches(day, filterParam);

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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
