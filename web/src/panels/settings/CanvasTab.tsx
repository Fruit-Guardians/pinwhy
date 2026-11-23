import { AlignHorizontalSpaceAround, AlignVerticalSpaceAround, CornerDownRight, Slash, Spline } from 'lucide-react';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import type { EdgeStyle } from '../../canvas/graph';
import { t } from '../../i18n';
import { CANVAS_BACKDROPS, EDGE_LABEL_MODES, type CanvasBackdrop, type EdgeLabelMode } from '../../preferences';
import { PreferenceSwitch, type CanvasSettings } from './shared';

const BACKDROP_LABEL_KEY = {
  dots: 'settings.bgDots',
  lines: 'settings.bgLines',
  cross: 'settings.bgCross',
  plain: 'settings.bgPlain',
} as const;

const EDGE_LABEL_KEY = {
  auto: 'settings.labelsAuto',
  always: 'settings.labelsAlways',
  focus: 'settings.labelsFocus',
} as const;

export function CanvasTab({
  backdrop,
  onBackdrop,
  edgeStyle,
  onEdgeStyle,
  edgeLabelMode,
  onEdgeLabelMode,
  direction,
  onDirection,
  showZoomSlider,
  onShowZoomSlider,
  showMap,
  onShowMap,
  showLegend,
  onShowLegend,
}: CanvasSettings) {
  return (
    <section key="canvas" aria-label={t('settings.canvasSection')} className="anim-node-swap divide-y divide-border/70">
      <div className="space-y-2 pb-3">
        <span className="block text-[13px] font-medium text-foreground">{t('settings.canvasBackdrop')}</span>
        <Segmented<CanvasBackdrop> value={backdrop} onValueChange={onBackdrop} aria-label={t('settings.canvasBackdrop')} className="w-full">
          {CANVAS_BACKDROPS.map((option) => (
            <SegmentedItem key={option} value={option} className="flex-1 justify-center text-xs">
              {t(BACKDROP_LABEL_KEY[option])}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
        <span className="text-[13px] font-medium text-foreground">{t('toolbar.edgeStyle')}</span>
        <Segmented<EdgeStyle> value={edgeStyle} onValueChange={onEdgeStyle} aria-label={t('toolbar.edgeStyle')}>
          <SegmentedItem value="curve" className="text-xs"><Spline />{t('toolbar.curve')}</SegmentedItem>
          <SegmentedItem value="step" className="text-xs"><CornerDownRight />{t('toolbar.step')}</SegmentedItem>
          <SegmentedItem value="straight" className="text-xs"><Slash />{t('toolbar.straight')}</SegmentedItem>
        </Segmented>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-medium leading-5 text-foreground">{t('settings.edgeLabels')}</p>
          <p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{t('settings.edgeLabelsHint')}</p>
        </div>
        <Segmented<EdgeLabelMode> value={edgeLabelMode} onValueChange={onEdgeLabelMode} aria-label={t('settings.edgeLabels')} className="shrink-0">
          {EDGE_LABEL_MODES.map((modeOption) => (
            <SegmentedItem key={modeOption} value={modeOption} className="px-2 text-xs">
              {t(EDGE_LABEL_KEY[modeOption])}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
        <span className="text-[13px] font-medium text-foreground">{t('settings.layoutDirection')}</span>
        <Segmented<'RIGHT' | 'DOWN'> value={direction} onValueChange={onDirection} aria-label={t('settings.layoutDirection')}>
          <SegmentedItem value="RIGHT" className="text-xs"><AlignHorizontalSpaceAround />{t('settings.dirHorizontal')}</SegmentedItem>
          <SegmentedItem value="DOWN" className="text-xs"><AlignVerticalSpaceAround />{t('settings.dirVertical')}</SegmentedItem>
        </Segmented>
      </div>

      <PreferenceSwitch
        label={t('settings.showZoomSlider')}
        hint={t('settings.showZoomSliderHint')}
        checked={showZoomSlider}
        onCheckedChange={onShowZoomSlider}
      />
      <PreferenceSwitch
        label={t('settings.showMinimap')}
        hint={t('settings.showMinimapHint')}
        checked={showMap}
        onCheckedChange={onShowMap}
      />
      <PreferenceSwitch
        label={t('settings.showLegend')}
        hint={t('settings.showLegendHint')}
        checked={showLegend}
        onCheckedChange={onShowLegend}
      />
    </section>
  );
}
