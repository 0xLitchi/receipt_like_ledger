import React from 'react';

interface SlotNumberProps {
  text: string;
  animate: boolean;
  delayMs?: number;
  durationMs?: number;
}

/**
 * 为某个数字位生成确定性的老虎机滚轮序列（以目标数字结尾）。
 * 使用纯确定性步进避免渲染期随机数导致的水合/严格模式抖动。
 */
function buildDigitReel(targetDigit: number, steps: number, seed: number): number[] {
  const reel: number[] = [];
  const start = (targetDigit + 3 + seed * 7) % 10;
  for (let i = 0; i < steps - 1; i++) {
    reel.push((start + i * 3 + (i % 2)) % 10);
  }
  reel.push(targetDigit);
  return reel;
}

/**
 * 老虎机风格数字滚动组件：
 * - 页面初次进入时，每个数字位独立纵向高速滚动并从左到右依次刹停落位；
 * - 动画结束后退化为纯文本渲染，无持续 DOM/动画开销，也不影响复制与排版。
 */
export const SlotNumber: React.FC<SlotNumberProps> = ({
  text,
  animate,
  delayMs = 0,
  durationMs = 540,
}) => {
  if (!animate || !/\d/.test(text)) {
    return <>{text}</>;
  }

  let digitIdx = 0;

  return (
    <span className="pt-slot-num" aria-label={text}>
      {Array.from(text).map((ch, charIdx) => {
        if (ch < '0' || ch > '9') {
          return (
            <span key={charIdx} className="pt-slot-static" aria-hidden="true">
              {ch}
            </span>
          );
        }

        const currentDigitIdx = digitIdx;
        digitIdx += 1;

        const target = Number(ch);
        const steps = 10 + Math.min(currentDigitIdx, 7) * 2;
        const reel = buildDigitReel(target, steps, currentDigitIdx + charIdx);
        const itemDelay = delayMs + currentDigitIdx * 38;
        const itemDuration = durationMs + currentDigitIdx * 45;

        const reelStyle = {
          '--slot-end': `${-(steps - 1) * 1.2}em`,
          '--slot-dur': `${itemDuration}ms`,
          '--slot-delay': `${itemDelay}ms`,
        } as React.CSSProperties;

        return (
          <span key={charIdx} className="pt-slot-window" aria-hidden="true">
            <span className="pt-slot-reel" style={reelStyle}>
              {reel.map((d, rIdx) => (
                <span key={rIdx} className="pt-slot-digit">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};
