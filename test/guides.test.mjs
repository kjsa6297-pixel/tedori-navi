import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guides } from '../src/guides.js';

test('トレンド解説はすべて必要な項目があり、壊れた値（NaN・undefined）を含まない', () => {
  const list = guides();
  assert.deepEqual(list.map((g) => g.slug), ['nisa', 'ideco', 'kodomo-nisa']);
  for (const g of list) {
    for (const k of ['slug', 'icon', 'title', 'short', 'lead', 'talk', 'diagram', 'sim', 'cta']) assert.ok(g[k], `${g.slug}: ${k}`);
    assert.equal(g.stats.length, 3, g.slug);
    assert.ok(g.points.length >= 3 && g.faq.length >= 3 && g.news.length >= 1 && g.cautions.length >= 1, g.slug);
    assert.ok(g.src.length >= 1 && g.src.every(([, u]) => /^https:\/\//.test(u)), g.slug);
    assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(g)), g.slug);
  }
});

test('iDeCoの節税額が手計算と一致する（年収500万円・独身・所得税5%＋住民税10%）', () => {
  const g = guides().find((x) => x.slug === 'ideco');
  const text = JSON.stringify(g);
  // 課税所得 所得税1,796,000円・住民税2,406,000円から掛金を引く。
  // 月2.3万円（年276,000円）：所得税 91,600→77,600円、住民税 243,100→215,500円 → 41,700円
  // 月6.2万円（年744,000円）：所得税 91,600→53,700円、住民税 243,100→168,700円 → 112,300円
  assert.match(text, /41,700円/);
  assert.match(text, /112,300円/);
  assert.match(g.lead, /年4\.2万円→11\.2万円/);
});
