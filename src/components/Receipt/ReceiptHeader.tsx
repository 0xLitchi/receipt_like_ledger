import React from 'react';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  selectedMonth: string;
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
}) => {
  // 分类汇总：按数值从小到大 (Ascending) 排序
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const prev = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: prev.total + (hasFullAccess ? t.amount : 0),
        count: prev.count + 1,
      });
    });

    const list = Array.from(map.entries()).map(([name, stat]) => ({
      name,
      total: stat.total,
      count: stat.count,
    }));

    return list.sort((a, b) => a.total - b.total);
  }, [transactions, hasFullAccess]);

  return (
    <div className="text-center pt-1 pb-1 select-none font-pixel tracking-wider">
      {/* 抬头图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 分类汇总 */}
      {categoryStats.length > 0 && (
        <div className="my-2 py-2 border-y-2 border-dashed border-current/30 text-left font-pixel text-xs space-y-1 bg-black/[0.02] px-2.5 rounded-sm">
          <div className="text-[11px] font-black opacity-70 uppercase tracking-widest mb-1 border-b border-current/15 pb-0.5 flex justify-between">
            <span>分类汇总</span>
            <span>小计</span>
          </div>
          {categoryStats.map((item) => (
            <div key={item.name} className="flex justify-between items-center opacity-95 font-pixel text-xs">
              <span className="font-bold">{item.name} <span className="opacity-60 text-[10px]">({item.count})</span></span>
              <span className="font-black tracking-tight">
                <AnimatedNumber
                  value={item.total}
                  hasFullAccess={hasFullAccess}
                  isPrinting={isPrinting}
                  className={item.total > 0 ? 'text-emerald-700' : 'text-rose-700'}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 表头居中对齐：备注 | 金额 | 成员 | 分类 */}
      <div className="grid grid-cols-4 text-center text-xs font-black border-b-2 border-current pb-1 mt-2 opacity-95 font-pixel tracking-widest uppercase">
        <div>备注</div>
        <div>金额</div>
        <div>成员</div>
        <div>分类</div>
      </div>
    </div>
  );
};
