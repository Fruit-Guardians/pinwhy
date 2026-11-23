import type { RefObject } from 'react';
import type { CardTheme } from '../card-themes';
import { CommandPalette } from '../panels/CommandPalette';
import { DigestDialog } from '../panels/DigestDialog';
import { NewNodeDialog } from '../panels/EditPanel';
import { SettingsDialog, type SettingsController } from '../panels/SettingsDialog';
import { ShortcutsDialog } from '../panels/ShortcutsDialog';
import { TimelineBar } from '../panels/TimelineBar';
import type { ThemeMode } from '../preferences';
import { WriteRecovery } from '../session-drafts';
import type { BoardNode, BuildInfo, Checkpoint, CheckpointChanges, ViewMode } from '../types';
import type { Connection } from '../api/use-graph-stream';
import type { TimelinePoint } from './use-workspace-timeline';
import type { useWorkspaceChrome } from './use-workspace-chrome';

type Chrome = ReturnType<typeof useWorkspaceChrome>;

type TimelineState = {
  points: TimelinePoint[];
  position: number;
  active: boolean;
  loading: boolean;
  error: string | null;
  previousId: string | null;
  changes: { key: string; data: CheckpointChanges | null; error: string | null } | null;
  playing: boolean;
  play: () => void;
  pause: () => void;
  goTo: (next: number) => void;
};

type Props = {
  chrome: Chrome;
  embedded: boolean;
  build?: BuildInfo;
  isStatic: boolean;
  writable: boolean;
  ultraMode: boolean;
  auditMode: boolean;
  timelineOpen: boolean;
  setTimelineOpen: (open: boolean) => void;
  timeline: TimelineState;
  setAsOf: (ref: string | null) => void;
  paletteNodes: BoardNode[];
  byId: Map<string, BoardNode>;
  digest: string;
  copied: boolean;
  copyDigest: () => void;
  digestTrigger: RefObject<HTMLButtonElement | null>;
  agentId: string;
  checkpoints?: Record<string, Checkpoint>;
  connection: Connection;
  syncedAt: number | null;
  canExport: boolean;
  exportImage: () => void;
  onSelectNode: (id: string) => void;
  onSwitchMode: (mode: ViewMode) => void;
  onToggleTheme: (origin?: { x: number; y: number }) => void;
  onThemeMode: (next: ThemeMode, origin?: { x: number; y: number }) => void;
  onCardTheme: (next: CardTheme) => void;
};

export function WorkspaceDialogs({
  chrome,
  embedded,
  build,
  isStatic,
  writable,
  ultraMode,
  auditMode,
  timelineOpen,
  setTimelineOpen,
  timeline,
  setAsOf,
  paletteNodes,
  byId,
  digest,
  copied,
  copyDigest,
  digestTrigger,
  agentId,
  checkpoints,
  connection,
  syncedAt,
  canExport,
  exportImage,
  onSelectNode,
  onSwitchMode,
  onToggleTheme,
  onThemeMode,
  onCardTheme,
}: Props) {
  const { appearance, canvas, reading, motion, dialogs, resetPreferences, applyPreferencesSnapshot } = chrome;

  const settingsController: SettingsController = {
    theme: appearance.theme,
    appearance: {
      themeMode: appearance.themeMode,
      onThemeMode,
      cardTheme: appearance.cardTheme,
      onCardTheme,
      uiScale: appearance.uiScale,
      onUiScale: appearance.setUiScale,
      codeScale: appearance.codeScale,
      onCodeScale: appearance.setCodeScale,
    },
    canvas: {
      backdrop: canvas.backdrop,
      onBackdrop: canvas.setBackdrop,
      edgeStyle: canvas.edgeStyle,
      onEdgeStyle: canvas.setEdgeStyle,
      edgeLabelMode: canvas.edgeLabelMode,
      onEdgeLabelMode: canvas.setEdgeLabelMode,
      direction: canvas.direction,
      onDirection: canvas.setDirection,
      showZoomSlider: canvas.showZoomSlider,
      onShowZoomSlider: canvas.setShowZoomSlider,
      showMap: canvas.showMap,
      onShowMap: canvas.setShowMap,
      showLegend: canvas.showLegend,
      onShowLegend: canvas.setShowLegend,
    },
    reading: {
      inspectorWidth: reading.inspectorWidth,
      onInspectorWidth: reading.setInspectorWidth,
      auditProvenanceMode: reading.auditProvenanceMode,
      onAuditProvenanceMode: reading.setAuditProvenanceMode,
      showCardLoc: reading.showCardLoc,
      onShowCardLoc: reading.setShowCardLoc,
      showPeekHud: reading.showPeekHud,
      onShowPeekHud: reading.setShowPeekHud,
      showChanges: reading.showChanges,
      onShowChanges: reading.setShowChanges,
      showEmptyActivity: reading.showEmptyActivity,
      onShowEmptyActivity: reading.setShowEmptyActivity,
    },
    motion: {
      motionMode: motion.motionMode,
      onMotionMode: motion.setMotionMode,
      follow: motion.follow,
      onFollow: motion.setFollow,
    },
    onReset: resetPreferences,
    onImport: applyPreferencesSnapshot,
  };

  return (
    <>
      {timelineOpen && !isStatic && (
        <TimelineBar
          points={timeline.points}
          position={timeline.position}
          active={timeline.active}
          loading={timeline.loading}
          error={timeline.error}
          previousId={timeline.previousId}
          changes={timeline.changes}
          showChanges={reading.showChanges}
          onShowChanges={reading.setShowChanges}
          playing={timeline.playing}
          onPlay={timeline.play}
          onPause={timeline.pause}
          onGoTo={timeline.goTo}
          onClose={() => { timeline.pause(); setAsOf(null); setTimelineOpen(false); }}
        />
      )}

      <CommandPalette
        open={dialogs.paletteOpen}
        onOpenChange={dialogs.setPaletteOpen}
        nodes={paletteNodes}
        theme={appearance.theme}
        cardTheme={appearance.cardTheme}
        copied={copied}
        onSelect={onSelectNode}
        onMode={auditMode || ultraMode ? undefined : onSwitchMode}
        onTheme={onToggleTheme}
        onCardTheme={onCardTheme}
        onCopyDigest={copyDigest}
        onExport={canExport ? exportImage : null}
        onShortcuts={() => dialogs.setShortcutsOpen(true)}
        onSettings={() => dialogs.openSettings()}
        onAbout={() => dialogs.openSettings('about')}
      />

      <SettingsDialog
        open={dialogs.settingsOpen}
        onOpenChange={dialogs.setSettingsOpen}
        tab={dialogs.settingsTab}
        onTabChange={dialogs.setSettingsTab}
        embedded={embedded}
        build={build}
        isStatic={isStatic}
        settings={settingsController}
      />

      <ShortcutsDialog open={dialogs.shortcutsOpen} onOpenChange={dialogs.setShortcutsOpen} />
      <WriteRecovery writable={writable} />
      {writable && <NewNodeDialog open={dialogs.newOpen} onOpenChange={dialogs.setNewOpen} />}
      <DigestDialog
        open={dialogs.digestOpen}
        onOpenChange={dialogs.setDigestOpen}
        digest={digest}
        copied={copied}
        onCopy={copyDigest}
        returnFocus={digestTrigger}
        byId={byId}
        onFocus={onSelectNode}
        agentId={agentId}
        checkpoints={checkpoints}
        isStatic={isStatic}
        connected={connection === 'live'}
        revision={syncedAt}
      />
    </>
  );
}
