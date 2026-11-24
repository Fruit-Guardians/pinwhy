#!/usr/bin/env node
// Captures real workspace UI directly from a live ephemeral `pinwhy serve` instance.
//   node site/scripts/capture.mjs
// Uses locally installed Chrome; every image comes from the real product in light and dark mode.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createDemoDir } from './make-demo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO, 'bin', 'pinwhy.js');
const OUT = path.resolve(HERE, '..', 'public', 'shots');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABEL = {
  zh: {
    collapseNav: '收起导航',
    fit: '适应画布',
    agent: 'Agent 视角',
    digest: '现场摘要',
    layout: '正在排版',
    scene3d: '2.5D 沙盘',
    cpText: '已确认三个发现',
  },
  en: {
    collapseNav: 'Collapse navigation',
    fit: 'Fit to screen',
    agent: 'Agent view',
    digest: 'Context digest',
    layout: 'Laying out',
    scene3d: '2.5D sandbox',
    cpText: 'Three findings confirmed',
  },
};

function startServe(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [CLI, 'serve', '--cwd', cwd, '--ephemeral', '--read-only', '--port', '0', '--json'],
      { cwd: REPO, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let buf = '';
    let err = '';
    const timer = setTimeout(() => reject(new Error(`pinwhy serve timed out:\n${err || buf}`)), 15000);
    const cleanup = () => clearTimeout(timer);

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const line = buf.split('\n').find((l) => l.trim().startsWith('{'));
      if (!line) return;
      try {
        const parsed = JSON.parse(line);
        if (parsed.url) {
          cleanup();
          resolve({ url: parsed.url.replace(/\/$/, ''), child });
        }
      } catch {
        // Wait for the full JSON line.
      }
    });
    child.stderr.on('data', (chunk) => { err += chunk.toString(); });
    child.once('error', (e) => { cleanup(); reject(e); });
    child.once('exit', (code) => { cleanup(); reject(new Error(`pinwhy serve exited ${code}:\n${err || buf}`)); });
  });
}

async function stopServe(child, dir) {
  if (child && !child.killed) {
    try { child.stdin?.end(); } catch { /* ignore */ }
    child.kill('SIGTERM');
    await new Promise((r) => {
      const t = setTimeout(r, 1000);
      child.once('exit', () => { clearTimeout(t); r(); });
    });
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

async function open(baseUrl, lang, theme, query, { dpr = 1.5, reduced = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: dpr });
  const features = [{ name: 'prefers-color-scheme', value: theme }];
  if (reduced) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  await page.emulateMediaFeatures(features);
  await page.evaluateOnNewDocument((t, l) => {
    localStorage.setItem('pinwhy-theme-v3', t);
    localStorage.setItem('pinwhy-pref-locale', JSON.stringify(l));
    // Avoid overwriting first-paint query state, but ensure clean prefs.
    localStorage.removeItem('pinwhy-scene3d');
  }, theme, lang === 'zh' ? 'zh-CN' : 'en');
  await page.goto(`${baseUrl}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(
    (t) => document.body && document.body.innerText.trim().length > 20 && !document.body.innerText.includes(t),
    { timeout: 15000 },
    LABEL[lang].layout,
  );
  await sleep(1000);
  return page;
}

const clipOf = (page, selector, pad = 0) => page.$eval(selector, (el, p) => {
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + p * 2, height: r.height + p * 2 };
}, pad);

async function collapseSidebar(page, L) {
  const btn = await page.$(`button[aria-label="${L.collapseNav}"]`);
  if (btn) {
    await btn.click();
    await sleep(300);
  }
}

async function waitForScene3D(page, L) {
  await page.waitForSelector(`[aria-label="${L.scene3d}"] canvas`, { timeout: 15000 });
  await page.waitForFunction((label) => {
    const canvas = document.querySelector(`[aria-label="${label}"] canvas`);
    if (!canvas?.width || !canvas.height) return false;
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 64;
    const ctx = sample.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return colors.size > 8;
  }, { timeout: 15000 }, L.scene3d);
  await sleep(1800);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--lang=zh-CN',
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

try {
  for (const lang of ['zh', 'en']) {
    const L = LABEL[lang];
    const { dir } = createDemoDir(lang);
    const { url: baseUrl, child } = await startServe(dir);
    console.log(`serving demo (${lang}) at ${baseUrl}`);

    try {
      for (const theme of ['light', 'dark']) {
        const name = (n) => `${n}-${lang}-${theme}`;

        // 1. Digest with real live checkpoint diff selected (no offline unavailability notice).
        {
          const page = await open(baseUrl, lang, theme, 'view=context', { dpr: 2 });
          await page.click(`button[aria-label="${L.digest}"]`);
          await page.waitForSelector('[role="dialog"] select');
          await page.select('[role="dialog"] select', 'cp1');
          await page.waitForFunction((needle) => {
            const dlg = document.querySelector('[role="dialog"]');
            return dlg && dlg.innerText.includes(needle);
          }, { timeout: 10000 }, L.cpText);
          await sleep(500);
          const box = await clipOf(page, '[role="dialog"]');
          await page.screenshot({ path: path.join(OUT, `${name('digest')}.webp`), type: 'webp', quality: 90, clip: box, captureBeyondViewport: false });
          console.log('saved', name('digest'));
          await page.close();
        }

        // 2. Agent perspectives: full topbar unclipped + research cursor + Agent menu.
        {
          const page = await open(baseUrl, lang, theme, 'view=context&agent=agent:research', { dpr: 1.5 });
          await collapseSidebar(page, L);
          await page.click(`button[aria-label="${L.fit}"]`);
          await sleep(800);
          await page.click(`button[aria-label="${L.agent}"]`);
          await sleep(500);
          await page.screenshot({ path: path.join(OUT, `${name('agents')}.webp`), type: 'webp', quality: 88 });
          console.log('saved', name('agents'));
          await page.close();
        }

        // 3. Inspector + illuminated 1-hop graph: uncropped full-height workspace shot.
        {
          const page = await open(baseUrl, lang, theme, 'view=logic&node=fd1', { dpr: 1.5 });
          await collapseSidebar(page, L);
          await page.click(`button[aria-label="${L.fit}"]`);
          await sleep(900);
          await page.screenshot({ path: path.join(OUT, `${name('inspector')}.webp`), type: 'webp', quality: 88 });
          console.log('saved', name('inspector'));
          await page.close();
        }

        // 4. Stage flat, audit & ultra views.
        for (const [view, query, fit] of [
          ['context', 'view=context', true],
          ['audit', 'workspace=audit&issue=g1&candidate=fd1', false],
          ['ultra', 'workspace=ultra', false],
          ['logic', 'view=logic', true],
          ['all', 'view=all', true],
        ]) {
          const page = await open(baseUrl, lang, theme, query, { dpr: 1.5 });
          if (fit) {
            await page.click(`button[aria-label="${L.fit}"]`);
            await sleep(800);
          } else if (view === 'ultra') {
            await page.waitForSelector('.ultra-constellation-stage svg', { timeout: 15000 });
            await sleep(700);
          }
          await sleep(400);
          await page.screenshot({ path: path.join(OUT, `stage-${view}-${lang}-${theme}.webp`), type: 'webp', quality: 86 });
          console.log('saved', `stage-${view}-${lang}-${theme}`);
          await page.close();
        }

        // 5. Real 2.5D WebGL board (ceramic light / obsidian dark).
        {
          const page = await open(baseUrl, lang, theme, 'view=context', { dpr: 1.5, reduced: true });
          await collapseSidebar(page, L);
          await page.click(`button[aria-label="${L.fit}"]`);
          await sleep(600);
          await page.click('[data-scene3d-trigger]');
          await waitForScene3D(page, L);
          await page.evaluate(() => document.activeElement?.blur());
          await page.mouse.move(640, 20);
          await sleep(250);
          await page.screenshot({ path: path.join(OUT, `stage-board-${lang}-${theme}.webp`), type: 'webp', quality: 88 });
          console.log('saved', `stage-board-${lang}-${theme}`);
          await page.close();
        }
      }
    } finally {
      await stopServe(child, dir);
    }
  }
} finally {
  await browser.close();
}
