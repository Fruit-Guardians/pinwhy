import { Check, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { CARD_THEMES, CARD_THEME_SWATCHES } from '../../card-themes';
import { followsBrowser, locale, LOCALES, setLocale, t } from '../../i18n';
import {
  CODE_FONT_SCALES,
  THEME_MODES,
  UI_FONT_SCALES,
  type CodeFontScale,
  type UiFontScale,
} from '../../preferences';
import type { AppearanceSettings } from './shared';

const SCALE_LABEL_KEY = {
  compact: 'settings.scaleCompact',
  default: 'settings.scaleDefault',
  comfortable: 'settings.scaleComfortable',
  large: 'settings.scaleLarge',
} as const;

const THEME_LABEL_KEY = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
} as const;

export function AppearanceTab({
  themeMode,
  onThemeMode,
  cardTheme,
  onCardTheme,
  uiScale,
  onUiScale,
  codeScale,
  onCodeScale,
}: AppearanceSettings) {
  const browserLocale = followsBrowser();

  return (
    <section key="appearance" aria-label={t('settings.appearance')} className="anim-node-swap space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">{t('settings.themeLabel')}</span>
        <div role="radiogroup" aria-label={t('settings.themeLabel')} className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
          {THEME_MODES.map((option) => {
            const active = themeMode === option;
            const Icon = option === 'system' ? Monitor : option === 'light' ? Sun : Moon;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={(event) => onThemeMode(option, { x: event.clientX, y: event.clientY })}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {t(THEME_LABEL_KEY[option])}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border/70 pt-3.5">
        <span className="block text-[13px] font-medium text-foreground">{t('settings.language')}</span>
        <div role="radiogroup" aria-label={t('settings.language')} className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={browserLocale}
            onClick={() => { if (!browserLocale) setLocale(null); }}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              browserLocale
                ? 'border-foreground bg-secondary font-medium text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-strong hover:text-foreground',
            )}
          >
            <Globe className="size-3.5" />
            {t('palette.followBrowser')}
          </button>
          {LOCALES.map((option) => {
            const active = !browserLocale && locale === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => { if (!active) setLocale(option.id); }}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-foreground bg-secondary font-medium text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-strong hover:text-foreground',
                )}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 border-t border-border/70 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-foreground">{t('settings.uiScale')}</span>
          <Segmented<UiFontScale> value={uiScale} onValueChange={onUiScale} aria-label={t('settings.uiScale')}>
            {UI_FONT_SCALES.map((scale) => (
              <SegmentedItem key={scale} value={scale} className="px-2 text-xs">
                {t(SCALE_LABEL_KEY[scale])}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-foreground">{t('settings.codeScale')}</span>
          <Segmented<CodeFontScale> value={codeScale} onValueChange={onCodeScale} aria-label={t('settings.codeScale')}>
            {CODE_FONT_SCALES.map((scale) => (
              <SegmentedItem key={scale} value={scale} className="px-2 text-xs">
                {t(SCALE_LABEL_KEY[scale])}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border/70 pt-3.5">
        <span className="block text-[13px] font-medium text-foreground">{t('toolbar.cardTheme')}</span>
        <div role="radiogroup" aria-label={t('toolbar.cardTheme')} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CARD_THEMES.map((id) => {
            const active = cardTheme === id;
            const swatches = CARD_THEME_SWATCHES[id];
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onCardTheme(id)}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-foreground bg-secondary/55 shadow-2xs'
                    : 'border-border bg-card hover:border-strong hover:bg-accent/45',
                )}
              >
                <span className="mt-0.5 grid shrink-0 grid-cols-2 gap-0.5 rounded border bg-background p-1" aria-hidden="true">
                  {swatches.map((hex) => <i key={hex} className="size-1.5 rounded-full" style={{ background: hex }} />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1 text-xs font-semibold text-foreground">
                    <span className="truncate">{t(`cardTheme.${id}`)}</span>
                    {active && <Check className="size-3.5 shrink-0 text-foreground" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                    {t(`cardTheme.${id}Hint`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
