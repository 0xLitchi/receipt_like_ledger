import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { LedgerPage } from './routes/LedgerPage';

// 后台体量大且仅管理员使用，单独拆包
const AdminPage = lazy(() =>
  import('./routes/AdminPage').then((m) => ({ default: m.AdminPage }))
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LedgerPage />} />
          <Route
            path="/admin"
            element={
              <Suspense
                fallback={
                  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
                    正在载入后台…
                  </div>
                }
              >
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
