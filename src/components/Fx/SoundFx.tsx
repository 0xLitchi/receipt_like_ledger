import { useEffect, useRef } from 'react';
import { soundFx } from '../../utils/soundFx';

interface SoundFxProps {
  enabled: boolean;
  trigger: string; // 月份切换触发打印音效
}

// 拟物音效：全局启用状态 + 月份切换/按键触发
export const SoundFx: React.FC<SoundFxProps> = ({ enabled, trigger }) => {
  const prevRef = useRef(trigger);

  useEffect(() => {
    soundFx.setEnabled(enabled);
  }, [enabled]);

  // 月份切换 → 针式打印声
  useEffect(() => {
    if (!enabled) {
      prevRef.current = trigger;
      return;
    }
    if (prevRef.current !== '' && prevRef.current !== trigger) {
      soundFx.playPrint();
    }
    prevRef.current = trigger;
  }, [trigger, enabled]);

  // "." 按键呼出后台 → 收银机声
  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === '.' || e.code === 'Period' || e.code === 'NumpadDecimal') {
        soundFx.playCash();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled]);

  return null;
};
