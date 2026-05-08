import { readCachedModeratorPermissions } from './permissions';

type Role = string;
type CrudPermissions = Record<string, boolean>;
type ModeratorPermissions = Record<string, CrudPermissions>;

function readCachedUserRole(): Role | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as { role?: unknown };
    return typeof u.role === 'string' ? u.role : null;
  } catch {
    return null;
  }
}

export function currentRole(): Role | null {
  return readCachedUserRole();
}

export function isSuperAdmin(): boolean {
  return readCachedUserRole() === 'superadmin';
}

export function isReadOnlyRole(): boolean {
  return readCachedUserRole() === 'hr';
}

export function canWrite(): boolean {
  const role = readCachedUserRole();
  return role === 'superadmin' || role === 'admin';
}

export function canCreateAdmin(): boolean {
  return readCachedUserRole() === 'superadmin';
}

export function can(
  moduleKey: keyof ModeratorPermissions,
  action: keyof CrudPermissions
): boolean {
  const role = readCachedUserRole();
  if (role === 'hr' && action !== 'read' && action !== 'list') return false;
  if (role === 'admin' || role === 'superadmin') return true;
  const perms = readCachedModeratorPermissions();
  return !!perms?.[moduleKey]?.[action];
}
