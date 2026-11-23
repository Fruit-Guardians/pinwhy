#!/usr/bin/env node
// Prerenders the built site into static HTML per language and route, with SEO and social metadata.
//   SITE_URL=https://your.domain npm --prefix site run build
// Writes dist/index.html (中文) and dist/en/index.html (English), plus /security/ and /dsh/ subpages;
// with SITE_URL also sitemap.xml and robots.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { SITE_ROUTES, SITE_ROUTES_BY_KEY } from '../src/routes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const DIST = path.join(SITE, 'dist');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const VERSION = JSON.parse(fs.readFileSync(path.join(SITE, '..', 'package.json'), 'utf8')).version;
const REPO = 'https://github.com/Fruit-Guardians/pinwhy';

if (!SITE_URL) console.warn('⚠ SITE_URL is not set: canonical, hreflang and og:url fall back to relative paths and no sitemap is written.');
const abs = (p) => (SITE_URL ? SITE_URL + p : p);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(p) {
  const pair = SITE_ROUTES_BY_KEY[p.pair];
  const zhPath = p.htmlLang === 'zh-CN' ? p.path : pair.path;
  const enPath = p.htmlLang === 'en' ? p.path : pair.path;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Pinwhy',
    description: p.desc,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Windows, Linux',
    softwareVersion: VERSION,
    softwareRequirements: 'Node.js >= 18',
    license: 'https://opensource.org/licenses/MIT',
    url: abs(p.path),
    sameAs: [REPO],
    image: abs(p.image),
    inLanguage: p.htmlLang,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return [
    `<link rel="canonical" href="${abs(p.path)}" />`,
    `<link rel="alternate" hreflang="zh-CN" href="${abs(zhPath)}" />`,
    `<link rel="alternate" hreflang="en" href="${abs(enPath)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${abs(zhPath)}" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Pinwhy" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.desc)}" />`,
    `<meta property="og:url" content="${abs(p.path)}" />`,
    `<meta property="og:image" content="${abs(p.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(p.title)}" />`,
    `<meta property="og:locale" content="${p.ogLocale}" />`,
    `<meta property="og:locale:alternate" content="${pair.ogLocale}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.desc)}" />`,
    `<meta name="twitter:image" content="${abs(p.image)}" />`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const bodies = new Map();

if (fs.existsSync(CHROME)) {
  const server = await preview({ root: SITE, logLevel: 'error', preview: { port: 4317 + 100, strictPort: false, open: false } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });

  try {
    for (const p of SITE_ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }]);
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('pinwhy-site-theme', 'system'); } catch { /* ignore */ } });
      await page.goto(base + p.path, { waitUntil: 'networkidle0' });
      await page.waitForSelector(p.selector || '#hero-title');
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 600));
      const body = await page.evaluate(() => {
        const root = document.getElementById('root').cloneNode(true);
        root.querySelectorAll('iframe, canvas, .toast').forEach((n) => n.remove());
        // Reveal-on-scroll content stays visible in the static HTML.
        root.querySelectorAll('.rv').forEach((n) => n.classList.add('in'));
        return root.innerHTML;
      });
      await page.close();
      bodies.set(p.key, body);
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
} else {
  console.log(`ℹ Chrome not found at "${CHROME}". Writing route shells with SEO metadata without DOM prerendering.`);
}

for (const p of SITE_ROUTES) {
  let html = template
    .replace(/<html lang="[^"]*">/, `<html lang="${p.htmlLang}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(p.desc)}" />`)
    .replace(/<!--\s*seo-head-start\s*-->[\s\S]*?<!--\s*seo-head-end\s*-->/, head(p));
  const body = bodies.get(p.key);
  if (body) {
    html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  }
  const out = path.join(DIST, p.path, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${body ? 'prerendered' : 'wrote route shell'} ${path.relative(SITE, out)} (${(html.length / 1024).toFixed(0)} KB)`);
}

if (SITE_URL) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = SITE_ROUTES.map((p) => `  <url>
    <loc>${abs(p.path)}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${abs(p.htmlLang === 'zh-CN' ? p.path : SITE_ROUTES_BY_KEY[p.pair].path)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${abs(p.htmlLang === 'en' ? p.path : SITE_ROUTES_BY_KEY[p.pair].path)}" />
  </url>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log('wrote sitemap.xml and robots.txt');
}
