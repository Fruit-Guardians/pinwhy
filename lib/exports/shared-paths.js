// Path-sanitization policy for shared snapshots and offline HTML exports:
// relativize project-internal paths and mask external host absolute paths.
import fs from 'node:fs';
import path from 'node:path';

const WIN_ABSOLUTE_RE = /^(?:[a-zA-Z]:[\\/]|\/\/|\\\\)/;

/** True when a path string is rooted on a POSIX, Windows drive, or UNC host filesystem. */
export function isAbsoluteHostPath(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && (trimmed.startsWith('/') || WIN_ABSOLUTE_RE.test(trimmed));
}

function resolveDeepestPosix(absPath) {
  const normalized = path.posix.normalize(absPath);
  const trailing = [];
  let cursor = normalized;
  while (cursor !== '/' && !fs.existsSync(cursor)) {
    const parent = path.posix.dirname(cursor);
    if (parent === cursor) break;
    trailing.unshift(path.posix.basename(cursor));
    cursor = parent;
  }
  try {
    const real = fs.realpathSync(cursor).split(path.sep).join('/');
    return trailing.length ? path.posix.join(real, ...trailing) : real;
  } catch {
    return normalized;
  }
}

function relativeInsidePosix(root, target) {
  const rel = path.posix.relative(root, target);
  if (rel === '') return '.';
  if (rel !== '..' && !rel.startsWith('../') && !path.posix.isAbsolute(rel)) return rel;
  return null;
}

/**
 * Convert an absolute host path inside `cwd` into a project-relative POSIX path.
 * Returns `null` when `rawPath` is already relative or lies outside `cwd`.
 * @param {string} rawPath
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function relativizeProjectPath(rawPath, cwd = process.cwd()) {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed || !isAbsoluteHostPath(trimmed)) return null;

  if (WIN_ABSOLUTE_RE.test(trimmed)) {
    const normalizedWin = path.win32.normalize(trimmed.replace(/\//g, '\\'));
    if (process.platform === 'win32' && cwd) {
      const winRoot = path.win32.resolve(cwd);
      const rel = path.win32.relative(winRoot, normalizedWin);
      if (rel === '') return '.';
      if (rel !== '..' && !rel.startsWith('..\\') && !path.win32.isAbsolute(rel)) {
        return rel.split('\\').join('/');
      }
    }
    return null;
  }

  const normalized = path.posix.normalize(trimmed);
  if (cwd && process.platform !== 'win32') {
    const absRoot = path.posix.normalize(path.resolve(cwd));
    const direct = relativeInsidePosix(absRoot, normalized);
    if (direct !== null) return direct;
    const realRoot = resolveDeepestPosix(absRoot);
    const realTarget = resolveDeepestPosix(normalized);
    const resolved = relativeInsidePosix(realRoot, realTarget);
    if (resolved !== null) return resolved;
  }
  return null;
}

/**
 * Convert an absolute host path into a project-relative POSIX path when inside `cwd`,
 * or mask it as `<external>/<basename>` when outside. Relative paths pass through unchanged.
 * @param {string} rawPath
 * @param {string} [cwd]
 * @returns {string}
 */
export function sanitizeSharedPath(rawPath, cwd = process.cwd()) {
  if (typeof rawPath !== 'string') return rawPath;
  const trimmed = rawPath.trim();
  if (!trimmed || !isAbsoluteHostPath(trimmed)) return rawPath;

  const inProject = relativizeProjectPath(trimmed, cwd);
  if (inProject !== null) return inProject;

  if (WIN_ABSOLUTE_RE.test(trimmed)) {
    const normalizedWin = path.win32.normalize(trimmed.replace(/\//g, '\\'));
    const base = path.win32.basename(normalizedWin);
    return base ? `<external>/${base}` : '<external>';
  }

  const normalized = path.posix.normalize(trimmed);
  const base = path.posix.basename(normalized);
  return base ? `<external>/${base}` : '<external>';
}

/**
 * Sanitize a node `loc` string or `{ path, ... }` object without mutating the input.
 * @template T
 * @param {T} loc
 * @param {string} [cwd]
 * @returns {T}
 */
export function sanitizeSharedLoc(loc, cwd = process.cwd()) {
  if (!loc) return loc;
  if (typeof loc === 'string') return /** @type {T} */ (sanitizeSharedPath(loc, cwd));
  if (typeof loc === 'object' && !Array.isArray(loc)) {
    const record = /** @type {{ path?: unknown }} */ (loc);
    if (typeof record.path === 'string') {
      const clean = sanitizeSharedPath(record.path, cwd);
      return clean === record.path ? loc : /** @type {T} */ ({ ...loc, path: clean });
    }
  }
  return loc;
}
