export type CompetitionId =
  | 'laliga'
  | 'champions'
  | 'premier'
  | 'seleccion'
  | 'copadelrey'
  | 'otros';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type CalendarViewMode =
  | 'month'
  | 'week'
  | 'list'
  | 'year'
  | 'koora'
  | 'standings';

export interface TeamInfo {
  name: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

export interface FootballMatch {
  id: string;
  competition: CompetitionId;
  round: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  /** ISO 8601 UTC timestamp, e.g. 2026-11-21T20:00:00Z */
  kickoffIso: string;
  stadium: string;
  broadcast: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  bookmarked: boolean;
  isHymStream: boolean;
  notes?: string;
}

export interface CompetitionMeta {
  id: CompetitionId;
  label: string;
  shortLabel: string;
  accentHex: string;
}

export interface TimezoneOption {
  id: string;
  label: string;
  shortLabel: string;
}
