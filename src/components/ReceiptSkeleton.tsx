import React from 'react';
import { PlatinumWindow } from './Platinum/PlatinumChrome';

/** Platinum Desktop loading skeleton matching LedgerDesk structure */
export const ReceiptSkeleton: React.FC = () => {
  return (
    <div className="pt-desk" aria-busy="true" aria-label="正在加载账本数据">
      <PlatinumWindow title="Ledger">
        <div className="pt-strip">
          {[96, 88, 74].map((w, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: w,
                height: 22,
                background: '#ccc',
                border: '1px solid #999',
                borderRadius: 3,
              }}
            />
          ))}
        </div>
        <div className="pt-tiles">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="pt-tile">
              <div
                style={{ width: 44, height: 10, background: '#eee', marginBottom: 8 }}
              />
              <div
                style={{ width: 78, height: 18, background: '#ddd' }}
              />
            </div>
          ))}
        </div>
      </PlatinumWindow>

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
  );
};
