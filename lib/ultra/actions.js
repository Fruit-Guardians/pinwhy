// Locked write operations mutating .pinwhy/ultra/ledger.jsonl.
import path from 'node:path';
import { resolveRef } from '../domain/model.js';
import { relativizeProjectPath } from '../exports/shared-paths.js';
import { replay } from '../storage/event-log.js';
import { buildUltraSnapshot } from './gaps.js';
import { invalidValue } from './helpers.js';
import { appendUltraRecord, readUltraLedger, withUltraLock } from './ledger.js';
import { DEFAULT_MAX_SLICE_LINES, scanTargetTree, sectorOfPath } from './scanner.js';
import { parseProbeLocation, resolveSliceIds } from './slices.js';

/** Sync target workspace slices into .pinwhy/ultra/ledger.jsonl under lock. */
export function syncUltra(cwd = process.cwd(), { target = null, scope = '', maxSliceLines = DEFAULT_MAX_SLICE_LINES, includeAux = false, compact = false, agent = 'agent:primary' } = {}) {
  const scanRoot = path.resolve(target || cwd);
  return withUltraLock(() => {
    const before = readUltraLedger(cwd);
    const beforeKeys = new Map(Object.values(before.slices).filter((s) => s.kind !== 'probe').map((s) => [s.key, s]));
    const scanned = scanTargetTree(scanRoot, { scope, maxSliceLines, includeAux: Boolean(includeAux) });
    const at = Date.now();
    appendUltraRecord({
      op: 'sync',
      at,
      agent,
      scope: scanned.scope,
      maxSliceLines: scanned.maxSliceLines,
      includeAux: scanned.includeAux,
      slices: scanned.slices,
    }, cwd);
    const after = readUltraLedger(cwd);
    const afterSlices = Object.values(after.slices).filter((s) => s.kind !== 'probe');

    let added = 0;
    let unchanged = 0;
    let stale = 0;
    for (const s of afterSlices) {
      const prev = beforeKeys.get(s.key);
      if (!prev) {
        if (s.status === 'stale') stale += 1;
        else added += 1;
      } else if (prev.hash === s.hash) {
        unchanged += 1;
      } else {
        stale += 1;
      }
    }
    const afterIds = new Set(afterSlices.map((s) => s.id));
    const removed = Object.values(before.slices).filter((s) => s.kind !== 'probe' && !afterIds.has(s.id)).length;
    const snapshot = buildUltraSnapshot(cwd, { compact: Boolean(compact) });

    return {
      schema: 'pinwhy.ultra-sync.v1',
      scope: scanned.scope,
      maxSliceLines: scanned.maxSliceLines,
      includeAux: scanned.includeAux,
      stats: {
        filesScanned: scanned.filesScanned,
        skippedBinary: scanned.skippedBinary,
        skippedLarge: scanned.skippedLarge,
        skippedAux: scanned.skippedAux,
        added,
        unchanged,
        stale,
        removed,
        totalActive: afterSlices.length,
      },
      snapshot,
    };
  }, cwd);
}

/** Add dynamic check/test probes for Swarm enumeration and mid-audit fission. */
export function addUltraProbes(cwd = process.cwd(), { titles = [], sector = '', at = '', dependsOn = [], agent = 'agent:primary' } = {}) {
  const cleanTitles = [].concat(titles || []).map((t) => String(t ?? '').trim()).filter(Boolean);
  if (!cleanTitles.length) throw invalidValue('At least one probe title is required');
  const parsedAt = parseProbeLocation(at);
  if (parsedAt?.path) {
    const relPath = relativizeProjectPath(parsedAt.path, cwd);
    if (relPath !== null) parsedAt.path = relPath;
  }
  const cleanSector = String(sector || '').trim();
  const resolvedSector = cleanSector || (parsedAt?.path ? sectorOfPath(parsedAt.path) : 'general');
  const depTokens = [].concat(dependsOn || []).map((d) => String(d ?? '').trim()).filter(Boolean);

  return withUltraLock(() => {
    const ledger = readUltraLedger(cwd);
    const beforeIds = new Set(Object.keys(ledger.slices || {}));
    const resolvedDeps = depTokens.length ? resolveSliceIds(ledger, depTokens, { cwd }) : [];
    const probes = cleanTitles.map((title) => ({
      title,
      sector: resolvedSector,
      ...(parsedAt?.path ? { path: parsedAt.path, startLine: parsedAt.startLine, endLine: parsedAt.endLine } : {}),
      ...(resolvedDeps.length ? { dependsOn: resolvedDeps } : {}),
    }));
    appendUltraRecord({
      op: 'probe',
      at: Date.now(),
      agent,
      probes,
    }, cwd);
    const nextSnapshot = buildUltraSnapshot(cwd);
    const added = (nextSnapshot.slices || []).filter((s) => s.kind === 'probe' && !beforeIds.has(s.id));
    return {
      schema: 'pinwhy.ultra-add.v1',
      added,
      summary: nextSnapshot.summary,
    };
  }, cwd);
}

/** Mark one or more slices or probes reviewed after careful inspection/testing. */
export function markUltraDone(cwd = process.cwd(), { sliceIds = [], note = '', refs = [], dependsOn = [], status = null, allowSector = false, agent = 'agent:primary' } = {}) {
  const inputs = [].concat(sliceIds || []).filter(Boolean);
  if (!inputs.length) throw invalidValue('At least one slice ID is required');
  if (status && !['cleared', 'flagged', 'excluded'].includes(status)) {
    throw invalidValue(`Invalid slice review status: ${status}; expected cleared, flagged, or excluded`);
  }

  return withUltraLock(() => {
    const ledger = readUltraLedger(cwd);
    const resolvedIds = resolveSliceIds(ledger, inputs, { allowSector, cwd });
    const graph = replay(cwd);
    const resolvedRefs = [];
    for (const ref of [].concat(refs || []).filter(Boolean)) {
      resolvedRefs.push(resolveRef(graph.nodes || {}, ref, 'node'));
    }

    const rawDeps = [].concat(dependsOn || []).filter(Boolean).map((d) => String(d).trim()).filter(Boolean);
    const clearDeps = rawDeps.some((d) => d === 'none' || d === '-');
    const depTokens = rawDeps.filter((d) => d !== 'none' && d !== '-');
    const resolvedDeps = depTokens.length ? resolveSliceIds(ledger, depTokens, { cwd }) : null;

    const at = Date.now();
    const reviewedHashes = {};
    for (const id of resolvedIds) reviewedHashes[id] = ledger.slices[id].hash;

    const trimmedNote = typeof note === 'string' ? note.trim() : '';

    // Merge refs / dependsOn per slice so follow-up marks never silently erase prior links.
    const updated = [];
    for (const id of resolvedIds) {
      const prev = ledger.slices[id];
      const mergedRefs = [...new Set([...(prev.refs || []), ...resolvedRefs])];
      const baseDeps = clearDeps ? [] : (prev.dependsOn || []);
      const mergedDeps = resolvedDeps
        ? [...new Set([...baseDeps, ...resolvedDeps.filter((d) => d !== id)])]
        : [...baseDeps];
      const finalStatus = status || (mergedRefs.length > 0 ? 'flagged' : 'cleared');
      const finalNote = trimmedNote || prev.note || '';
      appendUltraRecord({
        op: 'review',
        at,
        agent,
        sliceIds: [id],
        status: finalStatus,
        note: finalNote,
        refs: mergedRefs,
        dependsOn: mergedDeps,
        reviewedHashes: { [id]: reviewedHashes[id] },
      }, cwd);
    }

    const nextSnapshot = buildUltraSnapshot(cwd);
    for (const id of resolvedIds) {
      const s = (nextSnapshot.slices || []).find((item) => item.id === id);
      if (s) updated.push(s);
    }
    return {
      schema: 'pinwhy.ultra-done.v1',
      updated,
      summary: nextSnapshot.summary,
    };
  }, cwd);
}

/** Explicitly exclude out-of-scope slices, files, or sectors with a documented rationale. */
export function excludeUltraSlices(cwd = process.cwd(), { sliceIds = [], note = '', agent = 'agent:primary' } = {}) {
  const res = markUltraDone(cwd, {
    sliceIds,
    note,
    status: 'excluded',
    allowSector: true,
    agent,
  });
  return {
    schema: 'pinwhy.ultra-exclude.v1',
    excluded: res.updated,
    summary: res.summary,
  };
}

/** Reopen reviewed slices back to pending for fresh inspection. */
export function reopenUltraSlices(cwd = process.cwd(), { sliceIds = [], reason = '', agent = 'agent:primary' } = {}) {
  const inputs = [].concat(sliceIds || []).filter(Boolean);
  if (!inputs.length) throw invalidValue('At least one slice ID is required');
  return withUltraLock(() => {
    const ledger = readUltraLedger(cwd);
    const resolvedIds = resolveSliceIds(ledger, inputs, { cwd });
    appendUltraRecord({
      op: 'reopen',
      at: Date.now(),
      agent,
      sliceIds: resolvedIds,
      reason: String(reason || '').trim(),
    }, cwd);
    const nextSnapshot = buildUltraSnapshot(cwd);
    return {
      schema: 'pinwhy.ultra-reopen.v1',
      reopened: resolvedIds.map((id) => (nextSnapshot.slices || []).find((s) => s.id === id)).filter(Boolean),
      summary: nextSnapshot.summary,
    };
  }, cwd);
}

/** Reset the Ultra coverage ledger without affecting the main reasoning board. */
export function resetUltra(cwd = process.cwd(), { agent = 'agent:primary' } = {}) {
  return withUltraLock(() => {
    appendUltraRecord({ op: 'reset', at: Date.now(), agent }, cwd);
    return { schema: 'pinwhy.ultra-reset.v1', reset: true };
  }, cwd);
}
