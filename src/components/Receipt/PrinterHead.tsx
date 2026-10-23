import React from 'react';
import { motion } from 'framer-motion';
import type { AccessMode } from '../../types';

interface PrinterHeadProps {
  /** 是否正在打印（震动 + 指示灯常亮） */
  isPrinting: boolean;
  mode: AccessMode;
}

/** 不同权限下的指示灯配色 */
const LED: Record<AccessMode, { on: string; off: string; glow: string }> = {
  admin: { on: '#10b981', off: '#0f5132', glow: 'rgba(16,185,129,0.85)' },
  decrypted: { on: '#3b82f6', off: '#1e3a8a', glow: 'rgba(59,130,246,0.85)' },
  masked: { on: '#f43f5e', off: '#7f1d1d', glow: 'rgba(244,63,94,0.85)' },
};

/**
 * 拟物白色热敏打印机机头。
 *
 * 用多层渐变模拟米白色亚克力外壳：顶面高光、侧边阴影、底部出纸槽；
 * 细节包括散热格栅、电源/状态指示灯、品牌铭牌与两颗固定螺丝。
 * 打印时整机轻微震动、指示灯呼吸。
 */
export const PrinterHead: React.FC<PrinterHeadProps> = ({ isPrinting, mode }) => {
  const led = LED[mode];

  return (
    <div className="relative z-30 w-[104%] no-print mb-[-6px] select-none">
      {/* 机身主体 */}
      <motion.div
        className="relative rounded-t-2xl overflow-hidden"
        animate={isPrinting ? { y: [0, -0.6, 0.4, 0] } : { y: 0 }}
        transition={isPrinting ? { duration: 0.14, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
        style={{
          background:
            'linear-gradient(180deg, #fbf6e9 0%, #f3ecd9 42%, #e6dcc4 72%, #d6cab0 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 3px rgba(0,0,0,0.10), ' +
            '0 1px 0 rgba(255,255,255,0.6), 0 10px 24px -8px rgba(0,0,0,0.55)',
        }}
      >
        {/* 顶部圆角高光 */}
        <div
          className="absolute inset-x-0 top-0 h-3 rounded-t-2xl pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))' }}
        />

        {/* 左右侧边渐变：让机头看起来是弧面而非平板 */}
        <div
          className="absolute inset-y-0 left-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0))' }}
        />
        <div
          className="absolute inset-y-0 right-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(270deg, rgba(0,0,0,0.10), rgba(0,0,0,0))' }}
        />

        <div className="relative px-3.5 pt-2.5 pb-3 flex items-center gap-3">
          {/* 左侧：散热格栅 */}
          <div className="flex items-center gap-[3px] opacity-70">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="block w-[2px] h-3 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #c9c0aa, #aa9f88)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              />
            ))}
          </div>

          {/* 中间：品牌铭牌 */}
          <div className="flex-1 min-w-0 text-center">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full"
              style={{
                background: 'linear-gradient(180deg, #ffffff, #efe8d7)',
                boxShadow: 'inset 0 1px 0 #fff, inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.06)',
              }}
            >
              <span
                className="block w-1.5 h-1.5 rounded-full"
                style={{ background: '#8d8570', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.3)' }}
              />
              <span className="text-[9px] font-bold tracking-[0.22em] text-[#8d8570]">THERMAL</span>
            </div>
          </div>

          {/* 右侧：电源 + 状态指示灯 */}
          <div className="flex items-center gap-2.5 pr-1">
            {/* 电源键 */}
            <span
              className="grid place-items-center w-3.5 h-3.5 rounded-full"
              style={{
                background: 'linear-gradient(180deg, #f9f4e8, #ded5c0)',
                boxShadow: 'inset 0 1px 0 #fff, 0 1px 1.5px rgba(0,0,0,0.25)',
              }}
            >
              <span className="block w-1.5 h-1.5 rounded-full border border-[#b5ab94]" />
            </span>

            {/* 状态灯：打印时呼吸，否则常亮 */}
            <motion.span
              className="block w-2 h-2 rounded-full"
              animate={
                isPrinting
                  ? { opacity: [1, 0.35, 1], scale: [1, 0.9, 1] }
                  : { opacity: 1, scale: 1 }
              }
              transition={isPrinting ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              style={{
                background: `radial-gradient(circle at 35% 30%, #fff 0%, ${led.on} 45%, ${led.off} 100%)`,
                boxShadow: `0 0 6px ${led.glow}, inset 0 0 1px rgba(255,255,255,0.9)`,
              }}
            />
          </div>
        </div>

        {/* 螺丝细节 */}
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 30%, #fff, #cdc4ad 60%, #a79c85)', boxShadow: 'inset 0 0 1px rgba(0,0,0,0.4)' }}
        />
        <span
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 30%, #fff, #cdc4ad 60%, #a79c85)', boxShadow: 'inset 0 0 1px rgba(0,0,0,0.4)' }}
        />

        {/* 出纸槽：深色凹槽，纸张从这里进出 */}
        <div
          className="relative mx-3 h-[7px] rounded-[2px]"
          style={{
            background: 'linear-gradient(180deg, #b6b1a8 0%, #6f6a62 28%, #2b2823 100%)',
            boxShadow:
              'inset 0 2px 3px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(255,255,255,0.25), 0 1px 0 rgba(255,255,255,0.7)',
          }}
        />
      </motion.div>

      {/* 机身底部的落地阴影 */}
      <div
        className="h-1.5 rounded-b-[3px]"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))',
          filter: 'blur(1px)',
        }}
      />
    </div>
  );
};
