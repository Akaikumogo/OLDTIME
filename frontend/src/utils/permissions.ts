export type ModeratorPermissions = Record<string, Record<string, boolean>>;

const KEY = 'myModeratorPermissions';

export function readCachedModeratorPermissions(): ModeratorPermissions | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ModeratorPermissions;
  } catch {
    return null;
  }
}

export function cacheModeratorPermissions(p: ModeratorPermissions | null) {
  try {
    if (!p) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

