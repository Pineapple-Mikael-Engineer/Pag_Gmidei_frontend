import { AuthUser, GroupRole, UserMembership } from './api';

export function canManageProject(projectRoles: GroupRole[]) {
  return projectRoles.includes('MENTOR') || projectRoles.includes('LIDER');
}

export function canLeadProject(projectRoles: GroupRole[]) {
  return projectRoles.includes('LIDER');
}

export function canManageSubgroup(user: Pick<AuthUser, 'isGodAdmin' | 'memberships'> | null | undefined, subgroupId?: string) {
  if (!user || !subgroupId) return false;
  if (user.isGodAdmin) return true;
  const membership = (user.memberships || []).find((item: UserMembership) => item.subgroupId === subgroupId);
  return !!membership && canManageProject(membership.roles || []);
}

export function canLeadSubgroup(user: Pick<AuthUser, 'isGodAdmin' | 'memberships'> | null | undefined, subgroupId?: string) {
  if (!user || !subgroupId) return false;
  if (user.isGodAdmin) return true;
  const membership = (user.memberships || []).find((item: UserMembership) => item.subgroupId === subgroupId);
  return !!membership && canLeadProject(membership.roles || []);
}
