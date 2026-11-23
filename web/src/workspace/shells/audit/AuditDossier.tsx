import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '../../../i18n';
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
import { AuditLandingMatrix, IssueCandidateMatrixSection } from './AuditMatrix';
import { ClaimSpecimen } from './dossier/ClaimSpecimen';
import { DossierHeader } from './dossier/DossierHeader';
import { DossierWingSection, InlineLocalBranch } from './dossier/DossierWings';
import { computeDossierDisplayMeta } from './dossier/meta';
import type { CssVars } from './shared';

type Props = {
  audit: AuditSelection;
  selected: BoardNode | null;
  graphOpen: boolean;
  inspectorPadding?: string;
  provenanceMode?: AuditProvenanceMode;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
  onToggleGraph: (next?: boolean) => void;
  onSelect: (id: string) => void;
  onClearSelection?: () => void;
  onIssue: (id: string | null) => void;
  onCandidate: (id: string | null) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
};

/** Security-specialized reading surface: claim specimen + adaptive dialectical balance, blueprint one click away. */
export function AuditDossier({
  audit,
  selected,
  graphOpen,
  inspectorPadding,
  provenanceMode = 'auto',
  changes = null,
  fresh,
  onToggleGraph,
  onSelect,
  onClearSelection,
  onIssue,
  onCandidate,
  onOpenArgument,
  onExpand,
}: Props) {
  const local = selected && audit.root && selected.id !== audit.root.id ? audit.contexts.get(selected.id) : null;
  const [spotlightActor, setSpotlightActor] = useState<string | null>(null);
  const [openedEmptyGroups, setOpenedEmptyGroups] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleToggleGraph = (next?: boolean) => onToggleGraph(typeof next === 'boolean' ? next : !graphOpen);

  useEffect(() => {
    setSpotlightActor(null);
    setOpenedEmptyGroups({});
    scrollRef.current?.scrollTo({ top: 0 });
  }, [audit.root?.id, provenanceMode]);

  // Open authored local rebuttals/conditions inline when a reader inspects an evidence or condition record.
  // Intentionally key only on selected node identity so manual collapse stays respected while viewing that node.
  useEffect(() => {
    if (!local) return;
    for (const role of ['contradiction', 'condition'] as const) {
      if (local.groups[role].length > 0 && !local.pages[role].open) onExpand(local.pages[role].key, 'more', 0);
    }
  }, [local?.node.id]);

  // General boards often only author related-to. Keep that group readable instead of an empty dossier.
  useEffect(() => {
    if (!audit.root) return;
    const structural = audit.pages.support.total + audit.pages.contradiction.total + audit.pages.condition.total;
    if (structural === 0 && audit.pages.related.total > 0 && !audit.pages.related.open) onExpand('related', 'more', 0);
  }, [audit.root?.id, audit.pages.support.total, audit.pages.contradiction.total, audit.pages.condition.total, audit.pages.related.total, audit.pages.related.open]);

  if (!audit.records.length) {
    return (
      <section aria-label={t('audit.dossier')} className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="m-0 text-sm font-medium text-foreground">{t('audit.empty')}</p>
        <p className="m-0 max-w-md text-xs leading-5 text-muted-foreground">{t('audit.emptyHint')}</p>
      </section>
    );
  }

  if (!audit.root) {
    return (
      <AuditLandingMatrix
        audit={audit}
        selectedId={selected?.id ?? null}
        graphOpen={graphOpen}
        inspectorPadding={inspectorPadding}
        provenanceMode={provenanceMode}
        changes={changes}
        fresh={fresh}
        onToggleGraph={handleToggleGraph}
        onSelect={onSelect}
        onIssue={onIssue}
        onCandidate={onCandidate}
        onOpenArgument={onOpenArgument}
        onExpand={onExpand}
      />
    );
  }

  const root = audit.root;
  const showProvenance = provenanceMode !== 'off';
  const multiActor = provenanceMode === 'off' ? false : provenanceMode === 'always' ? true : audit.index.multiActor;
  const rootProvenance = audit.index.provenance.get(root.id);
  const {
    premisesBySupport,
    unattachedPremises,
    showPremiseOverflow,
    localBranchContexts,
    fallbackLocal,
    rootProposer,
    actors,
  } = computeDossierDisplayMeta(audit, root.id, selected?.id ?? null);

  const actorSpotlightClass = (actor: string | null) => {
    if (!spotlightActor) return undefined;
    return actor === spotlightActor ? 'ring-1 ring-foreground/45' : 'opacity-40';
  };
  const toggleEmptyGroup = (key: string) => setOpenedEmptyGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const memberIndex = audit.candidate ? audit.members.findIndex((item) => item.id === audit.candidate?.id) : -1;
  const prevCandidate = memberIndex > 0 ? audit.members[memberIndex - 1] : null;
  const nextCandidate = memberIndex >= 0 && memberIndex < audit.members.length - 1 ? audit.members[memberIndex + 1] : null;
  const leftHasRecords = audit.pages.support.total > 0 || showPremiseOverflow;
  const rightHasRecords = audit.pages.contradiction.total > 0 || audit.pages.condition.total > 0;

  const wingSharedProps = {
    rootId: root.id,
    audit,
    selectedId: selected?.id ?? null,
    rootProposer,
    showProvenance,
    multiActor,
    premisesBySupport,
    localBranchContexts,
    changes,
    fresh,
    actorSpotlightClass,
    onToggleEmpty: toggleEmptyGroup,
    onSelect,
    onOpenArgument,
    onExpand,
  };

  return (
    <section
      aria-label={t('audit.dossier')}
      style={inspectorPadding ? ({ '--audit-pad': inspectorPadding } as CssVars) : undefined}
      className={cn('flex h-full min-h-0 flex-col overflow-hidden', inspectorPadding && 'lg:pr-(--audit-pad)')}
    >
      <DossierHeader
        audit={audit}
        graphOpen={graphOpen}
        memberIndex={memberIndex}
        prevCandidate={prevCandidate}
        nextCandidate={nextCandidate}
        onToggleGraph={handleToggleGraph}
        onIssue={onIssue}
        onCandidate={onCandidate}
      />

      <div ref={scrollRef} className="@container min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <div key={root.id} className="anim-dossier-swap space-y-3.5">
          <ClaimSpecimen
            node={root}
            selected={selected?.id === root.id}
            provenance={rootProvenance}
            showProvenance={showProvenance}
            multiActor={multiActor}
            actors={actors}
            spotlightActor={spotlightActor}
            change={changes?.get(root.id)}
            isFresh={fresh?.has(root.id)}
            onSpotlightActor={setSpotlightActor}
            onSelect={onSelect}
            onClearSelection={onClearSelection}
          />

          {audit.issue && !audit.candidate && (
            <IssueCandidateMatrixSection
              page={audit.catalog.members}
              index={audit.index}
              selectedId={selected?.id ?? null}
              provenanceMode={provenanceMode}
              changes={changes}
              fresh={fresh}
              onOpenCandidate={onOpenArgument}
              onExpand={onExpand}
            />
          )}

          <div className="grid grid-cols-1 items-start gap-3.5 @2xl:grid-cols-12">
            <div className={cn(
              'space-y-3',
              leftHasRecords && rightHasRecords
                ? '@2xl:col-span-6'
                : leftHasRecords
                  ? '@2xl:col-span-8'
                  : rightHasRecords
                    ? '@2xl:col-span-4'
                    : '@2xl:col-span-6',
            )}>
              <DossierWingSection
                {...wingSharedProps}
                page={audit.pages.support}
                label={t('audit.support')}
                role="support"
                emptyText={t('audit.noDirectSupport')}
                expandedEmpty={Boolean(openedEmptyGroups[audit.pages.support.key])}
              />
              {showPremiseOverflow && (
                <DossierWingSection
                  {...wingSharedProps}
                  page={audit.premises}
                  label={t('audit.premise')}
                  role="premise"
                  defaultLimit={AUDIT_BATCH}
                  itemsOverride={unattachedPremises}
                  expandedEmpty={Boolean(openedEmptyGroups[audit.premises.key])}
                />
              )}
            </div>
            <div className={cn(
              'space-y-3',
              leftHasRecords && rightHasRecords
                ? '@2xl:col-span-6'
                : rightHasRecords
                  ? '@2xl:col-span-8'
                  : leftHasRecords
                    ? '@2xl:col-span-4'
                    : '@2xl:col-span-6',
            )}>
              <DossierWingSection
                {...wingSharedProps}
                page={audit.pages.contradiction}
                label={t('audit.contradiction')}
                role="contradiction"
                emptyText={t('audit.noDirectCounter')}
                expandedEmpty={Boolean(openedEmptyGroups[audit.pages.contradiction.key])}
              />
              <DossierWingSection
                {...wingSharedProps}
                page={audit.pages.condition}
                label={t('audit.condition')}
                role="condition"
                emptyText={t('audit.noDirectCondition')}
                expandedEmpty={Boolean(openedEmptyGroups[audit.pages.condition.key])}
              />
            </div>
          </div>

          {audit.pages.related.total > 0 && (
            <DossierWingSection
              {...wingSharedProps}
              page={audit.pages.related}
              label={t('audit.related')}
              role="related"
              defaultLimit={0}
              expandedEmpty={Boolean(openedEmptyGroups[audit.pages.related.key])}
            />
          )}

          {fallbackLocal && (
            <div className="rounded-xl border bg-card p-3 shadow-2xs">
              <ClaimSpecimen
                node={fallbackLocal.node}
                selected={selected?.id === fallbackLocal.node.id}
                showProvenance={showProvenance}
                change={changes?.get(fallbackLocal.node.id)}
                isFresh={fresh?.has(fallbackLocal.node.id)}
                onSelect={onSelect}
                onClearSelection={onClearSelection}
              />
              <InlineLocalBranch
                context={fallbackLocal}
                rootId={root.id}
                allowExtraRoles
                byId={audit.index.byId}
                selectedId={selected?.id ?? null}
                rootProposer={rootProposer}
                multiActor={multiActor}
                actorSpotlightClass={actorSpotlightClass}
                onSelect={onSelect}
                onExpand={onExpand}
              />
            </div>
          )}

          {selected && selected.id !== root.id && (isAuditCandidate(selected) || isAuditIssue(selected)) && (
            <div>
              <Button size="sm" variant="outline" onClick={() => onOpenArgument(selected)}>
                {t('audit.openArgument')}: {selected.title || selected.id}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
