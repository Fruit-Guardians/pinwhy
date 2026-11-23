#!/usr/bin/env node
// Repository architectural guardrails: layer boundaries, SDK closure, route SSOT, and DAGs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectImportSpecifiers,
  collectSourceFiles,
  findImportCycles,
  loadTsconfigAliases,
  loadViteAliases,
  resolveModulePath,
  resolveSpecifierBase,
} from '../lib/esm-graph.mjs';
import { assertCoreDependencyClosure, CORE_FILES } from '../packaging/pack-packages.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const posixRel = (from, to) => path.relative(from, to).replaceAll('\\', '/');
const isWithin = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);

function resolveTarget(fromFile, specifier, root, aliases = {}) {
  const resolved = resolveModulePath(fromFile, specifier, { aliases })
    || resolveSpecifierBase(fromFile, specifier, { aliases });
  if (!resolved) return null;
  return posixRel(root, resolved);
}

/** Validate module boundaries, domain purity, route SSOT, DAGs, and zero-dependency SDK closure. */
export function checkArchitecture(root = ROOT) {
  root = fs.realpathSync(path.resolve(root));
  const violations = [];
  const add = (rule, file, detail) => violations.push({ rule, file, detail });
  const webAliases = {
    ...loadViteAliases(path.join(root, 'vite.config.js')),
    ...loadTsconfigAliases(path.join(root, 'tsconfig.json')),
  };
  if (Object.keys(webAliases).length === 0) webAliases['@/'] = path.join(root, 'web/src');
  const siteAliases = {
    ...loadViteAliases(path.join(root, 'site/vite.config.js')),
    ...loadTsconfigAliases(path.join(root, 'site/tsconfig.json')),
  };
  if (Object.keys(siteAliases).length === 0) siteAliases['@/'] = path.join(root, 'site/src');

  // 1. Domain layer purity: model.js has 0 imports; domain/*.js never imports fs/child_process/http/net/non-domain local modules.
  const modelFile = path.join(root, 'lib/domain/model.js');
  if (!fs.existsSync(modelFile)) {
    add('domain-purity', 'lib/domain/model.js', 'missing canonical browser-safe domain model');
  } else {
    const modelImports = collectImportSpecifiers(fs.readFileSync(modelFile, 'utf8'));
    if (modelImports.length > 0) {
      add('domain-purity', 'lib/domain/model.js', `must have 0 imports (found ${modelImports.map((s) => s.specifier).join(', ')})`);
    }
  }

  for (const file of collectSourceFiles(['lib/domain'], root)) {
    const relFile = posixRel(root, file);
    for (const { specifier } of collectImportSpecifiers(fs.readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('node:')) {
        if (specifier !== 'node:crypto') {
          add('domain-purity', relFile, `forbidden Node builtin "${specifier}" inside lib/domain/`);
        }
        continue;
      }
      if (!specifier.startsWith('.')) {
        add('domain-purity', relFile, `forbidden package import "${specifier}" inside lib/domain/`);
        continue;
      }
      const targetRel = resolveTarget(file, specifier, root);
      if (!targetRel || !isWithin(targetRel, 'lib/domain')) {
        add('domain-purity', relFile, `cannot import "${targetRel || specifier}" outside lib/domain/`);
      }
    }
  }

  // 2. Core runtime isolation: bin/ + lib/ never import web/, site/, plugins/, scripts/, test/.
  for (const file of collectSourceFiles(['bin', 'lib'], root)) {
    const relFile = posixRel(root, file);
    for (const { specifier } of collectImportSpecifiers(fs.readFileSync(file, 'utf8'))) {
      const targetRel = resolveTarget(file, specifier, root);
      if (!targetRel) continue;
      if (!isWithin(targetRel, 'bin') && !isWithin(targetRel, 'lib')) {
        add('core-isolation', relFile, `runtime file imports non-core target "${targetRel}"`);
      }
    }
  }

  // 3. Workbench boundary: web/src/ never imports node:*, site/, plugins/, scripts/, or lib/ (except domain/model.js).
  for (const file of collectSourceFiles(['web/src'], root)) {
    const relFile = posixRel(root, file);
    for (const { specifier } of collectImportSpecifiers(fs.readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('node:')) {
        add('workbench-boundary', relFile, `browser source imports "${specifier}"`);
        continue;
      }
      const targetRel = resolveTarget(file, specifier, root, webAliases);
      if (!targetRel) continue;
      if (
        (isWithin(targetRel, 'lib') && targetRel !== 'lib/domain/model.js') ||
        isWithin(targetRel, 'bin') ||
        isWithin(targetRel, 'site') ||
        isWithin(targetRel, 'plugins') ||
        isWithin(targetRel, 'scripts') ||
        isWithin(targetRel, 'test')
      ) {
        add('workbench-boundary', relFile, `workbench imports disallowed target "${targetRel}"`);
      }
    }
  }

  // 4. Website boundary: site/src/ never imports web/, lib/, bin/, plugins/.
  for (const file of collectSourceFiles(['site/src'], root)) {
    const relFile = posixRel(root, file);
    for (const { specifier } of collectImportSpecifiers(fs.readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('node:')) {
        add('site-boundary', relFile, `browser site source imports "${specifier}"`);
        continue;
      }
      const targetRel = resolveTarget(file, specifier, root, siteAliases);
      if (!targetRel) continue;
      if (
        isWithin(targetRel, 'web') ||
        isWithin(targetRel, 'lib') ||
        isWithin(targetRel, 'bin') ||
        isWithin(targetRel, 'plugins')
      ) {
        add('site-boundary', relFile, `website imports disallowed target "${targetRel}"`);
      }
    }
  }

  // 5. DSH adapter boundary: plugins/dsh-pinwhy/{src,client,scripts,test}/ never imports root lib/, web/, site/, or pinwhy-core/pinwhy packages.
  for (const file of collectSourceFiles(
    ['plugins/dsh-pinwhy/src', 'plugins/dsh-pinwhy/client', 'plugins/dsh-pinwhy/scripts', 'plugins/dsh-pinwhy/test'],
    root,
  )) {
    const relFile = posixRel(root, file);
    for (const { specifier } of collectImportSpecifiers(fs.readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) {
        if (specifier === 'pinwhy' || specifier.startsWith('pinwhy/') || specifier === 'pinwhy-core' || specifier.startsWith('pinwhy-core/')) {
          add('plugin-boundary', relFile, `DSH plugin must invoke CLI rather than importing "${specifier}"`);
        }
        continue;
      }
      const targetRel = resolveTarget(file, specifier, root);
      if (!targetRel) continue;
      if (isWithin(targetRel, 'lib') || isWithin(targetRel, 'web') || isWithin(targetRel, 'site')) {
        add('plugin-boundary', relFile, `DSH plugin imports disallowed target "${targetRel}"`);
      }
    }
  }

  // 6. Site routes SSOT: both router.jsx and prerender.mjs import site/src/routes.mjs.
  const routesRel = 'site/src/routes.mjs';
  if (!fs.existsSync(path.join(root, routesRel))) {
    add('site-routes-ssot', routesRel, 'missing site route manifest');
  } else {
    for (const consumer of ['site/src/router.jsx', 'site/scripts/prerender.mjs']) {
      const full = path.join(root, consumer);
      if (!fs.existsSync(full)) {
        add('site-routes-ssot', consumer, 'missing route consumer file');
        continue;
      }
      const targets = collectImportSpecifiers(fs.readFileSync(full, 'utf8'))
        .map((entry) => resolveTarget(full, entry.specifier, root, siteAliases))
        .filter(Boolean);
      if (!targets.includes(routesRel)) {
        add('site-routes-ssot', consumer, `must import ${routesRel}`);
      }
    }
  }

  // 7. Zero circular dependencies inside each runtime/frontend/site module graph.
  const coreDag = findImportCycles(collectSourceFiles(['bin', 'lib'], root), root);
  for (const cycle of coreDag.cycles) {
    add('no-import-cycles', cycle[0], `circular dependency in core: ${cycle.join(' -> ')}`);
  }
  const webDag = findImportCycles(collectSourceFiles(['web/src'], root), root, { aliases: webAliases });
  for (const cycle of webDag.cycles) {
    add('no-import-cycles', cycle[0], `circular dependency in web: ${cycle.join(' -> ')}`);
  }
  const siteDag = findImportCycles(collectSourceFiles(['site/src'], root), root, { aliases: siteAliases });
  for (const cycle of siteDag.cycles) {
    add('no-import-cycles', cycle[0], `circular dependency in site: ${cycle.join(' -> ')}`);
  }

  // 8. Zero runtime dependencies and transitive SDK dependency closure.
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (Object.keys(rootPkg.dependencies || {}).length > 0) {
    add('zero-runtime-deps', 'package.json', 'root pinwhy package must declare zero runtime dependencies');
  }
  const corePkgPath = path.join(root, 'packages/pinwhy-core/package.json');
  const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8'));
  if (Object.keys(corePkg.dependencies || {}).length > 0) {
    add('zero-runtime-deps', 'packages/pinwhy-core/package.json', 'pinwhy-core SDK must declare zero runtime dependencies');
  }
  let sdkClosureFiles = 0;
  try {
    sdkClosureFiles = assertCoreDependencyClosure(root, corePkg, CORE_FILES).checkedFiles.length;
  } catch (error) {
    add('sdk-closure', 'packages/pinwhy-core/package.json', error.message);
  }

  return {
    ok: violations.length === 0,
    violations,
    stats: {
      coreFiles: coreDag.fileCount,
      webFiles: webDag.fileCount,
      siteFiles: siteDag.fileCount,
      sdkClosureFiles,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const result = checkArchitecture(ROOT);
  if (!result.ok) {
    console.error(`Architecture check failed with ${result.violations.length} violation(s):`);
    for (const v of result.violations) {
      console.error(`- [${v.rule}] ${v.file}: ${v.detail}`);
    }
    process.exitCode = 1;
  } else {
    const { coreFiles, webFiles, siteFiles, sdkClosureFiles } = result.stats;
    console.log(`Architecture check PASS: 0 cycles (core=${coreFiles}, web=${webFiles}, site=${siteFiles}), SDK closure=${sdkClosureFiles} files, all boundaries clean.`);
  }
}
