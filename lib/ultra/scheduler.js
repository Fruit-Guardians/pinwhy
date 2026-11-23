// Deterministic sector-coherent quota batching for single or Swarm Ultra workers.
import { buildUltraSnapshot } from './gaps.js';
import { invalidValue } from './helpers.js';

function nextBatchPriority(slice, dependentsMap) {
  if (slice.shallowReason === 'human-followup') return 0;
  if (slice.effectiveStatus === 'stale') return 1;
  if ((dependentsMap.get(slice.id)?.length || 0) > 0) return 2;
  if (slice.effectiveStatus === 'shallow') return 3;
  return 4;
}

/** Pure read-only deterministic batching of remaining slices for single or parallel Agents. */
export function nextUltraBatches(cwd = process.cwd(), { budgetLines = 420, maxSlices = 4, workers = 1, sector = null } = {}) {
  const budget = Number(budgetLines);
  const sliceLimit = Number(maxSlices);
  const workerCount = Number(workers);
  if (!Number.isSafeInteger(budget) || budget < 20 || budget > 10000) throw invalidValue('budgetLines must be between 20 and 10000');
  if (!Number.isSafeInteger(sliceLimit) || sliceLimit < 1 || sliceLimit > 50) throw invalidValue('maxSlices must be between 1 and 50');
  if (!Number.isSafeInteger(workerCount) || workerCount < 1 || workerCount > 32) throw invalidValue('workers must be between 1 and 32');

  const snapshot = buildUltraSnapshot(cwd, { includeLocalPaths: true });
  const slices = snapshot.slices || [];
  const activeIds = new Set(slices.map((s) => s.id));
  const dependentsMap = new Map();
  for (const s of slices) {
    if (s.effectiveStatus === 'cleared' || s.effectiveStatus === 'flagged') continue;
    for (const depId of s.dependsOn || []) {
      const list = dependentsMap.get(depId) || [];
      list.push(s.id);
      dependentsMap.set(depId, list);
    }
  }

  const allRemaining = slices
    .filter((s) => ['stale', 'shallow', 'pending'].includes(s.effectiveStatus))
    .filter((s) => !sector || s.sector === sector);
  const nonBlocked = allRemaining.filter((s) => {
    if (s.effectiveStatus === 'shallow' && s.shallowReason === 'unverified-dependency') {
      const activeDeps = (s.unverifiedDependencies || []).filter((depId) => activeIds.has(depId));
      return activeDeps.length === 0;
    }
    return true;
  });
  const remaining = (nonBlocked.length > 0 ? nonBlocked : allRemaining).sort((a, b) =>
    nextBatchPriority(a, dependentsMap) - nextBatchPriority(b, dependentsMap) ||
    a.sector.localeCompare(b.sector) ||
    (a.kind === 'probe' ? 0 : 1) - (b.kind === 'probe' ? 0 : 1) ||
    a.path.localeCompare(b.path) ||
    a.startLine - b.startLine ||
    a.id.localeCompare(b.id),
  );

  // Build sector-coherent quota chunks first.
  const chunks = [];
  let current = null;
  for (const slice of remaining) {
    const sliceLines = slice.lines || 0;
    const fitsSector = current && current.sector === slice.sector;
    const fitsBudget = current && (current.totalLines + sliceLines <= budget) && (current.slices.length < sliceLimit);
    if (!current || !fitsSector || !fitsBudget) {
      if (current) chunks.push(current);
      current = { sector: slice.sector, totalLines: 0, slices: [] };
    }
    current.slices.push({
      id: slice.id,
      kind: slice.kind || 'slice',
      title: slice.title || null,
      path: slice.path,
      sector: slice.sector,
      startLine: slice.startLine,
      endLine: slice.endLine,
      lines: sliceLines,
      status: slice.effectiveStatus,
      shallowReason: slice.shallowReason,
      humanFollowups: slice.humanFollowups || [],
      blockingFor: dependentsMap.get(slice.id) || [],
      hash: slice.hash,
      previousNote: slice.note || null,
      refs: slice.refs || [],
    });
    current.totalLines += sliceLines;
  }
  if (current) chunks.push(current);

  // For multiple workers, prefer assigning distinct sectors across workers first to avoid collisions.
  const selected = [];
  const usedChunkIndices = new Set();
  const usedSectors = new Set();
  for (let i = 0; i < chunks.length && selected.length < workerCount; i++) {
    if (!usedSectors.has(chunks[i].sector)) {
      usedSectors.add(chunks[i].sector);
      usedChunkIndices.add(i);
      selected.push(chunks[i]);
    }
  }
  for (let i = 0; i < chunks.length && selected.length < workerCount; i++) {
    if (!usedChunkIndices.has(i)) {
      usedChunkIndices.add(i);
      selected.push(chunks[i]);
    }
  }

  const batches = selected.map((chunk, idx) => ({
    workerIndex: idx + 1,
    sector: chunk.sector,
    totalLines: chunk.totalLines,
    slices: chunk.slices,
  }));

  return {
    schema: 'pinwhy.ultra-next.v1',
    readOnly: true,
    prescriptive: false,
    initialized: snapshot.initialized,
    remainingSlices: allRemaining.length,
    actionableSlices: remaining.length,
    batches,
  };
}
