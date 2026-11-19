import { useSyncExternalStore } from 'react';
import { normalizeTeamMatchKey } from './scheduleParser';

const logoStore = new Map<string, string>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;
let initialFetchPromise: Promise<void> | null = null;

function notifyListeners(): void {
  snapshotVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return snapshotVersion;
}

export function registerTeamLogo(teamName: string, logoUrl?: string): void {
  if (!teamName || !logoUrl) return;
  const cleanUrl = logoUrl.trim();
  if (!cleanUrl) return;

  const exactKey = teamName.trim().toLowerCase();
  const normKey = normalizeTeamMatchKey(teamName);

  let changed = false;
  if (exactKey && logoStore.get(exactKey) !== cleanUrl) {
    logoStore.set(exactKey, cleanUrl);
    changed = true;
  }
  if (normKey && logoStore.get(normKey) !== cleanUrl) {
    logoStore.set(normKey, cleanUrl);
    changed = true;
  }
  if (changed) {
    notifyListeners();
  }
}

export function registerTeamLogos(
  entries: Array<{ name?: string; logoUrl?: string }>
): void {
  let changed = false;
  for (const entry of entries) {
    if (!entry.name || !entry.logoUrl) continue;
    const cleanUrl = entry.logoUrl.trim();
    if (!cleanUrl) continue;

    const exactKey = entry.name.trim().toLowerCase();
    const normKey = normalizeTeamMatchKey(entry.name);

    if (exactKey && logoStore.get(exactKey) !== cleanUrl) {
      logoStore.set(exactKey, cleanUrl);
      changed = true;
    }
    if (normKey && logoStore.get(normKey) !== cleanUrl) {
      logoStore.set(normKey, cleanUrl);
      changed = true;
    }
  }
  if (changed) {
    notifyListeners();
  }
}

export function registerLogoDictionary(dict: Record<string, string>): void {
  let changed = false;
  for (const [key, value] of Object.entries(dict)) {
    if (!key || !value) continue;
    if (logoStore.get(key) !== value) {
      logoStore.set(key, value);
      changed = true;
    }
  }
  if (changed) {
    notifyListeners();
  }
}

export function lookupTeamLogoUrl(teamName: string): string | undefined {
  if (!teamName) return undefined;
  const exactKey = teamName.trim().toLowerCase();
  const direct = logoStore.get(exactKey);
  if (direct) return direct;

  const normKey = normalizeTeamMatchKey(teamName);
  if (!normKey) return undefined;
  return logoStore.get(normKey);
}

export function useTeamLogoUrl(
  teamName: string,
  explicitLogoUrl?: string
): string | undefined {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return explicitLogoUrl || lookupTeamLogoUrl(teamName);
}

export function loadWorldTeamLogos(): Promise<void> {
  if (initialFetchPromise) return initialFetchPromise;
  initialFetchPromise = fetch('/api/flashscore/logos')
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.logos && typeof data.logos === 'object') {
        registerLogoDictionary(data.logos as Record<string, string>);
      }
    })
    .catch(() => {
      // Silencioso: el componente TeamCrest usará las siglas como respaldo
    });
  return initialFetchPromise;
}
