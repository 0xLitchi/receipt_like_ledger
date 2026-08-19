import { useEffect, useRef } from 'react';
import type Matter from 'matter-js';

interface PaperRainProps {
  enabled: boolean;
  trigger: string; // 月份切换时飘落
}

const PAPER_COLORS = ['#f8fafc', '#e2e8f0', '#fef9c3', '#fce7f3', '#dcfce7', '#e0f2fe'];

// Matter.js 纸片飘落：月份切换时纸片从顶部物理飘落堆叠
export const PaperRain: React.FC<PaperRainProps> = ({ enabled, trigger }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !canvasRef.current) return;
    if (prevRef.current === null) {
      // 首次启用：仅记录当前月份，不触发飘落
      prevRef.current = trigger;
      return;
    }
    if (prevRef.current === trigger) return;
    prevRef.current = trigger;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    import('matter-js').then((MatterModule) => {
      if (disposed) return;
      cleanup = spawnPaper(MatterModule, canvasRef.current!);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [enabled, trigger]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-40" />;
};

function spawnPaper(MatterModule: typeof Matter, canvas: HTMLCanvasElement): () => void {
  const Matter = MatterModule;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  const engine = Matter.Engine.create();
  const world = engine.world;

  // 底部地面（纸片落在屏幕下方）
  const ground = Matter.Bodies.rectangle(width / 2, height + 150, width * 3, 300, {
    isStatic: true,
    friction: 0.6,
    restitution: 0.1,
  });
  Matter.Composite.add(world, ground);

  const pieces: { body: Matter.Body; w: number; h: number; color: string; alpha: number; settled: boolean }[] = [];
  const pieceCount = 14;

  for (let i = 0; i < pieceCount; i++) {
    const w = 26 + Math.random() * 34;
    const h = 14 + Math.random() * 20;
    const body = Matter.Bodies.rectangle(
      width * (0.1 + Math.random() * 0.8),
      -40 - Math.random() * height * 0.4,
      w,
      h,
      {
        angle: Math.random() * Math.PI,
        frictionAir: 0.03,
        restitution: 0.2,
        density: 0.0006,
      }
    );
    Matter.Composite.add(world, body);
    pieces.push({
      body,
      w,
      h,
      color: PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)],
      alpha: 0.95,
      settled: false,
    });
  }

  let rafId = 0;
  const startTime = Date.now();

  const loop = () => {
    Matter.Engine.update(engine, 1000 / 60);
    ctx.clearRect(0, 0, width, height);

    let allSettled = true;
    for (const p of pieces) {
      if (p.body.position.y > height - 60) {
        p.settled = true;
        // 落地后缓慢淡出
        p.alpha = Math.max(0, p.alpha - 0.012);
      }
      if (!p.settled) allSettled = false;

      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.body.position.x, p.body.position.y);
        ctx.rotate(p.body.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000 || allSettled) {
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(rafId);
    Matter.Composite.clear(world, false);
    Matter.Engine.clear(engine);
    ctx.clearRect(0, 0, width, height);
  };
}
