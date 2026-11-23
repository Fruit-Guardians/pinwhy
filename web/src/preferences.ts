import { parseCardTheme, type CardTheme } from './card-themes';
import { isRecord, type EmbedFontTarget } from './api/embedded';
import type { EdgeStyle } from './canvas/graph';
import type { MotionMode } from './view-transition';

export type ThemeMode = 'system' | 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

export type UiFontScale = 'compact' | 'default' | 'comfortable' | 'large';
export const UI_FONT_SCALES: readonly UiFontScale[] = ['compact', 'default', 'comfortable', 'large'];
export const DEFAULT_UI_FONT_SCALE: UiFontScale = 'default';

export type CodeFontScale = 'compact' | 'default' | 'comfortable' | 'large';
export const CODE_FONT_SCALES: readonly CodeFontScale[] = ['compact', 'default', 'comfortable', 'large'];
export const DEFAULT_CODE_FONT_SCALE: CodeFontScale = 'default';

export type CanvasBackdrop = 'dots' | 'lines' | 'cross' | 'plain';
export const CANVAS_BACKDROPS: readonly CanvasBackdrop[] = ['dots', 'lines', 'cross', 'plain'];
export const DEFAULT_CANVAS_BACKDROP: CanvasBackdrop = 'dots';

export type EdgeLabelMode = 'auto' | 'always' | 'focus';
export const EDGE_LABEL_MODES: readonly EdgeLabelMode[] = ['auto', 'always', 'focus'];
export const DEFAULT_EDGE_LABEL_MODE: EdgeLabelMode = 'auto';

export type AuditProvenanceMode = 'auto' | 'always' | 'off';
export const AUDIT_PROVENANCE_MODES: readonly AuditProvenanceMode[] = ['auto', 'always', 'off'];

export const EDGE_STYLES: readonly EdgeStyle[] = ['curve', 'step', 'straight'];
export const LAYOUT_DIRECTIONS: readonly ('RIGHT' | 'DOWN')[] = ['RIGHT', 'DOWN'];
export const MOTION_MODES: readonly MotionMode[] = ['fluid', 'reduced'];

export const INSPECTOR_WIDTH_RANGE = { min: 340, max: 560, default: 380 } as const;

export const PREFERENCES_SCHEMA = 'pinwhy.preferences.v1';

export type PortablePreferences = {
  themeMode: ThemeMode;
  cardTheme: CardTheme;
  uiScale: UiFontScale;
  codeScale: CodeFontScale;
  canvasBackdrop: CanvasBackdrop;
  edgeStyle: EdgeStyle;
  edgeLabelMode: EdgeLabelMode;
  direction: 'RIGHT' | 'DOWN';
  showCardLoc: boolean;
  showPeekHud: boolean;
  showZoomSlider: boolean;
  showMap: boolean;
  showLegend: boolean;
  follow: boolean;
  auditProvenanceMode: AuditProvenanceMode;
  showEmptyActivity: boolean;
  showChanges: boolean;
  inspectorWidth: number;
  motionMode: MotionMode;
};

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseThemeMode(value: unknown): ThemeMode {
  return parseEnum(value, THEME_MODES, DEFAULT_THEME_MODE);
}

export function parseUiFontScale(value: unknown): UiFontScale {
  return parseEnum(value, UI_FONT_SCALES, DEFAULT_UI_FONT_SCALE);
}

export function parseCodeFontScale(value: unknown): CodeFontScale {
  return parseEnum(value, CODE_FONT_SCALES, DEFAULT_CODE_FONT_SCALE);
}

export function parseCanvasBackdrop(value: unknown): CanvasBackdrop {
  return parseEnum(value, CANVAS_BACKDROPS, DEFAULT_CANVAS_BACKDROP);
}

export function parseEdgeLabelMode(value: unknown): EdgeLabelMode {
  return parseEnum(value, EDGE_LABEL_MODES, DEFAULT_EDGE_LABEL_MODE);
}

export function clampInspectorWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return INSPECTOR_WIDTH_RANGE.default;
  return Math.max(INSPECTOR_WIDTH_RANGE.min, Math.min(INSPECTOR_WIDTH_RANGE.max, Math.round(value)));
}

const UI_SCALE_PX: Record<Exclude<UiFontScale, 'default'>, { root: string; body: string }> = {
  compact: { root: '15px', body: '13px' },
  comfortable: { root: '17px', body: '15px' },
  large: { root: '18px', body: '16px' },
};

const CODE_SCALE_PX: Record<Exclude<CodeFontScale, 'default'>, string> = {
  compact: '11px',
  comfortable: '13px',
  large: '14px',
};

/** Apply standalone typography scales while preserving Pinwhy's default 16px root / 14px body metrics. */
export function applyStandaloneTypography(uiScale: UiFontScale, codeScale: CodeFontScale, target?: EmbedFontTarget | null): void {
  const root = target ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!root) return;
  if (uiScale === 'default') {
    root.style.fontSize = '';
    root.style.removeProperty('--pinwhy-font-size');
  } else {
    const metrics = UI_SCALE_PX[uiScale];
    root.style.fontSize = metrics.root;
    root.style.setProperty('--pinwhy-font-size', metrics.body);
  }
  if (codeScale === 'default') {
    root.style.removeProperty('--pinwhy-code-size');
    delete root.dataset.embedCodeSize;
  } else {
    root.style.setProperty('--pinwhy-code-size', CODE_SCALE_PX[codeScale]);
    root.dataset.embedCodeSize = '';
  }
}

export function serializePreferences(prefs: PortablePreferences): string {
  return `${JSON.stringify({ schema: PREFERENCES_SCHEMA, ...prefs }, null, 2)}\n`;
}

function validEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const BOOLEAN_FIELDS = [
  'showCardLoc',
  'showPeekHud',
  'showZoomSlider',
  'showMap',
  'showLegend',
  'follow',
  'showEmptyActivity',
  'showChanges',
] as const;

export function parsePreferencesSnapshot(raw: string): { ok: true; value: Partial<PortablePreferences> } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!isRecord(parsed)) return { ok: false };
  if ('schema' in parsed && parsed.schema !== undefined && parsed.schema !== '' && parsed.schema !== PREFERENCES_SCHEMA) {
    return { ok: false };
  }

  const next: Partial<PortablePreferences> = {};
  const themeMode = validEnum(parsed.themeMode, THEME_MODES);
  if (themeMode) next.themeMode = themeMode;
  if (typeof parsed.cardTheme === 'string' && parsed.cardTheme === parseCardTheme(parsed.cardTheme)) {
    next.cardTheme = parsed.cardTheme as CardTheme;
  }
  const uiScale = validEnum(parsed.uiScale, UI_FONT_SCALES);
  if (uiScale) next.uiScale = uiScale;
  const codeScale = validEnum(parsed.codeScale, CODE_FONT_SCALES);
  if (codeScale) next.codeScale = codeScale;
  const canvasBackdrop = validEnum(parsed.canvasBackdrop, CANVAS_BACKDROPS);
  if (canvasBackdrop) next.canvasBackdrop = canvasBackdrop;
  const edgeStyle = validEnum(parsed.edgeStyle, EDGE_STYLES);
  if (edgeStyle) next.edgeStyle = edgeStyle;
  const edgeLabelMode = validEnum(parsed.edgeLabelMode, EDGE_LABEL_MODES);
  if (edgeLabelMode) next.edgeLabelMode = edgeLabelMode;
  const direction = validEnum(parsed.direction, LAYOUT_DIRECTIONS);
  if (direction) next.direction = direction;
  const auditProvenanceMode = validEnum(parsed.auditProvenanceMode, AUDIT_PROVENANCE_MODES);
  if (auditProvenanceMode) next.auditProvenanceMode = auditProvenanceMode;
  const motionMode = validEnum(parsed.motionMode, MOTION_MODES);
  if (motionMode) next.motionMode = motionMode;

  for (const key of BOOLEAN_FIELDS) {
    if (typeof parsed[key] === 'boolean') next[key] = parsed[key] as boolean;
  }
  if (typeof parsed.inspectorWidth === 'number' && Number.isFinite(parsed.inspectorWidth)) {
    next.inspectorWidth = clampInspectorWidth(parsed.inspectorWidth);
  }

  if (Object.keys(next).length === 0) return { ok: false };
  return { ok: true, value: next };
}
