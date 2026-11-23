import { t } from '../../../../i18n';
import type { UltraFilter, UltraModel, UltraOrbitalBar } from '../../../ultra';
import { formatTileTitle, tileTone, type PlacedItem, type TileTip } from './layout';

export function TreemapKpiStrip({
  model,
  pct,
  filter,
  onFilterChange,
  onOpenGates,
}: {
  model: UltraModel;
  pct: string;
  filter: UltraFilter;
  onFilterChange: (next: UltraFilter) => void;
  onOpenGates: () => void;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 border-b border-[var(--u-line)] bg-[var(--u-surface)] md:grid-cols-5">
      <button
        type="button"
        onClick={() => onFilterChange('all')}
        className={`flex flex-col justify-center border-r border-[var(--u-line-soft)] px-4 py-2 text-left transition-colors hover:bg-[var(--u-raise)] ${
          filter === 'all' ? 'bg-[var(--u-raise)]/65' : ''
        }`}
      >
        <span className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.kpi.coverage')}</span>
        <span className="ultra-mono mt-0.5 text-[15px] font-semibold text-[var(--u-mint)]">
          {pct}% <span className="text-[11px] font-normal text-[var(--u-dim)]">({model.metrics.clearedSlices}/{model.metrics.totalSlices})</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onFilterChange(filter === 'zero-node' ? 'all' : 'zero-node')}
        className={`flex flex-col justify-center border-r border-[var(--u-line-soft)] px-4 py-2 text-left transition-colors hover:bg-[var(--u-raise)] ${
          filter === 'zero-node' ? 'bg-[var(--u-raise)] ring-1 ring-inset ring-[var(--u-mint)]/50' : ''
        }`}
      >
        <span className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.kpi.zeroNode')}</span>
        <span className="ultra-mono mt-0.5 text-[15px] font-semibold text-[var(--u-ink)]">
          {model.metrics.zeroNodeCleared} <span className="text-[11px] font-normal text-[var(--u-dim)]">/ {model.metrics.clearedSlices} {t('ultra.kpi.zeroNodeSub')}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onFilterChange(filter === 'hits' ? 'all' : 'hits')}
        className={`flex flex-col justify-center border-r border-[var(--u-line-soft)] px-4 py-2 text-left transition-colors hover:bg-[var(--u-raise)] ${
          filter === 'hits' ? 'bg-[var(--u-raise)] ring-1 ring-inset ring-[var(--u-crimson)]/50' : ''
        }`}
      >
        <span className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.kpi.hits')}</span>
        <span className="ultra-mono mt-0.5 text-[15px] font-semibold text-[var(--u-crimson)]">
          {model.metrics.flaggedSlices} <span className="text-[11px] font-normal text-[var(--u-dim)]">→ {model.metrics.boardNodesCount} {t('ultra.kpi.hitsSub')}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenGates}
        className="flex flex-col justify-center border-r border-[var(--u-line-soft)] px-4 py-2 text-left transition-colors hover:bg-[var(--u-raise)]"
      >
        <span className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.kpi.shallow')}</span>
        <span className="ultra-mono mt-0.5 truncate text-[15px] font-semibold text-[var(--u-amber)]">
          {model.metrics.shallowSlices} <span className="text-[11px] font-normal text-[var(--u-dim)]">({model.gaps.shallowSlices[0]?.id ? `${model.gaps.shallowSlices[0].id} · ${model.gaps.shallowSlices[0].unverifiedDependencies?.join(',') || model.gaps.shallowSlices[0].reason || ''}` : t('ultra.gate.clear')})</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onFilterChange(filter === 'blind' ? 'all' : 'blind')}
        className={`flex flex-col justify-center px-4 py-2 text-left transition-colors hover:bg-[var(--u-raise)] max-md:hidden ${
          filter === 'blind' ? 'bg-[var(--u-raise)] ring-1 ring-inset ring-[var(--u-amber)]/40' : ''
        }`}
      >
        <span className="ultra-mono text-[10px] uppercase tracking-wider text-[var(--u-dim)]">{t('ultra.kpi.pending')}</span>
        <span className="ultra-mono mt-0.5 text-[15px] font-semibold text-[var(--u-ink-2)]">
          {model.metrics.pendingSlices} <span className="text-[11px] font-normal text-[var(--u-dim)]">({model.metrics.pendingLines.toLocaleString()}L)</span>
        </span>
      </button>
    </div>
  );
}

export function TreemapTile({
  tile,
  compactHeaderOnly,
  multiSlicePaths,
  selectedBarId,
  filterActive,
  layoutReady,
  setHoverTip,
  onSelectBar,
}: {
  tile: PlacedItem<UltraOrbitalBar>;
  compactHeaderOnly?: boolean;
  multiSlicePaths: Set<string>;
  selectedBarId: string | null;
  filterActive: boolean;
  layoutReady: boolean;
  setHoverTip: (tip: TileTip | null | ((prev: TileTip | null) => TileTip | null)) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
}) {
  const { item: bar, rect } = tile;
  if (rect.w < 6 || rect.h < 6) return null;
  const tone = tileTone(bar);
  const { title: cleanTitle, isTest } = formatTileTitle(bar, multiSlicePaths);
  const isSel = selectedBarId === bar.id;
  const dimmed = filterActive && !bar.matchesFilter;
  const showBadge = rect.w >= 112 && rect.h >= 38;
  const showMeta = rect.w >= 76 && rect.h >= 34;
  const noteText = bar.sublabel && bar.sublabel !== `${bar.lines}L` ? bar.sublabel : '';
  const showNote = !compactHeaderOnly && rect.w >= 154 && rect.h >= 72 && Boolean(noteText);
  const badgeLabel = bar.nodeIds.length > 0
    ? bar.nodeIds.slice(0, 2).join(', ')
    : bar.slice?.kind === 'probe'
      ? 'probe'
      : bar.status === 'excluded'
        ? t('ultra.sliceStatus.excluded')
        : tone.zeroNode
          ? t('ultra.treemap.zeroBadge')
          : bar.status === 'shallow'
            ? 'shallow'
            : isTest
              ? 'test'
              : `${bar.lines}L`;

  return (
    <button
      type="button"
      onMouseEnter={(e) => setHoverTip({
        x: e.clientX,
        y: e.clientY,
        title: bar.label,
        subtitle: `${t(`ultra.sliceStatus.${bar.status}`)} · ${bar.slice?.kind === 'probe' ? 'probe' : `${bar.lines}L`}${noteText ? ` — ${noteText}` : ''}`,
        accent: tone.accent,
      })}
      onMouseMove={(e) => setHoverTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
      onMouseLeave={() => setHoverTip(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBar(bar);
      }}
      className={`absolute flex flex-col justify-between overflow-hidden rounded-[5px] text-left hover:z-10 hover:-translate-y-[1px] ${
        tone.pending ? 'ultra-tile-pending' : ''
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        padding: rect.h < 42 ? '3px 6px' : '6px 8px',
        backgroundColor: tone.pending ? undefined : tone.bg,
        border: isSel ? '2px solid var(--u-ink)' : `1px solid ${tone.border}`,
        boxShadow: isSel ? '0 0 0 1px var(--u-sel-ring)' : undefined,
        opacity: dimmed && !isSel ? 0.2 : 1,
        transition: layoutReady
          ? 'left 260ms cubic-bezier(0.22,1,0.36,1), top 260ms cubic-bezier(0.22,1,0.36,1), width 260ms cubic-bezier(0.22,1,0.36,1), height 260ms cubic-bezier(0.22,1,0.36,1), opacity 160ms, transform 140ms, border-color 140ms, box-shadow 140ms'
          : 'opacity 160ms, transform 140ms, border-color 140ms',
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <span
          className="ultra-mono truncate text-[11px] font-semibold"
          style={{ color: bar.status === 'pending' ? 'var(--u-dim)' : 'var(--u-ink)' }}
        >
          {cleanTitle}
        </span>
        {showBadge && (
          <span className="ultra-mono shrink-0 text-[10px]" style={{ color: tone.accent }}>
            {badgeLabel}
          </span>
        )}
      </div>

      {showNote && (
        <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-[var(--u-ink-2)]/85">
          {noteText}
        </div>
      )}

      {showMeta && (
        <div className="ultra-mono mt-auto flex items-center justify-between gap-1 pt-0.5 text-[9.5px] text-[var(--u-dim)]">
          <span className="truncate">{bar.kind === 'slice' ? `${bar.id}${isTest ? ' · test' : ''}` : bar.id}</span>
          {rect.w >= 110 && <span className="shrink-0">{bar.lines ? `${bar.lines}L` : ''}</span>}
        </div>
      )}
    </button>
  );
}
