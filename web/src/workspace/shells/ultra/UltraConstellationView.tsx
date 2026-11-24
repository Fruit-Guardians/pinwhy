import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../../i18n';
import type { UltraFilter, UltraModel, UltraOrbitalBar } from '../../ultra';
import { ConstellationChords } from './constellation/ConstellationChords';
import { ConstellationTooltip, ConstellationTopHud, ConstellationZoomBar } from './constellation/ConstellationHud';
import { ConstellationSectors } from './constellation/ConstellationSectors';
import {
  CX,
  CY,
  STAGE_H,
  STAGE_W,
  computeAdjustedLabels,
  computeFitView,
  type HoverTip,
} from './constellation/geometry';

type Props = {
  model: UltraModel;
  filter: UltraFilter;
  selectedSector: string | null;
  selectedBarId: string | null;
  selectedNodeId: string | null;
  resetSignal: number;
  showZoomSlider?: boolean;
  onFilterChange: (next: UltraFilter) => void;
  onOpenGates: () => void;
  onSelectSector: (sector: string) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
  onClearSelection: () => void;
};

export function UltraConstellationView({
  model,
  filter,
  selectedSector,
  selectedBarId,
  selectedNodeId,
  resetSignal,
  showZoomSlider = false,
  onFilterChange,
  onOpenGates,
  onSelectSector,
  onSelectBar,
  onSelectNode,
  onClearSelection,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 980, h: 760 });
  const [view, setView] = useState(() => computeFitView(980, 760));
  const [smoothCamera, setSmoothCamera] = useState(false);
  const [wheelMode, setWheelMode] = useState<'pan' | 'zoom'>('pan');
  const [dragging, setDragging] = useState(false);
  const [hoverBarId, setHoverBarId] = useState<string | null>(null);
  const [hoverSec, setHoverSec] = useState<string | null>(null);
  const [hoverChordId, setHoverChordId] = useState<string | null>(null);
  const [tip, setTip] = useState<HoverTip | null>(null);

  const fitRef = useRef(view.fitScale);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const initializedFitRef = useRef(false);

  const applyFit = useCallback((w: number, h: number, animate = true) => {
    const fitted = computeFitView(w, h);
    fitRef.current = fitted.fitScale;
    setSmoothCamera(animate);
    setView(fitted);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;
      setBox({ w: rect.width, h: rect.height });
      const nextFit = computeFitView(rect.width, rect.height);
      fitRef.current = nextFit.fitScale;
      if (!initializedFitRef.current) {
        initializedFitRef.current = true;
        applyFit(rect.width, rect.height, false);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyFit]);

  useEffect(() => {
    if (resetSignal > 0) applyFit(box.w, box.h, true);
  }, [resetSignal, applyFit, box.w, box.h]);

  const zoomAtPoint = useCallback((factor: number, clientX?: number, clientY?: number, animate = false) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const my = clientY !== undefined ? clientY - rect.top : rect.height / 2;
    const baseFit = Math.max(0.3, fitRef.current || 1);
    setSmoothCamera(animate);
    setView((prev) => {
      const nextScale = Math.max(baseFit * 0.45, Math.min(baseFit * 4.5, prev.scale * factor));
      if (Math.abs(nextScale - prev.scale) < 0.0005) return prev;
      const ratio = nextScale / prev.scale;
      return {
        ...prev,
        scale: nextScale,
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      };
    });
  }, []);

  const zoomToPct = useCallback((targetPct: number) => {
    const el = stageRef.current;
    const rect = el?.getBoundingClientRect();
    const mx = rect ? rect.width / 2 : box.w / 2;
    const my = rect ? rect.height / 2 : box.h / 2;
    const baseFit = Math.max(0.3, fitRef.current || 1);
    const nextScale = Math.max(baseFit * 0.45, Math.min(baseFit * 4.5, (fitRef.current || 1) * (targetPct / 100)));
    setSmoothCamera(false);
    setView((prev) => {
      if (Math.abs(nextScale - prev.scale) < 0.0005) return prev;
      const ratio = nextScale / prev.scale;
      return {
        ...prev,
        scale: nextScale,
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      };
    });
  }, [box.w, box.h]);

  // Native non-passive wheel listener: two-finger scroll pans cleanly; Ctrl/Cmd+wheel or pinch zooms around pointer.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as Element | null)?.closest('[data-hud-control]')) return;
      event.preventDefault();
      setSmoothCamera(false);
      if (event.ctrlKey || event.metaKey || wheelMode === 'zoom') {
        const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        const speed = event.ctrlKey ? 0.012 : 0.0024;
        const factor = Math.exp(-delta * speed);
        zoomAtPoint(factor, event.clientX, event.clientY, false);
      } else {
        setView((prev) => ({
          ...prev,
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY,
        }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheelMode, zoomAtPoint]);

  const sectors = model.displaySectors;
  const chords = model.displayChords;
  const labels = useMemo(() => computeAdjustedLabels(sectors), [sectors]);

  const c1Count = model.metrics.pendingSlices + model.gaps.untrackedFiles.length + model.gaps.diskStaleIds.length;
  const c2Count = model.gaps.shallowSlices.length + model.gaps.staleSlices.length;
  const c3Count = model.gaps.unbackedVerdicts.length;
  const s2Count = new Set([
    ...model.gaps.humanSignals.map((n) => n.id),
    ...model.gaps.openThreads.map((n) => n.id),
    ...model.gaps.unresolvedAnomalies.map((n) => n.id),
  ]).size;

  const pct = Math.round(model.metrics.coverageRatio * 100);
  const zoomPct = Math.max(25, Math.min(450, Math.round((view.scale / (fitRef.current || 1)) * 100)));
  const filterActive = filter !== 'all';
  const guardClick = () => performance.now() < suppressClickUntilRef.current;

  return (
    <div
      ref={stageRef}
      className="ultra-constellation-stage relative h-full w-full select-none overflow-hidden"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onDoubleClick={(event) => {
        if ((event.target as Element).closest('[data-hud-control], [data-slice-interactive]')) return;
        applyFit(box.w, box.h);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest('[data-hud-control]')) return;
        setSmoothCamera(false);
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          baseX: view.x,
          baseY: view.y,
          moved: false,
        };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.hypot(dx, dy) > 5) drag.moved = true;
        if (drag.moved) {
          setTip(null);
          setView((prev) => ({ ...prev, x: drag.baseX + dx, y: drag.baseY + dy }));
        }
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setDragging(false);
        if (drag.moved) {
          suppressClickUntilRef.current = performance.now() + 90;
        } else if (!(event.target as Element).closest('[data-slice-interactive], [data-hud-control]')) {
          onClearSelection();
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragging(false);
      }}
    >
      <ConstellationTopHud
        model={model}
        filter={filter}
        c1Count={c1Count}
        c2Count={c2Count}
        c3Count={c3Count}
        s2Count={s2Count}
        onFilterChange={onFilterChange}
        onOpenGates={onOpenGates}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: '0 0',
          transform: `translate3d(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px, 0) scale(${view.scale.toFixed(4)})`,
          transition: smoothCamera ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          willChange: 'transform',
        }}
      >
        <svg className="ultra-stage-enter" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} role="img" aria-label={t('ultra.aria')}>
          <circle cx={CX} cy={CY} r={146} fill="var(--u-hub-void)" stroke="var(--u-line)" strokeWidth={1} />
          <circle cx={CX} cy={CY} r={96} fill="none" stroke="var(--u-line-soft)" strokeDasharray="3 5" strokeWidth={1} />

          <ConstellationChords
            chords={chords}
            intraLinks={model.displayIntraLinks}
            satellites={model.satellites}
            model={model}
            selectedSector={selectedSector}
            selectedBarId={selectedBarId}
            selectedNodeId={selectedNodeId}
            hoverBarId={hoverBarId}
            hoverSec={hoverSec}
            hoverChordId={hoverChordId}
            guardClick={guardClick}
            setHoverChordId={setHoverChordId}
            setTip={setTip}
            onSelectSector={onSelectSector}
            onSelectBar={onSelectBar}
            onSelectNode={onSelectNode}
          />

          <ConstellationSectors
            sectors={sectors}
            labels={labels}
            model={model}
            pct={pct}
            filterActive={filterActive}
            selectedSector={selectedSector}
            selectedBarId={selectedBarId}
            hoverBarId={hoverBarId}
            hoverSec={hoverSec}
            guardClick={guardClick}
            setHoverBarId={setHoverBarId}
            setHoverSec={setHoverSec}
            setTip={setTip}
            onSelectSector={onSelectSector}
            onSelectBar={onSelectBar}
          />
        </svg>
      </div>

      <ConstellationZoomBar
        zoomPct={zoomPct}
        wheelMode={wheelMode}
        showZoomSlider={showZoomSlider}
        onZoomIn={() => zoomAtPoint(1.18, undefined, undefined, true)}
        onZoomOut={() => zoomAtPoint(1 / 1.18, undefined, undefined, true)}
        onZoomToPct={zoomToPct}
        onFit={() => applyFit(box.w, box.h, true)}
        onToggleWheelMode={() => setWheelMode((m) => (m === 'pan' ? 'zoom' : 'pan'))}
      />

      {tip && !dragging && <ConstellationTooltip tip={tip} />}
    </div>
  );
}
