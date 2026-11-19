import React, { useEffect, useState } from 'react';
import { TeamInfo } from '../types/match';
import { useTeamLogoUrl } from '../utils/teamCrestRegistry';

interface TeamCrestProps {
  team: TeamInfo;
  size?: 'sm' | 'md' | 'lg';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size = 'md' }) => {
  const resolvedLogoUrl = useTeamLogoUrl(team.name, team.logoUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedLogoUrl]);

  const dimensions =
    size === 'sm'
      ? 'w-6 h-6 text-[9px]'
      : size === 'lg'
        ? 'w-11 h-11 text-xs'
        : 'w-8 h-8 text-[10px]';

  if (resolvedLogoUrl && !imgFailed) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden select-none bg-white dark:bg-white/95 border border-slate-200/90 dark:border-slate-700/80 p-0.5 ${dimensions}`}
        aria-hidden="true"
      >
        <img
          src={resolvedLogoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 font-mono font-semibold tracking-tighter rounded-md overflow-hidden select-none border border-black/10 dark:border-white/15 ${dimensions}`}
      style={{
        backgroundColor: team.primaryColor,
        color: '#FFFFFF',
      }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-x-0 bottom-0 h-1"
        style={{ backgroundColor: team.secondaryColor }}
      />
      <span className="relative z-10 leading-none">{team.shortCode}</span>
    </div>
  );
};
