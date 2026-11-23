// Shared helpers for Pinwhy Ultra ledger scanning, slice matching, and gap reporting.
import fs from 'node:fs';
import { parseLocation } from '../storage/input.js';

export function invalidValue(message) {
  return Object.assign(new Error(message), { code: 'invalid_value', status: 400 });
}

export function parseLoc(loc) {
  if (!loc) return null;
  if (typeof loc === 'string') {
    const trimmed = loc.trim();
    if (!trimmed) return null;
    const parsed = parseLocation(trimmed);
    if (parsed?.path) {
      const line = 'line' in parsed && typeof parsed.line === 'number'
        && Number.isSafeInteger(parsed.line) && parsed.line >= 1
        ? parsed.line
        : null;
      return {
        path: parsed.path.replace(/\\/g, '/'),
        line,
      };
    }
    return { path: trimmed.replace(/\\/g, '/'), line: null };
  }
  if (typeof loc === 'object' && !Array.isArray(loc)) {
    const p = typeof loc.path === 'string' ? loc.path.trim().replace(/\\/g, '/') : '';
    const line = typeof loc.line === 'number' && Number.isSafeInteger(loc.line) && loc.line >= 1 ? loc.line : null;
    return p ? { path: p, line } : null;
  }
  return null;
}

export function tagValue(node, key) {
  const prefix = `${key}=`;
  for (const tag of Array.isArray(node.tags) ? node.tags : []) {
    if (typeof tag === 'string' && tag.startsWith(prefix) && tag.length > prefix.length) {
      return tag.slice(prefix.length);
    }
  }
  return null;
}

export function tagValues(node, key) {
  const prefix = `${key}=`;
  const out = [];
  for (const tag of Array.isArray(node.tags) ? node.tags : []) {
    if (typeof tag === 'string' && tag.startsWith(prefix) && tag.length > prefix.length) {
      out.push(tag.slice(prefix.length));
    }
  }
  return out;
}

export function hasTag(node, exact) {
  return Array.isArray(node.tags) && node.tags.includes(exact);
}

export function compactGapNode(node, extra = {}) {
  return {
    id: node.id,
    type: node.type,
    title: node.title ?? '',
    status: node.status ?? null,
    severity: node.severity ?? null,
    confidence: node.confidence ?? null,
    loc: node.loc ?? null,
    author: node.author ?? null,
    updatedBy: node.updatedBy ?? null,
    ...extra,
  };
}

export function fsSafeExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}
