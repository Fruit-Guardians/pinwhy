// Slice effective-state evaluation, sector aggregation, and target resolution.
import { resolveRef } from '../domain/model.js';
import { isOpenThread } from '../domain/semantics.js';
import { relativizeProjectPath } from '../exports/shared-paths.js';
import { invalidValue, parseLoc, tagValues } from './helpers.js';
import { sectorOfPath } from './scanner.js';

const CLOSED_CHALLENGE_STATUSES = new Set(['done', 'dead', 'refuted', 'superseded', 'confirmed']);
const MIN_NOTE_CHARS = 6;

export function computeEffectiveSlices(ledger, graph) {
  const rawSlices = Object.values(ledger.slices || {});
  const byId = new Map();
  const slicesByPath = new Map();
  for (const slice of rawSlices) {
    const validRefs = (slice.refs || []).filter((id) => Boolean(graph.nodes?.[id]));
    const entry = {
      ...slice,
      kind: slice.kind || 'slice',
      tier: slice.tier || 'core',
      title: slice.title || null,
      refs: validRefs,
      dependsOn: [...(slice.dependsOn || [])],
      humanFollowups: [],
      effectiveStatus: slice.status,
      shallowReason: null,
    };
    byId.set(slice.id, entry);
    const list = slicesByPath.get(slice.path) || [];
    list.push(entry);
    slicesByPath.set(slice.path, list);
  }

  // Index open human challenges targeting specific slices so mid-audit expert
  // questions immediately surface as actionable follow-ups on cleared/blank slices.
  for (const node of Object.values(graph.nodes || {})) {
    const isHuman = node.author === 'human' || node.updatedBy === 'human';
    if (!isHuman) continue;
    if (CLOSED_CHALLENGE_STATUSES.has(node.status || '')) continue;
    const isChallenge = isOpenThread(node) || (
      ['hint', 'observation', 'note'].includes(node.type) &&
      ['open', 'active'].includes(node.status || '')
    );
    if (!isChallenge) continue;

    const targetIds = new Set();
    for (const sid of tagValues(node, 'slice')) {
      if (byId.has(sid)) targetIds.add(sid);
    }
    if (targetIds.size === 0) {
      const loc = parseLoc(node.loc);
      if (loc?.path) {
        const candidates = slicesByPath.get(loc.path) || [];
        const hits = loc.line !== null
          ? candidates.filter((s) => loc.line >= s.startLine && loc.line <= s.endLine)
          : (candidates.length === 1 ? candidates : []);
        const matched = hits.length ? hits : (candidates.length === 1 ? candidates : []);
        for (const s of matched) targetIds.add(s.id);
      }
    }
    const nodeTs = Number(node.updated || node.ts || 0);
    for (const sid of targetIds) {
      const slice = byId.get(sid);
      if (!slice) continue;
      if (slice.refs.includes(node.id)) continue;
      if (nodeTs >= Number(slice.updatedAt || 0)) {
        slice.humanFollowups.push(node.id);
      }
    }
  }

  // First pass: stale-hash, human-followup, and note-length checks.
  for (const slice of byId.values()) {
    if (slice.status !== 'cleared' && slice.status !== 'flagged' && slice.status !== 'excluded') continue;
    if (slice.kind !== 'probe' && slice.status !== 'excluded' && slice.reviewedHash && slice.reviewedHash !== slice.hash) {
      slice.effectiveStatus = 'stale';
      continue;
    }
    if (slice.humanFollowups.length > 0) {
      slice.effectiveStatus = 'shallow';
      slice.shallowReason = 'human-followup';
      continue;
    }
    const noteLen = [...String(slice.note || '').trim()].length;
    if (noteLen < MIN_NOTE_CHARS && slice.refs.length === 0 && slice.dependsOn.length === 0) {
      slice.effectiveStatus = 'shallow';
      slice.shallowReason = 'insufficient-note';
    }
  }

  // Fixed-point propagation via reverse-dependency BFS queue: claiming a slice is protected by
  // another unreviewed/shallow/deleted/stale slice bounces dependent slices back to shallow.
  const isVerified = (s) => Boolean(s && (s.effectiveStatus === 'cleared' || s.effectiveStatus === 'flagged'));
  const dependentsById = new Map();
  for (const slice of byId.values()) {
    for (const depId of slice.dependsOn) {
      const list = dependentsById.get(depId);
      if (list) list.push(slice.id);
      else dependentsById.set(depId, [slice.id]);
    }
  }

  const queue = [];
  for (const slice of byId.values()) {
    if (!isVerified(slice)) continue;
    if (slice.dependsOn.some((depId) => !isVerified(byId.get(depId)))) {
      slice.effectiveStatus = 'shallow';
      slice.shallowReason = 'unverified-dependency';
      queue.push(slice.id);
    }
  }

  for (let head = 0; head < queue.length; head += 1) {
    const bouncedId = queue[head];
    for (const dependentId of dependentsById.get(bouncedId) || []) {
      const depSlice = byId.get(dependentId);
      if (!isVerified(depSlice)) continue;
      depSlice.effectiveStatus = 'shallow';
      depSlice.shallowReason = 'unverified-dependency';
      queue.push(dependentId);
    }
  }

  for (const slice of byId.values()) {
    if (slice.shallowReason !== 'unverified-dependency') continue;
    slice.unverifiedDependencies = slice.dependsOn.filter((depId) => !isVerified(byId.get(depId)));
  }

  detectDependencyCycles(byId);

  return [...byId.values()].sort((a, b) =>
    a.sector.localeCompare(b.sector) ||
    a.path.localeCompare(b.path) ||
    a.startLine - b.startLine ||
    a.id.localeCompare(b.id)
  );
}

function shortestCycleFrom(startId, sccSet, forwardDeps) {
  const parent = new Map();
  const visited = new Set();
  const queue = [];
  for (const nextId of forwardDeps.get(startId) || []) {
    if (!sccSet.has(nextId)) continue;
    if (!visited.has(nextId)) {
      visited.add(nextId);
      parent.set(nextId, startId);
      queue.push(nextId);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const nextId of forwardDeps.get(current) || []) {
      if (!sccSet.has(nextId)) continue;
      if (nextId === startId) {
        const cycle = [];
        let cursor = current;
        while (cursor !== undefined) {
          cycle.push(cursor);
          if (cursor === startId) break;
          cursor = parent.get(cursor);
        }
        cycle.reverse();
        cycle.push(startId);
        return cycle;
      }
      if (!visited.has(nextId)) {
        visited.add(nextId);
        parent.set(nextId, current);
        queue.push(nextId);
      }
    }
  }
  return null;
}

/** Iterative Kosaraju SCC search so arbitrary dependency depth cannot overflow the call stack. */
function detectDependencyCycles(byId) {
  const sortedIds = [...byId.keys()].sort();
  const forwardDeps = new Map();
  const reverseDeps = new Map(sortedIds.map((id) => [id, []]));
  for (const id of sortedIds) {
    const deps = [...new Set((byId.get(id).dependsOn || []).filter((d) => d !== id && byId.has(d)))].sort();
    forwardDeps.set(id, deps);
    for (const depId of deps) {
      reverseDeps.get(depId).push(id);
    }
  }
  for (const list of reverseDeps.values()) list.sort();

  const visited = new Set();
  const finishOrder = [];
  for (const root of sortedIds) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ id: root, nextIdx: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = forwardDeps.get(frame.id) || [];
      if (frame.nextIdx < neighbors.length) {
        const nextId = neighbors[frame.nextIdx];
        frame.nextIdx += 1;
        if (!visited.has(nextId)) {
          visited.add(nextId);
          stack.push({ id: nextId, nextIdx: 0 });
        }
      } else {
        stack.pop();
        finishOrder.push(frame.id);
      }
    }
  }

  const assigned = new Set();
  for (let i = finishOrder.length - 1; i >= 0; i -= 1) {
    const root = finishOrder[i];
    if (assigned.has(root)) continue;
    assigned.add(root);
    const component = [];
    const stack = [root];
    while (stack.length > 0) {
      const id = stack.pop();
      component.push(id);
      for (const prevId of reverseDeps.get(id) || []) {
        if (!assigned.has(prevId)) {
          assigned.add(prevId);
          stack.push(prevId);
        }
      }
    }
    if (component.length < 2) continue;
    component.sort();
    const sccSet = new Set(component);
    for (const id of component) {
      const cycle = shortestCycleFrom(id, sccSet, forwardDeps);
      if (cycle) byId.get(id).dependencyCycle = cycle;
    }
  }
}

export function formatBreakCycleCommand(slice, cycleMemberIds = []) {
  const cycleSet = new Set(cycleMemberIds);
  const keepDeps = (slice.dependsOn || []).filter((d) => !cycleSet.has(d));
  const depArg = keepDeps.length > 0 ? `none,${keepDeps.join(',')}` : 'none';
  return `pinwhy-ultra done ${slice.id} --depends-on ${depArg} --note "<independent verification>"`;
}

export function collectDependencyCycles(slices) {
  const byId = new Map(slices.map((s) => [s.id, s]));
  const seen = new Set();
  const cycles = [];
  for (const slice of slices) {
    const cycle = slice.dependencyCycle;
    if (!Array.isArray(cycle) || cycle.length < 3) continue;
    const ring = cycle.slice(0, -1);
    let minIdx = 0;
    for (let i = 1; i < ring.length; i += 1) {
      if (ring[i] < ring[minIdx]) minIdx = i;
    }
    const rotated = [...ring.slice(minIdx), ...ring.slice(0, minIdx)];
    const canonCycle = [...rotated, rotated[0]];
    const key = canonCycle.join('->');
    if (seen.has(key)) continue;
    seen.add(key);

    const sliceIds = rotated;
    const resolved = sliceIds.every((id) => ['cleared', 'flagged'].includes(byId.get(id)?.effectiveStatus));
    let targetSlice = byId.get(sliceIds[0]);
    for (const id of sliceIds.slice(1)) {
      const cand = byId.get(id);
      if (!cand) continue;
      const candTs = Number(cand.updatedAt || 0);
      const targetTs = Number(targetSlice?.updatedAt || 0);
      if (candTs > targetTs || (candTs === targetTs && cand.id > targetSlice.id)) {
        targetSlice = cand;
      }
    }
    cycles.push({
      cycle: canonCycle,
      sliceIds,
      resolved,
      breakHint: targetSlice ? formatBreakCycleCommand(targetSlice, sliceIds) : '',
    });
  }
  return cycles.sort((a, b) => a.cycle.join('->').localeCompare(b.cycle.join('->')));
}

export function summarizeSectors(slices, graph) {
  const bySector = new Map();
  const ensureSector = (name) => {
    if (!bySector.has(name)) {
      bySector.set(name, {
        sector: name,
        totalSlices: 0,
        totalLines: 0,
        pending: 0,
        stale: 0,
        shallow: 0,
        cleared: 0,
        flagged: 0,
        excluded: 0,
        probes: 0,
        findings: 0,
        openThreads: 0,
        sliceIds: [],
      });
    }
    return bySector.get(name);
  };

  for (const slice of slices) {
    const sec = ensureSector(slice.sector);
    sec.totalSlices += 1;
    sec.totalLines += slice.lines || 0;
    sec[slice.effectiveStatus] = (sec[slice.effectiveStatus] || 0) + 1;
    if (slice.kind === 'probe') sec.probes += 1;
    sec.sliceIds.push(slice.id);
    for (const refId of slice.refs || []) {
      const node = graph.nodes?.[refId];
      if (!node) continue;
      if (['finding', 'vuln'].includes(node.type) && !['refuted', 'superseded', 'dead'].includes(node.status)) {
        sec.findings += 1;
      }
      if (isOpenThread(node)) sec.openThreads += 1;
    }
  }
  return [...bySector.values()].sort((a, b) => a.sector.localeCompare(b.sector));
}

export function resolveSliceIds(ledger, rawInputs, { allowSector = false, cwd = null } = {}) {
  const map = ledger.slices || {};
  const list = Object.values(map);
  const canonicalPath = (value) => {
    const normalized = String(value || '').trim().replace(/\\/g, '/');
    if (!normalized) return '';
    return cwd ? (relativizeProjectPath(normalized, cwd) ?? normalized) : normalized;
  };
  const sliceMatchesPath = (slice, candidate) => slice.path === candidate || canonicalPath(slice.path) === canonicalPath(candidate);
  const ids = [];
  for (const raw of rawInputs) {
    const text = String(raw || '').trim();
    if (!text) continue;
    if (map[text]) {
      ids.push(text);
      continue;
    }
    const byKey = list.find((s) => s.key === text);
    if (byKey) {
      ids.push(byKey.id);
      continue;
    }
    const byPath = list.filter((s) => sliceMatchesPath(s, text));
    if (byPath.length) {
      for (const s of byPath) ids.push(s.id);
      continue;
    }
    const lineMatch = /^(.+?):(\d+)(?::\d+)?$/.exec(text);
    if (lineMatch) {
      const targetPath = lineMatch[1].replace(/\\/g, '/');
      const targetLine = Number(lineMatch[2]);
      if (Number.isSafeInteger(targetLine) && targetLine >= 1) {
        const candidates = list.filter((s) => sliceMatchesPath(s, targetPath));
        const exact = candidates.find((s) => s.startLine === targetLine && s.endLine === targetLine && s.kind === 'probe')
          || candidates.find((s) => s.startLine === targetLine && s.endLine === targetLine);
        const containing = candidates
          .filter((s) => targetLine >= s.startLine && targetLine <= s.endLine)
          .sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine))[0];
        const hit = exact || containing;
        if (hit) {
          ids.push(hit.id);
          continue;
        }
      }
    }
    if (allowSector) {
      const prefix = text.replace(/\\/g, '/').replace(/\/+$/, '');
      const hits = prefix
        ? list.filter((s) => {
            const cPath = canonicalPath(s.path);
            return (
              s.sector === prefix ||
              sliceMatchesPath(s, prefix) ||
              cPath.startsWith(`${prefix}/`) ||
              sectorOfPath(cPath) === prefix
            );
          })
        : [];
      if (hits.length) {
        for (const s of hits) ids.push(s.id);
        continue;
      }
    }
    ids.push(resolveRef(map, text, 'slice'));
  }
  return [...new Set(ids)];
}

function parsePositiveSafeLine(raw, label) {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw invalidValue(`Invalid ${label} in --at: ${raw}`);
  }
  return n;
}

export function parseProbeLocation(rawAt) {
  const text = String(rawAt || '').trim();
  if (!text) return null;
  const rangeMatch = /^(.+):(\d+)-(\d+)$/.exec(text);
  if (rangeMatch) {
    const cleanPath = rangeMatch[1].trim().replace(/\\/g, '/');
    if (!cleanPath) throw invalidValue(`Invalid --at location: ${text}`);
    const startLine = parsePositiveSafeLine(rangeMatch[2], 'start line');
    const endLine = parsePositiveSafeLine(rangeMatch[3], 'end line');
    if (startLine > endLine) throw invalidValue('Invalid line range in --at');
    return { path: cleanPath, startLine, endLine };
  }
  const lineMatch = /^(.+?):(\d+)(?::(\d+))?$/.exec(text);
  if (lineMatch) {
    const cleanPath = lineMatch[1].trim().replace(/\\/g, '/');
    if (!cleanPath) throw invalidValue(`Invalid --at location: ${text}`);
    const line = parsePositiveSafeLine(lineMatch[2], 'line number');
    if (lineMatch[3] !== undefined) parsePositiveSafeLine(lineMatch[3], 'column number');
    return { path: cleanPath, startLine: line, endLine: line };
  }
  const loc = parseLoc(text);
  if (!loc?.path) throw invalidValue(`Invalid --at location: ${text}`);
  const line = loc.line === null ? 1 : parsePositiveSafeLine(loc.line, 'line number');
  return { path: loc.path, startLine: line, endLine: line };
}
