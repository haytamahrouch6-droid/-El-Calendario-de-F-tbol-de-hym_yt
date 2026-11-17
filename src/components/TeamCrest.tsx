import React from 'react';
import { TeamInfo } from '../types/match';

interface TeamCrestProps {
  team: TeamInfo;
  size?: 'sm' | 'md' | 'lg';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size = 'md' }) => {
  const dimensions =
    size === 'sm'
      ? 'w-5 h-5 text-[9px]'
      : size === 'lg'
        ? 'w-10 h-10 text-xs'
        : 'w-7 h-7 text-[10px]';

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
