import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type UltraSegmentItem<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  ariaSelected?: boolean;
  role?: 'tab';
};

export function UltraSegmented<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  compact = false,
  className = '',
}: {
  value: T;
  items: UltraSegmentItem<T>[];
  onChange: (next: T, origin?: { x: number; y: number }) => void;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0, ready: false, animate: false });

  useIsoLayoutEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[data-active="true"]');
      if (active && active.offsetWidth > 0) {
        const left = active.offsetLeft;
        const width = active.offsetWidth;
        setThumb((prev) =>
          prev.ready && prev.left === left && prev.width === width
            ? prev
            : { left, width, ready: true, animate: prev.ready },
        );
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value, items.length]);

  const handleClick = (item: UltraSegmentItem<T>, event: MouseEvent<HTMLButtonElement>) => {
    if (item.value === value) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(item.value, {
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
    });
  };

  return (
    <div
      ref={trackRef}
      role={items.some((i) => i.role === 'tab') ? 'tablist' : 'group'}
      aria-label={ariaLabel}
      data-fluid={thumb.ready ? 'true' : undefined}
      className={`ultra-tab-track relative shrink-0 ${className}`}
    >
      {thumb.ready && (
        <span
          aria-hidden="true"
          style={{ width: thumb.width, transform: `translate3d(${thumb.left}px, 0, 0)` }}
          className={`ultra-tab-thumb pointer-events-none absolute top-[2px] bottom-[2px] left-0 rounded-[5px] ${
            thumb.animate ? 'transition-[transform,width] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          }`}
        />
      )}
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role={item.role}
            aria-selected={item.role === 'tab' ? active : undefined}
            aria-pressed={item.role ? undefined : active}
            data-active={active ? 'true' : undefined}
            onClick={(e) => handleClick(item, e)}
            className={`ultra-tab relative z-10 inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 ${
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
