import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  batchSaveTransactions,
  createTransaction,
  deleteTransaction,
  fetchActivityLogs,
  fetchApiLogs,
  fetchSettings,
  fetchTransactions,
  updateThemeStyle,
  updateTransaction,
} from '../lib/api-client';
import type { ActivityLog, ApiRequestLog, ThemeStyle, Transaction } from '../types';

export const queryKeys = {
  transactions: ['transactions'] as const,
  settings: ['settings'] as const,
  activityLogs: ['logs', 'activity'] as const,
  apiLogs: ['logs', 'api'] as const,
};

/** 交易列表（含访问权限层级） */
export function useTransactionsQuery() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchSettings,
  });
}

export function useActivityLogsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activityLogs,
    queryFn: fetchActivityLogs,
    enabled,
  });
}

export function useApiLogsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.apiLogs,
    queryFn: fetchApiLogs,
    enabled,
  });
}

/** 写操作统一入口：成功后失效交易与日志缓存 */
export function useTransactionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.transactions });
    void qc.invalidateQueries({ queryKey: queryKeys.activityLogs });
    void qc.invalidateQueries({ queryKey: queryKeys.apiLogs });
  };

  const batch = useMutation({
    mutationFn: (payload: { items: Transaction[]; deletedIds: string[] }) =>
      batchSaveTransactions(payload.items, payload.deletedIds),
    onSuccess: invalidate,
  });

  const single = useMutation({
    mutationFn: (item: Transaction) =>
      item.id && !item.id.startsWith('new_') ? updateTransaction(item) : createTransaction(item),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: invalidate,
  });

  return { batch, single, remove };
}

export function useThemeStyleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (style: ThemeStyle) => updateThemeStyle(style),
    onSuccess: (_, style) => {
      qc.setQueryData(queryKeys.settings, { theme_style: style });
    },
  });
}

export type { ActivityLog, ApiRequestLog };
