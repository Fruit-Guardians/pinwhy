import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CardTheme } from './card-themes';
import type { ThemeMode } from './preferences';
import { BrandMark } from './BrandMark';
import { project } from './canvas/graph';
import { EMPTY_FILTER, type NodeFilter } from './presentation';
import { useGraphStream } from './api/use-graph-stream';
import { useUltraStream } from './api/use-ultra-stream';
import { Inspector } from './panels/Inspector';
import { Topbar, type UltraLensMode } from './panels/Topbar';
import { t } from './i18n';
import { SessionDrafts } from './session-drafts';
import { useWorkspaceData } from './workspace/use-workspace-data';
import { useWorkspaceLocation } from './workspace/use-workspace-location';
import { useWorkspaceLayout } from './workspace/use-workspace-layout';
import { useWorkspaceViewport } from './workspace/use-workspace-viewport';
import { useWorkspaceSelection } from './workspace/use-workspace-selection';
import { useWorkspacePresentation } from './workspace/use-workspace-presentation';
import { useWorkspaceFeedback } from './workspace/use-workspace-feedback';
import { useWorkspaceScene } from './workspace/use-workspace-scene';
import { useWorkspaceTimeline } from './workspace/use-workspace-timeline';
import { useWorkspaceChrome, useWorkspaceShortcuts } from './workspace/use-workspace-chrome';
import { useAuditNavigation } from './workspace/use-audit-navigation';
import { useEmbedHost } from './workspace/use-embed-host';
import { WorkspaceBanners } from './workspace/WorkspaceBanners';
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas';
import { WorkspaceDialogs } from './workspace/WorkspaceDialogs';
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar';
import { AuditBlueprintBar, AuditDossier } from './workspace/shells/audit';
import { UltraWorkspace } from './workspace/shells/ultra';
import { useSceneOcclusion } from './scene3d/use-scene-occlusion';
import type { WorkspaceMode } from './types';
import { readPresentation } from './api/embedded';
import { runViewTransition } from './view-transition';

function Workspace() {
  const [presentation] = useState(() => readPresentation(location.search));
  const { snapshot: live, connection, syncedAt, isStatic, reload } = useGraphStream();
  const { workspace, navigateWorkspace, issueId, candidateId, agentId, setAgentId, mode, setMode, selectedId, setSelectedId, asOf, setAsOf, deepLink, pendingFocus } = useWorkspaceLocation();
  // A checkpoint view replaces what every panel reads; the live stream keeps running underneath.
  const timeline = useWorkspaceTimeline(live, asOf, setAsOf, isStatic);
  const snapshot = timeline.snapshot;
  const [timelineOpen, setTimelineOpen] = useState(() => Boolean(asOf) && !isStatic);
  const chrome = useWorkspaceChrome({ embedded: presentation.embedded, appearance: presentation.appearance, fonts: presentation.fonts });
  const { appearance, canvas, reading, motion: motionSettings, dialogs } = chrome;
  const [filter, setFilter] = useState<NodeFilter>(EMPTY_FILTER);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const digestTrigger = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  const auditMode = workspace === 'audit';
  const ultraMode = workspace === 'ultra';
  const canvasMode = auditMode ? 'logic' : mode;
  const ultraSnapshot = useUltraStream(ultraMode, asOf, isStatic, snapshot);
  const [ultraLens, setUltraLens] = useState<UltraLensMode>('constellation');
  const [ultraPanelOpen, setUltraPanelOpen] = useState(true);
  const [ultraResetSignal, setUltraResetSignal] = useState(0);
  const [ultraInspectorOpen, setUltraInspectorOpen] = useState(false);
  useEffect(() => {
    if (!ultraMode || !selectedId) setUltraInspectorOpen(false);
  }, [ultraMode, selectedId]);

  const { board, agent, audit, expandAudit, projection, results, legend } = useWorkspaceData(
    snapshot, mode, agentId, filter,
    auditMode ? { issueId, candidateId, selectedId: selectedId ?? deepLink.current } : undefined,
  );
  const { allNodes, allEdges, activities, byId, inbox, paletteNodes, filterOptions, counts } = board;
  const { agentIds, digest, currentId, current, findings, openItems } = agent;
  // Stepping through checkpoints is not the Agent writing: only the live board pulses.
  const { fresh, notice, flash, linkCopied, copyNodeLink, copied, copyDigest, offlineShown } = useWorkspaceFeedback(timeline.active ? null : snapshot, allNodes, digest, agentId, connection, isStatic);
  const { nodes, edges, onNodesChange, layoutRevision, layoutMode, laying, layoutTransition } = useWorkspaceLayout(projection, canvasMode, canvas.direction);
  const [auditGraphOpen, setAuditGraphOpen] = useState(false);
  const canShowAuditGraph = Boolean(audit && (audit.root || selectedId || audit.records.length === 1));
  const showAuditGraph = auditMode && auditGraphOpen && canShowAuditGraph;

  const { centerOnNode, fitCanvas, focusNeighborhood, motion } = useWorkspaceViewport({
    viewportRef, canvasRef: flatRef,
    canvasActive: !ultraMode && (!auditMode || showAuditGraph),
    fitAll: auditMode, inspectorWidth: reading.inspectorWidth,
    pendingFocus, layoutRevision, mode: canvasMode,
    follow: motionSettings.follow && !auditMode && !ultraMode,
    currentId, selectedId, motionMode: motionSettings.motionMode,
  });
  const { scene3d, sceneRef, openScene, closeScene, occlusion, exporting, exportImage } = useWorkspaceScene({
    viewportRef, flatRef, inspectorRef, selectedId,
    mode: canvasMode, audit: auditMode, flash, enabled: !auditMode && !ultraMode,
  });
  // Resolve selection against the requested checkpoint, never its loading fallback.
  const { selected, focusNode, clearSelection, switchMode, handleNodesChange, onNodeClick } = useWorkspaceSelection({
    snapshot: timeline.active && !timeline.point ? null : snapshot,
    byId, projection, nodes, edges, mode, setMode, selectedId, setSelectedId,
    deepLink, pendingFocus, centerOnNode, onNodesChange, closeSidebar: dialogs.closeSidebar, scene3d,
    revealInGeneral: !auditMode && !ultraMode,
    canvasActive: !ultraMode && (!auditMode || showAuditGraph),
    centerOnSelect: !auditMode,
  });

  const auditNav = useAuditNavigation({
    auditMode, audit, auditGraphOpen, setAuditGraphOpen, issueId, candidateId, selectedId,
    navigateWorkspace, clearSelection, closeSidebar: dialogs.closeSidebar, runTransition: runViewTransition,
  });

  // A bare host can navigate and restyle; only `reference=1` offers the explicit reference action,
  // and never over a checkpoint or a static export, where the canonical node may differ.
  const referenceEnabled = presentation.embedded && presentation.reference && window.parent !== window && !isStatic && !timeline.active;
  const reference = useEmbedHost({
    embedded: presentation.embedded,
    enabled: referenceEnabled,
    onAppearance: appearance.setTheme,
    onFonts: appearance.setFonts,
    onNavigate: (id) => {
      if (!snapshot || (timeline.active && !timeline.point)) {
        deepLink.current = id;
        pendingFocus.current = id;
      } else if (byId.has(id)) {
        deepLink.current = null;
        focusNode(id);
      }
    },
  });

  const activeHoverId = hoveredNodeId && byId.has(hoveredNodeId) ? hoveredNodeId : null;
  const activeChanges = reading.showChanges && timeline.active ? timeline.changeMap : null;
  const { highlighted, displayNodes, displayEdges } = useWorkspacePresentation(
    nodes, edges, selectedId, fresh, canvasMode, canvas.edgeStyle, activeChanges, exporting ? null : activeHoverId, canvas.edgeLabelMode,
  );
  useEffect(() => { setHoveredNodeId(null); }, [workspace, canvasMode]);

  const hidden = projection?.hidden || 0;
  const visibleIds = useMemo(
    () => (hidden > 0 ? new Set((projection?.nodes || []).map((node) => node.id)) : undefined),
    [hidden, projection],
  );
  const neighborhoodTarget = selectedId ?? (!auditMode && !ultraMode ? currentId : null);
  const triggerNeighborhood = neighborhoodTarget ? () => {
    focusNode(neighborhoodTarget, false);
    if (projection?.nodes.some((node) => node.id === neighborhoodTarget)) {
      requestAnimationFrame(() => focusNeighborhood(neighborhoodTarget, edges));
    }
  } : undefined;

  const toggleTheme = (origin?: { x: number; y: number }) => {
    runViewTransition(() => appearance.setTheme(appearance.theme === 'light' ? 'dark' : 'light'), origin);
  };
  const changeThemeMode = (next: ThemeMode, origin?: { x: number; y: number }) => {
    if (next === appearance.themeMode) return;
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextResolved = next === 'system' ? (systemIsDark ? 'dark' : 'light') : next;
    if (nextResolved !== appearance.theme) runViewTransition(() => appearance.setThemeMode(next), origin);
    else appearance.setThemeMode(next);
  };
  const changeCardTheme = (next: CardTheme) => {
    if (next !== appearance.cardTheme) runViewTransition(() => appearance.setCardTheme(next));
  };

  const auditOcclusion = useSceneOcclusion(viewportRef, inspectorRef, auditMode && Boolean(selected));
  const auditInspectorPad = selected
    ? (auditOcclusion.right > 0 ? `${Math.round(auditOcclusion.right + 8)}px` : '400px')
    : undefined;

  useWorkspaceShortcuts(clearSelection, dialogs.setPaletteOpen, dialogs.setShortcutsOpen, ultraMode ? setUltraPanelOpen : dialogs.setSidebarOpen, {
    enabled: Boolean(snapshot) && !scene3d && !ultraMode && (!auditMode || showAuditGraph),
    onFit: fitCanvas,
    onLocate: !auditMode && !ultraMode && currentId ? () => focusNode(currentId) : undefined,
    onNeighborhood: (!ultraMode && (!auditMode || showAuditGraph)) ? triggerNeighborhood : undefined,
    onToggleMap: () => canvas.setShowMap((open) => !open),
    auditEnabled: Boolean(snapshot && audit && auditMode),
    onNextCandidate: () => auditNav.stepAuditCandidate(1),
    onPrevCandidate: () => auditNav.stepAuditCandidate(-1),
    onToggleAuditSurface: auditNav.canShowAuditGraph ? () => auditNav.switchAuditSurface() : undefined,
    onToggleSettings: () => { if (dialogs.settingsOpen) dialogs.setSettingsOpen(false); else dialogs.openSettings(); },
  });

  if (!snapshot) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <BrandMark size={32} />
        <strong className="text-sm font-semibold text-foreground">Pinwhy</strong>
        <span className="text-xs">{connection === 'offline' ? t('app.waitingService') : t('app.restoring')}</span>
      </main>
    );
  }

  // While a checkpoint is shown (or still loading over the live picture) nothing can be written.
  const writable = !isStatic && !timeline.active && snapshot.meta.writable === true;
  const stats = snapshot.stats || {};
  const toggleTimeline = isStatic ? undefined : () => {
    if (timelineOpen) { timeline.pause(); setAsOf(null); }
    setTimelineOpen(!timelineOpen);
  };
  const switchWorkspace = (next: WorkspaceMode) => {
    navigateWorkspace({ workspace: next });
    if (next === 'general' && selectedId) pendingFocus.current = selectedId;
    if (next === 'general' && snapshot && selectedId && !project(snapshot, mode, '', agentId).nodes.some((node) => node.id === selectedId)) setMode('all');
  };
  const referenceConfig = referenceEnabled
    ? { status: reference.status, message: reference.message, nodeId: reference.nodeId, onRequest: reference.request }
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <Topbar
        compact={presentation.embedded}
        title={snapshot.meta.title || t('app.untitledTask')}
        build={snapshot.meta.build}
        workspace={workspace}
        onWorkspace={switchWorkspace}
        mode={mode}
        onMode={switchMode}
        ultraLens={ultraLens}
        onUltraLens={(next) => runViewTransition(() => setUltraLens(next))}
        ultraPanelOpen={ultraPanelOpen}
        onToggleUltraPanel={() => setUltraPanelOpen((open) => !open)}
        onResetUltraView={() => setUltraResetSignal((n) => n + 1)}
        agentId={agentId}
        agentIds={agentIds}
        onAgent={setAgentId}
        theme={appearance.theme}
        onTheme={toggleTheme}
        connection={connection}
        isStatic={isStatic}
        sidebarOpen={dialogs.sidebarOpen}
        onToggleSidebar={() => dialogs.setSidebarOpen((open) => !open)}
        onSearch={() => dialogs.setPaletteOpen(true)}
        onDigest={() => dialogs.setDigestOpen(true)}
        onNew={writable ? () => dialogs.setNewOpen(true) : undefined}
        digestRef={digestTrigger}
        activities={activities}
        activityTotal={stats.activities || activities.length}
        showEmptyActivity={reading.showEmptyActivity}
        timelineOpen={timelineOpen}
        onTimeline={toggleTimeline}
        onSettings={() => dialogs.openSettings()}
        onAbout={() => dialogs.openSettings('about')}
      />

      {ultraMode ? (
        <main className="relative flex min-h-0 flex-1 flex-col" aria-label={t('ultra.aria')}>
          <UltraWorkspace
            snapshot={snapshot}
            ultra={ultraSnapshot}
            lens={ultraLens}
            onLensChange={setUltraLens}
            panelOpen={ultraPanelOpen}
            onPanelOpenChange={setUltraPanelOpen}
            resetSignal={ultraResetSignal}
            onResetView={() => setUltraResetSignal((n) => n + 1)}
            backdrop={canvas.backdrop}
            inspectorWidth={reading.inspectorWidth}
            onInspectorWidthChange={reading.setInspectorWidth}
            showZoomSlider={canvas.showZoomSlider}
            changes={activeChanges}
            writable={writable}
            selectedId={selectedId}
            onSelectNode={(id) => id ? setSelectedId(id) : clearSelection()}
            onInspectFullNode={(id) => { setSelectedId(id); setUltraInspectorOpen(true); }}
            onNew={writable ? () => dialogs.setNewOpen(true) : undefined}
            onTimeline={toggleTimeline}
            onReload={reload}
          />
          <WorkspaceBanners
            offlineShown={offlineShown}
            syncedAt={syncedAt}
            timelineActive={timeline.active}
            timelinePoint={timeline.point}
            asOf={asOf}
            onBackToNow={() => { timeline.pause(); setAsOf(null); }}
            isStatic={isStatic}
            pastPoint={snapshot.meta.asOf}
            hidden={0}
            onShowAll={() => switchMode('all')}
            laying={0}
            notice={notice}
            offsetTop
          />
          {ultraInspectorOpen && selected && (
            <Inspector
              panelRef={inspectorRef}
              width={reading.inspectorWidth}
              onWidthChange={reading.setInspectorWidth}
              node={selected}
              edges={allEdges}
              byId={byId}
              onClose={() => setUltraInspectorOpen(false)}
              onFocus={(id) => setSelectedId(id)}
              onCopyLink={copyNodeLink}
              linkCopied={linkCopied}
              reference={referenceConfig}
              writable={writable}
              onReload={reload}
              isStatic={isStatic}
              connected={connection === 'live'}
              revision={syncedAt}
            />
          )}
        </main>
      ) : (
        <div className="relative flex min-h-0 flex-1">
          <WorkspaceSidebar
            open={dialogs.sidebarOpen}
            onClose={dialogs.closeSidebar}
            audit={audit}
            selectedId={selectedId}
            visibleIds={visibleIds}
            current={current}
            goals={agent.goals}
            openItems={openItems}
            findings={findings}
            inbox={inbox}
            counts={counts}
            filter={filter}
            onFilter={setFilter}
            filterOptions={filterOptions}
            results={results}
            provenanceMode={reading.auditProvenanceMode}
            changes={activeChanges}
            fresh={fresh}
            onSelect={focusNode}
            onSearch={() => dialogs.setPaletteOpen(true)}
            onShortcuts={() => dialogs.setShortcutsOpen(true)}
            onIssue={auditNav.chooseIssue}
            onCandidate={auditNav.chooseCandidate}
            onCandidateIssue={(id) => navigateWorkspace({ issueId: id })}
            onOpenArgument={auditNav.openAuditArgument}
            onExpand={expandAudit}
          />

          <main ref={viewportRef} className="relative flex min-w-0 flex-1 flex-col" aria-label={showAuditGraph ? t('audit.showGraph') : auditMode ? t('audit.dossier') : t('app.canvas')}>
            <div className="relative flex min-h-0 flex-1 flex-col" data-layout-transition={layoutTransition ? 'true' : undefined}>
              {audit && !showAuditGraph && (
                <div className="min-h-0 flex-1">
                  <AuditDossier
                    audit={audit}
                    selected={selected}
                    graphOpen={auditNav.auditGraphOpen}
                    inspectorPadding={auditInspectorPad}
                    provenanceMode={reading.auditProvenanceMode}
                    changes={activeChanges}
                    fresh={fresh}
                    onToggleGraph={auditNav.switchAuditSurface}
                    onSelect={focusNode}
                    onClearSelection={clearSelection}
                    onIssue={auditNav.chooseIssue}
                    onCandidate={auditNav.chooseCandidate}
                    onOpenArgument={auditNav.openAuditArgument}
                    onExpand={expandAudit}
                  />
                </div>
              )}
              {audit && showAuditGraph && (
                <AuditBlueprintBar
                  audit={audit}
                  graphOpen={auditNav.auditGraphOpen}
                  inspectorPadding={auditInspectorPad}
                  onToggleGraph={auditNav.switchAuditSurface}
                  onIssue={auditNav.chooseIssue}
                  onCandidate={auditNav.chooseCandidate}
                />
              )}
              <WorkspaceCanvas
                viewportRef={viewportRef}
                flatRef={flatRef}
                sceneRef={sceneRef}
                auditMode={auditMode}
                showAuditGraph={showAuditGraph}
                audit={audit}
                expandAudit={expandAudit}
                canvasMode={canvasMode}
                layoutMode={layoutMode}
                direction={canvas.direction}
                onToggleDirection={() => canvas.setDirection(canvas.direction === 'RIGHT' ? 'DOWN' : 'RIGHT')}
                theme={appearance.theme}
                canvasBackdrop={canvas.backdrop}
                projectionNodeCount={projection?.nodes.length ?? 0}
                allNodeCount={allNodes.length}
                nodes={nodes}
                edges={edges}
                displayNodes={displayNodes}
                displayEdges={displayEdges}
                highlighted={highlighted}
                selectedId={selectedId}
                selected={selected}
                currentId={currentId}
                byId={byId}
                legend={legend}
                laying={laying}
                scene3d={scene3d}
                openScene={openScene}
                closeScene={closeScene}
                occlusion={occlusion}
                auditOcclusionRight={auditOcclusion.right}
                exporting={exporting}
                exportImage={exportImage}
                showMap={canvas.showMap}
                onToggleMap={() => canvas.setShowMap((open) => !open)}
                showLegend={canvas.showLegend}
                onToggleLegend={() => canvas.setShowLegend((open) => !open)}
                onCloseLegend={() => canvas.setShowLegend(false)}
                showPeekHud={reading.showPeekHud}
                showZoomSlider={canvas.showZoomSlider}
                follow={motionSettings.follow}
                onToggleFollow={() => motionSettings.setFollow((value) => !value)}
                isStatic={isStatic}
                motion={motion}
                fresh={fresh}
                activeHoverId={activeHoverId}
                onHoverNode={setHoveredNodeId}
                handleNodesChange={handleNodesChange}
                onNodeClick={onNodeClick}
                clearSelection={clearSelection}
                focusNode={focusNode}
                focusNeighborhood={focusNeighborhood}
                fitCanvas={fitCanvas}
                triggerNeighborhood={triggerNeighborhood}
                onOpenSettings={() => dialogs.openSettings()}
                onShowAll={() => switchMode('all')}
                offlineShown={offlineShown}
                syncedAt={syncedAt}
                timelineActive={timeline.active}
                timelinePoint={timeline.point}
                asOf={asOf}
                onBackToNow={() => { timeline.pause(); setAsOf(null); }}
                pastPoint={snapshot.meta.asOf}
                hidden={hidden}
                notice={notice}
                flash={flash}
              />

              {selected && (
                <Inspector
                  panelRef={inspectorRef}
                  width={reading.inspectorWidth}
                  onWidthChange={reading.setInspectorWidth}
                  node={selected}
                  edges={allEdges}
                  byId={byId}
                  onClose={clearSelection}
                  onFocus={focusNode}
                  onFocusNeighborhood={(!auditMode || showAuditGraph) ? () => focusNeighborhood(selected.id, edges) : undefined}
                  onCopyLink={copyNodeLink}
                  linkCopied={linkCopied}
                  reference={referenceConfig}
                  writable={writable}
                  onReload={reload}
                  isStatic={isStatic}
                  connected={connection === 'live'}
                  revision={syncedAt}
                />
              )}
            </div>
          </main>
        </div>
      )}

      <WorkspaceDialogs
        chrome={chrome}
        embedded={presentation.embedded}
        build={snapshot.meta.build}
        isStatic={isStatic}
        writable={writable}
        ultraMode={ultraMode}
        auditMode={auditMode}
        timelineOpen={timelineOpen}
        setTimelineOpen={setTimelineOpen}
        timeline={timeline}
        setAsOf={setAsOf}
        paletteNodes={paletteNodes}
        byId={byId}
        digest={digest}
        copied={copied}
        copyDigest={copyDigest}
        digestTrigger={digestTrigger}
        agentId={agentId}
        checkpoints={snapshot?.checkpoints}
        connection={connection}
        syncedAt={syncedAt}
        canExport={!ultraMode && (!auditMode || showAuditGraph) && Boolean(projection?.nodes.length) && nodes.length > 0 && !exporting}
        exportImage={exportImage}
        onSelectNode={(id) => { if (ultraMode) { setSelectedId(id); setUltraPanelOpen(true); } else { focusNode(id); } }}
        onSwitchMode={switchMode}
        onToggleTheme={toggleTheme}
        onThemeMode={changeThemeMode}
        onCardTheme={changeCardTheme}
      />
    </div>
  );
}

export function App() {
  return <TooltipProvider delayDuration={300}><ReactFlowProvider><SessionDrafts><Workspace /></SessionDrafts></ReactFlowProvider></TooltipProvider>;
}
