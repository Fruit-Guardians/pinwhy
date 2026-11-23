import type { BoardEdge, BoardNode, GraphSnapshot, UltraSlice, UltraSnapshot } from '../../types';
import { hasTag, isOpenNode, isRetiredNode } from './helpers';
import type {
  UltraChord,
  UltraFilter,
  UltraIntraLink,
  UltraOrbitalBar,
  UltraSatellite,
  UltraSectorView,
} from './types';

const CHAIN_EDGE_KINDS = new Set([
  'supports',
  'proves',
  'prove',
  'depends-on',
  'derived-from',
  'caused-by',
  'contradicts',
]);

export function assignTraceBusLanes(rawChords: UltraChord[]): { chords: UltraChord[]; busLaneCount: number } {
  const sorted = [...rawChords].sort((a, b) => {
    const spanA = Math.abs(a.targetIndex - a.sourceIndex);
    const spanB = Math.abs(b.targetIndex - b.sourceIndex);
    const minA = Math.min(a.sourceIndex, a.targetIndex);
    const minB = Math.min(b.sourceIndex, b.targetIndex);
    return spanA - spanB || minA - minB || a.id.localeCompare(b.id);
  });

  const lanes: [number, number][][] = [];
  for (const chord of sorted) {
    const lo = Math.min(chord.sourceIndex, chord.targetIndex);
    const hi = Math.max(chord.sourceIndex, chord.targetIndex);
    let assigned = -1;
    for (let idx = 0; idx < lanes.length; idx++) {
      const conflict = lanes[idx].some(([a, b]) => !(hi < a || lo > b));
      if (!conflict) {
        assigned = idx;
        lanes[idx].push([lo, hi]);
        break;
      }
    }
    if (assigned === -1) {
      assigned = lanes.length;
      lanes.push([[lo, hi]]);
    }
    chord.laneIndex = assigned;
  }

  return { chords: sorted, busLaneCount: lanes.length };
}

export function sortSectorNames(names: Iterable<string>): string[] {
  return [...names].sort((a, b) => {
    if (a === 'unscoped' && b !== 'unscoped') return 1;
    if (b === 'unscoped' && a !== 'unscoped') return -1;
    if (a === 'root' && b !== 'root') return 1;
    if (b === 'root' && a !== 'root') return -1;
    return a.localeCompare(b);
  });
}

export function collectSectorView({
  sector,
  parentSector,
  index,
  startAngle,
  endAngle,
  midAngle,
  bars,
  slices,
  nodeIds,
  byId,
  filter,
}: {
  sector: string;
  parentSector?: string;
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  bars: UltraOrbitalBar[];
  slices: UltraSlice[];
  nodeIds: Iterable<string>;
  byId: Map<string, BoardNode>;
  filter: UltraFilter;
}): UltraSectorView {
  const uniqueNodeIds = [...new Set(nodeIds)];
  const nodeList = uniqueNodeIds.map((id) => byId.get(id)!).filter(Boolean);
  const coveredSlices = slices.length
    ? slices.filter((s) => s.effectiveStatus === 'cleared' || s.effectiveStatus === 'flagged' || s.effectiveStatus === 'excluded').length
    : bars.filter((b) => b.status === 'cleared' || b.status === 'flagged' || b.status === 'excluded').length;

  return {
    sector,
    ...(parentSector ? { parentSector } : {}),
    index,
    startAngle,
    endAngle,
    midAngle,
    bars,
    totalSlices: slices.length || bars.length,
    totalLines: slices.reduce((acc, s) => acc + (s.lines || 0), 0),
    coveredSlices,
    pendingSlices: slices.filter((s) => s.effectiveStatus === 'pending').length,
    staleSlices: slices.filter((s) => s.effectiveStatus === 'stale').length,
    shallowSlices: slices.filter((s) => s.effectiveStatus === 'shallow').length,
    flaggedSlices: slices.filter((s) => s.effectiveStatus === 'flagged').length,
    nodeIds: uniqueNodeIds,
    findingsCount: nodeList.filter((n) => ['finding', 'vuln'].includes(n.type) && !isRetiredNode(n)).length,
    openCount: nodeList.filter(isOpenNode).length,
    primitivesCount: nodeList.filter((n) => hasTag(n, 'role=primitive') || hasTag(n, 'role=anomaly') || n.type === 'anomaly').length,
    humanCount: nodeList.filter((n) => n.author === 'human' || n.updatedBy === 'human').length,
    matchesFilter: filter === 'all' ? true : bars.some((b) => b.matchesFilter),
  };
}

export function buildCrossSectorChords({
  allEdges,
  ultra,
  sourceMode,
  gaps,
  sectorMap,
  nodeSectorMap,
  sliceSectorMap,
  nodeBarMap,
  sliceBarMap,
  fallbackSliceSectorMap,
  collectIntraLinks,
}: {
  allEdges: BoardEdge[];
  ultra?: UltraSnapshot | null;
  sourceMode: 'ledger' | 'board-derived';
  gaps: UltraSnapshot['gaps'];
  sectorMap: Map<string, UltraSectorView>;
  nodeSectorMap: Map<string, string>;
  sliceSectorMap: Map<string, string>;
  nodeBarMap: Map<string, UltraOrbitalBar>;
  sliceBarMap: Map<string, UltraOrbitalBar>;
  fallbackSliceSectorMap?: Map<string, string>;
  collectIntraLinks?: UltraIntraLink[];
}): { chords: UltraChord[]; busLaneCount: number } {
  const rawChords: UltraChord[] = [];
  const seenChordKeys = new Set<string>();
  const addChord = (chord: UltraChord) => {
    if (seenChordKeys.has(chord.id)) return;
    seenChordKeys.add(chord.id);
    rawChords.push(chord);
  };

  for (const edge of allEdges) {
    const fromSec = nodeSectorMap.get(edge.from);
    const toSec = nodeSectorMap.get(edge.to);
    if (!fromSec || !toSec || fromSec === toSec) continue;
    const srcView = sectorMap.get(fromSec);
    const dstView = sectorMap.get(toSec);
    if (!srcView || !dstView) continue;
    addChord({
      id: edge.id,
      kind: edge.kind,
      label: edge.label || edge.kind,
      sourceSector: fromSec,
      targetSector: toSec,
      sourceAngle: nodeBarMap.get(edge.from)?.angle ?? srcView.midAngle,
      targetAngle: nodeBarMap.get(edge.to)?.angle ?? dstView.midAngle,
      sourceIndex: srcView.index,
      targetIndex: dstView.index,
      laneIndex: 0,
      fromId: edge.from,
      toId: edge.to,
      sourceNodeId: edge.from,
      targetNodeId: edge.to,
      isChain: CHAIN_EDGE_KINDS.has(edge.kind),
    });
  }

  if (sourceMode === 'ledger' && ultra) {
    for (const slice of ultra.slices) {
      const fromSec = sliceSectorMap.get(slice.id) || slice.sector;
      for (const depId of slice.dependsOn || []) {
        const toSec = sliceSectorMap.get(depId) || fallbackSliceSectorMap?.get(depId);
        if (!toSec) continue;
        if (toSec === fromSec) {
          if (collectIntraLinks) {
            const fromBar = sliceBarMap.get(slice.id);
            const toBar = sliceBarMap.get(depId);
            if (fromBar && toBar && fromBar.id !== toBar.id) {
              const unverified = slice.effectiveStatus === 'shallow'
                && slice.shallowReason === 'unverified-dependency'
                && Boolean(slice.unverifiedDependencies?.includes(depId));
              collectIntraLinks.push({
                id: `intra:${slice.id}->${depId}`,
                fromId: slice.id,
                toId: depId,
                fromAngle: fromBar.angle,
                toAngle: toBar.angle,
                sector: fromSec,
                unverified,
              });
            }
          }
          continue;
        }
        const srcView = sectorMap.get(fromSec);
        const dstView = sectorMap.get(toSec);
        if (!srcView || !dstView) continue;
        addChord({
          id: `dep:${slice.id}->${depId}`,
          kind: 'depends-on',
          label: `${slice.id} → ${depId}`,
          sourceSector: fromSec,
          targetSector: toSec,
          sourceAngle: sliceBarMap.get(slice.id)?.angle ?? srcView.midAngle,
          targetAngle: sliceBarMap.get(depId)?.angle ?? dstView.midAngle,
          sourceIndex: srcView.index,
          targetIndex: dstView.index,
          laneIndex: 0,
          fromId: slice.id,
          toId: depId,
          sourceNodeId: null,
          targetNodeId: null,
          isChain: true,
        });
      }
    }
  }

  for (const chain of gaps.awakenedChains) {
    const hSec = nodeSectorMap.get(chain.hypothesis.id);
    if (!hSec) continue;
    const dstView = sectorMap.get(hSec);
    if (!dstView) continue;
    for (const match of chain.matches) {
      const mSec = nodeSectorMap.get(match.nodeId);
      if (!mSec || mSec === hSec) continue;
      const srcView = sectorMap.get(mSec);
      if (!srcView) continue;
      addChord({
        id: `awakened:${match.nodeId}->${chain.hypothesis.id}`,
        kind: match.via,
        label: match.via,
        sourceSector: mSec,
        targetSector: hSec,
        sourceAngle: nodeBarMap.get(match.nodeId)?.angle ?? srcView.midAngle,
        targetAngle: nodeBarMap.get(chain.hypothesis.id)?.angle ?? dstView.midAngle,
        sourceIndex: srcView.index,
        targetIndex: dstView.index,
        laneIndex: 0,
        fromId: match.nodeId,
        toId: chain.hypothesis.id,
        sourceNodeId: match.nodeId,
        targetNodeId: chain.hypothesis.id,
        isChain: true,
        isAwakened: true,
      });
    }
  }

  return assignTraceBusLanes(rawChords);
}

export function buildSatellites({
  graph,
  byId,
  nodeSectorMap,
  nodeDisplaySectorMap,
  nodeBarMap,
  displayNodeBarMap,
  sectorMap,
  displaySectorMap,
}: {
  graph: GraphSnapshot;
  byId: Map<string, BoardNode>;
  nodeSectorMap: Map<string, string>;
  nodeDisplaySectorMap: Map<string, string>;
  nodeBarMap: Map<string, UltraOrbitalBar>;
  displayNodeBarMap: Map<string, UltraOrbitalBar>;
  sectorMap: Map<string, UltraSectorView>;
  displaySectorMap: Map<string, UltraSectorView>;
}): UltraSatellite[] {
  const satellites: UltraSatellite[] = [];
  for (const [agentId, cursor] of Object.entries(graph.cursors || {})) {
    const nodeId = cursor?.to;
    if (!nodeId || !byId.has(nodeId)) continue;
    const sec = nodeDisplaySectorMap.get(nodeId) || nodeSectorMap.get(nodeId) || 'unscoped';
    const angle = displayNodeBarMap.get(nodeId)?.angle
      ?? displaySectorMap.get(sec)?.midAngle
      ?? nodeBarMap.get(nodeId)?.angle
      ?? sectorMap.get(sec)?.midAngle
      ?? -Math.PI / 2;
    satellites.push({
      agentId,
      shortName: agentId.replace(/^agent:/, ''),
      nodeId,
      sector: sec,
      angle,
    });
  }
  return satellites;
}
