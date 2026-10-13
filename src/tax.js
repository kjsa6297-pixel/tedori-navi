// 会社員の年間手取り計算（2026年・令和8年分）
// ブラウザと Node の両方で使う純粋関数のみ。制度が変わったら RULES と各表を更新する。
//
// 前提:
// - 給与収入のみ。月給 =（年収 − 賞与）÷ 12 として標準報酬月額を決める。賞与は年2回・同額で支給
// - 健康保険は協会けんぽ（都道府県別の料率、既定は東京都）、雇用保険は一般の事業
// - 所得税は令和8年分。住民税は同じ所得に対して課税される額（実際の納付は翌年度）
// - 配偶者は収入なし、扶養親族は16歳以上の一般扶養親族

export const RULES = {
  label: '2026年（令和8年）',
  updated: '2026-10-12',
  healthRate: 0.0985, // 協会けんぽ東京 令和8年度（既定値）
  kaigoRate: 0.0162, // 介護保険（40〜64歳）令和8年度
  kodomoRate: 0.0023, // 子ども・子育て支援金 令和8年4月分〜
  pensionRate: 0.183, // 厚生年金
  koyouRate: 0.005, // 雇用保険 労働者負担 令和8年度 一般の事業
  residentRate: 0.1,
  residentPerCapita: 5000, // 均等割（森林環境税 1,000円含む）
};

// 協会けんぽ 令和8年度 都道府県別の健康保険料率（介護保険・支援金を除く、労使合計）
export const PREF_HEALTH = {
  北海道: 0.1028, 青森県: 0.0985, 岩手県: 0.0951, 宮城県: 0.1010, 秋田県: 0.1001, 山形県: 0.0975, 福島県: 0.0950,
  茨城県: 0.0952, 栃木県: 0.0982, 群馬県: 0.0968, 埼玉県: 0.0967, 千葉県: 0.0973, 東京都: 0.0985, 神奈川県: 0.0992,
  新潟県: 0.0921, 富山県: 0.0959, 石川県: 0.0970, 福井県: 0.0971, 山梨県: 0.0955, 長野県: 0.0963, 岐阜県: 0.0980,
  静岡県: 0.0961, 愛知県: 0.0993, 三重県: 0.0977, 滋賀県: 0.0988, 京都府: 0.0989, 大阪府: 0.1013, 兵庫県: 0.1012,
  奈良県: 0.0991, 和歌山県: 0.1006, 鳥取県: 0.0986, 島根県: 0.0994, 岡山県: 0.1005, 広島県: 0.0978, 山口県: 0.1015,
  徳島県: 0.1024, 香川県: 0.1002, 愛媛県: 0.0998, 高知県: 0.1005, 福岡県: 0.1011, 佐賀県: 0.1055, 長崎県: 0.1006,
  熊本県: 0.1008, 大分県: 0.1008, 宮崎県: 0.0977, 鹿児島県: 0.1013, 沖縄県: 0.0944,
};

// 賞与の標準賞与額の上限
const HEALTH_BONUS_CAP_YEAR = 5730000; // 健康保険：年度累計
const PENSION_BONUS_CAP_EACH = 1500000; // 厚生年金：1回あたり

// 健康保険の標準報酬月額 [標準報酬, この金額未満]
const HEALTH_GRADES = [
  [58000, 63000], [68000, 73000], [78000, 83000], [88000, 93000], [98000, 101000],
  [104000, 107000], [110000, 114000], [118000, 122000], [126000, 130000], [134000, 138000],
  [142000, 146000], [150000, 155000], [160000, 165000], [170000, 175000], [180000, 185000],
  [190000, 195000], [200000, 210000], [220000, 230000], [240000, 250000], [260000, 270000],
  [280000, 290000], [300000, 310000], [320000, 330000], [340000, 350000], [360000, 370000],
  [380000, 395000], [410000, 425000], [440000, 455000], [470000, 485000], [500000, 515000],
  [530000, 545000], [560000, 575000], [590000, 605000], [620000, 635000], [650000, 665000],
  [680000, 695000], [710000, 730000], [750000, 770000], [790000, 810000], [830000, 855000],
  [880000, 905000], [930000, 955000], [980000, 1005000], [1030000, 1055000], [1090000, 1115000],
  [1150000, 1175000], [1210000, 1235000], [1270000, 1295000], [1330000, 1355000], [1390000, Infinity],
];

export function healthStandard(monthly) {
  return HEALTH_GRADES.find(([, upper]) => monthly < upper)[0];
}

// 厚生年金の等級は 88,000〜650,000 円で健康保険と同じ区切り
export function pensionStandard(monthly) {
  return Math.min(650000, Math.max(88000, healthStandard(monthly)));
}

// 給与所得控除後の金額（所得税: 令和8年分 最低保障74万円）
function employmentIncome(income, minimum, minimumUpTo) {
  // 660万円未満は4,000円単位で計算する（所得税法 別表第五）
  const base = income < 6600000 ? Math.floor(income / 4000) * 4000 : income;
  let deduction;
  if (income <= minimumUpTo) deduction = minimum;
  else if (income <= 3600000) deduction = base * 0.3 + 80000;
  else if (income <= 6600000) deduction = base * 0.2 + 440000;
  else if (income <= 8500000) deduction = base * 0.1 + 1100000;
  else deduction = 1950000;
  return Math.max(0, Math.floor(base - deduction));
}

// 所得税の基礎控除（令和8・9年分の特例加算を含む）
function basicDeductionIT(totalIncome) {
  if (totalIncome <= 4890000) return 1040000;
  if (totalIncome <= 6550000) return 670000;
  if (totalIncome <= 23500000) return 620000;
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

function basicDeductionRT(totalIncome) {
  if (totalIncome <= 24000000) return 430000;
  if (totalIncome <= 24500000) return 290000;
  if (totalIncome <= 25000000) return 150000;
  return 0;
}

// 配偶者控除（配偶者の収入なし）[所得税, 住民税, 調整控除の人的控除差]
function spouseDeduction(totalIncome) {
  if (totalIncome <= 9000000) return [380000, 330000, 50000];
  if (totalIncome <= 9500000) return [260000, 220000, 40000];
  if (totalIncome <= 10000000) return [130000, 110000, 20000];
  return [0, 0, 0];
}

const IT_BRACKETS = [
  [1949000, 0.05, 0], [3299000, 0.1, 97500], [6949000, 0.2, 427500], [8999000, 0.23, 636000],
  [17999000, 0.33, 1536000], [39999000, 0.4, 2796000], [Infinity, 0.45, 4796000],
];

export function incomeTaxRate(taxable) {
  return IT_BRACKETS.find(([upper]) => taxable <= upper)[1];
}

function incomeTax(taxable) {
  if (taxable <= 0) return 0;
  const [, rate, sub] = IT_BRACKETS.find(([upper]) => taxable <= upper);
  // 復興特別所得税 2.1% を含め、100円未満切り捨て
  return Math.floor(((taxable * rate - sub) * 1.021) / 100) * 100;
}

const floor1000 = (n) => Math.max(0, Math.floor(n / 1000) * 1000);

/**
 * @param {object} p
 * @param {number} p.income 年収（円）
 * @param {boolean} [p.over40] 40〜64歳（介護保険あり）
 * @param {boolean} [p.spouse] 配偶者控除（配偶者の収入なし）
 * @param {number} [p.dependents] 16歳以上の扶養親族の人数
 * @param {number} [p.ideco] iDeCoの掛金（年額・円）。小規模企業共済等掛金控除として全額を所得から差し引く
 */
export function calcTakeHome({ income, bonus = 0, pref = '東京都', over40 = false, spouse = false, dependents = 0, ideco = 0 }) {
  income = Math.max(0, Math.round(income));
  bonus = Math.min(income, Math.max(0, Math.round(bonus)));
  const monthly = (income - bonus) / 12;
  const healthRate = (PREF_HEALTH[pref] ?? RULES.healthRate) + RULES.kodomoRate + (over40 ? RULES.kaigoRate : 0);
  // 賞与は年2回・同額。標準賞与額は1,000円未満切り捨て
  const bonusEach = Math.floor(bonus / 2 / 1000) * 1000;

  // 社会保険料（本人負担）
  const healthStd = healthStandard(monthly);
  const healthMonthly = Math.round(healthStd * healthRate / 2);
  const pensionMonthly = Math.round(pensionStandard(monthly) * RULES.pensionRate / 2);
  const healthBonus = bonusEach ? Math.round(Math.min(bonusEach * 2, HEALTH_BONUS_CAP_YEAR) * healthRate / 2) : 0;
  const pensionBonus = Math.round(Math.min(bonusEach, PENSION_BONUS_CAP_EACH) * RULES.pensionRate / 2) * 2;
  const health = healthMonthly * 12 + healthBonus;
  const pension = pensionMonthly * 12 + pensionBonus;
  const koyou = Math.round(income * RULES.koyouRate);
  const social = health + pension + koyou;

  // 所得税
  const totalIncome = employmentIncome(income, 740000, 2200000);
  const [spIT, spRT, spDiff] = spouse ? spouseDeduction(totalIncome) : [0, 0, 0];
  const taxableIT = floor1000(totalIncome - social - ideco - basicDeductionIT(totalIncome) - spIT - 380000 * dependents);
  const itax = incomeTax(taxableIT);

  // 住民税（2026年の所得にかかる令和9年度分。給与所得控除の最低保障は所得税と同じ74万円）
  const totalIncomeRT = employmentIncome(income, 740000, 2200000);
  const taxableRT = floor1000(totalIncomeRT - social - ideco - basicDeductionRT(totalIncomeRT) - spRT - 330000 * dependents);
  const family = (spouse ? 1 : 0) + dependents;
  const noIncomeLevy = family ? totalIncomeRT <= 350000 * (family + 1) + 420000 : totalIncomeRT <= 450000;
  const noPerCapita = family ? totalIncomeRT <= 350000 * (family + 1) + 310000 : totalIncomeRT <= 450000;
  let incomeLevy = 0;
  if (!noIncomeLevy && taxableRT > 0) {
    const diff = totalIncomeRT <= 25000000 ? 50000 + spDiff + 50000 * dependents : 0;
    const adjust = taxableRT <= 2000000
      ? Math.min(diff, taxableRT) * 0.05
      : Math.max((diff - (taxableRT - 2000000)) * 0.05, diff ? 2500 : 0);
    incomeLevy = Math.max(0, Math.floor((taxableRT * RULES.residentRate - adjust) / 100) * 100);
  }
  const rtax = incomeLevy + (noPerCapita ? 0 : RULES.residentPerCapita);

  const takeHome = income - social - itax - rtax;
  const marginalIT = taxableIT > 0 ? incomeTaxRate(taxableIT) : 0;

  // ふるさと納税で自己負担2,000円に収まる寄付額の目安
  const furusato = incomeLevy > 0
    ? Math.floor((incomeLevy * 0.2 / (0.9 - marginalIT * 1.021) + 2000) / 1000) * 1000
    : 0;

  return {
    input: { income, bonus, pref, over40, spouse, dependents, ideco },
    income, monthly: Math.round(monthly), healthStd, totalIncome,
    health, pension, koyou, social,
    incomeTax: itax, residentTax: rtax, tax: itax + rtax,
    takeHome, takeHomeMonthly: Math.round(takeHome / 12),
    rate: income ? takeHome / income : 0,
    taxableIT, taxableRT, marginalIT,
    furusato,
  };
}

// 所得控除が1円増えたときに軽くなる税金の割合（iDeCo などの節税額の目安）
export function deductionValue(r) {
  return r.marginalIT * 1.021 + (r.taxableRT > 0 ? RULES.residentRate : 0);
}

// iDeCoの掛金（年額）で軽くなる所得税＋住民税（円）。課税所得を超える分は節税にならないことも反映
// r は calcTakeHome の結果
export function idecoSaving(r, annual) {
  return r.tax - calcTakeHome({ ...r.input, ideco: (r.input.ideco || 0) + annual }).tax;
}

export const yen = (n) => Math.round(n).toLocaleString('ja-JP');
export const man = (n, digits = 1) => (n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: digits });
