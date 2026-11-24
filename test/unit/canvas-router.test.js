import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openWebModules } from '../helpers/load-web-module.mjs';

const web = await openWebModules();
after(() => web.close());

const { labelPoint, roundedPath } = await web.load('/src/canvas/edge-route.ts');
const { routeAround } = await web.load('/src/canvas/router.ts');

function assertOrthogonalDetour(pts, start, end, obstacles) {
  assert.deepEqual(pts[0], start);
  assert.deepEqual(pts.at(-1), end);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    assert.ok(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5, 'orthogonal');
    for (const c of obstacles) {
      // Segment interior must stay outside the card interior.
      const l = Math.min(p.x, q.x), r = Math.max(p.x, q.x);
      const t = Math.min(p.y, q.y), b = Math.max(p.y, q.y);
      assert.ok(!(l < c.x + c.width - 1 && r > c.x + 1 && t < c.y + c.height - 1 && b > c.y + 1), `segment ${JSON.stringify([p, q])} cuts ${JSON.stringify(c)}`);
    }
  }
}

test('rounded corners stay inside their segments', () => {
  const pts = [{ x: 0, y: 4 }, { x: 50, y: 4 }, { x: 50, y: 96 }, { x: 100, y: 96 }];
  assert.match(roundedPath(pts, 44), /^M0,4L.*Q50,4 .*L100,96$/);
  assert.equal(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }], 44).includes('Q10,0 10,3'), true);
});

test('routeAround detours orthogonally around a card blocking the straight line between handles', () => {
  const source = { x: 0, y: 100, width: 288, height: 128 };
  const target = { x: 900, y: 100, width: 288, height: 128 };
  const blocker = { x: 460, y: 100, width: 240, height: 128 };
  const start = { x: 288, y: 164 }, end = { x: 900, y: 164 };
  const pts = routeAround(start, 'right', end, 'left', [source, target, blocker]);
  assert.ok(Array.isArray(pts) && pts.length >= 4, 'blocked corridor must yield a routed detour');
  assertOrthogonalDetour(pts, start, end, [source, target, blocker]);
});

test('a dragged edge goes around every card, orthogonally, from handle to handle', () => {
  // Deterministic pseudo-random scatter of cards between two ends.
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let solved = 0;
  for (let round = 0; round < 40; round++) {
    const cards = [{ x: 0, y: 200, width: 288, height: 128 }, { x: 1200, y: 260, width: 288, height: 128 }];
    for (let k = 0; k < 12; k++) cards.push({ x: 340 + rand() * 700, y: rand() * 600, width: 288 * 0.6, height: 128 });
    const free = cards.slice(2).filter((c) => !(c.x < 1200 + 288 + 20 && c.x + c.width > 1200 - 20 && c.y < 388 + 20 && c.y + c.height > 260 - 20) && !(c.x < 308 && c.y < 348 && c.y + c.height > 180));
    const all = [cards[0], cards[1], ...free];
    const start = { x: 288, y: 264 }, end = { x: 1200, y: 324 };
    const pts = routeAround(start, 'right', end, 'left', all);
    if (!pts) continue;
    solved++;
    assertOrthogonalDetour(pts, start, end, all);
  }
  assert.ok(solved >= 30, `expected scatter scenarios to yield routes, got ${solved}/40`);
});

test('a clear line stays straight and a reversed pair loops around its own cards', () => {
  const left = { x: 0, y: 0, width: 288, height: 128 }, right = { x: 500, y: 0, width: 288, height: 128 };
  assert.equal(routeAround({ x: 288, y: 64 }, 'right', { x: 500, y: 64 }, 'left', [left, right]).length, 2);
  // Target now sits left of the source: the line leaves rightwards and must come back around both cards.
  const pts = routeAround({ x: 788, y: 64 }, 'right', { x: 0, y: 64 }, 'left', [left, right]);
  assert.ok(pts.length >= 6);
  assert.ok(pts.every((p) => !(p.x > 1 && p.x < 287 && p.y > 1 && p.y < 127) && !(p.x > 501 && p.x < 787 && p.y > 1 && p.y < 127)));
});

test('labelPoint keeps orthogonal step labels centered in the open channel and avoids tiny port stubs', () => {
  // Standard 4-point step route between x=288 and x=536 with midX=412 keeps x=412 even when vertical jog is small.
  const centered = labelPoint([{ x: 288, y: 0 }, { x: 412, y: 0 }, { x: 412, y: 16 }, { x: 536, y: 16 }]);
  assert.equal(centered.x, 412);
  assert.equal(centered.y, 8);
  // Degenerate ELK stub right next to start port (x=300, only 12px from x=288) falls back to the longest open segment.
  const stub = labelPoint([{ x: 288, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 8 }, { x: 520, y: 8 }]);
  assert.equal(stub.x, 410);
});
