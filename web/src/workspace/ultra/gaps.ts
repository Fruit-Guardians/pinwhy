import type { BoardEdge, BoardNode, UltraGapNode, UltraSlice, UltraSnapshot } from '../../types';
import {
  ANOMALY_EDGES,
  EVIDENCE_OUT,
  VERDICT_IN,
  compactGapNode,
  hasTag,
  isOpenNode,
  isRetiredNode,
  tagValue,
} from './helpers';
import type { UltraNextWave } from './types';

export function deriveGaps(nodes: BoardNode[], edges: BoardEdge[], byId: Map<string, BoardNode>): UltraSnapshot['gaps'] {
  const incoming = new Map<string, BoardEdge[]>(nodes.map((n) => [n.id, []]));
  const outgoing = new Map<string, BoardEdge[]>(nodes.map((n) => [n.id, []]));
  const connectedPairs = new Set<string>();
  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
    connectedPairs.add(`${edge.from}->${edge.to}`);
    connectedPairs.add(`${edge.to}->${edge.from}`);
  }

  const openThreads = nodes
    .filter(isOpenNode)
    .sort((a, b) => Number(b.updated || b.ts || 0) - Number(a.updated || a.ts || 0))
    .map(compactGapNode);

  const unbackedVerdicts: UltraGapNode[] = [];
  for (const node of nodes) {
    if (!['finding', 'vuln', 'hypothesis'].includes(node.type)) continue;
    if (!['confirmed', 'refuted'].includes(node.status || '')) continue;
    const hasIn = (incoming.get(node.id) || []).some((e) => VERDICT_IN.has(e.kind));
    const hasOut = (outgoing.get(node.id) || []).some((e) => EVIDENCE_OUT.has(e.kind));
    if (!hasIn && !hasOut) unbackedVerdicts.push(compactGapNode(node));
  }

  const primitivesAndFacts = nodes.filter((node) =>
    hasTag(node, 'role=primitive') ||
    (
      ['fact', 'observation', 'result'].includes(node.type) &&
      !isRetiredNode(node) &&
      (node.status === 'confirmed' || ['static-confirmed', 'reproduced', 'confirmed'].includes(node.confidence || ''))
    ),
  );

  const awakenedChains: UltraSnapshot['gaps']['awakenedChains'] = [];
  for (const hyp of nodes) {
    if (hyp.type !== 'hypothesis' || hyp.status !== 'deferred') continue;
    const pivots = new Set<string>();
    const ownPivot = tagValue(hyp, 'pivot');
    if (ownPivot) pivots.add(ownPivot);
    for (const edge of outgoing.get(hyp.id) || []) {
      if (edge.kind !== 'depends-on') continue;
      const target = byId.get(edge.to);
      const p = target ? tagValue(target, 'pivot') : null;
      if (p) pivots.add(p);
    }
    const ownComp = tagValue(hyp, 'component');
    const matches: { nodeId: string; title: string; via: string }[] = [];
    for (const candidate of primitivesAndFacts) {
      if (candidate.id === hyp.id || connectedPairs.has(`${candidate.id}->${hyp.id}`)) continue;
      const cPivot = tagValue(candidate, 'pivot');
      const cComp = tagValue(candidate, 'component');
      const pivotMatch = Boolean(cPivot && pivots.has(cPivot));
      const compMatch = Boolean(!pivots.size && ownComp && cComp && ownComp === cComp && hasTag(candidate, 'role=primitive'));
      if (pivotMatch || compMatch) {
        matches.push({ nodeId: candidate.id, title: candidate.title, via: pivotMatch ? `pivot=${cPivot}` : `component=${cComp}` });
      }
    }
    if (matches.length) awakenedChains.push({ hypothesis: compactGapNode(hyp), matches });
  }

  const unresolvedAnomalies = nodes
    .filter((node) => (hasTag(node, 'role=anomaly') || node.type === 'anomaly') && !['done', 'dead', 'refuted', 'superseded', 'confirmed'].includes(node.status || ''))
    .filter((node) => ![...(incoming.get(node.id) || []), ...(outgoing.get(node.id) || [])].some((e) => ANOMALY_EDGES.has(e.kind)))
    .map(compactGapNode);

  const humanSignals = nodes
    .filter((node) => node.author === 'human' || node.updatedBy === 'human')
    .sort((a, b) => Number(b.updated || b.ts || 0) - Number(a.updated || a.ts || 0))
    .map(compactGapNode);

  return {
    openThreads,
    unbackedVerdicts,
    awakenedChains,
    unresolvedAnomalies,
    humanSignals,
    untrackedFiles: [],
    diskStaleIds: [],
    shallowSlices: [],
    staleSlices: [],
  };
}

function nextWavePriority(slice: UltraSlice, dependentsMap: Map<string, number>): number {
  if (slice.shallowReason === 'human-followup') return 0;
  if (slice.effectiveStatus === 'stale') return 1;
  if ((dependentsMap.get(slice.id) || 0) > 0) return 2;
  if (slice.effectiveStatus === 'shallow') return 3;
  return 4;
}

export function computeNextWave(ultra?: UltraSnapshot | null): UltraNextWave | null {
  if (!ultra?.initialized || !ultra.slices?.length) return null;
  const activeIds = new Set(ultra.slices.map((s) => s.id));
  const dependentsMap = new Map<string, number>();
  for (const s of ultra.slices) {
    if (s.effectiveStatus === 'cleared' || s.effectiveStatus === 'flagged' || s.effectiveStatus === 'excluded') continue;
    for (const depId of s.dependsOn || []) {
      dependentsMap.set(depId, (dependentsMap.get(depId) || 0) + 1);
    }
  }
  const allRemaining = ultra.slices.filter((s) => s.effectiveStatus === 'stale' || s.effectiveStatus === 'shallow' || s.effectiveStatus === 'pending');
  if (!allRemaining.length) return null;
  const nonBlocked = allRemaining.filter((s) => {
    if (s.effectiveStatus === 'shallow' && s.shallowReason === 'unverified-dependency') {
      const activeDeps = (s.unverifiedDependencies || []).filter((id) => activeIds.has(id));
      return activeDeps.length === 0;
    }
    return true;
  });
  const remaining = (nonBlocked.length ? nonBlocked : allRemaining).sort((a, b) =>
    nextWavePriority(a, dependentsMap) - nextWavePriority(b, dependentsMap) ||
    a.sector.localeCompare(b.sector) ||
    (a.kind === 'probe' ? 0 : 1) - (b.kind === 'probe' ? 0 : 1) ||
    a.path.localeCompare(b.path) ||
    a.startLine - b.startLine ||
    a.id.localeCompare(b.id),
  );
  const sector = remaining[0].sector;
  const slices: UltraSlice[] = [];
  let totalLines = 0;
  for (const s of remaining) {
    if (s.sector !== sector) continue;
    if (slices.length > 0 && (totalLines + s.lines > 420 || slices.length >= 4)) break;
    slices.push(s);
    totalLines += s.lines;
  }
  return slices.length ? { sector, totalLines, slices } : null;
}
