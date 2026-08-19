// 拟物音效：用程序合成 WAV data URI，通过 Howler 播放（零素材文件）
import type { Howl } from 'howler';

const SAMPLE_RATE = 44100;

// 确定性伪随机（避免每次生成不同波形）
const hashNoise = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const synthWav = (render: (t: number) => number, durationSec: number): string => {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const dataSize = n * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, dataSize, true);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const sample = Math.max(-1, Math.min(1, render(t)));
    v.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
};

// 各音效波形
const WAV = {
  // 收银机 "叮"
  cash: synthWav((t) => {
    const env = Math.exp(-t * 6);
    return (Math.sin(2 * Math.PI * 1568 * t) * 0.5 + Math.sin(2 * Math.PI * 2093 * t) * 0.5) * env;
  }, 0.5),
  // 针式打印 "嗒嗒嗒"
  print: synthWav((t) => {
    const env = Math.max(0, 1 - t / 0.35);
    const pulse = hashNoise(Math.floor(t * 2200)) * (0.6 + 0.4 * hashNoise(Math.floor(t * 500)));
    return (pulse * 2 - 1) * env * 0.35;
  }, 0.35),
  // 按键 "咔哒"
  click: synthWav((t) => {
    const env = Math.exp(-t * 60);
    return Math.sin(2 * Math.PI * 950 * t) * env * 0.5;
  }, 0.08),
  // 硬币落地 "叮铃"
  coin: synthWav((t) => {
    const env = Math.exp(-t * 10);
    const wobble = 1 + 0.06 * Math.sin(2 * Math.PI * 22 * t);
    return Math.sin(2 * Math.PI * 2350 * wobble * t) * env * 0.45;
  }, 0.5),
};

let enabled = true;
let sounds: Record<keyof typeof WAV, Howl> | null = null;
let loadPromise: Promise<void> | null = null;

const ensureLoaded = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = import('howler').then(({ Howl }) => {
      sounds = {
        cash: new Howl({ src: [WAV.cash] }),
        print: new Howl({ src: [WAV.print] }),
        click: new Howl({ src: [WAV.click] }),
        coin: new Howl({ src: [WAV.coin] }),
      };
    });
  }
  return loadPromise;
};

const play = async (name: keyof typeof WAV): Promise<void> => {
  if (!enabled) return;
  try {
    await ensureLoaded();
    sounds?.[name].play();
  } catch (e) {
    console.warn(`Failed to play ${name} sound`, e);
  }
};

export const soundFx = {
  setEnabled(value: boolean) {
    enabled = value;
  },
  playCash: () => play('cash'),
  playPrint: () => play('print'),
  playClick: () => play('click'),
  playCoin: () => play('coin'),
};
