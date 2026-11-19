import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  List,
  Menu,
  Moon,
  Plus,
  Radio,
  Search,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import { AllMonthsView } from './components/AllMonthsView';
import {
  CalendarSubscribeSection,
  CalendarSyncModal,
} from './components/CalendarSubscribeSection';
import { FeaturedMatchBanner } from './components/FeaturedMatchBanner';
import { FlashscoreSection } from './components/FlashscoreSection';
import { ListView } from './components/ListView';
import { LiveChannelsSection } from './components/LiveChannelsSection';
import { MatchFormModal } from './components/MatchFormModal';
import { MatchInspectorModal } from './components/MatchInspectorModal';
import { MonthView } from './components/MonthView';
import {
  MobileInstallBanner,
  OfflineIndicator,
  PWAInstallModal,
} from './components/PWAInstallUI';
import {
  DEFAULT_USER_PROFILE,
  ProfileModal,
  UserProfile,
} from './components/ProfileModal';
import { ScheduleRobotModal } from './components/ScheduleRobotModal';
import { Sidebar } from './components/Sidebar';
import { StandingsView } from './components/StandingsView';
import { WeekView } from './components/WeekView';
import { INITIAL_MATCHES } from './data/initialMatches';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  CalendarViewMode,
  CompetitionId,
  FootballMatch,
  MatchStatus,
} from './types/match';
import {
  APP_TODAY_ISO,
  TIMEZONE_OPTIONS,
  formatMonthTitleEs,
  formatShortDateFromKeyEs,
  generateIcsContent,
  getDateKeyInTimezone,
  getWeekDaysFromKey,
  shiftDateKey,
} from './utils/dateUtils';
import { areTeamsEquivalent } from './utils/scheduleParser';
import { loadWorldTeamLogos } from './utils/teamCrestRegistry';

const STORAGE_KEY_MATCHES = 'hym_yt_football_matches_v4';
const STORAGE_KEY_TZ = 'hym_yt_football_tz_v2';
const STORAGE_KEY_THEME = 'hym_yt_football_theme_v1';
const STORAGE_KEY_PWA_DISMISSED = 'hym_yt_pwa_banner_dismissed_v1';
const STORAGE_KEY_PROFILE = 'hym_yt_profile_v1';

export default function App() {
  const [matches, setMatches] = useState<FootballMatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATCHES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial matches
    }
    return INITIAL_MATCHES;
  });

  const [timeZone, setTimeZone] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TZ) || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) === 'dark';
    } catch {
      return false;
    }
  });

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(10); // 10 = Noviembre
  const [selectedDateKey, setSelectedDateKey] = useState<string>(APP_TODAY_ISO);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionId[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | MatchStatus>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [onlyHymStreams, setOnlyHymStreams] = useState<boolean>(false);

  const [inspectedMatchId, setInspectedMatchId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [robotOpen, setRobotOpen] = useState<boolean>(false);
  const [calendarSyncOpen, setCalendarSyncOpen] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<FootballMatch | null>(null);
  const [formDefaultDateKey, setFormDefaultDateKey] = useState<string | null>(
    null
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [installModalOpen, setInstallModalOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.displayName === 'string') {
          return {
            displayName:
              parsed.displayName || DEFAULT_USER_PROFILE.displayName,
            tagline: parsed.tagline || DEFAULT_USER_PROFILE.tagline,
            bio: parsed.bio || DEFAULT_USER_PROFILE.bio,
          };
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_USER_PROFILE;
  });
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY_PWA_DISMISSED) === '1';
      } catch {
        return false;
      }
    }
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(matches));
    } catch {
      // Ignore storage quota errors
    }
  }, [matches]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TZ, timeZone);
    } catch {
      // Ignore
    }
  }, [timeZone]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY_THEME, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
    } catch {
      // Ignore
    }
  }, [userProfile]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    loadWorldTeamLogos();
  }, []);

  const showToast = (msg: string) => setToastMessage(msg);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (
        activeCompetitions.length > 0 &&
        !activeCompetitions.includes(m.competition)
      ) {
        return false;
      }
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (onlyBookmarked && !m.bookmarked) return false;
      if (onlyHymStreams && !m.isHymStream) return false;
      if (q) {
        const haystack = [
          m.homeTeam.name,
          m.homeTeam.shortCode,
          m.awayTeam.name,
          m.awayTeam.shortCode,
          m.round,
          m.stadium,
          m.broadcast,
          m.notes ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    matches,
    activeCompetitions,
    statusFilter,
    onlyBookmarked,
    onlyHymStreams,
    searchQuery,
  ]);

  const competitionCounts = useMemo(() => {
    const counts: Record<CompetitionId, number> = {
      laliga: 0,
      champions: 0,
      premier: 0,
      seleccion: 0,
      copadelrey: 0,
      otros: 0,
    };
    for (const m of matches) {
      counts[m.competition] = (counts[m.competition] ?? 0) + 1;
    }
    return counts;
  }, [matches]);

  const bookmarkedCount = useMemo(
    () => matches.filter((m) => m.bookmarked).length,
    [matches]
  );

  const hymStreamCount = useMemo(
    () => matches.filter((m) => m.isHymStream).length,
    [matches]
  );

  const matchDateKeysSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of filteredMatches) {
      set.add(getDateKeyInTimezone(m.kickoffIso, timeZone));
    }
    return set;
  }, [filteredMatches, timeZone]);

  const featuredMatch = useMemo(() => {
    const liveMatches = matches
      .filter((m) => m.status === 'live')
      .sort(
        (a, b) =>
          new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      );
    const liveHymStream = liveMatches.find((m) => m.isHymStream);
    if (liveHymStream ?? liveMatches[0]) {
      return liveHymStream ?? liveMatches[0];
    }

    const upcoming = matches
      .filter((m) => m.status === 'scheduled')
      .sort(
        (a, b) =>
          new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime()
      );
    const nextHymStream = upcoming.find((m) => m.isHymStream);
    return nextHymStream ?? upcoming[0] ?? matches[0] ?? null;
  }, [matches]);

  const inspectedMatch = useMemo(
    () => matches.find((m) => m.id === inspectedMatchId) ?? null,
    [matches, inspectedMatchId]
  );

  const handleSelectDateKey = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const [y, m] = dateKey.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      setCurrentYear(y);
      setCurrentMonthIndex(m - 1);
    }
  };

  const handleSelectMonth = (year: number, monthIndex: number) => {
    setCurrentYear(year);
    setCurrentMonthIndex(monthIndex);
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    setSelectedDateKey(`${year}-${monthStr}-01`);
    if (viewMode === 'year') {
      setViewMode('month');
    }
  };

  const handlePrevPeriod = () => {
    if (viewMode === 'week') {
      const shifted = shiftDateKey(selectedDateKey, -7);
      handleSelectDateKey(shifted);
    } else {
      if (currentMonthIndex === 0) {
        setCurrentYear((y) => y - 1);
        setCurrentMonthIndex(11);
      } else {
        setCurrentMonthIndex((m) => m - 1);
      }
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      const shifted = shiftDateKey(selectedDateKey, 7);
      handleSelectDateKey(shifted);
    } else {
      if (currentMonthIndex === 11) {
        setCurrentYear((y) => y + 1);
        setCurrentMonthIndex(0);
      } else {
        setCurrentMonthIndex((m) => m + 1);
      }
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(2026);
    setCurrentMonthIndex(10);
    setSelectedDateKey(APP_TODAY_ISO);
  };

  const handleToggleCompetition = (id: CompetitionId) => {
    setActiveCompetitions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setActiveCompetitions([]);
    setStatusFilter('all');
    setOnlyBookmarked(false);
    setOnlyHymStreams(false);
    setSearchQuery('');
  };

  const handleToggleBookmark = (matchId: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, bookmarked: !m.bookmarked } : m
      )
    );
  };

  const handleToggleHymStream = (matchId: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, isHymStream: !m.isHymStream } : m
      )
    );
  };

  const handleUpdateMatch = (updated: FootballMatch) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
    showToast('Ficha del partido actualizada');
  };

  const handleSaveMatchForm = (savedMatch: FootballMatch) => {
    setMatches((prev) => {
      const exists = prev.some((m) => m.id === savedMatch.id);
      if (exists) {
        return prev.map((m) => (m.id === savedMatch.id ? savedMatch : m));
      }
      return [...prev, savedMatch];
    });
    const savedDateKey = getDateKeyInTimezone(savedMatch.kickoffIso, timeZone);
    handleSelectDateKey(savedDateKey);
    setFormOpen(false);
    setEditingMatch(null);
    showToast(
      editingMatch
        ? 'Partido actualizado correctamente'
        : 'Partido añadido al calendario'
    );
  };

  const handleDeleteMatch = (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setInspectedMatchId(null);
    showToast('Partido eliminado del calendario');
  };

  const handleExportIcs = () => {
    const listToExport =
      filteredMatches.length > 0 ? filteredMatches : matches;
    const icsContent = generateIcsContent(listToExport);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calendario-futbol-hym-yt.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      `Calendario exportado (${listToExport.length} partidos en .ics)`
    );
  };

  const handleExportJson = () => {
    const listToExport =
      filteredMatches.length > 0 ? filteredMatches : matches;
    const jsonContent = JSON.stringify(listToExport, null, 2);
    const blob = new Blob([jsonContent], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hym-yt-partidos.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(
      `Partidos exportados (${listToExport.length} partidos en .json)`
    );
  };

  const handleResetMatches = () => {
    setMatches(INITIAL_MATCHES);
    handleResetFilters();
    handleJumpToToday();
    showToast('Calendario restablecido a la programación base');
  };

  const handleImportRobotMatches = (imported: FootballMatch[]) => {
    let addedCount = 0;
    let updatedCount = 0;

    const next = [...matches];
    const indicesByDate = new Map<string, number[]>();
    next.forEach((m, idx) => {
      const dateKey = m.kickoffIso.slice(0, 10);
      const bucket = indicesByDate.get(dateKey);
      if (bucket) {
        bucket.push(idx);
      } else {
        indicesByDate.set(dateKey, [idx]);
      }
    });

    for (const incoming of imported) {
      const incomingDate = incoming.kickoffIso.slice(0, 10);
      const candidates = indicesByDate.get(incomingDate) ?? [];
      const matchIndex = candidates.find((idx) => {
        const existing = next[idx];
        return (
          areTeamsEquivalent(existing.homeTeam.name, incoming.homeTeam.name) &&
          areTeamsEquivalent(existing.awayTeam.name, incoming.awayTeam.name)
        );
      });

      if (matchIndex !== undefined) {
        const existing = next[matchIndex];
        next[matchIndex] = {
          ...existing,
          kickoffIso: incoming.kickoffIso,
          round: incoming.round || existing.round,
          stadium:
            incoming.stadium !== 'Por confirmar'
              ? incoming.stadium
              : existing.stadium,
          broadcast:
            incoming.broadcast !== 'Por confirmar' &&
            incoming.broadcast !== 'Flashscore.es'
              ? incoming.broadcast
              : existing.broadcast,
          status: incoming.status || existing.status,
          homeScore:
            incoming.homeScore !== undefined
              ? incoming.homeScore
              : existing.homeScore,
          awayScore:
            incoming.awayScore !== undefined
              ? incoming.awayScore
              : existing.awayScore,
          notes: incoming.notes || existing.notes,
        };
        updatedCount += 1;
      } else {
        const newIdx = next.length;
        next.push(incoming);
        const bucket = indicesByDate.get(incomingDate);
        if (bucket) {
          bucket.push(newIdx);
        } else {
          indicesByDate.set(incomingDate, [newIdx]);
        }
        addedCount += 1;
      }
    }

    setMatches(next);

    if (imported.length > 0) {
      const firstDate = getDateKeyInTimezone(imported[0].kickoffIso, timeZone);
      handleSelectDateKey(firstDate);
    }
    showToast(
      `Robot de partidos: ${addedCount} añadidos, ${updatedCount} actualizados`
    );
  };

  const weekDaysRange = useMemo(() => {
    const days = getWeekDaysFromKey(selectedDateKey);
    if (days.length === 0) return '';
    return `${formatShortDateFromKeyEs(days[0].dateKey)} — ${formatShortDateFromKeyEs(days[6].dateKey)}`;
  }, [selectedDateKey]);

  const handleInstallAction = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        showToast('Aplicación móvil instalada correctamente');
        setInstallModalOpen(false);
        return;
      }
    }
    setInstallModalOpen(true);
  };

  const handleDismissMobileBanner = () => {
    setMobileBannerDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_PWA_DISMISSED, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const periodTitle =
    viewMode === 'standings'
      ? 'Todas las ligas del mundo · Partidos, días y meses'
      : viewMode === 'koora'
        ? 'Koora Live · Partidos en vivo y gratis'
        : viewMode === 'year'
          ? 'Todos los meses · Temporada 2026–27'
          : viewMode === 'week'
            ? weekDaysRange
            : formatMonthTitleEs(currentYear, currentMonthIndex);

  return (
    <div className="min-h-screen lg:h-screen flex bg-[#F6F7F9] dark:bg-[#0B0F14] text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentYear={currentYear}
        currentMonthIndex={currentMonthIndex}
        selectedDateKey={selectedDateKey}
        onSelectDateKey={handleSelectDateKey}
        onSelectMonth={handleSelectMonth}
        onPrevMonth={handlePrevPeriod}
        onNextMonth={handleNextPeriod}
        onJumpToToday={handleJumpToToday}
        activeCompetitions={activeCompetitions}
        onToggleCompetition={handleToggleCompetition}
        onResetCompetitions={() => setActiveCompetitions([])}
        onlyBookmarked={onlyBookmarked}
        onToggleOnlyBookmarked={() => setOnlyBookmarked((v) => !v)}
        onlyHymStreams={onlyHymStreams}
        onToggleOnlyHymStreams={() => setOnlyHymStreams((v) => !v)}
        competitionCounts={competitionCounts}
        bookmarkedCount={bookmarkedCount}
        hymStreamCount={hymStreamCount}
        matchDateKeysSet={matchDateKeysSet}
        timeZone={timeZone}
        onChangeTimeZone={setTimeZone}
        onExportIcs={handleExportIcs}
        onExportJson={handleExportJson}
        onResetMatches={handleResetMatches}
        onOpenRobot={() => setRobotOpen(true)}
        onOpenStandings={() => setViewMode('standings')}
        onOpenCalendarSync={() => setCalendarSyncOpen(true)}
        isPwaInstalled={isInstalled}
        onOpenInstallModal={handleInstallAction}
        profile={userProfile}
        onOpenProfile={() => setProfileOpen(true)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar (3 zones: title/breadcrumb, search, primary CTA + theme affordance) */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#11161D] border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menú lateral"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="Abrir mi perfil"
              title="Mi perfil"
              className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 shrink-0 hover:ring-2 hover:ring-emerald-600 transition-all"
            >
              <img
                src="/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png"
                alt="Mi perfil HYM_YT"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
              El Calendario de Fútbol de hym_yt
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="relative hidden sm:block w-56 md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar equipo, estadio o canal..."
                aria-label="Buscar partidos"
                className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={
                darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
              }
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setRobotOpen(true)}
              title="Abrir Robot de partidos · Calendario Flashscore.es"
              aria-label="Abrir Robot de partidos"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Robot de partidos</span>
              <span className="md:hidden">Robot</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setFormDefaultDateKey(selectedDateKey);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Añadir partido</span>
              <span className="sm:hidden">Añadir</span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Mobile search bar */}
          <div className="sm:hidden relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar equipo, estadio o canal..."
              aria-label="Buscar partidos"
              className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <OfflineIndicator isOnline={isOnline} />

          <MobileInstallBanner
            isInstalled={isInstalled}
            dismissed={mobileBannerDismissed}
            isInstallable={isInstallable}
            onInstallClick={handleInstallAction}
            onDismiss={handleDismissMobileBanner}
          />

          {/* Editorial Matchday Spotlight */}
          <FeaturedMatchBanner
            match={featuredMatch}
            timeZone={timeZone}
            onInspectMatch={(m) => setInspectedMatchId(m.id)}
            onToggleBookmark={handleToggleBookmark}
          />

          {/* Workspace Toolbar: Month Navigation + Segmented View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#11161D] overflow-hidden">
                <button
                  type="button"
                  onClick={handlePrevPeriod}
                  aria-label="Periodo anterior"
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={handleNextPeriod}
                  aria-label="Periodo siguiente"
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {periodTitle}
              </h2>

              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                · {filteredMatches.length}{' '}
                {filteredMatches.length === 1 ? 'partido' : 'partidos'} ·{' '}
                {TIMEZONE_OPTIONS.find((tz) => tz.id === timeZone)?.shortLabel ??
                  timeZone}
              </span>
            </div>

            {/* Segmented View Switcher, Status Filter & Robot action */}
            <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
              {(activeCompetitions.length > 0 ||
                statusFilter !== 'all' ||
                onlyBookmarked ||
                onlyHymStreams ||
                searchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Limpiar filtros
                </button>
              )}

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | MatchStatus)
                }
                aria-label="Filtrar por estado"
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 shrink-0"
              >
                <option value="all">Todos los estados</option>
                <option value="scheduled">Próximos</option>
                <option value="live">En directo</option>
                <option value="finished">Finalizados</option>
              </select>

              <button
                type="button"
                onClick={() => setRobotOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Robot de partidos</span>
              </button>

              <button
                type="button"
                onClick={() => setCalendarSyncOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Conectar calendario</span>
              </button>

              <div
                role="tablist"
                aria-label="Modo de visualización del calendario"
                className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'month'}
                  onClick={() => setViewMode('month')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'month'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Mes</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'week'}
                  onClick={() => setViewMode('week')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'week'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Semana</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Horarios</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'year'}
                  onClick={() => setViewMode('year')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'year'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Todos los meses</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'koora'}
                  onClick={() => setViewMode('koora')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'koora'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Koora Live</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'standings'}
                  onClick={() => setViewMode('standings')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'standings'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Ligas del mundo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Calendar View */}
          {viewMode === 'month' && (
            <MonthView
              currentYear={currentYear}
              currentMonthIndex={currentMonthIndex}
              selectedDateKey={selectedDateKey}
              matches={filteredMatches}
              timeZone={timeZone}
              onSelectDateKey={handleSelectDateKey}
              onInspectMatch={(m) => setInspectedMatchId(m.id)}
              onAddMatchForDate={(dateKey) => {
                setEditingMatch(null);
                setFormDefaultDateKey(dateKey);
                setFormOpen(true);
              }}
              onToggleBookmark={handleToggleBookmark}
            />
          )}

          {viewMode === 'week' && (
            <WeekView
              selectedDateKey={selectedDateKey}
              matches={filteredMatches}
              timeZone={timeZone}
              onSelectDateKey={handleSelectDateKey}
              onInspectMatch={(m) => setInspectedMatchId(m.id)}
              onAddMatchForDate={(dateKey) => {
                setEditingMatch(null);
                setFormDefaultDateKey(dateKey);
                setFormOpen(true);
              }}
              onToggleBookmark={handleToggleBookmark}
            />
          )}

          {viewMode === 'list' && (
            <ListView
              matches={filteredMatches}
              timeZone={timeZone}
              onInspectMatch={(m) => setInspectedMatchId(m.id)}
              onToggleBookmark={handleToggleBookmark}
              onToggleHymStream={handleToggleHymStream}
              onOpenNewMatch={() => {
                setEditingMatch(null);
                setFormDefaultDateKey(selectedDateKey);
                setFormOpen(true);
              }}
              onResetFilters={handleResetFilters}
            />
          )}

          {viewMode === 'year' && (
            <AllMonthsView
              matches={filteredMatches}
              timeZone={timeZone}
              selectedDateKey={selectedDateKey}
              onOpenMonth={(y, mIdx) => {
                handleSelectMonth(y, mIdx);
                setViewMode('month');
              }}
              onSelectDayInMonth={(dateKey) => {
                handleSelectDateKey(dateKey);
                setViewMode('month');
              }}
              onInspectMatch={(m) => setInspectedMatchId(m.id)}
            />
          )}

          {viewMode === 'koora' && (
            <>
              <FlashscoreSection
                timeZone={timeZone}
                onImportMatches={handleImportRobotMatches}
              />
              <LiveChannelsSection />
            </>
          )}

          {viewMode === 'standings' && (
            <StandingsView
              timeZone={timeZone}
              onImportMatches={handleImportRobotMatches}
            />
          )}

          {/* Suscripción gratuita a Google Calendar, Apple iCal y Outlook */}
          <CalendarSubscribeSection />

          {/* Footer HYM_YT */}
          <footer className="pt-6 pb-2 border-t border-slate-200 dark:border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="inline-flex items-center gap-2 text-left hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <img
                  src="/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png"
                  alt="Perfil oficial de HYM_YT"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <span className="font-display font-semibold text-slate-800 dark:text-slate-200">
                  {userProfile.displayName}
                </span>
              </button>
              <span aria-hidden="true">·</span>
              <span>{userProfile.tagline}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">© 2026 {userProfile.displayName}</span>
            </div>

            <nav
              aria-label="Redes oficiales de HYM_YT"
              className="flex items-center gap-4"
            >
              <a
                href="https://youtube.com/@hym_yt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
              >
                YouTube
              </a>
              <a
                href="https://kick.com/hym-yt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
              >
                Kick
              </a>
              <a
                href="https://www.instagram.com/hym_yt1/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
              >
                Instagram
              </a>
              <a
                href="https://www.tiktok.com/@hym_yt?_r=1&_t=ZN-99Akqwhtzl8"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
              >
                TikTok
              </a>
            </nav>
          </footer>
        </main>
      </div>

      {/* Match Inspector Slide-Over */}
      <MatchInspectorModal
        match={inspectedMatch}
        timeZone={timeZone}
        onClose={() => setInspectedMatchId(null)}
        onUpdateMatch={handleUpdateMatch}
        onEditMatch={(m) => {
          setInspectedMatchId(null);
          setEditingMatch(m);
          setFormDefaultDateKey(null);
          setFormOpen(true);
        }}
        onDeleteMatch={handleDeleteMatch}
      />

      {/* Add / Edit Match Modal */}
      <MatchFormModal
        open={formOpen}
        initialMatch={editingMatch}
        defaultDateKey={formDefaultDateKey}
        timeZone={timeZone}
        onClose={() => {
          setFormOpen(false);
          setEditingMatch(null);
        }}
        onSave={handleSaveMatchForm}
      />

      {/* Robot de Horarios Modal */}
      <ScheduleRobotModal
        open={robotOpen}
        timeZone={timeZone}
        onClose={() => setRobotOpen(false)}
        onImportMatches={handleImportRobotMatches}
      />

      {/* Conectar Aplicación de Calendario Modal */}
      <CalendarSyncModal
        open={calendarSyncOpen}
        onClose={() => setCalendarSyncOpen(false)}
      />

      {/* PWA Mobile Install Modal */}
      <PWAInstallModal
        open={installModalOpen}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onTriggerNativeInstall={async () => {
          const outcome = await install();
          if (outcome === 'accepted') {
            showToast('Aplicación móvil instalada correctamente');
            setInstallModalOpen(false);
          }
        }}
        onClose={() => setInstallModalOpen(false)}
      />

      {/* Mi Perfil Modal */}
      <ProfileModal
        open={profileOpen}
        profile={userProfile}
        totalMatches={matches.length}
        bookmarkedCount={bookmarkedCount}
        hymStreamCount={hymStreamCount}
        timeZone={timeZone}
        darkMode={darkMode}
        isPwaInstalled={isInstalled}
        onChangeTimeZone={setTimeZone}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onOpenInstallModal={handleInstallAction}
        onSaveProfile={(next) => {
          setUserProfile(next);
          showToast('Perfil actualizado correctamente');
        }}
        onResetProfile={() => {
          setUserProfile(DEFAULT_USER_PROFILE);
          showToast('Perfil restablecido');
        }}
        onClose={() => setProfileOpen(false)}
      />

      {/* Subtle Toast Confirmation */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium shadow-lg border border-slate-800 dark:border-slate-200"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
