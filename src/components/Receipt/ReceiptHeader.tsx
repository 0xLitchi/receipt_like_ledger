import React from 'react';
import type { Transaction } from '../../types';
import { CategorySummary } from './CategorySummary';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  selectedMonth: string;
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  themeStyle?: 'receipt' | 'tractor' | 'passbook' | 'vfd' | 'boarding_pass';
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  themeStyle = 'receipt',
}) => {
  return (
    <div className="text-center pt-1 pb-1 select-none font-pixel tracking-wider">
      {/* 抬头图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 基于 Recharts 的交互式分类汇总 (支持 环形饼图 / 柱状图 / 列表 自由切换与 4 主题配色) */}
      <CategorySummary
        transactions={transactions}
        hasFullAccess={hasFullAccess}
        isPrinting={isPrinting}
        themeStyle={themeStyle}
      />
    </div>
  );
};
