import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { EdgeStyle } from '../canvas/graph';
import { DEFAULT_CARD_THEME, parseCardTheme, type CardTheme } from '../card-themes';
import { applyEmbedFonts, NO_FONTS, type EmbedAppearance, type EmbedFonts } from '../api/embedded';
import {
  applyStandaloneTypography,
  clampInspectorWidth,
  DEFAULT_CANVAS_BACKDROP,
  DEFAULT_CODE_FONT_SCALE,
  DEFAULT_EDGE_LABEL_MODE,
  DEFAULT_THEME_MODE,
  DEFAULT_UI_FONT_SCALE,
  INSPECTOR_WIDTH_RANGE,
  parseCanvasBackdrop,
  parseCodeFontScale,
  parseEdgeLabelMode,
  parseThemeMode,
  parseUiFontScale,
  type AuditProvenanceMode,
  type CanvasBackdrop,
  type CodeFontScale,
  type EdgeLabelMode,
  type PortablePreferences,
  type ThemeMode,
  type UiFontScale,
} from '../preferences';
import { usePref } from '../use-pref';
import type { MotionMode } from '../view-transition';

export type { AuditProvenanceMode };
export type SettingsTab = 'appearance' | 'canvas' | 'reading' | 'motion' | 'about';

const THEME_KEY = 'pinwhy-theme-v3';
const CARD_THEME_KEY = 'pinwhy-card-theme';

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const savedThemeMode = (): ThemeMode => {
  try {
    return parseThemeMode(localStorage.getItem(THEME_KEY));
  } catch { /* storage can be unavailable in sandboxed exports */ }
  return DEFAULT_THEME_MODE;
};

type ChromeOptions = {
  /** A host page frames the board: it owns the surrounding chrome, the starting nav and the appearance. */
  embedded?: boolean;
  /** Appearance the framing URL asked for; only read while embedded. */
  appearance?: EmbedAppearance | null;
  /** Type preferences the framing URL asked for; only applied while embedded. */
  fonts?: EmbedFonts;
};

/** Browser preferences and transient chrome stay separate from URL and board state. */
export function useWorkspaceChrome({ embedded = false, appearance: startingAppearance = null, fonts: startingFonts }: ChromeOptions = {}) {
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // A framed board takes the host's appearance; standalone it remembers light, dark or system.
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => savedThemeMode());
  const [embedTheme, setEmbedTheme] = useState<'light' | 'dark'>(() => startingAppearance ?? (systemPrefersDark() ? 'dark' : 'light'));
  const theme: 'light' | 'dark' = embedded
    ? embedTheme
    : themeMode === 'system'
      ? (systemDark ? 'dark' : 'light')
      : themeMode;
  const setTheme = useCallback((next: 'light' | 'dark') => {
    if (embedded) setEmbedTheme(next);
    else setThemeMode(next);
  }, [embedded]);

  const [cardTheme, setCardTheme] = useState<CardTheme>(() => {
    if (embedded) return DEFAULT_CARD_THEME;
    try { return parseCardTheme(localStorage.getItem(CARD_THEME_KEY)); }
    catch { return DEFAULT_CARD_THEME; }
  });
  const [fonts, setFonts] = useState<EmbedFonts>(() => startingFonts ?? NO_FONTS);
  const [rawUiScale, setRawUiScale] = usePref<UiFontScale>('ui-scale', DEFAULT_UI_FONT_SCALE);
  const [rawCodeScale, setRawCodeScale] = usePref<CodeFontScale>('code-scale', DEFAULT_CODE_FONT_SCALE);
  const [rawCanvasBackdrop, setRawCanvasBackdrop] = usePref<CanvasBackdrop>('canvas-backdrop', DEFAULT_CANVAS_BACKDROP);
  const [rawEdgeLabelMode, setRawEdgeLabelMode] = usePref<EdgeLabelMode>('edge-label-mode', DEFAULT_EDGE_LABEL_MODE);
  const [rawInspectorWidth, setRawInspectorWidth] = usePref<number>('inspector-width', INSPECTOR_WIDTH_RANGE.default);

  const uiScale = parseUiFontScale(rawUiScale);
  const codeScale = parseCodeFontScale(rawCodeScale);
  const canvasBackdrop = parseCanvasBackdrop(rawCanvasBackdrop);
  const edgeLabelMode = parseEdgeLabelMode(rawEdgeLabelMode);
  const inspectorWidth = clampInspectorWidth(rawInspectorWidth);

  const setUiScale = useCallback((next: UiFontScale) => setRawUiScale(parseUiFontScale(next)), [setRawUiScale]);
  const setCodeScale = useCallback((next: CodeFontScale) => setRawCodeScale(parseCodeFontScale(next)), [setRawCodeScale]);
  const setCanvasBackdrop = useCallback((next: CanvasBackdrop) => setRawCanvasBackdrop(parseCanvasBackdrop(next)), [setRawCanvasBackdrop]);
  const setEdgeLabelMode = useCallback((next: EdgeLabelMode) => setRawEdgeLabelMode(parseEdgeLabelMode(next)), [setRawEdgeLabelMode]);
  const setInspectorWidth = useCallback((next: number) => setRawInspectorWidth(clampInspectorWidth(next)), [setRawInspectorWidth]);

  const [direction, setDirection] = usePref<'RIGHT' | 'DOWN'>('direction', 'RIGHT');
  // An embed usually sits in a narrow panel: the nav would eat the board, so it starts closed and the reader opens it.
  const [sidebarOpen, setSidebarOpen] = useState(() => !embedded && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    if (embedded) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => { setSidebarOpen(event.matches); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [embedded]);
  const [showMap, setShowMap] = usePref('minimap', false);
  const [showLegend, setShowLegend] = usePref('legend-open', false);
  const [edgeStyle, setEdgeStyle] = usePref<EdgeStyle>('edge-style', 'curve');
  const [follow, setFollow] = usePref('follow', false);
  const [showChanges, setShowChanges] = usePref('timeline-changes', true);
  const [motionMode, setMotionMode] = usePref<MotionMode>('motion-mode', 'fluid');
  const [showCardLoc, setShowCardLoc] = usePref('card-loc', true);
  const [showPeekHud, setShowPeekHud] = usePref('peek-hud', true);
  const [showZoomSlider, setShowZoomSlider] = usePref('zoom-slider', false);
  const [auditProvenanceMode, setAuditProvenanceMode] = usePref<AuditProvenanceMode>('audit-provenance', 'auto');
  const [showEmptyActivity, setShowEmptyActivity] = usePref('show-empty-activity', false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => (embedded ? 'canvas' : 'appearance'));
  const closeSidebar = useCallback(() => { setSidebarOpen(false); }, []);

  const openSettings = useCallback((requested?: SettingsTab) => {
    if (requested) {
      setSettingsTab(embedded && requested === 'appearance' ? 'canvas' : requested);
    } else {
      setSettingsTab((current) => {
        if (current === 'about') return embedded ? 'canvas' : 'appearance';
        if (embedded && current === 'appearance') return 'canvas';
        return current;
      });
    }
    setSettingsOpen(true);
  }, [embedded]);

  // Paint the theme, density attributes and type scale before the first frame.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.cardTheme = cardTheme;
    document.documentElement.dataset.motion = motionMode === 'reduced' ? 'reduced' : 'fluid';
    document.documentElement.dataset.cardLoc = showCardLoc ? 'show' : 'hide';
    if (embedded) {
      applyEmbedFonts(fonts);
      // The host owns appearance while embedded; writing here would overwrite the reader's standalone choice.
      return;
    }
    applyStandaloneTypography(uiScale, codeScale);
    try {
      localStorage.setItem(THEME_KEY, themeMode);
      localStorage.setItem(CARD_THEME_KEY, cardTheme);
    } catch { /* ignore */ }
  }, [theme, themeMode, cardTheme, motionMode, showCardLoc, uiScale, codeScale, fonts, embedded]);

  const resetPreferences = useCallback(() => {
    if (!embedded) {
      setThemeMode(DEFAULT_THEME_MODE);
      setCardTheme(DEFAULT_CARD_THEME);
      setRawUiScale(DEFAULT_UI_FONT_SCALE);
      setRawCodeScale(DEFAULT_CODE_FONT_SCALE);
    }
    setRawCanvasBackdrop(DEFAULT_CANVAS_BACKDROP);
    setEdgeStyle('curve');
    setRawEdgeLabelMode(DEFAULT_EDGE_LABEL_MODE);
    setDirection('RIGHT');
    setShowCardLoc(true);
    setShowPeekHud(true);
    setShowZoomSlider(false);
    setShowMap(false);
    setShowLegend(false);
    setFollow(false);
    setAuditProvenanceMode('auto');
    setShowEmptyActivity(false);
    setShowChanges(true);
    setRawInspectorWidth(INSPECTOR_WIDTH_RANGE.default);
    setMotionMode('fluid');
  }, [
    embedded, setRawUiScale, setRawCodeScale, setRawCanvasBackdrop, setEdgeStyle,
    setRawEdgeLabelMode, setDirection, setShowCardLoc, setShowPeekHud, setShowZoomSlider,
    setShowMap, setShowLegend, setFollow, setAuditProvenanceMode, setShowEmptyActivity,
    setShowChanges, setRawInspectorWidth, setMotionMode,
  ]);

  const applyPreferencesSnapshot = useCallback((partial: Partial<PortablePreferences>) => {
    if (!embedded) {
      if (partial.themeMode !== undefined) setThemeMode(partial.themeMode);
      if (partial.cardTheme !== undefined) setCardTheme(partial.cardTheme);
      if (partial.uiScale !== undefined) setRawUiScale(partial.uiScale);
      if (partial.codeScale !== undefined) setRawCodeScale(partial.codeScale);
    }
    if (partial.canvasBackdrop !== undefined) setRawCanvasBackdrop(partial.canvasBackdrop);
    if (partial.edgeStyle !== undefined) setEdgeStyle(partial.edgeStyle);
    if (partial.edgeLabelMode !== undefined) setRawEdgeLabelMode(partial.edgeLabelMode);
    if (partial.direction !== undefined) setDirection(partial.direction);
    if (partial.showCardLoc !== undefined) setShowCardLoc(partial.showCardLoc);
    if (partial.showPeekHud !== undefined) setShowPeekHud(partial.showPeekHud);
    if (partial.showZoomSlider !== undefined) setShowZoomSlider(partial.showZoomSlider);
    if (partial.showMap !== undefined) setShowMap(partial.showMap);
    if (partial.showLegend !== undefined) setShowLegend(partial.showLegend);
    if (partial.follow !== undefined) setFollow(partial.follow);
    if (partial.auditProvenanceMode !== undefined) setAuditProvenanceMode(partial.auditProvenanceMode);
    if (partial.showEmptyActivity !== undefined) setShowEmptyActivity(partial.showEmptyActivity);
    if (partial.showChanges !== undefined) setShowChanges(partial.showChanges);
    if (partial.inspectorWidth !== undefined) setRawInspectorWidth(partial.inspectorWidth);
    if (partial.motionMode !== undefined) setMotionMode(partial.motionMode);
  }, [
    embedded, setRawUiScale, setRawCodeScale, setRawCanvasBackdrop, setEdgeStyle,
    setRawEdgeLabelMode, setDirection, setShowCardLoc, setShowPeekHud, setShowZoomSlider,
    setShowMap, setShowLegend, setFollow, setAuditProvenanceMode, setShowEmptyActivity,
    setShowChanges, setRawInspectorWidth, setMotionMode,
  ]);

  // A host message is partial: it never clears settings it does not mention.
  const applyFonts = useCallback((update: EmbedFonts) => {
    setFonts((current) => ({
      fontFamily: update.fontFamily ?? current.fontFamily,
      codeFontFamily: update.codeFontFamily ?? current.codeFontFamily,
      fontSize: update.fontSize ?? current.fontSize,
      codeFontSize: update.codeFontSize ?? current.codeFontSize,
    }));
  }, []);

  return {
    appearance: {
      theme, setTheme, themeMode, setThemeMode, cardTheme, setCardTheme,
      uiScale, setUiScale, codeScale, setCodeScale, setFonts: applyFonts,
    },
    canvas: {
      backdrop: canvasBackdrop, setBackdrop: setCanvasBackdrop,
      edgeStyle, setEdgeStyle, edgeLabelMode, setEdgeLabelMode,
      direction, setDirection, showMap, setShowMap,
      showLegend, setShowLegend, showZoomSlider, setShowZoomSlider,
    },
    reading: {
      inspectorWidth, setInspectorWidth,
      showCardLoc, setShowCardLoc, showPeekHud, setShowPeekHud,
      showChanges, setShowChanges, auditProvenanceMode, setAuditProvenanceMode,
      showEmptyActivity, setShowEmptyActivity,
    },
    motion: {
      motionMode, setMotionMode, follow, setFollow,
    },
    dialogs: {
      sidebarOpen, setSidebarOpen, closeSidebar,
      paletteOpen, setPaletteOpen, digestOpen, setDigestOpen,
      newOpen, setNewOpen, shortcutsOpen, setShortcutsOpen,
      settingsOpen, setSettingsOpen, settingsTab, setSettingsTab, openSettings,
    },
    resetPreferences,
    applyPreferencesSnapshot,
  };
}

type Toggle = Dispatch<SetStateAction<boolean>>;
type CanvasActions = {
  enabled: boolean;
  onFit: () => void;
  onLocate?: () => void;
  onNeighborhood?: () => void;
  onToggleMap: () => void;
  auditEnabled?: boolean;
  onNextCandidate?: () => void;
  onPrevCandidate?: () => void;
  onToggleAuditSurface?: () => void;
  onToggleSettings?: () => void;
};

/** Canvas and audit shortcuts respect editors, dialogs and menus. */
export function useWorkspaceShortcuts(clearSelection: () => void, setPaletteOpen: Toggle, setShortcutsOpen: Toggle, setSidebarOpen: Toggle, canvasActions?: CanvasActions) {
  const actionsRef = useRef(canvasActions);
  actionsRef.current = canvasActions;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const actions = actionsRef.current;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === ',' && actions?.onToggleSettings) {
        event.preventDefault();
        actions.onToggleSettings();
      } else if (
        !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat
        && !(event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')
        && !document.querySelector('[role="dialog"], [role="menu"]')
      ) {
        const lower = event.key.toLowerCase();
        if (event.key === '/' || event.key === '[' || event.key === '?') {
          event.preventDefault();
          if (event.key === '/') setPaletteOpen(true); else if (event.key === '?') setShortcutsOpen(true); else setSidebarOpen((open) => !open);
        } else if (actions?.enabled && lower === 'f') {
          event.preventDefault();
          actions.onFit();
        } else if (actions?.enabled && lower === 'c' && actions.onLocate) {
          event.preventDefault();
          actions.onLocate();
        } else if (actions?.enabled && lower === 'z' && actions.onNeighborhood) {
          event.preventDefault();
          actions.onNeighborhood();
        } else if (actions?.enabled && lower === 'm') {
          event.preventDefault();
          actions.onToggleMap();
        } else if (actions?.auditEnabled && lower === 'j' && actions.onNextCandidate) {
          event.preventDefault();
          actions.onNextCandidate();
        } else if (actions?.auditEnabled && lower === 'k' && actions.onPrevCandidate) {
          event.preventDefault();
          actions.onPrevCandidate();
        } else if (actions?.auditEnabled && lower === 'g' && actions.onToggleAuditSurface) {
          event.preventDefault();
          actions.onToggleAuditSurface();
        } else if (event.key === 'Escape') clearSelection();
      } else if (event.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]')) clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, setPaletteOpen, setShortcutsOpen, setSidebarOpen]);
}
