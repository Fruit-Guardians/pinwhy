#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PLUGIN = path.join(REPO, 'plugins', 'dsh-pinwhy');
const { chromium } = createRequire(path.join(PLUGIN, 'package.json'))('playwright');
const CLI = process.env.PINWHY_TEST_CLI || path.join(REPO, 'bin', 'pinwhy.js');
const OUT = path.join(REPO, 'site', '.captures', 'dsh');
const WEBP = path.join(REPO, 'site', 'public', 'shots');
const DSH = process.env.DSH_BIN || 'dsh';

// Capture marketing screenshots of the Pinwhy board inside a real DSH host,
// seeded with a readable audit logic graph (not the verify-viewer fan fixture).
//   PINWHY_TEST_CLI=$PWD/bin/pinwhy.js node site/scripts/capture-dsh.mjs
// Writes PNG under site/.captures/dsh/ and refreshes the site webp stills.

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pinwhy-dsh-site-'));
const project = path.join(fixture, 'project');
const other = path.join(fixture, 'other');
const env = { ...process.env, DSH_HOME: path.join(fixture, 'home'), DSH_TELEMETRY_DISABLED: '1' };
const run = (command, args) => exec(command, args, { env, timeout: 60_000, maxBuffer: 2_097_152 });
const pinwhy = async (cwd, args) => JSON.parse((await run(process.execPath, [CLI, ...args, `--cwd=${cwd}`, '--json'])).stdout);

async function seedStory(cwd) {
  await fs.mkdir(cwd, { recursive: true });
  await pinwhy(cwd, ['init', '--here', '--title=Internal API audit · DSH demo']);
  const add = async (kind, title, ...args) => (await pinwhy(cwd, ['node', 'add', kind, title, ...args, '--no-init'])).node;
  const link = (from, to, rel, ...extra) => pinwhy(cwd, ['link', from, to, `--rel=${rel}`, ...extra, '--no-init']);

  const start = await add('start', 'Entry: internal admin console', '--enter');
  const goalAuth = await add('goal', 'Map anonymous access on admin API');
  const goalTenant = await add('goal', 'Verify tenant isolation on export');
  await link(start.id, goalAuth.id, 'related-to');
  await link(start.id, goalTenant.id, 'related-to');

  const intent = await add('intent', 'Enumerate /api/v2 routes in the bundle', '--status=done');
  const obsBundle = await add('observation', 'Bundle exposes 47 admin routes', '--detail=Static extraction found 47 unique /api/v2/* paths');
  await link(intent.id, goalAuth.id, 'related-to');
  await link(obsBundle.id, intent.id, 'derived-from');

  const hyAuth = await add('hypothesis', 'Admin reads may skip shared auth', '--enter', '--reason=Formed after route enumeration');
  await link(obsBundle.id, hyAuth.id, 'supports');
  const obsUsers = await add('observation', 'GET /admin/users returns 200 anonymously', '--detail=Response includes total=12043 and roles', '--at=evidence/admin-users.http:12');
  const obsWrite = await add('observation', 'Write endpoints still return 403', '--detail=POST reset-password → 403');
  await link(obsUsers.id, hyAuth.id, 'supports');
  const fdAuth = await add('finding', 'Full user list exposed without auth', '--sev=critical', '--status=confirmed');
  await link(obsUsers.id, fdAuth.id, 'proves');
  await link(fdAuth.id, hyAuth.id, 'refines');
  await link(obsWrite.id, fdAuth.id, 'related-to');

  const qMiddleware = await add('question', 'Do read/write mounts differ?');
  await link(qMiddleware.id, hyAuth.id, 'derived-from');
  const hint = await add('hint', 'Compare router.get vs router.post middleware');
  await link(hint.id, qMiddleware.id, 'related-to');

  await pinwhy(cwd, ['cursor', goalTenant.id, '--reason=Switch to tenant isolation', '--no-init']);
  const action = await add('action', 'Swap tenantId as a low-privilege user', '--enter');
  await link(action.id, goalTenant.id, 'related-to');
  const obsExport = await add('observation', 'Export accepts any tenantId');
  await link(obsExport.id, action.id, 'derived-from');
  const fdExport = await add('finding', 'Cross-tenant export IDOR', '--sev=high', '--status=confirmed');
  await link(obsExport.id, fdExport.id, 'proves');

  const hyFiles = await add('hypothesis', 'Export files may be enumerable');
  await link(hyFiles.id, obsExport.id, 'derived-from');
  const obsJob = await add('observation', 'jobId is sequential; /exports/<id>.csv has no auth');
  await link(obsJob.id, hyFiles.id, 'supports');
  const fdFiles = await add('finding', 'Unauthenticated enumerable downloads', '--sev=high', '--status=confirmed');
  await link(obsJob.id, fdFiles.id, 'proves');

  const qUpload = await add('question', 'Can uploads chain with exports?', '--status=deferred');
  await link(fdExport.id, qUpload.id, 'related-to');
  await link(fdFiles.id, qUpload.id, 'related-to');
  const obsSvg = await add('observation', 'Upload accepts same-origin scriptable SVG');
  await link(obsSvg.id, qUpload.id, 'supports');
  const counter = await add('observation', 'Still needs an admin trigger path');
  await link(counter.id, qUpload.id, 'contradicts');

  await pinwhy(cwd, ['cursor', qUpload.id, '--reason=Park chaining until conditions change', '--no-init']);
  await pinwhy(cwd, ['checkpoint', '--summary=Three findings confirmed; paused on upload×export chaining.', '--no-init']);
  await pinwhy(cwd, ['edit', fdAuth.id, '--confidence=reproduced', '--no-init']);
  await pinwhy(cwd, ['edit', hyAuth.id, '--status=confirmed', '--no-init']);

  const hyCsrf = await add('hypothesis', 'CSRF on admin writes may be uneven', '--agent=agent:research', `--to=${goalAuth.id}`, '--rel=answers', '--enter');
  await add('observation', 'POST /admin/roles skips CSRF token', '--agent=agent:research', `--to=${hyCsrf.id}`, '--rel=supports', '--tag=csrf');
  await pinwhy(cwd, ['checkpoint', '--summary=Side branch: CSRF awaits reproduction.', '--agent=agent:research', '--no-init']);

  return { focus: qUpload.title, finding: fdAuth.title };
}

async function toWebp(src, dest, quality = 88) {
  await exec('cwebp', ['-q', String(quality), src, '-o', dest]);
}

async function waitForScene3D(frame, page) {
  await frame().waitForFunction(() => {
    const canvas = document.querySelector('[aria-label="2.5D sandbox"] canvas');
    if (!canvas?.width || !canvas.height) return false;
    const sample = document.createElement('canvas'); sample.width = 64; sample.height = 64;
    const context = sample.getContext('2d'); context.drawImage(canvas, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data; const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return colors.size > 8;
  });
  // Allow BOOT_SECONDS (1.1s) chip rise and camera dive to finish cleanly.
  await page.waitForTimeout(2600);
}

let host, browser, page, logs = '';
try {
  const story = await seedStory(project);
  await fs.mkdir(other, { recursive: true });
  await pinwhy(other, ['init', '--here']);
  await pinwhy(other, ['node', 'add', 'fact', 'Separate project memory', '--no-init']);

  const observer = path.join(fixture, 'observer.mjs');
  await fs.writeFile(observer, `
export const name = 'pinwhy-canvas-site';
export const inject = ['appReady', 'workspaceRegistry', 'sessionController', 'sessions', 'sessionTitle'];
export function apply(ctx, config) {
  ctx.effect(() => ctx.appReady.onReady(() => {
    (async () => {
      const otherWorkspace = await ctx.workspaceRegistry.create(config.other, 'Other project');
      const projectWorkspace = await ctx.workspaceRegistry.create(config.project, 'API audit');
      for (const [id, workspace, title] of [['pinwhy-site-one', projectWorkspace, 'Admin API session'], ['pinwhy-site-two', otherWorkspace, 'Other conversation']]) {
        const { sessionId } = await ctx.sessionController.create({ sessionId: id, workspaceId: workspace.id });
        const session = ctx.sessions.get(sessionId);
        await ctx.sessionTitle.rename(session, title);
        session.append('turn/start', { turn: 0 });
        session.append('step/start', { turn: 0, step: 0 });
        session.append('user/message', { id: id + '-message', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Continue the admin API audit from the saved board.' }] }, { surfaceOp: 'append' });
        session.append('step/end', { turn: 0, step: 0 });
        session.append('turn/end', { turn: 0, reason: { kind: 'completed' } });
        await ctx.sessions.flush(session);
      }
      console.log('PINWHY_CANVAS_SITE_READY');
    })().catch(error => console.error(error));
  }));
}
`);
  const overlay = path.join(fixture, 'site.patch.yml');
  await fs.writeFile(overlay, JSON.stringify([
    { id: 'pinwhy', config: { runtimeCli: CLI, projects: [{ workspace: project }, { workspace: other }], autoDiscover: false } },
    { insert: [{ id: 'pinwhy-canvas-site', name: observer, config: { project, other } }] },
  ]));

  await run(DSH, ['plugin', '--profile', 'web', 'add', PLUGIN, '--ignore-scripts', '--config.auto-install-peers=false']);
  host = spawn(DSH, ['--profile', 'web', '--patch', overlay, '--no-open', '--port=0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH startup timed out:\n${logs}`)), 60_000);
    const consume = (chunk) => {
      logs += chunk.toString();
      const url = logs.match(/https?:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
      if (url && logs.includes('PINWHY_CANVAS_SITE_READY')) { clearTimeout(timer); resolve(url); }
    };
    host.stdout.on('data', consume);
    host.stderr.on('data', consume);
    host.once('error', reject);
    host.once('exit', (code) => { clearTimeout(timer); reject(new Error(`DSH exited ${code}:\n${logs}`)); });
  });
  const url = await ready;

  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  }
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(20000);
  await page.goto(url);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('dialog', { name: 'Get started', exact: true }).getByRole('button').first().click();
  await page.locator('[data-sidebar-scrollport]').getByText('API audit', { exact: true }).click();
  await page.locator('[data-sidebar-scrollport]').getByText('Admin API session', { exact: true }).click();

  await fs.mkdir(OUT, { recursive: true });

  // Global board — dense authored logic graph (light).
  await page.locator('nav button[aria-haspopup="menu"]').first().click();
  await page.locator('[data-pinwhy-global-entry]').waitFor();
  await page.locator('[data-pinwhy-global-entry]').press('Enter');
  const iframe = page.frameLocator('iframe[data-pinwhy-viewer]');
  await iframe.locator('.react-flow__node').first().waitFor();
  const frame = () => page.frames().find((f) => f.url().includes('/pinwhy-viewer/'));
  await iframe.getByLabel('Logic view', { exact: true }).click();
  await iframe.getByLabel('Fit to screen', { exact: true }).click();
  await frame().waitForFunction(() => {
    const viewport = document.querySelector('.react-flow__viewport');
    return viewport && new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a >= 0.35;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'dsh-global-board.png'), fullPage: true });

  // Session board: 2D light, 3D light + dark, then 2D dark.
  // Use dispatchEvent('click') inside the conversation pane because DSH's outer width handle overlays the iframe edge.
  const tap = (loc) => loc.dispatchEvent('click');
  await page.locator('[data-sidebar-scrollport]').getByText('Admin API session', { exact: true }).click();
  await page.getByRole('button', { name: 'More conversation views', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Pinwhy Board', exact: true }).click();
  await iframe.locator('.react-flow__edge').first().waitFor();
  await tap(iframe.getByLabel('Logic view', { exact: true }));
  await tap(iframe.getByLabel('Fit to screen', { exact: true }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'dsh-canvas.png'), fullPage: true });

  // Switch to Context view before entering 2.5D so the focused chip lids and gem fill the frame clearly.
  await tap(iframe.getByLabel('Context view', { exact: true }));
  await tap(iframe.getByLabel('Fit to screen', { exact: true }));
  await page.waitForTimeout(700);
  await tap(iframe.locator('[data-scene3d-trigger]'));
  await iframe.getByRole('button', { name: 'Back to the flat canvas', exact: true }).waitFor();
  await waitForScene3D(frame, page);
  await page.screenshot({ path: path.join(OUT, 'dsh-canvas-3d-light.png'), fullPage: true });

  await page.emulateMedia({ colorScheme: 'dark' });
  await frame().waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, 'dsh-canvas-3d-dark.png'), fullPage: true });

  await tap(iframe.getByRole('button', { name: 'Back to the flat canvas', exact: true }));
  await tap(iframe.getByLabel('Logic view', { exact: true }));
  await tap(iframe.getByLabel('Fit to screen', { exact: true }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'dsh-canvas-dark.png'), fullPage: true });

  await toWebp(path.join(OUT, 'dsh-global-board.png'), path.join(WEBP, 'dsh-canvas-light.webp'));
  await toWebp(path.join(OUT, 'dsh-canvas-dark.png'), path.join(WEBP, 'dsh-canvas-dark.webp'));
  await toWebp(path.join(OUT, 'dsh-canvas-3d-light.png'), path.join(WEBP, 'dsh-canvas-3d-light.webp'), 86);
  await toWebp(path.join(OUT, 'dsh-canvas-3d-dark.png'), path.join(WEBP, 'dsh-canvas-3d-dark.webp'), 86);
  await fs.copyFile(path.join(WEBP, 'dsh-canvas-3d-dark.webp'), path.join(WEBP, 'dsh-canvas-3d.webp'));

  assert.ok(story.focus);
  console.log(`DSH site shots refreshed → ${path.relative(REPO, WEBP)} (logic story: ${story.finding})`);
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  if (host && host.exitCode === null) {
    const closed = new Promise((resolve) => host.once('exit', resolve));
    host.kill('SIGTERM');
    const escalation = setTimeout(() => host.kill('SIGKILL'), 3000);
    await closed; clearTimeout(escalation);
  }
  await fs.rm(fixture, { recursive: true, force: true });
}
