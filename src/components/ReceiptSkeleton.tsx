import React from 'react';
import { PlatinumWindow } from './Platinum/PlatinumChrome';

/** Platinum Desktop loading skeleton matching LedgerDesk structure */
export const ReceiptSkeleton: React.FC = () => {
  return (
    <div className="pt-desk" aria-busy="true" aria-label="正在加载账本数据">
      <PlatinumWindow title="Ledger · 小票记账本">
        <div className="pt-strip">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: 48,
                height: 20,
                background: '#ccc',
                border: '1px solid #999',
                borderRadius: 3,
              }}
            />
          ))}
        </div>
        <div className="pt-tiles">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="pt-tile">
              <div
                style={{ width: 44, height: 10, background: '#eee', marginBottom: 8 }}
              />
              <div
                style={{ width: 78, height: 18, background: '#ddd', marginBottom: 6 }}
              />
              <div style={{ width: 56, height: 10, background: '#eee' }} />
            </div>
          ))}
        </div>
        <div style={{ height: 196, padding: '16px 12px' }}>
          <div style={{ width: '100%', height: '100%', background: '#f4f4f4', border: '1px solid #ddd' }} />
        </div>
        <div className="pt-statusbar">
          <span>正在加载数据…</span>
          <span>—</span>
        </div>
      </PlatinumWindow>

      <div className="pt-grid">
        <div className="pt-lane">
          <PlatinumWindow title="分类统计 · Categories">
            <div className="pt-rows">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="pt-row">
                  <span className="lab">
                    <span className="bar" style={{ width: `${80 - i * 14}%`, opacity: 0.5 }} />
                  </span>
                  <span className="n" style={{ color: '#bbb' }}>
                    ---
                  </span>
                </div>
              ))}
            </div>
          </PlatinumWindow>
        </div>
        <div className="pt-lane">
          <PlatinumWindow title="成员统计 · Members">
            <div className="pt-rows">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="pt-row">
                  <span className="lab">
                    <span className="bar" style={{ width: `${70 - i * 20}%`, opacity: 0.5 }} />
                  </span>
                  <span className="n" style={{ color: '#bbb' }}>
                    ---
                  </span>
                </div>
              ))}
            </div>
          </PlatinumWindow>
        </div>
      </div>
    </div>
  );
};
