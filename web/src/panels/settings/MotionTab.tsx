import { Check, Copy, Sparkles, Upload, ZapOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { t } from '../../i18n';
import type { MotionMode } from '../../view-transition';
import { PreferenceSwitch, type SettingsController } from './shared';

export type PresetImportDraft = {
  presetCopied: boolean;
  importOpen: boolean;
  importText: string;
  importFeedback: { kind: 'ok' | 'err'; text: string } | null;
  onCopyPreset: () => void;
  onToggleImport: () => void;
  onImportTextChange: (next: string) => void;
  onApplyImport: () => void;
};

export function MotionTab({
  embedded,
  settings,
  presetDraft,
}: {
  embedded: boolean;
  settings: SettingsController;
  presetDraft: PresetImportDraft;
}) {
  const { motion } = settings;
  const {
    presetCopied,
    importOpen,
    importText,
    importFeedback,
    onCopyPreset,
    onToggleImport,
    onImportTextChange,
    onApplyImport,
  } = presetDraft;

  return (
    <section key="motion" aria-label={t('settings.motionSection')} className="anim-node-swap space-y-3.5 py-1">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-secondary/25 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-medium leading-5 text-foreground">{t('settings.motion')}</p>
          <p className="m-0 mt-1 text-xs leading-5 text-muted-foreground">{t('settings.motionHint')}</p>
        </div>
        <Segmented<MotionMode> value={motion.motionMode} onValueChange={motion.onMotionMode} aria-label={t('settings.motion')} className="shrink-0">
          <SegmentedItem value="fluid" className="text-xs"><Sparkles />{t('settings.motionFluid')}</SegmentedItem>
          <SegmentedItem value="reduced" className="text-xs"><ZapOff />{t('settings.motionReduced')}</SegmentedItem>
        </Segmented>
      </div>

      <div className="rounded-xl border px-3.5 py-0.5">
        <PreferenceSwitch
          label={t('settings.followAgent')}
          hint={t('settings.followAgentHint')}
          checked={motion.follow}
          onCheckedChange={motion.onFollow}
        />
      </div>

      {!embedded && (
        <div className="rounded-xl border bg-card p-3.5">
          <p className="m-0 text-[13px] font-medium text-foreground">{t('settings.presetTitle')}</p>
          <p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{t('settings.presetHint')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onCopyPreset}>
              {presetCopied ? <Check className="size-3 text-live" /> : <Copy className="size-3" />}
              {t(presetCopied ? 'settings.presetCopied' : 'settings.copyPreset')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onToggleImport}
            >
              <Upload className="size-3" />
              {t('settings.importPreset')}
            </Button>
          </div>

          {importOpen && (
            <div className="anim-disclosure-in mt-3 space-y-2 border-t border-border/70 pt-3">
              <textarea
                value={importText}
                onChange={(event) => onImportTextChange(event.target.value)}
                placeholder={t('settings.importPlaceholder')}
                rows={4}
                className="w-full resize-y rounded-lg border bg-background p-2 font-mono text-[11px] leading-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  role="status"
                  className={cn(
                    'text-xs',
                    importFeedback?.kind === 'err' ? 'text-destructive' : 'text-live',
                  )}
                >
                  {importFeedback?.text || ''}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!importText.trim()}
                  onClick={onApplyImport}
                >
                  {t('settings.importApply')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
