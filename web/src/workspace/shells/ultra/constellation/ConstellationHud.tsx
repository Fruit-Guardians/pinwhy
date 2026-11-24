import { LocateFixed, Minus, MousePointer, Plus, ZoomIn } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { t } from '../../../../i18n';
import type { UltraFilter, UltraModel } from '../../../ultra';
import type { HoverTip } from './geometry';

export function ConstellationTopHud({
  model,
  filter,
  c1Count,
  c2Count,
  c3Count,
  s2Count,
  onFilterChange,
  onOpenGates,
}: {
  model: UltraModel;
  filter: UltraFilter;
  c1Count: number;
  c2Count: number;
  c3Count: number;
  s2Count: number;
  onFilterChange: (next: UltraFilter) => void;
  onOpenGates: () => void;
}) {
  const filterChips: { id: UltraFilter; label: string; count?: number; tone?: string }[] = [
    { id: 'all', label: t('ultra.filter.all') },
    { id: 'zero-node', label: t('ultra.filter.zeroNode'), count: model.metrics.zeroNodeCleared, tone: 'var(--u-mint)' },
    { id: 'hits', label: t('ultra.filter.hits'), count: model.metrics.flaggedSlices, tone: 'var(--u-crimson)' },
    { id: 'blind', label: t('ultra.filter.blind'), count: model.metrics.shallowSlices + model.metrics.pendingSlices, tone: 'var(--u-amber)' },
    { id: 'human', label: t('ultra.filter.human'), count: model.metrics.humanSignals, tone: 'var(--u-cyan)' },
  ];

  return (
    <div className="pointer-events-none absolute top-3.5 right-4 left-4 z-20 flex flex-wrap items-center justify-between gap-2">
      <div data-hud-control="true" className="ultra-glass-pill pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-1.5">
        <span className="ultra-mono text-sm font-bold text-[var(--u-mint)]">{(model.metrics.coverageRatio * 100).toFixed(1)}%</span>
        <span className="ultra-mono text-xs text-[var(--u-dim)]">
          {model.metrics.clearedSlices}/{model.metrics.totalSlices} {t('ultra.metric.slices')}
        </span>
        <span className="h-3.5 w-px bg-[var(--u-line)]" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterChange(chip.id)}
                className={`ultra-mono inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                  active
                    ? 'bg-[var(--u-raise-2)] text-[var(--u-ink)] ring-1 ring-[var(--u-cyan)]/50'
                    : 'text-[var(--u-dim)] hover:text-[var(--u-ink)]'
                }`}
              >
                {chip.tone && <span className="size-1.5 rounded-full" style={{ background: chip.tone }} />}
                <span>{chip.label}</span>
                {chip.count !== undefined && <span className="opacity-80">{chip.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div data-hud-control="true" className="ultra-glass-pill pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          data-state={c1Count > 0 ? 'crit' : 'ok'}
          onClick={onOpenGates}
          title={t('ultra.gate.c1')}
          className="ultra-gate-pill"
        >
          <span>C1</span>
          <span className="max-xl:hidden">{t('ultra.gateChip.c1')}</span>
          <strong>{c1Count}</strong>
        </button>
        <button
          type="button"
          data-state={c2Count > 0 ? 'warn' : 'ok'}
          onClick={onOpenGates}
          title={t('ultra.gate.c2')}
          className="ultra-gate-pill"
        >
          <span>C2</span>
          <span className="max-xl:hidden">{t('ultra.gateChip.c2')}</span>
          <strong>{c2Count}</strong>
        </button>
        <button
          type="button"
          data-state={c3Count > 0 ? 'crit' : 'ok'}
          onClick={onOpenGates}
          title={t('ultra.gate.c3')}
          className="ultra-gate-pill"
        >
          <span>C3</span>
          <span className="max-xl:hidden">{t('ultra.gateChip.c3')}</span>
          <strong>{c3Count}</strong>
        </button>
        <span className="h-3 w-px bg-[var(--u-line)]" aria-hidden="true" />
        <button
          type="button"
          data-state={s2Count > 0 ? 'human' : 'idle'}
          onClick={onOpenGates}
          title={t('ultra.gate.s2')}
          className="ultra-gate-pill"
        >
          <span>S2</span>
          <span className="max-xl:hidden">{t('ultra.gateChip.s2')}</span>
          <strong>{s2Count}</strong>
        </button>
      </div>
    </div>
  );
}

export function ConstellationZoomBar({
  zoomPct,
  wheelMode,
  showZoomSlider = false,
  onZoomIn,
  onZoomOut,
  onZoomToPct,
  onFit,
  onToggleWheelMode,
}: {
  zoomPct: number;
  wheelMode: 'pan' | 'zoom';
  showZoomSlider?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToPct?: (pct: number) => void;
  onFit: () => void;
  onToggleWheelMode: () => void;
}) {
  return (
    <div data-hud-control="true" className="absolute bottom-3.5 left-4 z-20 flex flex-wrap items-center gap-2">
      <div className="ultra-glass-pill flex items-center gap-1 p-1">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="ultra-btn h-7 w-7 justify-center border-0 p-0"
        >
          <Minus className="size-3.5" />
        </button>
        {showZoomSlider && (
          <Slider
            aria-label={t('settings.showZoomSlider')}
            min={45}
            max={450}
            step={5}
            value={[zoomPct]}
            onValueChange={(next) => onZoomToPct?.(next[0])}
            className="w-24 px-1 max-sm:hidden"
          />
        )}
        <span className="ultra-mono min-w-[44px] text-center text-[11px] text-[var(--u-ink-2)]">{zoomPct}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="ultra-btn h-7 w-7 justify-center border-0 p-0"
        >
          <Plus className="size-3.5" />
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-[var(--u-line)]" aria-hidden="true" />
        <button
          type="button"
          onClick={onFit}
          className="ultra-btn h-7 border-0 px-2 text-[11px]"
        >
          <LocateFixed className="size-3" />
          <span>{t('ultra.zoom.fit')}</span>
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-[var(--u-line)]" aria-hidden="true" />
        <button
          type="button"
          onClick={onToggleWheelMode}
          className={`ultra-btn h-7 border-0 px-2 text-[11px] ${wheelMode === 'zoom' ? 'text-[var(--u-cyan)]' : ''}`}
          title={t('ultra.zoom.gestureHint')}
        >
          {wheelMode === 'pan' ? <MousePointer className="size-3" /> : <ZoomIn className="size-3" />}
          <span>{wheelMode === 'pan' ? t('ultra.zoom.wheelPan') : t('ultra.zoom.wheelZoom')}</span>
        </button>
      </div>
      <div className="ultra-glass-pill hidden px-2.5 py-1.5 text-[11px] text-[var(--u-dim)] xl:block">
        {t('ultra.zoom.gestureHint')}
      </div>
    </div>
  );
}

export function ConstellationTooltip({ tip }: { tip: HoverTip }) {
  return (
    <div
      className="ultra-tip"
      style={{
        left: Math.min(window.innerWidth - 328, tip.x + 14),
        top: Math.min(window.innerHeight - 96, tip.y + 14),
        borderLeft: `3px solid ${tip.accent || 'var(--u-cyan)'}`,
      }}
    >
      <div className="ultra-mono text-[11.5px] font-semibold text-[var(--u-ink)]">{tip.title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-[var(--u-dim)]">{tip.subtitle}</div>
    </div>
  );
}
