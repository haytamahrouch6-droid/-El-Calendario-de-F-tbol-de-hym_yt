import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';

type FeedCompetitionFilter =
  | 'main'
  | 'all'
  | 'laliga'
  | 'champions'
  | 'premier'
  | 'seleccion'
  | 'copadelrey';

const FEED_COMP_OPTIONS: Array<{ id: FeedCompetitionFilter; label: string }> = [
  { id: 'main', label: 'Ligas principales (LaLiga, Champions, Premier, Selección)' },
  { id: 'all', label: 'Todos los partidos disponibles' },
  { id: 'laliga', label: 'Solo LaLiga EA Sports' },
  { id: 'champions', label: 'Solo UEFA Champions League' },
  { id: 'premier', label: 'Solo Premier League' },
  { id: 'seleccion', label: 'Solo Selecciones' },
  { id: 'copadelrey', label: 'Solo Copa del Rey' },
];

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2H3V7Z" fill="#4285F4" />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#1E40AF" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#1E40AF" />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#1E293B"
      >
        31
      </text>
    </svg>
  );
}

function AppleIcalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="3.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
      <path d="M3 7.5A3.5 3.5 0 0 1 6.5 4h11A3.5 3.5 0 0 1 21 7.5V9H3V7.5Z" fill="#EF4444" />
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#0F172A"
      >
        17
      </text>
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#0369A1" />
      <rect x="11" y="6" width="8" height="12" rx="1.5" fill="#38BDF8" />
      <rect x="4.5" y="7" width="8.5" height="10" rx="1.5" fill="#0284C7" />
      <text
        x="8.75"
        y="14.5"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#FFFFFF"
      >
        O
      </text>
    </svg>
  );
}

function OutlookWebIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#0F766E" />
      <rect x="10.5" y="6" width="8.5" height="12" rx="1.5" fill="#5EEAD4" />
      <rect x="4.5" y="7" width="8.5" height="10" rx="1.5" fill="#0D9488" />
      <circle cx="8.75" cy="12" r="2.7" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

interface CalendarSubscribeBodyProps {
  compact?: boolean;
}

const CalendarSubscribeBody: React.FC<CalendarSubscribeBodyProps> = ({
  compact = false,
}) => {
  const [selectedComp, setSelectedComp] =
    useState<FeedCompetitionFilter>('main');
  const [copied, setCopied] = useState(false);

  const { httpsUrl, webcalUrl, googleUrl, outlookWebUrl, downloadUrl } =
    useMemo(() => {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3000';
      const host =
        typeof window !== 'undefined'
          ? window.location.host
          : 'localhost:3000';
      const pathWithQuery = `/api/calendar.ics?comp=${selectedComp}`;
      const httpFeed = `${origin}${pathWithQuery}`;
      const webcalFeed = `webcal://${host}${pathWithQuery}`;

      return {
        httpsUrl: httpFeed,
        webcalUrl: webcalFeed,
        googleUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
          webcalFeed
        )}`,
        outlookWebUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
          httpFeed
        )}&name=${encodeURIComponent('HYM_YT · Calendario de Fútbol')}`,
        downloadUrl: `${pathWithQuery}&download=1`,
      };
    }, [selectedComp]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const apps = [
    {
      id: 'google',
      name: 'Google Calendar',
      hint: 'Android, web y escritorio',
      href: googleUrl,
      external: true,
      icon: <GoogleCalendarIcon />,
    },
    {
      id: 'apple',
      name: 'Apple iCal',
      hint: 'iPhone, iPad y Mac',
      href: webcalUrl,
      external: false,
      icon: <AppleIcalIcon />,
    },
    {
      id: 'outlook',
      name: 'Microsoft Outlook',
      hint: 'Aplicación de escritorio',
      href: webcalUrl,
      external: false,
      icon: <OutlookIcon />,
    },
    {
      id: 'outlook-web',
      name: 'Outlook.com / Hotmail',
      hint: 'Versión web en navegador',
      href: outlookWebUrl,
      external: true,
      icon: <OutlookWebIcon />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Selector de competición para el feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>Gratis, siempre actualizado y sin crear cuenta</span>
        </div>

        <select
          value={selectedComp}
          onChange={(e) =>
            setSelectedComp(e.target.value as FeedCompetitionFilter)
          }
          aria-label="Seleccionar competiciones para suscribir"
          className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          {FEED_COMP_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 4 aplicaciones de calendario */}
      <div
        className={`grid gap-3 ${
          compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {apps.map((app) => (
          <a
            key={app.id}
            href={app.href}
            {...(app.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            className="group flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {app.icon}
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {app.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {app.hint}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 shrink-0" />
          </a>
        ))}
      </div>

      {/* Enlace manual y descarga .ics */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            Enlace .ics:
          </span>
          <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 truncate flex-1">
            {httpsUrl}
          </code>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>¡Enlace copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar enlace</span>
              </>
            )}
          </button>

          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar .ics</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export const CalendarSubscribeSection: React.FC = () => {
  return (
    <section
      id="sincronizar-calendario"
      aria-label="Elige tu aplicación de calendario"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
        <CalendarPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <div>
          <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
            Elige tu aplicación de calendario
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Añade los partidos a tu agenda personal en un clic y recíbelos siempre actualizados.
          </p>
        </div>
      </div>

      <div className="p-5">
        <CalendarSubscribeBody />
      </div>
    </section>
  );
};

interface CalendarSyncModalProps {
  open: boolean;
  onClose: () => void;
}

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elige tu aplicación de calendario"
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarPlus className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                Elige tu aplicación de calendario
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Gratis, siempre actualizado y sin crear cuenta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector de calendario"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <CalendarSubscribeBody compact />
        </div>
      </div>
    </div>
  );
};
