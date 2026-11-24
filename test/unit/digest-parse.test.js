import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as store from '../../lib/store.js';
import { buildDigest } from '../../lib/queries/digest.js';
import { openWebModules } from '../helpers/load-web-module.mjs';

const web = await openWebModules();
after(() => web.close());

const { parseDigest, parseNodeLine, parseRelationLine, parseTrail, parseCheckpoint, inlineRuns } = await web.load('/src/digest-parse.ts');

function digestBoard(build) {
  const board = fs.mkdtempSync(path.join(os.tmpdir(), 'pinwhy-digest-parse-'));
  try {
    store.ensure(board);
    build?.(board);
    return buildDigest(store.replay(board), board);
  } finally {
    fs.rmSync(board, { recursive: true, force: true });
  }
}

const accounted = (parsed) => [
  parsed.title,
  parsed.stats.map((s) => `${s.label} ${s.value}`).join(' · '),
  ...parsed.intro,
  ...parsed.sections.flatMap((s) => [s.title, ...s.notes, ...s.items.flatMap((i) => [i.text, ...i.children])]),
  parsed.footer,
].join('\n');

test('digest parser reads an empty board into stats, empty sections and the disclaimer', () => {
  const md = digestBoard();
  const parsed = parseDigest(md);
  assert.equal(parsed.stats.length, 5);
  assert.ok(parsed.stats.every((s) => s.value === 0 && s.label));
  assert.ok(parsed.sections.length >= 3);
  assert.ok(parsed.sections.every((s) => s.items.length === 0));
  assert.ok(!parsed.sections.some((s) => s.notes.some((n) => n.startsWith('_'))), 'italic markers are stripped');
});

test('digest parser accounts for every line of a populated digest', () => {
  const md = digestBoard((dir) => {
    const goal = store.addNode({ type: 'goal', title: '审计授权边界', enter: true }, dir).node;
    const h = store.addNode({ type: 'hypothesis', title: '所有权校验缺失', status: 'active', at: 'src/api.js:12', detail: '跨账号读取返回 200' }, dir).node;
    store.addEdge({ from: h.id, to: goal.id, kind: 'derived-from' }, dir);
    store.moveCursor(h.id, { reason: '验证假设' }, dir);
    store.addCheckpoint({ summary: '阶段一完成' }, dir);
  });
  const parsed = parseDigest(md);
  const all = accounted(parsed);
  for (const line of md.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const bare = line.replace(/^#+\s+|^-\s+|^_|_$/g, '');
    assert.ok(all.includes(bare), `line lost: ${line}`);
  }
  assert.deepEqual(parsed.stats.map((stat) => stat.value), [2, 1, 1, 0, 1]);
  const current = parsed.sections.find((section) => section.items.some((item) => parseNodeLine(item.text)?.title === '所有权校验缺失'));
  const node = parseNodeLine(current.items[0].text);
  assert.equal(node.title, '所有权校验缺失');
  assert.equal(node.location, 'src/api.js:12');
  assert.ok(node.meta.length >= 2);
  const trail = parsed.sections.find((section) => section.items.some((item) => parseTrail(item.text)));
  assert.ok(parseTrail(trail.items[0].text).length >= 2);
  const neighbour = parsed.sections.find((section) => section.items.some((item) => parseRelationLine(item.text)));
  assert.equal(parseRelationLine(neighbour.items[0].text).relation.length > 0, true);
  const cp = parsed.sections.flatMap((section) => section.items.map((item) => parseCheckpoint(item.text))).find(Boolean);
  assert.equal(cp.at, node.id);
  assert.equal(cp.summary, '阶段一完成');
});

test('digest line helpers keep unrecognised text as text', () => {
  assert.equal(parseNodeLine('plain words'), null);
  assert.equal(parseRelationLine('a - b'), null);
  assert.equal(parseTrail('not → a trail!'), null);
  assert.deepEqual(parseRelationLine('[n1] --支持--> [n2]'), { from: '[n1]', relation: '支持', to: '[n2]' });
  assert.deepEqual(inlineRuns('用 `pinwhy cursor` 进入 [n3]。'), [
    { kind: 'text', value: '用 ' },
    { kind: 'code', value: 'pinwhy cursor' },
    { kind: 'text', value: ' 进入 ' },
    { kind: 'ref', value: 'n3' },
    { kind: 'text', value: '。' },
  ]);
});

test('digest node parsing preserves authored punctuation in English and previously exported records', () => {
  for (const line of [
    '[n1] Note · open: Authored 标题: /api/item @src/app.js:12',
    '[n1] Note · open：Authored 标题: /api/item @src/app.js:12',
  ]) {
    assert.deepEqual(parseNodeLine(line), { id: 'n1', meta: ['Note', 'open'], title: 'Authored 标题: /api/item', location: 'src/app.js:12' });
  }
});
