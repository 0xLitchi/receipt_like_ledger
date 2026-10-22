import type { AccessMode } from '../../types';

export function resolveAccessMode(isAdmin: boolean, hasFullAccess: boolean): AccessMode {
  if (isAdmin) return 'admin';
  return hasFullAccess ? 'decrypted' : 'masked';
}

/** 金额颜色的统一约定：收入绿、支出红；脱敏状态不染绿避免误读 */
export const amountColor = (amount: number, hasFullAccess = true): string => {
  if (!hasFullAccess) return 'opacity-70';
  return amount >= 0 ? 'text-emerald-700' : 'text-rose-700';
};
