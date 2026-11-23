import type { BoardEdge } from '../../../../types';
import {
  edgeActor,
  edgePeer,
  recordActor,
  type ArgumentRole,
  type AuditLocalContext,
  type AuditSelection,
} from '../../../audit';

export const LOCAL_ROLES: readonly ArgumentRole[] = ['contradiction', 'condition', 'support', 'related'];

export const cardLocalBranchKey = (role: ArgumentRole | 'premise', edgeId: string) => `card:${role}:${edgeId}`;
export const premiseLocalBranchKey = (supportEdgeId: string, premiseEdgeId: string) =>
  `premise:${supportEdgeId}:${premiseEdgeId}`;

export function getActiveLocalRoles(
  context: AuditLocalContext,
  rootId: string,
  allowExtraRoles: boolean,
): ArgumentRole[] {
  const nonRootEdges = (edges: BoardEdge[]) => edges.filter((edge) => edgePeer(edge, context.node.id) !== rootId);
  return LOCAL_ROLES.filter((role) => (
    role === 'contradiction' || role === 'condition'
      ? context.groups[role].length > 0
      : allowExtraRoles && nonRootEdges(context.groups[role]).length > 0
  ));
}

export function computeDossierDisplayMeta(
  audit: AuditSelection,
  rootId: string,
  selectedId: string | null,
) {
  const byId = audit.index.byId;
  const root = byId.get(rootId);
  const actorSet = new Set<string>();
  const rootProposer = root ? recordActor(root) : null;
  if (rootProposer) actorSet.add(rootProposer);

  const premisesBySupport = new Map<string, BoardEdge[]>();
  for (const edge of audit.premises.items) {
    const owner = audit.premiseOwners.get(edge.id);
    if (!owner) continue;
    const list = premisesBySupport.get(owner) ?? [];
    list.push(edge);
    premisesBySupport.set(owner, list);
  }

  const renderedLocalIds = new Set<string>();
  const renderedPremiseIds = new Set<string>();
  const localBranchContexts = new Map<string, AuditLocalContext>();

  const claimLocalBranch = (
    occurrenceKey: string | null,
    context: AuditLocalContext,
    allowExtraRoles: boolean,
  ) => {
    const activeRoles = getActiveLocalRoles(context, rootId, allowExtraRoles);
    if (!activeRoles.length) return;
    renderedLocalIds.add(context.node.id);
    if (occurrenceKey) localBranchContexts.set(occurrenceKey, context);
    for (const role of activeRoles) {
      const page = context.pages[role];
      if (!page.open) continue;
      for (const edge of page.items) {
        const actor = edgeActor(edge, byId, context.node.id);
        if (actor) actorSet.add(actor);
      }
    }
  };

  const inspectWing = (role: ArgumentRole | 'premise', pageOpen: boolean, items: BoardEdge[], isSupport: boolean) => {
    if (!pageOpen) return;
    for (const edge of items) {
      const ownerId = role === 'premise' ? (audit.premiseOwners.get(edge.id) ?? rootId) : rootId;
      const otherId = edgePeer(edge, ownerId);
      const actor = edgeActor(edge, byId, ownerId);
      if (actor) actorSet.add(actor);

      if (isSupport) {
        const attached = premisesBySupport.get(otherId) ?? [];
        for (const premiseEdge of attached) {
          renderedPremiseIds.add(premiseEdge.id);
          const pActor = edgeActor(premiseEdge, byId, otherId);
          if (pActor) actorSet.add(pActor);
          const premiseId = edgePeer(premiseEdge, otherId);
          if (!renderedLocalIds.has(premiseId)) {
            const premiseCtx = audit.contexts.get(premiseId);
            if (premiseCtx) {
              claimLocalBranch(
                premiseLocalBranchKey(edge.id, premiseEdge.id),
                premiseCtx,
                selectedId === premiseId,
              );
            }
          }
        }
      }

      if (!renderedLocalIds.has(otherId)) {
        const ctx = audit.contexts.get(otherId);
        if (ctx) claimLocalBranch(cardLocalBranchKey(role, edge.id), ctx, selectedId === otherId);
      }
    }
  };

  inspectWing('support', audit.pages.support.open, audit.pages.support.items, true);
  const unattachedPremises = audit.premises.items.filter((edge) => !renderedPremiseIds.has(edge.id));
  const showPremiseOverflow = audit.premises.total > 0 && (
    !audit.premises.open || audit.premises.hidden > 0 || unattachedPremises.length > 0
  );
  if (showPremiseOverflow) inspectWing('premise', audit.premises.open, unattachedPremises, false);

  inspectWing('contradiction', audit.pages.contradiction.open, audit.pages.contradiction.items, false);
  inspectWing('condition', audit.pages.condition.open, audit.pages.condition.items, false);

  const local = selectedId && selectedId !== rootId ? audit.contexts.get(selectedId) ?? null : null;
  const fallbackLocal = local && !renderedLocalIds.has(local.node.id) ? local : null;
  if (fallbackLocal) claimLocalBranch(null, fallbackLocal, true);

  return {
    premisesBySupport,
    unattachedPremises,
    showPremiseOverflow,
    localBranchContexts,
    fallbackLocal,
    rootProposer,
    actors: [...actorSet],
  };
}
