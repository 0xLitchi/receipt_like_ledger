import React, { useEffect, useRef } from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Printer, Download } from 'lucide-react';

interface ReceiptFooterProps {
  stats: SummaryStats;
  onPrint?: () => void;
  onExport?: () => void;
}

export const ReceiptFooter: React.FC<ReceiptFooterProps> = ({
  stats,
  onPrint,
  onExport,
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, 'RECEIPT-LEDGER', {
          format: 'CODE128',
          width: 1.3,
          height: 32,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          margin: 0,
          background: 'transparent',
          lineColor: 'currentColor',
        });
      } catch (err) {
        console.error('Barcode generation error', err);
      }
    }
  }, []);

  return (
    <div className="pt-2 pb-4 px-4 font-mono text-xs select-none">
      <div className="thermal-dashed-line my-3" />

      {/* 统计总计 */}
      <div className="space-y-1 text-right my-2 opacity-95">
        <div className="flex justify-between">
          <span className="opacity-75">交易共计:</span>
          <span className="font-bold">{stats.count} 笔</span>
        </div>

        <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-current/30 mt-2">
          <span>净计:</span>
          <span className={stats.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
            {formatCurrency(stats.netBalance)}
          </span>
        </div>
      </div>

      {/* 条形码与二维码区域 */}
      <div className="flex flex-col items-center justify-center my-4 space-y-2">
        <div className="w-full flex justify-center opacity-80">
          <svg ref={barcodeRef}></svg>
        </div>

        <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded">
          <QRCodeSVG
            value={window.location.href}
            size={48}
            bgColor="transparent"
            fgColor="currentColor"
          />
          <div className="text-[10px] text-left opacity-80 leading-snug">
            <div className="font-bold">购物小票记账联</div>
            <div className="text-[9px] opacity-60">扫码查看或保存</div>
          </div>
        </div>
      </div>

      {/* 打印与导出长图按钮 */}
      <div className="mt-4 flex justify-center gap-3 no-print">
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Printer className="w-3.5 h-3.5" />
          打印小票
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          保存图片
        </button>
      </div>
    </div>
  );
};
