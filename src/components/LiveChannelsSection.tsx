import React from 'react';
import { ExternalLink, Tv } from 'lucide-react';

export interface OfficialChannel {
  id: string;
  name: string;
  description: string;
  accessLabel: string;
  isFree: boolean;
  url: string;
  accentHex: string;
  keywords: string[];
}

export const OFFICIAL_CHANNELS: OfficialChannel[] = [
  {
    id: 'rtve',
    name: 'RTVE Play',
    description: 'Partidos en abierto, Selección y Copa del Rey gratis',
    accessLabel: 'Gratis en abierto',
    isFree: true,
    url: 'https://www.rtve.es/play/',
    accentHex: '#2563EB',
    keywords: ['rtve', 'la 1', 'tve'],
  },
  {
    id: 'teledeporte',
    name: 'Teledeporte',
    description: 'Emisión deportiva gratuita en directo las 24 horas',
    accessLabel: 'Gratis en abierto',
    isFree: true,
    url: 'https://www.rtve.es/play/videos/directo/deportes/teledeporte/',
    accentHex: '#0284C7',
    keywords: ['teledeporte', 'tdp'],
  },
  {
    id: 'youtube-hym',
    name: 'YouTube · HYM_YT',
    description: 'Directos gratis, reacciones y marcadores en vivo',
    accessLabel: 'Gratis · Directo',
    isFree: true,
    url: 'https://youtube.com/@hym_yt',
    accentHex: '#DC2626',
    keywords: ['youtube', 'hym_yt', 'hym'],
  },
  {
    id: 'kick-hym',
    name: 'Kick · HYM_YT',
    description: 'Transmisión en vivo gratuita y chat de partidos',
    accessLabel: 'Gratis · Directo',
    isFree: true,
    url: 'https://kick.com/hym-yt',
    accentHex: '#16A34A',
    keywords: ['kick'],
  },
  {
    id: 'tiktok-hym',
    name: 'TikTok · HYM_YT',
    description: 'Directos, goles y mejores momentos en @hym_yt',
    accessLabel: 'Gratis · TikTok',
    isFree: true,
    url: 'https://www.tiktok.com/@hym_yt?_r=1&_t=ZN-99Akqwhtzl8',
    accentHex: '#111827',
    keywords: ['tiktok', 'hym_yt'],
  },
  {
    id: 'fifa-plus',
    name: 'FIFA+',
    description: 'Partidos gratuitos en directo de selecciones y torneos FIFA',
    accessLabel: 'Gratis en abierto',
    isFree: true,
    url: 'https://www.plus.fifa.com/',
    accentHex: '#0F766E',
    keywords: ['fifa+', 'fifa plus'],
  },
  {
    id: 'dazn',
    name: 'DAZN',
    description: 'LaLiga, Premier League, Liga F y competiciones oficiales',
    accessLabel: 'Plataforma oficial',
    isFree: false,
    url: 'https://www.dazn.com/es-ES/home',
    accentHex: '#E11D48',
    keywords: ['dazn'],
  },
  {
    id: 'movistar',
    name: 'Movistar Plus+',
    description: 'Champions League, LaLiga y grandes copas europeas',
    accessLabel: 'Plataforma oficial',
    isFree: false,
    url: 'https://www.movistarplus.es/',
    accentHex: '#0369A1',
    keywords: ['movistar'],
  },
  {
    id: 'orange',
    name: 'Orange TV',
    description: 'Fútbol nacional e internacional en emisión oficial',
    accessLabel: 'Plataforma oficial',
    isFree: false,
    url: 'https://www.orange.es/',
    accentHex: '#EA580C',
    keywords: ['orange'],
  },
];

export function matchOfficialChannels(broadcastText: string): OfficialChannel[] {
  const lower = broadcastText.toLowerCase();
  return OFFICIAL_CHANNELS.filter((channel) =>
    channel.keywords.some((kw) => lower.includes(kw))
  );
}

export const LiveChannelsSection: React.FC = () => {
  const freeCount = OFFICIAL_CHANNELS.filter((c) => c.isFree).length;

  return (
    <section
      id="canales-directo"
      aria-label="Canales gratis y plataformas oficiales de fútbol en directo"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Tv className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
              Dónde mirar partidos gratis y en directo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Emisiones gratuitas en abierto, directos de HYM_YT y plataformas oficiales
            </p>
          </div>
        </div>

        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {freeCount} canales gratis · {OFFICIAL_CHANNELS.length} en total
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800">
        {OFFICIAL_CHANNELS.map((channel) => (
          <a
            key={channel.id}
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white dark:bg-[#11161D] hover:bg-slate-50 dark:hover:bg-slate-900/60 p-5 flex flex-col justify-between gap-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: channel.accentHex }}
                  />
                  <span className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {channel.name}
                  </span>
                </div>
                <ExternalLink
                  className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0"
                  aria-hidden="true"
                />
              </div>

              <div
                className={`text-[11px] font-medium ${
                  channel.isFree
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {channel.accessLabel}
              </div>
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors leading-relaxed">
              {channel.description}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};
