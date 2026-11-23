import { cn } from '@/lib/utils';
import { t } from '../../../../i18n';
import type { BoardNode } from '../../../../types';
import type { AuditIndex } from '../../../audit';
import { isRetiredNode } from '../shared';

export type MatrixLens = 'reproduced' | 'static' | 'suspected' | 'dispute' | 'corroborated' | 'single' | 'retired';

export function matchesMatrixLens(node: BoardNode, index: AuditIndex, lens: MatrixLens | null): boolean {
  if (!lens) return true;
  const prov = index.provenance.get(node.id);
  if (lens === 'reproduced') return node.confidence === 'reproduced';
  if (lens === 'static') return node.confidence === 'static-confirmed';
  if (lens === 'suspected') return node.confidence === 'suspected';
  if (lens === 'dispute') return Boolean(prov?.hasOpenDispute);
  if (lens === 'corroborated') return prov?.posture === 'corroborated';
  if (lens === 'single') return prov?.posture === 'single';
  if (lens === 'retired') return isRetiredNode(node);
  return true;
}

function candidateTallies(candidates: BoardNode[], index: AuditIndex) {
  let reproduced = 0;
  let staticConfirmed = 0;
  let suspected = 0;
  let dispute = 0;
  let corroborated = 0;
  let single = 0;
  let retired = 0;
  for (const node of candidates) {
    if (node.confidence === 'reproduced') reproduced++;
    else if (node.confidence === 'static-confirmed') staticConfirmed++;
    else if (node.confidence === 'suspected') suspected++;
    const prov = index.provenance.get(node.id);
    if (prov?.hasOpenDispute) dispute++;
    if (prov?.posture === 'corroborated') corroborated++;
    if (prov?.posture === 'single') single++;
    if (isRetiredNode(node)) retired++;
  }
  return { reproduced, staticConfirmed, suspected, dispute, corroborated, single, retired };
}

export function FactualTallyStrip({
  candidates,
  index,
  showProvenance = true,
  multiActor = index.multiActor,
  activeLens,
  onSelectLens,
}: {
  candidates: BoardNode[];
  index: AuditIndex;
  showProvenance?: boolean;
  multiActor?: boolean;
  activeLens?: MatrixLens | null;
  onSelectLens?: (next: MatrixLens | null) => void;
}) {
  if (!candidates.length) return null;
  const tally = candidateTallies(candidates, index);
  const pills: { key: MatrixLens; label: string; count: number; dot: string }[] = [
    { key: 'reproduced', label: t('audit.tallyReproduced'), count: tally.reproduced, dot: 'var(--live)' },
    { key: 'static', label: t('audit.tallyStatic'), count: tally.staticConfirmed, dot: 'var(--rel-derive)' },
    { key: 'suspected', label: t('audit.tallySuspected'), count: tally.suspected, dot: 'var(--ink-3)' },
    ...(showProvenance && tally.dispute > 0 ? [{ key: 'dispute' as const, label: t('audit.postureContested'), count: tally.dispute, dot: 'var(--rel-oppose)' }] : []),
    ...(showProvenance && multiActor && tally.corroborated > 0 ? [{ key: 'corroborated' as const, label: t('audit.postureCorroborated'), count: tally.corroborated, dot: 'var(--live)' }] : []),
    ...(showProvenance && multiActor && tally.single > 0 ? [{ key: 'single' as const, label: t('audit.postureSingle'), count: tally.single, dot: 'var(--ink-3)' }] : []),
    ...(tally.retired > 0 ? [{ key: 'retired' as const, label: t('audit.tallyRetired'), count: tally.retired, dot: 'var(--line-strong)' }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
      {pills.map((pill) => {
        const active = activeLens === pill.key;
        if (!onSelectLens) {
          return (
            <span key={pill.key} className="inline-flex items-center gap-1.5 rounded-md border bg-secondary/45 px-2 py-0.5 text-muted-foreground">
              <i aria-hidden="true" className="size-1.5 rounded-full" style={{ background: pill.dot }} />
              <span>{pill.label}</span>
              <strong className="font-semibold text-foreground">{pill.count}</strong>
            </span>
          );
        }
        return (
          <button
            key={pill.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectLens(active ? null : pill.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-foreground bg-card font-medium text-foreground shadow-2xs'
                : 'bg-secondary/45 text-muted-foreground hover:border-strong hover:text-foreground',
            )}
          >
            <i aria-hidden="true" className="size-1.5 rounded-full" style={{ background: pill.dot }} />
            <span>{pill.label}</span>
            <strong className="font-semibold text-foreground">{pill.count}</strong>
          </button>
        );
      })}
      {activeLens && onSelectLens && (
        <button
          type="button"
          onClick={() => onSelectLens(null)}
          className="px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {t('audit.clearMatrixFilter')}
        </button>
      )}
    </div>
  );
}
