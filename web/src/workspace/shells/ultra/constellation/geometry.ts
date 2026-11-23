import type { UltraOrbitalBar, UltraSectorView } from '../../../ultra';

export type HoverTip = {
  x: number;
  y: number;
  title: string;
  subtitle: string;
  accent?: string;
};

export const STAGE_W = 920;
export const STAGE_H = 760;
export const CX = 460;
export const CY = 382;
export const R_HUB = 54;
export const R_CHORD = 156;
export const R_INNER_1 = 166;
export const R_INNER_2 = 190;
export const R_SAT = 206;
export const R_SLICE_1 = 222;
export const R_SLICE_2 = 270;
export const R_LABEL = 304;

export function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function arcRingPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number): string {
  const span = Math.max(0.008, a2 - a1);
  const end = a1 + span;
  const p1 = polar(cx, cy, r2, a1);
  const p2 = polar(cx, cy, r2, end);
  const p3 = polar(cx, cy, r1, end);
  const p4 = polar(cx, cy, r1, a1);
  const large = span > Math.PI ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function computeFitView(w: number, h: number) {
  const safeW = Math.max(360, w);
  const safeH = Math.max(320, h);
  const padTop = 58;
  const padBottom = 56;
  const availH = Math.max(260, safeH - padTop - padBottom);
  const scale = Math.max(0.42, Math.min(1.16, (safeW - 36) / STAGE_W, availH / STAGE_H));
  const x = (safeW - STAGE_W * scale) / 2;
  const y = padTop + (availH - STAGE_H * scale) / 2;
  return { x, y, scale, fitScale: scale };
}

export function sliceAppearance(bar: UltraOrbitalBar, isSelected: boolean, isHovered: boolean, filterActive: boolean) {
  const dimmed = filterActive && !bar.matchesFilter;
  const hasZeroNodes = bar.status === 'cleared' && bar.nodeIds.length === 0;
  const hasHuman = bar.beacons.some((b) => b.tone === 'human') || Boolean(bar.slice?.humanFollowups?.length);

  let fill = 'var(--u-ring-track)';
  let opacity = 0.72;
  let outerColor = 'var(--u-bg)';

  if (bar.status === 'cleared') {
    fill = hasZeroNodes ? 'var(--u-cleared-zero)' : 'var(--u-mint)';
    opacity = hasZeroNodes ? 0.84 : 0.96;
  } else if (bar.status === 'flagged' || bar.status === 'stale') {
    fill = 'var(--u-crimson)';
    opacity = 0.94;
  } else if (bar.status === 'shallow') {
    fill = 'var(--u-amber)';
    opacity = 0.94;
  } else if (bar.status === 'excluded') {
    fill = 'var(--u-dim)';
    opacity = 0.42;
  }

  if (hasHuman) outerColor = 'var(--u-cyan)';
  if (isSelected) outerColor = 'var(--u-cyan)';
  else if (isHovered) outerColor = 'var(--u-ring-hover)';

  if (dimmed && !isSelected) opacity *= 0.2;

  return { fill, opacity, outerColor, hasZeroNodes, hasHuman };
}

export type AdjustedSectorLabel = {
  sector: UltraSectorView;
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
};

export function computeAdjustedLabels(sectors: UltraSectorView[]): AdjustedSectorLabel[] {
  const items: AdjustedSectorLabel[] = sectors.map((sec) => {
    const cos = Math.cos(sec.midAngle);
    const sin = Math.sin(sec.midAngle);
    const p = polar(CX, CY, R_LABEL, sec.midAngle);
    const anchor: 'start' | 'end' | 'middle' = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    const nudgedX = anchor === 'start' ? p.x + 4 : anchor === 'end' ? p.x - 4 : p.x;
    const nudgedY = p.y + (sin > 0.75 ? 10 : sin < -0.75 ? -6 : 0);
    return { sector: sec, x: nudgedX, y: nudgedY, anchor };
  });

  const relaxSide = (side: AdjustedSectorLabel[]) => {
    side.sort((a, b) => a.y - b.y);
    for (let i = 1; i < side.length; i++) {
      if (side[i].y - side[i - 1].y < 34) {
        side[i].y = side[i - 1].y + 34;
      }
    }
    const maxBottom = STAGE_H - 28;
    for (let i = side.length - 1; i >= 0; i--) {
      if (i === side.length - 1 && side[i].y > maxBottom) side[i].y = maxBottom;
      if (i < side.length - 1 && side[i + 1].y - side[i].y < 34) {
        side[i].y = side[i + 1].y - 34;
      }
    }
  };
  relaxSide(items.filter((i) => i.anchor === 'start'));
  relaxSide(items.filter((i) => i.anchor === 'end'));
  return items;
}
