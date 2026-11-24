import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openWebModules } from '../helpers/load-web-module.mjs';

const web = await openWebModules();
after(() => web.close());

const { matchLocale, t } = await web.load('/src/i18n.ts');
const catalogues = {};
for (const id of ['zh-CN', 'zh-HK', 'en', 'ja']) {
  const mod = await web.load(`/src/locales/${id}.ts`);
  catalogues[id] = Object.values(mod)[0];
}

test('interface language follows the browser, with Traditional Chinese by script or region', () => {
  assert.equal(matchLocale(['zh-CN']), 'zh-CN');
  assert.equal(matchLocale(['zh']), 'zh-CN');
  assert.equal(matchLocale(['zh-Hans-SG']), 'zh-CN');
  assert.equal(matchLocale(['zh-HK']), 'zh-HK');
  assert.equal(matchLocale(['zh-TW']), 'zh-HK');
  assert.equal(matchLocale(['zh-Hant']), 'zh-HK');
  assert.equal(matchLocale(['zh-MO']), 'zh-HK');
  assert.equal(matchLocale(['ja-JP']), 'ja');
  assert.equal(matchLocale(['en-GB']), 'en');
  assert.equal(matchLocale(['fr-FR', 'ja', 'en']), 'ja');
  assert.equal(matchLocale(['fr-FR']), 'en');
  assert.equal(matchLocale([]), 'en');
});

test('every language carries every message with the same placeholders', () => {
  const holes = (text) => [...new Set(text.match(/\{\w+\}/g) || [])].sort().join();
  const source = catalogues['zh-CN'];
  for (const [id, messages] of Object.entries(catalogues)) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(source).sort(), id);
    for (const key of Object.keys(source)) {
      for (const form of messages[key].split('|')) assert.equal(holes(form), holes(source[key]), `${id} ${key}`);
      assert.ok(messages[key].trim(), `${id} ${key} is empty`);
    }
  }
});

test('peek connection hint pluralizes and interpolates connection counts cleanly', () => {
  assert.equal(catalogues.en['peek.connections'].split('|').length, 2);
  assert.equal(t('peek.connections', { n: 1 }), '1 条关联 · 双击聚焦邻域');
  assert.equal(t('peek.connections', { n: 4 }), '4 条关联 · 双击聚焦邻域');
});
