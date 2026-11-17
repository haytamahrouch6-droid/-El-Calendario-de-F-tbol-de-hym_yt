import { FootballMatch, TimezoneOption } from '../types/match';

export const APP_TODAY_ISO = '2026-11-16';

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'Europe/Madrid', label: 'España (Madrid · CET)', shortLabel: 'CET' },
  { id: 'America/Mexico_City', label: 'México (CDMX)', shortLabel: 'CDMX' },
  {
    id: 'America/Argentina/Buenos_Aires',
    label: 'Argentina (Buenos Aires)',
    shortLabel: 'ART',
  },
  { id: 'America/Bogota', label: 'Colombia (Bogotá)', shortLabel: 'COT' },
  { id: 'UTC', label: 'Tiempo Universal (UTC)', shortLabel: 'UTC' },
];

export const WEEKDAYS_SHORT_ES = [
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
  'Dom',
];

export function getDateKeyInTimezone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '11';
  const day = parts.find((p) => p.type === 'day')?.value ?? '16';
  return `${year}-${month}-${day}`;
}

export function formatTimeInTimezone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('es-ES', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatMonthTitleEs(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 15));
  const formatted = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatFullDateFromKeyEs(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortDateFromKeyEs(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function getMonthGridDays(year: number, monthIndex: number): Array<{
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}> {
  const firstDayOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const jsDay = firstDayOfMonth.getUTCDay(); // 0=Sun, 1=Mon
  const mondayOffset = (jsDay + 6) % 7;

  const startDate = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = mondayOffset + daysInMonth > 35 ? 42 : 35;

  const cells: Array<{
    dateKey: string;
    dayNumber: number;
    inCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < totalCells; i++) {
    const current = new Date(startDate.getTime() + i * 86400000);
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    cells.push({
      dateKey: `${y}-${m}-${d}`,
      dayNumber: current.getUTCDate(),
      inCurrentMonth: current.getUTCMonth() === monthIndex,
    });
  }

  return cells;
}

export function getWeekDaysFromKey(anchorDateKey: string): Array<{
  dateKey: string;
  dayNumber: number;
  weekdayShort: string;
  monthShort: string;
}> {
  const [y, m, d] = anchorDateKey.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const jsDay = anchor.getUTCDay();
  const mondayOffset = (jsDay + 6) % 7;
  const monday = new Date(anchor.getTime() - mondayOffset * 86400000);

  const days: Array<{
    dateKey: string;
    dayNumber: number;
    weekdayShort: string;
    monthShort: string;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday.getTime() + i * 86400000);
    const cy = current.getUTCFullYear();
    const cm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const cd = String(current.getUTCDate()).padStart(2, '0');
    const monthShort = new Intl.DateTimeFormat('es-ES', {
      month: 'short',
      timeZone: 'UTC',
    }).format(current);

    days.push({
      dateKey: `${cy}-${cm}-${cd}`,
      dayNumber: current.getUTCDate(),
      weekdayShort: WEEKDAYS_SHORT_ES[i],
      monthShort,
    });
  }

  return days;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const current = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const cy = current.getUTCFullYear();
  const cm = String(current.getUTCMonth() + 1).padStart(2, '0');
  const cd = String(current.getUTCDate()).padStart(2, '0');
  return `${cy}-${cm}-${cd}`;
}

/**
 * Converts a local dateKey (YYYY-MM-DD) and time (HH:MM) in the given timezone
 * into an exact UTC ISO string.
 */
export function localDateTimeToUtcIso(
  dateKey: string,
  timeStr: string,
  timeZone: string
): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Initial guess in UTC
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(utcGuess));
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

export function formatRelativeDayLabel(
  dateKey: string,
  todayKey: string = APP_TODAY_ISO
): string | null {
  if (dateKey === todayKey) return 'Hoy';
  if (dateKey === shiftDateKey(todayKey, 1)) return 'Mañana';
  if (dateKey === shiftDateKey(todayKey, -1)) return 'Ayer';
  return null;
}

export function formatDaysUntilLabel(
  kickoffIso: string,
  nowReferenceIso: string = '2026-11-16T09:51:00Z'
): string {
  const diffMs = new Date(kickoffIso).getTime() - new Date(nowReferenceIso).getTime();
  if (diffMs <= 0) return 'En juego o finalizado';
  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) {
    return hours <= 1 ? 'En menos de 1 hora' : `En ${hours} horas`;
  }
  if (days === 1) {
    return `En 1 día y ${hours} h`;
  }
  return `En ${days} días`;
}

function toIcsTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function generateIcsContent(matches: FootballMatch[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//hym_yt//Calendario de Futbol//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:El Calendario de Fútbol de hym_yt',
  ];

  for (const match of matches) {
    const start = toIcsTimestamp(match.kickoffIso);
    const endIso = new Date(
      new Date(match.kickoffIso).getTime() + 115 * 60000
    ).toISOString();
    const end = toIcsTimestamp(endIso);
    const summary = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const descParts = [
      `Competición: ${match.round}`,
      `Emisión: ${match.broadcast}`,
      match.isHymStream ? 'Directo en el canal de hym_yt' : '',
      match.notes ? `Notas: ${match.notes}` : '',
    ].filter(Boolean);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${match.id}@hym-yt-futbol`,
      `DTSTAMP:${toIcsTimestamp('2026-11-16T09:51:00Z')}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${summary.replace(/,/g, '\\,')}`,
      `LOCATION:${match.stadium.replace(/,/g, '\\,')}`,
      `DESCRIPTION:${descParts.join(' | ').replace(/,/g, '\\,')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
