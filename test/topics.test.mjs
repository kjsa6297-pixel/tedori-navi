import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topics } from '../src/topics.js';

test('豆知識はすべて必要な項目があり、壊れた値（NaN・undefined）を含まない', () => {
  const list = topics();
  assert.ok(list.length >= 10);
  const slugs = new Set();
  for (const t of list) {
    for (const k of ['slug', 'tag', 'title', 'doya']) assert.ok(t[k], `${t.slug}: ${k}`);
    assert.ok(t.points.length >= 2 && t.link.length === 2 && t.src.length === 2, t.slug);
    assert.match(t.link[0], /^\//, t.slug);
    assert.ok(!slugs.has(t.slug), `重複: ${t.slug}`);
    slugs.add(t.slug);
    assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(t)), t.slug);
  }
});

test('豆知識の数字が計算エンジンの値と食い違っていない（代表例）', () => {
  const t = Object.fromEntries(topics().map((x) => [x.slug, x]));
  assert.match(t['wall-178'].points[1], /178万円/);
  assert.match(t['wall-666'].doya, /666万円/);
  // 4〜6月の残業：月給30万→35万で 標準報酬 30万→36万。(健保+支援金 5.04% + 厚年 9.15%) の差 = 3,024 + 5,490
  assert.match(t['overtime-april'].points[1], /月8,514円/);
  assert.match(t['overtime-april'].points[1], /102,168円/);
});
