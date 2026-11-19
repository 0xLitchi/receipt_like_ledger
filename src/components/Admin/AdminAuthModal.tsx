import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import { PlatinumWindow } from '../Platinum/PlatinumChrome';

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
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请输入管理员密码');
      setErrorCount((n) => n + 1);
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
      setErrorCount((n) => n + 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.35)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <PlatinumWindow
          title="管理员身份验证 · Admin Sign In"
          onClose={onClose}
          closeTitle="关闭"
        >
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '14px 16px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#333' }}>
                请输入 <code>ADMIN_PASSWORD</code> 以解锁全量明文数据并进入后台管理。
              </p>

              {error && (
                <div
                  key={errorCount}
                  role="alert"
                  className="field-shake"
                  style={{
                    marginBottom: 10,
                    padding: '6px 8px',
                    background: '#fee2e2',
                    border: '1px solid #991b1b',
                    color: '#991b1b',
                    fontSize: 11,
                  }}
                >
                  {error}
                </div>
              )}

              <label
                htmlFor="admin-password-input"
                style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 11 }}
              >
                密码:
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理员密码…"
                  className="pt-input"
                  style={{ flex: 1, height: 24, fontFamily: 'var(--font-mono)' }}
                />
                <button
                  type="button"
                  className="pt-btn tab"
                  style={{ height: 24 }}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <div
              className="pt-statusbar"
              style={{ padding: '8px 12px', justifyContent: 'flex-end', gap: 8 }}
            >
              <button type="button" className="pt-btn" onClick={onClose}>
                取消
              </button>
              <button type="submit" disabled={loading} className="pt-btn primary">
                {loading ? '验证中…' : '确认进入'}
              </button>
            </div>
          </form>
        </PlatinumWindow>
      </div>
    </div>
  );
};
