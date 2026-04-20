import { AppUser, UserRole } from '../types';

export const PERMISSIONS = {
  MANAGE_LOANS: ['ADMIN', 'MANAGER'],
  DELETE_RECORDS: ['ADMIN'],
  UPDATE_RATES: ['ADMIN'],
  CLOSE_LOAN: ['ADMIN'],
  DELETE_LOAN: ['ADMIN'],
  RECORD_PAYMENTS: ['ADMIN', 'MANAGER'],
  VIEW_AUDIT: ['ADMIN', 'MANAGER', 'VIEWER'],
} as const;

export function hasPermission(user: AppUser | null, permission: keyof typeof PERMISSIONS): boolean {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(user.role);
}

export function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return 'text-natural-error bg-natural-error/5 border-natural-error/20';
    case 'MANAGER': return 'text-natural-accent bg-natural-accent/5 border-natural-accent/20';
    case 'VIEWER': return 'text-natural-muted bg-natural-sidebar border-natural-border';
    default: return 'text-natural-muted bg-natural-sidebar';
  }
}
