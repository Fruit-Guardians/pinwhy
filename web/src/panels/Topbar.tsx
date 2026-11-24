import { useState, type RefObject } from 'react';
import { Check, ChevronDown, FileText, Focus, GitBranch, History, LayoutGrid, ListTree, Moon, MoreHorizontal, Orbit, PanelLeft, PanelRight, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sun, Users } from 'lucide-react';
import { Select } from 'radix-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { IconButton } from '@/components/icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandMark } from '../BrandMark';
import { ActivityPopover } from './ActivityPopover';
import type { Connection } from '../api/use-graph-stream';
import type { Activity, BuildInfo, ViewMode, WorkspaceMode } from '../types';
import { t } from '../i18n';

export type UltraLensMode = 'constellation' | 'treemap' | 'gaps';

type Props = {
  title: string;
  build?: BuildInfo;
  workspace: WorkspaceMode;
  onWorkspace: (workspace: WorkspaceMode) => void;
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  ultraLens?: UltraLensMode;
  onUltraLens?: (lens: UltraLensMode) => void;
  ultraPanelOpen?: boolean;
  onToggleUltraPanel?: () => void;
  onResetUltraView?: () => void;
  agentId: string;
  agentIds: string[];
  onAgent: (agentId: string) => void;
  theme: 'light' | 'dark';
  onTheme: (origin?: { x: number; y: number }) => void;
  connection: Connection;
  isStatic: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSearch: () => void;
  onDigest: () => void;
  onNew?: () => void;
  digestRef: RefObject<HTMLButtonElement | null>;
  activities: Activity[];
  activityTotal: number;
  showEmptyActivity?: boolean;
  timelineOpen: boolean;
  /** Absent where there is no server to replay the log (offline HTML). */
  onTimeline?: () => void;
  onSettings?: () => void;
  onAbout?: () => void;
  /**
   * A host page frames the board: one compact row, no product chrome (about, version, appearance —
   * the host owns those), and the remaining controls grouped so none of them become unreachable.
   */
  compact?: boolean;
};

const CONNECTION = {
  connecting: { label: t('topbar.connecting'), dot: 'bg-strong' },
  live: { label: t('topbar.live'), dot: 'bg-live' },
  offline: { label: t('topbar.offline'), dot: 'bg-destructive' },
} as const;

/** The three canvas views are the same choice in both presentations. */
function ViewSwitcher({ mode, onMode }: { mode: ViewMode; onMode: (mode: ViewMode) => void }) {
  return (
    <Segmented<ViewMode> value={mode} onValueChange={onMode} aria-label={t('topbar.views')}>
      <SegmentedItem value="context" aria-label={t('view.contextLabel')}><Focus /><span className="max-sm:hidden">{t('view.context')}</span></SegmentedItem>
      <SegmentedItem value="logic" aria-label={t('view.logicLabel')}><GitBranch /><span className="max-sm:hidden">{t('view.logic')}</span></SegmentedItem>
      <SegmentedItem value="all" aria-label={t('view.allLabel')}><ListTree /><span className="max-sm:hidden">{t('view.all')}</span></SegmentedItem>
    </Segmented>
  );
}

/** The three Ultra lenses mirror ViewSwitcher inside the unified Topbar. */
function UltraLensSwitcher({ lens, onLens }: { lens: UltraLensMode; onLens: (lens: UltraLensMode) => void }) {
  return (
    <Segmented<UltraLensMode> value={lens} onValueChange={onLens} aria-label={t('topbar.views')}>
      <SegmentedItem value="constellation" aria-label={t('ultra.lens.constellation')}><Orbit /><span className="max-sm:hidden">{t('ultra.lens.constellation')}</span></SegmentedItem>
      <SegmentedItem value="treemap" aria-label={t('ultra.lens.treemap')}><LayoutGrid /><span className="max-sm:hidden">{t('ultra.lens.treemap')}</span></SegmentedItem>
      <SegmentedItem value="gaps" aria-label={t('ultra.lens.gaps')}><ShieldCheck /><span className="max-sm:hidden">{t('ultra.lens.gaps')}</span></SegmentedItem>
    </Segmented>
  );
}

const MENU_ROW = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent';

export function Topbar(props: Props) {
  const { title, build, workspace, onWorkspace, mode, onMode, ultraLens, onUltraLens, ultraPanelOpen, onToggleUltraPanel, onResetUltraView, agentId, agentIds, onAgent, theme, onTheme, connection, isStatic, sidebarOpen, onToggleSidebar, onSearch, onDigest, onNew, digestRef, activities, activityTotal, showEmptyActivity = false, timelineOpen, onTimeline, onSettings, onAbout, compact } = props;
  const status = isStatic ? { label: t('topbar.static'), dot: 'bg-strong' } : CONNECTION[connection];
  const showActivity = activityTotal > 0 || activities.length > 0 || showEmptyActivity;
  const [menuOpen, setMenuOpen] = useState(false);

  if (compact) {
    // A framed board gets one row at any width: the host already renders the page heading,
    // version, about and appearance switch, so repeating them here would be a second header.
    return (
      <header data-presentation="embedded" className="flex h-11 shrink-0 items-center gap-1.5 border-b bg-background px-2">
        {workspace !== 'ultra' && (
          <IconButton label={sidebarOpen ? t('topbar.collapseNav') : t('topbar.expandNav')} aria-pressed={sidebarOpen} onClick={onToggleSidebar}><PanelLeft /></IconButton>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-medium text-subtle" title={title}>{title}</span>
          <span role="status" title={status.label} className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <i className={cn('size-1.5 rounded-full', status.dot)} /><span className="max-xl:sr-only">{status.label}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={t('topbar.search')} onClick={onSearch}><Search /></IconButton>
          {workspace === 'general' && <ViewSwitcher mode={mode} onMode={onMode} />}
          {workspace === 'ultra' && ultraLens && onUltraLens && <UltraLensSwitcher lens={ultraLens} onLens={onUltraLens} />}
          {showActivity && <ActivityPopover activities={activities} total={activityTotal} />}
          {workspace === 'ultra' && ultraLens !== 'gaps' && onToggleUltraPanel && (
            <IconButton label={ultraPanelOpen ? t('ultra.inspector.hidePanel') : t('ultra.inspector.showPanel')} aria-pressed={Boolean(ultraPanelOpen)} onClick={onToggleUltraPanel}><PanelRight /></IconButton>
          )}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild ref={digestRef}>
              <Button size="icon-sm" aria-label={t('palette.commands')} title={t('palette.commands')} aria-haspopup="menu" data-compact-menu><MoreHorizontal /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} collisionPadding={8} className="w-60 p-1.5" data-compact-menu-content>
              <p className="m-0 px-2 pb-1.5 text-xs font-medium text-muted-foreground">{t('workspace.label')}</p>
              <Segmented<WorkspaceMode> className="w-full" value={workspace} onValueChange={(next) => { onWorkspace(next); setMenuOpen(false); }} aria-label={t('workspace.label')}>
                <SegmentedItem className="flex-1 justify-center" value="general">{t('workspace.general')}</SegmentedItem>
                <SegmentedItem className="flex-1 justify-center" value="audit">{t('workspace.audit')}</SegmentedItem>
                <SegmentedItem className="flex-1 justify-center" value="ultra">{t('workspace.ultra')}</SegmentedItem>
              </Segmented>
              {agentIds.length > 1 && (
                <>
                  <p className="m-0 px-2 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">{t('topbar.agent')}</p>
                  <div className="max-h-44 overflow-y-auto">
                    {agentIds.map((id) => (
                      <button key={id} type="button" title={id} aria-pressed={id === agentId} className={MENU_ROW} onClick={() => { onAgent(id); setMenuOpen(false); }}>
                        <span className="min-w-0 flex-1 truncate text-left">{id.replace(/^agent:/, '')}</span>
                        {id === agentId && <Check className="size-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="my-1.5 h-px bg-border" />
              <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); onDigest(); }}>
                <FileText className="size-3.5 shrink-0" /><span className="flex-1 text-left">{t('topbar.digest')}</span>
              </button>
              {onTimeline && (
                <button type="button" className={MENU_ROW} aria-pressed={timelineOpen} onClick={() => { setMenuOpen(false); onTimeline(); }}>
                  <History className="size-3.5 shrink-0" /><span className="flex-1 text-left">{timelineOpen ? t('timeline.close') : t('timeline.open')}</span>
                  {timelineOpen && <Check className="size-3.5 shrink-0" />}
                </button>
              )}
              {onNew && (
                <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); onNew(); }}>
                  <Plus className="size-3.5 shrink-0" /><span className="flex-1 text-left">{t('topbar.new')}</span>
                </button>
              )}
              {onSettings && (
                <button type="button" className={MENU_ROW} onClick={() => { setMenuOpen(false); onSettings(); }}>
                  <Settings2 className="size-3.5 shrink-0" /><span className="flex-1 text-left">{t('settings.open')}</span>
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </header>
    );
  }

  return (
    <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b bg-background px-3 py-2 lg:h-12 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-4 lg:py-0">
      <div className="flex min-w-0 items-center gap-2">
        {workspace !== 'ultra' && (
          <IconButton label={sidebarOpen ? t('topbar.collapseNav') : t('topbar.expandNav')} aria-pressed={sidebarOpen} onClick={onToggleSidebar}><PanelLeft /></IconButton>
        )}
        <button
          type="button"
          aria-label={t('about.open')}
          onClick={onAbout}
          className="-mx-1 inline-flex h-7 shrink-0 items-center gap-2 rounded-md px-1 text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark size={18} />
          <span className="text-sm font-semibold tracking-[-0.01em] max-md:hidden">Pinwhy</span>
        </button>
        {build && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={t('topbar.version', { version: build.version })} className="shrink-0 rounded px-1 text-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">v{build.version}</button>
            </TooltipTrigger>
            <TooltipContent className="block max-w-[min(32rem,calc(100vw-24px))] break-words p-3 font-normal" side="bottom">
              <p className="mb-2 font-semibold">{t('topbar.version', { version: build.version })}</p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt>{t('topbar.build')}</dt><dd className="break-all font-mono">{build.buildId}</dd>
                <dt>{t('topbar.source')}</dt><dd>{t(`topbar.source.${build.origin.kind}`)}{build.origin.version ? ` · ${build.origin.version}` : ''}</dd>
                {build.commit && <><dt>{t('topbar.commit')}</dt><dd className="break-all font-mono">{build.commit}</dd></>}
                {build.dirty !== null && <><dt>{t('topbar.worktree')}</dt><dd>{t(build.dirty ? 'topbar.dirty' : 'topbar.clean')}</dd></>}
                {build.origin.active !== undefined && <><dt>{t('topbar.release')}</dt><dd>{t(build.origin.active ? 'topbar.active' : 'topbar.inactive')}</dd></>}
                {build.origin.root && <><dt>{t('topbar.root')}</dt><dd className="break-all font-mono">{build.origin.root}</dd></>}
              </dl>
            </TooltipContent>
          </Tooltip>
        )}
        <span className="text-muted-foreground max-md:hidden">/</span>
        <span className="min-w-0 truncate text-sm text-subtle" title={title}>{title}</span>
      </div>

      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center justify-center gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex-nowrap">
        <Segmented<WorkspaceMode> value={workspace} onValueChange={onWorkspace} aria-label={t('workspace.label')}>
          <SegmentedItem value="general">{t('workspace.general')}</SegmentedItem>
          <SegmentedItem value="audit">{t('workspace.audit')}</SegmentedItem>
          <SegmentedItem value="ultra">{t('workspace.ultra')}</SegmentedItem>
        </Segmented>
        {workspace === 'general' && <Segmented<ViewMode> value={mode} onValueChange={onMode} aria-label={t('topbar.views')}>
          <SegmentedItem value="context" aria-label={t('view.contextLabel')}><Focus /><span className="max-sm:hidden">{t('view.context')}</span></SegmentedItem>
          <SegmentedItem value="logic" aria-label={t('view.logicLabel')}><GitBranch /><span className="max-sm:hidden">{t('view.logic')}</span></SegmentedItem>
          <SegmentedItem value="all" aria-label={t('view.allLabel')}><ListTree /><span className="max-sm:hidden">{t('view.all')}</span></SegmentedItem>
        </Segmented>}
        {workspace === 'ultra' && ultraLens && onUltraLens && <UltraLensSwitcher lens={ultraLens} onLens={onUltraLens} />}
        {agentIds.length > 1 && (
          <Select.Root value={agentId} onValueChange={onAgent}>
            <Select.Trigger asChild aria-label={t('topbar.agent')} title={`${t('topbar.agentHint')}\n${agentId}`}>
              <Button variant="outline" size="sm" className="h-8 min-w-0 max-w-40 rounded-lg px-2.5 text-xs">
                <Users className="size-3.5" />
                <span className="min-w-0 truncate"><Select.Value /></span>
                <Select.Icon asChild><ChevronDown className="size-3 text-muted-foreground" /></Select.Icon>
              </Button>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" align="end" sideOffset={8} collisionPadding={12} className="anim-surface z-50 max-h-[min(320px,var(--radix-select-content-available-height))] max-w-[min(24rem,calc(100vw-24px))] min-w-48 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-float">
                <Select.Viewport className="p-1">
                  <Select.Group>
                    <Select.Label className="px-2 py-1.5 text-xs text-muted-foreground">{t('topbar.agent')}</Select.Label>
                    {agentIds.map((id) => (
                      <Select.Item key={id} value={id} title={id} className="relative flex cursor-default items-center rounded-md py-2 pr-8 pl-2 text-xs outline-none data-highlighted:bg-accent data-highlighted:text-foreground">
                        <Select.ItemText><span className="block truncate">{id.replace(/^agent:/, '')}</span></Select.ItemText>
                        <Select.ItemIndicator className="absolute right-2"><Check className="size-3.5" /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        )}
      </div>

      <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 lg:col-start-3">
        <span role="status" title={status.label} className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <i className={cn('size-1.5 rounded-full', status.dot)} /><span className="max-xl:sr-only">{status.label}</span>
        </span>
        <Button
          size="sm"
          variant="ghost"
          className={cn('max-md:hidden bg-secondary/60 text-subtle hover:bg-secondary hover:text-foreground', workspace !== 'ultra' && sidebarOpen && 'lg:hidden')}
          onClick={onSearch}
          aria-label={t('topbar.searchCommands')}
        >
          <Search className="size-3.5" /><Kbd>⌘K</Kbd>
        </Button>
        <IconButton label={t('topbar.search')} className="md:hidden" onClick={onSearch}><Search /></IconButton>
        {showActivity && <ActivityPopover activities={activities} total={activityTotal} />}
        {onTimeline && <IconButton label={timelineOpen ? t('timeline.close') : t('timeline.open')} aria-pressed={timelineOpen} onClick={onTimeline}><History /></IconButton>}
        {onNew && <Button size="sm" variant="default" className="shadow-xs" onClick={onNew} aria-label={t('topbar.newNode')}><Plus className="size-3.5" /><span className="max-sm:hidden">{t('topbar.new')}</span></Button>}
        <Button ref={digestRef} size="sm" variant="ghost" className="text-subtle hover:text-foreground" onClick={onDigest} aria-label={t('topbar.digestLabel')}><FileText className="size-3.5" /><span className="max-sm:hidden">{t('topbar.digest')}</span></Button>
        {workspace === 'ultra' && ultraLens === 'constellation' && onResetUltraView && (
          <IconButton label={t('ultra.resetView')} onClick={onResetUltraView}><RotateCcw /></IconButton>
        )}
        {workspace === 'ultra' && ultraLens !== 'gaps' && onToggleUltraPanel && (
          <IconButton label={ultraPanelOpen ? t('ultra.inspector.hidePanel') : t('ultra.inspector.showPanel')} aria-pressed={Boolean(ultraPanelOpen)} onClick={onToggleUltraPanel}><PanelRight /></IconButton>
        )}
        {onSettings && <IconButton label={t('settings.open')} shortcut="⌘," onClick={onSettings}><Settings2 /></IconButton>}
        <IconButton label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')} onClick={(event) => onTheme({ x: event.clientX, y: event.clientY })}>{theme === 'light' ? <Moon /> : <Sun />}</IconButton>
      </div>
    </header>
  );
}
