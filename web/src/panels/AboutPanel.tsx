import { useState } from 'react';
import { ArrowUpRight, BookOpen, Check, Copy, ExternalLink, Globe, MessageSquareWarning, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCopyFeedback } from '@/components/use-copy-feedback';
import { getUpdateCheck } from '../api/client';
import { t } from '../i18n';
import type { BuildInfo, UpdateCheck } from '../types';

export const OFFICIAL_WEBSITE = 'https://pinwhy.bx33661.com';
export const REPOSITORY_URL = 'https://github.com/Fruit-Guardians/pinwhy';
export const DOCS_URL = `${REPOSITORY_URL}/blob/main/README.md`;
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
const RELEASE_GUIDE_URL = `${REPOSITORY_URL}/blob/main/README.md#release`;

const AXIOM_KEYS = [
  'about.axiom1',
  'about.axiom2',
  'about.axiom3',
  'about.axiom4',
  'about.axiom5',
] as const;

const TRACE_STOPS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 61.25, cy: 17.5 },
  { cx: 47.5, cy: 31.25 },
  { cx: 28.75, cy: 50 },
];

function PinwhyVectorLogo({
  darkSurface,
  step,
  resonant,
  motionReduced,
}: {
  darkSurface: boolean;
  step: number;
  resonant: boolean;
  motionReduced: boolean;
}) {
  const markColor = darkSurface ? '#66E0AE' : '#147453';
  const wordColor = darkSurface ? '#F3F5F2' : '#15201C';
  const dot = resonant ? TRACE_STOPS[0] : TRACE_STOPS[Math.min(step, TRACE_STOPS.length - 1)];

  return (
    <svg
      width="244"
      height="64"
      viewBox="0 0 304 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Pinwhy"
      className="mx-auto block h-14 w-auto select-none sm:h-16"
    >
      <title>Pinwhy — Open trace</title>
      <path
        d="M45.625 12.5H23.75C17.5369 12.5 12.5 17.5369 12.5 23.75V56.25C12.5 62.4631 17.5369 67.5 23.75 67.5H56.25C62.4631 67.5 67.5 62.4631 67.5 56.25V40.625"
        stroke={markColor}
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28.75 50L47.5 31.25"
        stroke={markColor}
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      {resonant && !motionReduced && (
        <circle
          cx={dot.cx}
          cy={dot.cy}
          r="11.5"
          stroke={markColor}
          strokeWidth="1.75"
          opacity="0.45"
          className="animate-ping"
          style={{ transformOrigin: `${dot.cx}px ${dot.cy}px` }}
        />
      )}
      {resonant && (
        <circle cx={dot.cx} cy={dot.cy} r="10" stroke={markColor} strokeWidth="2" opacity="0.55" />
      )}
      <circle
        cx={dot.cx}
        cy={dot.cy}
        r="6.25"
        fill={markColor}
        style={motionReduced ? undefined : { transition: 'cx 260ms cubic-bezier(0.22, 1, 0.36, 1), cy 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <g transform="translate(96 55)" fill={wordColor}>
        <path d="M4.68 -42.48L18.54 -42.48Q22.2 -42.48 25.14 -41.82Q28.08 -41.16 30.18 -39.66Q32.28 -38.16 33.42 -35.82Q34.56 -33.48 34.56 -30.18Q34.56 -26.64 33.24 -24.24Q31.92 -21.84 29.67 -20.37Q27.42 -18.9 24.42 -18.24Q21.42 -17.58 18.06 -17.58L12.24 -17.58L12.24 -0L4.68 -0ZM17.52 -23.94Q19.38 -23.94 21.06 -24.21Q22.74 -24.48 24.06 -25.17Q25.38 -25.86 26.16 -27.06Q26.94 -28.26 26.94 -30.18Q26.94 -32.04 26.16 -33.21Q25.38 -34.38 24.09 -35.04Q22.8 -35.7 21.15 -35.91Q19.5 -36.12 17.76 -36.12L12.24 -36.12L12.24 -23.94Z" />
        <path d="M41.04 -28.8L48.24 -28.8L48.24 -0L41.04 -0ZM40.02 -38.58Q40.02 -40.32 41.31 -41.61Q42.6 -42.9 44.58 -42.9Q46.56 -42.9 47.91 -41.67Q49.26 -40.44 49.26 -38.58Q49.26 -36.72 47.91 -35.49Q46.56 -34.26 44.58 -34.26Q42.6 -34.26 41.31 -35.55Q40.02 -36.84 40.02 -38.58Z" />
        <path d="M57 -28.8L63.84 -28.8L63.84 -24.18L63.96 -24.18Q64.92 -26.34 67.29 -27.99Q69.66 -29.64 72.9 -29.64Q75.72 -29.64 77.73 -28.65Q79.74 -27.66 81.03 -26.04Q82.32 -24.42 82.92 -22.32Q83.52 -20.22 83.52 -18L83.52 -0L76.32 -0L76.32 -15.96Q76.32 -17.22 76.14 -18.6Q75.96 -19.98 75.36 -21.09Q74.76 -22.2 73.71 -22.92Q72.66 -23.64 70.92 -23.64Q69.18 -23.64 67.92 -22.95Q66.66 -22.26 65.85 -21.18Q65.04 -20.1 64.62 -18.69Q64.2 -17.28 64.2 -15.84L64.2 -0L57 -0Z" />
        <path d="M87.84 -28.8L95.64 -28.8L101.64 -8.16L101.76 -8.16L107.94 -28.8L115.62 -28.8L121.86 -8.16L121.98 -8.16L128.1 -28.8L135.6 -28.8L125.64 -0L118.32 -0L111.78 -20.16L111.66 -20.16L105.18 -0L97.86 -0Z" />
        <path d="M156.18 -29.64Q159 -29.64 161.01 -28.65Q163.02 -27.66 164.31 -26.04Q165.6 -24.42 166.2 -22.32Q166.8 -20.22 166.8 -18L166.8 -0L159.6 -0L159.6 -15.84Q159.6 -17.1 159.42 -18.45Q159.24 -19.8 158.67 -20.91Q158.1 -22.02 157.05 -22.74Q156 -23.46 154.26 -23.46Q152.52 -23.46 151.26 -22.8Q150 -22.14 149.16 -21.03Q148.32 -19.92 147.9 -18.54Q147.48 -17.16 147.48 -15.72L147.48 -0L140.28 -0L140.28 -45.36L147.48 -45.36L147.48 -24.78L147.6 -24.78Q148.02 -25.68 148.83 -26.55Q149.64 -27.42 150.72 -28.11Q151.8 -28.8 153.18 -29.22Q154.56 -29.64 156.18 -29.64Z" />
        <path d="M170.88 -28.8L178.86 -28.8L186.9 -7.86L187.02 -7.86L194.16 -28.8L201.66 -28.8L188.04 6.18Q187.26 8.16 186.36 9.69Q185.46 11.22 184.2 12.27Q182.94 13.32 181.23 13.86Q179.52 14.4 177.12 14.4Q176.22 14.4 175.29 14.31Q174.36 14.22 173.4 13.98L174 7.74Q174.72 7.98 175.41 8.07Q176.1 8.16 176.7 8.16Q177.84 8.16 178.62 7.89Q179.4 7.62 179.94 7.05Q180.48 6.48 180.9 5.64Q181.32 4.8 181.8 3.66L183.24 -0Z" />
      </g>
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function AboutPanel({
  build,
  isStatic,
  theme = 'light',
  motionReduced = false,
}: {
  build?: BuildInfo;
  isStatic: boolean;
  theme?: 'light' | 'dark';
  motionReduced?: boolean;
}) {
  const [traceStep, setTraceStep] = useState(0);
  const [axiomIndex, setAxiomIndex] = useState(0);
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const { copied: buildCopied, copy: copyBuild } = useCopyFeedback(1800, build?.buildId);
  const { copied: cliCopied, copy: copyCli } = useCopyFeedback(1800, 'pinwhy-cli');

  const resonant = traceStep >= 3;
  const darkSurface = theme === 'dark' || resonant;

  function stepEasterEgg() {
    if (resonant) {
      setAxiomIndex((idx) => (idx + 1) % AXIOM_KEYS.length);
    } else {
      setTraceStep((step) => step + 1);
    }
  }

  async function checkUpdate() {
    if (checking) return;
    setChecking(true);
    setFailed(false);
    setUpdate(null);
    try { setUpdate(await getUpdateCheck()); }
    catch { setFailed(true); }
    finally { setChecking(false); }
  }

  const shortBuild = build ? build.buildId.replace(/^sha256:/, '').slice(0, 12) : '';

  return (
    <section aria-label={t('about.open')} className="anim-node-swap space-y-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border px-5 py-6 text-center transition-colors duration-300',
          resonant
            ? 'border-[#66E0AE]/45 bg-[#090D0C] text-[#F3F5F2] shadow-[0_12px_36px_-14px_rgba(102,224,174,0.28)]'
            : theme === 'dark'
              ? 'border-[#22322d] bg-gradient-to-b from-[#101715] to-card text-foreground'
              : 'border-[#d5e2d9] bg-gradient-to-b from-[#f3f7f4] to-card text-foreground',
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: resonant
              ? 'radial-gradient(rgba(102,224,174,0.2) 1px, transparent 1px)'
              : 'radial-gradient(var(--line-strong) 0.9px, transparent 0.9px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={stepEasterEgg}
            aria-label={t('about.easterTrigger')}
            title={t('about.easterHint')}
            className="group rounded-xl px-3 py-1.5 outline-none transition-transform duration-150 hover:scale-[1.015] active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PinwhyVectorLogo
              darkSurface={darkSurface}
              step={traceStep}
              resonant={resonant}
              motionReduced={motionReduced}
            />
          </button>

          <p className={cn('m-0 mt-2.5 text-[13px] font-medium', resonant ? 'text-[#66E0AE]' : 'text-foreground')}>
            {t('about.tagline')}
          </p>
          <p className={cn('m-0 mt-1.5 max-w-[38ch] text-xs leading-5', resonant ? 'text-[#c2d4cc]' : 'text-muted-foreground')}>
            {t('about.description')}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
            {[t('about.pillEvents'), t('about.pillNonInterfering'), t('about.pillLocal')].map((pill) => (
              <span
                key={pill}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 font-medium',
                  resonant
                    ? 'border-[#2b4239] bg-[#101916] text-[#a7c2b6]'
                    : 'border-border/80 bg-background/80 text-subtle',
                )}
              >
                {pill}
              </span>
            ))}
          </div>

          {!resonant ? (
            <div className="mt-3.5 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <i
                    key={index}
                    className={cn(
                      'size-1.5 rounded-full transition-colors',
                      index < traceStep ? 'bg-live' : 'bg-strong/70',
                    )}
                  />
                ))}
              </span>
              <span>{t('about.easterHint')}</span>
            </div>
          ) : (
            <div className="anim-disclosure-in mt-4 w-full rounded-xl border border-[#2a443a] bg-[#0e1513]/95 p-3.5 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#66E0AE]">
                  <Sparkles className="size-3.5" />
                  {t('about.easterTitle')}
                </span>
                <span className="font-mono text-[11px] text-[#8ba69b]">
                  {String(axiomIndex + 1).padStart(2, '0')} / {String(AXIOM_KEYS.length).padStart(2, '0')}
                </span>
              </div>
              <p className="m-0 mt-2 text-xs leading-5 text-[#e6f0ec]">
                {t(AXIOM_KEYS[axiomIndex])}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#22352e] pt-2.5">
                <button
                  type="button"
                  onClick={() => { void copyCli('pinwhy context --budget 4000'); }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#294138] bg-[#121c19] px-2 py-1 font-mono text-[11px] text-[#9ec4b5] transition-colors hover:border-[#66E0AE]/60 hover:text-[#F3F5F2]"
                >
                  <span>pinwhy context --budget 4000</span>
                  {cliCopied ? <Check className="size-3 text-[#66E0AE]" /> : <Copy className="size-3 opacity-75" />}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAxiomIndex((idx) => (idx + 1) % AXIOM_KEYS.length)}
                    className="rounded-md border border-[#294138] bg-[#121c19] px-2 py-1 text-[11px] font-medium text-[#d5e5de] transition-colors hover:border-[#66E0AE]/60"
                  >
                    {t('about.easterNext')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTraceStep(0); setAxiomIndex(0); }}
                    aria-label={t('about.easterClose')}
                    title={t('about.easterClose')}
                    className="inline-flex size-6 items-center justify-center rounded-md border border-[#294138] bg-[#121c19] text-[#8ba69b] transition-colors hover:text-[#F3F5F2]"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <a
          href={OFFICIAL_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 rounded-xl border bg-card p-3 no-underline transition-colors hover:border-strong hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-secondary text-live">
            <Globe className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1 text-xs font-semibold text-foreground">
              <span>{t('about.website')}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">pinwhy.bx33661.com</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('about.websiteHint')}</span>
          </span>
        </a>

        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 rounded-xl border bg-card p-3 no-underline transition-colors hover:border-strong hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-secondary text-foreground">
            <GitHubMark className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1 text-xs font-semibold text-foreground">
              <span>{t('about.repo')}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">Fruit-Guardians/pinwhy</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('about.repoHint')}</span>
          </span>
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            <BookOpen className="size-3.5" />
            {t('about.docs')}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            <MessageSquareWarning className="size-3.5" />
            {t('about.issues')}
          </a>
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">{t('about.license')}</span>
      </div>

      {build && (
        <div className="rounded-xl border bg-secondary/25 p-3.5">
          <p className="m-0 text-xs font-semibold text-foreground">{t('about.buildSection')}</p>
          <dl className="m-0 mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{t('about.version')}</dt>
              <dd className="m-0 mt-0.5 font-mono font-medium text-foreground">v{build.version}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{t('topbar.build')}</dt>
              <dd className="m-0 mt-0.5">
                <button
                  type="button"
                  onClick={() => { void copyBuild(build.buildId); }}
                  title={build.buildId}
                  className="inline-flex items-center gap-1 rounded font-mono text-foreground outline-none hover:text-live focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{shortBuild}</span>
                  {buildCopied ? <Check className="size-3 text-live" /> : <Copy className="size-3 text-muted-foreground" />}
                </button>
              </dd>
            </div>
            {build.commit && (
              <div className="min-w-0">
                <dt className="text-[11px] text-muted-foreground">{t('topbar.commit')}</dt>
                <dd className="m-0 mt-0.5 truncate font-mono text-foreground">{build.commit}</dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{t('topbar.source')}</dt>
              <dd className="m-0 mt-0.5 truncate text-foreground">{t(`topbar.source.${build.origin.kind}`)}</dd>
            </div>
          </dl>

          <div className="mt-3 border-t border-border/70 pt-3 text-xs">
            {isStatic ? (
              <p className="m-0 text-[11px] text-muted-foreground">{t('update.static')}</p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={checking} onClick={checkUpdate}>
                  <RefreshCw className={cn('size-3', checking && 'animate-spin')} />
                  {t(checking ? 'update.checking' : 'update.check')}
                </Button>
                <span className="text-[11px] text-muted-foreground">{t('update.source')}</span>
              </div>
            )}
            {!isStatic && (failed || update) && (
              <div role="status" aria-live="polite" className="mt-2 space-y-1 text-xs">
                {failed && <p className="m-0 text-destructive">{t('update.failed')}</p>}
                {update && (
                  <p className="m-0 flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <span>{t(`update.${update.status}`, { version: update.latestVersion })}</span>
                    {update.status === 'available' && (
                      <a
                        className="inline-flex items-center gap-1 text-live underline underline-offset-4"
                        href={RELEASE_GUIDE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('update.instructions')}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
