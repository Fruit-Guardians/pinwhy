import { values, type BoardEdge, type BoardNode, type GraphSnapshot } from '../../types';
import {
  argumentRole,
  edgeActor,
  edgePeer,
  emptyGroups,
  isAuditCandidate,
  isAuditIssue,
  membershipKinds,
  recordActor,
  type ArgumentRole,
  type AuditIndex,
  type AuditPostureKind,
  type AuditProvenance,
} from './types';

const RETIRED_AUDIT_STATUS = new Set(['dead', 'refuted', 'superseded']);

function computeCandidateProvenance(
  candidate: BoardNode,
  byId: ReadonlyMap<string, BoardNode>,
  argumentsByNode: ReadonlyMap<string, Record<ArgumentRole, BoardEdge[]>>,
  multiActor: boolean,
): AuditProvenance {
  const proposer = recordActor(candidate);
  const participantSet = new Set<string>();
  if (proposer) participantSet.add(proposer);
  const direct = argumentsByNode.get(candidate.id) ?? emptyGroups();
  let crossSupported = false;
  let crossChallenged = false;
  let localDisputeCount = 0;

  for (const edge of direct.support) {
    const peerId = edgePeer(edge, candidate.id);
    const peer = byId.get(peerId);
    const actor = edgeActor(edge, byId, candidate.id);
    if (actor) {
      participantSet.add(actor);
      if (proposer && actor !== proposer) crossSupported = true;
    }
    if (peer && !isAuditIssue(peer) && !isAuditCandidate(peer)) {
      const local = argumentsByNode.get(peerId);
      for (const pEdge of local?.support ?? []) {
        if (edgePeer(pEdge, peerId) === candidate.id) continue;
        const pActor = edgeActor(pEdge, byId, peerId);
        if (pActor) {
          participantSet.add(pActor);
          if (proposer && pActor !== proposer) crossSupported = true;
        }
      }
      for (const cEdge of local?.contradiction ?? []) {
        localDisputeCount++;
        const cActor = edgeActor(cEdge, byId, peerId);
        if (cActor) {
          participantSet.add(cActor);
          if (proposer && cActor !== proposer) crossChallenged = true;
        }
      }
    }
  }

  for (const edge of direct.contradiction) {
    const actor = edgeActor(edge, byId, candidate.id);
    if (actor) {
      participantSet.add(actor);
      if (proposer && actor !== proposer) crossChallenged = true;
    }
  }

  for (const edge of direct.condition) {
    const peerId = edgePeer(edge, candidate.id);
    const actor = edgeActor(edge, byId, candidate.id);
    if (actor) participantSet.add(actor);
    for (const cEdge of argumentsByNode.get(peerId)?.contradiction ?? []) {
      localDisputeCount++;
      const cActor = edgeActor(cEdge, byId, peerId);
      if (cActor) {
        participantSet.add(cActor);
        if (proposer && cActor !== proposer) crossChallenged = true;
      }
    }
  }

  const retired = Boolean(candidate.status && RETIRED_AUDIT_STATUS.has(candidate.status));
  const hasOpenDispute = !retired && (direct.contradiction.length > 0 || localDisputeCount > 0);
  const participants = [...participantSet];
  const singleSource = multiActor && !retired && proposer !== null && participants.length === 1 && !crossSupported && !crossChallenged;
  const posture: AuditPostureKind = retired
    ? 'converged'
    : hasOpenDispute
      ? 'contested'
      : crossSupported
        ? 'corroborated'
        : singleSource
          ? 'single'
          : 'neutral';

  return { proposer, participants, crossSupported, crossChallenged, hasOpenDispute, singleSource, posture };
}

/** Built once per immutable snapshot, with no issue × candidate × edge scans. */
export function buildAuditIndex(snapshot: GraphSnapshot): AuditIndex {
  const nodes = values(snapshot.nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const edges = values(snapshot.edges).filter((edge) => byId.has(edge.from) && byId.has(edge.to));
  const edgeOrder = new Map(edges.map((edge, index) => [edge.id, index]));
  const adjacency = new Map<string, BoardEdge[]>();
  const argumentsByNode = new Map<string, Record<ArgumentRole, BoardEdge[]>>();
  const issues = nodes.filter(isAuditIssue);
  const candidates = nodes.filter(isAuditCandidate);
  const memberships = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    const memberIssues = new Set<string>();
    memberships.set(candidate.id, memberIssues);
    for (const tag of Array.isArray(candidate.tags) ? candidate.tags : []) {
      if (typeof tag !== 'string' || !tag.startsWith('issue=')) continue;
      const issue = byId.get(tag.slice(6));
      if (issue && isAuditIssue(issue)) memberIssues.add(issue.id);
    }
  }
  for (const edge of edges) {
    for (const id of new Set([edge.from, edge.to])) {
      const list = adjacency.get(id) ?? [];
      list.push(edge);
      adjacency.set(id, list);
      const groups = argumentsByNode.get(id) ?? emptyGroups();
      groups[argumentRole(edge, id)].push(edge);
      argumentsByNode.set(id, groups);
    }
    if (!Object.hasOwn(membershipKinds, edge.kind)) continue;
    for (const [candidateId, issueId] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const candidateIssues = memberships.get(candidateId);
      const issue = byId.get(issueId);
      if (candidateIssues && issue && isAuditIssue(issue)) candidateIssues.add(issueId);
    }
  }
  const membership = new Map<string, BoardNode[]>(issues.map((issue) => [issue.id, []]));
  const reverseMembership = new Map<string, BoardNode[]>();
  const unassigned: BoardNode[] = [];
  const orderOf = (id: string) => nodeOrder.get(id) ?? 0;
  for (const candidate of candidates) {
    const ids = [...(memberships.get(candidate.id) ?? [])].sort((a, b) => orderOf(a) - orderOf(b));
    reverseMembership.set(candidate.id, ids.flatMap((id) => { const issue = byId.get(id); return issue ? [issue] : []; }));
    if (!ids.length) unassigned.push(candidate);
    for (const id of ids) membership.get(id)?.push(candidate);
  }
  const actorSet = new Set<string>();
  for (const node of nodes) {
    const actor = recordActor(node);
    if (actor) actorSet.add(actor);
  }
  for (const edge of edges) {
    const actor = recordActor(edge);
    if (actor) actorSet.add(actor);
  }
  const actors = [...actorSet];
  const multiActor = actors.length > 1;
  const provenance = new Map<string, AuditProvenance>();
  for (const candidate of candidates) {
    provenance.set(candidate.id, computeCandidateProvenance(candidate, byId, argumentsByNode, multiActor));
  }
  return { snapshot, nodes, byId, edges, nodeOrder, edgeOrder, adjacency, arguments: argumentsByNode, issues, candidates, membership, reverseMembership, unassigned, actors, multiActor, provenance };
}
