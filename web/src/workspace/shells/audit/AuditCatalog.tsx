import { useState } from 'react';
import { ChevronRight, Info, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TypeDot } from '../../../canvas/SecurityNode';
import { t } from '../../../i18n';
import { FilterPopover } from '../../../panels/FilterPopover';
import { EMPTY_FILTER, presentNode, type NodeFilter } from '../../../presentation';
import type { BoardNode } from '../../../types';
import {
  AUDIT_BATCH,
  isAuditCandidate,
  isAuditIssue,
  type AuditExpansionAction,
  type AuditSelection,
} from '../../audit';
import type { AuditProvenanceMode } from '../../use-workspace-chrome';
import type { NodeChange } from '../../use-workspace-presentation';
import { CandidateTreeRow, RecordRow } from './catalog/CatalogRows';
import { CatalogDrawerSection } from './catalog/CatalogDrawerSection';
import { AuditPageControls } from './shared';

const TREE_PREVIEW_LIMIT = 6;

type FilterFacets = {
  types: { value: string; count: number }[];
  statuses: { value: string; count: number }[];
  confidences: { value: string; count: number }[];
  riskCount: number;
};

type Props = {
  audit: AuditSelection;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onIssue: (id: string | null) => void;
  onCandidate: (id: string | null) => void;
  onCandidateIssue: (id: string) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onSearch: () => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
  filter?: NodeFilter;
  onFilter?: (filter: NodeFilter) => void;
  filterOptions?: FilterFacets;
  results?: BoardNode[] | null;
  counts?: { nodes: number; edges: number; risk: number; open: number; candidates: number };
  onShortcuts?: () => void;
  provenanceMode?: AuditProvenanceMode;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
};

/** Collapsible Issue ▸ Candidate outline for the security audit shell. */
export function AuditCatalog({
  audit,
  selectedId,
  onSelect,
  onIssue,
  onCandidateIssue,
  onOpenArgument,
  onSearch,
  onExpand,
  filter,
  onFilter,
  filterOptions,
  results,
  counts,
  onShortcuts,
  provenanceMode = 'auto',
  changes = null,
  fresh,
}: Props) {
  const [toggledIssues, setToggledIssues] = useState<Record<string, boolean>>({});
  const [recordsDrawerOpen, setRecordsDrawerOpen] = useState(false);
  const defaultExpandAll = audit.issues.length <= 8;
  const hasStructuredItems = audit.issues.length > 0 || audit.candidates.length > 0;
  const showProvenance = provenanceMode !== 'off';
  const effectiveMultiActor = provenanceMode === 'off' ? false : provenanceMode === 'always' ? true : audit.index.multiActor;

  const isIssueExpanded = (id: string) => {
    if (id in toggledIssues) return toggledIssues[id];
    return audit.issue?.id === id || defaultExpandAll;
  };

  const toggleIssueBranch = (id: string) => {
    const current = isIssueExpanded(id);
    setToggledIssues((prev) => ({ ...prev, [id]: !current }));
  };

  const openOrSelect = (node: BoardNode) => {
    if (isAuditIssue(node) || isAuditCandidate(node)) onOpenArgument(node);
    else onSelect(node.id);
  };

  return (
    <nav aria-label={t('audit.navigation')} className="flex h-full w-full flex-col">
      <div className="flex gap-2 p-3 pb-2">
        <button
          type="button"
          onClick={onSearch}
          aria-label={t('topbar.search')}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-2.5 text-[13px] text-muted-foreground shadow-xs transition-colors hover:border-strong hover:text-foreground"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">{t('sidebar.search')}</span>
          <Kbd className="ml-auto shrink-0">⌘K</Kbd>
        </button>
        {filter && onFilter && filterOptions && (
          <FilterPopover filter={filter} onChange={onFilter} {...filterOptions} />
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
        {results ? (
          <div>
            <div className="flex h-7 items-center px-1.5 text-xs font-medium text-muted-foreground">
              {t('sidebar.results')}
              <span className="ml-1.5 font-mono tabular-nums font-normal">{results.length}</span>
              {onFilter && (
                <Button variant="ghost" size="sm" className="ml-auto -mr-1 h-6 px-1.5 text-xs" onClick={() => onFilter(EMPTY_FILTER)}>
                  <X className="size-3" />{t('sidebar.clear')}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-0.5 pt-0.5">
              {results.length
                ? results.map((node) => (
                    <RecordRow
                      key={node.id}
                      node={node}
                      index={audit.index}
                      selected={selectedId === node.id}
                      onPick={openOrSelect}
                    />
                  ))
                : <p className="m-0 px-2 py-1.5 text-xs text-muted-foreground">{t('sidebar.noMatch')}</p>}
            </div>
          </div>
        ) : (
          <>
            <section aria-label={t('audit.issues')} className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 px-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-tight text-muted-foreground">
                  <span>{t('audit.issues')}</span>
                  <span className="font-mono tabular-nums font-normal">· {audit.issues.length}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        aria-label={t('audit.membershipHint')}
                        className="inline-flex size-4 cursor-help items-center justify-center rounded text-muted-foreground/70 hover:text-foreground"
                      >
                        <Info className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-60 text-xs leading-4">
                      {t('audit.membershipHint')}
                    </TooltipContent>
                  </Tooltip>
                </span>
                {(audit.issue || audit.candidate) && (
                  <button
                    type="button"
                    onClick={() => onIssue(null)}
                    className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    {t('audit.allIssues')}
                  </button>
                )}
              </div>

              <AuditPageControls page={audit.catalog.issues} label={t('audit.issues')} onExpand={onExpand} />

              {audit.catalog.issues.items.length > 0 ? (
                <div className="space-y-1">
                  {audit.catalog.issues.items.map((issue) => {
                    const isActiveIssue = audit.issue?.id === issue.id;
                    const allIssueMembers = audit.index.membership.get(issue.id) ?? [];
                    const hasMembers = allIssueMembers.length > 0;
                    const expanded = hasMembers && isIssueExpanded(issue.id);
                    const visibleMembers = isActiveIssue
                      ? audit.catalog.members.items
                      : allIssueMembers.slice(0, TREE_PREVIEW_LIMIT);

                    return (
                      <div key={issue.id} className="space-y-1">
                        <div
                          className={cn(
                            'flex items-center gap-1 rounded-md px-1 py-1 transition-colors',
                            isActiveIssue && !audit.candidate ? 'bg-card font-medium shadow-2xs ring-1 ring-border' : 'hover:bg-accent/65',
                          )}
                        >
                          {hasMembers ? (
                            <button
                              type="button"
                              aria-label={`${issue.title || issue.id} · ${t('audit.expandIssue')}`}
                              aria-expanded={expanded}
                              onClick={() => toggleIssueBranch(issue.id)}
                              className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <ChevronRight aria-hidden="true" className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
                            </button>
                          ) : (
                            <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
                              <i className="size-1 rounded-full bg-border" />
                            </span>
                          )}
                          <button
                            type="button"
                            aria-pressed={isActiveIssue && !audit.candidate}
                            onClick={() => {
                              if (hasMembers) setToggledIssues((prev) => ({ ...prev, [issue.id]: true }));
                              onIssue(issue.id);
                            }}
                            title={issue.title}
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <TypeDot type={issue.type} className="size-1.5 shrink-0" />
                            <span className="line-clamp-1 text-foreground">{presentNode(issue).headline}</span>
                          </button>
                          <span className={cn(
                            'shrink-0 rounded px-1.5 py-0 font-mono text-[10.5px] tabular-nums',
                            hasMembers ? 'bg-secondary/80 text-foreground/85' : 'text-muted-foreground/65',
                          )}>
                            {allIssueMembers.length}
                          </span>
                        </div>

                        {expanded && (
                          <div className="ml-3.5 space-y-1 border-l border-border/80 pl-2">
                            {isActiveIssue && (
                              <AuditPageControls page={audit.catalog.members} label={t('audit.candidates')} onExpand={onExpand} />
                            )}
                            {visibleMembers.map((member) => (
                              <CandidateTreeRow
                                key={member.id}
                                node={member}
                                index={audit.index}
                                active={audit.candidate?.id === member.id || selectedId === member.id}
                                showProvenance={showProvenance}
                                multiActor={effectiveMultiActor}
                                change={changes?.get(member.id)}
                                isFresh={fresh?.has(member.id)}
                                onOpen={(picked) => onOpenArgument(picked, issue.id)}
                              />
                            ))}
                            {!isActiveIssue && allIssueMembers.length > TREE_PREVIEW_LIMIT && (
                              <button
                                type="button"
                                onClick={() => {
                                  setToggledIssues((prev) => ({ ...prev, [issue.id]: true }));
                                  onIssue(issue.id);
                                }}
                                className="w-full rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                {t('audit.moreIssueCandidates', { n: allIssueMembers.length })}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                audit.records.length > 0 && (
                  <p className="m-0 px-1.5 text-xs text-muted-foreground">{t('audit.noIssues')}</p>
                )
              )}
            </section>

            {audit.issue && audit.catalog.members.total === 0 && (
              <div role="status" className="space-y-1.5 rounded-lg border border-dashed px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">
                <p className="m-0">{t('audit.noIssueCandidates')}</p>
                {audit.catalog.unassigned.total > 0 && (
                  <p className="m-0">{t('audit.unassignedNotice', { count: audit.catalog.unassigned.total })}</p>
                )}
                {audit.catalog.unassigned.total > 0 && !audit.catalog.unassigned.open && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    aria-label={`${t('audit.unassigned')} · ${t('audit.showMore')}`}
                    onClick={() => onExpand('unassigned', 'more', 0)}
                  >
                    {t('audit.showMore')}
                  </Button>
                )}
              </div>
            )}

            {audit.outsideIssue && (
              <div role="status" className="space-y-1 rounded-lg border bg-secondary/25 p-2 text-xs">
                <p className="m-0 font-medium text-foreground">{t('audit.outsideIssue')}</p>
                <AuditPageControls page={audit.catalog.candidateIssues} label={t('audit.openIssue')} onExpand={onExpand} />
                {audit.catalog.candidateIssues.items.map((issue) => (
                  <Button
                    key={issue.id}
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start whitespace-normal px-2 py-1 text-left text-xs"
                    onClick={() => onCandidateIssue(issue.id)}
                  >
                    {t('audit.openIssue')}: {issue.title || issue.id}
                  </Button>
                ))}
              </div>
            )}

            {(audit.missingIssue || audit.missingCandidate) && (
              <p role="status" className="m-0 px-1.5 text-xs text-muted-foreground">{t('audit.missingRoot')}</p>
            )}

            <CatalogDrawerSection
              page={audit.catalog.unassigned}
              label={t('audit.unassigned')}
              defaultLimit={0}
              index={audit.index}
              selectedId={selectedId}
              candidateId={audit.candidate?.id}
              onPick={openOrSelect}
              onExpand={onExpand}
            />
            <CatalogDrawerSection
              page={audit.catalog.records}
              label={t('audit.records')}
              defaultLimit={audit.root ? 0 : AUDIT_BATCH}
              controlledOpen={hasStructuredItems ? { open: recordsDrawerOpen, onToggle: () => setRecordsDrawerOpen((prev) => !prev) } : undefined}
              index={audit.index}
              selectedId={selectedId}
              candidateId={audit.candidate?.id}
              onPick={openOrSelect}
              onExpand={onExpand}
            />

            {!audit.records.length && <p role="status" className="px-1.5 text-xs text-muted-foreground">{t('audit.empty')}</p>}
          </>
        )}
      </div>

      {counts && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t px-3.5 py-2 text-xs tabular-nums text-muted-foreground *:whitespace-nowrap">
          <span>{t('sidebar.nodes', { n: counts.nodes })}</span>
          <span>{t('sidebar.edges', { n: counts.edges })}</span>
          {audit.candidates.length > 0 && <span>{t('sidebar.candidates', { n: audit.candidates.length })}</span>}
          {counts.risk > 0 && <span className="text-destructive">{t('sidebar.risk', { n: counts.risk })}</span>}
          {onShortcuts && (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded text-muted-foreground transition-colors hover:text-foreground"
              onClick={onShortcuts}
              aria-label={t('palette.shortcuts')}
            >
              <Kbd>?</Kbd>
            </button>
          )}
        </footer>
      )}
    </nav>
  );
}
