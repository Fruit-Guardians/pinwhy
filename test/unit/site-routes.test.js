import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectImportSpecifiers } from '../../scripts/lib/esm-graph.mjs';
import {
  SITE_LANGS,
  SITE_PAGES,
  SITE_ROUTES,
  SITE_ROUTES_BY_KEY,
  parseSiteRoute,
  siteRouteUrl,
  siteTargetHref,
} from '../../site/src/routes.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('SITE_ROUTES covers every (page, lang) combination with symmetric zh/en pairs', () => {
  assert.deepEqual(SITE_LANGS, ['zh', 'en']);
  assert.deepEqual(SITE_PAGES, ['home', 'security', 'dsh']);
  assert.equal(SITE_ROUTES.length, SITE_PAGES.length * SITE_LANGS.length);

  const seenPaths = new Set();
  const seenKeys = new Set();
  for (const route of SITE_ROUTES) {
    assert.ok(!seenKeys.has(route.key), `duplicate route key: ${route.key}`);
    assert.ok(!seenPaths.has(route.path), `duplicate route path: ${route.path}`);
    seenKeys.add(route.key);
    seenPaths.add(route.path);
    assert.equal(SITE_ROUTES_BY_KEY[route.key], route);

    const mate = SITE_ROUTES_BY_KEY[route.pair];
    assert.ok(mate, `missing paired route for ${route.key}`);
    assert.equal(mate.pair, route.key);
    assert.equal(mate.page, route.page);
    assert.notEqual(mate.lang, route.lang);
    assert.ok(route.title && route.desc && route.selector && route.image);
  }
});

test('parseSiteRoute, siteRouteUrl, and siteTargetHref round-trip all routes and hash anchors', () => {
  for (const page of SITE_PAGES) {
    for (const lang of SITE_LANGS) {
      const url = siteRouteUrl(page, lang);
      assert.deepEqual(parseSiteRoute(url), { lang, page });
      assert.deepEqual(parseSiteRoute(url.replace(/\/$/, '') || '/'), { lang, page });
    }
  }
  assert.equal(siteTargetHref('home', 'zh'), '/');
  assert.equal(siteTargetHref('security', 'en'), '/en/security/');
  assert.equal(siteTargetHref('dsh', 'en'), '/en/dsh/');
  assert.equal(siteTargetHref('home#recovery', 'zh'), '/#recovery');
  assert.equal(siteTargetHref('home#recovery', 'en'), '/en/#recovery');
  assert.deepEqual(parseSiteRoute('/unknown/path'), { lang: 'zh', page: 'home' });
  assert.deepEqual(parseSiteRoute('/en/unknown'), { lang: 'en', page: 'home' });
});

test('both browser router and static prerender consume site/src/routes.mjs as SSOT', () => {
  const routerSpecs = collectImportSpecifiers(fs.readFileSync(path.join(ROOT, 'site/src/router.jsx'), 'utf8'));
  const prerenderSpecs = collectImportSpecifiers(fs.readFileSync(path.join(ROOT, 'site/scripts/prerender.mjs'), 'utf8'));
  assert.ok(routerSpecs.some((s) => s.specifier === './routes.mjs'));
  assert.ok(prerenderSpecs.some((s) => s.specifier === '../src/routes.mjs'));
});
