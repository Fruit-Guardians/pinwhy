import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Layers } from 'lucide-react';
import { t } from '../../../i18n';
import {
  shortSectorLabel,
  type UltraFilter,
  type UltraModel,
  type UltraOrbitalBar,
  type UltraSectorView,
} from '../../ultra';
import { perceptualLineWeight, squarify, type Rect, type TileTip } from './treemap/layout';
import { TreemapKpiStrip, TreemapTile } from './treemap/TreemapTile';

type Props = {
  model: UltraModel;
  filter: UltraFilter;
  selectedSector: string | null;
  selectedBarId: string | null;
  drilledSector: string | null;
  onFilterChange: (next: UltraFilter) => void;
  onDrillSector: (sector: string | null) => void;
  onOpenGates: () => void;
  onSelectSector: (sector: string) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
};

export function UltraTreemapView({
  model,
  filter,
  selectedSector,
  selectedBarId,
  drilledSector,
  onFilterChange,
  onDrillSector,
  onOpenGates,
  onSelectSector,
  onSelectBar,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 960, h: 620 });
  const [layoutReady, setLayoutReady] = useState(false);
  const [hoverTip, setHoverTip] = useState<TileTip | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 20 || rect.height < 20) return;
      setSize({ w: rect.width, h: rect.height });
      requestAnimationFrame(() => setLayoutReady(true));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeDrilledView: UltraSectorView | null = drilledSector
    ? model.displaySectorMap.get(drilledSector) ?? model.sectorMap.get(drilledSector) ?? null
    : null;

  const pct = (model.metrics.coverageRatio * 100).toFixed(1);
  const filterActive = filter !== 'all';

  const placedSectors = useMemo(() => {
    if (activeDrilledView) return [];
    const weighted = model.displaySectors.map((sec) => ({
      id: sec.sector,
      weight: Math.max(95, sec.bars.reduce((acc, b) => acc + perceptualLineWeight(b.lines), 0)),
      item: sec,
    }));
    return squarify(weighted, { x: 0, y: 0, w: size.w, h: size.h }, 8);
  }, [activeDrilledView, model.displaySectors, size.w, size.h]);

  const placedDrilledTiles = useMemo(() => {
    if (!activeDrilledView) return [];
    const weighted = activeDrilledView.bars.map((bar) => ({
      id: bar.id,
      weight: perceptualLineWeight(bar.lines),
      item: bar,
    }));
    return squarify(weighted, { x: 0, y: 0, w: size.w, h: size.h }, 6);
  }, [activeDrilledView, size.w, size.h]);

  return (
    <div className="ultra-carbon-grid flex h-full w-full flex-col overflow-hidden">
      <TreemapKpiStrip
        model={model}
        pct={pct}
        filter={filter}
        onFilterChange={onFilterChange}
        onOpenGates={onOpenGates}
      />

      {/* Breadcrumb & Density Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDrillSector(null)}
            className={`ultra-mono inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11.5px] transition-colors ${
              activeDrilledView ? 'text-[var(--u-dim)] hover:text-[var(--u-ink)]' : 'bg-[var(--u-raise-2)] font-semibold text-[var(--u-ink)]'
            }`}
          >
            <Layers className="size-3.5" />
            <span>{t('ultra.treemap.allModules')}</span>
          </button>
          {activeDrilledView && (
            <>
              <span className="ultra-mono text-[var(--u-dim)]">/</span>
              <span className="ultra-mono rounded bg-[var(--u-raise-2)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--u-ink)]">
                {activeDrilledView.sector}
              </span>
              <button
                type="button"
                onClick={() => onDrillSector(null)}
                className="ultra-btn h-6 px-2 text-[11px]"
              >
                <ArrowLeft className="size-3" />
                <span>{t('ultra.treemap.backAll')}</span>
              </button>
            </>
          )}
        </div>
        <span className="text-[11.5px] text-[var(--u-dim)] max-lg:hidden">{t('ultra.treemap.hint')}</span>
      </div>

      {/* 100% Viewport-Fit Treemap Stage */}
      <div ref={hostRef} className="relative mx-4 mb-3 min-h-0 flex-1 overflow-hidden">
        <div key={activeDrilledView ? `drill:${activeDrilledView.sector}` : '__overview__'} className={`relative h-full w-full ${activeDrilledView ? 'ultra-drill-enter' : 'ultra-stage-enter'}`}>
          {activeDrilledView ? (
            placedDrilledTiles.map((tile) => (
              <TreemapTile
                key={tile.id}
                tile={tile}
                multiSlicePaths={model.multiSlicePaths}
                selectedBarId={selectedBarId}
                filterActive={filterActive}
                layoutReady={layoutReady}
                setHoverTip={setHoverTip}
                onSelectBar={onSelectBar}
              />
            ))
          ) : (
            placedSectors.map(({ item: sec, rect }) => {
              if (rect.w < 20 || rect.h < 20) return null;
              const headerH = rect.h < 90 ? 22 : 26;
              const innerH = Math.max(0, rect.h - headerH);
              const bodyRect: Rect = {
                x: 4,
                y: 4,
                w: Math.max(0, rect.w - 8),
                h: Math.max(0, innerH - 8),
              };
              const weightedBars = sec.bars.map((bar) => ({
                id: bar.id,
                weight: perceptualLineWeight(bar.lines),
                item: bar,
              }));
              const innerTiles = squarify(weightedBars, bodyRect, 4);
              const isSecSel = selectedSector === sec.sector;
              const secDimmed = filterActive && !sec.matchesFilter;
              const hasFindings = sec.findingsCount > 0 || sec.flaggedSlices > 0;

              return (
                <section
                  key={sec.sector}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDrillSector(sec.sector);
                  }}
                  className="absolute overflow-hidden rounded-[7px] bg-[var(--u-surface)]"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    border: isSecSel ? '1px solid var(--u-ink-2)' : '1px solid var(--u-line)',
                    opacity: secDimmed ? 0.25 : 1,
                    transition: layoutReady
                      ? 'left 260ms cubic-bezier(0.22,1,0.36,1), top 260ms cubic-bezier(0.22,1,0.36,1), width 260ms cubic-bezier(0.22,1,0.36,1), height 260ms cubic-bezier(0.22,1,0.36,1), opacity 180ms, border-color 160ms'
                      : 'opacity 180ms, border-color 160ms',
                  }}
                >
                  <header
                    className="flex items-center justify-between gap-2 border-b border-[var(--u-line-soft)] px-2.5"
                    style={{ height: headerH }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSector(sec.sector)}
                      className="ultra-mono flex min-w-0 items-center gap-1.5 text-left text-[11px] font-semibold text-[var(--u-ink)] hover:text-[var(--u-mint)]"
                    >
                      <span className="truncate">{shortSectorLabel(sec.sector)}</span>
                      {rect.w >= 175 && (
                        <span className="shrink-0 font-normal text-[var(--u-dim)]">{sec.totalLines}L</span>
                      )}
                    </button>
                    <div className="ultra-mono flex shrink-0 items-center gap-1.5 text-[10px]">
                      <span style={{ color: hasFindings ? 'var(--u-crimson)' : sec.coveredSlices === sec.totalSlices ? 'var(--u-mint)' : 'var(--u-dim)' }}>
                        {sec.coveredSlices}/{sec.totalSlices}
                      </span>
                      {rect.w >= 120 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDrillSector(sec.sector);
                          }}
                          title={t('ultra.treemap.drill')}
                          className="inline-flex items-center rounded border border-[var(--u-line)] bg-[var(--u-raise)] px-1 py-0.2 text-[var(--u-dim)] hover:border-[var(--u-tick)] hover:text-[var(--u-ink)]"
                        >
                          <ArrowUpRight className="size-3" />
                        </button>
                      )}
                    </div>
                  </header>
                  <div className="relative w-full" style={{ height: innerH }}>
                    {innerTiles.map((tile) => (
                      <TreemapTile
                        key={tile.id}
                        tile={tile}
                        compactHeaderOnly={rect.h < 210}
                        multiSlicePaths={model.multiSlicePaths}
                        selectedBarId={selectedBarId}
                        filterActive={filterActive}
                        layoutReady={layoutReady}
                        setHoverTip={setHoverTip}
                        onSelectBar={onSelectBar}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      {hoverTip && (
        <div
          className="ultra-tip"
          style={{
            left: Math.min(window.innerWidth - 328, hoverTip.x + 14),
            top: Math.min(window.innerHeight - 96, hoverTip.y + 14),
            borderLeft: `3px solid ${hoverTip.accent}`,
          }}
        >
          <div className="ultra-mono text-[11.5px] font-semibold text-[var(--u-ink)]">{hoverTip.title}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--u-dim)]">{hoverTip.subtitle}</div>
        </div>
      )}
    </div>
  );
}
