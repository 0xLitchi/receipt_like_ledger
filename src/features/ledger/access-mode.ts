import type { AccessMode } from '../../types';

export function resolveAccessMode(isAdmin: boolean, hasFullAccess: boolean): AccessMode {
  if (isAdmin) return 'admin';
  return hasFullAccess ? 'decrypted' : 'masked';
}

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  admin: 'ADMIN',
  decrypted: 'DECRYPTED',
  masked: 'MASKED',
};

/** 金额颜色的统一约定：收入绿、支出红 */
export const amountColor = (amount: number): string =>
  amount >= 0 ? 'text-emerald-700' : 'text-rose-700';
