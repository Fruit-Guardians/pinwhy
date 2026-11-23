import type { BoardEdge, BoardNode } from '../../types';
import {
  AUDIT_BATCH,
  argumentRole,
  auditPage,
  buildRolePages,
  edgePeer,
  emptyGroups,
  isAuditCandidate,
  isAuditIssue,
  membershipKinds,
  roles,
  type ArgumentRole,
  type AuditExpansion,
  type AuditIndex,
  type AuditLocalContext,
  type AuditNodeRole,
  type AuditPage,
  type AuditSelection,
} from './types';

/** Other candidates or issues that explicitly cite this evidence/condition record, in authored order. */
export function sharedAuditReferences(index: AuditIndex, nodeId: string, excludeId: string | null, limit = 3): { items: BoardNode[]; remaining: number } {
  const seen = new Set<string>();
  const peers: BoardNode[] = [];
  for (const edge of index.adjacency.get(nodeId) ?? []) {
    const peerId = edgePeer(edge, nodeId);
    if (peerId === nodeId || peerId === excludeId || seen.has(peerId)) continue;
    const peer = index.byId.get(peerId);
    if (!peer || (!isAuditCandidate(peer) && !isAuditIssue(peer))) continue;
    if (argumentRole(edge, peerId) === 'related') continue;
    seen.add(peerId);
    peers.push(peer);
  }
  peers.sort((a, b) => (index.nodeOrder.get(a.id) ?? 0) - (index.nodeOrder.get(b.id) ?? 0));
  return { items: peers.slice(0, limit), remaining: Math.max(0, peers.length - limit) };
}

type ResolvedAuditRoot = {
  issue: BoardNode | null;
  candidate: BoardNode | null;
  root: BoardNode | null;
  members: BoardNode[];
  memberIds: Set<string>;
  candidateIssues: BoardNode[];
  outsideIssue: boolean;
  missingIssue: boolean;
  missingCandidate: boolean;
};

type AuditScope = {
  index: AuditIndex;
  rootState: ResolvedAuditRoot;
  selectedId: string | null;
  expansion: AuditExpansion;
  pinEdge: (edge: BoardEdge) => boolean;
};

type ArgumentPath = { edge: BoardEdge; owner: string; role: AuditNodeRole };

type PremiseCollection = {
  premises: AuditPage<BoardEdge>;
  supportPage: AuditPage<BoardEdge>;
  allPremises: BoardEdge[];
  premiseOwners: Map<string, string>;
  supportParents: Map<string, BoardEdge>;
  paths: Map<string, ArgumentPath>;
};

type AuditGraphState = {
  nodeRoles: Map<string, AuditNodeRole[]>;
  argumentEdges: Set<string>;
  localEdges: Map<string, BoardEdge>;
  contexts: Map<string, AuditLocalContext>;
};

function resolveAuditRoot(index: AuditIndex, issueId: string | null, candidateId: string | null): ResolvedAuditRoot {
  const namedIssue = issueId ? index.byId.get(issueId) ?? null : null;
  const namedCandidate = candidateId ? index.byId.get(candidateId) ?? null : null;
  const issue = namedIssue && isAuditIssue(namedIssue) ? namedIssue : null;
  const candidate = namedCandidate && isAuditCandidate(namedCandidate) ? namedCandidate : null;
  const root = candidate ?? issue;
  const members = issue ? (index.membership.get(issue.id) ?? []) : index.candidates;
  const memberIds = new Set(members.map((node) => node.id));
  const candidateIssues = candidate ? (index.reverseMembership.get(candidate.id) ?? []) : [];
  return {
    issue,
    candidate,
    root,
    members,
    memberIds,
    candidateIssues,
    outsideIssue: Boolean(issue && candidate && !memberIds.has(candidate.id)),
    missingIssue: Boolean(issueId && !issue),
    missingCandidate: Boolean(candidateId && !candidate),
  };
}

function collectPremisePages(scope: AuditScope, direct: Record<ArgumentRole, BoardEdge[]>, supportPage: AuditPage<BoardEdge>): PremiseCollection {
  const { index, rootState: { root }, selectedId, expansion } = scope;
  const premiseEdges = new Map<string, BoardEdge>();
  const premiseOwners = new Map<string, string>();
  const supportParents = new Map<string, BoardEdge>();
  const paths = new Map<string, ArgumentPath>();
  if (!root) {
    return { premises: auditPage<BoardEdge>([], 'premises', expansion, AUDIT_BATCH), supportPage, allPremises: [], premiseOwners, supportParents, paths };
  }
  for (const edge of direct.support) {
    const id = edgePeer(edge, root.id);
    supportParents.set(id, edge);
    const node = index.byId.get(id);
    if (!node || isAuditIssue(node) || isAuditCandidate(node)) continue;
    for (const premise of index.arguments.get(id)?.support ?? []) {
      if (edgePeer(premise, id) === root.id) continue;
      premiseEdges.set(premise.id, premise);
      premiseOwners.set(premise.id, id);
    }
  }
  const allPremises = [...premiseEdges.values()].sort((a, b) => (index.edgeOrder.get(a.id) ?? 0) - (index.edgeOrder.get(b.id) ?? 0));
  const pinPremise = (edge: BoardEdge) => { const owner = premiseOwners.get(edge.id); return owner !== undefined && edgePeer(edge, owner) === selectedId; };
  const visibleSupports = new Set(supportPage.items.map((edge) => edgePeer(edge, root.id)));
  const premiseLimit = expansion.premises ?? AUDIT_BATCH;
  const eligiblePremises = allPremises.filter((edge, position) => {
    const owner = premiseOwners.get(edge.id);
    return (owner !== undefined && visibleSupports.has(owner)) || pinPremise(edge) || (premiseLimit > AUDIT_BATCH && position < premiseLimit);
  });
  const premises = auditPage(eligiblePremises, 'premises', expansion, AUDIT_BATCH, pinPremise);
  premises.total = allPremises.length;
  premises.hidden = allPremises.length - premises.shown;

  const requiredSupportEdges = new Set(supportPage.items.map((edge) => edge.id));
  for (const edge of premises.items) {
    const owner = premiseOwners.get(edge.id);
    const parentEdge = owner ? supportParents.get(owner) : undefined;
    if (parentEdge) requiredSupportEdges.add(parentEdge.id);
  }
  const updatedItems = direct.support.filter((edge) => requiredSupportEdges.has(edge.id));
  const updatedSupportPage: AuditPage<BoardEdge> = { ...supportPage, items: updatedItems, shown: updatedItems.length, hidden: supportPage.total - updatedItems.length };

  for (const role of ['support', 'contradiction', 'condition'] as const) {
    for (const edge of direct[role]) paths.set(edgePeer(edge, root.id), { edge, owner: root.id, role });
  }
  for (const edge of allPremises) {
    const owner = premiseOwners.get(edge.id);
    if (!owner) continue;
    const id = edgePeer(edge, owner);
    if (!paths.has(id)) paths.set(id, { edge, owner, role: 'premise' });
  }
  return { premises, supportPage: updatedSupportPage, allPremises, premiseOwners, supportParents, paths };
}

function addNodeRole(state: AuditGraphState, id: string, role: AuditNodeRole) {
  const current = state.nodeRoles.get(id) ?? [];
  if (!current.includes(role)) state.nodeRoles.set(id, [...current, role]);
}

function revealArgumentEdge(state: AuditGraphState, rootId: string, edge: BoardEdge, owner: string, role: AuditNodeRole) {
  const id = edgePeer(edge, owner);
  if (id !== rootId) addNodeRole(state, id, role);
  state.argumentEdges.add(edge.id);
  state.localEdges.set(edge.id, edge);
}

function ensureLocalContext(state: AuditGraphState, scope: AuditScope, id: string) {
  const { index, rootState: { root }, selectedId, expansion, pinEdge } = scope;
  if (state.contexts.has(id) || id === root?.id) return;
  const node = index.byId.get(id);
  if (!node) return;
  const local = index.arguments.get(id) ?? emptyGroups();
  state.contexts.set(id, {
    node,
    groups: local,
    pages: buildRolePages((role) => auditPage(local[role], `local:${id}:${role}`, expansion, 0, (edge) => selectedId !== id && pinEdge(edge))),
  });
}

function expandLocalContexts(
  state: AuditGraphState,
  scope: AuditScope,
  pages: Record<ArgumentRole, AuditPage<BoardEdge>>,
  premiseState: PremiseCollection,
  memberCatalogItems: BoardNode[],
) {
  const { index, rootState: { root, candidate, issue, memberIds }, selectedId } = scope;
  if (!root) return;
  addNodeRole(state, root.id, 'root');
  for (const role of roles) {
    for (const edge of pages[role].items) revealArgumentEdge(state, root.id, edge, root.id, role);
  }
  for (const edge of premiseState.premises.items) {
    const owner = premiseState.premiseOwners.get(edge.id);
    const parentEdge = owner ? premiseState.supportParents.get(owner) : undefined;
    if (parentEdge) revealArgumentEdge(state, root.id, parentEdge, root.id, 'support');
    if (owner) {
      const id = edgePeer(edge, owner);
      if (!state.nodeRoles.has(id)) addNodeRole(state, id, 'premise');
    }
    state.argumentEdges.add(edge.id);
    state.localEdges.set(edge.id, edge);
  }
  if (!candidate && issue) {
    for (const member of memberCatalogItems) addNodeRole(state, member.id, 'candidate');
    for (const edge of index.adjacency.get(issue.id) ?? []) {
      const peerId = edgePeer(edge, issue.id);
      if (state.nodeRoles.has(peerId) && memberIds.has(peerId) && Object.hasOwn(membershipKinds, edge.kind)) state.localEdges.set(edge.id, edge);
    }
  }
  if (selectedId && selectedId !== root.id) {
    for (const edge of index.adjacency.get(selectedId) ?? []) {
      const owner = edgePeer(edge, selectedId);
      const path = premiseState.paths.get(owner);
      if (!path) continue;
      if (!state.nodeRoles.has(owner)) {
        const parentEdge = path.owner !== root.id ? premiseState.supportParents.get(path.owner) : undefined;
        if (parentEdge) revealArgumentEdge(state, root.id, parentEdge, root.id, 'support');
        revealArgumentEdge(state, root.id, path.edge, path.owner, path.role);
      }
      const role = argumentRole(edge, owner);
      revealArgumentEdge(state, root.id, edge, owner, role === 'contradiction' ? 'localContradiction' : role === 'condition' ? 'localCondition' : 'related');
    }
  }
  if (selectedId && index.byId.has(selectedId)) {
    if (!state.nodeRoles.has(selectedId)) addNodeRole(state, selectedId, 'related');
    ensureLocalContext(state, scope, selectedId);
  }
  for (const [id, nodeRole] of state.nodeRoles) {
    if (nodeRole.some((role) => role === 'support' || role === 'premise' || role === 'condition' || role === 'localCondition')) {
      ensureLocalContext(state, scope, id);
    }
  }
  // Appended contexts have closed pages by default. Only reader-expanded rows reveal more nodes.
  for (const [id, item] of state.contexts) {
    for (const role of roles) {
      for (const edge of item.pages[role].items) {
        revealArgumentEdge(state, root.id, edge, id, role === 'contradiction' ? 'localContradiction' : role === 'condition' ? 'localCondition' : 'related');
        if (role === 'condition' || role === 'support') ensureLocalContext(state, scope, edgePeer(edge, id));
      }
    }
  }
}

function collectBoundaryRelated(
  state: AuditGraphState,
  scope: AuditScope,
  direct: Record<ArgumentRole, BoardEdge[]>,
  allPremises: BoardEdge[],
  baseRelated: BoardEdge[],
) {
  const { index, rootState: { candidate, issue, members }, expansion, pinEdge } = scope;
  const boundary = new Map(baseRelated.map((edge) => [edge.id, edge]));
  const structural = [...direct.support, ...direct.contradiction, ...direct.condition, ...allPremises];
  const structuralEdges = new Set(structural.map((edge) => edge.id));
  const boundaryIds = new Set<string>();
  for (const edge of structural) { boundaryIds.add(edge.from); boundaryIds.add(edge.to); }
  if (!candidate && issue) for (const member of members) boundaryIds.add(member.id);
  for (const id of boundaryIds) {
    for (const edge of index.adjacency.get(id) ?? []) if (!structuralEdges.has(edge.id)) boundary.set(edge.id, edge);
  }
  const related = [...boundary.values()].sort((a, b) => (index.edgeOrder.get(a.id) ?? 0) - (index.edgeOrder.get(b.id) ?? 0));
  const relatedPage = auditPage(related, 'related', expansion, 0, pinEdge);
  for (const edge of relatedPage.items) {
    if (!state.nodeRoles.has(edge.from)) addNodeRole(state, edge.from, 'related');
    if (!state.nodeRoles.has(edge.to)) addNodeRole(state, edge.to, 'related');
    state.localEdges.set(edge.id, edge);
  }
  return { related, relatedPage };
}

export function selectAudit(index: AuditIndex, issueId: string | null, candidateId: string | null, selectedId: string | null = null, expansion: AuditExpansion = {}): AuditSelection {
  const { snapshot, byId, adjacency, issues, candidates } = index;
  const rootState = resolveAuditRoot(index, issueId, candidateId);
  const { issue, candidate, root, members, candidateIssues, outsideIssue, missingIssue, missingCandidate } = rootState;
  const direct = root ? index.arguments.get(root.id) ?? emptyGroups() : emptyGroups();
  const groups = { ...direct, related: [...direct.related] };
  const pinEdge = (edge: BoardEdge) => selectedId !== root?.id && (edge.from === selectedId || edge.to === selectedId);
  const scope: AuditScope = { index, rootState, selectedId, expansion, pinEdge };

  const initialPages = buildRolePages((role) => auditPage(groups[role], role, expansion, role === 'related' ? 0 : AUDIT_BATCH, pinEdge));
  const catalog = {
    issues: auditPage(issues, 'issues', expansion, AUDIT_BATCH, (node) => node.id === issue?.id),
    members: auditPage(members, 'members', expansion, AUDIT_BATCH, (node) => node.id === candidate?.id || node.id === selectedId),
    candidateIssues: auditPage(candidateIssues, 'candidateIssues', expansion),
    unassigned: auditPage(index.unassigned, 'unassigned', expansion, 0, (node) => node.id === selectedId),
    records: auditPage(index.nodes, 'records', expansion, root ? 0 : AUDIT_BATCH, (node) => node.id === selectedId),
  };

  const premiseState = collectPremisePages(scope, direct, initialPages.support);
  const pages: Record<ArgumentRole, AuditPage<BoardEdge>> = { ...initialPages, support: premiseState.supportPage };
  const graphState: AuditGraphState = { nodeRoles: new Map(), argumentEdges: new Set(), localEdges: new Map(), contexts: new Map() };

  expandLocalContexts(graphState, scope, pages, premiseState, catalog.members.items);
  if (root) {
    const boundary = collectBoundaryRelated(graphState, scope, direct, premiseState.allPremises, groups.related);
    groups.related = boundary.related;
    pages.related = boundary.relatedPage;
  }
  if (selectedId && byId.has(selectedId)) {
    if (!graphState.nodeRoles.has(selectedId)) addNodeRole(graphState, selectedId, 'related');
    ensureLocalContext(graphState, scope, selectedId);
    for (const edge of adjacency.get(selectedId) ?? []) {
      if (graphState.nodeRoles.has(edge.from) && graphState.nodeRoles.has(edge.to)) graphState.localEdges.set(edge.id, edge);
    }
  }
  if (!root && !graphState.nodeRoles.size && index.nodes.length === 1) addNodeRole(graphState, index.nodes[0].id, 'related');

  const visibleIds = new Set(graphState.nodeRoles.keys());
  const visibleNodes = [...visibleIds]
    .sort((a, b) => (index.nodeOrder.get(a) ?? 0) - (index.nodeOrder.get(b) ?? 0))
    .flatMap((id) => { const node = byId.get(id); return node ? [node] : []; });

  return {
    index,
    issues,
    candidates,
    issue,
    candidate,
    root,
    members,
    groups,
    pages,
    premises: premiseState.premises,
    premiseOwners: premiseState.premiseOwners,
    catalog,
    contexts: graphState.contexts,
    argumentEdges: graphState.argumentEdges,
    nodeRoles: graphState.nodeRoles,
    outsideIssue,
    candidateIssues,
    missingIssue,
    missingCandidate,
    unassigned: index.unassigned,
    records: index.nodes,
    visibleIds,
    snapshot: { ...snapshot, nodes: visibleNodes, edges: [...graphState.localEdges.values()].sort((a, b) => (index.edgeOrder.get(a.id) ?? 0) - (index.edgeOrder.get(b.id) ?? 0)) },
  };
}
