// Cognitive gap diagnostics, disk drift verification, and read-only Ultra snapshot projection.
import path from 'node:path';
import { isOpenThread } from '../domain/semantics.js';
import { isInitialized } from '../storage/board.js';
import { replay } from '../storage/event-log.js';
import { isAbsoluteHostPath, relativizeProjectPath, sanitizeSharedLoc, sanitizeSharedPath } from '../exports/shared-paths.js';
import { compactGapNode, fsSafeExists, hasTag, tagValue } from './helpers.js';
import { readUltraLedger } from './ledger.js';
import { DEFAULT_MAX_SLICE_LINES, scanTargetTree, sectorOfPath } from './scanner.js';
import { collectDependencyCycles, computeEffectiveSlices, summarizeSectors } from './slices.js';

const EVIDENCE_OUT = new Set(['derived-from', 'caused-by']);
const VERDICT_IN = new Set(['supports', 'proves', 'prove', 'contradicts']);
const ANOMALY_EDGES = new Set(['supports', 'contradicts', 'derived-from', 'resolves', 'supersedes']);

export function computeCognitiveGaps(graph) {
  const nodes = Object.values(graph.nodes || {});
  const edges = Object.values(graph.edges || {});
  const incoming = new Map(nodes.map((n) => [n.id, []]));
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  const connectedPairs = new Set();

  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
    connectedPairs.add(`${edge.from}->${edge.to}`);
    connectedPairs.add(`${edge.to}->${edge.from}`);
  }

  const openThreads = nodes
    .filter(isOpenThread)
    .sort((a, b) => (b.updated || b.ts || 0) - (a.updated || a.ts || 0))
    .map((node) => compactGapNode(node));

  const unbackedVerdicts = [];
  for (const node of nodes) {
    if (!['finding', 'vuln', 'hypothesis'].includes(node.type)) continue;
    if (!['confirmed', 'refuted'].includes(node.status)) continue;
    const hasIn = (incoming.get(node.id) || []).some((e) => VERDICT_IN.has(e.kind));
    const hasOut = (outgoing.get(node.id) || []).some((e) => EVIDENCE_OUT.has(e.kind));
    if (!hasIn && !hasOut) unbackedVerdicts.push(compactGapNode(node));
  }

  // Awakening candidates: deferred hypotheses whose dependency conditions or shared
  // pivot/component surfaces now have unlinked primitives or confirmed facts.
  const primitivesAndFacts = nodes.filter((node) =>
    hasTag(node, 'role=primitive') ||
    (
      ['fact', 'observation', 'result'].includes(node.type) &&
      !['refuted', 'dead', 'superseded'].includes(node.status) &&
      (node.status === 'confirmed' || ['static-confirmed', 'reproduced', 'confirmed'].includes(node.confidence))
    ),
  );

  const awakenedChains = [];
  for (const hyp of nodes) {
    if (hyp.type !== 'hypothesis' || hyp.status !== 'deferred') continue;
    const pivots = new Set();
    const ownPivot = tagValue(hyp, 'pivot');
    if (ownPivot) pivots.add(ownPivot);
    const deps = (outgoing.get(hyp.id) || []).filter((e) => e.kind === 'depends-on').map((e) => graph.nodes[e.to]).filter(Boolean);
    for (const dep of deps) {
      const dp = tagValue(dep, 'pivot');
      if (dp) pivots.add(dp);
    }
    const ownComp = tagValue(hyp, 'component');
    const matches = [];
    for (const candidate of primitivesAndFacts) {
      if (candidate.id === hyp.id) continue;
      if (connectedPairs.has(`${candidate.id}->${hyp.id}`)) continue;
      const cPivot = tagValue(candidate, 'pivot');
      const cComp = tagValue(candidate, 'component');
      const pivotMatch = cPivot && pivots.has(cPivot);
      const compMatch = !pivots.size && ownComp && cComp && ownComp === cComp && hasTag(candidate, 'role=primitive');
      if (pivotMatch || compMatch) {
        matches.push({
          nodeId: candidate.id,
          title: candidate.title,
          via: pivotMatch ? `pivot=${cPivot}` : `component=${cComp}`,
        });
      }
    }
    if (matches.length) {
      awakenedChains.push({
        hypothesis: compactGapNode(hyp),
        matches,
      });
    }
  }

  const unresolvedAnomalies = [];
  for (const node of nodes) {
    if (!hasTag(node, 'role=anomaly') && node.type !== 'anomaly') continue;
    if (['done', 'dead', 'refuted', 'superseded', 'confirmed'].includes(node.status)) continue;
    const linked = [...(incoming.get(node.id) || []), ...(outgoing.get(node.id) || [])]
      .some((e) => ANOMALY_EDGES.has(e.kind));
    if (!linked) unresolvedAnomalies.push(compactGapNode(node));
  }

  const humanSignals = nodes
    .filter((node) => node.author === 'human' || node.updatedBy === 'human')
    .sort((a, b) => (b.updated || b.ts || 0) - (a.updated || a.ts || 0))
    .map((node) => compactGapNode(node));

  return { openThreads, unbackedVerdicts, awakenedChains, unresolvedAnomalies, humanSignals };
}

function checkDiskDrift(cwd, target, ledger, slices) {
  const untrackedFiles = [];
  let diskStaleIds = [];
  const scanRoot = target ? path.resolve(target) : cwd;
  if (!fsSafeExists(scanRoot)) return { untrackedFiles, diskStaleIds };

  const scanned = scanTargetTree(scanRoot, {
    scope: ledger.scope || '',
    maxSliceLines: ledger.maxSliceLines || DEFAULT_MAX_SLICE_LINES,
    includeAux: Boolean(ledger.includeAux),
  });
  const scannedByPath = new Map();
  for (const item of scanned.slices) {
    const list = scannedByPath.get(item.path) || [];
    list.push(item);
    scannedByPath.set(item.path, list);
  }
  const recordedByPath = new Map();
  for (const s of slices) {
    if (s.kind === 'probe') continue;
    const list = recordedByPath.get(s.path) || [];
    list.push(s);
    recordedByPath.set(s.path, list);
  }
  for (const file of scanned.files) {
    if (!recordedByPath.has(file)) untrackedFiles.push(file);
  }
  for (const [file, recSlices] of recordedByPath.entries()) {
    const diskSlices = scannedByPath.get(file);
    if (!diskSlices) {
      for (const rec of recSlices) {
        if (rec.status !== 'excluded') diskStaleIds.push(rec.id);
      }
      continue;
    }
    for (const rec of recSlices) {
      if (rec.status === 'excluded') continue;
      const exact = diskSlices.find((d) => d.key === rec.key && d.hash === rec.hash);
      if (!exact) diskStaleIds.push(rec.id);
    }
  }
  diskStaleIds = [...new Set(diskStaleIds)];
  return { untrackedFiles, diskStaleIds };
}

function sanitizeSlicePaths(rawSlices, cwd, { maskExternal = true } = {}) {
  return rawSlices.map((slice) => {
    const rawPath = slice?.path;
    if (typeof rawPath !== 'string' || !isAbsoluteHostPath(rawPath)) return slice;
    const inProject = relativizeProjectPath(rawPath, cwd);
    if (inProject === null && !maskExternal) return slice;
    const cleanPath = inProject !== null ? inProject : sanitizeSharedPath(rawPath, cwd);
    const derivedRawSector = sectorOfPath(rawPath.replace(/\\/g, '/'));
    const shouldSanitizeSector = slice.sector === derivedRawSector || isAbsoluteHostPath(slice.sector);
    const cleanSector = shouldSanitizeSector
      ? (cleanPath.startsWith('<external>') ? '<external>' : sectorOfPath(cleanPath))
      : slice.sector;
    return { ...slice, path: cleanPath, sector: cleanSector };
  });
}

function sanitizeGapEntryLoc(entry, cwd) {
  if (!entry || !entry.loc) return entry;
  const cleanLoc = sanitizeSharedLoc(entry.loc, cwd);
  return cleanLoc === entry.loc ? entry : { ...entry, loc: cleanLoc };
}

function sanitizeGapReportPaths(gaps, cwd) {
  return {
    ...gaps,
    openThreads: gaps.openThreads.map((entry) => sanitizeGapEntryLoc(entry, cwd)),
    unbackedVerdicts: gaps.unbackedVerdicts.map((entry) => sanitizeGapEntryLoc(entry, cwd)),
    awakenedChains: gaps.awakenedChains.map((chain) => ({
      ...chain,
      hypothesis: sanitizeGapEntryLoc(chain.hypothesis, cwd),
    })),
    unresolvedAnomalies: gaps.unresolvedAnomalies.map((entry) => sanitizeGapEntryLoc(entry, cwd)),
    humanSignals: gaps.humanSignals.map((entry) => sanitizeGapEntryLoc(entry, cwd)),
  };
}

/**
 * @typedef {{ target?: string | null, checkDisk?: boolean, compact?: boolean, includeLocalPaths?: boolean, source?: Record<string, any> }} UltraSnapshotOptions
 * @typedef {{ id: string, kind: string, tier: string, title: string | null, key: string, path: string, sector: string, startLine: number, endLine: number, lines: number, hash: string | null, reviewedHash?: string | null, status: string, effectiveStatus: string, shallowReason: string | null, note?: string, refs: string[], dependsOn: string[], humanFollowups: string[], unverifiedDependencies?: string[], dependencyCycle?: string[] }} UltraSliceEntry
 * @typedef {{ sector: string, totalSlices: number, totalLines: number, pending: number, stale: number, shallow: number, cleared: number, flagged: number, excluded: number, probes: number, findings: number, openThreads: number, sliceIds?: string[] }} UltraSectorSummary
 * @typedef {{ totalSlices: number, totalLines: number, pending: number, stale: number, shallow: number, cleared: number, flagged: number, excluded: number, probes: number, pendingProbes: number, coveredSlices: number, sectors: number, openThreads: number, unbackedVerdicts: number, awakenedChains: number, unresolvedAnomalies: number, humanSignals: number, untrackedFiles: number, diskStale: number, remainingSlices: number, dependencyCycles: number, coverageRatio: number }} UltraSnapshotSummary
 * @typedef {{ cycle: string[], sliceIds: string[], resolved: boolean, breakHint: string }} UltraDependencyCycle
 * @typedef {{ openThreads: Record<string, any>[], unbackedVerdicts: Record<string, any>[], awakenedChains: Array<{ hypothesis: Record<string, any>, matches: Array<{ nodeId: string, title: string, via: string }> }>, unresolvedAnomalies: Record<string, any>[], humanSignals: Record<string, any>[], untrackedFiles: string[], diskStaleIds: string[], shallowSlices: Array<{ id: string, path: string, startLine: number, endLine: number, reason: string | null, unverifiedDependencies: string[], humanFollowups: string[], dependencyCycle?: string[] }>, staleSlices: Array<{ id: string, path: string, startLine: number, endLine: number }>, dependencyCycles: UltraDependencyCycle[] }} UltraGapReport
 * @typedef {{ schema: string, readOnly: boolean, prescriptive: boolean, initialized: boolean, scope: string | null, maxSliceLines: number, includeAux: boolean, syncCount: number, updatedAt: number | null, integrity: Record<string, any>, summary: UltraSnapshotSummary, slices?: UltraSliceEntry[], sectors: UltraSectorSummary[], gaps: UltraGapReport, breadthComplete: boolean, commitmentComplete: boolean, allClear: boolean, slicesOmitted?: boolean }} UltraSnapshot
 */

/**
 * Pure read-only snapshot combining .pinwhy/ultra/ledger.jsonl and .pinwhy/events.jsonl.
 * Never writes to either log. Shared projections mask host-external paths by default;
 * `includeLocalPaths: true` is reserved for local CLI scheduling so `next` locations
 * round-trip back into `done`, and must not be used for shared exports.
 * @param {string} [cwd]
 * @param {UltraSnapshotOptions} [options]
 * @returns {UltraSnapshot}
 */
export function buildUltraSnapshot(cwd = process.cwd(), { target = null, checkDisk = false, compact = false, includeLocalPaths = false, source = undefined } = {}) {
  const boardPresent = isInitialized(cwd);
  const untilTs = typeof source?.asOf?.at === 'number' && Number.isFinite(source.asOf.at) ? source.asOf.at : null;
  const ledger = readUltraLedger(cwd, { untilTs });
  const graph = source || boardPresent ? replay(cwd, source) : { nodes: {}, edges: {}, cursors: {}, checkpoints: {} };
  const rawSlices = computeEffectiveSlices(ledger, graph);
  const rawGaps = computeCognitiveGaps(graph);

  const { untrackedFiles, diskStaleIds } = checkDisk && ledger.initialized
    ? checkDiskDrift(cwd, target, ledger, rawSlices)
    : { untrackedFiles: [], diskStaleIds: [] };

  const slices = sanitizeSlicePaths(rawSlices, cwd, { maskExternal: !includeLocalPaths });
  const gaps = includeLocalPaths ? rawGaps : sanitizeGapReportPaths(rawGaps, cwd);
  const scope = !includeLocalPaths && typeof ledger.scope === 'string' && isAbsoluteHostPath(ledger.scope)
    ? sanitizeSharedPath(ledger.scope, cwd)
    : ledger.scope;
  const sectors = summarizeSectors(slices, graph);
  const dependencyCycles = collectDependencyCycles(slices);

  const pending = slices.filter((s) => s.effectiveStatus === 'pending').length;
  const stale = slices.filter((s) => s.effectiveStatus === 'stale').length;
  const shallow = slices.filter((s) => s.effectiveStatus === 'shallow').length;
  const coveredSlices = slices.filter((s) => ['cleared', 'flagged', 'excluded'].includes(s.effectiveStatus)).length;

  /** @type {UltraSnapshotSummary} */
  const summary = {
    totalSlices: slices.length,
    totalLines: slices.reduce((acc, s) => acc + (s.lines || 0), 0),
    pending,
    stale,
    shallow,
    cleared: slices.filter((s) => s.effectiveStatus === 'cleared').length,
    flagged: slices.filter((s) => s.effectiveStatus === 'flagged').length,
    excluded: slices.filter((s) => s.effectiveStatus === 'excluded').length,
    probes: slices.filter((s) => s.kind === 'probe').length,
    pendingProbes: slices.filter((s) => s.kind === 'probe' && ['pending', 'stale', 'shallow'].includes(s.effectiveStatus)).length,
    coveredSlices,
    sectors: sectors.length,
    openThreads: gaps.openThreads.length,
    unbackedVerdicts: gaps.unbackedVerdicts.length,
    awakenedChains: gaps.awakenedChains.length,
    unresolvedAnomalies: gaps.unresolvedAnomalies.length,
    humanSignals: gaps.humanSignals.length,
    untrackedFiles: untrackedFiles.length,
    diskStale: diskStaleIds.length,
    remainingSlices: pending + stale + shallow,
    dependencyCycles: dependencyCycles.length,
    coverageRatio: slices.length > 0 ? Number((coveredSlices / slices.length).toFixed(4)) : 0,
  };

  const breadthComplete = Boolean(
    ledger.initialized &&
    summary.totalSlices > 0 &&
    summary.remainingSlices === 0 &&
    untrackedFiles.length === 0 &&
    diskStaleIds.length === 0,
  );
  const commitmentComplete = Boolean(
    breadthComplete &&
    gaps.unbackedVerdicts.length === 0,
  );
  const allClear = Boolean(
    commitmentComplete &&
    gaps.openThreads.length === 0 &&
    gaps.awakenedChains.length === 0 &&
    gaps.unresolvedAnomalies.length === 0,
  );

  const snapshot = {
    schema: 'pinwhy.ultra.v1',
    readOnly: true,
    prescriptive: false,
    initialized: ledger.initialized,
    scope,
    maxSliceLines: ledger.maxSliceLines,
    includeAux: Boolean(ledger.includeAux),
    syncCount: ledger.syncCount,
    updatedAt: ledger.updatedAt,
    integrity: ledger.integrity,
    summary,
    slices,
    sectors,
    gaps: {
      ...gaps,
      untrackedFiles,
      diskStaleIds,
      shallowSlices: slices
        .filter((s) => s.effectiveStatus === 'shallow')
        .map((s) => ({
          id: s.id,
          path: s.path,
          startLine: s.startLine,
          endLine: s.endLine,
          reason: s.shallowReason,
          unverifiedDependencies: s.unverifiedDependencies || [],
          humanFollowups: s.humanFollowups || [],
          ...(s.dependencyCycle ? { dependencyCycle: s.dependencyCycle } : {}),
        })),
      staleSlices: slices
        .filter((s) => s.effectiveStatus === 'stale')
        .map((s) => ({ id: s.id, path: s.path, startLine: s.startLine, endLine: s.endLine })),
      dependencyCycles,
    },
    breadthComplete,
    commitmentComplete,
    allClear,
  };
  if (compact) {
    const { slices: _omit, ...rest } = snapshot;
    return {
      ...rest,
      sectors: sectors.map(({ sliceIds: _sliceIds, ...sec }) => sec),
      slicesOmitted: true,
    };
  }
  return snapshot;
}
