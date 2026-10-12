#!/usr/bin/env node
// サイト全体を dist/ に生成する。依存パッケージなし。
//   node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTakeHome, RULES, yen, man } from '../src/tax.js';
import { hero, nextItems, nextCards, lifeTiles, upBars, lineChart, familyBars, conditionBars, avgBars, saveTiles, PREFS, AVERAGES } from '../src/view.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
// SITE_URL=http://localhost:8765 でローカル確認用にビルドできる
const SITE = (process.env.SITE_URL || config.siteUrl).replace(/\/$/, '');
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
// データ色は検証済みの参照パレット（色覚多様性・コントラストを validator で確認）
const CSS = `
:root{color-scheme:light;--bg:#f4f5f7;--surface:#fff;--text:#14171c;--sub:#555b66;--muted:#7d838e;--line:#e2e5ea;--grid:#eceef1;
--accent:#1f63b8;--accent-soft:#e8f0fb;--alert:#9a3d00;--alert-bg:#fff1e6;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--gross:#9aa0a8;--gap:rgba(235,104,52,.12)}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#111317;--surface:#1a1d22;--text:#eceef1;--sub:#b3b9c3;--muted:#8a919c;--line:#2b3038;--grid:#23272e;
--accent:#6aa6ef;--accent-soft:#17263a;--alert:#ffb27a;--alert-bg:#33200f;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--gross:#6b717a;--gap:rgba(217,89,38,.16)}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#111317;--surface:#1a1d22;--text:#eceef1;--sub:#b3b9c3;--muted:#8a919c;--line:#2b3038;--grid:#23272e;
--accent:#6aa6ef;--accent-soft:#17263a;--alert:#ffb27a;--alert-bg:#33200f;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--gross:#6b717a;--gap:rgba(217,89,38,.16)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;font-size:16px;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
small{font-size:.75em;color:var(--sub);font-weight:400}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.top div{max-width:760px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.logo{font-weight:800;text-decoration:none;color:var(--text);font-size:18px}
.logo b{color:var(--accent)}
.top nav{display:flex;gap:14px;font-size:14px;margin-left:auto}
.top nav a{color:var(--sub);text-decoration:none}
main{max-width:760px;margin:0 auto;padding:16px 16px 96px}
.crumb{font-size:12px;color:var(--muted);margin-bottom:8px}
.crumb a{color:var(--muted)}
h1{font-size:clamp(20px,5vw,26px);line-height:1.4;margin-bottom:6px}
h2{font-size:19px;margin:40px 0 4px}
.h2-sub{color:var(--sub);font-size:14px;margin-bottom:14px}
p{margin-bottom:10px}
.lead{color:var(--sub);font-size:14px}
.note{color:var(--muted);font-size:12px;margin-top:8px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px}
/* ヒーロー */
.hero{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px 18px 16px;margin:12px 0 8px}
.hero-label{font-size:14px;color:var(--sub);font-weight:700}
.hero-main{display:flex;align-items:baseline;gap:6px;margin:2px 0}
.hero-k{font-size:20px;font-weight:700;color:var(--sub)}
.hero-v{font-size:clamp(48px,14vw,72px);font-weight:900;line-height:1.05;color:var(--text);letter-spacing:-.02em}
.hero-u{font-size:20px;font-weight:700}
.hero-sub{font-size:15px;color:var(--sub);margin-bottom:14px}
.hero-sub strong{color:var(--text)}
.split{display:flex;gap:2px;height:28px;border-radius:8px;overflow:hidden}
.split span{min-width:3px}
.split-legend{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
.split-legend li{font-size:12px;color:var(--sub);line-height:1.35}
.split-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
.split-legend b{display:block;font-size:16px;color:var(--text)}
.split-legend small{font-size:11px}
@media (max-width:420px){.split-legend{grid-template-columns:1fr 1fr}}
/* 次に知りたいこと */
.next{margin:20px 0 4px}
.next-h{font-size:15px;margin:0 0 10px;color:var(--sub)}
.next-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media (max-width:560px){.next-grid{grid-template-columns:1fr 1fr}}
.next-card{display:flex;flex-direction:column;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;text-decoration:none;color:var(--text);transition:border-color .15s,transform .15s}
.next-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.next-card .ni{font-size:22px;line-height:1}
.next-card .nq{font-size:13px;color:var(--sub);margin-top:4px}
.next-card .na{font-size:17px;font-weight:800;color:var(--accent)}
.next-card.alert{background:var(--alert-bg);border-color:transparent}
.next-card.alert .na{color:var(--alert)}
/* 年収アップ */
.upbars{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
.up-row{display:grid;grid-template-columns:92px 1fr 92px;align-items:center;gap:10px;padding:7px 0}
.up-k{font-size:14px;font-weight:700;line-height:1.3;display:flex;flex-direction:column}
.up-track{height:14px;background:var(--accent-soft);border-radius:4px;overflow:hidden}
.up-track span{display:block;height:100%;background:var(--s1);border-radius:4px}
.up-v{text-align:right;line-height:1.3;display:flex;flex-direction:column}
.up-v b{font-size:15px}
.sw{display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:middle;margin-right:4px}
.sw-track{background:var(--accent-soft);border:1px solid var(--line)}
.sw-fill,.sw-take{background:var(--s1)}
.sw-gross{background:none;border-top:2px dashed var(--gross);height:0;border-radius:0}
.sw-gap{background:var(--gap);border:1px solid var(--line)}
/* 折れ線 */
.chart{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 8px 10px}
.chart svg{width:100%;height:auto;display:block;touch-action:pan-y}
.chart .grid{stroke:var(--grid);stroke-width:1}
.chart .ax{fill:var(--muted);font-size:11px}
.chart .me-t{paint-order:stroke;stroke:var(--surface);stroke-width:4px}
.chart .gap{fill:var(--gap)}
.chart .gross{stroke:var(--gross);stroke-width:2;stroke-dasharray:5 4}
.chart .take{fill:none;stroke:var(--s1);stroke-width:2.5;stroke-linejoin:round}
.chart .me{fill:var(--s1);stroke:var(--surface);stroke-width:3}
.chart .me-v{stroke:var(--s1);stroke-width:1;stroke-dasharray:2 3;opacity:.6}
.chart .me-t{fill:var(--text);font-size:13px;font-weight:700}
.chart .cross{stroke:var(--muted);stroke-width:1}
.chart .dot{fill:var(--surface);stroke:var(--s1);stroke-width:2}
.chart .tip{position:absolute;top:8px;width:150px;opacity:.94;background:var(--text);color:var(--bg);font-size:12px;border-radius:8px;padding:6px 8px;pointer-events:none;line-height:1.5}
.chart figcaption{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--sub);padding:4px 8px 0}
/* 横棒 */
.hbars{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
.hb-row{display:grid;grid-template-columns:minmax(110px,34%) 1fr 84px;align-items:center;gap:10px;padding:6px 0}
.hb-k{font-size:13px;line-height:1.35}
.hb-bar{height:14px;position:relative;border-left:0}
.hb-bar::before{content:'';position:absolute;left:50%;top:-4px;bottom:-4px;border-left:1px solid var(--muted)}
.hb-bar span{position:absolute;top:0;height:100%}
.hb-bar .pos{left:50%;background:var(--s1);border-radius:0 4px 4px 0}
.hb-bar .neg{right:50%;background:var(--s2);border-radius:4px 0 0 4px}
.sw-neg{background:var(--s2)}
.hb-v{text-align:right;line-height:1.3;display:flex;flex-direction:column}
.hb-v b{font-size:15px}
/* タイル */
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.tiles.two{grid-template-columns:1fr 1fr}
@media (max-width:560px){.tiles,.tiles.two{grid-template-columns:1fr}}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px}
.tile .k{font-size:13px;color:var(--sub)}
.tile .v{font-size:26px;font-weight:800;line-height:1.3;margin-top:2px}
.callout{display:flex;gap:10px;align-items:flex-start;background:var(--alert-bg);color:var(--text);border-radius:14px;padding:12px 14px;margin-top:12px;font-size:14px}
.callout .ci{font-size:20px;line-height:1.2}
.callout.info{background:var(--accent-soft)}
.cta{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;padding:9px 14px;border-radius:10px;margin-top:10px;font-size:14px}
.pr{font-size:10px;border:1px solid currentColor;border-radius:4px;padding:0 4px;opacity:.85}
/* 関連リンク */
.related{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.related a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;text-decoration:none;color:var(--text);font-size:14px}
.related a b{display:block;font-size:16px;color:var(--accent)}
.related a:only-child{grid-column:1/-1}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips a{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;font-size:14px;color:var(--text)}
/* 表（早見表など） */
table{width:100%;border-collapse:collapse;background:var(--surface)}
th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right;font-size:14px;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
thead th{font-size:12px;color:var(--sub);font-weight:600;background:var(--bg);position:sticky;top:0}
tr.hl td{background:var(--accent-soft);font-weight:700}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px}
td .minibar{display:inline-block;height:8px;background:var(--s1);border-radius:2px;vertical-align:middle;margin-right:6px}
details.more{margin-top:10px}
details.more summary{cursor:pointer;color:var(--accent);font-size:14px;padding:6px 0}
/* 下部固定の導線 */
.sticky{position:fixed;left:0;right:0;bottom:0;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom));z-index:10}
.sticky div{max-width:760px;margin:0 auto;display:flex;gap:8px}
.sticky a{flex:1;text-align:center;text-decoration:none;font-weight:700;font-size:14px;padding:10px;border-radius:10px}
.sticky .p{background:var(--accent);color:#fff}
.sticky .s{background:var(--bg);color:var(--text);border:1px solid var(--line)}
/* 計算フォーム */
form.calc{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:16px 18px;display:grid;gap:12px}
form.calc label.big{font-weight:700;font-size:14px;color:var(--sub)}
.inrow{display:flex;align-items:center;gap:8px}
.inrow span{white-space:nowrap;font-weight:700}
form.calc input[type=number]{width:100%;font-size:28px;font-weight:800;padding:8px 12px;border:2px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text)}
form.calc input[type=number]:focus{outline:none;border-color:var(--accent)}
input[type=range]{width:100%;accent-color:var(--accent)}
.seg{display:flex;flex-wrap:wrap;gap:8px}
.seg label{display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:14px;cursor:pointer}
.seg label:has(input:checked){border-color:var(--accent);background:var(--accent-soft)}
.seg select{font-size:14px;background:transparent;color:var(--text);border:0}
.ad{margin:28px 0;min-height:100px}
ul.points{list-style:none;display:grid;gap:8px;margin:8px 0}
ul.points li{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px}
.toc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:14px 0}
.toc-h{font-weight:700;font-size:14px;color:var(--sub)}
.toc ol{padding-left:20px;font-size:14px}
.hb-row.avg .hb-bar::before{display:none}
.hb-bar .base{left:0;background:var(--gross);border-radius:0 4px 4px 0}
.hb-bar .me{left:0;background:var(--s1);border-radius:0 4px 4px 0}
form.calc input.sub{font-size:20px;padding:6px 12px}
form.calc select.full{width:100%;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.seg.mode label{font-weight:700}
.offers{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:560px){.offers{grid-template-columns:1fr}}
fieldset.offer{border:1px solid var(--line);border-radius:14px;padding:10px 12px 12px;display:grid;gap:6px}
fieldset.offer legend{font-weight:800;padding:0 6px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
@media (max-width:560px){.cmp{grid-template-columns:1fr}}
.cmp-col{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px}
.cmp-h{font-weight:800}
.cmp-v{font-size:30px;font-weight:900;line-height:1.3}
.cmp-s{font-size:13px;color:var(--sub);margin-bottom:10px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:12px;text-align:center;padding:24px 16px 100px}
footer a{color:var(--muted)}
`;

const gaHead = config.gaMeasurementId
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(config.gaMeasurementId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(config.gaMeasurementId)}');</script>`
  : '';

function layout({ title, description, path, body, head = '', sticky = '' }) {
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
${gaHead}
${adHead}
${head}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div>
<a class="logo" href="${SITE}/">💴 手取り<b>ナビ</b></a>
<nav><a href="${SITE}/">計算する</a><a href="${SITE}/nenshu/">早見表</a><a href="${SITE}/hikaku.html">2社比較</a><a href="${SITE}/kabe.html">手取りの壁</a></nav>
</div></header>
<main>
${body}
</main>
${sticky ? `<div class="sticky"><div>${sticky}</div></div>` : ''}
<footer>
<p>${RULES.label}の制度で計算した概算です。実際の金額は勤務先や自治体、賞与の有無などで変わります。</p>
${hasAffiliate ? '<p>当サイトはアフィリエイトプログラムを利用しています（PR表記のリンク）。</p>' : ''}
<p>最終更新：${RULES.updated}　出典：国税庁・協会けんぽ・厚生労働省・日本年金機構・総務省（<a href="${SITE}/about.html#sources">一覧</a>）</p>
<p><a href="${SITE}/about.html">計算方法と前提</a>　<a href="${SITE}/operator.html">運営者情報</a>　<a href="${SITE}/privacy.html">プライバシーポリシー</a></p>
<p>© ${esc(config.siteName)}</p>
</footer>
<script type="module">import { attachCharts, trackNext } from '${SITE}/assets/view.js'; attachCharts(); trackNext();</script>
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
  return `
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
const NEXT_ORDER = config.nextOrder || ['rent', 'up', 'avg', 'family', 'furusato', 'ideco'];
const pageLink = (n) => (hasPage(n) ? `${SITE}/nenshu/${n}.html` : null);

// 年収n万円の少し先にある「手取りの壁」（独身の場合）
function wallAhead(n) {
  return WALLS.find((w) => !w.opt.spouse && w.at / 10000 > n && w.at / 10000 <= n + 60);
}

function points(n, r) {
  const list = [];
  const gain = calc(n + 10).takeHome - r.takeHome;
  list.push(['🧾', `所得税率は<strong>${pct(r.marginalIT, 0)}%</strong>。住民税と合わせ、収入が増えた分の約${pct(r.marginalIT * 1.021 + 0.1, 0)}%が税金になります（社会保険料は別）。`]);
  if (gain <= 0) list.push(['⚠️', `ここから年収が10万円増えても手取りは${yen(-gain)}円<strong>減ります</strong>。<a href="${SITE}/kabe.html">手取りの壁</a>の手前です。`]);
  if (r.monthly >= 635000) list.push(['🔝', '厚生年金保険料は上限（月59,475円）に達しています。ここから先、年金保険料は増えません。']);
  if (n >= 850) list.push(['🔝', '給与所得控除は上限（195万円）。ここから先は、増えた収入がそのまま課税対象になります。']);
  for (const w of WALLS) {
    if (Math.abs(w.at / 10000 - n) <= 40) {
      list.push(['⚠️', `年収約${man(w.at)}万円に壁：${esc(w.title)}。越えた直後は手取りが約${man(w.before.takeHome - w.after.takeHome)}万円減ります。<a href="${SITE}/kabe.html#${w.key}">詳しく</a>`]);
    }
  }
  return list.map(([i, t]) => `<div class="callout${i === '⚠️' ? '' : ' info'}"><span class="ci">${i}</span><div>${t}</div></div>`).join('');
}

function nenshuPage(n) {
  const r = calc(n);
  const up50 = calc(n + 50);
  const wall = wallAhead(n);
  const extra = wall ? [{
    key: 'kabe', icon: '⚠️', q: 'この先に手取りの壁', alert: true,
    a: `${man(wall.at, 0)}万円で−${man(wall.before.takeHome - wall.after.takeHome)}万`, href: `${SITE}/kabe.html#${wall.key}`,
  }] : [];
  const title = `年収${n}万円の手取りは月${man(r.takeHomeMonthly)}万円・年${man(r.takeHome, 0)}万円【${RULES.label}】`;
  const desc = `年収${n}万円の手取りは月約${man(r.takeHomeMonthly)}万円、年約${man(r.takeHome)}万円（${RULES.label}・独身）。家賃の目安、年収が50万円上がると手取りがいくら増えるか（+${man(up50.takeHome - r.takeHome)}万円）、結婚・扶養での違い、ふるさと納税の上限もひと目でわかります。`;
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › <a href="${SITE}/nenshu/">年収別の手取り</a> › 年収${n}万円</div>
<h1>年収${n}万円の手取りは月${man(r.takeHomeMonthly)}万円</h1>
<p class="lead">${RULES.label}の税金・社会保険料で計算（独身・40歳未満・賞与なし）</p>
${hero(n, r)}
${nextCards(nextItems(n, r), NEXT_ORDER, extra)}

<h2 id="life">暮らしの目安</h2>
<p class="h2-sub">月の手取り${man(r.takeHomeMonthly)}万円で考えると</p>
${lifeTiles(r)}

<h2 id="up">年収が上がると、手取りはいくら増える？</h2>
<p class="h2-sub">あと50万円上がると手取りは<strong>+${man(up50.takeHome - r.takeHome)}万円</strong>。増えた分の約${pct((up50.takeHome - r.takeHome) / 500000, 0)}%が手元に残ります。</p>
${upBars(n, r, {}, pageLink)}
${cta('career')}

<h2>年収と手取りの関係</h2>
<p class="h2-sub">年収が上がるほど、引かれる割合が大きくなります。グラフをなぞると各年収の手取りが見られます。</p>
${lineChart(n)}

<h2 id="avg">平均年収と比べると</h2>
<p class="h2-sub">年収${n}万円は、給与所得者全体の平均（${AVERAGES.rows[0][1]}万円）より${n >= AVERAGES.rows[0][1] ? `${n - AVERAGES.rows[0][1]}万円高い` : `${AVERAGES.rows[0][1] - n}万円低い`}水準です。</p>
${avgBars(n)}

<h2 id="family">結婚・扶養・年齢で変わる？</h2>
<p class="h2-sub">配偶者（収入なし）を扶養すると税金が減り、40歳からは介護保険料が加わります。</p>
${familyBars(n)}

<h2 id="area">住んでいる地域・ボーナスで変わる？</h2>
<p class="h2-sub">健康保険料率は都道府県ごとに違います。ボーナスがあると、同じ年収でも社会保険料が少し変わります。</p>
${conditionBars(n)}

<h2 id="save">税金を減らす方法</h2>
<p class="h2-sub">年収${n}万円の人が使える代表的な2つ</p>
${saveTiles(r, cta('furusato'), cta('ideco'))}

<h2>この年収のポイント</h2>
${points(n, r)}

${adSlot()}

<details class="more"><summary>内訳を表で見る（社会保険料・税金の詳細）</summary>
${breakdown(r)}
</details>

<h2>あわせて見られている年収</h2>
<div class="related">
${[[n - 50, '−50万円'], [n + 50, '+50万円'], [n - 10, '−10万円'], [n + 10, '+10万円']].filter(([m]) => hasPage(m)).map(([m, k]) => `<a href="${SITE}/nenshu/${m}.html">年収${m}万円（${k}）<b>月${man(calc(m).takeHomeMonthly)}万円</b></a>`).join('')}
<a href="${SITE}/nenshu/">年収別の早見表<b>一覧で比べる</b></a>
<a href="${SITE}/kabe.html">2026年の手取りの壁<b>損する年収は？</b></a>
</div>`;
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `年収${n}万円の手取りはいくら？`, acceptedAnswer: { '@type': 'Answer', text: `${RULES.label}の制度で、独身・40歳未満なら月約${man(r.takeHomeMonthly)}万円、年間約${man(r.takeHome)}万円です。` } },
      { '@type': 'Question', name: `年収${n}万円から50万円上がると手取りはいくら増える？`, acceptedAnswer: { '@type': 'Answer', text: `約${man(up50.takeHome - r.takeHome)}万円増えます。` } },
      { '@type': 'Question', name: `年収${n}万円の家賃の目安は？`, acceptedAnswer: { '@type': 'Answer', text: `手取りの25〜30%とすると月${man(r.takeHomeMonthly * 0.25, 1)}〜${man(r.takeHomeMonthly * 0.3, 1)}万円です。` } },
    ],
  };
  return layout({
    title, description: desc, path: `nenshu/${n}.html`, body,
    head: `<script type="application/ld+json">${JSON.stringify(faq)}</script>`,
    sticky: `<a class="p" href="${SITE}/?income=${n}">条件を変えて計算</a>${hasPage(n + 50) ? `<a class="s" href="${SITE}/nenshu/${n + 50}.html">+50万円だと？</a>` : ''}`,
  });
}

// ─── 入力フォームの部品（計算ツール・内定比較で共通） ─────────
const prefOptions = (sel = '東京都') => PREFS.map((p) => `<option${p === sel ? ' selected' : ''}>${p}</option>`).join('');

// ─── トップ（計算ツール） ──────────────────────────────────
function indexPage() {
  const popular = [300, 400, 500, 600, 700, 800, 1000, 1200, 1500];
  const ctas = { furusato: cta('furusato'), ideco: cta('ideco') };
  const body = `
<h1>手取り計算ツール【${RULES.label}】</h1>
<p class="lead">年収か月給を入れるだけ。手取り・家賃の目安・年収アップで増える額・平均との比較・節税額までひと目でわかります。入力内容は送信されません。</p>
<form class="calc" id="calc" onsubmit="return false">
  <div class="seg mode">
    <label><input type="radio" name="mode" value="year" checked>年収で入力</label>
    <label><input type="radio" name="mode" value="month">月給で入力</label>
  </div>
  <div id="f-year">
    <label class="big" for="income">年収（額面・ボーナス込み）</label>
    <div class="inrow"><input id="income" type="number" inputmode="numeric" min="100" max="5000" step="10" value="500"><span>万円</span></div>
    <input id="slider" type="range" min="100" max="2500" step="10" value="500" aria-label="年収スライダー">
  </div>
  <div id="f-month" hidden>
    <label class="big" for="monthly">月給（額面・手当込み）</label>
    <div class="inrow"><input id="monthly" type="number" inputmode="decimal" min="5" max="400" step="0.5" value="35"><span>万円</span></div>
  </div>
  <div>
    <label class="big" for="bonus">ボーナス（年間の合計）</label>
    <div class="inrow"><input id="bonus" class="sub" type="number" inputmode="decimal" min="0" max="3000" step="1" value="0"><span>万円</span></div>
  </div>
  <div class="seg">
    <label>📍<select id="pref" aria-label="都道府県">${prefOptions()}</select></label>
    <label><input id="over40" type="checkbox">40〜64歳</label>
    <label><input id="spouse" type="checkbox">配偶者を扶養</label>
    <label>扶養（16歳以上）<select id="dependents"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>人</label>
  </div>
</form>
<div id="out" aria-live="polite"></div>
${adSlot()}
<div class="related" style="margin-top:24px">
<a href="${SITE}/hikaku.html">転職・内定で迷ったら<b>2社の手取りを比べる →</b></a>
<a href="${SITE}/kabe.html">2026年の手取りの壁<b>損する年収は？ →</b></a>
</div>
<h2>よく見られている年収</h2>
<p class="h2-sub">年収ごとの詳しい解説ページ</p>
<div class="chips">${popular.map((n) => `<a href="${SITE}/nenshu/${n}.html">年収${n}万円</a>`).join('')}<a href="${SITE}/nenshu/">早見表 →</a></div>
<h2>2026年の注目ポイント</h2>
<div class="callout"><span class="ci">⚠️</span><div>所得税の基礎控除が最大104万円に（2026・2027年の特例）。年収約${man(WALLS[0].at, 0)}万円を超えると67万円に下がり、<a href="${SITE}/kabe.html">手取りが減る「壁」</a>があります。</div></div>
<div class="callout info"><span class="ci">🧾</span><div>2026年4月分から「子ども・子育て支援金」が健康保険料に上乗せされています。</div></div>
<script type="module">
import { calcTakeHome } from './assets/tax.js';
import { hero, nextItems, nextCards, lifeTiles, upBars, lineChart, familyBars, avgBars, saveTiles, attachCharts } from './assets/view.js';
const ORDER = ${JSON.stringify(NEXT_ORDER)};
const CTA = ${JSON.stringify(ctas)};
const PAGE = { min: ${PAGE_MIN}, max: ${PAGE_MAX}, step: ${PAGE_STEP} };
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
for (const k of ['income', 'monthly', 'bonus', 'pref']) if (q.get(k)) $(k).value = q.get(k);
if (q.get('mode') === 'month') document.querySelector('[name=mode][value=month]').checked = true;
const hasPage = (n) => Number.isInteger(n) && n >= PAGE.min && n <= PAGE.max && n % PAGE.step === 0;
const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
let timer;
function render() {
  const mode = document.querySelector('[name=mode]:checked').value;
  $('f-year').hidden = mode !== 'year';
  $('f-month').hidden = mode !== 'month';
  const bonus = Math.min(3000, num('bonus'));
  let n = mode === 'month' ? Math.round((num('monthly') * 12 + bonus) * 10) / 10 : Math.min(5000, num('income'));
  if (mode === 'year') $('slider').value = Math.min(2500, n);
  const opt = { bonus: Math.min(bonus, n) * 10000, pref: $('pref').value, over40: $('over40').checked, spouse: $('spouse').checked, dependents: +$('dependents').value };
  if (n < 100) { $('out').innerHTML = '<div class="callout"><span class="ci">ℹ️</span><div>年収100万円以上で計算できます。</div></div>'; return; }
  const r = calcTakeHome({ income: n * 10000, ...opt });
  const up = calcTakeHome({ income: (n + 50) * 10000, ...opt });
  const nInt = Math.round(n);
  $('out').innerHTML = hero(n, r, opt) + nextCards(nextItems(n, r, opt), ORDER) +
    '<h2 id="life">暮らしの目安</h2>' + lifeTiles(r) +
    '<h2 id="up">年収が上がると、手取りはいくら増える？</h2><p class="h2-sub">あと50万円で手取りは<strong>+' + ((up.takeHome - r.takeHome) / 10000).toFixed(1) + '万円</strong></p>' + upBars(n, r, opt, (m) => hasPage(m) && !opt.bonus ? 'nenshu/' + m + '.html' : null) +
    '<h2>年収と手取りの関係</h2><p class="h2-sub">グラフをなぞると各年収の手取りが見られます</p>' + lineChart(n, opt) +
    '<h2 id="avg">平均年収と比べると</h2>' + avgBars(nInt) +
    '<h2 id="family">結婚・扶養・年齢で変わる？</h2>' + familyBars(n, { bonus: opt.bonus, pref: opt.pref }) +
    '<h2 id="save">税金を減らす方法</h2>' + saveTiles(r, CTA.furusato, CTA.ideco) +
    (hasPage(nInt) ? '<div class="related" style="margin-top:20px"><a href="nenshu/' + nInt + '.html">年収' + nInt + '万円の詳しい解説<b>内訳・ポイントを見る →</b></a></div>' : '');
  attachCharts($('out'));
  clearTimeout(timer);
  const p = new URLSearchParams(mode === 'month' ? { mode, monthly: num('monthly') } : { income: n });
  if (bonus) p.set('bonus', bonus);
  if (opt.pref !== '東京都') p.set('pref', opt.pref);
  timer = setTimeout(() => history.replaceState(null, '', '?' + p), 300);
}
$('slider').addEventListener('input', () => { $('income').value = $('slider').value; render(); });
document.querySelectorAll('#calc input, #calc select').forEach((el) => el.addEventListener('input', render));
render();
</script>`;
  return layout({
    title: `手取り計算ツール【${RULES.label}対応】年収・月給・ボーナスから手取りを計算｜${config.siteName}`,
    description: `年収か月給・ボーナスを入れるだけで手取り額、家賃の目安、年収アップで増える手取り、平均年収との比較、ふるさと納税・iDeCoの節税額がひと目でわかる無料ツール。47都道府県の健康保険料率と${RULES.label}の基礎控除引き上げに対応。`,
    path: '', body,
  });
}

// ─── 内定・オファー比較 ────────────────────────────────────
function hikakuPage() {
  const offer = (id, label, m, b) => `
  <fieldset class="offer">
    <legend>${label}</legend>
    <label class="big" for="${id}m">月給（手当込み）</label>
    <div class="inrow"><input id="${id}m" type="number" inputmode="decimal" min="5" max="400" step="0.5" value="${m}"><span>万円</span></div>
    <label class="big" for="${id}b">ボーナス（年間）</label>
    <div class="inrow"><input id="${id}b" class="sub" type="number" inputmode="decimal" min="0" max="3000" step="1" value="${b}"><span>万円</span></div>
    <label class="big" for="${id}p">勤務地</label>
    <select id="${id}p" class="full">${prefOptions()}</select>
  </fieldset>`;
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 内定・オファー比較</div>
<h1>2社の手取りを比べる【内定・転職オファー比較】</h1>
<p class="lead">提示された月給とボーナスを入れると、手元に残るお金の差がわかります。額面の差より、手取りの差は小さくなります。</p>
<form class="calc" id="cmp" onsubmit="return false">
  <div class="offers">${offer('a', '🅰 今の会社・A社', 30, 100)}${offer('b', '🅱 B社', 33, 80)}</div>
  <div class="seg">
    <label><input id="over40" type="checkbox">40〜64歳</label>
    <label><input id="spouse" type="checkbox">配偶者を扶養</label>
    <label>扶養（16歳以上）<select id="dependents"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>人</label>
  </div>
</form>
<div id="out" aria-live="polite"></div>
<div class="callout info"><span class="ci">💡</span><div>手取り以外にも、残業代の有無、住宅手当・退職金・企業年金、通勤時間、昇給のペースで実質的な待遇は変わります。迷ったら、それぞれ「年いくら」に換算して足し引きするのがおすすめです。</div></div>
${cta('career')}
${adSlot()}
<script type="module">
import { calcTakeHome, man } from './assets/tax.js';
import { splitBar } from './assets/view.js';
const $ = (id) => document.getElementById(id);
const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
function get(id) {
  const m = num(id + 'm'), b = num(id + 'b');
  const opt = { pref: $(id + 'p').value, over40: $('over40').checked, spouse: $('spouse').checked, dependents: +$('dependents').value };
  const income = (m * 12 + b) * 10000;
  return { income, r: calcTakeHome({ income, bonus: b * 10000, ...opt }) };
}
function render() {
  const A = get('a'), B = get('b');
  if (A.income < 1000000 || B.income < 1000000) { $('out').innerHTML = '<div class="callout"><span class="ci">ℹ️</span><div>年収100万円以上で比較できます。</div></div>'; return; }
  const gross = B.income - A.income, take = B.r.takeHome - A.r.takeHome;
  const better = take === 0 ? '手取りは同じです' : (take > 0 ? 'B社' : 'A社') + 'の方が手取りが多い';
  const sign = (v) => (v >= 0 ? '+' : '−') + man(Math.abs(v)) + '万円';
  const col = (label, x) => '<div class="cmp-col"><div class="cmp-h">' + label + '</div><div class="cmp-v">' + man(x.r.takeHome) + '<small>万円/年</small></div><div class="cmp-s">月 ' + man(x.r.takeHomeMonthly) + '万円 ・ 額面 ' + man(x.income) + '万円</div>' + splitBar(x.r) + '</div>';
  $('out').innerHTML =
    '<section class="hero"><div class="hero-label">' + better + '</div>' +
    '<div class="hero-main"><span class="hero-k">年</span><span class="hero-v">' + sign(Math.abs(take)).replace('万円', '') + '</span><span class="hero-u">万円</span></div>' +
    '<div class="hero-sub">月にすると <strong>' + sign(Math.abs(take) / 12).replace('+', '') + '</strong>　・　額面の差 ' + sign(gross) + ' のうち手取りの差は ' + (gross ? Math.round(take / gross * 100) : 0) + '%</div></section>' +
    '<div class="cmp">' + col('🅰 A社', A) + col('🅱 B社', B) + '</div>' +
    '<div class="wrap" style="margin-top:14px"><table><thead><tr><th>項目（年額）</th><th>A社</th><th>B社</th><th>差（B−A）</th></tr></thead><tbody>' +
    [['額面', 'income'], ['社会保険料', 'social'], ['所得税', 'incomeTax'], ['住民税', 'residentTax'], ['手取り', 'takeHome']].map(([k, f]) => {
      const a = f === 'income' ? A.income : A.r[f], b = f === 'income' ? B.income : B.r[f];
      return '<tr' + (f === 'takeHome' ? ' class="hl"' : '') + '><td>' + k + '</td><td>' + man(a) + '万</td><td>' + man(b) + '万</td><td>' + sign(b - a).replace('万円', '万') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
document.querySelectorAll('#cmp input, #cmp select').forEach((el) => el.addEventListener('input', render));
render();
</script>`;
  return layout({
    title: `内定・転職オファー比較｜2社の手取りの差を計算【${RULES.label}】｜${config.siteName}`,
    description: '転職・内定で迷ったときに、2社の月給・ボーナス・勤務地から手取りの差を計算する無料ツール。額面の差のうち、実際に手元に残る差がひと目でわかります。',
    path: 'hikaku.html', body,
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
<div class="callout info"><span class="ci">ℹ️</span><div>「103万円の壁」「130万円の壁」など、パート・アルバイトの扶養に関する壁はこのページの対象外です（今後追加予定）。</div></div>
<nav class="toc" aria-label="目次"><div class="toc-h">目次</div><ol>
${WALLS.map((w) => `<li><a href="#${w.key}">年収約${man(w.at)}万円：${esc(w.title)}</a></li>`).join('\n')}
<li><a href="#grade">社会保険料の等級による小さな段差</a></li>
</ol></nav>
${adSlot()}
${sections}
<h2 id="grade">社会保険料の等級による小さな段差</h2>
<p>社会保険料は月給を「標準報酬月額」の等級に当てはめて決まるため、月給が等級の境目を越えると保険料が一段上がります。境目のすぐ上では、昇給額より保険料の増加が大きくなり、手取りがわずかに減ることがあります（年数千円〜3万円程度）。</p>`;
  return layout({
    title: `${RULES.label}の手取りの壁｜年収が増えると手取りが減るのはいくら？`,
    description: `2026年の税制改正で生まれた「手取りの壁」。年収約${man(WALLS[0].at, 0)}万円で基礎控除が104万円→67万円に下がり、手取りが約${man(WALLS[0].before.takeHome - WALLS[0].after.takeHome)}万円減ります。壁の前後の手取りと、元に戻る年収を計算。`,
    path: 'kabe.html', body,
  });
}

// ─── 計算方法・プライバシー ────────────────────────────────
function aboutPage() {
  const body = `
<h1>計算方法と前提</h1>
<p>手取りナビは、会社員の手取りを${RULES.label}の制度に基づいて計算しています。最終更新：${RULES.updated}</p>
<h2>前提</h2>
<ul class="points">
<li>給与収入のみ。年収別ページは賞与（ボーナス）なし・東京都の場合。計算ツールでは賞与（年2回・同額で支給）と都道府県を指定できます。月給 =（年収 − 賞与）÷ 12 として標準報酬月額を決め、賞与には標準賞与額の上限（健康保険は年度573万円、厚生年金は1回150万円）を適用しています。</li>
<li>健康保険は協会けんぽ（令和8年度の都道府県別料率。東京都は${pct(RULES.healthRate, 2)}%）、介護保険${pct(RULES.kaigoRate, 2)}%（40〜64歳）、子ども・子育て支援金${pct(RULES.kodomoRate, 2)}%、厚生年金${pct(RULES.pensionRate, 1)}%（いずれも本人負担はその半分）、雇用保険${pct(RULES.koyouRate, 1)}%（一般の事業）。</li>
<li>所得税は令和8年分（基礎控除の特例加算、給与所得控除の最低保障74万円を含む）。復興特別所得税2.1%を含みます。</li>
<li>住民税は同じ所得に対する年額（実際は翌年6月から納付）。税率10%、均等割5,000円（森林環境税含む）、給与所得控除は令和8年度の住民税の計算方法（最低保障65万円）を使っています。</li>
<li>配偶者控除は配偶者の収入がない場合、扶養控除は16歳以上の一般の扶養親族として計算しています。生命保険料控除などその他の控除は含みません。</li>
<li>ふるさと納税の上限は「住民税所得割額 × 20% ÷（90% − 所得税率 × 1.021）+ 2,000円」の目安です。</li>
</ul>
<h2 id="sources">出典</h2>
<ul class="points">
<li>所得税（基礎控除・給与所得控除・税率）：<a href="https://www.nta.go.jp/users/gensen/nencho/index/kyuyosyotokusya.htm" rel="noopener">国税庁「給与所得者（従業員）の方へ（令和８年分）」</a>、令和8年度税制改正大綱</li>
<li>健康保険・介護保険・子ども・子育て支援金：<a href="https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/index.html" rel="noopener">協会けんぽ「令和8年度の保険料率」</a></li>
<li>厚生年金保険料：<a href="https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html" rel="noopener">日本年金機構「厚生年金保険料額表」</a></li>
<li>雇用保険料：<a href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html" rel="noopener">厚生労働省「雇用保険料率について」</a>（令和8年度）</li>
<li>住民税：<a href="https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/150790_06.html" rel="noopener">総務省「個人住民税」</a></li>
<li>平均年収：<a href="${AVERAGES.sourceUrl}" rel="noopener">${AVERAGES.source}</a></li>
</ul>
<h2>注意</h2>
<p>実際の手取りは、勤務先の健康保険組合、お住まいの自治体、各種控除、通勤手当などにより変わります。正確な金額は給与明細や源泉徴収票、お住まいの自治体の案内でご確認ください。</p>
<p>計算の誤りに気づいた場合は、<a href="https://github.com/kjsa6297-pixel/tedori-navi/issues">GitHub の Issues</a> からお知らせいただけると助かります。</p>`;
  return layout({ title: `計算方法と前提｜${config.siteName}`, description: '手取りナビの計算方法・前提条件・使用している保険料率と税制。', path: 'about.html', body });
}

function operatorPage() {
  const body = `
<h1>運営者情報</h1>
<table style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
<tbody>
<tr><td>サイト名</td><td style="text-align:left;white-space:normal">${esc(config.siteName)}</td></tr>
<tr><td>運営者</td><td style="text-align:left;white-space:normal">${esc(config.operator || '手取りナビ編集部')}</td></tr>
<tr><td>お問い合わせ</td><td style="text-align:left;white-space:normal"><a href="https://github.com/kjsa6297-pixel/tedori-navi/issues">GitHub の Issues</a></td></tr>
<tr><td>最終更新</td><td style="text-align:left;white-space:normal">${RULES.updated}</td></tr>
</tbody></table>
<h2>このサイトについて</h2>
<p>「年収から手取りはいくら？」「昇給・転職で手取りはいくら増える？」に、最新の制度で正確に答えるために作った無料ツールです。計算はすべて公的機関が公表している税率・保険料率に基づき、計算方法と前提は<a href="${SITE}/about.html">計算方法と前提</a>で公開しています。</p>
<h2>大切にしていること</h2>
<ul class="points">
<li><strong>正確さ：</strong>制度の手順どおりに手計算した値と一致するかを自動テストで確認し、テストに通ったものだけを公開しています。</li>
<li><strong>すぐ更新：</strong>税率・保険料率が変わる時期（1月・3月・4月）に必ず確認し、全ページを更新します。</li>
<li><strong>中立：</strong>特定の会社のサービスに誘導するためのサイトではありません。広告やアフィリエイトリンクを載せる場合は「PR」と明記し、読者の得になるものだけを選びます。</li>
</ul>
<p>計算の誤りやわかりにくい点に気づいたら、お気軽にお知らせください。</p>`;
  return layout({ title: `運営者情報｜${config.siteName}`, description: '手取りナビの運営者情報・運営方針・お問い合わせ先。', path: 'operator.html', body });
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
copyFileSync(join(ROOT, 'src/view.js'), join(DIST, 'assets/view.js'));

write('index.html', indexPage());
write('nenshu/index.html', nenshuIndex());
for (const n of pageIncomes) write(`nenshu/${n}.html`, nenshuPage(n));
write('kabe.html', kabePage());
write('about.html', aboutPage());
write('hikaku.html', hikakuPage());
write('operator.html', operatorPage());
write('privacy.html', privacyPage());
write('404.html', layout({ title: 'ページが見つかりません', description: '', path: '404.html', body: `<h1>ページが見つかりません</h1><p><a href="${SITE}/">手取り計算ツールへ戻る</a></p>` }));

const urls = ['', 'nenshu/', 'hikaku.html', 'kabe.html', 'about.html', 'operator.html', ...pageIncomes.map((n) => `nenshu/${n}.html`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${RULES.updated}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
if (config.adsenseClient) write('ads.txt', `google.com, ${config.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`dist/ に ${urls.length + 2} ページを生成しました（${TODAY}）`);
for (const w of WALLS) console.log(`  壁: ${w.title} 年収${w.at}円 手取り${w.after.takeHome - w.before.takeHome}円 回復${w.recover}円`);
