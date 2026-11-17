import React from 'react';
import { ExternalLink, Tv } from 'lucide-react';

export interface OfficialChannel {
  id: string;
  name: string;
  description: string;
  url: string;
  accentHex: string;
  keywords: string[];
}

export const OFFICIAL_CHANNELS: OfficialChannel[] = [
  {
    id: 'dazn',
    name: 'DAZN',
    description: 'Ver fútbol en directo y a la carta',
    url: 'https://www.dazn.com/es-ES/home',
    accentHex: '#E11D48',
    keywords: ['dazn'],
  },
  {
    id: 'movistar',
    name: 'Movistar Plus+',
    description: 'Ver fútbol y competiciones oficiales',
    url: 'https://www.movistarplus.es/',
    accentHex: '#0284C7',
    keywords: ['movistar'],
  },
  {
    id: 'orange',
    name: 'Orange TV',
    description: 'Ver fútbol en emisión oficial',
    url: 'https://www.orange.es/',
    accentHex: '#EA580C',
    keywords: ['orange'],
  },
  {
    id: 'rtve',
    name: 'RTVE Play',
    description: 'Ver emisiones abiertas',
    url: 'https://www.rtve.es/play/',
    accentHex: '#2563EB',
    keywords: ['rtve', 'la 1', 'teledeporte', 'tve'],
  },
];

export function matchOfficialChannels(broadcastText: string): OfficialChannel[] {
  const lower = broadcastText.toLowerCase();
  return OFFICIAL_CHANNELS.filter((channel) =>
    channel.keywords.some((kw) => lower.includes(kw))
  );
}

export const LiveChannelsSection: React.FC = () => {
  return (
    <section
      id="canales-directo"
      aria-label="Canales de fútbol en directo"
      className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Tv className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
              Canales de fútbol en directo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Encuentra dónde ver cada partido legalmente
            </p>
          </div>
        </div>

        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {OFFICIAL_CHANNELS.length} plataformas oficiales
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

            <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              {channel.description}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};
