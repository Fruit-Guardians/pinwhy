import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypeDot } from '../../../../canvas/SecurityNode';
import { SeverityBadge } from '../../../../SeverityBadge';
import { t } from '../../../../i18n';
import { nodeAccent, presentNode } from '../../../../presentation';
import { sourceLocation } from '../../../../research-state';
import type { BoardNode } from '../../../../types';
import type { AuditExpansionAction, AuditIndex, AuditPage } from '../../../audit';
import type { AuditProvenanceMode } from '../../../use-workspace-chrome';
import type { NodeChange } from '../../../use-workspace-presentation';
import {
  AuditPageControls,
  ChangeDeltaBadge,
  ConfidencePill,
  isRetiredNode,
  PostureBadge,
  StatusPill,
  type CssVars,
} from '../shared';
import { FactualTallyStrip, matchesMatrixLens, type MatrixLens } from './FactualTallyStrip';

export function MatrixCandidateRow({
  node,
  index,
  selected,
  showProvenance = true,
  multiActor = index.multiActor,
  change,
  isFresh,
  onOpen,
}: {
  node: BoardNode;
  index: AuditIndex;
  selected: boolean;
  showProvenance?: boolean;
  multiActor?: boolean;
  change?: NodeChange;
  isFresh?: boolean;
  onOpen: (node: BoardNode) => void;
}) {
  const { headline } = presentNode(node);
  const loc = sourceLocation(node);
  const retired = isRetiredNode(node);
  const args = index.arguments.get(node.id);
  const prov = index.provenance.get(node.id);
  const supports = args?.support.length ?? 0;
  const contradictions = args?.contradiction.length ?? 0;
  const conditions = args?.condition.length ?? 0;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onOpen(node)}
      style={{ '--c': nodeAccent(node.type) } as CssVars}
      className={cn(
        'group relative grid w-full grid-cols-1 items-center gap-2 px-3.5 py-2.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @xl:grid-cols-12',
        selected ? 'bg-accent' : 'hover:bg-accent/55',
        isFresh && 'fresh-pulse',
      )}
    >
      <i aria-hidden="true" className={cn('absolute bottom-2 left-0 top-2 w-[2.5px] rounded-r-full bg-(--c)', retired && 'opacity-35')} />
      <div className="min-w-0 pl-1 @xl:col-span-5">
        <div className="flex items-center gap-1.5">
          <TypeDot type={node.type} className={cn('size-1.5 shrink-0', retired && 'opacity-50')} />
          <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{node.id}</span>
          <ChangeDeltaBadge change={change} compact />
          <span className={cn('truncate font-medium text-foreground', retired && 'text-muted-foreground line-through')}>
            {headline}
          </span>
        </div>
        {loc && (
          <code className="mt-0.5 block truncate pl-3 font-mono text-[10.5px] text-muted-foreground">{loc}</code>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-1 @xl:col-span-4 @xl:pl-0">
        {node.severity
          ? <SeverityBadge severity={node.severity} />
          : <span className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">{t('severity.unset')}</span>}
        <ConfidencePill confidence={node.confidence} compact />
        <PostureBadge provenance={prov} multiActor={multiActor} show={showProvenance} />
        {node.status && <StatusPill status={node.status} compact />}
      </div>

      <div className="flex items-center gap-2.5 pl-1 font-mono text-[11px] tabular-nums text-muted-foreground @xl:col-span-3 @xl:justify-end @xl:pl-0">
        {showProvenance && multiActor && (prov?.participants.length ?? 0) > 1 && (
          <span className="rounded border bg-secondary/45 px-1.5 py-0 font-sans text-[10.5px] text-foreground">
            {t('audit.actorsCount', { n: prov!.participants.length })}
          </span>
        )}
        <span className={cn(supports > 0 && 'font-medium text-(--rel-support)')} title={t('audit.support')}>
          +{supports}
        </span>
        <span className={cn(contradictions > 0 && 'font-semibold text-(--rel-oppose)')} title={t('audit.contradiction')}>
          −{contradictions}
        </span>
        <span className={cn(conditions > 0 && 'text-(--rel-derive)')} title={t('audit.condition')}>
          {conditions} {t('audit.condition')}
        </span>
        <ArrowRight className="size-3.5 shrink-0 opacity-45 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
      </div>
    </button>
  );
}

export function IssueCandidateMatrixSection({
  page,
  index,
  selectedId,
  provenanceMode = 'auto',
  changes = null,
  fresh,
  onOpenCandidate,
  onExpand,
}: {
  page: AuditPage<BoardNode>;
  index: AuditIndex;
  selectedId: string | null;
  provenanceMode?: AuditProvenanceMode;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
  onOpenCandidate: (node: BoardNode) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const [lens, setLens] = useState<MatrixLens | null>(null);
  const showProvenance = provenanceMode !== 'off';
  const effectiveMultiActor = provenanceMode === 'off' ? false : provenanceMode === 'always' ? true : index.multiActor;
  const filteredItems = lens ? page.items.filter((item) => matchesMatrixLens(item, index, lens)) : page.items;

  return (
    <section aria-label={t('audit.candidates')} className="mb-4 rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <h3 className="m-0 font-semibold text-foreground">{t('audit.matrix')}</h3>
          <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{page.total}</span>
        </div>
        <FactualTallyStrip
          candidates={page.items}
          index={index}
          showProvenance={showProvenance}
          multiActor={effectiveMultiActor}
          activeLens={lens}
          onSelectLens={setLens}
        />
      </header>
      {page.total > 0 ? (
        <>
          <div className="p-2 pb-0">
            <AuditPageControls page={page} label={t('audit.candidates')} onExpand={onExpand} />
          </div>
          {filteredItems.length > 0 ? (
            <div className="divide-y">
              {filteredItems.map((candidate) => (
                <MatrixCandidateRow
                  key={candidate.id}
                  node={candidate}
                  index={index}
                  selected={selectedId === candidate.id}
                  showProvenance={showProvenance}
                  multiActor={effectiveMultiActor}
                  change={changes?.get(candidate.id)}
                  isFresh={fresh?.has(candidate.id)}
                  onOpen={onOpenCandidate}
                />
              ))}
            </div>
          ) : (
            <p className="m-0 px-3.5 py-3 text-xs text-muted-foreground">{t('sidebar.noMatch')}</p>
          )}
        </>
      ) : (
        <p className="m-0 px-3.5 py-3 text-xs text-muted-foreground">{t('audit.noIssueCandidates')}</p>
      )}
    </section>
  );
}
