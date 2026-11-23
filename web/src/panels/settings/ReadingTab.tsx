import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { t } from '../../i18n';
import { INSPECTOR_WIDTH_RANGE, type AuditProvenanceMode } from '../../preferences';
import { PreferenceSwitch, type ReadingSettings } from './shared';

export function ReadingTab({
  inspectorWidth,
  onInspectorWidth,
  auditProvenanceMode,
  onAuditProvenanceMode,
  showCardLoc,
  onShowCardLoc,
  showPeekHud,
  onShowPeekHud,
  showChanges,
  onShowChanges,
  showEmptyActivity,
  onShowEmptyActivity,
}: ReadingSettings) {
  return (
    <section key="reading" aria-label={t('settings.readingSection')} className="anim-node-swap divide-y divide-border/70">
      <div className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium leading-5 text-foreground">{t('settings.inspectorWidth')}</p>
            <p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{t('settings.inspectorWidthHint')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
              {inspectorWidth}px
            </span>
            {inspectorWidth !== INSPECTOR_WIDTH_RANGE.default && (
              <button
                type="button"
                onClick={() => onInspectorWidth(INSPECTOR_WIDTH_RANGE.default)}
                className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {INSPECTOR_WIDTH_RANGE.default}px
              </button>
            )}
          </div>
        </div>
        <Slider
          aria-label={t('settings.inspectorWidth')}
          min={INSPECTOR_WIDTH_RANGE.min}
          max={INSPECTOR_WIDTH_RANGE.max}
          step={10}
          value={[inspectorWidth]}
          onValueChange={(next) => onInspectorWidth(next[0])}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-medium leading-5 text-foreground">{t('settings.auditProvenance')}</p>
          <p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{t('settings.auditProvenanceHint')}</p>
        </div>
        <Segmented<AuditProvenanceMode>
          value={auditProvenanceMode}
          onValueChange={onAuditProvenanceMode}
          aria-label={t('settings.auditProvenance')}
          className="shrink-0"
        >
          <SegmentedItem value="auto" className="px-2 text-xs">{t('settings.provAuto')}</SegmentedItem>
          <SegmentedItem value="always" className="px-2 text-xs">{t('settings.provAlways')}</SegmentedItem>
          <SegmentedItem value="off" className="px-2 text-xs">{t('settings.provOff')}</SegmentedItem>
        </Segmented>
      </div>

      <PreferenceSwitch
        label={t('settings.showCardLoc')}
        hint={t('settings.showCardLocHint')}
        checked={showCardLoc}
        onCheckedChange={onShowCardLoc}
      />
      <PreferenceSwitch
        label={t('settings.showPeekHud')}
        hint={t('settings.showPeekHudHint')}
        checked={showPeekHud}
        onCheckedChange={onShowPeekHud}
      />
      <PreferenceSwitch
        label={t('settings.showTimelineChanges')}
        hint={t('settings.showTimelineChangesHint')}
        checked={showChanges}
        onCheckedChange={onShowChanges}
      />
      <PreferenceSwitch
        label={t('settings.showEmptyActivity')}
        hint={t('settings.showEmptyActivityHint')}
        checked={showEmptyActivity}
        onCheckedChange={onShowEmptyActivity}
      />
    </section>
  );
}
