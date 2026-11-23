import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Palette, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { BrandMark } from '../BrandMark';
import { t } from '../i18n';
import { parsePreferencesSnapshot, serializePreferences } from '../preferences';
import type { BuildInfo } from '../types';
import type { SettingsTab } from '../workspace/use-workspace-chrome';
import { AboutPanel } from './AboutPanel';
import { AppearanceTab } from './settings/AppearanceTab';
import { CanvasTab } from './settings/CanvasTab';
import { ReadingTab } from './settings/ReadingTab';
import { MotionTab, type PresetImportDraft } from './settings/MotionTab';
import { toPortablePreferences, type SettingsController } from './settings/shared';

export type { SettingsController };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  embedded?: boolean;
  build?: BuildInfo;
  isStatic: boolean;
  settings: SettingsController;
};

export function SettingsDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  embedded = false,
  build,
  isStatic,
  settings,
}: Props) {
  const [presetCopied, setPresetCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!open) {
      clearTimeout(copyTimer.current);
      setImportOpen(false);
      setImportText('');
      setImportFeedback(null);
      setPresetCopied(false);
    }
  }, [open]);

  async function copyPreset() {
    const json = serializePreferences(toPortablePreferences(settings));
    try {
      await navigator.clipboard.writeText(json);
      setPresetCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setPresetCopied(false), 1800);
    } catch {
      setImportFeedback({ kind: 'err', text: t('app.clipboardFailed') });
    }
  }

  function applyImportedPreset() {
    const parsed = parsePreferencesSnapshot(importText);
    if (!parsed.ok) {
      setImportFeedback({ kind: 'err', text: t('settings.importInvalid') });
      return;
    }
    settings.onImport(parsed.value);
    setImportFeedback({ kind: 'ok', text: t('settings.importSuccess') });
    setImportText('');
  }

  const presetDraft: PresetImportDraft = {
    presetCopied,
    importOpen,
    importText,
    importFeedback,
    onCopyPreset: () => { void copyPreset(); },
    onToggleImport: () => { setImportOpen((v) => !v); setImportFeedback(null); },
    onImportTextChange: (next) => { setImportText(next); setImportFeedback(null); },
    onApplyImport: applyImportedPreset,
  };

  useEffect(() => {
    if (embedded && tab === 'appearance') onTabChange('canvas');
  }, [embedded, tab, onTabChange]);

  const navItems: ReadonlyArray<{ id: Exclude<SettingsTab, 'about'>; label: string; icon: typeof Palette }> = [
    ...(!embedded ? [{ id: 'appearance' as const, label: t('settings.appearance'), icon: Palette }] : []),
    { id: 'canvas', label: t('settings.canvasSection'), icon: LayoutGrid },
    { id: 'reading', label: t('settings.readingSection'), icon: SlidersHorizontal },
    { id: 'motion', label: t('settings.motionSection'), icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] overflow-hidden p-0 sm:rounded-2xl">
        <div className="flex max-h-[min(86dvh,600px)] flex-col sm:grid sm:h-[min(82dvh,560px)] sm:grid-cols-[192px_minmax(0,1fr)]">
          <aside
            aria-label={t('settings.title')}
            className="hidden border-r bg-secondary/25 p-3 sm:flex sm:flex-col"
          >
            <div className="px-2 pt-1 pb-3">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pinwhy</p>
              <p className="m-0 mt-0.5 text-sm font-semibold text-foreground">{t('settings.title')}</p>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-border/70 pt-2.5">
              <button
                type="button"
                aria-current={tab === 'about' ? 'page' : undefined}
                onClick={() => onTabChange('about')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  tab === 'about'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <BrandMark size={15} />
                <span className="truncate">{t('about.tab')}</span>
                {build && (
                  <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    v{build.version}
                  </span>
                )}
              </button>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <header className="shrink-0 border-b px-4 pt-3.5 pb-3 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="m-0 text-[15px] font-semibold text-foreground">
                    {tab === 'about' ? t('about.open') : t('settings.title')}
                  </DialogTitle>
                  <DialogDescription className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground">
                    {tab === 'about' ? t('about.tagline') : t('settings.description')}
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button size="icon-sm" aria-label={t('common.close')}><X /></Button>
                </DialogClose>
              </div>

              <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5 sm:hidden">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-foreground bg-secondary text-foreground'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-current={tab === 'about' ? 'page' : undefined}
                  onClick={() => onTabChange('about')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tab === 'about'
                      ? 'border-foreground bg-secondary text-foreground'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  <BrandMark size={13} />
                  <span>{t('about.tab')}</span>
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {tab === 'appearance' && !embedded && <AppearanceTab {...settings.appearance} />}
              {tab === 'canvas' && <CanvasTab {...settings.canvas} />}
              {tab === 'reading' && <ReadingTab {...settings.reading} />}
              {tab === 'motion' && <MotionTab embedded={embedded} settings={settings} presetDraft={presetDraft} />}
              {tab === 'about' && (
                <AboutPanel
                  build={build}
                  isStatic={isStatic}
                  theme={settings.theme}
                  motionReduced={settings.motion.motionMode === 'reduced'}
                />
              )}
            </div>

            {tab !== 'about' && (
              <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-secondary/25 px-4 py-2.5 sm:px-5">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Kbd>⌘ ,</Kbd>
                  <span className="truncate">{t('settings.localNote')}</span>
                </span>
                <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 px-2.5 text-xs" onClick={settings.onReset}>
                  <RotateCcw className="size-3" />
                  {t('settings.reset')}
                </Button>
              </footer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
