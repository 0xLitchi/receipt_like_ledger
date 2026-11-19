import React, { useEffect, useRef, useState } from 'react';

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

export interface PlatinumSelectOption {
  value: string;
  label: string;
}

interface PlatinumSelectProps {
  value: string;
  options: PlatinumSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
}

/**
 * Classic Mac OS 8/9 Platinum Pop-up Menu —
 * beveled push-button trigger with double-triangle arrow cap and
 * crisp drop-shadowed menu list with checkmark & navy selection highlight.
 */
export const PlatinumSelect: React.FC<PlatinumSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '—',
  disabled = false,
  minWidth = 84,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const isDisabled = disabled || options.length === 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleOpen = () => {
    if (isDisabled) return;
    setOpen((prev) => {
      if (!prev) {
        const idx = options.findIndex((opt) => opt.value === value);
        setHighlightedIdx(idx >= 0 ? idx : 0);
      }
      return !prev;
    });
  };

  const handleSelect = (optValue: string) => {
    setOpen(false);
    if (optValue !== value) {
      onChange(optValue);
    }
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        const idx = options.findIndex((opt) => opt.value === value);
        setHighlightedIdx(idx >= 0 ? idx : 0);
        setOpen(true);
      } else {
        setHighlightedIdx((prev) => {
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          const next = (prev + delta + options.length) % options.length;
          return next;
        });
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (open && highlightedIdx >= 0 && options[highlightedIdx]) {
        e.preventDefault();
        handleSelect(options[highlightedIdx].value);
      }
    }
  };

  return (
    <div ref={wrapRef} className="pt-select-wrap" style={{ minWidth }}>
      <button
        ref={triggerRef}
        type="button"
        className={`pt-select${open ? ' open' : ''}`}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="pt-select-label">{selectedOption ? selectedOption.label : placeholder}</span>
        <span className="pt-select-arrows" aria-hidden="true">
          <svg viewBox="0 0 7 11" width="7" height="11">
            <path d="M3.5 0L7 4H0zM3.5 11L0 7h7z" fill="currentColor" />
          </svg>
        </span>
      </button>

      {open && options.length > 0 && (
        <div className="pt-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIdx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`pt-menu-item${isSelected ? ' selected' : ''}${isHighlighted ? ' highlighted' : ''}`}
                onMouseEnter={() => setHighlightedIdx(idx)}
                onClick={() => handleSelect(opt.value)}
              >
                <span className="pt-menu-check" aria-hidden="true">
                  {isSelected ? '✓' : ''}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
