import React, { useEffect, useRef } from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Printer, Download, CheckCircle2, Heart } from 'lucide-react';

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
        JsBarcode(barcodeRef.current, 'LEDGER-2026-CF', {
          format: 'CODE128',
          width: 1.4,
          height: 35,
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
    <div className="pt-4 pb-6 px-4 font-mono text-xs select-none">
      {/* 虚线分割 */}
      <div className="thermal-dashed-line my-3" />

      {/* 汇总列与总笔数 */}
      <div className="space-y-1 text-right my-3 opacity-95">
        <div className="flex justify-between">
          <span className="opacity-75">交易总笔数 (ITEMS):</span>
          <span className="font-bold">{stats.count} 笔</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-75">累计支出:</span>
          <span className="font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(stats.totalExpense)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-75">累计收入:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalIncome)}
          </span>
        </div>

        <div className="thermal-double-line my-2" />

        <div className="flex justify-between text-sm font-black pt-1">
          <span>本期净计 (NET TOTAL):</span>
          <span className={stats.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
            {formatCurrency(stats.netBalance)}
          </span>
        </div>
      </div>

      {/* 状态印章与感谢语 */}
      <div className="flex justify-between items-center my-6 py-2 border-y border-dashed border-current/30">
        <div className="receipt-stamp text-emerald-600 dark:text-emerald-400 text-xs">
          VERIFIED & PAID
        </div>
        <div className="text-right text-[11px] opacity-75">
          <div className="font-bold flex items-center justify-end gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 账目对账完成
          </div>
          <div className="text-[9px] opacity-60">CLOUDFLARE PAGES D1 ENGINE</div>
        </div>
      </div>

      {/* 条形码与二维码区域 */}
      <div className="flex flex-col items-center justify-center my-4 space-y-3">
        {/* 条形码 */}
        <div className="w-full flex justify-center opacity-85">
          <svg ref={barcodeRef}></svg>
        </div>

        {/* 二形码 + 标语 */}
        <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded">
          <QRCodeSVG
            value={window.location.href}
            size={54}
            bgColor="transparent"
            fgColor="currentColor"
          />
          <div className="text-[10px] text-left opacity-80 leading-snug">
            <div className="font-bold">扫描或保存小票联</div>
            <div>荔枝 & 扶正 专属记账</div>
            <div className="flex items-center gap-1 text-[9px] opacity-60 mt-1">
              <span>THANK YOU FOR SAVING</span>
              <Heart className="w-2.5 h-2.5 text-rose-500 fill-current" />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[10px] opacity-50 mt-4 font-mono">
        *** THANK YOU FOR YOUR VISIT ***
      </div>

      {/* 操作按钮 (非打印模式) */}
      <div className="mt-6 flex justify-center gap-3 no-print">
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity shadow"
        >
          <Printer className="w-3.5 h-3.5" />
          物理打印小票
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 transition-colors shadow"
        >
          <Download className="w-3.5 h-3.5" />
          保存小票长图
        </button>
      </div>
    </div>
  );
};
