import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  selectedMonth: string;
  transactions: Transaction[];
  hasFullAccess?: boolean;
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  selectedMonth,
  transactions,
  hasFullAccess = true,
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
    <div className="text-center pt-2 pb-1 select-none font-mono">
      {/* 抬头图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1.5 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 月份 YYYY-MM */}
      <div className="text-xs font-bold opacity-90 flex justify-center font-mono my-2 tracking-widest border-y border-dashed border-current/25 py-1">
        <span>{selectedMonth || 'YYYY-MM'}</span>
      </div>

      {/* 分类汇总 (从小到大升序) */}
      {categoryStats.length > 0 && (
        <div className="my-3 py-2 border-y border-dashed border-current/25 text-left font-mono text-[11px] space-y-1 bg-black/[0.02] px-2 rounded">
          <div className="text-[10px] font-black opacity-60 uppercase tracking-wider mb-1.5 border-b border-current/10 pb-0.5 flex justify-between">
            <span>分类汇总</span>
            <span>小计</span>
          </div>
          {categoryStats.map((item) => (
            <div key={item.name} className="flex justify-between items-center opacity-90 font-mono">
              <span className="font-bold">{item.name} <span className="opacity-50 text-[10px]">({item.count})</span></span>
              <span className={`font-black ${item.total > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {hasFullAccess ? formatCurrency(item.total, true) : '￥***.**'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 2. 抽出日期作为子抬头，明细表改为 4 列等宽居中：备注 | 金额 | 成员 | 分类 */}
      <div className="grid grid-cols-4 text-center text-xs font-black border-b-2 border-current pb-1.5 mt-3 opacity-90 font-mono">
        <div>备注</div>
        <div>金额</div>
        <div>成员</div>
        <div>分类</div>
      </div>
    </div>
  );
};
