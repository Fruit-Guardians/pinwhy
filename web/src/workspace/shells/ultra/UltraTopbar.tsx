import {
  FileText,
  History,
  LayoutGrid,
  Moon,
  Orbit,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { BrandMark } from '../../../BrandMark';
import { t } from '../../../i18n';
import type { WorkspaceMode } from '../../../types';
import type { Connection } from '../../../api/use-graph-stream';
import { runViewTransition } from '../../../view-transition';
import { UltraSegmented } from './UltraSegmented';

type Props = {
  goalTitle: string;
  statusText: string;
  isStatic: boolean;
  connection: Connection;
  theme: 'light' | 'dark';
  lens: 'constellation' | 'treemap' | 'gaps';
  activeSkin: 'obsidian' | 'carbon';
  writable: boolean;
  timelineOpen: boolean;
  panelOpen: boolean;
  onAbout?: () => void;
  onSetLens: (next: 'constellation' | 'treemap' | 'gaps') => void;
  onSetSkin: (next: 'obsidian' | 'carbon') => void;
  onSearch: () => void;
  onNew?: () => void;
  onTimeline?: () => void;
  onDigest: () => void;
  onTheme?: (origin?: { x: number; y: number }) => void;
  onSettings?: () => void;
  onResetView: () => void;
  onShowPanel: () => void;
  onWorkspace: (next: WorkspaceMode) => void;
};

export function UltraTopbar({
  goalTitle,
  statusText,
  isStatic,
  connection,
  theme,
  lens,
  activeSkin,
  writable,
  timelineOpen,
  panelOpen,
  onAbout,
  onSetLens,
  onSetSkin,
  onSearch,
  onNew,
  onTimeline,
  onDigest,
  onTheme,
  onSettings,
  onResetView,
  onShowPanel,
  onWorkspace,
}: Props) {
  return (
    <header className="flex h-[48px] shrink-0 items-center justify-between gap-3 border-b border-[var(--u-line)] bg-[var(--u-surface)] px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {onAbout ? (
          <button
            type="button"
            onClick={onAbout}
            aria-label={t('about.open')}
            className="-mx-1 inline-flex h-7 shrink-0 items-center gap-2 rounded-md px-1 outline-none transition-colors hover:bg-[var(--u-raise)] focus-visible:ring-2 focus-visible:ring-[var(--u-cyan)]"
          >
            <span className="shrink-0 text-[var(--u-cyan)]">
              <BrandMark size={18} />
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight text-[var(--u-ink)]">Pinwhy</span>
          </button>
        ) : (
          <>
            <span className="shrink-0 text-[var(--u-cyan)]">
              <BrandMark size={18} />
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight text-[var(--u-ink)]">Pinwhy</span>
          </>
        )}
        <span
          className="size-1.5 shrink-0 rounded-full"
          title={statusText}
          style={{
            background: isStatic ? 'var(--u-dim)' : connection === 'live' ? 'var(--u-mint)' : 'var(--u-crimson)',
          }}
        />
        <span className="h-3.5 w-px shrink-0 bg-[var(--u-line)] max-md:hidden" aria-hidden="true" />
        <span className="truncate text-xs text-[var(--u-ink-2)] max-md:hidden" title={goalTitle}>
          {goalTitle}
        </span>
      </div>

      {/* Center View Mode Switcher: Option B (Constellation) <-> Option C (Treemap) <-> Gate Audit */}
      <div className="flex shrink-0 items-center gap-2">
        <UltraSegmented
          ariaLabel="Ultra visual style switcher"
          value={lens}
          onChange={(next, origin) => runViewTransition(() => onSetLens(next), origin)}
          items={[
            {
              value: 'constellation',
              label: t('ultra.lens.constellation'),
              icon: <Orbit className="size-3.5" />,
              role: 'tab',
            },
            {
              value: 'treemap',
              label: t('ultra.lens.treemap'),
              icon: <LayoutGrid className="size-3.5" />,
              role: 'tab',
            },
            {
              value: 'gaps',
              label: t('ultra.lens.gaps'),
              icon: <ShieldCheck className="size-3.5" />,
              role: 'tab',
            },
          ]}
        />

        {lens !== 'gaps' && (
          <UltraSegmented
            ariaLabel="Theme skin override"
            compact
            className="max-xl:hidden"
            value={activeSkin}
            onChange={(next, origin) => runViewTransition(() => onSetSkin(next), origin)}
            items={[
              { value: 'obsidian', label: 'Obsidian' },
              { value: 'carbon', label: 'Carbon' },
            ]}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onSearch} className="ultra-btn">
          <Search className="size-3.5" />
          <span className="max-lg:hidden">{t('ultra.btn.find')}</span>
          <span className="ultra-mono text-[10px] text-[var(--u-dim)] max-xl:hidden">⌘K</span>
        </button>
        {writable && onNew && (
          <button type="button" onClick={onNew} className="ultra-btn ultra-btn-sky">
            <Plus className="size-3.5" />
            <span className="max-lg:hidden">{t('ultra.btn.newNode')}</span>
          </button>
        )}
        {onTimeline && (
          <button type="button" onClick={onTimeline} aria-pressed={timelineOpen} className="ultra-btn max-md:hidden">
            <History className="size-3.5" />
            <span className="max-2xl:hidden">{t('ultra.btn.timeline')}</span>
          </button>
        )}
        <button type="button" onClick={onDigest} className="ultra-btn max-lg:hidden">
          <FileText className="size-3.5" />
          <span className="max-2xl:hidden">{t('ultra.btn.digest')}</span>
        </button>
        {onTheme && (
          <button
            type="button"
            onClick={(event) => onTheme({ x: event.clientX, y: event.clientY })}
            aria-label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
            title={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
            className="ultra-btn px-2"
          >
            {theme === 'light' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
          </button>
        )}
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            aria-label={t('settings.open')}
            title={`${t('settings.open')} (⌘,)`}
            className="ultra-btn px-2"
          >
            <Settings2 className="size-3.5" />
          </button>
        )}
        {lens === 'constellation' && (
          <button type="button" onClick={onResetView} title={t('ultra.resetView')} className="ultra-btn px-2">
            <RotateCcw className="size-3.5" />
          </button>
        )}
        {lens !== 'gaps' && !panelOpen && (
          <button type="button" onClick={onShowPanel} title={t('ultra.inspector.showPanel')} className="ultra-btn px-2">
            <PanelRightOpen className="size-3.5" />
          </button>
        )}
        <UltraSegmented<'general' | 'audit' | 'ultra'>
          ariaLabel="Workspace switcher"
          value="ultra"
          onChange={(next) => {
            if (next !== 'ultra') onWorkspace(next);
          }}
          items={[
            { value: 'general', label: t('ultra.btn.general') },
            { value: 'audit', label: t('ultra.btn.audit') },
            { value: 'ultra', label: t('workspace.ultra') },
          ]}
        />
      </div>
    </header>
  );
}
