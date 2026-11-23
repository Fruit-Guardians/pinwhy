import type { BoardNode, UltraGapNode } from '../../types';
import type { BeaconTone, UltraFilter, UltraModel, UltraOrbitalBar, UltraSliceMicroGraph } from './types';

export const OPEN_STATUSES = new Set(['open', 'active', 'blocked']);
export const RETIRED_STATUSES = new Set(['dead', 'refuted', 'superseded']);
export const THREAD_TYPES = new Set(['intent', 'hypothesis', 'question', 'action']);
export const VERDICT_IN = new Set(['supports', 'proves', 'prove', 'contradicts']);
export const EVIDENCE_OUT = new Set(['derived-from', 'caused-by']);
export const ANOMALY_EDGES = new Set(['supports', 'contradicts', 'derived-from', 'resolves', 'supersedes']);

export function isOpenNode(node: BoardNode) {
  return THREAD_TYPES.has(node.type) && OPEN_STATUSES.has(node.status || 'open');
}

export function isRetiredNode(node: BoardNode) {
  return RETIRED_STATUSES.has(node.status || '');
}

export function hasTag(node: BoardNode, exact: string) {
  return Array.isArray(node.tags) && node.tags.includes(exact);
}

export function tagValue(node: BoardNode, key: string): string | null {
  const prefix = `${key}=`;
  if (!Array.isArray(node.tags)) return null;
  for (const tag of node.tags) {
    if (typeof tag === 'string' && tag.startsWith(prefix) && tag.length > prefix.length) {
      return tag.slice(prefix.length);
    }
  }
  return null;
}

export function shortSectorLabel(sector: string): string {
  const parts = String(sector || '').split('/').filter(Boolean);
  if (parts.length <= 2) return sector;
  const tail = parts[parts.length - 1];
  const mid = parts[parts.length - 2].replace(/-server$/, '');
  return `${mid}/${tail}`;
}

export function buildSliceMicroGraph(model: UltraModel, sliceId: string): UltraSliceMicroGraph | null {
  const center = model.barById.get(sliceId);
  if (!center) return null;
  const depIds = center.slice?.dependsOn || [];
  const callees = depIds
    .map((id) => model.barById.get(id))
    .filter((b): b is UltraOrbitalBar => Boolean(b));
  const callers = model.bars.filter(
    (b) => b.id !== sliceId && Boolean(b.slice?.dependsOn?.includes(sliceId)),
  );
  const linkedNodes = center.nodeIds
    .map((nid) => model.byId.get(nid))
    .filter((n): n is BoardNode => Boolean(n));
  return { center, callers, callees, linkedNodes };
}

export function sectorFromPath(filePath: string): string {
  const clean = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length <= 1) return 'root';
  const dirs = parts.slice(0, -1);
  if (['packages', 'apps', 'services', 'plugins'].includes(dirs[0]) && dirs.length >= 2) {
    return dirs.slice(0, Math.min(3, dirs.length)).join('/');
  }
  return dirs.slice(0, Math.min(2, dirs.length)).join('/');
}

export function parseNodeLocation(node: BoardNode): { path: string; line: number | null } | null {
  const loc = node.loc;
  if (!loc) return null;
  if (typeof loc === 'string') {
    const m = /^(.+?):(\d+)(?::\d+)?$/.exec(loc.trim());
    if (m) return { path: m[1].replace(/\\/g, '/'), line: Number(m[2]) };
    return loc.trim() ? { path: loc.trim().replace(/\\/g, '/'), line: null } : null;
  }
  if (typeof loc === 'object' && !Array.isArray(loc)) {
    const obj = loc as { path?: unknown; line?: unknown };
    if (typeof obj.path === 'string' && obj.path.trim()) {
      return {
        path: obj.path.trim().replace(/\\/g, '/'),
        line: typeof obj.line === 'number' && Number.isFinite(obj.line) ? obj.line : null,
      };
    }
  }
  return null;
}

export function sectorOfNode(node: BoardNode): string {
  const comp = tagValue(node, 'component');
  if (comp) return comp;
  const loc = parseNodeLocation(node);
  if (loc?.path) return sectorFromPath(loc.path);
  return 'unscoped';
}

export function relativeInSector(filePath: string, sector: string): string {
  const norm = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (sector !== 'root' && sector !== 'unscoped' && norm.startsWith(`${sector}/`)) {
    return norm.slice(sector.length + 1);
  }
  return norm.split('/').pop() || norm;
}

export function compactGapNode(node: BoardNode): UltraGapNode {
  const loc = parseNodeLocation(node);
  return {
    id: node.id,
    type: node.type,
    title: node.title ?? '',
    status: node.status ?? null,
    severity: node.severity ?? null,
    confidence: node.confidence ?? null,
    loc: loc ? { path: loc.path, line: loc.line ?? undefined } : null,
    author: typeof node.author === 'string' ? node.author : null,
    updatedBy: typeof node.updatedBy === 'string' ? node.updatedBy : null,
  };
}

export function classifyBeacon(node: BoardNode, awakenedNodeIds: Set<string>): BeaconTone | null {
  if (node.author === 'human' || node.updatedBy === 'human') {
    if (node.type === 'question' || node.type === 'hint' || node.type === 'observation') return 'human';
  }
  if (!isRetiredNode(node)) {
    if (['finding', 'vuln'].includes(node.type)) {
      if (['critical', 'high'].includes(node.severity || '') || node.confidence === 'reproduced' || node.status === 'confirmed') {
        return 'critical';
      }
      return 'hot';
    }
    if (hasTag(node, 'role=primitive') || hasTag(node, 'role=anomaly') || node.type === 'anomaly' || awakenedNodeIds.has(node.id)) {
      return 'amber';
    }
    if (isOpenNode(node)) return 'hot';
  }
  return null;
}

export function nodeMatchesWeight(node: BoardNode): number {
  const detailLen = typeof node.detail === 'string' ? node.detail.length : 0;
  const base = ['finding', 'vuln'].includes(node.type) ? 0.78 : ['fact', 'observation', 'result'].includes(node.type) ? 0.56 : 0.44;
  return Math.min(1, base + Math.min(0.22, detailLen / 900));
}

export function sliceWeight(lines: number, linkedCount: number): number {
  const norm = Math.log2(Math.max(8, lines) + 8) / Math.log2(360);
  return Math.max(0.32, Math.min(1, 0.32 + norm * 0.52 + Math.min(0.16, linkedCount * 0.06)));
}

export function barMatchesFilter(
  bar: Omit<UltraOrbitalBar, 'angle' | 'matchesFilter'>,
  nodes: BoardNode[],
  filter: UltraFilter,
  awakenedNodeIds: Set<string>,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'zero-node') {
    return bar.status === 'cleared' && bar.nodeIds.length === 0 && !(bar.slice?.humanFollowups?.length);
  }
  if (filter === 'blind') {
    return bar.status === 'pending' || bar.status === 'stale' || bar.status === 'shallow' || nodes.some(isOpenNode);
  }
  if (filter === 'hits') {
    return bar.beacons.some((b) => b.tone === 'critical' || b.tone === 'hot') ||
      nodes.some((n) => ['finding', 'vuln'].includes(n.type) && !isRetiredNode(n));
  }
  if (filter === 'primitives') {
    return nodes.some((n) => hasTag(n, 'role=primitive') || hasTag(n, 'role=anomaly') || n.type === 'anomaly' || (n.type === 'hypothesis' && n.status === 'deferred'));
  }
  if (filter === 'awakened') {
    return nodes.some((n) => awakenedNodeIds.has(n.id));
  }
  if (filter === 'human') {
    return nodes.some((n) => n.author === 'human' || n.updatedBy === 'human');
  }
  return true;
}
