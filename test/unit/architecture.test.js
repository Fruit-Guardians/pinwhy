import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArchitecture } from '../../scripts/checks/check-architecture.mjs';
import { assertCoreDependencyClosure } from '../../scripts/packaging/pack-packages.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function writeTree(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(base, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
}

test('repository satisfies every architectural boundary, DAG, and SDK closure rule', () => {
  const result = checkArchitecture(ROOT);
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.deepEqual(result.violations, []);
  assert.ok(result.stats.coreFiles >= 70);
  assert.ok(result.stats.webFiles >= 140);
  assert.ok(result.stats.siteFiles >= 20);
  assert.equal(result.stats.sdkClosureFiles, 19);
});

test('assertCoreDependencyClosure detects missing transitive files, bare imports, and unsafe model imports', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pinwhy-sdk-closure-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  const manifest = {
    exports: {
      '.': './lib/core.js',
      './model': './lib/domain/model.js',
      './package.json': './package.json',
    },
  };

  writeTree(base, {
    'lib/domain/model.js': 'export const EVENT_VERSION = 1;\n',
    'lib/queries/helper.js': 'import { EVENT_VERSION } from "../domain/model.js";\nexport const V = EVENT_VERSION;\n',
    'lib/core.js': 'export { V } from "./queries/helper.js";\nexport { EVENT_VERSION } from "./domain/model.js";\n',
  });

  // Missing helper.js from coreFiles list fails cleanly.
  assert.throws(
    () => assertCoreDependencyClosure(base, manifest, ['core.js', 'domain/model.js']),
    /missing from CORE_FILES/,
  );

  // Full list passes.
  const ok = assertCoreDependencyClosure(base, manifest, ['core.js', 'domain/model.js', 'queries/helper.js']);
  assert.deepEqual(ok.checkedFiles, ['core.js', 'domain/model.js', 'queries/helper.js']);

  // Bare npm package import fails cleanly.
  fs.writeFileSync(path.join(base, 'lib/queries/helper.js'), 'import x from "left-pad";\nexport const V = x;\n');
  assert.throws(
    () => assertCoreDependencyClosure(base, manifest, ['core.js', 'domain/model.js', 'queries/helper.js']),
    /must not import bare package/,
  );

  // Importing anything inside domain/model.js violates browser safety.
  fs.writeFileSync(path.join(base, 'lib/queries/helper.js'), 'export const V = 1;\n');
  fs.writeFileSync(path.join(base, 'lib/domain/model.js'), 'import fs from "node:fs";\nexport { fs };\n');
  assert.throws(
    () => assertCoreDependencyClosure(base, manifest, ['core.js', 'domain/model.js', 'queries/helper.js']),
    /must have 0 imports/,
  );
});

test('checkArchitecture catches domain boundary leaks, web node: imports, and circular imports', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pinwhy-arch-fixture-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  writeTree(base, {
    'package.json': JSON.stringify({ name: 'pinwhy', version: '0.2.0' }),
    'packages/pinwhy-core/package.json': JSON.stringify({
      name: 'pinwhy-core',
      exports: { '.': './lib/core.js', './model': './lib/domain/model.js' },
    }),
    'lib/domain/model.js': 'export const EVENT_VERSION = 1;\n',
    'lib/domain/receipts.js': 'import fs from "node:fs";\nexport const f = fs;\n',
    'lib/core.js': 'export { EVENT_VERSION } from "./domain/model.js";\n',
    'web/src/bad.ts': 'import path from "node:path";\nexport const p = path;\n',
    'site/src/routes.mjs': 'export const SITE_ROUTES = [];\n',
    'site/src/router.jsx': 'import { SITE_ROUTES } from "./routes.mjs";\nimport { b } from "./b.jsx";\nexport const r = [SITE_ROUTES, b];\n',
    'site/src/b.jsx': 'import { r } from "./router.jsx";\nexport const b = r;\n',
    'site/scripts/prerender.mjs': 'export const ok = true;\n',
  });

  const result = checkArchitecture(base);
  assert.equal(result.ok, false);
  const rules = new Set(result.violations.map((v) => v.rule));
  assert.ok(rules.has('domain-purity'));
  assert.ok(rules.has('workbench-boundary'));
  assert.ok(rules.has('site-routes-ssot'));
  assert.ok(rules.has('no-import-cycles'));
  assert.ok(rules.has('sdk-closure'));
});

test('checkArchitecture resolves tsconfig/vite @/ aliases to catch aliased cycles and boundary escapes', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pinwhy-arch-alias-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  writeTree(base, {
    'package.json': JSON.stringify({ name: 'pinwhy', version: '0.2.0' }),
    'packages/pinwhy-core/package.json': JSON.stringify({
      name: 'pinwhy-core',
      exports: { '.': './lib/core.js', './model': './lib/domain/model.js' },
    }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./web/src/*'] } } }),
    'lib/domain/model.js': 'export const EVENT_VERSION = 1;\n',
    'lib/core.js': 'export { EVENT_VERSION } from "./domain/model.js";\n',
    'lib/store.js': 'export const s = 1;\n',
    'web/src/a.ts': 'import { b } from "@/b";\nexport const a = b;\n',
    'web/src/b.ts': 'import { a } from "./a";\nimport { s } from "@/../../lib/store.js";\nexport const b = [a, s];\n',
    'site/vite.config.js': "export default { resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } };\n",
    'site/src/routes.mjs': 'export const SITE_ROUTES = [];\n',
    'site/src/router.jsx': 'import { SITE_ROUTES } from "@/routes.mjs";\nexport const r = SITE_ROUTES;\n',
    'site/scripts/prerender.mjs': 'import { SITE_ROUTES } from "../src/routes.mjs";\nexport const p = SITE_ROUTES;\n',
  });

  const result = checkArchitecture(base);
  assert.equal(result.ok, false);
  const webCycle = result.violations.find((v) => v.rule === 'no-import-cycles' && v.file.startsWith('web/src/'));
  assert.ok(webCycle, 'aliased cycle in web/src must be flagged');
  assert.match(webCycle.detail, /web\/src\/a\.ts.*web\/src\/b\.ts.*web\/src\/a\.ts/);
  const escapedBoundary = result.violations.find((v) => v.rule === 'workbench-boundary' && v.file === 'web/src/b.ts');
  assert.ok(escapedBoundary, 'aliased boundary escape into lib/store.js must be flagged');
  assert.equal(result.violations.some((v) => v.rule === 'site-routes-ssot'), false, 'site alias @/routes.mjs resolves to site/src/routes.mjs');
});
