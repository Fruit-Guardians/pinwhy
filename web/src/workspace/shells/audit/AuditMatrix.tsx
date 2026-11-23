import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TypeDot } from '../../../canvas/SecurityNode';
import { SeverityBadge } from '../../../SeverityBadge';
import { presentNode, typeLabel } from '../../../presentation';
import { t } from '../../../i18n';
import type { BoardNode } from '../../../types';
import {
  isAuditCandidate,
  isAuditIssue,
  type AuditExpansionAction,
  type AuditSelection,
} from '../../audit';
import { AuditPageControls, authoredScopeLabel, type CssVars } from './shared';
import type { AuditProvenanceMode } from '../../use-workspace-chrome';
import type { NodeChange } from '../../use-workspace-presentation';
import { FactualTallyStrip, matchesMatrixLens, type MatrixLens } from './matrix/FactualTallyStrip';
import { MatrixCandidateRow } from './matrix/MatrixCandidateRow';

export { FactualTallyStrip, type MatrixLens } from './matrix/FactualTallyStrip';
export { IssueCandidateMatrixSection, MatrixCandidateRow } from './matrix/MatrixCandidateRow';

const ISSUE_PREVIEW_LIMIT = 6;

type LandingProps = {
  audit: AuditSelection;
  selectedId: string | null;
  graphOpen: boolean;
  inspectorPadding?: string;
  provenanceMode?: AuditProvenanceMode;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
  onToggleGraph: (next: boolean) => void;
  onSelect: (id: string) => void;
  onIssue: (id: string | null) => void;
  onCandidate: (id: string | null) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
};

/** Global audit landing: Issue × Candidate 3D orthogonal triage matrix, zero invented scores. */
export function AuditLandingMatrix({
  audit,
  selectedId,
  inspectorPadding,
  provenanceMode = 'auto',
  changes = null,
  fresh,
  onSelect,
  onIssue,
  onCandidate,
  onOpenArgument,
  onExpand,
}: LandingProps) {
  const [lens, setLens] = useState<MatrixLens | null>(null);
  const hasStructuredItems = audit.issues.length > 0 || audit.candidates.length > 0;
  const [recordsOpen, setRecordsOpen] = useState(!hasStructuredItems);
  const showProvenance = provenanceMode !== 'off';
  const effectiveMultiActor = provenanceMode === 'off' ? false : provenanceMode === 'always' ? true : audit.index.multiActor;
  const visibleIssues = audit.catalog.issues.items
    .map((issue) => {
      const allMembers = audit.index.membership.get(issue.id) ?? [];
      const members = lens ? allMembers.filter((item) => matchesMatrixLens(item, audit.index, lens)) : allMembers;
      return { issue, members };
    })
    .filter(({ members }) => !lens || members.length > 0);

  const pickRecord = (node: BoardNode) => {
    if (isAuditIssue(node)) onIssue(node.id);
    else if (isAuditCandidate(node)) onCandidate(node.id);
    else onSelect(node.id);
  };

  return (
    <section
      aria-label={t('audit.dossier')}
      style={inspectorPadding ? ({ '--audit-pad': inspectorPadding } as CssVars) : undefined}
      className={cn('flex h-full min-h-0 flex-col overflow-hidden', inspectorPadding && 'lg:pr-(--audit-pad)')}
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-sm font-semibold text-foreground">{t('audit.dossier')}</h2>
            <span className="text-xs text-muted-foreground">· {t('audit.matrix')}</span>
          </div>
          <p className="m-0 text-xs leading-5 text-muted-foreground">{t('audit.chooseRoot')}</p>
          <FactualTallyStrip
            candidates={audit.candidates}
            index={audit.index}
            showProvenance={showProvenance}
            multiActor={effectiveMultiActor}
            activeLens={lens}
            onSelectLens={setLens}
          />
        </div>
      </header>

      <div className="@container min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        <section aria-label={t('audit.issues')} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-xs font-semibold text-foreground">{t('audit.issues')} · {audit.issues.length}</h3>
            <AuditPageControls page={audit.catalog.issues} label={t('audit.issues')} onExpand={onExpand} />
          </div>

          {audit.issues.length ? (
            visibleIssues.length ? (
              <div className="space-y-3">
                {visibleIssues.map(({ issue, members }) => {
                  const preview = members.slice(0, ISSUE_PREVIEW_LIMIT);
                  const scope = authoredScopeLabel(issue);
                  return (
                    <article key={issue.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/35 px-3.5 py-2.5">
                        <button
                          type="button"
                          onClick={() => onIssue(issue.id)}
                          className="group flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <TypeDot type={issue.type} className="size-2 shrink-0" />
                          <span className="shrink-0 rounded border bg-card px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                            {issue.id}
                          </span>
                          <span className="truncate text-xs font-semibold text-foreground group-hover:underline">
                            {presentNode(issue).headline}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {scope && <span className="hidden max-w-64 truncate font-mono @2xl:inline">{scope}</span>}
                          <span className="rounded bg-card px-1.5 py-0.5 font-mono tabular-nums">
                            {members.length} {t('audit.candidates')}
                          </span>
                        </div>
                      </header>
                      {preview.length ? (
                        <div className="divide-y">
                          {preview.map((candidate) => (
                            <MatrixCandidateRow
                              key={candidate.id}
                              node={candidate}
                              index={audit.index}
                              selected={selectedId === candidate.id}
                              showProvenance={showProvenance}
                              multiActor={effectiveMultiActor}
                              change={changes?.get(candidate.id)}
                              isFresh={fresh?.has(candidate.id)}
                              onOpen={(picked) => onOpenArgument(picked, issue.id)}
                            />
                          ))}
                          {members.length > ISSUE_PREVIEW_LIMIT && (
                            <div className="bg-secondary/20 px-3.5 py-2">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onIssue(issue.id)}>
                                {t('audit.moreIssueCandidates', { n: members.length })}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="m-0 px-3.5 py-2.5 text-xs text-muted-foreground">{t('audit.noIssueCandidates')}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 rounded-lg border border-dashed px-3.5 py-3 text-xs text-muted-foreground">{t('sidebar.noMatch')}</p>
            )
          ) : (
            <p className="m-0 rounded-lg border border-dashed px-3.5 py-3 text-xs text-muted-foreground">{t('audit.noIssues')}</p>
          )}
        </section>

        {!audit.issues.length && (
          <section aria-label={t('audit.candidates')} className="space-y-2">
            <h3 className="m-0 text-xs font-semibold text-foreground">{t('audit.candidates')} · {audit.candidates.length}</h3>
            {audit.candidates.length ? (
              <div className="divide-y overflow-hidden rounded-xl border bg-card">
                {audit.catalog.members.items
                  .filter((item) => matchesMatrixLens(item, audit.index, lens))
                  .map((candidate) => (
                    <MatrixCandidateRow
                      key={candidate.id}
                      node={candidate}
                      index={audit.index}
                      selected={selectedId === candidate.id}
                      showProvenance={showProvenance}
                      multiActor={effectiveMultiActor}
                      change={changes?.get(candidate.id)}
                      isFresh={fresh?.has(candidate.id)}
                      onOpen={onOpenArgument}
                    />
                  ))}
              </div>
            ) : (
              <p className="m-0 text-xs text-muted-foreground">{t('audit.noCandidates')}</p>
            )}
            <AuditPageControls page={audit.catalog.members} label={t('audit.candidates')} onExpand={onExpand} />
          </section>
        )}

        {audit.unassigned.length > 0 && (
          <section aria-label={t('audit.unassigned')} className="space-y-2 rounded-xl border bg-card p-3.5 shadow-xs">
            <h3 className="m-0 text-xs font-semibold text-foreground">{t('audit.unassigned')} · {audit.unassigned.length}</h3>
            <AuditPageControls page={audit.catalog.unassigned} label={t('audit.unassigned')} defaultLimit={0} onExpand={onExpand} />
            {audit.catalog.unassigned.items.length > 0 && (
              <div className="divide-y overflow-hidden rounded-lg border">
                {audit.catalog.unassigned.items
                  .filter((item) => matchesMatrixLens(item, audit.index, lens))
                  .map((candidate) => (
                    <MatrixCandidateRow
                      key={candidate.id}
                      node={candidate}
                      index={audit.index}
                      selected={selectedId === candidate.id}
                      showProvenance={showProvenance}
                      multiActor={effectiveMultiActor}
                      change={changes?.get(candidate.id)}
                      isFresh={fresh?.has(candidate.id)}
                      onOpen={onOpenArgument}
                    />
                  ))}
              </div>
            )}
          </section>
        )}

        <section aria-label={t('audit.records')} className="rounded-xl border bg-card p-3 shadow-xs">
          <button
            type="button"
            aria-expanded={recordsOpen && audit.catalog.records.open}
            onClick={() => {
              const next = !(recordsOpen && audit.catalog.records.open);
              setRecordsOpen(next);
              if (next && !audit.catalog.records.open) onExpand('records', 'more', 0);
            }}
            className="flex w-full items-center gap-2 text-left text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight aria-hidden="true" className={cn('size-3.5 text-muted-foreground transition-transform', recordsOpen && audit.catalog.records.open && 'rotate-90')} />
            <span>{t('audit.records')} · {audit.records.length}</span>
          </button>
          {recordsOpen && audit.catalog.records.open && (
            <div className="mt-2.5 space-y-2">
              <AuditPageControls page={audit.catalog.records} label={t('audit.records')} onExpand={onExpand} />
              <div className="grid gap-1.5 @xl:grid-cols-2">
                {audit.catalog.records.items.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => pickRecord(record)}
                    className="flex items-start gap-2 rounded-lg border bg-background/60 px-2.5 py-2 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TypeDot type={record.type} className="mt-1.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{record.title || record.id}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{typeLabel(record.type)}</span>
                        <span className="font-mono text-[10.5px]">{record.id}</span>
                        {record.severity ? <SeverityBadge severity={record.severity} className="px-1.5 text-[10px]" /> : null}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
