import { ArrowLeftRight, ChevronRight, GitCommitVertical, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RelationBadge } from '@/components/relation-badge';
import { cn } from '@/lib/utils';
import { t } from '../../../../i18n';
import { relationTone } from '../../../../canvas/graph';
import { presentNode, typeLabel } from '../../../../presentation';
import { SeverityBadge } from '../../../../SeverityBadge';
import type { BoardEdge, BoardNode } from '../../../../types';
import {
  AUDIT_BATCH,
  edgeActor,
  edgePeer,
  isAuditCandidate,
  isAuditIssue,
  sharedAuditReferences,
  type ArgumentRole,
  type AuditExpansionAction,
  type AuditLocalContext,
  type AuditPage,
  type AuditSelection,
} from '../../../audit';
import type { NodeChange } from '../../../use-workspace-presentation';
import {
  ActorProvenanceBadge,
  AuditPageControls,
  ChangeDeltaBadge,
  ConfidencePill,
  isRetiredNode,
  LocationChip,
  renderInlineCode,
  ROLE_TONE,
  StatusPill,
  type CssVars,
} from '../shared';
import { cardLocalBranchKey, getActiveLocalRoles, premiseLocalBranchKey } from './meta';

function CompactLocalCard({
  edge,
  ownerId,
  role,
  byId,
  selectedId,
  rootProposer,
  multiActor,
  actorSpotlightClass,
  onSelect,
}: {
  edge: BoardEdge;
  ownerId: string;
  role: ArgumentRole;
  byId: ReadonlyMap<string, BoardNode>;
  selectedId: string | null;
  rootProposer: string | null;
  multiActor: boolean;
  actorSpotlightClass: (actor: string | null) => string | undefined;
  onSelect: (id: string) => void;
}) {
  const peerId = edgePeer(edge, ownerId);
  const peer = byId.get(peerId);
  const peerText = peer ? presentNode(peer) : null;
  const isSelected = selectedId === peerId;
  const actor = edgeActor(edge, byId, ownerId);

  return (
    <article
      className={cn(
        'rounded-lg border px-3 py-2.5 text-xs leading-5 transition-all',
        isSelected ? 'border-foreground/40 bg-accent/55 shadow-2xs' : 'bg-card hover:border-strong',
        actorSpotlightClass(actor),
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <RelationBadge kind={edge.kind} />
        {peer && <span className="text-muted-foreground">{typeLabel(peer.type)}</span>}
        {peer?.confidence && <ConfidencePill confidence={peer.confidence} compact />}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <ActorProvenanceBadge actor={actor} rootProposer={rootProposer} role={role} multiActor={multiActor} />
          <span className="font-mono text-[10.5px] text-muted-foreground">{peerId}</span>
        </span>
      </div>
      <button
        type="button"
        aria-label={`${peer?.title || peerId} · ${peerId}`}
        onClick={() => onSelect(peerId)}
        className="mt-1.5 block w-full rounded text-left text-[12.5px] font-medium leading-5 text-foreground outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {peerText ? peerText.headline : peerId}
      </button>
      {peerText?.summary && (
        <p className="m-0 mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {renderInlineCode(peerText.summary)}
        </p>
      )}
      {edge.label && (
        <p className="m-0 mt-1.5 border-l-2 border-strong pl-2.5 text-xs leading-4 text-subtle">
          {renderInlineCode(edge.label)}
        </p>
      )}
      {peer && <LocationChip node={peer} />}
    </article>
  );
}

export function InlineLocalBranch({
  context,
  rootId,
  allowExtraRoles = false,
  byId,
  selectedId,
  rootProposer,
  multiActor,
  actorSpotlightClass,
  onSelect,
  onExpand,
}: {
  context: AuditLocalContext;
  rootId: string;
  allowExtraRoles?: boolean;
  byId: ReadonlyMap<string, BoardNode>;
  selectedId: string | null;
  rootProposer: string | null;
  multiActor: boolean;
  actorSpotlightClass: (actor: string | null) => string | undefined;
  onSelect: (id: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const owner = context.node;
  const activeRoles = getActiveLocalRoles(context, rootId, allowExtraRoles);
  if (!activeRoles.length) return null;

  return (
    <section
      aria-label={`${t('audit.localDetails')}: ${owner.id}`}
      className="mt-2.5 space-y-2 rounded-lg border border-dashed bg-secondary/20 p-2.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {activeRoles.map((role) => {
          const page = context.pages[role];
          const roleName = role === 'contradiction'
            ? t('audit.hasContradictions')
            : role === 'condition'
              ? t('audit.hasConditions')
              : t(`audit.${role}`);
          const fullLabel = `${owner.title || owner.id} · ${roleName}`;
          const isWarning = role === 'contradiction';
          return (
            <button
              key={page.key}
              type="button"
              aria-label={`${fullLabel} · ${page.total}`}
              aria-expanded={page.open}
              onClick={() => onExpand(page.key, 'toggle', 0)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                isWarning
                  ? 'border-[color-mix(in_srgb,var(--rel-oppose)_45%,var(--line))] bg-[color-mix(in_srgb,var(--rel-oppose)_9%,var(--surface))] text-[color-mix(in_srgb,var(--rel-oppose)_88%,var(--ink))]'
                  : 'border-border bg-card text-foreground hover:border-strong',
              )}
            >
              {isWarning && <ShieldAlert aria-hidden="true" className="size-3 shrink-0" />}
              <span>{roleName}</span>
              <span className="font-mono tabular-nums">{page.total}</span>
              <ChevronRight aria-hidden="true" className={cn('size-3 transition-transform', page.open && 'rotate-90')} />
            </button>
          );
        })}
      </div>

      {activeRoles.some((role) => context.pages[role].open) && (
        <div className="anim-disclosure-in space-y-2 pt-0.5">
          <p className="m-0 text-[11px] leading-4 text-muted-foreground">{t('audit.localScopeHint')}</p>
          {activeRoles.map((role) => {
            const page = context.pages[role];
            if (!page.open) return null;
            const roleName = role === 'contradiction'
              ? t('audit.hasContradictions')
              : role === 'condition'
                ? t('audit.hasConditions')
                : t(`audit.${role}`);
            const fullLabel = `${owner.title || owner.id} · ${roleName}`;
            return (
              <div key={page.key} className="space-y-1.5">
                <AuditPageControls page={page} label={fullLabel} defaultLimit={0} onExpand={onExpand} />
                {page.items.map((edge) => (
                  <CompactLocalCard
                    key={edge.id}
                    edge={edge}
                    ownerId={owner.id}
                    role={role}
                    byId={byId}
                    selectedId={selectedId}
                    rootProposer={rootProposer}
                    multiActor={multiActor}
                    actorSpotlightClass={actorSpotlightClass}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TetheredPremises({
  supportEdgeId,
  supportNodeId,
  audit,
  rootId,
  selectedId,
  rootProposer,
  multiActor,
  premisesBySupport,
  localBranchContexts,
  actorSpotlightClass,
  onSelect,
  onExpand,
}: {
  supportEdgeId: string;
  supportNodeId: string;
  audit: AuditSelection;
  rootId: string;
  selectedId: string | null;
  rootProposer: string | null;
  multiActor: boolean;
  premisesBySupport: ReadonlyMap<string, BoardEdge[]>;
  localBranchContexts: ReadonlyMap<string, AuditLocalContext>;
  actorSpotlightClass: (actor: string | null) => string | undefined;
  onSelect: (id: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const attached = premisesBySupport.get(supportNodeId);
  if (!attached?.length) return null;
  const byId = audit.index.byId;

  return (
    <div className="mt-2.5 ml-1 space-y-1.5 border-l-2 border-(--rel-support)/55 pl-3">
      {attached.map((edge) => {
        const premiseId = edgePeer(edge, supportNodeId);
        const premise = byId.get(premiseId);
        const premiseText = premise ? presentNode(premise) : null;
        const premiseActor = edgeActor(edge, byId, supportNodeId);
        const premiseLocal = localBranchContexts.get(premiseLocalBranchKey(supportEdgeId, edge.id));
        return (
          <div key={edge.id} className={cn('rounded-lg border bg-secondary/20 px-2.5 py-2 text-xs transition-all', actorSpotlightClass(premiseActor))}>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <GitCommitVertical aria-hidden="true" className="size-3 text-(--rel-support)" />
              <span className="font-medium text-(--rel-support)">{t('audit.tetheredPremise')}</span>
              <RelationBadge kind={edge.kind} />
              <span className="ml-auto inline-flex items-center gap-1.5">
                <ActorProvenanceBadge actor={premiseActor} rootProposer={rootProposer} role="premise" multiActor={multiActor} />
                <span className="font-mono text-[10.5px]">{premiseId}</span>
              </span>
            </div>
            <button
              type="button"
              aria-label={`${premise?.title || premiseId} · ${premiseId}`}
              onClick={() => onSelect(premiseId)}
              className="mt-1 block w-full rounded text-left font-medium text-foreground outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {premiseText ? premiseText.headline : premiseId}
            </button>
            {premiseText?.summary && (
              <p className="m-0 mt-0.5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {renderInlineCode(premiseText.summary)}
              </p>
            )}
            {edge.label && (
              <p className="m-0 mt-1 border-l-2 border-(--rel-support)/45 pl-2 text-xs leading-4 text-subtle">
                {renderInlineCode(edge.label)}
              </p>
            )}
            {premise && <LocationChip node={premise} />}
            {premiseLocal && (
              <InlineLocalBranch
                context={premiseLocal}
                rootId={rootId}
                allowExtraRoles={selectedId === premiseId}
                byId={byId}
                selectedId={selectedId}
                rootProposer={rootProposer}
                multiActor={multiActor}
                actorSpotlightClass={actorSpotlightClass}
                onSelect={onSelect}
                onExpand={onExpand}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DossierRelationCard({
  edge,
  ownerId,
  role,
  rootId,
  audit,
  selectedId,
  rootProposer,
  showProvenance,
  multiActor,
  premisesBySupport,
  localBranchContexts,
  changes,
  fresh,
  actorSpotlightClass,
  onSelect,
  onOpenArgument,
  onExpand,
}: {
  edge: BoardEdge;
  ownerId: string;
  role: ArgumentRole | 'premise';
  rootId: string;
  audit: AuditSelection;
  selectedId: string | null;
  rootProposer: string | null;
  showProvenance: boolean;
  multiActor: boolean;
  premisesBySupport: ReadonlyMap<string, BoardEdge[]>;
  localBranchContexts: ReadonlyMap<string, AuditLocalContext>;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
  actorSpotlightClass: (actor: string | null) => string | undefined;
  onSelect: (id: string) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const byId = audit.index.byId;
  const otherId = edgePeer(edge, ownerId);
  const other = byId.get(otherId);
  const otherText = other ? presentNode(other) : null;
  const selectedHere = selectedId === otherId;
  const relTone = relationTone(edge.kind) || ROLE_TONE[role];
  const isCounter = role === 'contradiction';
  const cardActor = edgeActor(edge, byId, ownerId);
  const localContext = localBranchContexts.get(cardLocalBranchKey(role, edge.id));
  const shared = role !== 'related' ? sharedAuditReferences(audit.index, otherId, rootId, 2) : { items: [], remaining: 0 };

  return (
    <article
      style={{ '--r': relTone } as CssVars}
      className={cn(
        'relative rounded-xl border p-3.5 text-xs leading-5 transition-all',
        isCounter && 'border-dashed',
        selectedHere ? 'border-foreground/40 bg-accent/40 shadow-xs' : 'bg-card shadow-2xs hover:border-strong',
        actorSpotlightClass(cardActor),
        fresh?.has(otherId) && 'fresh-pulse',
      )}
    >
      <i aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[2.5px] rounded-r-full bg-(--r)" />
      <div className="pl-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <RelationBadge kind={edge.kind} />
          {other && <span className="text-muted-foreground">{typeLabel(other.type)}</span>}
          {other?.status && <StatusPill status={other.status} compact />}
          {other?.confidence && <ConfidencePill confidence={other.confidence} compact />}
          {other?.severity && <SeverityBadge severity={other.severity} className="px-1.5 text-[10px]" />}
          <span className="ml-auto inline-flex items-center gap-1.5">
            <ChangeDeltaBadge change={changes?.get(otherId)} compact />
            {showProvenance && role !== 'related' && (
              <ActorProvenanceBadge actor={cardActor} rootProposer={rootProposer} role={role} multiActor={multiActor} />
            )}
            <span className="font-mono text-[10.5px] text-muted-foreground">{otherId}</span>
          </span>
        </div>

        <button
          type="button"
          aria-label={`${other?.title || otherId} · ${otherId}`}
          onClick={() => onSelect(otherId)}
          className={cn(
            'mt-1.5 block w-full rounded text-left text-[13.5px] font-semibold leading-5 text-foreground outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring',
            other && isRetiredNode(other) && 'text-muted-foreground',
          )}
        >
          {otherText ? otherText.headline : otherId}
        </button>

        {otherText?.summary && (
          <p className="m-0 mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {renderInlineCode(otherText.summary)}
          </p>
        )}

        {edge.label && (
          <p className="m-0 mt-2 border-l-2 border-(--r)/60 pl-2.5 py-0.5 text-xs leading-4 text-subtle">
            {renderInlineCode(edge.label)}
          </p>
        )}

        {other && <LocationChip node={other} />}

        {(shared.items.length > 0 || (other && (isAuditCandidate(other) || isAuditIssue(other)))) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {shared.items.map((peer) => (
              <button
                key={peer.id}
                type="button"
                onClick={() => onOpenArgument(peer)}
                className="inline-flex items-center gap-1 rounded-md border bg-secondary/45 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-strong hover:text-foreground"
                title={`${t('audit.sharedWith')}: ${peer.title || peer.id}`}
              >
                <ArrowLeftRight aria-hidden="true" className="size-2.5 shrink-0" />
                <span>{t('audit.sharedWith')}</span>
                <span className="font-mono text-foreground">{peer.id}</span>
              </button>
            ))}
            {shared.remaining > 0 && (
              <span className="rounded bg-secondary/45 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                +{shared.remaining}
              </span>
            )}
            {other && (isAuditCandidate(other) || isAuditIssue(other)) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 max-w-full px-2 text-left text-[11px]"
                onClick={() => onOpenArgument(other)}
              >
                {t('audit.openArgument')}: {other.id}
              </Button>
            )}
          </div>
        )}

        {role === 'support' && (
          <TetheredPremises
            supportEdgeId={edge.id}
            supportNodeId={otherId}
            audit={audit}
            rootId={rootId}
            selectedId={selectedId}
            rootProposer={rootProposer}
            multiActor={multiActor}
            premisesBySupport={premisesBySupport}
            localBranchContexts={localBranchContexts}
            actorSpotlightClass={actorSpotlightClass}
            onSelect={onSelect}
            onExpand={onExpand}
          />
        )}
        {localContext && (
          <InlineLocalBranch
            context={localContext}
            rootId={rootId}
            allowExtraRoles={selectedHere}
            byId={byId}
            selectedId={selectedId}
            rootProposer={rootProposer}
            multiActor={multiActor}
            actorSpotlightClass={actorSpotlightClass}
            onSelect={onSelect}
            onExpand={onExpand}
          />
        )}
      </div>
    </article>
  );
}

export function DossierWingSection({
  page,
  label,
  role,
  emptyText,
  defaultLimit = AUDIT_BATCH,
  itemsOverride,
  expandedEmpty,
  onToggleEmpty,
  rootId,
  audit,
  selectedId,
  rootProposer,
  showProvenance,
  multiActor,
  premisesBySupport,
  localBranchContexts,
  changes,
  fresh,
  actorSpotlightClass,
  onSelect,
  onOpenArgument,
  onExpand,
}: {
  page: AuditPage<BoardEdge>;
  label: string;
  role: ArgumentRole | 'premise';
  emptyText?: string;
  defaultLimit?: number;
  itemsOverride?: BoardEdge[];
  expandedEmpty: boolean;
  onToggleEmpty: (key: string) => void;
  rootId: string;
  audit: AuditSelection;
  selectedId: string | null;
  rootProposer: string | null;
  showProvenance: boolean;
  multiActor: boolean;
  premisesBySupport: ReadonlyMap<string, BoardEdge[]>;
  localBranchContexts: ReadonlyMap<string, AuditLocalContext>;
  changes?: ReadonlyMap<string, NodeChange> | null;
  fresh?: ReadonlySet<string>;
  actorSpotlightClass: (actor: string | null) => string | undefined;
  onSelect: (id: string) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const items = itemsOverride ?? page.items;
  const isEmpty = page.total === 0;
  const isExpanded = isEmpty ? expandedEmpty : page.open;

  return (
    <section
      aria-label={label}
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        isEmpty ? 'border-dashed border-border/80 bg-secondary/20' : 'bg-card/65 shadow-2xs',
      )}
    >
      <button
        type="button"
        aria-label={`${label} · ${page.total}`}
        aria-expanded={isExpanded}
        onClick={() => {
          if (isEmpty) onToggleEmpty(page.key);
          else onExpand(page.key, 'toggle', defaultLimit);
        }}
        className={cn(
          'flex w-full items-center gap-2 px-3.5 text-left text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isEmpty
            ? 'py-2 text-muted-foreground hover:bg-secondary/45 hover:text-foreground'
            : 'bg-secondary/35 py-2.5 text-foreground hover:bg-secondary/55',
        )}
      >
        <i
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', isEmpty && 'opacity-55')}
          style={{ background: ROLE_TONE[role] }}
        />
        <span className="flex-1">{label}</span>
        <span className={cn(
          'rounded px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums',
          isEmpty ? 'text-muted-foreground/75' : 'bg-card text-muted-foreground',
        )}>
          {page.total}
        </span>
        <ChevronRight aria-hidden="true" className={cn('size-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
      </button>

      {isExpanded && (
        <div className="anim-disclosure-in space-y-2.5 border-t border-border/60 p-3">
          <AuditPageControls page={page} label={label} defaultLimit={defaultLimit} onExpand={onExpand} />
          {items.length > 0 ? (
            <div className={cn('space-y-2.5', role === 'related' && 'grid gap-2.5 space-y-0 @2xl:grid-cols-2')}>
              {items.map((edge) => (
                <DossierRelationCard
                  key={edge.id}
                  edge={edge}
                  ownerId={role === 'premise' ? (audit.premiseOwners.get(edge.id) ?? rootId) : rootId}
                  role={role}
                  rootId={rootId}
                  audit={audit}
                  selectedId={selectedId}
                  rootProposer={rootProposer}
                  showProvenance={showProvenance}
                  multiActor={multiActor}
                  premisesBySupport={premisesBySupport}
                  localBranchContexts={localBranchContexts}
                  changes={changes}
                  fresh={fresh}
                  actorSpotlightClass={actorSpotlightClass}
                  onSelect={onSelect}
                  onOpenArgument={onOpenArgument}
                  onExpand={onExpand}
                />
              ))}
            </div>
          ) : (
            emptyText && <p className="m-0 py-0.5 text-xs text-muted-foreground">{emptyText}</p>
          )}
        </div>
      )}
    </section>
  );
}
