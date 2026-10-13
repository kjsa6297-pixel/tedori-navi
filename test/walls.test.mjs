import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART_WALLS, WALL_TYPES } from '../src/walls.js';
import { calcTakeHome } from '../src/tax.js';

test('年収の壁：低い順に並び、型・出典がそろっている', () => {
  for (const [k, g] of Object.entries(PART_WALLS)) {
    const ats = g.walls.filter((w) => w.at).map((w) => w.at);
    assert.deepEqual(ats, [...ats].sort((a, b) => a - b), k);
    for (const w of g.walls) {
      assert.ok(WALL_TYPES[w.type] && w.title && w.what && w.note && w.src.length === 2, `${k}: ${w.title}`);
      assert.ok(w.impact >= 0 && w.impact <= 3);
    }
  }
});

test('年収の壁：所得の基準＋給与所得控除74万円で換算した金額と一致する', () => {
  const toIncome = (shotoku) => (shotoku + 740000) / 10000;
  const sp = Object.fromEntries(PART_WALLS.spouse.walls.filter((w) => w.at).map((w) => [w.type + w.at, w.at]));
  assert.equal(sp.resident119, toIncome(450000)); // 住民税 非課税限度額45万
  assert.equal(sp.family136, toIncome(620000)); // 配偶者控除 合計所得62万
  assert.equal(sp.family169, toIncome(950000)); // 配偶者特別控除 満額 95万
  assert.equal(sp.income178, toIncome(1040000)); // 基礎控除104万
  assert.equal(sp.family207, toIncome(1330000)); // 配偶者特別控除 133万
  const st = Object.fromEntries(PART_WALLS.student.walls.filter((w) => w.at).map((w) => [w.type + w.at, w.at]));
  assert.equal(st.family159, toIncome(850000)); // 特定親族特別控除 満額 85万
  assert.equal(st.family197, toIncome(1230000)); // 特定親族特別控除 123万
});

test('計算エンジンでも所得税は給与収入178万円まで0（社会保険料なしの場合に相当）', () => {
  // エンジンは社会保険料を差し引くので、178万円では確実に0
  assert.equal(calcTakeHome({ income: 1780000 }).incomeTax, 0);
});
