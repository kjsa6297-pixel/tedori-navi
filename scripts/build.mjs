#!/usr/bin/env node
// サイト全体を dist/ に生成する。依存パッケージなし。
//   node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTakeHome, deductionValue, RULES, yen, man } from '../src/tax.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const SITE = config.siteUrl.replace(/\/$/, '');
const TODAY = new Date().toISOString().slice(0, 10);

// 年収別ページを作る範囲（万円）
const PAGE_MIN = 200;
const PAGE_MAX = 2000;
const PAGE_STEP = 10;
const pageIncomes = [];
for (let n = PAGE_MIN; n <= PAGE_MAX; n += PAGE_STEP) pageIncomes.push(n);
const hasPage = (n) => n >= PAGE_MIN && n <= PAGE_MAX && n % PAGE_STEP === 0;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x, d = 1) => (x * 100).toFixed(d);
const calc = (n, opt = {}) => calcTakeHome({ income: n * 10000, ...opt });

// ─── 広告・アフィリエイト ──────────────────────────────────
const adHead = config.adsenseClient
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.adsenseClient)}" crossorigin="anonymous"></script>`
  : '';
const adSlot = () => (config.adsenseClient
  ? `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(config.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
  : '');
const hasAffiliate = Object.values(config.affiliates).some((a) => a.url);
const cta = (key) => {
  const a = config.affiliates[key];
  return a?.url ? `<a class="cta" href="${esc(a.url)}" target="_blank" rel="sponsored noopener">${esc(a.label)}<span class="pr">PR</span></a>` : '';
};

// ─── 共通レイアウト ──────────────────────────────────────
const CSS = `
:root{--bg:#f6f7f9;--surface:#fff;--text:#1a1d23;--sub:#5b6270;--line:#e3e6eb;--accent:#0b6e4f;--accent-soft:#e3f2ec;
--c-take:#0b6e4f;--c-social:#4a7fd4;--c-it:#d48a1f;--c-rt:#b5523b;--warn:#8a5a00;--warn-bg:#fff6e0}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12151a;--surface:#1b1f26;--text:#e8eaee;--sub:#a0a7b4;--line:#2c323c;
--accent:#4cc79a;--accent-soft:#163329;--c-take:#4cc79a;--c-social:#7aa5ef;--c-it:#eab05a;--c-rt:#e2826b;--warn:#f0c46a;--warn-bg:#2e2611}}
:root[data-theme="dark"]{--bg:#12151a;--surface:#1b1f26;--text:#e8eaee;--sub:#a0a7b4;--line:#2c323c;--accent:#4cc79a;--accent-soft:#163329;
--c-take:#4cc79a;--c-social:#7aa5ef;--c-it:#eab05a;--c-rt:#e2826b;--warn:#f0c46a;--warn-bg:#2e2611}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.75;font-size:16px}
a{color:var(--accent)}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.top div{max-width:760px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.logo{font-weight:800;text-decoration:none;color:var(--text);font-size:18px}
.logo b{color:var(--accent)}
.top nav{display:flex;gap:14px;font-size:14px;margin-left:auto}
.top nav a{color:var(--sub);text-decoration:none}
main{max-width:760px;margin:0 auto;padding:24px 16px 56px}
.crumb{font-size:13px;color:var(--sub);margin-bottom:8px}
.crumb a{color:var(--sub)}
h1{font-size:clamp(22px,5.4vw,30px);line-height:1.4;margin-bottom:10px}
h2{font-size:20px;margin:36px 0 12px;padding-left:10px;border-left:4px solid var(--accent)}
p{margin-bottom:12px}
.lead{color:var(--sub)}
.box{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 12px}
.tile .k{font-size:12px;color:var(--sub)}
.tile .v{font-size:clamp(18px,5vw,26px);font-weight:800;font-variant-numeric:tabular-nums}
.tile.main{background:var(--accent-soft);border-color:transparent}
.tile.main .v{color:var(--accent)}
@media (max-width:520px){.tiles{grid-template-columns:1fr 1fr}.tile.main{grid-column:1/-1}}
.bar{display:flex;height:22px;border-radius:6px;overflow:hidden;margin:6px 0 14px;gap:2px}
.bar span{display:block}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:var(--sub);margin-bottom:6px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;background:var(--surface);border-radius:12px;overflow:hidden}
th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:right;font-size:15px}
th:first-child,td:first-child{text-align:left}
td:not(:first-child){white-space:nowrap}
@media (max-width:520px){th,td{padding:8px;font-size:14px}}
.inrow span{white-space:nowrap}
thead th{font-size:13px;color:var(--sub);font-weight:600;background:var(--bg)}
tr.hl td{background:var(--accent-soft);font-weight:700}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
.wrap table{border-radius:0}
ul.points{list-style:none;display:grid;gap:10px}
ul.points li{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.warn{background:var(--warn-bg);color:var(--warn);border-radius:12px;padding:12px 14px;font-size:14px}
.cta{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;margin-top:8px}
:root[data-theme="dark"] .cta{color:#0d1f18}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .cta{color:#0d1f18}}
.pr{font-size:11px;border:1px solid currentColor;border-radius:4px;padding:0 4px;opacity:.8}
.pager{display:flex;justify-content:space-between;gap:8px;margin-top:28px;font-size:15px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips a{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;font-size:14px;color:var(--text)}
.ad{margin:28px 0;min-height:100px}
form.calc{display:grid;gap:14px}
form.calc label{font-weight:700;font-size:14px;display:block;margin-bottom:4px}
.inrow{display:flex;align-items:center;gap:8px}
form.calc input[type=number]{width:100%;font-size:22px;font-weight:700;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
form.calc select{font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.checks{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:15px}
.checks label{font-weight:400!important;display:flex!important;align-items:center;gap:6px}
footer{border-top:1px solid var(--line);color:var(--sub);font-size:13px;text-align:center;padding:24px 16px}
footer a{color:var(--sub)}
`;

function layout({ title, description, path, body, head = '' }) {
  const url = `${SITE}/${path}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%92%B4%3C/text%3E%3C/svg%3E">
${adHead}
${head}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div>
<a class="logo" href="${SITE}/">💴 手取り<b>ナビ</b></a>
<nav><a href="${SITE}/">計算する</a><a href="${SITE}/nenshu/">年収別一覧</a><a href="${SITE}/kabe.html">手取りの壁</a></nav>
</div></header>
<main>
${body}
</main>
<footer>
<p>${RULES.label}の制度で計算した概算です。実際の金額は勤務先や自治体、賞与の有無などで変わります。</p>
${hasAffiliate ? '<p>当サイトはアフィリエイトプログラムを利用しています（PR表記のリンク）。</p>' : ''}
<p><a href="${SITE}/about.html">計算方法と前提</a>　<a href="${SITE}/privacy.html">プライバシーポリシー</a></p>
<p>© ${esc(config.siteName)}</p>
</footer>
</body>
</html>
`;
}

function write(path, html) {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ─── 部品 ─────────────────────────────────────────────────
function breakdown(r) {
  const seg = [
    ['手取り', r.takeHome, 'var(--c-take)'],
    ['社会保険料', r.social, 'var(--c-social)'],
    ['所得税', r.incomeTax, 'var(--c-it)'],
    ['住民税', r.residentTax, 'var(--c-rt)'],
  ];
  return `
<div class="legend">${seg.map(([k, , c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}</div>
<div class="bar" role="img" aria-label="年収の内訳">${seg.map(([k, v, c]) => `<span title="${k}" style="width:${(v / r.income) * 100}%;background:${c}"></span>`).join('')}</div>
<div class="wrap"><table>
<thead><tr><th>項目</th><th>年額</th><th>月額の目安</th></tr></thead>
<tbody>
<tr><td>年収（額面）</td><td>${yen(r.income)}円</td><td>${yen(r.income / 12)}円</td></tr>
<tr><td>健康保険料<small>（支援金含む）</small></td><td>${yen(r.health)}円</td><td>${yen(r.health / 12)}円</td></tr>
<tr><td>厚生年金保険料</td><td>${yen(r.pension)}円</td><td>${yen(r.pension / 12)}円</td></tr>
<tr><td>雇用保険料</td><td>${yen(r.koyou)}円</td><td>${yen(r.koyou / 12)}円</td></tr>
<tr><td>所得税<small>（復興税含む）</small></td><td>${yen(r.incomeTax)}円</td><td>${yen(r.incomeTax / 12)}円</td></tr>
<tr><td>住民税</td><td>${yen(r.residentTax)}円</td><td>${yen(r.residentTax / 12)}円</td></tr>
<tr class="hl"><td>手取り</td><td>${yen(r.takeHome)}円</td><td>${yen(r.takeHomeMonthly)}円</td></tr>
</tbody></table></div>`;
}

function incomeLink(n, text) {
  return hasPage(n) ? `<a href="${SITE}/nenshu/${n}.html">${text}</a>` : text;
}

// 2026年の手取りの壁（所得の基準を年収に換算して、前後の手取りを比べる）
function firstIncomeWhere(pred) {
  for (let i = 1000000; i <= 30000000; i += 1000) if (pred(calcTakeHome({ income: i }))) return i;
  return null;
}
const WALLS = [
  {
    key: 'basic67',
    title: '所得税の基礎控除が104万円→67万円に下がる',
    at: firstIncomeWhere((r) => r.totalIncome > 4890000),
    opt: {},
    why: '2026・2027年は特例で、合計所得489万円以下なら基礎控除が104万円に上乗せされています。所得が489万円を1円でも超えると67万円になり、課税される所得が一気に37万円増えます。',
  },
  {
    key: 'basic62',
    title: '所得税の基礎控除が67万円→62万円に下がる',
    at: firstIncomeWhere((r) => r.totalIncome > 6550000),
    opt: {},
    why: '合計所得655万円を超えると、特例の上乗せ（5万円）がなくなり、基礎控除は本則の62万円になります。',
  },
  {
    key: 'spouse26',
    title: '配偶者控除が38万円→26万円に下がる（配偶者を扶養している人）',
    at: firstIncomeWhere((r) => r.totalIncome > 9000000),
    opt: { spouse: true },
    why: '本人の合計所得が900万円を超えると、配偶者控除は段階的に小さくなります。',
  },
  {
    key: 'spouse13',
    title: '配偶者控除が26万円→13万円に下がる（配偶者を扶養している人）',
    at: firstIncomeWhere((r) => r.totalIncome > 9500000),
    opt: { spouse: true },
    why: '本人の合計所得が950万円を超えると、配偶者控除はさらに小さくなります。',
  },
  {
    key: 'spouse0',
    title: '配偶者控除がなくなる（配偶者を扶養している人）',
    at: firstIncomeWhere((r) => r.totalIncome > 10000000),
    opt: { spouse: true },
    why: '本人の合計所得が1,000万円を超えると、配偶者控除は受けられません。',
  },
].map((w) => {
  const before = calcTakeHome({ income: w.at - 1000, ...w.opt });
  const after = calcTakeHome({ income: w.at, ...w.opt });
  // 壁を越えて手取りが元に戻る年収（1万円刻み）
  let recover = w.at;
  while (calcTakeHome({ income: recover, ...w.opt }).takeHome < before.takeHome) recover += 10000;
  return { ...w, before, after, recover };
});

// ─── 年収別ページ ──────────────────────────────────────────
function points(n, r) {
  const list = [];
  const up = calc(n + 10);
  const gain = up.takeHome - r.takeHome;
  list.push(`課税される所得は約${man(r.taxableIT, 0)}万円で、所得税率は<strong>${pct(r.marginalIT, 0)}%</strong>（住民税10%と合わせると約${pct(r.marginalIT * 1.021 + 0.1, 0)}%）です。`);
  list.push(gain > 0
    ? `ここから年収が10万円増えると、手取りは<strong>約${yen(gain)}円</strong>増えます（増えた分のうち手元に残るのは${pct(gain / 100000, 0)}%）。`
    : `ここから年収が10万円増えても、手取りは${yen(-gain)}円<strong>減ります</strong>。<a href="${SITE}/kabe.html">手取りの壁</a>の手前です。`);
  if (r.monthly >= 635000) list.push('月給（年収÷12）が63.5万円以上なので、厚生年金保険料は上限（月59,475円）に達しています。これ以上年収が増えても厚生年金保険料は増えません。');
  if (n >= 850) list.push('給与所得控除は年収850万円で上限（195万円）に達しています。ここから先は、増えた収入がそのまま課税対象になります。');
  for (const w of WALLS) {
    const wn = w.at / 10000;
    if (Math.abs(wn - n) <= 40) {
      list.push(`年収約${man(w.at)}万円に「${esc(w.title)}」壁があります。越えた直後は手取りが約${yen(w.before.takeHome - w.after.takeHome)}円減り、元に戻るのは年収約${man(w.recover, 0)}万円です。<a href="${SITE}/kabe.html#${w.key}">詳しく</a>`);
    }
  }
  return list;
}

function nenshuPage(n) {
  const r = calc(n);
  const variants = [
    ['独身・40歳未満', r],
    ['独身・40歳以上', calc(n, { over40: true })],
    ['配偶者を扶養（収入なし）', calc(n, { spouse: true })],
    ['配偶者＋16歳以上の子1人を扶養', calc(n, { spouse: true, dependents: 1 })],
  ];
  const ups = [10, 30, 50, 100, 200].map((d) => [d, calc(n + d)]);
  const ideco = Math.round(240000 * deductionValue(r));
  const title = `年収${n}万円の手取りは約${man(r.takeHome, 0)}万円【${RULES.label}】月の手取り・税金の内訳`;
  const desc = `年収${n}万円の手取りは年間約${man(r.takeHome)}万円、月約${man(r.takeHomeMonthly)}万円（${RULES.label}・独身）。社会保険料・所得税・住民税の内訳、年収が上がると手取りがいくら増えるか、扶養がある場合の手取りも計算。`;
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › <a href="${SITE}/nenshu/">年収別の手取り</a> › 年収${n}万円</div>
<h1>年収${n}万円の手取りは約${man(r.takeHome, 0)}万円</h1>
<p class="lead">${RULES.label}の税金・社会保険料で計算（独身・40歳未満・賞与なしの場合）。</p>
<div class="tiles">
  <div class="tile main"><div class="k">年間の手取り</div><div class="v">${man(r.takeHome)}万円</div></div>
  <div class="tile"><div class="k">月の手取り</div><div class="v">${man(r.takeHomeMonthly)}万円</div></div>
  <div class="tile"><div class="k">手取り率</div><div class="v">${pct(r.rate)}%</div></div>
</div>

<h2>年収${n}万円の内訳</h2>
${breakdown(r)}

<h2>この年収のポイント</h2>
<ul class="points">${points(n, r).map((p) => `<li>${p}</li>`).join('')}</ul>

${adSlot()}

<h2>年収が上がると、手取りはいくら増える？</h2>
<div class="wrap"><table>
<thead><tr><th>年収</th><th>手取り（年）</th><th>増える手取り</th><th>残る割合</th></tr></thead>
<tbody>
<tr class="hl"><td>${n}万円（今）</td><td>${man(r.takeHome)}万円</td><td>—</td><td>—</td></tr>
${ups.map(([d, u]) => `<tr><td>${incomeLink(n + d, `${n + d}万円`)}（+${d}万）</td><td>${man(u.takeHome)}万円</td><td>+${man(u.takeHome - r.takeHome)}万円</td><td>${pct((u.takeHome - r.takeHome) / (d * 10000), 0)}%</td></tr>`).join('\n')}
</tbody></table></div>
<p style="margin-top:12px">昇給や転職で年収が${ups[2][0]}万円上がっても、手元に増えるのは約${man(ups[2][1].takeHome - r.takeHome)}万円です。交渉や転職先を比べるときは、額面ではなく手取りの差で考えるのがおすすめです。</p>
${cta('career')}

<h2>家族構成・年齢による違い</h2>
<div class="wrap"><table>
<thead><tr><th>条件</th><th>手取り（年）</th><th>月の手取り</th></tr></thead>
<tbody>${variants.map(([k, v]) => `<tr><td>${k}</td><td>${man(v.takeHome)}万円</td><td>${man(v.takeHomeMonthly)}万円</td></tr>`).join('')}</tbody>
</table></div>
<p style="margin-top:12px">40歳になると介護保険料が加わります。16歳未満の子どもは扶養控除の対象外のため、税金は変わりません。</p>

<h2>税金を減らす方法の目安</h2>
<ul class="points">
<li><strong>ふるさと納税：</strong>自己負担2,000円で済む寄付額の目安は<strong>約${man(r.furusato)}万円</strong>です（独身の場合）。他の控除があると上限は下がるので、少し余裕をもって寄付しましょう。${cta('furusato')}</li>
<li><strong>iDeCo：</strong>月2万円（年24万円）積み立てると、所得税と住民税が<strong>年約${yen(ideco)}円</strong>軽くなります。積み立てたお金は原則60歳まで引き出せない点に注意してください。${cta('ideco')}</li>
</ul>

<div class="box" style="margin-top:28px">
<p style="margin:0">年齢・扶養人数を変えて計算したいときは <a href="${SITE}/?income=${n}">手取り計算ツール</a> へ。</p>
</div>

<div class="pager">
${hasPage(n - PAGE_STEP) ? `<a href="${SITE}/nenshu/${n - PAGE_STEP}.html">← 年収${n - PAGE_STEP}万円</a>` : '<span></span>'}
${hasPage(n + PAGE_STEP) ? `<a href="${SITE}/nenshu/${n + PAGE_STEP}.html">年収${n + PAGE_STEP}万円 →</a>` : '<span></span>'}
</div>`;
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `年収${n}万円の手取りはいくら？`, acceptedAnswer: { '@type': 'Answer', text: `${RULES.label}の制度で、独身・40歳未満なら年間約${man(r.takeHome)}万円、月約${man(r.takeHomeMonthly)}万円です。` } },
      { '@type': 'Question', name: `年収${n}万円から50万円上がると手取りはいくら増える？`, acceptedAnswer: { '@type': 'Answer', text: `約${man(ups[2][1].takeHome - r.takeHome)}万円増えます。` } },
    ],
  };
  return layout({
    title, description: desc, path: `nenshu/${n}.html`, body,
    head: `<script type="application/ld+json">${JSON.stringify(faq)}</script>`,
  });
}

// ─── 年収別一覧（早見表） ──────────────────────────────────
function nenshuIndex() {
  const rows = pageIncomes.map((n) => {
    const r = calc(n);
    const up = calc(n + 50);
    return `<tr><td><a href="${n}.html">${n}万円</a></td><td>${man(r.takeHome)}万円</td><td>${man(r.takeHomeMonthly)}万円</td><td>${pct(r.rate)}%</td><td>+${man(up.takeHome - r.takeHome)}万円</td></tr>`;
  }).join('\n');
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 年収別の手取り</div>
<h1>年収別の手取り早見表【${RULES.label}】</h1>
<p class="lead">年収${PAGE_MIN}万〜${PAGE_MAX}万円の手取りを10万円刻みで一覧にしました（独身・40歳未満・賞与なし）。年収をタップすると、内訳や家族構成別の手取りが見られます。</p>
${adSlot()}
<div class="wrap"><table>
<thead><tr><th>年収</th><th>手取り（年）</th><th>月の手取り</th><th>手取り率</th><th>+50万円で増える手取り</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
  return layout({
    title: `年収別の手取り早見表【${RULES.label}】200万〜2000万円`,
    description: `年収${PAGE_MIN}万〜${PAGE_MAX}万円の手取りを10万円刻みで一覧。月の手取り、手取り率、年収が50万円上がったときに増える手取りもわかります。`,
    path: 'nenshu/', body,
  });
}

// ─── 手取りの壁 ────────────────────────────────────────────
function kabePage() {
  const sections = WALLS.map((w) => `
<h2 id="${w.key}">年収約${man(w.at)}万円：${esc(w.title)}</h2>
<p>${esc(w.why)}</p>
<div class="wrap"><table>
<thead><tr><th>年収</th><th>手取り（年）</th></tr></thead>
<tbody>
<tr><td>${yen(w.before.income)}円</td><td>${yen(w.before.takeHome)}円</td></tr>
<tr class="hl"><td>${yen(w.after.income)}円（壁を越えた直後）</td><td>${yen(w.after.takeHome)}円（${yen(w.after.takeHome - w.before.takeHome)}円）</td></tr>
<tr><td>${yen(w.recover)}円（手取りが元に戻る）</td><td>${yen(calcTakeHome({ income: w.recover, ...w.opt }).takeHome)}円</td></tr>
</tbody></table></div>
<p style="margin-top:12px">年収が約${man(w.at)}万〜${man(w.recover, 0)}万円の間は、収入が増えても手取りが壁の手前より少なくなります。昇給の時期や額を調整できる場合や、iDeCoなどで所得を下げられる場合は、この区間を意識すると損を避けられます。</p>`).join('\n');
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 手取りの壁</div>
<h1>${RULES.label}の「手取りの壁」：年収が増えると手取りが減るポイント</h1>
<p class="lead">2026年は税制改正で基礎控除が大きく変わり、年収によっては<strong>収入が増えると手取りが減る</strong>ポイントがあります。会社員（賞与なし）の場合で、壁の前後の手取りを計算しました。</p>
<div class="warn">「103万円の壁」「130万円の壁」など、パート・アルバイトの扶養に関する壁はこのページの対象外です（今後追加予定）。</div>
${adSlot()}
${sections}
<h2>社会保険料の等級による小さな段差</h2>
<p>社会保険料は月給を「標準報酬月額」の等級に当てはめて決まるため、月給が等級の境目を越えると保険料が一段上がります。境目のすぐ上では、昇給額より保険料の増加が大きくなり、手取りがわずかに減ることがあります（年数千円〜3万円程度）。</p>`;
  return layout({
    title: `${RULES.label}の手取りの壁｜年収が増えると手取りが減るのはいくら？`,
    description: `2026年の税制改正で生まれた「手取りの壁」。年収約${man(WALLS[0].at, 0)}万円で基礎控除が104万円→67万円に下がり、手取りが約${man(WALLS[0].before.takeHome - WALLS[0].after.takeHome)}万円減ります。壁の前後の手取りと、元に戻る年収を計算。`,
    path: 'kabe.html', body,
  });
}

// ─── トップ（計算ツール） ──────────────────────────────────
function indexPage() {
  const popular = [300, 400, 500, 600, 700, 800, 1000, 1200, 1500];
  const body = `
<h1>手取り計算ツール【${RULES.label}】</h1>
<p class="lead">年収を入れるだけで、手取りと税金・社会保険料の内訳、年収が上がったときに増える手取りがわかります。2026年の基礎控除の引き上げにも対応しています。</p>
<form class="calc box" id="calc" onsubmit="return false">
  <div>
    <label for="income">年収（額面）</label>
    <div class="inrow"><input id="income" type="number" inputmode="decimal" min="100" max="5000" step="1" value="500"><span>万円</span></div>
  </div>
  <div class="checks">
    <label><input id="over40" type="checkbox">40〜64歳</label>
    <label><input id="spouse" type="checkbox">配偶者を扶養（収入なし）</label>
    <label>16歳以上の扶養親族
      <select id="dependents"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>人</label>
  </div>
</form>
<div id="out" aria-live="polite"></div>
${adSlot()}
<h2>よく見られている年収</h2>
<div class="chips">${popular.map((n) => `<a href="${SITE}/nenshu/${n}.html">年収${n}万円</a>`).join('')}<a href="${SITE}/nenshu/">一覧を見る →</a></div>
<h2>2026年の注目ポイント</h2>
<ul class="points">
<li>所得税の基礎控除が最大104万円に（2026・2027年の特例）。年収約${man(WALLS[0].at, 0)}万円を超えると67万円に下がり、<a href="${SITE}/kabe.html">手取りが減る「壁」</a>があります。</li>
<li>2026年4月分から「子ども・子育て支援金」が健康保険料に上乗せされています。</li>
</ul>
<script type="module">
import { calcTakeHome, yen, man } from './assets/tax.js';
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
if (q.get('income')) $('income').value = q.get('income');
const pct = (x) => (x * 100).toFixed(1);
function row(k, v) { return '<tr><td>' + k + '</td><td>' + yen(v) + '円</td><td>' + yen(v / 12) + '円</td></tr>'; }
function render() {
  const n = Math.min(5000, Math.max(0, parseFloat($('income').value) || 0));
  const opt = { over40: $('over40').checked, spouse: $('spouse').checked, dependents: +$('dependents').value };
  if (n < 100) { $('out').innerHTML = '<p class="warn" style="margin-top:16px">年収100万円以上で計算できます。</p>'; return; }
  const r = calcTakeHome({ income: n * 10000, ...opt });
  const ups = [10, 50, 100].map((d) => [d, calcTakeHome({ income: (n + d) * 10000, ...opt })]);
  const seg = [['手取り', r.takeHome, 'var(--c-take)'], ['社会保険料', r.social, 'var(--c-social)'], ['所得税', r.incomeTax, 'var(--c-it)'], ['住民税', r.residentTax, 'var(--c-rt)']];
  $('out').innerHTML =
    '<div class="tiles"><div class="tile main"><div class="k">年間の手取り</div><div class="v">' + man(r.takeHome) + '万円</div></div>' +
    '<div class="tile"><div class="k">月の手取り</div><div class="v">' + man(r.takeHomeMonthly) + '万円</div></div>' +
    '<div class="tile"><div class="k">手取り率</div><div class="v">' + pct(r.rate) + '%</div></div></div>' +
    '<div class="legend">' + seg.map((s) => '<span><i style="background:' + s[2] + '"></i>' + s[0] + '</span>').join('') + '</div>' +
    '<div class="bar">' + seg.map((s) => '<span style="width:' + (s[1] / r.income * 100) + '%;background:' + s[2] + '"></span>').join('') + '</div>' +
    '<div class="wrap"><table><thead><tr><th>項目</th><th>年額</th><th>月額の目安</th></tr></thead><tbody>' +
    row('健康保険料' + (opt.over40 ? '（介護保険含む）' : ''), r.health) + row('厚生年金保険料', r.pension) + row('雇用保険料', r.koyou) +
    row('所得税', r.incomeTax) + row('住民税', r.residentTax) +
    '<tr class="hl"><td>手取り</td><td>' + yen(r.takeHome) + '円</td><td>' + yen(r.takeHomeMonthly) + '円</td></tr></tbody></table></div>' +
    '<h2>年収が上がると</h2><div class="wrap"><table><thead><tr><th>年収</th><th>手取り（年）</th><th>増える手取り</th></tr></thead><tbody>' +
    ups.map((u) => '<tr><td>' + (n + u[0]) + '万円（+' + u[0] + '万）</td><td>' + man(u[1].takeHome) + '万円</td><td>' + (u[1].takeHome >= r.takeHome ? '+' : '') + man(u[1].takeHome - r.takeHome) + '万円</td></tr>').join('') +
    '</tbody></table></div>' +
    (r.furusato ? '<p style="margin-top:12px">ふるさと納税の上限の目安：<strong>約' + man(r.furusato) + '万円</strong></p>' : '') +
    (Number.isInteger(n) && n >= ${PAGE_MIN} && n <= ${PAGE_MAX} && n % ${PAGE_STEP} === 0 ? '<p><a href="nenshu/' + n + '.html">年収' + n + '万円の詳しい解説を見る →</a></p>' : '');
  history.replaceState(null, '', '?income=' + n);
}
['income', 'over40', 'spouse', 'dependents'].forEach((id) => $(id).addEventListener('input', render));
render();
</script>`;
  return layout({
    title: `手取り計算ツール【${RULES.label}対応】年収から手取り・税金を計算｜${config.siteName}`,
    description: `年収を入れるだけで手取り額、社会保険料・所得税・住民税の内訳、年収アップで増える手取り、ふるさと納税の上限目安がわかる無料ツール。${RULES.label}の基礎控除引き上げ・子ども・子育て支援金に対応。`,
    path: '', body,
  });
}

// ─── 計算方法・プライバシー ────────────────────────────────
function aboutPage() {
  const body = `
<h1>計算方法と前提</h1>
<p>手取りナビは、会社員の手取りを${RULES.label}の制度に基づいて計算しています。最終更新：${RULES.updated}</p>
<h2>前提</h2>
<ul class="points">
<li>給与収入のみで、賞与（ボーナス）はなし。月給 = 年収 ÷ 12 として標準報酬月額を決めています。賞与がある場合、社会保険料は少し変わります。</li>
<li>健康保険は協会けんぽ東京支部（${pct(RULES.healthRate, 2)}%）、介護保険${pct(RULES.kaigoRate, 2)}%（40〜64歳）、子ども・子育て支援金${pct(RULES.kodomoRate, 2)}%、厚生年金${pct(RULES.pensionRate, 1)}%（いずれも本人負担はその半分）、雇用保険${pct(RULES.koyouRate, 1)}%（一般の事業）。</li>
<li>所得税は令和8年分（基礎控除の特例加算、給与所得控除の最低保障74万円を含む）。復興特別所得税2.1%を含みます。</li>
<li>住民税は同じ所得に対する年額（実際は翌年6月から納付）。税率10%、均等割5,000円（森林環境税含む）、給与所得控除は令和8年度の住民税の計算方法（最低保障65万円）を使っています。</li>
<li>配偶者控除は配偶者の収入がない場合、扶養控除は16歳以上の一般の扶養親族として計算しています。生命保険料控除などその他の控除は含みません。</li>
<li>ふるさと納税の上限は「住民税所得割額 × 20% ÷（90% − 所得税率 × 1.021）+ 2,000円」の目安です。</li>
</ul>
<h2>注意</h2>
<p>実際の手取りは、勤務先の健康保険組合、お住まいの自治体、各種控除、通勤手当などにより変わります。正確な金額は給与明細や源泉徴収票、お住まいの自治体の案内でご確認ください。</p>
<p>計算の誤りに気づいた場合は、<a href="https://github.com/kjsa6297-pixel/tedori-navi/issues">GitHub の Issues</a> からお知らせいただけると助かります。</p>`;
  return layout({ title: `計算方法と前提｜${config.siteName}`, description: '手取りナビの計算方法・前提条件・使用している保険料率と税制。', path: 'about.html', body });
}

function privacyPage() {
  const body = `
<h1>プライバシーポリシー</h1>
<h2>入力内容について</h2>
<p>計算ツールに入力した年収などの情報は、お使いのブラウザの中だけで計算され、サーバーには送信・保存されません。</p>
<h2>広告について</h2>
<p>当サイトでは、第三者配信の広告サービス（Google アドセンス等）やアフィリエイトプログラムを利用する場合があります。広告配信事業者は、ユーザーの興味に応じた広告を表示するために Cookie を使用することがあります。Cookie を無効にする方法や Google アドセンスに関する詳細は、<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">Google の広告に関するポリシー</a>をご覧ください。</p>
<h2>アクセス解析について</h2>
<p>サイト改善のため、アクセス解析ツールを利用する場合があります。データは匿名で収集され、個人を特定するものではありません。</p>
<h2>免責事項</h2>
<p>当サイトの計算結果は概算であり、正確性を保証するものではありません。当サイトの情報を利用したことによる損害について、一切の責任を負いかねます。</p>`;
  return layout({ title: `プライバシーポリシー｜${config.siteName}`, description: '手取りナビのプライバシーポリシーと免責事項。', path: 'privacy.html', body });
}

// ─── 出力 ─────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });
copyFileSync(join(ROOT, 'src/tax.js'), join(DIST, 'assets/tax.js'));

write('index.html', indexPage());
write('nenshu/index.html', nenshuIndex());
for (const n of pageIncomes) write(`nenshu/${n}.html`, nenshuPage(n));
write('kabe.html', kabePage());
write('about.html', aboutPage());
write('privacy.html', privacyPage());
write('404.html', layout({ title: 'ページが見つかりません', description: '', path: '404.html', body: `<h1>ページが見つかりません</h1><p><a href="${SITE}/">手取り計算ツールへ戻る</a></p>` }));

const urls = ['', 'nenshu/', 'kabe.html', 'about.html', ...pageIncomes.map((n) => `nenshu/${n}.html`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${RULES.updated}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
if (config.adsenseClient) write('ads.txt', `google.com, ${config.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`dist/ に ${urls.length + 2} ページを生成しました（${TODAY}）`);
for (const w of WALLS) console.log(`  壁: ${w.title} 年収${w.at}円 手取り${w.after.takeHome - w.before.takeHome}円 回復${w.recover}円`);
