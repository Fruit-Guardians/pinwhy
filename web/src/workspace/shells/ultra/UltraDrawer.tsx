import { useEffect, useRef, useState } from 'react';
import { PanelRightClose } from 'lucide-react';
import { t } from '../../../i18n';
import { INSPECTOR_WIDTH_RANGE } from '../../../preferences';
import type { BoardNode, UltraSlice } from '../../../types';
import type { UltraModel, UltraOrbitalBar, UltraSectorView } from '../../ultra';
import type { NodeChange } from '../../use-workspace-presentation';
import {
  NodeDrawerView,
  OverviewDrawerView,
  SectorDrawerView,
  SliceDrawerView,
} from './drawer/UltraDrawerViews';

type Props = {
  open: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  viewMode: 'slice' | 'sector' | 'node' | 'overview';
  preferMicroGraph?: boolean;
  sector: UltraSectorView | null;
  selectedBar: UltraOrbitalBar | null;
  selectedNode: BoardNode | null;
  model: UltraModel;
  changes?: ReadonlyMap<string, NodeChange> | null;
  writable: boolean;
  onToggleCollapse?: () => void;
  onBackToSector: (sectorName: string) => void;
  onBackToSlice?: () => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
  onInspectFullNode: (nodeId: string) => void;
  onReload: () => Promise<void>;
};

export function UltraDrawer({
  open,
  width = INSPECTOR_WIDTH_RANGE.default,
  onWidthChange,
  viewMode,
  preferMicroGraph = false,
  sector,
  selectedBar,
  selectedNode,
  model,
  changes = null,
  writable,
  onToggleCollapse,
  onBackToSector,
  onBackToSlice,
  onSelectBar,
  onSelectNode,
  onInspectFullNode,
  onReload,
}: Props) {
  const [resizing, setResizing] = useState(false);
  const [copiedLoc, setCopiedLoc] = useState<string | null>(null);
  const resizeOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!resizing) return;
    const onPointerMove = (event: PointerEvent) => {
      const origin = resizeOriginRef.current;
      if (!origin) return;
      const next = Math.min(INSPECTOR_WIDTH_RANGE.max, Math.max(INSPECTOR_WIDTH_RANGE.min, Math.round(origin.startWidth + (origin.startX - event.clientX))));
      onWidthChange?.(next);
    };
    const stop = () => {
      setResizing(false);
      resizeOriginRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [resizing, onWidthChange]);

  if (!open) return null;

  const copySliceLoc = async (loc: string) => {
    try {
      await navigator.clipboard.writeText(loc);
      setCopiedLoc(loc);
      setTimeout(() => setCopiedLoc((cur) => (cur === loc ? null : cur)), 1800);
    } catch { /* Clipboard permission optional. */ }
  };

  const sectorSlices: UltraSlice[] = sector
    ? sector.bars.map((b) => b.slice).filter((s): s is UltraSlice => Boolean(s))
    : [];
  const sectorNodes: BoardNode[] = sector
    ? sector.nodeIds.map((id) => model.byId.get(id)).filter((n): n is BoardNode => Boolean(n))
    : [];

  const panelKey = `${viewMode}:${selectedNode?.id || selectedBar?.id || sector?.sector || 'overview'}`;

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('ultra.inspector.panelTitle')}
        data-dragging={resizing ? 'true' : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          resizeOriginRef.current = { startX: event.clientX, startWidth: width };
          setResizing(true);
        }}
        className="ultra-resize-handle max-lg:hidden"
      />
      <aside
        aria-label={t('ultra.inspector.panelTitle')}
        style={{ width }}
        className="flex h-full shrink-0 flex-col border-l border-[var(--u-line)] bg-[var(--u-surface)] max-lg:!w-[340px]"
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--u-line)] px-4">
          <span className="ultra-mono text-[10.5px] uppercase tracking-wider text-[var(--u-dim)]">
            {t('ultra.inspector.panelTitle')}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={t('ultra.inspector.hidePanel')}
              className="ultra-btn h-7 border-0 bg-transparent px-1.5 text-[11px]"
            >
              <PanelRightClose className="size-3.5" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          <div key={panelKey} className="ultra-panel-swap">
            {viewMode === 'node' && selectedNode ? (
              <NodeDrawerView
                node={selectedNode}
                model={model}
                changes={changes}
                sector={sector}
                selectedBar={selectedBar}
                writable={writable}
                onBackToSector={onBackToSector}
                onBackToSlice={onBackToSlice}
                onSelectNode={onSelectNode}
                onInspectFullNode={onInspectFullNode}
                onReload={onReload}
              />
            ) : viewMode === 'slice' && selectedBar ? (
              <SliceDrawerView
                bar={selectedBar}
                model={model}
                changes={changes}
                preferMicroGraph={preferMicroGraph}
                copiedLoc={copiedLoc}
                writable={writable}
                onCopyLoc={copySliceLoc}
                onBackToSector={onBackToSector}
                onSelectBar={onSelectBar}
                onSelectNode={onSelectNode}
                onReload={onReload}
              />
            ) : viewMode === 'sector' && sector ? (
              <SectorDrawerView
                sector={sector}
                model={model}
                changes={changes}
                sectorSlices={sectorSlices}
                sectorNodes={sectorNodes}
                writable={writable}
                onSelectBar={onSelectBar}
                onSelectNode={onSelectNode}
                onReload={onReload}
              />
            ) : (
              <OverviewDrawerView model={model} changes={changes} onSelectBar={onSelectBar} />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
