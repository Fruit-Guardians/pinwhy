import {
  values,
  type BoardNode,
  type GraphSnapshot,
  type UltraSlice,
  type UltraSliceStatus,
  type UltraSnapshot,
} from '../../types';
import { computeNextWave, deriveGaps } from './gaps';
import {
  buildCrossSectorChords,
  buildSatellites,
  collectSectorView,
  sortSectorNames,
} from './geometry';
import {
  barMatchesFilter,
  classifyBeacon,
  hasTag,
  isOpenNode,
  isRetiredNode,
  nodeMatchesWeight,
  parseNodeLocation,
  relativeInSector,
  sectorOfNode,
  sliceWeight,
  tagValue,
} from './helpers';
import type {
  UltraBeacon,
  UltraFilter,
  UltraIntraLink,
  UltraLens,
  UltraModel,
  UltraOrbitalBar,
  UltraSectorView,
} from './types';

type DraftBar = Omit<UltraOrbitalBar, 'angle'>;
type SectorBucket = { bars: DraftBar[]; nodeIds: Set<string>; slices: UltraSlice[] };

function buildStandaloneNodeBar(
  node: BoardNode,
  sec: string,
  awakenedNodeIds: Set<string>,
  filter: UltraFilter,
  ledgerStandalone: boolean,
): DraftBar {
  const loc = parseNodeLocation(node);
  const beacons: UltraBeacon[] = [];
  const tone = classifyBeacon(node, awakenedNodeIds);
  if (tone) beacons.push({ nodeId: node.id, tone, title: node.title, type: node.type });

  const status: UltraSliceStatus = isOpenNode(node)
    ? 'pending'
    : ledgerStandalone
      ? (beacons.length ? 'flagged' : 'cleared')
      : node.status === 'deferred'
        ? 'shallow'
        : beacons.some((b) => b.tone === 'critical' || b.tone === 'hot')
          ? 'flagged'
          : 'cleared';

  const label = !ledgerStandalone && loc?.path
    ? `${loc.path}${loc.line ? `:${loc.line}` : ''}`
    : node.id;

  const draftBar: Omit<UltraOrbitalBar, 'angle' | 'matchesFilter'> = {
    id: `node:${node.id}`,
    kind: 'node',
    sector: sec,
    label,
    shortLabel: loc?.path ? relativeInSector(loc.path, sec) : node.id,
    rangeLabel: loc?.path ? `${loc.line ? `:${loc.line} · ` : ''}${node.id}` : node.type,
    sublabel: node.title,
    lines: 0,
    status,
    weight: nodeMatchesWeight(node),
    nodeIds: [node.id],
    primaryNodeId: node.id,
    beacons,
  };
  return { ...draftBar, matchesFilter: barMatchesFilter(draftBar, [node], filter, awakenedNodeIds) };
}

function buildSliceBar(
  slice: UltraSlice,
  linked: BoardNode[],
  awakenedNodeIds: Set<string>,
  filter: UltraFilter,
): DraftBar {
  const beacons: UltraBeacon[] = [];
  for (const n of linked) {
    const tone = classifyBeacon(n, awakenedNodeIds);
    if (tone) beacons.push({ nodeId: n.id, tone, title: n.title, type: n.type });
  }
  const isProbe = slice.kind === 'probe';
  const draftBar: Omit<UltraOrbitalBar, 'angle' | 'matchesFilter'> = {
    id: slice.id,
    kind: 'slice',
    sector: slice.sector,
    label: isProbe ? (slice.title || slice.path) : `${slice.path}:${slice.startLine}-${slice.endLine}`,
    shortLabel: isProbe ? (slice.title || relativeInSector(slice.path, slice.sector)) : relativeInSector(slice.path, slice.sector),
    rangeLabel: isProbe
      ? (slice.path && !slice.path.startsWith('[probe]/') ? `${relativeInSector(slice.path, slice.sector)}:${slice.startLine} · probe` : 'probe')
      : `:${slice.startLine}-${slice.endLine} · ${slice.lines}L`,
    sublabel: isProbe ? (slice.note || slice.title || 'probe') : (slice.note || `${slice.lines}L`),
    lines: slice.lines,
    status: slice.effectiveStatus,
    shallowReason: slice.shallowReason,
    weight: sliceWeight(slice.lines, linked.length),
    slice,
    nodeIds: linked.map((n) => n.id),
    primaryNodeId: linked[0]?.id ?? null,
    beacons,
  };
  return { ...draftBar, matchesFilter: barMatchesFilter(draftBar, linked, filter, awakenedNodeIds) };
}

function populateLedgerBuckets({
  ultra,
  allNodes,
  byId,
  awakenedNodeIds,
  filter,
  ensureBucket,
  nodeSectorMap,
  sliceSectorMap,
}: {
  ultra: UltraSnapshot;
  allNodes: BoardNode[];
  byId: Map<string, BoardNode>;
  awakenedNodeIds: Set<string>;
  filter: UltraFilter;
  ensureBucket: (name: string) => SectorBucket;
  nodeSectorMap: Map<string, string>;
  sliceSectorMap: Map<string, string>;
}) {
  const slicesByPath = new Map<string, UltraSlice[]>();
  const sliceNodes = new Map<string, BoardNode[]>();
  for (const slice of ultra.slices) {
    sliceSectorMap.set(slice.id, slice.sector);
    sliceNodes.set(slice.id, []);
    const list = slicesByPath.get(slice.path) || [];
    list.push(slice);
    slicesByPath.set(slice.path, list);
    ensureBucket(slice.sector).slices.push(slice);
  }

  const assignedNodeIds = new Set<string>();
  for (const slice of ultra.slices) {
    for (const refId of slice.refs || []) {
      const node = byId.get(refId);
      if (!node) continue;
      sliceNodes.get(slice.id)!.push(node);
      assignedNodeIds.add(node.id);
      if (!nodeSectorMap.has(node.id)) nodeSectorMap.set(node.id, slice.sector);
    }
  }

  const sliceById = new Map(ultra.slices.map((s) => [s.id, s]));
  const standaloneBarsBySector = new Map<string, DraftBar[]>();
  for (const node of allNodes) {
    if (assignedNodeIds.has(node.id)) continue;
    const taggedSliceId = tagValue(node, 'slice');
    if (taggedSliceId && sliceById.has(taggedSliceId)) {
      const hit = sliceById.get(taggedSliceId)!;
      sliceNodes.get(hit.id)!.push(node);
      assignedNodeIds.add(node.id);
      nodeSectorMap.set(node.id, hit.sector);
      continue;
    }
    const loc = parseNodeLocation(node);
    if (loc?.path) {
      const candidates = slicesByPath.get(loc.path);
      if (candidates?.length) {
        const hit = (loc.line !== null
          ? candidates.find((s) => loc.line! >= s.startLine && loc.line! <= s.endLine)
          : null) || candidates[0];
        sliceNodes.get(hit.id)!.push(node);
        assignedNodeIds.add(node.id);
        nodeSectorMap.set(node.id, hit.sector);
        continue;
      }
    }
    const sec = sectorOfNode(node);
    if (node.type === 'goal' && sec === 'unscoped') continue;
    nodeSectorMap.set(node.id, sec);
    const bucket = ensureBucket(sec);
    bucket.nodeIds.add(node.id);
    const placed = buildStandaloneNodeBar(node, sec, awakenedNodeIds, filter, true);
    const extraList = standaloneBarsBySector.get(sec) || [];
    extraList.push(placed);
    standaloneBarsBySector.set(sec, extraList);
  }

  for (const slice of ultra.slices) {
    const bucket = ensureBucket(slice.sector);
    const linked = sliceNodes.get(slice.id) || [];
    for (const n of linked) bucket.nodeIds.add(n.id);
    bucket.bars.push(buildSliceBar(slice, linked, awakenedNodeIds, filter));
  }

  for (const [sec, extra] of standaloneBarsBySector.entries()) {
    ensureBucket(sec).bars.push(...extra);
  }
}

function buildDisplayProjection({
  sectors,
  nodeSectorMap,
  sliceSectorMap,
  byId,
  filter,
}: {
  sectors: UltraSectorView[];
  nodeSectorMap: Map<string, string>;
  sliceSectorMap: Map<string, string>;
  byId: Map<string, BoardNode>;
  filter: UltraFilter;
}) {
  const displayRawBuckets = new Map<string, { parentSector: string; rawBars: UltraOrbitalBar[] }>();
  const sliceDisplaySectorMap = new Map<string, string>();
  const nodeDisplaySectorMap = new Map<string, string>();
  const displayBarById = new Map<string, UltraOrbitalBar>();

  for (const sec of sectors) {
    const canSplit = sec.bars.length > 10;
    const subKeys = new Set<string>();
    const perBarKey = sec.bars.map((bar) => {
      const p = bar.slice?.path || (bar.primaryNodeId ? parseNodeLocation(byId.get(bar.primaryNodeId)!)?.path : undefined) || '';
      if (canSplit && sec.sector !== 'root' && sec.sector !== 'unscoped' && p.startsWith(`${sec.sector}/`)) {
        const rest = p.slice(sec.sector.length + 1);
        const sub = rest.includes('/') ? rest.split('/')[0] : '';
        const key = sub ? `${sec.sector}/${sub}` : sec.sector;
        subKeys.add(key);
        return key;
      }
      subKeys.add(sec.sector);
      return sec.sector;
    });
    const useSplit = canSplit && subKeys.size > 1;
    sec.bars.forEach((bar, idx) => {
      const targetSec = useSplit ? perBarKey[idx] : sec.sector;
      const entry = displayRawBuckets.get(targetSec) || { parentSector: sec.sector, rawBars: [] };
      entry.rawBars.push(bar);
      displayRawBuckets.set(targetSec, entry);
      if (bar.kind === 'slice') sliceDisplaySectorMap.set(bar.id, targetSec);
      for (const nid of bar.nodeIds) {
        if (!nodeDisplaySectorMap.has(nid)) nodeDisplaySectorMap.set(nid, targetSec);
      }
    });
  }
  for (const [nid, sec] of nodeSectorMap.entries()) {
    if (!nodeDisplaySectorMap.has(nid)) nodeDisplaySectorMap.set(nid, sec);
  }
  for (const [sid, sec] of sliceSectorMap.entries()) {
    if (!sliceDisplaySectorMap.has(sid)) sliceDisplaySectorMap.set(sid, sec);
  }

  const displaySectorNames = sortSectorNames(displayRawBuckets.keys());
  const gapRad = displaySectorNames.length > 1 ? Math.min(0.085, (Math.PI * 0.34) / displaySectorNames.length) : 0;
  const usableRad = Math.PI * 2 - gapRad * displaySectorNames.length;
  const totalSlots = displaySectorNames.reduce((acc, n) => acc + Math.max(2, displayRawBuckets.get(n)!.rawBars.length), 0) || 1;
  let cursor = -Math.PI / 2;
  const displaySectors: UltraSectorView[] = [];
  const displaySectorMap = new Map<string, UltraSectorView>();
  const displayBarMap = new Map<string, UltraOrbitalBar>();
  const displayNodeBarMap = new Map<string, UltraOrbitalBar>();

  displaySectorNames.forEach((name, idx) => {
    const bucket = displayRawBuckets.get(name)!;
    const span = usableRad * (Math.max(2, bucket.rawBars.length) / totalSlots);
    const startAngle = cursor;
    const endAngle = startAngle + span;
    const midAngle = (startAngle + endAngle) / 2;
    cursor = endAngle + gapRad;

    const pad = Math.min(0.03, span * 0.14);
    const innerSpan = Math.max(0.01, span - pad * 2);
    const dBars: UltraOrbitalBar[] = bucket.rawBars.map((bar, bIdx) => {
      const ratio = (bIdx + 0.5) / Math.max(1, bucket.rawBars.length);
      const angle = startAngle + pad + ratio * innerSpan;
      const p = bar.slice?.path || (bar.primaryNodeId ? parseNodeLocation(byId.get(bar.primaryNodeId)!)?.path : undefined) || '';
      const cloned: UltraOrbitalBar = {
        ...bar,
        sector: name,
        shortLabel: bar.slice?.kind === 'probe' ? bar.shortLabel : (p ? relativeInSector(p, name) : bar.shortLabel),
        angle,
      };
      displayBarById.set(cloned.id, cloned);
      if (cloned.kind === 'slice') displayBarMap.set(cloned.id, cloned);
      for (const nid of cloned.nodeIds) {
        if (!displayNodeBarMap.has(nid)) displayNodeBarMap.set(nid, cloned);
      }
      return cloned;
    });

    const sliceItems = dBars.map((b) => b.slice).filter((s): s is UltraSlice => Boolean(s));
    const view = collectSectorView({
      sector: name,
      parentSector: bucket.parentSector,
      index: idx,
      startAngle,
      endAngle,
      midAngle,
      bars: dBars,
      slices: sliceItems,
      nodeIds: dBars.flatMap((b) => b.nodeIds),
      byId,
      filter,
    });
    displaySectors.push(view);
    displaySectorMap.set(name, view);
  });

  return {
    displaySectors,
    displaySectorMap,
    displayBarById,
    displayBarMap,
    displayNodeBarMap,
    sliceDisplaySectorMap,
    nodeDisplaySectorMap,
  };
}

export function buildUltraModel(
  graph: GraphSnapshot,
  ultra?: UltraSnapshot | null,
  options: { lens?: UltraLens; filter?: UltraFilter } = {},
): UltraModel {
  const filter = options.filter ?? 'all';
  const allNodes = values(graph.nodes);
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const allEdges = values(graph.edges).filter((e) => byId.has(e.from) && byId.has(e.to));

  const sourceMode: 'ledger' | 'board-derived' = ultra?.initialized ? 'ledger' : 'board-derived';
  const gaps = sourceMode === 'ledger' && ultra ? ultra.gaps : deriveGaps(allNodes, allEdges, byId);

  const awakenedNodeIds = new Set<string>();
  for (const chain of gaps.awakenedChains) {
    awakenedNodeIds.add(chain.hypothesis.id);
    for (const m of chain.matches) awakenedNodeIds.add(m.nodeId);
  }

  const nodeSectorMap = new Map<string, string>();
  const sliceSectorMap = new Map<string, string>();
  const sliceBarMap = new Map<string, UltraOrbitalBar>();
  const nodeBarMap = new Map<string, UltraOrbitalBar>();
  const sectorBuckets = new Map<string, SectorBucket>();
  const ensureBucket = (name: string) => {
    if (!sectorBuckets.has(name)) sectorBuckets.set(name, { bars: [], nodeIds: new Set(), slices: [] });
    return sectorBuckets.get(name)!;
  };

  if (sourceMode === 'ledger' && ultra) {
    populateLedgerBuckets({
      ultra,
      allNodes,
      byId,
      awakenedNodeIds,
      filter,
      ensureBucket,
      nodeSectorMap,
      sliceSectorMap,
    });
  } else {
    for (const node of allNodes) {
      const sec = sectorOfNode(node);
      if (node.type === 'goal' && sec === 'unscoped') continue;
      nodeSectorMap.set(node.id, sec);
      const bucket = ensureBucket(sec);
      bucket.nodeIds.add(node.id);
      bucket.bars.push(buildStandaloneNodeBar(node, sec, awakenedNodeIds, filter, false));
    }
  }

  const sectorNames = sortSectorNames(sectorBuckets.keys());
  const gapRad = sectorNames.length > 1 ? Math.min(0.11, (Math.PI * 0.34) / sectorNames.length) : 0;
  const usableRad = Math.PI * 2 - gapRad * sectorNames.length;
  const totalSlots = sectorNames.reduce((acc, name) => acc + Math.max(2, sectorBuckets.get(name)!.bars.length), 0) || 1;

  let cursorAngle = -Math.PI / 2;
  const sectors: UltraSectorView[] = [];
  const bars: UltraOrbitalBar[] = [];
  const sectorMap = new Map<string, UltraSectorView>();

  sectorNames.forEach((name, sectorIndex) => {
    const bucket = sectorBuckets.get(name)!;
    const span = usableRad * (Math.max(2, bucket.bars.length) / totalSlots);
    const startAngle = cursorAngle;
    const endAngle = startAngle + span;
    const midAngle = (startAngle + endAngle) / 2;
    cursorAngle = endAngle + gapRad;

    const pad = Math.min(0.035, span * 0.14);
    const innerSpan = Math.max(0.01, span - pad * 2);
    const placedBars: UltraOrbitalBar[] = bucket.bars.map((bar, index) => {
      const ratio = (index + 0.5) / Math.max(1, bucket.bars.length);
      const placed: UltraOrbitalBar = { ...bar, angle: startAngle + pad + ratio * innerSpan };
      bars.push(placed);
      if (placed.kind === 'slice') sliceBarMap.set(placed.id, placed);
      for (const nid of placed.nodeIds) {
        if (!nodeBarMap.has(nid)) nodeBarMap.set(nid, placed);
      }
      return placed;
    });

    const view = collectSectorView({
      sector: name,
      index: sectorIndex,
      startAngle,
      endAngle,
      midAngle,
      bars: placedBars,
      slices: bucket.slices,
      nodeIds: bucket.nodeIds,
      byId,
      filter,
    });
    sectors.push(view);
    sectorMap.set(name, view);
  });

  const { chords, busLaneCount } = buildCrossSectorChords({
    allEdges,
    ultra,
    sourceMode,
    gaps,
    sectorMap,
    nodeSectorMap,
    sliceSectorMap,
    nodeBarMap,
    sliceBarMap,
  });

  const {
    displaySectors,
    displaySectorMap,
    displayBarById,
    displayBarMap,
    displayNodeBarMap,
    sliceDisplaySectorMap,
    nodeDisplaySectorMap,
  } = buildDisplayProjection({ sectors, nodeSectorMap, sliceSectorMap, byId, filter });

  const displayIntraLinks: UltraIntraLink[] = [];
  const displayChords = buildCrossSectorChords({
    allEdges,
    ultra,
    sourceMode,
    gaps,
    sectorMap: displaySectorMap,
    nodeSectorMap: nodeDisplaySectorMap,
    sliceSectorMap: sliceDisplaySectorMap,
    nodeBarMap: displayNodeBarMap,
    sliceBarMap: displayBarMap,
    fallbackSliceSectorMap: sliceSectorMap,
    collectIntraLinks: displayIntraLinks,
  }).chords;

  const satellites = buildSatellites({
    graph,
    byId,
    nodeSectorMap,
    nodeDisplaySectorMap,
    nodeBarMap,
    displayNodeBarMap,
    sectorMap,
    displaySectorMap,
  });

  const goal = allNodes.find((n) => n.type === 'goal' && !isRetiredNode(n)) || allNodes.find((n) => n.type === 'goal') || null;
  const findingsCount = allNodes.filter((n) => ['finding', 'vuln'].includes(n.type) && !isRetiredNode(n)).length;
  const primitivesCount = allNodes.filter((n) => hasTag(n, 'role=primitive') || hasTag(n, 'role=anomaly') || n.type === 'anomaly').length;

  const totalSlices = sourceMode === 'ledger' && ultra ? ultra.summary.totalSlices : bars.length;
  const clearedSlices = sourceMode === 'ledger' && ultra ? ultra.summary.coveredSlices : bars.filter((b) => b.status === 'cleared' || b.status === 'flagged' || b.status === 'excluded').length;
  const zeroNodeCleared = bars.filter((b) => b.status === 'cleared' && b.nodeIds.length === 0 && !(b.slice?.humanFollowups?.length)).length;
  const flaggedSlicesCount = bars.filter((b) => b.status === 'flagged').length;
  const shallowSlicesCount = bars.filter((b) => b.status === 'shallow' || b.status === 'stale').length;
  const pendingSlicesCount = bars.filter((b) => b.status === 'pending').length;
  const totalLines = sourceMode === 'ledger' && ultra ? ultra.summary.totalLines : bars.reduce((a, b) => a + b.lines, 0);
  const pendingLines = bars.filter((b) => b.status === 'pending' || b.status === 'shallow' || b.status === 'stale').reduce((a, b) => a + b.lines, 0);
  const blindSpots = sourceMode === 'ledger' && ultra ? ultra.summary.remainingSlices + ultra.summary.untrackedFiles + ultra.summary.diskStale : gaps.openThreads.length;
  const commitmentComplete = sourceMode === 'ledger' && ultra
    ? Boolean(ultra.commitmentComplete ?? (ultra.breadthComplete && gaps.unbackedVerdicts.length === 0))
    : gaps.unbackedVerdicts.length === 0 && gaps.openThreads.length === 0;
  const barById = new Map<string, UltraOrbitalBar>(bars.map((b) => [b.id, b]));
  for (const [k, v] of displayBarById.entries()) barById.set(k, v);
  const displayBars = displaySectors.flatMap((s) => s.bars);
  const pathCount = new Map<string, number>();
  for (const bar of bars) {
    if (bar.slice?.path) pathCount.set(bar.slice.path, (pathCount.get(bar.slice.path) || 0) + 1);
  }
  const multiSlicePaths = new Set<string>([...pathCount.entries()].filter(([, c]) => c > 1).map(([p]) => p));

  return {
    sourceMode,
    initialized: Boolean(ultra?.initialized),
    title: graph.meta?.title || '',
    scope: ultra?.scope ?? null,
    goal,
    breadthComplete: Boolean(ultra?.breadthComplete),
    commitmentComplete,
    allClear: Boolean(ultra?.allClear),
    sectors,
    displaySectors,
    displaySectorMap,
    displayBars,
    multiSlicePaths,
    bars,
    chords,
    displayChords,
    displayIntraLinks,
    busLaneCount,
    satellites,
    nextWave: computeNextWave(ultra),
    nodeSectorMap,
    sliceSectorMap,
    sliceDisplaySectorMap,
    nodeDisplaySectorMap,
    barById,
    sectorMap,
    byId,
    allNodes,
    allEdges,
    gaps,
    metrics: {
      totalSlices,
      clearedSlices,
      zeroNodeCleared,
      flaggedSlices: flaggedSlicesCount,
      shallowSlices: shallowSlicesCount,
      pendingSlices: pendingSlicesCount,
      totalLines,
      pendingLines,
      boardNodesCount: allNodes.length,
      blindSpots,
      openThreads: gaps.openThreads.length,
      findings: findingsCount,
      primitives: primitivesCount,
      awakenedChains: gaps.awakenedChains.length,
      humanSignals: gaps.humanSignals.length,
      coverageRatio: totalSlices > 0 ? clearedSlices / totalSlices : 0,
    },
  };
}
