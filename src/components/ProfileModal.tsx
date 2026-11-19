import React, { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Globe,
  Moon,
  RotateCcw,
  Smartphone,
  Sun,
  User,
  X,
} from 'lucide-react';
import { TIMEZONE_OPTIONS } from '../utils/dateUtils';

export interface UserProfile {
  displayName: string;
  tagline: string;
  bio: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: 'HYM_YT',
  tagline: 'La pasión por el fútbol',
  bio: 'Calendario interactivo, horarios de emisión y agenda de directos de fútbol.',
};

const PROFILE_AVATAR_URL =
  '/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png';

interface ProfileModalProps {
  open: boolean;
  profile: UserProfile;
  totalMatches: number;
  bookmarkedCount: number;
  hymStreamCount: number;
  timeZone: string;
  darkMode: boolean;
  isPwaInstalled: boolean;
  onChangeTimeZone: (tz: string) => void;
  onToggleDarkMode: () => void;
  onOpenInstallModal: () => void;
  onSaveProfile: (next: UserProfile) => void;
  onResetProfile: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  profile,
  totalMatches,
  bookmarkedCount,
  hymStreamCount,
  timeZone,
  darkMode,
  isPwaInstalled,
  onChangeTimeZone,
  onToggleDarkMode,
  onOpenInstallModal,
  onSaveProfile,
  onResetProfile,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [tagline, setTagline] = useState(profile.tagline);
  const [bio, setBio] = useState(profile.bio);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(profile.displayName);
      setTagline(profile.tagline);
      setBio(profile.bio);
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      displayName: displayName.trim() || DEFAULT_USER_PROFILE.displayName,
      tagline: tagline.trim() || DEFAULT_USER_PROFILE.tagline,
      bio: bio.trim() || DEFAULT_USER_PROFILE.bio,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mi perfil"
        className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky top-0 bg-white dark:bg-[#11161D] z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
              Mi perfil
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Identity Card */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-950 flex items-center justify-center">
              {!imgError ? (
                <img
                  src={PROFILE_AVATAR_URL}
                  alt="Emblema oficial de perfil HYM_YT"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display font-bold text-xl text-white">
                  HYM
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Perfil oficial · Fútbol en directo
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                {displayName.trim() || DEFAULT_USER_PROFILE.displayName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {tagline.trim() || DEFAULT_USER_PROFILE.tagline}
              </p>
            </div>
          </div>

          {/* Hairline-divided metrics */}
          <div className="grid grid-cols-3 border border-slate-200 dark:border-slate-800 rounded-lg divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="px-3 py-3 text-center">
              <div className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                {totalMatches}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Partidos
              </div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                {bookmarkedCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Guardados
              </div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="font-mono tabular-nums text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {hymStreamCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Directos HYM_YT
              </div>
            </div>
          </div>

          {/* Editable details */}
          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Nombre del perfil
              </label>
              <input
                id="profile-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-tagline"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Subtítulo
              </label>
              <input
                id="profile-tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Descripción del canal
              </label>
              <textarea
                id="profile-bio"
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={180}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              />
            </div>
          </div>

          {/* Preferences */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Preferencias de visualización
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="profile-timezone"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Zona horaria</span>
                </label>
                <select
                  id="profile-timezone"
                  value={timeZone}
                  onChange={(e) => onChangeTimeZone(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="w-full min-h-[36px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5" />
                      <span>Cambiar a modo claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      <span>Cambiar a modo oscuro</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Official links */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Canales oficiales de HYM_YT
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
              <a
                href="https://youtube.com/@hym_yt"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap"
              >
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              </a>
              <a
                href="https://kick.com/hym-yt"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap"
              >
                <span>Kick</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              </a>
              <a
                href="https://www.instagram.com/hym_yt1/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap"
              >
                <span>Instagram</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              </a>
              <a
                href="https://www.tiktok.com/@hym_yt?_r=1&_t=ZN-99Akqwhtzl8"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap"
              >
                <span>TikTok</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              </a>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProfile();
                  setDisplayName(DEFAULT_USER_PROFILE.displayName);
                  setTagline(DEFAULT_USER_PROFILE.tagline);
                  setBio(DEFAULT_USER_PROFILE.bio);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
              {!isPwaInstalled && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInstallModal();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>App móvil</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar perfil</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
