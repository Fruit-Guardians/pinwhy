import type { UltraOrbitalBar } from '../../../ultra';

export type Rect = { x: number; y: number; w: number; h: number };
export type WeightedItem<T> = { id: string; weight: number; item: T };
export type PlacedItem<T> = { id: string; rect: Rect; item: T };

export type TileTip = {
  x: number;
  y: number;
  title: string;
  subtitle: string;
  accent: string;
};

/** Bruls-Huizing-van Wijk squarified treemap layout keeping aspect ratios compact. */
export function squarify<T>(rawItems: WeightedItem<T>[], bounds: Rect, gap = 4): PlacedItem<T>[] {
  if (!rawItems.length || bounds.w <= 8 || bounds.h <= 8) return [];
  const items = [...rawItems]
    .map((entry) => ({ ...entry, weight: Math.max(1, entry.weight) }))
    .sort((a, b) => b.weight - a.weight);

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const totalArea = bounds.w * bounds.h;
  if (totalWeight <= 0 || totalArea <= 0) return [];

  const scaled = items.map((item) => ({
    ...item,
    area: (item.weight / totalWeight) * totalArea,
  }));

  const placed: PlacedItem<T>[] = [];
  let box: Rect = { ...bounds };
  const remaining = [...scaled];

  const worstAspect = (row: typeof scaled, shortSide: number): number => {
    if (!row.length || shortSide <= 0) return Infinity;
    const sum = row.reduce((a, b) => a + b.area, 0);
    const maxA = Math.max(...row.map((r) => r.area));
    const minA = Math.min(...row.map((r) => r.area));
    const s2 = shortSide * shortSide;
    const sum2 = sum * sum;
    return Math.max((s2 * maxA) / sum2, sum2 / (s2 * Math.max(1e-6, minA)));
  };

  const commitRow = (row: typeof scaled) => {
    const horizontal = box.w >= box.h;
    const rowArea = row.reduce((a, b) => a + b.area, 0);
    if (horizontal) {
      const stripW = box.h > 0 ? Math.min(box.w, rowArea / box.h) : box.w;
      let cy = box.y;
      for (let i = 0; i < row.length; i++) {
        const isLast = i === row.length - 1;
        const h = isLast ? Math.max(0, box.y + box.h - cy) : (row[i].area / Math.max(1e-6, rowArea)) * box.h;
        placed.push({
          id: row[i].id,
          item: row[i].item,
          rect: {
            x: box.x + gap / 2,
            y: cy + gap / 2,
            w: Math.max(0, stripW - gap),
            h: Math.max(0, h - gap),
          },
        });
        cy += h;
      }
      box = { x: box.x + stripW, y: box.y, w: Math.max(0, box.w - stripW), h: box.h };
    } else {
      const stripH = box.w > 0 ? Math.min(box.h, rowArea / box.w) : box.h;
      let cx = box.x;
      for (let i = 0; i < row.length; i++) {
        const isLast = i === row.length - 1;
        const w = isLast ? Math.max(0, box.x + box.w - cx) : (row[i].area / Math.max(1e-6, rowArea)) * box.w;
        placed.push({
          id: row[i].id,
          item: row[i].item,
          rect: {
            x: cx + gap / 2,
            y: box.y + gap / 2,
            w: Math.max(0, w - gap),
            h: Math.max(0, stripH - gap),
          },
        });
        cx += w;
      }
      box = { x: box.x, y: box.y + stripH, w: box.w, h: Math.max(0, box.h - stripH) };
    }
  };

  let row: typeof scaled = [];
  while (remaining.length > 0) {
    const next = remaining[0];
    const shortSide = Math.max(1, Math.min(box.w, box.h));
    if (!row.length || worstAspect([...row, next], shortSide) <= worstAspect(row, shortSide)) {
      row.push(next);
      remaining.shift();
    } else {
      commitRow(row);
      row = [];
    }
  }
  if (row.length) commitRow(row);
  return placed;
}

export function tileTone(bar: UltraOrbitalBar) {
  const zeroNode = bar.status === 'cleared' && bar.nodeIds.length === 0;
  if (bar.status === 'flagged' || bar.status === 'stale') {
    return {
      bg: 'var(--u-tile-hit-bg)',
      border: 'var(--u-tile-hit-bd)',
      accent: 'var(--u-crimson)',
      pending: false,
      zeroNode: false,
    };
  }
  if (bar.status === 'shallow') {
    return {
      bg: 'var(--u-tile-warn-bg)',
      border: 'var(--u-tile-warn-bd)',
      accent: 'var(--u-amber)',
      pending: false,
      zeroNode: false,
    };
  }
  if (bar.status === 'cleared') {
    return {
      bg: zeroNode ? 'var(--u-tile-ok-bg)' : 'var(--u-tile-ok-strong-bg)',
      border: zeroNode ? 'var(--u-tile-ok-bd)' : 'var(--u-tile-ok-strong-bd)',
      accent: 'var(--u-mint)',
      pending: false,
      zeroNode,
    };
  }
  if (bar.status === 'excluded') {
    return {
      bg: 'var(--u-tile-pend-bg)',
      border: 'var(--u-line)',
      accent: 'var(--u-dim)',
      pending: false,
      zeroNode: false,
    };
  }
  return {
    bg: 'var(--u-tile-pend-bg)',
    border: 'var(--u-tile-pend-bd)',
    accent: 'var(--u-dim)',
    pending: true,
    zeroNode: false,
  };
}

export function perceptualLineWeight(lines: number): number {
  return Math.max(28, lines || 40) ** 0.72;
}

export function formatTileTitle(bar: UltraOrbitalBar, multiSlicePaths: Set<string>): { title: string; isTest: boolean } {
  const raw = bar.slice?.path || bar.shortLabel;
  const parts = raw.split('/').filter(Boolean);
  const file = parts[parts.length - 1] || bar.shortLabel;
  const isTest = parts.includes('__tests__') || parts.includes('__snapshots__') || /\.(?:test|spec)\.[^.]+$|\.snap$/i.test(file);
  const cleanFile = file.replace(/\.snap$/i, '');
  const isMulti = Boolean(bar.slice?.path && multiSlicePaths.has(bar.slice.path));
  const title = isMulti && bar.slice ? `${cleanFile}:${bar.slice.startLine}-${bar.slice.endLine}` : cleanFile;
  return { title, isTest };
}
