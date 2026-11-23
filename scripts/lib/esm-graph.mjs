// Zero-dependency ESM/TS import-specifier scanner and module-graph helpers.
import fs from 'node:fs';
import path from 'node:path';

const REGEX_PREV_KEYWORDS = new Set([
  'return', 'throw', 'case', 'delete', 'void', 'typeof',
  'in', 'instanceof', 'new', 'else', 'yield', 'await', 'do', 'of',
]);
const REGEX_PREV_PUNCT = new Set(['(', '[', '{', ',', ';', ':', '?', '!', '~', '=', '<', '>', '+', '-', '*', '%', '^', '&', '|', '=>']);
const SOURCE_EXTENSIONS = ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.cjs'];

function tokenize(source) {
  const tokens = [];
  let i = 0;
  const n = source.length;
  let templateBraceDepth = 0;
  const templateDepthStack = [];

  const prevAllowsRegex = () => {
    const prev = tokens.at(-1);
    if (!prev) return true;
    if (prev.type === 'ident') return REGEX_PREV_KEYWORDS.has(prev.value);
    if (prev.type === 'punct') return REGEX_PREV_PUNCT.has(prev.value);
    return false;
  };

  const readTemplateSegment = () => {
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { i++; return false; }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        return true;
      }
      i++;
    }
    return false;
  };

  while (i < n) {
    const ch = source[i];
    if (ch <= ' ') { i++; continue; }

    // Line comment
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Regex literal
    if (ch === '/' && prevAllowsRegex()) {
      i++;
      let inClass = false;
      while (i < n) {
        const rc = source[i];
        if (rc === '\\') { i += 2; continue; }
        if (rc === '[' && !inClass) inClass = true;
        else if (rc === ']' && inClass) inClass = false;
        else if (rc === '/' && !inClass) { i++; break; }
        else if (rc === '\n' || rc === '\r') break;
        i++;
      }
      while (i < n && /[a-zA-Z]/.test(source[i])) i++;
      tokens.push({ type: 'regex', value: '/' });
      continue;
    }

    // String literal
    if (ch === '\'' || ch === '"') {
      const quote = ch;
      i++;
      let value = '';
      while (i < n) {
        const sc = source[i];
        if (sc === '\\') {
          if (i + 1 < n) value += source[i + 1];
          i += 2;
          continue;
        }
        if (sc === quote) { i++; break; }
        value += sc;
        i++;
      }
      tokens.push({ type: 'string', value });
      continue;
    }

    // Template literal
    if (ch === '`') {
      i++;
      tokens.push({ type: 'template', value: '`' });
      if (readTemplateSegment()) {
        templateDepthStack.push(templateBraceDepth);
        templateBraceDepth = 1;
      }
      continue;
    }

    if (ch === '{') {
      if (templateDepthStack.length) templateBraceDepth++;
      tokens.push({ type: 'punct', value: '{' });
      i++;
      continue;
    }

    if (ch === '}') {
      if (templateDepthStack.length) {
        templateBraceDepth--;
        if (templateBraceDepth === 0) {
          i++;
          if (readTemplateSegment()) {
            templateBraceDepth = 1;
          } else {
            templateBraceDepth = templateDepthStack.pop();
          }
          continue;
        }
      }
      tokens.push({ type: 'punct', value: '}' });
      i++;
      continue;
    }

    // Identifier / keyword
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      i++;
      while (i < n && /[A-Za-z0-9_$]/.test(source[i])) i++;
      tokens.push({ type: 'ident', value: source.slice(start, i) });
      continue;
    }

    // Number literal (including hex/scientific/separators)
    if (/[0-9]/.test(ch)) {
      const start = i;
      i++;
      while (i < n && /[0-9A-Za-z_.]/.test(source[i])) i++;
      tokens.push({ type: 'number', value: source.slice(start, i) });
      continue;
    }

    // Multi-char operators we care about for prevAllowsRegex
    if (ch === '=' && source[i + 1] === '>') {
      tokens.push({ type: 'punct', value: '=>' });
      i += 2;
      continue;
    }

    tokens.push({ type: 'punct', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Extract static and dynamic ESM/TS import specifiers from JS/JSX/TS/TSX source.
 * Comments, string literals, and regexes are ignored so non-import text cannot spoof matches.
 */
export function collectImportSpecifiers(source) {
  const tokens = tokenize(source);
  const specifiers = [];
  const total = tokens.length;

  for (let i = 0; i < total; i++) {
    const token = tokens[i];
    if (token.type !== 'ident') continue;

    // Ignore property accesses like `obj.import(...)` or `{ import: 1 }`.
    const prev = i > 0 ? tokens[i - 1] : null;
    if (prev?.type === 'punct' && prev.value === '.') continue;
    const next = tokens[i + 1];
    if (next?.type === 'punct' && next.value === ':') continue;

    if (token.value === 'import') {
      // Dynamic import('spec')
      if (next?.type === 'punct' && next.value === '(') {
        const arg = tokens[i + 2];
        const close = tokens[i + 3];
        if (arg?.type === 'string' && close?.type === 'punct' && close.value === ')') {
          specifiers.push({ specifier: arg.value, kind: 'dynamic' });
        }
        continue;
      }

      // Side-effect import 'spec'
      if (next?.type === 'string') {
        specifiers.push({ specifier: next.value, kind: 'static' });
        continue;
      }

      // Static import ... from 'spec'
      let j = i + 1;
      let braceDepth = 0;
      while (j < total) {
        const cur = tokens[j];
        if (cur.type === 'punct') {
          if (cur.value === '{') braceDepth++;
          else if (cur.value === '}') braceDepth = Math.max(0, braceDepth - 1);
          else if (cur.value === ';' && braceDepth === 0) break;
        } else if (braceDepth === 0 && cur.type === 'ident' && cur.value === 'from' && tokens[j + 1]?.type === 'string') {
          specifiers.push({ specifier: tokens[j + 1].value, kind: 'static' });
          i = j + 1;
          break;
        }
        j++;
      }
      continue;
    }

    if (token.value === 'export') {
      // Only re-exports: `export { ... } from '...'` or `export * ... from '...'`
      if (!(next?.type === 'punct' && (next.value === '{' || next.value === '*')) && !(next?.type === 'ident' && next.value === 'type' && tokens[i + 2]?.type === 'punct' && (tokens[i + 2].value === '{' || tokens[i + 2].value === '*'))) {
        continue;
      }
      let j = i + 1;
      let braceDepth = 0;
      while (j < total) {
        const cur = tokens[j];
        if (cur.type === 'punct') {
          if (cur.value === '{') braceDepth++;
          else if (cur.value === '}') braceDepth = Math.max(0, braceDepth - 1);
          else if (cur.value === ';' && braceDepth === 0) break;
        } else if (braceDepth === 0 && cur.type === 'ident' && cur.value === 'from' && tokens[j + 1]?.type === 'string') {
          specifiers.push({ specifier: tokens[j + 1].value, kind: 're-export' });
          i = j + 1;
          break;
        }
        j++;
      }
    }
  }

  return specifiers;
}

const stripQuery = (spec) => spec.split('?')[0].split('#')[0];

function resolveAliasBase(specifier, aliases = {}) {
  const clean = stripQuery(specifier);
  const prefixes = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (prefix.endsWith('/')) {
      if (clean.startsWith(prefix)) return path.resolve(aliases[prefix], clean.slice(prefix.length));
    } else if (clean === prefix || clean.startsWith(`${prefix}/`)) {
      return path.resolve(aliases[prefix], clean === prefix ? '' : clean.slice(prefix.length + 1));
    }
  }
  return null;
}

/** Resolve relative or aliased specifier base directory/file path before probing extensions. */
export function resolveSpecifierBase(fromFile, specifier, { aliases = {} } = {}) {
  const clean = stripQuery(specifier);
  if (clean.startsWith('.')) return path.resolve(path.dirname(fromFile), clean);
  return resolveAliasBase(clean, aliases);
}

/** Load TypeScript `compilerOptions.paths` directory aliases from a tsconfig file. */
export function loadTsconfigAliases(tsconfigPath) {
  if (!fs.existsSync(tsconfigPath)) return {};
  try {
    const config = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    const options = config?.compilerOptions || {};
    const configDir = path.dirname(tsconfigPath);
    const baseDir = options.baseUrl ? path.resolve(configDir, options.baseUrl) : configDir;
    const aliases = {};
    for (const [pattern, targets] of Object.entries(options.paths || {})) {
      const target = Array.isArray(targets) ? targets[0] : null;
      if (typeof target !== 'string') continue;
      if (pattern.endsWith('/*') && target.endsWith('/*')) {
        aliases[pattern.slice(0, -1)] = path.resolve(baseDir, target.slice(0, -1));
      } else if (!pattern.includes('*') && !target.includes('*')) {
        aliases[pattern] = path.resolve(baseDir, target);
      }
    }
    return aliases;
  } catch {
    return {};
  }
}

/** Extract static `resolve.alias` entries (`fileURLToPath(new URL(..., import.meta.url))` or `path.resolve`) from a Vite config. */
export function loadViteAliases(viteConfigPath) {
  if (!fs.existsSync(viteConfigPath)) return {};
  const src = fs.readFileSync(viteConfigPath, 'utf8');
  const configDir = path.dirname(viteConfigPath);
  const aliases = {};
  const patterns = [
    /['"]([^'"]+)['"]\s*:\s*fileURLToPath\(\s*new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)\s*\)/g,
    /['"]([^'"]+)['"]\s*:\s*path\.resolve\(\s*(?:__dirname|path\.dirname\(fileURLToPath\(import\.meta\.url\)\))\s*,\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const match of src.matchAll(re)) {
      const key = match[1];
      const targetDir = path.resolve(configDir, match[2]);
      aliases[key.endsWith('/') ? key : `${key}/`] = targetDir;
    }
  }
  return aliases;
}

export function resolveModulePath(fromFile, specifier, { aliases = {} } = {}) {
  const base = resolveSpecifierBase(fromFile, specifier, { aliases });
  if (!base) return null;
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function collectSourceFiles(dirs, root) {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|mjs|jsx|ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  for (const d of dirs) walk(path.resolve(root, d));
  return files.sort();
}

export function findImportCycles(files, root, { aliases = {} } = {}) {
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const graph = new Map();

  for (const file of fileSet) {
    const src = fs.readFileSync(file, 'utf8');
    const deps = [];
    for (const { specifier } of collectImportSpecifiers(src)) {
      const target = resolveModulePath(file, specifier, { aliases });
      if (target && fileSet.has(path.resolve(target))) {
        deps.push(path.resolve(target));
      }
    }
    graph.set(file, [...new Set(deps)]);
  }

  const visited = new Set();
  const active = new Set();
  const cycles = [];

  const dfs = (node, trail) => {
    visited.add(node);
    active.add(node);
    for (const next of graph.get(node) || []) {
      if (active.has(next)) {
        const start = trail.indexOf(next);
        cycles.push([...trail.slice(start), next].map((p) => path.relative(root, p).replaceAll('\\', '/')));
      } else if (!visited.has(next)) {
        dfs(next, [...trail, next]);
      }
    }
    active.delete(node);
  };

  for (const file of fileSet) {
    if (!visited.has(file)) dfs(file, [file]);
  }

  return { fileCount: fileSet.size, cycles };
}
