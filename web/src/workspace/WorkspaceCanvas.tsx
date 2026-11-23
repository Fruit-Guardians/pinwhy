import { Suspense, lazy, useEffect, useRef, useState, type ComponentType, type RefObject } from 'react';
import { Background, BackgroundVariant, MiniMap, ReactFlow, type Edge, type NodeMouseHandler, type OnNodesChange } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { BoardGroup } from '../canvas/BoardGroup';
import { ExportingContext } from '../canvas/export-context';
import { typeLabel as typeLabelOf, type CanvasEdge, type CanvasNode, type RelationGroup } from '../canvas/graph';
import { t } from '../i18n';
import { CanvasPeekCard } from '../panels/CanvasPeekCard';
import { CanvasToolbar } from '../panels/CanvasToolbar';
import { EmptyBoard } from '../panels/EmptyBoard';
import { Legend } from '../panels/Legend';
import type { CanvasBackdrop } from '../preferences';
import { miniMapNodeColor } from '../presentation';
import { RoutedEdge } from '../canvas/RoutedEdge';
import type { Scene3DHandle, Scene3DProps } from '../scene3d/shared';
import { SecurityNode } from '../canvas/SecurityNode';
import type { BoardNode, CheckpointRef, ViewMode } from '../types';
import type { AuditExpansionAction, AuditSelection } from './audit';
import { WorkspaceBanners } from './WorkspaceBanners';

const nodeTypes = { security: SecurityNode, boardGroup: BoardGroup };
const edgeTypes = { routed: RoutedEdge };

// three.js and the post-processing stack load only when the reader opens the sandbox. An offline HTML
// export has no server for that chunk; the board then announces it and stays on the flat canvas.
const Scene3D = lazy<ComponentType<Scene3DProps>>(() => import('../scene3d/Scene3D').catch(() => ({
  default: function Unavailable({ onExit, onNotice }: Scene3DProps) {
    useEffect(() => { onNotice(t('scene3d.failed')); onExit(); }, []);
    return null;
  },
})));

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>;
  flatRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<Scene3DHandle | null>;
  auditMode: boolean;
  showAuditGraph: boolean;
  audit: AuditSelection | null;
  expandAudit: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
  canvasMode: ViewMode;
  layoutMode: ViewMode | null;
  direction: 'RIGHT' | 'DOWN';
  onToggleDirection: () => void;
  theme: 'light' | 'dark';
  canvasBackdrop: CanvasBackdrop;
  projectionNodeCount: number;
  allNodeCount: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  displayNodes: CanvasNode[];
  displayEdges: Edge[];
  highlighted: ReadonlySet<string>;
  selectedId: string | null;
  selected: BoardNode | null;
  currentId: string | null;
  byId: ReadonlyMap<string, BoardNode>;
  legend: { types: string[]; groups: RelationGroup[] };
  laying: number;
  scene3d: boolean;
  openScene: () => void;
  closeScene: () => void;
  occlusion: { right: number; bottom: number };
  auditOcclusionRight: number;
  exporting: boolean;
  exportImage: () => void;
  showMap: boolean;
  onToggleMap: () => void;
  showLegend: boolean;
  onToggleLegend: () => void;
  onCloseLegend: () => void;
  showPeekHud: boolean;
  showZoomSlider: boolean;
  follow: boolean;
  onToggleFollow: () => void;
  isStatic: boolean;
  motion: number;
  fresh: ReadonlySet<string>;
  activeHoverId: string | null;
  onHoverNode: (id: string | null) => void;
  handleNodesChange: OnNodesChange<CanvasNode>;
  onNodeClick: NodeMouseHandler<CanvasNode>;
  clearSelection: () => void;
  focusNode: (id: string, center?: boolean) => void;
  focusNeighborhood: (id: string, edges: CanvasEdge[]) => void;
  fitCanvas: () => void;
  triggerNeighborhood?: () => void;
  onOpenSettings: () => void;
  onShowAll: () => void;
  offlineShown: boolean;
  syncedAt: number | null;
  timelineActive: boolean;
  timelinePoint: CheckpointRef | null;
  asOf: string | null;
  onBackToNow: () => void;
  pastPoint?: CheckpointRef;
  hidden: number;
  notice: string | null;
  flash: (message: string) => void;
};

export function WorkspaceCanvas({
  viewportRef,
  flatRef,
  sceneRef,
  auditMode,
  showAuditGraph,
  audit,
  expandAudit,
  canvasMode,
  layoutMode,
  direction,
  onToggleDirection,
  theme,
  canvasBackdrop,
  projectionNodeCount,
  allNodeCount,
  nodes,
  edges,
  displayNodes,
  displayEdges,
  highlighted,
  selectedId,
  selected,
  currentId,
  byId,
  legend,
  laying,
  scene3d,
  openScene,
  closeScene,
  occlusion,
  auditOcclusionRight,
  exporting,
  exportImage,
  showMap,
  onToggleMap,
  showLegend,
  onToggleLegend,
  onCloseLegend,
  showPeekHud,
  showZoomSlider,
  follow,
  onToggleFollow,
  isStatic,
  motion,
  fresh,
  activeHoverId,
  onHoverNode,
  handleNodesChange,
  onNodeClick,
  clearSelection,
  focusNode,
  focusNeighborhood,
  fitCanvas,
  triggerNeighborhood,
  onOpenSettings,
  onShowAll,
  offlineShown,
  syncedAt,
  timelineActive,
  timelinePoint,
  asOf,
  onBackToNow,
  pastPoint,
  hidden,
  notice,
  flash,
}: Props) {
  const [farZoom, setFarZoom] = useState(false);
  const lastZoomRef = useRef(1);
  const showFlatCanvas = !auditMode || showAuditGraph;

  return (
    <>
      {showFlatCanvas && (
        <div
          ref={flatRef}
          className={cn('relative min-h-0', auditMode ? 'flex-1' : 'absolute inset-0')}
          inert={scene3d}
          aria-hidden={scene3d}
        >
          <ExportingContext.Provider value={exporting}>
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={handleNodesChange}
              onNodeClick={(event, node) => {
                onNodeClick(event, node);
                const detail = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-audit-detail]')?.dataset.auditDetail : undefined;
                if (audit && (detail === 'contradiction' || detail === 'condition')) {
                  const context = audit.contexts.get(node.id);
                  if (context && !context.pages[detail].open) expandAudit(context.pages[detail].key, 'more', 0);
                }
              }}
              onNodeDoubleClick={(_event, node) => {
                if (!node.data.group) {
                  focusNode(node.id, false);
                  requestAnimationFrame(() => focusNeighborhood(node.id, edges));
                }
              }}
              onPaneClick={clearSelection}
              onNodeMouseEnter={(_event, node) => { if (!node.data.group) onHoverNode(node.id); }}
              onNodeMouseLeave={(_event, node) => { if (activeHoverId === node.id) onHoverNode(null); }}
              nodesConnectable={false}
              deleteKeyCode={null}
              autoPanOnNodeFocus={false}
              minZoom={0.08}
              maxZoom={1.8}
              colorMode={theme}
              fitView={!auditMode}
              fitViewOptions={{ padding: .14, minZoom: .08, maxZoom: 1 }}
              onMove={(_, viewport) => {
                if (viewport.zoom !== lastZoomRef.current) {
                  lastZoomRef.current = viewport.zoom;
                  viewportRef.current?.style.setProperty('--zoom', String(viewport.zoom));
                  const nextFar = viewport.zoom < 0.85;
                  setFarZoom((prev) => (prev === nextFar ? prev : nextFar));
                }
              }}
              proOptions={{ hideAttribution: true }}
              onlyRenderVisibleElements={!exporting}
            >
              {canvasBackdrop === 'dots' && (
                <>
                  <Background id="minor" variant={BackgroundVariant.Dots} gap={20} size={1.05} />
                  <Background id="major" variant={BackgroundVariant.Dots} gap={100} size={1.75} color="var(--line-strong)" />
                </>
              )}
              {canvasBackdrop === 'lines' && (
                <Background id="lines" variant={BackgroundVariant.Lines} gap={32} lineWidth={1} color="var(--line)" />
              )}
              {canvasBackdrop === 'cross' && (
                <Background id="cross" variant={BackgroundVariant.Cross} gap={48} size={5} lineWidth={1} color="var(--line-strong)" />
              )}
              <CanvasToolbar
                hasCurrent={!auditMode && Boolean(currentId)}
                canFollow={!isStatic && !auditMode}
                canExport={projectionNodeCount > 0 && nodes.length > 0 && !exporting}
                onExport={exportImage}
                grouped={canvasMode === 'all'}
                direction={direction}
                showMap={showMap}
                follow={follow}
                onToggleFollow={onToggleFollow}
                motion={motion}
                onFit={fitCanvas}
                onLocate={() => currentId && focusNode(currentId)}
                canFocusNeighborhood={Boolean(triggerNeighborhood)}
                onFocusNeighborhood={triggerNeighborhood}
                onDirection={onToggleDirection}
                onToggleMap={onToggleMap}
                showLegend={showLegend}
                onToggleLegend={onToggleLegend}
                showZoomSlider={showZoomSlider}
                onSettings={onOpenSettings}
                onScene3d={auditMode ? undefined : openScene}
              />
              {showMap && (
                <MiniMap<CanvasNode>
                  position="bottom-left"
                  className="mb-16! max-sm:mb-26!"
                  pannable
                  zoomable
                  nodeBorderRadius={4}
                  nodeStrokeWidth={3}
                  nodeColor={(node) => miniMapNodeColor(node.data)}
                  nodeStrokeColor={(node) => {
                    if (node.data.group) return 'var(--line-strong)';
                    if (node.id === selectedId) return 'var(--ink)';
                    if (node.data.current) return 'var(--live)';
                    return 'transparent';
                  }}
                />
              )}
            </ReactFlow>
          </ExportingContext.Provider>
        </div>
      )}

      {!auditMode && scene3d && (
        <Suspense fallback={<div role="status" className="absolute inset-0 z-[5] flex items-center justify-center bg-background text-xs text-muted-foreground">{t('scene3d.loading')}</div>}>
          <Scene3D
            ref={sceneRef}
            nodes={nodes}
            edges={edges}
            mode={canvasMode}
            layoutMode={layoutMode}
            direction={direction}
            theme={theme}
            selectedId={selectedId}
            highlighted={highlighted}
            currentId={currentId}
            canFollow={!isStatic && !auditMode}
            follow={follow && !isStatic}
            showLegend={showLegend}
            fresh={fresh}
            motion={motion > 0}
            occlusion={occlusion}
            exporting={exporting}
            onExport={exportImage}
            onDirection={onToggleDirection}
            onToggleFollow={onToggleFollow}
            onToggleLegend={onToggleLegend}
            onSelect={(id) => id ? focusNode(id) : clearSelection()}
            onExit={closeScene}
            onNotice={flash}
          />
        </Suspense>
      )}

      {showFlatCanvas && showLegend && nodes.length > 0 && <Legend types={legend.types} groups={legend.groups} onClose={onCloseLegend} />}

      {!auditMode && projectionNodeCount === 0 && (
        <EmptyBoard viewEmpty={allNodeCount > 0} isStatic={isStatic} onShowAll={onShowAll} />
      )}

      <WorkspaceBanners
        offlineShown={offlineShown}
        syncedAt={syncedAt}
        timelineActive={timelineActive}
        timelinePoint={timelinePoint}
        asOf={asOf}
        onBackToNow={onBackToNow}
        isStatic={isStatic}
        pastPoint={pastPoint}
        hidden={hidden}
        onShowAll={onShowAll}
        laying={laying}
        notice={notice}
        offsetTop={auditMode}
      />

      <p className="sr-only" role="status" aria-live="polite">{selected ? t('app.selected', { type: typeLabelOf(selected.type), title: selected.title }) : ''}</p>

      <CanvasPeekCard
        node={activeHoverId && activeHoverId !== selectedId ? byId.get(activeHoverId) ?? null : null}
        degree={activeHoverId ? (nodes.find((node) => node.id === activeHoverId)?.data.degree ?? 0) : 0}
        visible={showPeekHud && !scene3d && showFlatCanvas && farZoom && Boolean(activeHoverId && activeHoverId !== selectedId)}
        inspectorOpen={Boolean(selected)}
        inspectorOffset={auditMode ? auditOcclusionRight : occlusion.right}
      />
    </>
  );
}
