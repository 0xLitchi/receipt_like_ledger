import { tokenStore, verifyAdmin } from '../lib/api-client';

/**
 * @deprecated 兼容层，仅供尚未迁移到 src/lib/api-client 的组件使用。
 * 新代码请直接从 lib/api-client 与 lib/queries 引入。
 */
export const storage = {
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      return await verifyAdmin(password);
    } catch {
      return false;
    }
  },

  getSavedAdminPassword(): string | null {
    return tokenStore.get();
  },

  logoutAdmin() {
    tokenStore.clear();
  },
};
