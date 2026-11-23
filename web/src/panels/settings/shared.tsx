import { cn } from '@/lib/utils';
import type { CardTheme } from '../../card-themes';
import type { EdgeStyle } from '../../canvas/graph';
import type {
  AuditProvenanceMode,
  CanvasBackdrop,
  CodeFontScale,
  EdgeLabelMode,
  PortablePreferences,
  ThemeMode,
  UiFontScale,
} from '../../preferences';
import type { MotionMode } from '../../view-transition';

export type AppearanceSettings = {
  themeMode: ThemeMode;
  onThemeMode: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
  cardTheme: CardTheme;
  onCardTheme: (theme: CardTheme) => void;
  uiScale: UiFontScale;
  onUiScale: (scale: UiFontScale) => void;
  codeScale: CodeFontScale;
  onCodeScale: (scale: CodeFontScale) => void;
};

export type CanvasSettings = {
  backdrop: CanvasBackdrop;
  onBackdrop: (backdrop: CanvasBackdrop) => void;
  edgeStyle: EdgeStyle;
  onEdgeStyle: (style: EdgeStyle) => void;
  edgeLabelMode: EdgeLabelMode;
  onEdgeLabelMode: (mode: EdgeLabelMode) => void;
  direction: 'RIGHT' | 'DOWN';
  onDirection: (direction: 'RIGHT' | 'DOWN') => void;
  showZoomSlider: boolean;
  onShowZoomSlider: (next: boolean) => void;
  showMap: boolean;
  onShowMap: (next: boolean) => void;
  showLegend: boolean;
  onShowLegend: (next: boolean) => void;
};

export type ReadingSettings = {
  inspectorWidth: number;
  onInspectorWidth: (width: number) => void;
  auditProvenanceMode: AuditProvenanceMode;
  onAuditProvenanceMode: (mode: AuditProvenanceMode) => void;
  showCardLoc: boolean;
  onShowCardLoc: (next: boolean) => void;
  showPeekHud: boolean;
  onShowPeekHud: (next: boolean) => void;
  showChanges: boolean;
  onShowChanges: (next: boolean) => void;
  showEmptyActivity: boolean;
  onShowEmptyActivity: (next: boolean) => void;
};

export type MotionSettings = {
  motionMode: MotionMode;
  onMotionMode: (mode: MotionMode) => void;
  follow: boolean;
  onFollow: (next: boolean) => void;
};

export type SettingsController = {
  theme: 'light' | 'dark';
  appearance: AppearanceSettings;
  canvas: CanvasSettings;
  reading: ReadingSettings;
  motion: MotionSettings;
  onReset: () => void;
  onImport: (snapshot: Partial<PortablePreferences>) => void;
};

export function toPortablePreferences(settings: SettingsController): PortablePreferences {
  return {
    themeMode: settings.appearance.themeMode,
    cardTheme: settings.appearance.cardTheme,
    uiScale: settings.appearance.uiScale,
    codeScale: settings.appearance.codeScale,
    canvasBackdrop: settings.canvas.backdrop,
    edgeStyle: settings.canvas.edgeStyle,
    edgeLabelMode: settings.canvas.edgeLabelMode,
    direction: settings.canvas.direction,
    showCardLoc: settings.reading.showCardLoc,
    showPeekHud: settings.reading.showPeekHud,
    showZoomSlider: settings.canvas.showZoomSlider,
    showMap: settings.canvas.showMap,
    showLegend: settings.canvas.showLegend,
    follow: settings.motion.follow,
    auditProvenanceMode: settings.reading.auditProvenanceMode,
    showEmptyActivity: settings.reading.showEmptyActivity,
    showChanges: settings.reading.showChanges,
    inspectorWidth: settings.reading.inspectorWidth,
    motionMode: settings.motion.motionMode,
  };
}

export function PreferenceSwitch({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-medium leading-5 text-foreground">{label}</p>
        <p className="m-0 mt-0.5 text-xs leading-[18px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'border-foreground bg-foreground' : 'border-strong bg-secondary',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none block size-3.5 rounded-full shadow-2xs transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
            checked ? 'translate-x-[17px] bg-background' : 'translate-x-0.5 bg-foreground/75',
          )}
        />
      </button>
    </div>
  );
}
