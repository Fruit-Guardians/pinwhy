import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openWebModules } from '../helpers/load-web-module.mjs';
import { isAuxiliaryPath, scanTargetTree, sliceContent } from '../../lib/ultra/scanner.js';
import { computeEffectiveSlices, formatBreakCycleCommand, parseProbeLocation } from '../../lib/ultra/slices.js';
import { addUltraProbes, buildUltraSnapshot, excludeUltraSlices, markUltraDone, nextUltraBatches, reopenUltraSlices, syncUltra } from '../../lib/ultra/engine.js';
import { appendUltraRecord } from '../../lib/ultra/ledger.js';
import { addEdge, addNode } from '../../lib/store.js';
import { renderExport } from '../../lib/exports/html.js';
import { startServer } from '../../lib/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PINWHY_CLI = path.join(ROOT, 'bin', 'pinwhy.js');
const ULTRA_CLI = path.join(ROOT, 'bin', 'pinwhy-ultra.js');

function run(cli, args, cwd) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('PINWHY_')) delete env[key];
  return spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8', timeout: 15000 });
}

function makeTempProject(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pinwhy-ultra-test-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

test('scanner filters noise/binaries, retains Dockerfile/configs, slices long files at function boundaries, and checks scope containment', (t) => {
  const dir = makeTempProject(t);
  const longLines = [];
  for (let i = 1; i <= 95; i++) longLines.push(`// line ${i}`);
  longLines.push('export function secondHandler() {');
  for (let i = 97; i <= 165; i++) longLines.push(`  const x${i} = ${i};`);
  longLines.push('}');

  writeFiles(dir, {
    'Dockerfile': 'FROM node:22-alpine\nCMD ["node", "src/app.js"]\n',
    'src/auth/login.js': 'export function login() { return true; }\n',
    'src/target/handler.js': 'export function targetHandler() { return true; }\n',
    'rustapp/Cargo.toml': '[package]\nname = "rustapp"\n',
    'rustapp/target/debug/out.rs': 'pub fn compiled() {}\n',
    'src/long.js': `${longLines.join('\n')}\n`,
    'node_modules/pkg/index.js': 'module.exports = 1;\n',
    'dist/bundle.min.js': 'console.log(1);\n',
    'package-lock.json': '{"lockfileVersion":3}\n',
    'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
    'assets/raw.dat': Buffer.from([0x41, 0x42, 0x00, 0x43]),
  });

  const scanned = scanTargetTree(dir, { maxSliceLines: 110 });
  const paths = new Set(scanned.files);
  assert.equal(paths.has('Dockerfile'), true);
  assert.equal(paths.has('src/auth/login.js'), true);
  assert.equal(paths.has('src/target/handler.js'), true);
  assert.equal(paths.has('rustapp/Cargo.toml'), true);
  assert.equal(paths.has('rustapp/target/debug/out.rs'), false);
  assert.equal(paths.has('src/long.js'), true);
  assert.equal(paths.has('node_modules/pkg/index.js'), false);
  assert.equal(paths.has('dist/bundle.min.js'), false);
  assert.equal(paths.has('package-lock.json'), false);
  assert.equal(paths.has('assets/logo.png'), false);
  assert.equal(paths.has('assets/raw.dat'), false);
  assert.equal(scanned.skippedBinary, 1);

  const longSlices = scanned.slices.filter((s) => s.path === 'src/long.js');
  assert.equal(longSlices.length, 2);
  assert.equal(longSlices[0].startLine, 1);
  assert.equal(longSlices[0].endLine, 95);
  assert.equal(longSlices[1].startLine, 96);
  assert.equal(longSlices[1].endLine, longLines.length);
  assert.ok(!JSON.stringify(scanned).includes(dir), 'scanner output must omit host absolute paths');

  assert.throws(() => scanTargetTree(dir, { scope: '../outside' }), (err) => err.code === 'invalid_value');
  assert.equal(sliceContent('empty.js', '').length, 0);
});

test('Ultra CLI lifecycle enforces breadth completion, shallow bounce, dependency propagation, and stale invalidation without polluting events.jsonl', (t) => {
  const dir = makeTempProject(t);
  writeFiles(dir, {
    'src/auth/guard.js': 'export function guard(user) {\n  return Boolean(user?.isAdmin);\n}\n',
    'src/export/run.js': 'export function runExport(req) {\n  return req.query.id;\n}\n',
    'src/billing/pay.js': 'export function charge(cents) {\n  return cents > 0;\n}\n',
  });

  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Ultra lifecycle test', '--cwd', dir, '--json'], dir).status, 0);
  const goalRes = JSON.parse(run(PINWHY_CLI, ['node', 'add', 'goal', 'Audit all routes', '--cwd', dir, '--no-init', '--json'], dir).stdout);
  const goalId = goalRes.node.id;
  const hypRes = JSON.parse(run(PINWHY_CLI, ['node', 'add', 'hypothesis', 'Deferred exploit via billing pivot', '--status', 'deferred', '--tag', 'pivot=session-id', '--to', goalId, '--cwd', dir, '--no-init', '--json'], dir).stdout);
  const primRes = JSON.parse(run(PINWHY_CLI, ['node', 'add', 'observation', 'Session id controllable via query param', '--confidence', 'static-confirmed', '--tag', 'role=primitive', '--tag', 'pivot=session-id', '--cwd', dir, '--no-init', '--json'], dir).stdout);
  const verdictRes = JSON.parse(run(PINWHY_CLI, ['node', 'add', 'finding', 'Unbacked finding claim', '--status', 'confirmed', '--cwd', dir, '--no-init', '--json'], dir).stdout);
  const anomalyRes = JSON.parse(run(PINWHY_CLI, ['node', 'add', 'question', 'Unexplained debug header check', '--tag', 'role=anomaly', '--cwd', dir, '--no-init', '--json'], dir).stdout);

  const eventsFile = path.join(dir, '.pinwhy', 'events.jsonl');
  const eventsBeforeSync = fs.readFileSync(eventsFile, 'utf8');

  const syncRes = JSON.parse(run(ULTRA_CLI, ['sync', '--cwd', dir, '--json'], dir).stdout);
  assert.equal(syncRes.schema, 'pinwhy.ultra-sync.v1');
  assert.equal(syncRes.stats.totalActive, 3);
  assert.equal(fs.readFileSync(eventsFile, 'utf8'), eventsBeforeSync, 'sync must not write mechanical slices to events.jsonl');

  // Parallel next returns non-overlapping batches across distinct sectors.
  const nextMulti = nextUltraBatches(dir, { workers: 2, budgetLines: 300 });
  assert.equal(nextMulti.batches.length, 2);
  const batchIds = nextMulti.batches.flatMap((b) => b.slices.map((s) => s.id));
  assert.equal(new Set(batchIds).size, batchIds.length);
  assert.notEqual(nextMulti.batches[0].sector, nextMulti.batches[1].sector);

  const byPath = new Map(syncRes.snapshot.slices.map((s) => [s.path, s.id]));
  const guardId = byPath.get('src/auth/guard.js');
  const exportId = byPath.get('src/export/run.js');
  const payId = byPath.get('src/billing/pay.js');

  // 1) Insufficient note without refs bounces back as shallow.
  const shallowDone = markUltraDone(dir, { sliceIds: [payId], note: 'ok' });
  assert.equal(shallowDone.updated[0].effectiveStatus, 'shallow');
  assert.equal(shallowDone.updated[0].shallowReason, 'insufficient-note');

  // 2) Depending on an unread guard slice bounces export slice back as shallow.
  const depDone = markUltraDone(dir, {
    sliceIds: [exportId],
    note: 'Calls guard(user) from auth/guard before exporting rows',
    dependsOn: ['src/auth/guard.js'],
    refs: [primRes.node.id],
  });
  assert.equal(depDone.updated[0].effectiveStatus, 'shallow');
  assert.equal(depDone.updated[0].shallowReason, 'unverified-dependency');

  // Guard slice blocks exportId so next prioritizes guard ahead of ordinary shallow/pending slices
  // and holds back exportId until guard is reviewed.
  const depPriorityNext = nextUltraBatches(dir, { workers: 4, budgetLines: 300 });
  const depBatchSlices = depPriorityNext.batches.flatMap((b) => b.slices);
  assert.equal(depBatchSlices[0].id, guardId);
  assert.deepEqual(depBatchSlices[0].blockingFor, [exportId]);
  assert.ok(!depBatchSlices.some((s) => s.id === exportId), 'unverified-dependency slice waits while guard is unread');

  // Verify invalid main-board ref is rejected.
  assert.throws(() => markUltraDone(dir, { sliceIds: [guardId], note: 'Valid note text here', refs: ['missing99'] }), (err) => err.code === 'not_found');

  const midCheck = JSON.parse(run(ULTRA_CLI, ['check', '--cwd', dir, '--json'], dir).stdout);
  assert.equal(midCheck.breadthComplete, false);
  assert.equal(midCheck.summary.shallow, 2);
  assert.equal(midCheck.summary.pending, 1);
  assert.equal(midCheck.gaps.awakenedChains.length, 1);
  assert.equal(midCheck.gaps.awakenedChains[0].hypothesis.id, hypRes.node.id);
  assert.equal(midCheck.gaps.unbackedVerdicts[0].id, verdictRes.node.id);
  assert.equal(midCheck.gaps.unresolvedAnomalies[0].id, anomalyRes.node.id);

  // Clear guard and pay properly (testing path:line resolution); export heals from shallow -> flagged!
  markUltraDone(dir, { sliceIds: ['src/auth/guard.js:2'], note: 'Verified user?.isAdmin check enforces boolean role flag' });
  markUltraDone(dir, { sliceIds: [payId], note: 'Pure arithmetic check cents > 0, no external sink or state mutation' });

  const healedCheck = buildUltraSnapshot(dir, { checkDisk: true });
  assert.equal(healedCheck.breadthComplete, true);
  assert.equal(healedCheck.commitmentComplete, false, 'unbackedVerdict blocks commitmentComplete');
  assert.equal(healedCheck.summary.shallow, 0);
  assert.equal(healedCheck.summary.pending, 0);
  assert.equal(healedCheck.slices.find((s) => s.id === exportId).effectiveStatus, 'flagged');
  assert.equal(healedCheck.allClear, false, 'open threads/awakened chains/unbacked verdicts block allClear');
  assert.equal(fs.readFileSync(eventsFile, 'utf8'), eventsBeforeSync, 'harmless slice reviews must not pollute events.jsonl');

  // Concise CJK note >= 6 chars succeeds without hitting insufficient-note shallow threshold.
  const cjkDone = markUltraDone(dir, { sliceIds: [payId], note: '纯算术检查无输入' });
  assert.equal(cjkDone.updated[0].effectiveStatus, 'cleared');

  // Human interjection on a blank/cleared slice flips it back to shallow(human-followup) at Rank 0!
  const humanQ = addNode({
    type: 'question',
    title: 'What if negative cents bypasses charge?',
    status: 'open',
    at: 'src/billing/pay.js:1',
    tags: [`slice=${payId}`],
    author: 'human',
  }, dir);
  const followupSnap = buildUltraSnapshot(dir, { checkDisk: false });
  const paySliceFollowup = followupSnap.slices.find((s) => s.id === payId);
  assert.equal(paySliceFollowup.effectiveStatus, 'shallow');
  assert.equal(paySliceFollowup.shallowReason, 'human-followup');
  assert.deepEqual(paySliceFollowup.humanFollowups, [humanQ.node.id]);
  const rank0Next = nextUltraBatches(dir, { workers: 1, budgetLines: 300 });
  assert.equal(rank0Next.batches[0].slices[0].id, payId);

  // Addressing the human question via --refs clears human-followup; backing verdict completes commitments
  // even while open threads/awakened chains honestly remain on the board (commitmentComplete=true, allClear=false).
  const answeredDone = markUltraDone(dir, {
    sliceIds: [payId],
    note: 'Checked cents > 0 rejects negatives and returns false',
    refs: [humanQ.node.id],
  });
  assert.equal(answeredDone.updated[0].effectiveStatus, 'flagged');
  assert.deepEqual(answeredDone.updated[0].humanFollowups, []);

  addEdge({ from: primRes.node.id, to: verdictRes.node.id, kind: 'supports', author: 'agent:primary' }, dir);
  const committedCheck = buildUltraSnapshot(dir, { checkDisk: true });
  assert.equal(committedCheck.breadthComplete, true);
  assert.equal(committedCheck.commitmentComplete, true);
  assert.equal(committedCheck.allClear, false, 'honest open threads keep allClear false without invalidating commitments');

  // Refresh eventsBeforeSync baseline after explicit human/edge test writes for stale/reset assertions.
  const eventsAfterHumanTest = fs.readFileSync(eventsFile, 'utf8');

  // Mutate a source file on disk: check detects diskStale before sync, and sync marks it stale.
  fs.appendFileSync(path.join(dir, 'src/auth/guard.js'), '// new bypass branch\n');
  const staleCheck = buildUltraSnapshot(dir, { checkDisk: true });
  assert.equal(staleCheck.breadthComplete, false);
  assert.deepEqual(staleCheck.gaps.diskStaleIds, [guardId]);

  const resync = syncUltra(dir);
  assert.equal(resync.stats.stale, 1);
  assert.equal(resync.snapshot.slices.find((s) => s.id === guardId).effectiveStatus, 'stale');
  // Export slice depending on stale guard automatically bounces back to shallow!
  assert.equal(resync.snapshot.slices.find((s) => s.id === exportId).effectiveStatus, 'shallow');

  // Removing guard.js on disk also keeps export in shallow (deleted dependency),
  // and passing --depends-on none clears the obsolete dependency upon re-review.
  fs.rmSync(path.join(dir, 'src/auth/guard.js'));
  const removedGuardSync = syncUltra(dir);
  assert.equal(removedGuardSync.snapshot.slices.find((s) => s.id === exportId).effectiveStatus, 'shallow');
  assert.equal(removedGuardSync.snapshot.slices.find((s) => s.id === exportId).shallowReason, 'unverified-dependency');

  const clearedExport = markUltraDone(dir, {
    sliceIds: ['src/export/run.js:1-3'],
    note: 'Refactored export handler no longer relies on removed guard module',
    dependsOn: ['none'],
  });
  assert.equal(clearedExport.updated[0].effectiveStatus, 'flagged');
  assert.deepEqual(clearedExport.updated[0].dependsOn, []);

  // Reopen & reset do not touch events.jsonl.
  const reopened = reopenUltraSlices(dir, { sliceIds: [payId], reason: 'Re-check integer overflow' });
  assert.equal(reopened.reopened[0].effectiveStatus, 'pending');
  assert.equal(run(ULTRA_CLI, ['reset', '--yes', '--cwd', dir, '--json'], dir).status, 0);
  assert.equal(buildUltraSnapshot(dir).initialized, false);
  assert.equal(fs.readFileSync(eventsFile, 'utf8'), eventsAfterHumanTest);
});

async function setupUltraHistoryProject(t) {
  const dir = makeTempProject(t);
  writeFiles(dir, { 'src/app.js': 'export const ok = true;\n' });
  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Server Ultra Test', '--cwd', dir], dir).status, 0);
  assert.equal(run(PINWHY_CLI, ['node', 'add', 'goal', 'Inspect app', '--cwd', dir, '--no-init'], dir).status, 0);
  assert.equal(run(PINWHY_CLI, ['checkpoint', '--summary', 'cp1', '--cwd', dir, '--no-init'], dir).status, 0);
  await new Promise((r) => setTimeout(r, 15));
  const synced = syncUltra(dir);
  const s1Id = synced.snapshot.slices[0].id;
  assert.equal(run(PINWHY_CLI, ['checkpoint', '--summary', 'cp2', '--cwd', dir, '--no-init'], dir).status, 0);
  await new Promise((r) => setTimeout(r, 15));
  markUltraDone(dir, { sliceIds: [s1Id], note: 'Pure constant ok=true export with zero inputs' });
  return { dir, s1Id };
}

function readFirstSseFrame(url, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req?.destroy();
      reject(new Error(`SSE first frame timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req?.destroy();
      fn();
    };
    req = http.get(url, (res) => {
      const contentType = String(res.headers['content-type'] || '');
      if (res.statusCode !== 200 || !/^text\/event-stream\b/i.test(contentType)) {
        res.resume();
        finish(() => reject(new Error(`unexpected SSE response: status=${res.statusCode} content-type=${contentType || '<missing>'}`)));
        return;
      }
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        if (buf.includes('\n\n')) {
          finish(() => resolve(buf.slice(0, buf.indexOf('\n\n') + 2)));
        }
      });
      res.on('end', () => {
        if (!settled) finish(() => reject(new Error(`SSE stream ended before first frame: ${JSON.stringify(buf)}`)));
      });
      res.on('close', () => {
        if (!settled) finish(() => reject(new Error(`SSE stream ended before first frame: ${JSON.stringify(buf)}`)));
      });
      res.on('error', (err) => {
        if (settled && err?.code === 'ECONNRESET') return;
        if (!settled) finish(() => reject(err));
      });
    });
    req.on('error', (err) => {
      if (settled && err?.code === 'ECONNRESET') return;
      if (!settled) finish(() => reject(err));
    });
  });
}

test('server exposes /api/ultra live and historical ?asOf= snapshots', async (t) => {
  const { dir } = await setupUltraHistoryProject(t);
  const server = await startServer({ cwd: dir, port: 0, readOnly: true });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/ultra`);
  assert.equal(res.status, 200);
  const snap = await res.json();
  assert.equal(snap.schema, 'pinwhy.ultra.v1');
  assert.equal(snap.initialized, true);
  assert.equal(snap.summary.totalSlices, 1);
  assert.equal(snap.summary.coveredSlices, 1);

  const cp1Res = await fetch(`${base}/api/ultra?asOf=cp1`);
  assert.equal(cp1Res.status, 200);
  const cp1Snap = await cp1Res.json();
  assert.equal(cp1Snap.initialized, false, '?asOf=cp1 must not leak later sync events');

  const cp2Res = await fetch(`${base}/api/ultra?asOf=cp2`);
  assert.equal(cp2Res.status, 200);
  const cp2Snap = await cp2Res.json();
  assert.equal(cp2Snap.initialized, true);
  assert.equal(cp2Snap.summary.pending, 1, '?asOf=cp2 must reflect synced pending slice before post-cp2 review');
  assert.equal(cp2Snap.summary.coveredSlices, 0);
});

test('server /ultra-events SSE delivers initial ultra frame and fails fast on bad HTTP responses', async (t) => {
  const { dir } = await setupUltraHistoryProject(t);
  const server = await startServer({ cwd: dir, port: 0, readOnly: true });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const frame = await readFirstSseFrame(`${base}/ultra-events`);
  assert.match(frame, /^event: ultra\ndata: /);
  const ssePayload = JSON.parse(frame.split('\n').find((l) => l.startsWith('data: ')).slice(6));
  assert.equal(ssePayload.schema, 'pinwhy.ultra.v1');

  await assert.rejects(() => readFirstSseFrame(`${base}/missing-route`, { timeoutMs: 2000 }), /status=404/);
});

test('offline HTML export embeds window.__PINWHY_ULTRA__ when Ultra ledger is initialized', async (t) => {
  if (!fs.existsSync(path.join(ROOT, 'public', 'index.html'))) {
    t.skip('public/index.html not built');
    return;
  }
  const { dir } = await setupUltraHistoryProject(t);
  const htmlOut = path.join(dir, 'ultra-export.html');
  assert.equal(run(PINWHY_CLI, ['export', '--out', htmlOut, '--cwd', dir], dir).status, 0);
  const html = fs.readFileSync(htmlOut, 'utf8');
  assert.match(html, /window\.__PINWHY_DATA__ = .*;/);
  const ultraLine = html.match(/window\.__PINWHY_ULTRA__ = (.*);/);
  assert.ok(ultraLine, 'offline HTML embeds __PINWHY_ULTRA__ when Ultra ledger is initialized');
  assert.equal(JSON.parse(ultraLine[1]).summary.totalSlices, 1);
});

test('frontend pure ultra projection handles ledger and board-derived modes without mutating snapshots', async (t) => {
  const web = await openWebModules();
  t.after(() => web.close());
  const { buildUltraModel } = await web.load('/src/workspace/ultra.ts');

  const graph = {
    meta: { title: 'Synthetic Ultra Board' },
    nodes: {
      g1: { id: 'g1', type: 'goal', title: 'Audit boundaries', status: 'open' },
      f1: { id: 'f1', type: 'fact', title: 'Header read primitive', status: 'confirmed', confidence: 'static-confirmed', loc: { path: 'src/auth/session.js', line: 5 }, tags: ['role=primitive', 'pivot=role'] },
      v1: { id: 'v1', type: 'vuln', title: 'Privilege escalation in export', severity: 'critical', confidence: 'static-confirmed', status: 'confirmed', loc: { path: 'src/export/run.js', line: 8 } },
      h1: { id: 'h1', type: 'hypothesis', title: 'Deferred chain via role pivot', status: 'deferred', loc: { path: 'src/billing/pay.js', line: 4 }, tags: ['pivot=role'] },
      hum1: { id: 'hum1', type: 'question', title: 'Check edge proxy', status: 'open', author: 'human' },
    },
    edges: {
      e1: { id: 'e1', from: 'f1', to: 'v1', kind: 'supports' },
    },
    cursors: {
      'agent:auth': { id: 'c1', agentId: 'agent:auth', to: 'f1' },
    },
  };

  const beforeGraph = JSON.stringify(graph);

  // 1) Board-derived fallback mode (no ledger).
  const derived = buildUltraModel(graph, null, { lens: 'chains', filter: 'all' });
  assert.equal(derived.sourceMode, 'board-derived');
  assert.equal(derived.sectors.length, 4);
  assert.ok(derived.chords.some((c) => c.fromId === 'f1' && c.toId === 'v1'));
  assert.ok(derived.chords.some((c) => c.isAwakened && c.fromId === 'f1' && c.toId === 'h1'));
  assert.equal(derived.satellites.length, 1);
  assert.equal(derived.metrics.humanSignals, 1);

  // Goal alone without loc never creates a spurious 'unscoped' sector.
  const goalOnlyDerived = buildUltraModel({
    meta: { title: 'Goal filter test' },
    nodes: { g1: graph.nodes.g1, f1: graph.nodes.f1 },
    edges: {},
    cursors: {},
  }, null);
  assert.equal(goalOnlyDerived.sectors.length, 1);
  assert.equal(goalOnlyDerived.sectors[0].sector, 'src/auth');

  // 2) Ledger mode.
  const ultraSnap = {
    schema: 'pinwhy.ultra.v1',
    readOnly: true,
    prescriptive: false,
    initialized: true,
    scope: null,
    maxSliceLines: 320,
    syncCount: 1,
    updatedAt: 1000,
    summary: {
      totalSlices: 5, totalLines: 60, pending: 2, stale: 0, shallow: 0, cleared: 0, flagged: 2, excluded: 1, probes: 1, pendingProbes: 1,
      coveredSlices: 3, sectors: 3, openThreads: 1, unbackedVerdicts: 0, awakenedChains: 1,
      unresolvedAnomalies: 0, humanSignals: 1, untrackedFiles: 0, diskStale: 0, remainingSlices: 2, coverageRatio: 0.6,
    },
    slices: [
      { id: 's1', key: 'src/auth/session.js:1-20', path: 'src/auth/session.js', sector: 'src/auth', startLine: 1, endLine: 20, lines: 20, hash: 'aaa', status: 'flagged', effectiveStatus: 'flagged', refs: ['f1'], dependsOn: [] },
      { id: 's2', key: 'src/export/run.js:1-20', path: 'src/export/run.js', sector: 'src/export', startLine: 1, endLine: 20, lines: 20, hash: 'bbb', status: 'flagged', effectiveStatus: 'flagged', refs: ['v1'], dependsOn: ['s1'] },
      { id: 's3', key: 'src/billing/pay.js:1-20', path: 'src/billing/pay.js', sector: 'src/billing', startLine: 1, endLine: 20, lines: 20, hash: 'ccc', status: 'pending', effectiveStatus: 'pending', refs: [], dependsOn: [] },
      { id: 's4', key: 'src/billing/old.js:1-10', path: 'src/billing/old.js', sector: 'src/billing', startLine: 1, endLine: 10, lines: 10, hash: 'ddd', status: 'excluded', effectiveStatus: 'excluded', note: 'Deprecated module', refs: [], dependsOn: [] },
      { id: 'p1', kind: 'probe', title: 'Verify coupon replay race', key: 'probe:p1', path: '[probe]/src/billing', sector: 'src/billing', startLine: 1, endLine: 1, lines: 0, hash: null, status: 'pending', effectiveStatus: 'pending', refs: [], dependsOn: [] },
    ],
    sectors: [],
    gaps: {
      openThreads: [], unbackedVerdicts: [], awakenedChains: [{ hypothesis: { id: 'h1', type: 'hypothesis', title: 'Deferred', status: 'deferred', severity: null, confidence: null }, matches: [{ nodeId: 'f1', title: 'Header read', via: 'pivot=role' }] }],
      unresolvedAnomalies: [], humanSignals: [], untrackedFiles: [], diskStaleIds: [], shallowSlices: [], staleSlices: [],
    },
    breadthComplete: false,
    allClear: false,
  };

  const ledgerModel = buildUltraModel(graph, ultraSnap, { lens: 'surface', filter: 'all' });
  assert.equal(ledgerModel.sourceMode, 'ledger');
  assert.equal(ledgerModel.metrics.blindSpots, 2);
  assert.ok(ledgerModel.chords.some((c) => c.kind === 'depends-on' && c.fromId === 's2' && c.toId === 's1'));
  assert.ok(ledgerModel.chords.some((c) => c.isAwakened && c.fromId === 'f1' && c.toId === 'h1'));
  assert.ok(ledgerModel.busLaneCount >= 1);
  assert.ok(ledgerModel.chords.every((c) => typeof c.laneIndex === 'number' && c.laneIndex >= 0));
  assert.equal(ledgerModel.nextWave?.sector, 'src/billing');
  assert.deepEqual(ledgerModel.nextWave?.slices.map((s) => s.id), ['p1', 's3']);
  assert.equal(ledgerModel.sectorMap.get('src/billing')?.coveredSlices, 1);
  assert.equal(ledgerModel.barById.get('p1')?.label, 'Verify coupon replay race');
  assert.equal(ledgerModel.barById.get('p1')?.shortLabel, 'Verify coupon replay race');
  assert.equal(JSON.stringify(graph), beforeGraph);
});

test('Ultra skips aux files by default, supports add probes + exclude semantics, and stays compact with --compact', (t) => {
  const dir = makeTempProject(t);
  writeFiles(dir, {
    'README.md': '# Demo project\n',
    'docs/guide.mdx': '# Guide\n',
    'src/auth/login.ts': 'export function login(token: string) { return token.length > 0; }\n',
    'src/auth/__tests__/login.test.ts': 'test("ok", () => {});\n',
    'src/auth/__snapshots__/login.test.ts.snap': 'exports[`ok 1`] = `true`;\n',
    'src/legacy/old.ts': 'export const deprecated = true;\n',
    'src/legacy/helper.ts': 'export const helper = 1;\n',
    'pkg/service_test.go': 'package pkg\n',
    'LICENSE': 'MIT\n',
  });

  assert.equal(isAuxiliaryPath('src/auth/__tests__/login.test.ts'), true);
  assert.equal(isAuxiliaryPath('src/auth/__snapshots__/login.test.ts.snap'), true);
  assert.equal(isAuxiliaryPath('pkg/service_test.go'), true);
  assert.equal(isAuxiliaryPath('LICENSE'), true);
  assert.equal(isAuxiliaryPath('src/auth/login.ts'), false);

  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Swarm harness test', '--cwd', dir, '--json'], dir).status, 0);

  // 1) Default sync skips auxiliary tests/docs/snapshots while compact JSON omits full slices & sector sliceIds.
  const compactSyncOut = run(ULTRA_CLI, ['sync', '--cwd', dir, '--compact', '--json'], dir).stdout;
  assert.ok(Buffer.byteLength(compactSyncOut) < 2048, `compact sync output too large: ${Buffer.byteLength(compactSyncOut)}B`);
  const compactSync = JSON.parse(compactSyncOut);
  assert.equal(compactSync.stats.filesScanned, 3);
  assert.equal(compactSync.stats.skippedAux, 6);
  assert.equal(compactSync.snapshot.slicesOmitted, true);
  assert.equal(compactSync.snapshot.slices, undefined);
  assert.equal(compactSync.snapshot.sectors.every((s) => !('sliceIds' in s)), true);

  const compactCoreCheckOut = run(ULTRA_CLI, ['check', '--cwd', dir, '--compact', '--json'], dir).stdout;
  assert.ok(Buffer.byteLength(compactCoreCheckOut) < 2048, `compact check output too large: ${Buffer.byteLength(compactCoreCheckOut)}B`);

  // Full check still sees core files clean and aux files intentionally omitted.
  const fullSnapBefore = buildUltraSnapshot(dir, { checkDisk: true });
  assert.equal(fullSnapBefore.slices.length, 3);
  assert.equal(fullSnapBefore.includeAux, false);
  assert.equal(fullSnapBefore.gaps.untrackedFiles.length, 0);

  // 2) Add enumerated & dynamic probes via CLI; probes survive subsequent re-sync & cluster before slices in next.
  const addOut = run(ULTRA_CLI, [
    'add',
    'Test empty bearer token returns 401',
    'Verify constant-time signature check',
    '--at', 'src/auth/login.ts:1',
    '--cwd', dir,
    '--json',
  ], dir);
  assert.equal(addOut.status, 0);
  const addRes = JSON.parse(addOut.stdout);
  assert.equal(addRes.schema, 'pinwhy.ultra-add.v1');
  assert.equal(addRes.added.length, 2);
  const p1 = addRes.added[0].id;
  const p2 = addRes.added[1].id;
  assert.equal(addRes.added[0].sector, 'src/auth');

  // Re-sync after modifying login.ts: core slice exists, and probes survive intact!
  fs.appendFileSync(path.join(dir, 'src/auth/login.ts'), '// comment\n');
  const resyncAfterAdd = syncUltra(dir);
  assert.equal(resyncAfterAdd.snapshot.summary.probes, 2);
  assert.ok(resyncAfterAdd.snapshot.slices.some((s) => s.id === p1 && s.kind === 'probe'));

  // next batches cluster sector probes first alongside the sector's file slice.
  const nextSector = nextUltraBatches(dir, { workers: 2, budgetLines: 420, sector: 'src/auth' });
  assert.equal(nextSector.batches.length, 1);
  assert.equal(nextSector.batches[0].slices[0].kind, 'probe');
  assert.equal(nextSector.batches[0].slices[1].kind, 'probe');
  assert.equal(nextSector.batches[0].slices[2].kind, 'slice');

  // Completing probes decrements pendingProbes while keeping breadth intact.
  const doneProbeRes = markUltraDone(dir, { sliceIds: [p1, p2], note: 'Verified runtime unit and HTTP checks pass' });
  assert.equal(doneProbeRes.updated.every((u) => u.effectiveStatus === 'cleared'), true);
  assert.equal(doneProbeRes.summary.pendingProbes, 0);

  // 3) Exclude semantics: short note bounces to shallow; valid note marks excluded;
  // excluded slice cannot satisfy --depends-on; human follow-up bounces excluded back to shallow.
  const shortExclude = excludeUltraSlices(dir, { sliceIds: ['src/legacy'], note: 'skip' });
  assert.equal(shortExclude.excluded.length, 2);
  assert.equal(shortExclude.excluded[0].effectiveStatus, 'shallow');
  assert.equal(shortExclude.excluded[0].shallowReason, 'insufficient-note');

  const validExclude = run(ULTRA_CLI, [
    'exclude', 'src/legacy',
    '--note', 'Deprecated legacy stub unreferenced by server entry',
    '--cwd', dir,
    '--json',
  ], dir);
  assert.equal(validExclude.status, 0);
  const excludeJson = JSON.parse(validExclude.stdout);
  assert.equal(excludeJson.schema, 'pinwhy.ultra-exclude.v1');
  assert.equal(excludeJson.excluded.every((s) => s.effectiveStatus === 'excluded'), true);
  assert.equal(excludeJson.summary.excluded, 2);

  // Mutating an excluded file on disk does NOT mark it stale or untracked.
  fs.appendFileSync(path.join(dir, 'src/legacy/old.ts'), '// untouched legacy edit\n');
  const postLegacyEditCheck = buildUltraSnapshot(dir, { checkDisk: true });
  assert.deepEqual(postLegacyEditCheck.gaps.diskStaleIds, []);

  // Downstream slice claiming --depends-on an excluded slice bounces to shallow(unverified-dependency)!
  const loginSlice = postLegacyEditCheck.slices.find((s) => s.path === 'src/auth/login.ts');
  const blockedByExcluded = markUltraDone(dir, {
    sliceIds: [loginSlice.id],
    note: 'Assumes legacy helper validates caller token',
    dependsOn: ['src/legacy/helper.ts'],
  });
  assert.equal(blockedByExcluded.updated[0].effectiveStatus, 'shallow');
  assert.equal(blockedByExcluded.updated[0].shallowReason, 'unverified-dependency');

  // Removing obsolete dep clears login.ts cleanly; adding human challenge on excluded old.ts bounces it to shallow!
  markUltraDone(dir, {
    sliceIds: [loginSlice.id],
    note: 'Verified token check does not rely on legacy module',
    dependsOn: ['none'],
  });
  const legacyOld = postLegacyEditCheck.slices.find((s) => s.path === 'src/legacy/old.ts');
  const humanOnExcluded = addNode({
    type: 'question',
    title: 'Is old.ts still exported dynamically?',
    status: 'open',
    at: 'src/legacy/old.ts:1',
    tags: [`slice=${legacyOld.id}`],
    author: 'human',
  }, dir);
  const afterHumanCheck = buildUltraSnapshot(dir, { checkDisk: false });
  const bouncedLegacy = afterHumanCheck.slices.find((s) => s.id === legacyOld.id);
  assert.equal(bouncedLegacy.effectiveStatus, 'shallow');
  assert.equal(bouncedLegacy.shallowReason, 'human-followup');
  assert.deepEqual(bouncedLegacy.humanFollowups, [humanOnExcluded.node.id]);

  // 4) --include-aux picks up test/doc/snapshot files when explicitly requested, and compact check stays < 2KB.
  const auxSyncOut = run(ULTRA_CLI, ['sync', '--cwd', dir, '--include-aux', '--compact', '--json'], dir).stdout;
  const auxSync = JSON.parse(auxSyncOut);
  assert.equal(auxSync.includeAux, true);
  assert.equal(auxSync.stats.skippedAux, 0);
  assert.equal(auxSync.stats.filesScanned, 9);

  const compactCheckOut = run(ULTRA_CLI, ['check', '--cwd', dir, '--compact', '--json'], dir).stdout;
  const fullCheckOut = run(ULTRA_CLI, ['check', '--cwd', dir, '--json'], dir).stdout;
  assert.ok(Buffer.byteLength(compactCheckOut) < Buffer.byteLength(fullCheckOut), 'compact check output must stay smaller than full check');
  const compactCheck = JSON.parse(compactCheckOut);
  assert.equal(compactCheck.slicesOmitted, true);
  assert.equal(compactCheck.slices, undefined);
});

test('computeEffectiveSlices propagates dependencies beyond 16 hops in both orders and terminates on cycles', () => {
  const makeChain = (reverseOrder) => {
    const entries = [];
    for (let i = 1; i <= 18; i += 1) {
      entries.push([`s${i}`, {
        id: `s${i}`,
        kind: 'slice',
        sector: 'chain',
        path: `src/f${String(i).padStart(2, '0')}.ts`,
        startLine: 1,
        endLine: 10,
        lines: 10,
        hash: `h${i}`,
        reviewedHash: i < 18 ? `h${i}` : null,
        status: i < 18 ? 'cleared' : 'pending',
        note: i < 18 ? 'Verified against downstream invariant' : '',
        refs: [],
        dependsOn: i < 18 ? [`s${i + 1}`] : [],
      }]);
    }
    if (reverseOrder) entries.reverse();
    return computeEffectiveSlices({ slices: Object.fromEntries(entries) }, { nodes: {} });
  };

  for (const reverseOrder of [false, true]) {
    const slices = makeChain(reverseOrder);
    const byId = new Map(slices.map((s) => [s.id, s]));
    assert.equal(byId.get('s18').effectiveStatus, 'pending');
    for (let i = 1; i <= 17; i += 1) {
      assert.equal(byId.get(`s${i}`).effectiveStatus, 'shallow', `order=${reverseOrder} s${i}`);
      assert.equal(byId.get(`s${i}`).shallowReason, 'unverified-dependency');
      assert.deepEqual(byId.get(`s${i}`).unverifiedDependencies, [`s${i + 1}`]);
    }
  }

  // Pure cleared cycle stays cleared; cycle touching a pending slice downgrades all members and terminates.
  const cycleSlices = computeEffectiveSlices({
    slices: {
      a: { id: 'a', sector: 'cyc', path: 'src/a.ts', startLine: 1, endLine: 5, status: 'cleared', note: 'Verified mutual call', dependsOn: ['b'], refs: [] },
      b: { id: 'b', sector: 'cyc', path: 'src/b.ts', startLine: 1, endLine: 5, status: 'cleared', note: 'Verified mutual call', dependsOn: ['a'], refs: [] },
      c: { id: 'c', sector: 'cyc', path: 'src/c.ts', startLine: 1, endLine: 5, status: 'cleared', note: 'Depends on c2 and tail', dependsOn: ['d', 'e'], refs: [] },
      d: { id: 'd', sector: 'cyc', path: 'src/d.ts', startLine: 1, endLine: 5, status: 'cleared', note: 'Mutual dep with c', dependsOn: ['c'], refs: [] },
      e: { id: 'e', sector: 'cyc', path: 'src/e.ts', startLine: 1, endLine: 5, status: 'pending', note: '', dependsOn: [], refs: [] },
    },
  }, { nodes: {} });
  const cycById = new Map(cycleSlices.map((s) => [s.id, s]));
  assert.equal(cycById.get('a').effectiveStatus, 'cleared');
  assert.equal(cycById.get('b').effectiveStatus, 'cleared');
  assert.equal(cycById.get('c').effectiveStatus, 'shallow');
  assert.equal(cycById.get('d').effectiveStatus, 'shallow');
  assert.deepEqual(cycById.get('c').unverifiedDependencies, ['d', 'e']);
});

test('parseProbeLocation validates safe positive line numbers in all forms without breaking bare filenames', () => {
  assert.deepEqual(parseProbeLocation('src/a.ts:12'), { path: 'src/a.ts', startLine: 12, endLine: 12 });
  assert.deepEqual(parseProbeLocation('src/a.ts:12:4'), { path: 'src/a.ts', startLine: 12, endLine: 12 });
  assert.deepEqual(parseProbeLocation('src/a.ts:10-20'), { path: 'src/a.ts', startLine: 10, endLine: 20 });
  assert.deepEqual(parseProbeLocation('src\\a.ts:5'), { path: 'src/a.ts', startLine: 5, endLine: 5 });
  assert.deepEqual(parseProbeLocation('Makefile'), { path: 'Makefile', startLine: 1, endLine: 1 });
  assert.deepEqual(parseProbeLocation('.gitignore'), { path: '.gitignore', startLine: 1, endLine: 1 });
  assert.deepEqual(parseProbeLocation(':12'), { path: ':12', startLine: 1, endLine: 1 });

  const huge = '9'.repeat(310);
  for (const bad of [
    `a.js:${huge}`,
    'a.js:9007199254740992',
    'a.js:0',
    'a.js:1:9007199254740992',
    'a.js:1-9007199254740992',
    'a.js:0-5',
    'a.js:20-10',
  ]) {
    assert.throws(() => parseProbeLocation(bad), { code: 'invalid_value' }, `expected rejection for ${bad.slice(0, 32)}`);
  }
});

test('buildUltraSnapshot and offline HTML export relativize in-project host paths and mask external paths', (t) => {
  const dir = makeTempProject(t);
  writeFiles(dir, { 'src/auth/login.ts': 'export const ok = true;\n' });
  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Path Sanitization', '--cwd', dir], dir).status, 0);
  syncUltra(dir);
  const insideAbs = path.join(dir, 'src', 'auth', 'login.ts');
  addUltraProbes(dir, { titles: ['Inside probe'], at: `${insideAbs}:10` });
  addUltraProbes(dir, { titles: ['Outside POSIX probe'], at: '/tmp/host-secret-dir/outside.ts:5' });
  addUltraProbes(dir, { titles: ['Outside Windows probe'], at: 'D:\\workspaces\\host-secret\\win.ts:3' });
  addUltraProbes(dir, { titles: ['Outside UNC probe'], at: '\\\\corp-host\\secret\\doc.ts:4' });
  addNode({ type: 'question', title: 'External locator question', status: 'open', at: '/tmp/host-secret-dir/node.ts:9' }, dir);
  addNode({ type: 'question', title: 'Internal locator question', status: 'open', at: `${path.join(dir, 'src', 'in.ts')}:2` }, dir);

  const snap = buildUltraSnapshot(dir);
  const serializedSnap = JSON.stringify(snap);
  assert.equal(serializedSnap.includes(dir), false, 'snapshot never leaks project temp root');
  assert.equal(serializedSnap.includes('host-secret-dir'), false);
  assert.equal(serializedSnap.includes('host-secret'), false);
  assert.equal(serializedSnap.includes('corp-host'), false);

  const byTitle = new Map(snap.slices.map((s) => [s.title, s]));
  assert.equal(byTitle.get('Inside probe').path, 'src/auth/login.ts');
  assert.equal(byTitle.get('Inside probe').sector, 'src/auth');
  assert.equal(byTitle.get('Outside POSIX probe').path, '<external>/outside.ts');
  assert.equal(byTitle.get('Outside POSIX probe').sector, '<external>');
  assert.equal(byTitle.get('Outside Windows probe').path, '<external>/win.ts');
  assert.equal(byTitle.get('Outside Windows probe').sector, '<external>');
  assert.equal(byTitle.get('Outside UNC probe').path, '<external>/doc.ts');
  assert.equal(byTitle.get('Outside UNC probe').sector, '<external>');

  const gapThreads = new Map(snap.gaps.openThreads.map((n) => [n.title, n]));
  assert.deepEqual(gapThreads.get('External locator question').loc, { path: '<external>/node.ts', line: 9 });
  assert.deepEqual(gapThreads.get('Internal locator question').loc, { path: 'src/in.ts', line: 2 });

  if (fs.existsSync(path.join(ROOT, 'public', 'index.html'))) {
    const html = renderExport({ cwd: dir });
    assert.equal(html.includes(dir), false);
    assert.equal(html.includes('host-secret'), false);
    assert.equal(html.includes('corp-host'), false);
    const data = JSON.parse(html.match(/window\.__PINWHY_DATA__ = (.*);/)[1]);
    const ultra = JSON.parse(html.match(/window\.__PINWHY_ULTRA__ = (.*);/)[1]);
    assert.equal(data.nodes.q1.loc.path, '<external>/node.ts');
    assert.equal(data.nodes.q2.loc.path, 'src/in.ts');
    assert.equal(ultra.slices.find((s) => s.title === 'Outside POSIX probe').path, '<external>/outside.ts');
  }
});

test('CLI add -> next -> done round-trips locations for normalized, absolute, legacy, and external probes', (t) => {
  const dir = makeTempProject(t);
  writeFiles(dir, {
    'src/feature.js': 'export function handleFeature() {\n  return true;\n}\n',
    'src/legacy.js': 'export function legacyEntry() {\n  return 1;\n}\n',
  });
  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Location Roundtrip', '--cwd', dir], dir).status, 0);
  assert.equal(run(ULTRA_CLI, ['sync', '--cwd', dir], dir).status, 0);

  // 1) In-project absolute location passed to `add` normalizes to project-relative `src/feature.js:5`,
  //    and the exact location printed by `next` succeeds when passed back to `done`.
  const insideAbs = path.join(dir, 'src', 'feature.js');
  const addIn = run(ULTRA_CLI, ['add', 'Check feature guard', '--at', `${insideAbs}:5`, '--cwd', dir, '--json'], dir);
  assert.equal(addIn.status, 0, addIn.stderr || addIn.stdout);
  const addedIn = JSON.parse(addIn.stdout).added[0];
  assert.equal(addedIn.path, 'src/feature.js');

  const nextIn = run(ULTRA_CLI, ['next', '--sector', 'src', '--max-slices', '10', '--cwd', dir, '--json'], dir);
  assert.equal(nextIn.status, 0, nextIn.stderr || nextIn.stdout);
  const scheduledIn = JSON.parse(nextIn.stdout).batches.flatMap((b) => b.slices).find((s) => s.id === addedIn.id);
  assert.equal(scheduledIn.path, 'src/feature.js');
  assert.equal(scheduledIn.startLine, 5);

  const doneIn = run(ULTRA_CLI, ['done', `${scheduledIn.path}:${scheduledIn.startLine}`, '--note', 'Verified guard handles missing token cleanly.', '--cwd', dir, '--json'], dir);
  assert.equal(doneIn.status, 0, doneIn.stderr || doneIn.stdout);
  assert.equal(JSON.parse(doneIn.stdout).updated[0].id, addedIn.id);
  assert.equal(JSON.parse(doneIn.stdout).updated[0].effectiveStatus, 'cleared');

  // 2) Calling `done` with an in-project absolute location resolves the probe even when a slice covers the same file.
  const addSecond = run(ULTRA_CLI, ['add', 'Check second feature guard', '--at', `${insideAbs}:12`, '--cwd', dir, '--json'], dir);
  assert.equal(addSecond.status, 0, addSecond.stderr || addSecond.stdout);
  const secondId = JSON.parse(addSecond.stdout).added[0].id;
  const doneAbs = run(ULTRA_CLI, ['done', `${insideAbs}:12`, '--note', 'Verified second guard using absolute path.', '--cwd', dir, '--json'], dir);
  assert.equal(doneAbs.status, 0, doneAbs.stderr || doneAbs.stdout);
  assert.equal(JSON.parse(doneAbs.stdout).updated[0].id, secondId);
  assert.equal(JSON.parse(doneAbs.stdout).updated[0].effectiveStatus, 'cleared');

  // 3) Legacy ledger record storing an un-normalized in-project absolute path still round-trips `next -> done`.
  const legacyAbs = path.join(dir, 'src', 'legacy.js');
  appendUltraRecord({
    op: 'probe',
    at: Date.now(),
    agent: 'agent:primary',
    probes: [{ title: 'Legacy raw probe', sector: 'src', path: legacyAbs, startLine: 7, endLine: 7 }],
  }, dir);
  const nextLegacy = JSON.parse(run(ULTRA_CLI, ['next', '--sector', 'src', '--max-slices', '10', '--cwd', dir, '--json'], dir).stdout);
  const legacyItem = nextLegacy.batches.flatMap((b) => b.slices).find((s) => s.title === 'Legacy raw probe');
  assert.equal(legacyItem.path, 'src/legacy.js');
  const doneLegacy = run(ULTRA_CLI, ['done', `${legacyItem.path}:${legacyItem.startLine}`, '--note', 'Verified legacy probe entry cleanly.', '--cwd', dir, '--json'], dir);
  assert.equal(doneLegacy.status, 0, doneLegacy.stderr || doneLegacy.stdout);
  assert.equal(JSON.parse(doneLegacy.stdout).updated[0].effectiveStatus, 'cleared');

  // 4) External path keeps local runnable identity in `next -> done`, while shared `check` & export mask it to `<external>/...`.
  const extAbs = '/tmp/external-secret-target/outside.js';
  assert.equal(run(ULTRA_CLI, ['add', 'Check external contract', '--at', `${extAbs}:9`, '--cwd', dir, '--json'], dir).status, 0);
  const sharedCheck = JSON.parse(run(ULTRA_CLI, ['check', '--cwd', dir, '--json'], dir).stdout);
  const maskedExt = sharedCheck.slices.find((s) => s.title === 'Check external contract');
  assert.equal(maskedExt.path, '<external>/outside.js');

  const localNext = JSON.parse(run(ULTRA_CLI, ['next', '--sector', '<external>', '--max-slices', '10', '--cwd', dir, '--json'], dir).stdout);
  const extNext = JSON.parse(run(ULTRA_CLI, ['next', '--max-slices', '20', '--workers', '8', '--cwd', dir, '--json'], dir).stdout);
  assert.equal(localNext.batches.length, 0, 'local scheduler uses raw external sector rather than shared <external> alias');
  const extItem = extNext.batches.flatMap((b) => b.slices).find((s) => s.title === 'Check external contract');
  assert.equal(extItem.path, extAbs);
  const doneExt = run(ULTRA_CLI, ['done', `${extItem.path}:${extItem.startLine}`, '--note', 'Verified external integration contract.', '--cwd', dir, '--json'], dir);
  assert.equal(doneExt.status, 0, doneExt.stderr || doneExt.stdout);
  assert.equal(JSON.parse(doneExt.stdout).updated[0].effectiveStatus, 'cleared');
});

test('Ultra detects mutual dependency cycles, emits non-blocking warnings/hints, preserves breadth convergence, and breaks cleanly', (t) => {
  const dir = makeTempProject(t);
  writeFiles(dir, {
    'src/a.ts': 'export const a = 1;\n',
    'src/b.ts': 'export const b = 2;\n',
    'src/c.ts': 'export const c = 3;\n',
  });
  assert.equal(run(PINWHY_CLI, ['init', '--title', 'Cycle Detection', '--cwd', dir], dir).status, 0);
  const synced = syncUltra(dir);
  const byPath = new Map(synced.snapshot.slices.map((s) => [s.path, s.id]));
  const s1Id = byPath.get('src/a.ts');
  const s2Id = byPath.get('src/b.ts');
  const s3Id = byPath.get('src/c.ts');

  // 1) Self-dependency is ignored with a non-blocking warning.
  const selfDone = markUltraDone(dir, { sliceIds: [s2Id], note: 'Verified s2 standalone constant export.', dependsOn: [s2Id] });
  assert.equal(selfDone.updated[0].effectiveStatus, 'cleared');
  assert.deepEqual(selfDone.updated[0].dependsOn, []);
  assert.equal(selfDone.warnings?.[0].code, 'self_dependency_ignored');

  // 2) Add probe p1 depending on s1, then mark s1 done depending on p1 -> unresolved 2-cycle.
  const added = addUltraProbes(dir, { titles: ['Verify a/p1 mutual guard'], sector: 'src', dependsOn: [s1Id] });
  const p1Id = added.added[0].id;
  const mutualDone = run(ULTRA_CLI, ['done', s1Id, '--depends-on', p1Id, '--note', 'Relies on p1 mutual check.', '--cwd', dir], dir);
  assert.equal(mutualDone.status, 0, mutualDone.stderr);
  assert.match(mutualDone.stdout, /shallow \(unverified-dependency\)/);
  assert.match(mutualDone.stdout, /Warning \[dependency-cycle\]:/);
  assert.match(mutualDone.stdout, /--depends-on none/);

  const midNextJson = JSON.parse(run(ULTRA_CLI, ['next', '--sector', 'src', '--max-slices', '10', '--cwd', dir, '--json'], dir).stdout);
  const scheduledP1 = midNextJson.batches.flatMap((b) => b.slices).find((s) => s.id === p1Id);
  assert.deepEqual(scheduledP1.dependencyCycle, [p1Id, s1Id, p1Id]);
  assert.match(scheduledP1.breakHint, new RegExp(`pinwhy-ultra done ${p1Id} --depends-on none`));

  const midNextText = run(ULTRA_CLI, ['next', '--sector', 'src', '--max-slices', '10', '--cwd', dir], dir).stdout;
  assert.match(midNextText, /\[cycle: p1->s1->p1; break with --depends-on none\]/);

  const midCheckJson = JSON.parse(run(ULTRA_CLI, ['check', '--cwd', dir, '--json'], dir).stdout);
  assert.equal(midCheckJson.summary.dependencyCycles, 1);
  assert.equal(midCheckJson.gaps.dependencyCycles[0].resolved, false);
  assert.deepEqual(midCheckJson.gaps.dependencyCycles[0].cycle, [p1Id, s1Id, p1Id]);
  assert.deepEqual(midCheckJson.gaps.shallowSlices.find((s) => s.id === s1Id)?.dependencyCycle, [s1Id, p1Id, s1Id]);
  const midCheckText = run(ULTRA_CLI, ['check', '--cwd', dir], dir).stdout;
  assert.match(midCheckText, /Dependency cycles \(non-blocking\):/);
  assert.match(midCheckText, /\(unresolved\)/);

  // 3) Marking p1 done converges both s1 and p1 (breadthComplete continues to converge cleanly) while retaining non-blocking notice.
  const p1Done = markUltraDone(dir, { sliceIds: [p1Id], note: 'Verified mutual invariant with s1.' });
  assert.equal(p1Done.updated[0].effectiveStatus, 'cleared');
  assert.equal(p1Done.warnings?.[0].code, 'dependency_cycle');
  assert.equal(p1Done.warnings?.[0].resolved, true);

  // Clear s3 as well to verify resolved cycle does not block breadthComplete.
  markUltraDone(dir, { sliceIds: [s3Id], note: 'Verified independent constant c.' });
  const convergedCheck = buildUltraSnapshot(dir);
  assert.equal(convergedCheck.breadthComplete, true);
  assert.equal(convergedCheck.gaps.dependencyCycles.length, 1);
  assert.equal(convergedCheck.gaps.dependencyCycles[0].resolved, true);

  // 4) Non-cyclic dependencies are preserved in formatBreakCycleCommand and --depends-on none,<keep>.
  markUltraDone(dir, { sliceIds: [p1Id], note: 'Also depends on cleared s2.', dependsOn: [s2Id] });
  const withKeepCheck = buildUltraSnapshot(dir);
  const p1Entry = withKeepCheck.slices.find((s) => s.id === p1Id);
  const breakCmd = formatBreakCycleCommand(p1Entry, [p1Id, s1Id]);
  assert.equal(breakCmd, `pinwhy-ultra done ${p1Id} --depends-on none,${s2Id} --note "<independent verification>"`);

  const clearedCycle = markUltraDone(dir, {
    sliceIds: [p1Id],
    dependsOn: ['none', s2Id],
    note: 'Broken mutual cycle while keeping guard s2.',
  });
  assert.deepEqual(clearedCycle.updated[0].dependsOn, [s2Id]);
  assert.equal(clearedCycle.warnings, undefined);
  assert.equal(buildUltraSnapshot(dir).gaps.dependencyCycles.length, 0);

  // 5) 3-node cycle across slices (s1 -> s2 -> s3 -> s1).
  markUltraDone(dir, { sliceIds: [s1Id], note: 'Depends on s2.', dependsOn: ['none', s2Id] });
  markUltraDone(dir, { sliceIds: [s2Id], note: 'Depends on s3.', dependsOn: [s3Id] });
  const triDone = markUltraDone(dir, { sliceIds: [s3Id], note: 'Depends back on s1.', dependsOn: [s1Id] });
  assert.equal(triDone.warnings?.[0].code, 'dependency_cycle');
  assert.deepEqual(triDone.warnings?.[0].cycle, [s1Id, s2Id, s3Id, s1Id]);
  assert.equal(triDone.warnings?.[0].resolved, true);
});
