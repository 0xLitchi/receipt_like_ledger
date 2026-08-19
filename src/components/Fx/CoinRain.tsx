import { useEffect, useRef } from 'react';

interface CoinRainProps {
  enabled: boolean;
}

interface Coin {
  sprite: { x: number; y: number; rotation: number; alpha: number; width: number; height: number };
  vx: number;
  vy: number;
  wobble: number;
  scale: number;
}

// PixiJS 硬币雨：金黄色硬币持续从顶部飘落（低透明度背景层）
export const CoinRain: React.FC<CoinRainProps> = ({ enabled }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    import('pixi.js').then((PIXI) => {
      if (disposed) return;
      cleanup = setupCoinRain(PIXI, containerRef.current!);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [enabled]);

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0" />;
};

function setupCoinRain(PIXI: typeof import('pixi.js'), container: HTMLDivElement): () => void {
  let disposed = false;
  const app = new PIXI.Application();

  app
    .init({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
    })
    .then(() => {
      if (disposed) {
        try { app.destroy(true); } catch { /* noop */ }
        return;
      }
      container.appendChild(app.canvas);
      app.canvas.style.opacity = '0.45';

      // 硬币纹理（金黄色圆 + 内圈 + ¥）
      const coinCanvas = document.createElement('canvas');
      coinCanvas.width = 48;
      coinCanvas.height = 48;
      const g = coinCanvas.getContext('2d');
      if (g) {
        g.arc(24, 24, 22, 0, Math.PI * 2);
        g.fillStyle = '#fbbf24';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#b45309';
        g.stroke();
        g.arc(24, 24, 15, 0, Math.PI * 2);
        g.strokeStyle = '#d97706';
        g.stroke();
        g.fillStyle = '#92400e';
        g.font = 'bold 20px serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('¥', 24, 25);
      }
      const texture = PIXI.Texture.from(coinCanvas);

      const coins: Coin[] = [];
      const count = 46;
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.alpha = 0.5 + Math.random() * 0.5;
        const scale = 0.3 + Math.random() * 0.5;
        sprite.scale.set(scale);
        sprite.x = Math.random() * window.innerWidth;
        sprite.y = -Math.random() * window.innerHeight;
        app.stage.addChild(sprite);
        coins.push({
          sprite,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 0.8 + Math.random() * 1.6,
          wobble: Math.random() * Math.PI * 2,
          scale,
        });
      }

      app.ticker.add((ticker) => {
        for (const c of coins) {
          c.wobble += 0.02;
          c.sprite.x += c.vx + Math.sin(c.wobble) * 0.4;
          c.sprite.y += c.vy * ticker.deltaTime;
          c.sprite.rotation += 0.008 * ticker.deltaTime;
          const sw = c.sprite.width;
          const sh = c.sprite.height;
          if (c.sprite.y > window.innerHeight + sh) {
            c.sprite.y = -sh;
            c.sprite.x = Math.random() * window.innerWidth;
          }
          if (c.sprite.x < -sw) c.sprite.x = window.innerWidth + sw;
          if (c.sprite.x > window.innerWidth + sw) c.sprite.x = -sw;
        }
      });
    });

  return () => {
    disposed = true;
    try {
      app.destroy(true);
    } catch {
      // init 未完成时销毁可能抛错，忽略
    }
  };
}
