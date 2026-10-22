import React from 'react';

/** 小票骨架屏：保留纸张轮廓，内部行占位，避免加载时页面跳动 */
export const ReceiptSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-md mx-auto my-2 animate-pulse no-print" aria-hidden>
      <div className="w-[104%] -ml-[2%] h-9 rounded-t-xl bg-slate-800/80 border border-slate-700/60 mb-[-6px]" />
      <div className="receipt-paper-box receipt-both-sawtooth w-full p-4 sm:p-5 rounded-sm opacity-90">
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-8 h-8 rounded-full bg-black/10" />
          <div className="w-24 h-3 rounded bg-black/10" />
        </div>
        <div className="my-3 border-2 border-black/10 rounded-xl overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-2 px-2 py-2.5 border-b border-black/5 last:border-0"
            >
              <div className="h-2.5 rounded bg-black/10" />
              <div className="h-2.5 rounded bg-black/[0.07]" />
              <div className="h-2.5 rounded bg-black/[0.07]" />
              <div className="h-2.5 rounded bg-black/10" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="h-2.5 w-1/2 ml-auto rounded bg-black/10" />
          <div className="h-2.5 w-2/5 ml-auto rounded bg-black/10" />
        </div>
      </div>
    </div>
  );
};
