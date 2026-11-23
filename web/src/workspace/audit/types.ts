import type { BoardEdge, BoardNode, GraphSnapshot } from '../../types';

export const isAuditIssue = (node: BoardNode) => node.type === 'question' || node.type === 'goal';
export const isAuditCandidate = (node: BoardNode) => ['finding', 'vuln', 'hypothesis'].includes(node.type);
export const edgePeer = (edge: Pick<BoardEdge, 'from' | 'to'>, id: string) => (edge.from === id ? edge.to : edge.from);

export type ArgumentRole = 'support' | 'contradiction' | 'condition' | 'related';
export type AuditNodeRole = ArgumentRole | 'root' | 'premise' | 'candidate' | 'localContradiction' | 'localCondition';
export type AuditPostureKind = 'contested' | 'corroborated' | 'single' | 'converged' | 'neutral';
export type AuditProvenance = {
  proposer: string | null;
  participants: string[];
  crossSupported: boolean;
  crossChallenged: boolean;
  hasOpenDispute: boolean;
  singleSource: boolean;
  posture: AuditPostureKind;
};

export const recordActor = (record: { author?: unknown } | null | undefined): string | null =>
  typeof record?.author === 'string' && record.author.trim() ? record.author.trim() : null;

export const edgeActor = (edge: BoardEdge, byId: ReadonlyMap<string, BoardNode>, ownerId: string): string | null =>
  recordActor(edge) ?? recordActor(byId.get(edgePeer(edge, ownerId)));

export const AUDIT_BATCH = 12;
export const roles: ArgumentRole[] = ['support', 'contradiction', 'condition', 'related'];
export const membershipKinds: Record<string, true> = { answers: true, 'related-to': true, refines: true };
export const emptyGroups = (): Record<ArgumentRole, BoardEdge[]> => ({ support: [], contradiction: [], condition: [], related: [] });

export function buildRolePages(build: (role: ArgumentRole) => AuditPage<BoardEdge>): Record<ArgumentRole, AuditPage<BoardEdge>> {
  return { support: build('support'), contradiction: build('contradiction'), condition: build('condition'), related: build('related') };
}

/** Direction is authored: A supports B, B derived-from A, B depends-on C. */
export function argumentRole(edge: BoardEdge, conclusion: string): ArgumentRole {
  if ((edge.to === conclusion && ['supports', 'proves', 'prove'].includes(edge.kind)) ||
    (edge.from === conclusion && edge.kind === 'derived-from')) return 'support';
  if (edge.kind === 'contradicts' && edge.to === conclusion) return 'contradiction';
  if (edge.from === conclusion && edge.kind === 'depends-on') return 'condition';
  return 'related';
}

export type AuditIndex = {
  snapshot: GraphSnapshot;
  nodes: BoardNode[];
  byId: Map<string, BoardNode>;
  edges: BoardEdge[];
  nodeOrder: Map<string, number>;
  edgeOrder: Map<string, number>;
  adjacency: Map<string, BoardEdge[]>;
  arguments: Map<string, Record<ArgumentRole, BoardEdge[]>>;
  issues: BoardNode[];
  candidates: BoardNode[];
  membership: Map<string, BoardNode[]>;
  reverseMembership: Map<string, BoardNode[]>;
  unassigned: BoardNode[];
  actors: string[];
  multiActor: boolean;
  provenance: Map<string, AuditProvenance>;
};

export type AuditExpansion = Record<string, number>;
export type AuditPage<T> = { key: string; items: T[]; total: number; shown: number; hidden: number; limit: number; open: boolean };
export type AuditExpansionAction = 'more' | 'collapse' | 'toggle';

export function changeAuditExpansion(expansion: AuditExpansion, key: string, action: AuditExpansionAction, defaultLimit = AUDIT_BATCH): AuditExpansion {
  const current = expansion[key] ?? defaultLimit;
  return { ...expansion, [key]: action === 'more' ? current + AUDIT_BATCH : action === 'collapse' ? defaultLimit : current > 0 ? 0 : AUDIT_BATCH };
}

/** A selected row is pinned without opening all the preceding rows. Order remains authored. */
export function auditPage<T>(items: T[], key: string, expansion: AuditExpansion, defaultLimit = AUDIT_BATCH, pinned?: (item: T) => boolean): AuditPage<T> {
  const limit = expansion[key] ?? defaultLimit;
  const shownItems = limit > 0 ? items.filter((item, index) => index < limit || Boolean(pinned?.(item))) : [];
  return { key, items: shownItems, total: items.length, shown: shownItems.length, hidden: items.length - shownItems.length, limit, open: limit > 0 };
}

export type AuditLocalContext = { node: BoardNode; groups: Record<ArgumentRole, BoardEdge[]>; pages: Record<ArgumentRole, AuditPage<BoardEdge>> };

export type AuditSelection = {
  index: AuditIndex;
  issues: BoardNode[];
  candidates: BoardNode[];
  issue: BoardNode | null;
  candidate: BoardNode | null;
  root: BoardNode | null;
  members: BoardNode[];
  groups: Record<ArgumentRole, BoardEdge[]>;
  pages: Record<ArgumentRole, AuditPage<BoardEdge>>;
  premises: AuditPage<BoardEdge>;
  premiseOwners: ReadonlyMap<string, string>;
  catalog: Record<'issues' | 'members' | 'candidateIssues' | 'unassigned' | 'records', AuditPage<BoardNode>>;
  contexts: Map<string, AuditLocalContext>;
  argumentEdges: Set<string>;
  nodeRoles: Map<string, AuditNodeRole[]>;
  outsideIssue: boolean;
  missingIssue: boolean;
  missingCandidate: boolean;
  candidateIssues: BoardNode[];
  unassigned: BoardNode[];
  records: BoardNode[];
  visibleIds: Set<string>;
  snapshot: GraphSnapshot;
};
