import React from 'react';

interface PlatinumWindowProps {
  title: string;
  onClose?: () => void;
  closeTitle?: string;
  className?: string;
  frameClassName?: string;
  children: React.ReactNode;
}

/**
 * Classic Mac OS 8/9 Platinum window chrome —
 * crisp 1px #262626 outline, 2px hard drop shadow, pinstripe titlebar,
 * optional beveled close box, and sunken white content frame.
 */
export const PlatinumWindow: React.FC<PlatinumWindowProps> = ({
  title,
  onClose,
  closeTitle = '关闭',
  className = '',
  frameClassName = '',
  children,
}) => {
  return (
    <section className={`pt-window ${className}`}>
      <div className="pt-titlebar">
        {onClose && (
          <button
            type="button"
            className="pt-tbox"
            onClick={onClose}
            title={closeTitle}
            aria-label={closeTitle}
          />
        )}
        <span className="pt-stripe" aria-hidden="true" />
        <span className="pt-title">{title}</span>
        <span className="pt-stripe" aria-hidden="true" />
      </div>
      <div className={`pt-frame ${frameClassName}`}>{children}</div>
    </section>
  );
};

interface PixelDotProps {
  color: string;
  title?: string;
}

/**
 * 12x12 pixel orb copied verbatim from exe.v2core.com/stats Live rows:
 * dark #262626 pixel outline, white specular glint, customizable fill.
 */
export const PixelDot: React.FC<PixelDotProps> = ({ color, title }) => (
  <svg
    className="pt-dot"
    viewBox="0 0 12 12"
    width="12"
    height="12"
    aria-hidden={!title}
  >
    {title && <title>{title}</title>}
    <path
      className="f"
      style={{ fill: color }}
      d="M4 1h4v1h-4zM2 2h8v2h-8zM1 4h10v4h-10zM2 8h8v2h-8zM4 10h4v1h-4z"
    />
    <path className="w" d="M3 2h1v1h-1zM2 3h1v1h-1z" />
    <path
      className="k"
      d="M4 0h4v1h-4zM2 1h2v1h-2zM8 1h2v1h-2zM1 2h1v2h-1zM10 2h1v2h-1zM0 4h1v4h-1zM11 4h1v4h-1zM1 8h1v2h-1zM10 8h1v2h-1zM2 10h2v1h-2zM8 10h2v1h-2zM4 11h4v1h-4z"
    />
  </svg>
);
