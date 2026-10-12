import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcTakeHome, healthStandard, pensionStandard, PREF_HEALTH } from '../src/tax.js';

// 期待値は制度の計算手順に沿って手計算したもの（計算過程をコメントに残す）

test('年収500万円・独身・40歳未満', () => {
  const r = calcTakeHome({ income: 5000000 });
  // 月41.67万 → 標準報酬41万。健保+支援金 410,000×5.04%=20,664/月、厚年 410,000×9.15%=37,515/月
  assert.equal(r.health, 247968);
  assert.equal(r.pension, 450180);
  assert.equal(r.koyou, 25000);
  // 給与所得 356万。所得税: 356万-723,148-104万 → 1,796,000 ×5% ×1.021 → 91,600
  assert.equal(r.incomeTax, 91600);
  // 住民税: 356万-723,148-43万 → 2,406,000 ×10% -調整控除2,500 +均等割5,000
  assert.equal(r.residentTax, 243100);
  assert.equal(r.takeHome, 3942152);
});

test('年収1000万円・独身・40歳未満', () => {
  const r = calcTakeHome({ income: 10000000 });
  // 標準報酬83万（健保）、厚年は上限65万
  assert.equal(r.health, 501984);
  assert.equal(r.pension, 713700);
  // 給与所得 805万、基礎控除62万 → 6,164,000 ×20%-427,500 ×1.021 → 822,200
  assert.equal(r.incomeTax, 822200);
  assert.equal(r.residentTax, 637900);
  assert.equal(r.takeHome, 7274216);
});

test('年収500万円・40歳以上は介護保険料が加わる', () => {
  const a = calcTakeHome({ income: 5000000 });
  const b = calcTakeHome({ income: 5000000, over40: true });
  // 410,000 × 1.62% ÷ 2 = 3,321/月
  assert.equal(b.health - a.health, 3321 * 12);
  assert.ok(b.takeHome < a.takeHome);
});

test('年収500万円・配偶者控除と扶養1人で税金が減る', () => {
  const r = calcTakeHome({ income: 5000000, spouse: true, dependents: 1 });
  // 所得税: 1,796,852-38万-38万 → 1,036,000 ×5% ×1.021 → 52,800
  assert.equal(r.incomeTax, 52800);
  // 住民税: 2,406,852-33万-33万 → 1,746,000、調整控除 min(15万,174.6万)×5%=7,500
  // 174,600-7,500=167,100 +5,000
  assert.equal(r.residentTax, 172100);
});

test('標準報酬月額の境界', () => {
  assert.equal(healthStandard(62999), 58000);
  assert.equal(healthStandard(63000), 68000);
  assert.equal(healthStandard(2000000), 1390000);
  assert.equal(pensionStandard(50000), 88000);
  assert.equal(pensionStandard(700000), 650000);
});

test('年収100万〜3000万円で破綻しない（手取り>0、手取り率は0〜1）', () => {
  for (let i = 1000000; i <= 30000000; i += 50000) {
    for (const opt of [{}, { over40: true }, { spouse: true, dependents: 2 }]) {
      const r = calcTakeHome({ income: i, ...opt });
      assert.ok(Number.isFinite(r.takeHome) && r.takeHome > 0, `${i}`);
      assert.ok(r.rate > 0 && r.rate < 1, `${i}`);
      assert.ok(r.incomeTax >= 0 && r.residentTax >= 0, `${i}`);
    }
  }
});

test('年収200万〜2000万円の10万円刻みで、年収が増えれば手取りも増える', () => {
  let prev = 0;
  for (let i = 2000000; i <= 20000000; i += 100000) {
    const t = calcTakeHome({ income: i }).takeHome;
    assert.ok(t > prev, `${i}: ${t} <= ${prev}`);
    prev = t;
  }
});

test('年収500万円（うち賞与100万円）', () => {
  const r = calcTakeHome({ income: 5000000, bonus: 1000000 });
  // 月給33.3万 → 標準報酬34万。健保 340,000×5.04%=17,136/月、賞与50万×2回 25,200×2
  assert.equal(r.health, 17136 * 12 + 50400);
  // 厚年 340,000×9.15%=31,110/月、賞与 45,750×2
  assert.equal(r.pension, 31110 * 12 + 91500);
  // 所得税: 356万-745,852-104万 → 1,774,000 ×5% ×1.021 → 90,500
  assert.equal(r.incomeTax, 90500);
  // 住民税: 356万-745,852-43万 → 2,384,000 ×10% -2,500 +5,000
  assert.equal(r.residentTax, 240900);
  assert.equal(r.takeHome, 3922748);
});

test('賞与の標準賞与額の上限（厚生年金は1回150万円）', () => {
  const r = calcTakeHome({ income: 20000000, bonus: 6000000 });
  // 1回300万円 → 厚年は150万円で計算: 1,500,000×9.15%=137,250 ×2回
  const monthlyPart = Math.round(650000 * 0.183 / 2) * 12;
  assert.equal(r.pension, monthlyPart + 137250 * 2);
});

test('都道府県別の健康保険料率（大阪府 10.13%）', () => {
  const r = calcTakeHome({ income: 5000000, pref: '大阪府' });
  // 410,000 × (10.13%+0.23%) ÷ 2 = 21,238/月
  assert.equal(r.health, 21238 * 12);
  assert.equal(Object.keys(PREF_HEALTH).length, 47);
});
