import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { BrandMark } from '../../../BrandMark';
import { t } from '../../../i18n';
import type { UltraLensMode } from '../../../panels/Topbar';
import { INSPECTOR_WIDTH_RANGE, type CanvasBackdrop } from '../../../preferences';
import type { BoardNode, GraphSnapshot, UltraSnapshot } from '../../../types';
import { buildUltraModel, type UltraFilter, type UltraOrbitalBar } from '../../ultra';
import type { NodeChange } from '../../use-workspace-presentation';
import { UltraConstellationView } from './UltraConstellationView';
import { UltraDrawer } from './UltraDrawer';
import { UltraGatesView } from './UltraGatesView';
import { UltraTreemapView } from './UltraTreemapView';

type Props = {
  snapshot: GraphSnapshot;
  ultra: UltraSnapshot | null;
  lens?: UltraLensMode;
  onLensChange?: (next: UltraLensMode) => void;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  resetSignal?: number;
  onResetView?: () => void;
  backdrop?: CanvasBackdrop;
  inspectorWidth?: number;
  onInspectorWidthChange?: (width: number) => void;
  showZoomSlider?: boolean;
  changes?: ReadonlyMap<string, NodeChange> | null;
  writable: boolean;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  onInspectFullNode: (id: string) => void;
  onNew?: () => void;
  onTimeline?: () => void;
  onReload: () => Promise<void>;
};

export function UltraWorkspace({
  snapshot,
  ultra,
  lens = 'constellation',
  onLensChange,
  panelOpen = true,
  onPanelOpenChange,
  resetSignal = 0,
  onResetView,
  backdrop = 'dots',
  inspectorWidth = INSPECTOR_WIDTH_RANGE.default,
  onInspectorWidthChange,
  showZoomSlider = false,
  changes = null,
  writable,
  selectedId,
  onSelectNode,
  onInspectFullNode,
  onNew,
  onTimeline,
  onReload,
}: Props) {
  const [filter, setFilter] = useState<UltraFilter>('all');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [drilledSector, setDrilledSector] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const model = useMemo(
    () => buildUltraModel(snapshot, ultra, { lens, filter }),
    [snapshot, ultra, lens, filter],
  );

  const selectedNode: BoardNode | null = selectedId ? model.byId.get(selectedId) ?? null : null;
  const selectedBar: UltraOrbitalBar | null = selectedBarId ? model.barById.get(selectedBarId) ?? null : null;
  const activeSectorName =
    selectedSector ||
    selectedBar?.sector ||
    (selectedNode ? model.nodeDisplaySectorMap.get(selectedNode.id) || model.nodeSectorMap.get(selectedNode.id) || null : null);
  const activeSector = activeSectorName
    ? model.displaySectorMap.get(activeSectorName) ?? model.sectorMap.get(activeSectorName) ?? null
    : null;

  const drawerViewMode: 'slice' | 'sector' | 'node' | 'overview' = selectedNode
    ? 'node'
    : selectedBar
      ? 'slice'
      : activeSector
        ? 'sector'
        : 'overview';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"]')) {
        return;
      }
      if (event.key === 'Escape') {
        if (selectedNode) {
          onSelectNode(null);
        } else if (lens === 'treemap' && drilledSector) {
          setDrilledSector(null);
        } else if (selectedBarId) {
          setSelectedBarId(null);
        } else if (selectedSector) {
          setSelectedSector(null);
        }
      } else if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      } else if (event.key === '0') {
        onResetView?.();
      } else if ((event.key === 'j' || event.key === 'J' || event.key === 'k' || event.key === 'K') && lens !== 'gaps') {
        const navBars = model.displayBars.filter((b) => b.matchesFilter);
        if (navBars.length === 0) return;
        event.preventDefault();
        const curIdx = selectedBarId ? navBars.findIndex((b) => b.id === selectedBarId) : -1;
        const forward = event.key === 'j' || event.key === 'J';
        const nextIdx =
          curIdx >= 0
            ? forward
              ? (curIdx + 1) % navBars.length
              : (curIdx - 1 + navBars.length) % navBars.length
            : forward
              ? 0
              : navBars.length - 1;
        const nextBar = navBars[nextIdx];
        if (!nextBar) return;
        setSelectedSector(nextBar.sector);
        setSelectedBarId(nextBar.id);
        onSelectNode(null);
        onPanelOpenChange?.(true);
        if (lens === 'treemap' && drilledSector && drilledSector !== nextBar.sector) {
          setDrilledSector(nextBar.sector);
        }
      } else if ((event.key === 'n' || event.key === 'N') && writable && onNew) {
        event.preventDefault();
        onNew();
      } else if ((event.key === 't' || event.key === 'T') && onTimeline) {
        event.preventDefault();
        onTimeline();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNode, selectedBarId, drilledSector, selectedSector, lens, model.displayBars, writable, onNew, onTimeline, onSelectNode, onPanelOpenChange, onResetView]);

  const handleSelectSector = (sectorName: string) => {
    setSelectedSector(sectorName);
    setSelectedBarId(null);
    onSelectNode(null);
    onPanelOpenChange?.(true);
  };

  const handleSelectBar = (bar: UltraOrbitalBar) => {
    setSelectedSector(bar.sector);
    setSelectedBarId(bar.id);
    onSelectNode(null);
    onPanelOpenChange?.(true);
    if (lens === 'gaps') onLensChange?.('constellation');
  };

  const handleSelectNode = (nodeId: string, sectorName?: string) => {
    const sec = sectorName || model.nodeDisplaySectorMap.get(nodeId) || model.nodeSectorMap.get(nodeId) || null;
    if (sec) setSelectedSector(sec);
    onSelectNode(nodeId);
    onPanelOpenChange?.(true);
  };

  const handleClear = () => {
    setSelectedSector(null);
    setSelectedBarId(null);
    onSelectNode(null);
  };

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd((cur) => (cur === cmd ? null : cur)), 1800);
    } catch { /* Clipboard permission optional. */ }
  };

  const isEmpty = model.displaySectors.length === 0;
  const s1Count = model.metrics.awakenedChains;
  const s2Count = new Set([
    ...model.gaps.humanSignals.map((n) => n.id),
    ...model.gaps.openThreads.map((n) => n.id),
    ...model.gaps.unresolvedAnomalies.map((n) => n.id),
  ]).size;
  const doneLines = Math.max(0, model.metrics.totalLines - model.metrics.pendingLines);

  return (
    <div data-backdrop={backdrop} className="ultra-shell flex min-h-0 flex-1 flex-col">
      {/* Main Split Stage + Docked Right Inspector */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {isEmpty ? (
            <div className="ultra-constellation-stage flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 text-[var(--u-cyan)]">
                <BrandMark size={30} />
              </span>
              <div className="ultra-mono text-[11px] uppercase tracking-[0.22em] text-[var(--u-cyan)]">{t('ultra.title')}</div>
              <h2 className="mt-2 mb-0 text-xl font-normal text-[var(--u-ink)]">{t('ultra.empty.title')}</h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--u-dim)]">{t('ultra.empty.desc')}</p>
              <button
                type="button"
                onClick={() => copyCommand('pinwhy-ultra sync --cwd .')}
                className="ultra-btn ultra-btn-sky mt-4"
              >
                {copiedCmd === 'pinwhy-ultra sync --cwd .' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="ultra-mono">pinwhy-ultra sync --cwd .</span>
              </button>
            </div>
          ) : lens === 'gaps' ? (
            <UltraGatesView
              model={model}
              changes={changes}
              onSelectBar={handleSelectBar}
              onSelectSector={handleSelectSector}
              onSelectNode={handleSelectNode}
            />
          ) : lens === 'treemap' ? (
            <UltraTreemapView
              model={model}
              filter={filter}
              selectedSector={activeSectorName}
              selectedBarId={selectedBarId}
              drilledSector={drilledSector}
              onFilterChange={setFilter}
              onDrillSector={setDrilledSector}
              onOpenGates={() => onLensChange?.('gaps')}
              onSelectSector={handleSelectSector}
              onSelectBar={handleSelectBar}
            />
          ) : (
            <UltraConstellationView
              model={model}
              filter={filter}
              selectedSector={activeSectorName}
              selectedBarId={selectedBarId}
              selectedNodeId={selectedId}
              resetSignal={resetSignal}
              showZoomSlider={showZoomSlider}
              onFilterChange={setFilter}
              onOpenGates={() => onLensChange?.('gaps')}
              onSelectSector={handleSelectSector}
              onSelectBar={handleSelectBar}
              onSelectNode={handleSelectNode}
              onClearSelection={handleClear}
            />
          )}
        </div>

        {!isEmpty && lens !== 'gaps' && (
          <UltraDrawer
            open={panelOpen}
            width={inspectorWidth}
            onWidthChange={onInspectorWidthChange}
            viewMode={drawerViewMode}
            preferMicroGraph={lens === 'treemap'}
            sector={activeSector}
            selectedBar={selectedBar}
            selectedNode={selectedNode}
            model={model}
            changes={changes}
            writable={writable}
            onToggleCollapse={() => onPanelOpenChange?.(false)}
            onBackToSector={handleSelectSector}
            onBackToSlice={selectedBar ? () => onSelectNode(null) : undefined}
            onSelectBar={handleSelectBar}
            onSelectNode={handleSelectNode}
            onInspectFullNode={onInspectFullNode}
            onReload={onReload}
          />
        )}
      </div>

      {/* Compact Tactical Footer */}
      <footer className="flex min-h-[32px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--u-line)] bg-[var(--u-surface)] px-4 py-1 text-[11px]">
        <div className="flex flex-wrap items-center gap-2.5">
          {model.sourceMode === 'board-derived' ? (
            <>
              <span className="text-[var(--u-dim)]">{t('ultra.syncMissing')}</span>
              <button
                type="button"
                onClick={() => copyCommand('pinwhy-ultra sync --cwd .')}
                className="ultra-mono inline-flex items-center gap-1 text-[var(--u-cyan)] underline underline-offset-4"
              >
                {copiedCmd === 'pinwhy-ultra sync --cwd .' ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedCmd === 'pinwhy-ultra sync --cwd .' ? t('ultra.copiedCmd') : 'pinwhy-ultra sync --cwd .'}</span>
              </button>
            </>
          ) : model.nextWave ? (
            <>
              <span className="ultra-mono rounded border border-[var(--u-mint)]/35 bg-[var(--u-mint)]/10 px-1.5 py-0.5 text-[10px] text-[var(--u-mint)]">
                {t('ultra.nextWave')}
              </span>
              <button
                type="button"
                onClick={() => handleSelectSector(model.nextWave!.sector)}
                className="ultra-mono text-[var(--u-ink)] hover:text-[var(--u-cyan)]"
              >
                {model.nextWave.sector} ({model.nextWave.slices.length} · {model.nextWave.totalLines}L)
              </button>
              <button
                type="button"
                onClick={() => copyCommand('pinwhy-ultra next --cwd .')}
                className="ultra-mono inline-flex items-center gap-1 text-[var(--u-dim)] hover:text-[var(--u-ink)]"
              >
                {copiedCmd === 'pinwhy-ultra next --cwd .' ? <Check className="size-3 text-[var(--u-mint)]" /> : <Copy className="size-3" />}
                <span>pinwhy-ultra next --cwd .</span>
              </button>
            </>
          ) : model.allClear ? (
            <span className="ultra-mono rounded border border-[var(--u-mint)]/40 bg-[var(--u-mint)]/10 px-1.5 py-0.5 text-[10px] text-[var(--u-mint)]">
              {t('ultra.allGatesClear')}
            </span>
          ) : model.commitmentComplete ? (
            <button
              type="button"
              onClick={() => onLensChange?.('gaps')}
              className="ultra-mono inline-flex items-center gap-1.5 rounded border border-[var(--u-cyan)]/35 bg-[var(--u-cyan)]/10 px-2 py-0.5 text-[10.5px] text-[var(--u-cyan)]"
            >
              <span>{t('ultra.commitmentsDoneBoundariesOpen', { count: s1Count + s2Count })}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onLensChange?.('gaps')}
              className="ultra-mono text-[var(--u-amber)] underline underline-offset-4"
            >
              {t('ultra.gates.breadthDoneGapsOpen')}
            </button>
          )}
        </div>

        <div className="ultra-mono hidden items-center gap-3 text-[10.5px] text-[var(--u-dim)] lg:flex">
          <span>
            {t('ultra.footer.linesStat', {
              done: doneLines,
              total: model.metrics.totalLines,
              nodes: model.metrics.boardNodesCount,
            })}
          </span>
        </div>
      </footer>
    </div>
  );
}
