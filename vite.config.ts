import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mockApi } from './vite.plugins/mock-api.ts';

// https://vite.dev/config/
// MOCK_API=1 npm run dev 可脱离 wrangler/D1 直接预览前端（本地 mock 数据）
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.MOCK_API ? [mockApi()] : [])],
});
