import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPanel } from '../components/Admin/AdminPanel';
import { useTransactionMutations, useTransactionsQuery } from '../lib/queries';
import { queryClient } from '../lib/query-client';
import { checkAdminSession, logoutAdmin, tokenStore } from '../lib/api-client';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, refetch } = useTransactionsQuery();
  const { batch } = useTransactionMutations();

  const backToLedger = () => navigate('/', { replace: true });

  // 没有会话 token 时不允许停留在此路由（例如直接输入 /admin）
  React.useEffect(() => {
    if (!tokenStore.hasSession()) navigate('/', { replace: true });
  }, [navigate]);

  // 本地 token 可能早已失效（会话过期 / 服务端重启 / 换了部署）。
  // 失效时后台只能读到脱敏数据、日志全 401、写入静默失败，所以先探测再放行。
  React.useEffect(() => {
    if (!tokenStore.hasSession()) return;
    let cancelled = false;
    void checkAdminSession().then((valid) => {
      if (cancelled || valid) return;
      logoutAdmin();
      queryClient.clear();
      navigate('/', { replace: true });
    });
    return () => {
      cancelled = true;
    };
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
        // 失败明细与 401 中断由 batchSaveTransactions 直接抛出，这里只需等待结果
        await batch.mutateAsync({ items, deletedIds });
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
