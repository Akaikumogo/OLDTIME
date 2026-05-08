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

export function can(
  moduleKey: keyof ModeratorPermissions,
  action: keyof CrudPermissions
): boolean {
  const role = readCachedUserRole();
  if (role === 'admin' || role === 'superadmin') return true;
  const perms = readCachedModeratorPermissions();
  return !!perms?.[moduleKey]?.[action];
}
