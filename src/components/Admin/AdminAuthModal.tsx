import React, { useState } from 'react';
import { storage } from '../../utils/storage';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请输入管理员密码');
      return;
    }

    setLoading(true);
    setError('');

    const valid = await storage.verifyAdminPassword(password);
    setLoading(false);

    if (valid) {
      setPassword('');
      onSuccess();
    } else {
      setError('密码错误或服务端未配置 ADMIN_PASSWORD');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md no-print select-none">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 relative overflow-hidden transform transition-all">
        {/* 顶部绚丽渐变霓虹遮罩 */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 头部图标区 */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="relative mb-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-slate-700 text-amber-400">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-lg font-bold font-mono tracking-tight text-white">
            管理员安全身份验证
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            验证成功后自动解锁全量数据并进入 Excel 批量管理
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-mono flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 表单输入区 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 font-bold block">
              管理员密码 (ADMIN_PASSWORD)
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl font-mono text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 p-1 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition-colors border border-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
            >
              {loading ? '正在验证...' : '确认进入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
