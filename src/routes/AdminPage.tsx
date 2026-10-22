import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPanel } from '../components/Admin/AdminPanel';
import { useTransactionMutations, useTransactionsQuery } from '../lib/queries';
import { queryClient } from '../lib/query-client';
import { logoutAdmin, tokenStore } from '../lib/api-client';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, refetch } = useTransactionsQuery();
  const { batch } = useTransactionMutations();

  const backToLedger = () => navigate('/', { replace: true });

  // 没有会话 token 时不允许停留在此路由（例如直接输入 /admin）
  React.useEffect(() => {
    if (!tokenStore.hasSession()) navigate('/', { replace: true });
  }, [navigate]);

  return (
    <AdminPanel
      isOpen
      onClose={backToLedger}
      transactions={data?.data ?? []}
      onRefresh={async () => {
        await refetch();
      }}
      onBatchSave={async (items, deletedIds) => {
        const result = await batch.mutateAsync({ items, deletedIds });
        if (result.failed > 0) {
          throw new Error(`有 ${result.failed} 条记录保存失败，请刷新后重试`);
        }
      }}
      onLogout={async () => {
        await logoutAdmin();
        // 注销后清掉缓存，避免把管理员数据继续留在内存里
        queryClient.clear();
        navigate('/', { replace: true });
      }}
      themeStyle="receipt"
      onThemeStyleChange={() => {
        /* 目前仅保留小票主题，切换入口已移除 */
      }}
    />
  );
};
