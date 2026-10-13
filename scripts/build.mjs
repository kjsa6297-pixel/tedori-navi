#!/usr/bin/env node
// サイト全体を dist/ に生成する。依存パッケージなし。
//   node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTakeHome, idecoSaving, RULES, yen, man } from '../src/tax.js';
import { topics } from '../src/topics.js';
import { PART_WALLS, WALL_TYPES, IMPACT_LABEL } from '../src/walls.js';
import { guides } from '../src/guides.js';
import { CHARS, talk } from '../src/chars.js';
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
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s3-text:#0f7a54;--s4-text:#8a5a00;--gross:#9aa0a8;--gap:rgba(235,104,52,.12)}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#111317;--surface:#1a1d22;--text:#eceef1;--sub:#b3b9c3;--muted:#8a919c;--line:#2b3038;--grid:#23272e;
--accent:#6aa6ef;--accent-soft:#17263a;--alert:#ffb27a;--alert-bg:#33200f;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s3-text:#4fd6a3;--s4-text:#ffc552;--gross:#6b717a;--gap:rgba(217,89,38,.16)}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#111317;--surface:#1a1d22;--text:#eceef1;--sub:#b3b9c3;--muted:#8a919c;--line:#2b3038;--grid:#23272e;
--accent:#6aa6ef;--accent-soft:#17263a;--alert:#ffb27a;--alert-bg:#33200f;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s3-text:#4fd6a3;--s4-text:#ffc552;--gross:#6b717a;--gap:rgba(217,89,38,.16)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;font-size:16px;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
small{font-size:.75em;color:var(--sub);font-weight:400}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.top div{max-width:760px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.logo{font-weight:800;text-decoration:none;color:var(--text);font-size:18px}
.logo b{color:var(--accent)}
.top nav{display:flex;gap:14px;font-size:14px}
.tt-btn{margin-left:auto;background:var(--accent);color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:8px 14px;border-radius:999px;white-space:nowrap}
@media (max-width:560px){.top nav{width:100%;justify-content:flex-end}}
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
/* 手取りの壁：結論ボックス */
.verdict{background:var(--surface);border:2px solid var(--s2);border-radius:20px;padding:16px;margin:12px 0 18px}
.verdict-h{font-size:clamp(18px,4.6vw,22px);font-weight:900;margin-bottom:10px}
.zone-g{margin-top:10px}
.zone-gh{font-size:13px;font-weight:700;color:var(--sub);margin-bottom:6px}
.zone{display:grid;grid-template-columns:1fr auto;gap:0 12px;align-items:center;background:var(--alert-bg);border-radius:14px;padding:10px 14px;margin-bottom:8px;text-decoration:none;color:var(--text)}
.zone-r{font-size:clamp(18px,4.8vw,24px);font-weight:900;line-height:1.3}
.zone-r small{font-size:12px;margin-right:4px}
.zone-l{font-size:clamp(17px,4.4vw,22px);font-weight:900;color:var(--alert);white-space:nowrap}
.zone-t{grid-column:1/-1;font-size:12px;color:var(--sub)}
.verdict-f{font-size:14px;margin:8px 0 0}
.wcheck{display:flex;flex-direction:column;gap:2px;border-radius:14px;padding:12px 14px;font-size:14px}
.wcheck b{font-size:17px}
.wcheck.bad{background:var(--alert-bg)}.wcheck.bad strong{color:var(--alert)}
.wcheck.warn{background:color-mix(in srgb,var(--s4) 16%,var(--surface))}
.wcheck.ok{background:color-mix(in srgb,var(--s3) 14%,var(--surface))}
.wall-sec{margin-top:18px}
.wall-sec h3{font-size:17px;margin-bottom:4px}
.wall-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
@media (max-width:560px){.wall-steps{grid-template-columns:1fr}}
.wall-steps div{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px;line-height:1.45}
.wall-steps small{font-weight:800;color:var(--sub)}
.wall-steps span{font-size:13px;color:var(--sub)}
.wall-steps b{font-size:16px}
.wall-steps em{font-style:normal;font-weight:900;color:var(--alert)}
.wall-steps .bad{background:var(--alert-bg);border-color:transparent}
.wall-steps .ok small{color:var(--s3-text)}
.wall-loss{font-size:12px;font-weight:800;fill:var(--alert)}
/* 次に知りたいこと：テーマ別の3パネル */
.next{margin:22px 0 4px}
.next-h{font-size:17px;margin:0 0 10px}
.next-groups{display:grid;gap:12px}
.ng-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));column-gap:14px}
.ng{--c:var(--s1);--ct:var(--accent);background:var(--surface);border:1px solid var(--line);border-top:5px solid var(--c);border-radius:16px;padding:12px 12px 6px}
.ng-grow{--c:var(--s3);--ct:var(--s3-text)}
.ng-save{--c:var(--s4);--ct:var(--s4-text)}
.ng-h{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 6px;color:var(--text)}
.ng-h span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--c);color:#fff;font-size:13px;font-weight:900}
.nrow{display:flex;align-items:center;gap:10px;padding:10px 4px;border-top:1px dashed var(--line);text-decoration:none;color:var(--text)}
.nrow:first-child{border-top:0}
@media (min-width:600px){.nrow{border-top:0}}
.nrow:hover .na{text-decoration:underline}
.nrow .ni{font-size:24px;line-height:1;flex:0 0 30px;text-align:center}
.nrow .nt{flex:1;display:flex;flex-direction:column;line-height:1.35;min-width:0}
.nrow .nq{font-size:13px;color:var(--sub)}
.nrow .na{font-size:18px;font-weight:900;color:var(--ct)}
.ng-go{font-size:24px;color:var(--c);font-weight:700}
.nrow.alert{background:var(--alert-bg);border-radius:10px;border-top:0;margin:2px 0}
.nrow.alert .na{color:var(--alert)}
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
/* 条件による違い */
.cl{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.cl-base{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:12px 16px;background:var(--bg);font-size:14px;color:var(--sub)}
.cl-base b{font-size:17px;color:var(--text)}
.cl-row{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--line)}
.cl-ico{font-size:22px;text-align:center}
.cl-k{display:flex;flex-direction:column;line-height:1.4}
.cl-k b{font-size:15px}
.cl-v{text-align:right;display:flex;flex-direction:column;line-height:1.3;white-space:nowrap}
.cl-v b{font-size:20px;font-weight:900}
.cl-v.pos b{color:var(--accent)}
.cl-v.neg b{color:var(--alert)}
/* 扶養内パートの壁 */
.wall-hero label.big{font-weight:700;font-size:14px;color:var(--sub)}
.wall-hero input[type=number]{width:100%;font-size:28px;font-weight:800;padding:8px 12px;border:2px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text)}
.wall-hero input[type=number]:focus{outline:none;border-color:var(--accent)}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--sub);margin-top:6px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:middle}
.tabs{margin:18px 0 0}
.wall-hero .ksum{margin:10px 0 6px;font-size:15px;line-height:1.6}
.ksum-main{font-size:18px}
.ksum b{font-size:1.15em}
.warn-line{color:var(--alert);font-weight:700;margin-top:4px}
.wl{width:100%;height:auto;display:block;margin-top:6px}
.wl-axis{stroke:var(--line);stroke-width:8;stroke-linecap:round}
.wl-me{fill:var(--accent);opacity:.35}
.wl-t{fill:var(--muted);font-size:11px}
.wl-v{fill:var(--text);font-size:11px;font-weight:700}
.wall{position:relative;background:var(--surface);border:1px solid var(--line);border-left:5px solid var(--c);border-radius:14px;padding:14px 16px;margin:10px 0}
.wall.big{box-shadow:0 0 0 2px var(--c) inset}
.wall-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wall-amt{font-size:28px;font-weight:900;line-height:1}
.wall-amt small{font-size:14px;margin-left:2px}
.wall-amt-s{font-size:20px}
.wall-chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px;border:1.5px solid var(--c);color:var(--text)}
.chip.who{border-color:var(--line);color:var(--sub);font-weight:400}
.wall h3{font-size:17px;margin:8px 0 2px}
.wall p{margin:4px 0;font-size:15px}
.impact b{font-weight:800}
.impact.i3 b{color:var(--alert)}
.impact.i0 b{color:var(--accent)}
.passed{display:none;margin-left:auto;font-size:12px;font-weight:700;color:var(--accent)}
.wall.is-passed .passed{display:inline}
.wall.is-passed{opacity:.75}
/* 豆知識 */
.today-full{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;margin-top:10px}
.tf-title{font-size:22px;margin:4px 0 0;line-height:1.45}
ul.backnum{list-style:none;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
ul.backnum li+li{border-top:1px solid var(--line)}
ul.backnum a{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center;padding:12px 14px;text-decoration:none;color:var(--text)}
ul.backnum .bn-d{font-size:13px;color:var(--sub);font-variant-numeric:tabular-nums}
ul.backnum .bn-d:empty{display:none}
ul.backnum .tag{justify-self:start;margin:0}
ul.backnum b{grid-column:1/-1;font-size:15px;font-weight:700}
.tag{display:inline-block;font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:2px 10px;margin-bottom:6px}
.doya{background:var(--surface);border:2px solid var(--accent);border-radius:16px;padding:16px 18px;margin:14px 0}
.doya-k{font-size:13px;font-weight:700;color:var(--accent)}
.doya p{font-size:19px;font-weight:800;line-height:1.6;margin:4px 0 0}
ol.steps{padding-left:22px;display:grid;gap:8px}
ol.steps li{padding-left:4px}
.share-x{display:inline-block;margin-top:14px;background:var(--text);color:var(--bg);text-decoration:none;font-weight:700;font-size:14px;padding:8px 14px;border-radius:10px}
.topic-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:560px){.topic-grid{grid-template-columns:1fr}}
.topic-card{display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;text-decoration:none;color:var(--text)}
.topic-card .tag{align-self:flex-start;margin:0}
.topic-card b{font-size:16px;line-height:1.5}
.topic-card small{font-size:13px}
.today-topic{display:flex;flex-direction:column;gap:2px;margin-top:20px;background:var(--accent-soft);border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--text)}
.tt-k{font-size:13px;font-weight:700;color:var(--accent)}
.today-topic b{font-size:17px}
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
/* トレンド解説：バナー */
.banner{position:relative;display:grid;grid-template-columns:1fr 96px;gap:8px 14px;align-items:center;background:linear-gradient(135deg,var(--accent-soft),var(--surface) 70%);border:1px solid var(--line);border-radius:22px;padding:20px 18px;margin:8px 0 18px;overflow:hidden}
.banner::after{content:"";position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:var(--s4);opacity:.12}
.banner-t h1{font-size:clamp(22px,5.6vw,30px);margin:4px 0 6px}
.banner-t p{font-size:14px;color:var(--sub);margin:0}
.banner-ic{font-size:30px;line-height:1}
.banner-av{width:96px;height:96px;z-index:1;animation:bob 3s ease-in-out infinite}
.banner-av svg,.tk-av svg,.av svg,.hb-av svg{width:100%;height:100%;display:block}
@keyframes bob{50%{transform:translateY(-5px) rotate(-4deg)}}
@media (prefers-reduced-motion:reduce){.banner-av{animation:none}}
.banner-stats{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.banner-stats div{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 10px;line-height:1.3}
.banner-stats small{display:block;font-size:12px}
.banner-stats b{font-size:clamp(17px,4.6vw,22px);font-weight:900;color:var(--accent)}
@media (max-width:420px){.banner{grid-template-columns:1fr 72px}.banner-av{width:72px;height:72px}}
/* 会話 */
.talk{display:grid;gap:12px;margin:18px 0}
.tk{display:flex;gap:10px;align-items:flex-start}
.tk.r{flex-direction:row-reverse}
.tk-av{flex:0 0 52px;height:52px}
.tk-b{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:9px 14px 10px;font-size:15px;max-width:min(520px,82%)}
.tk.l .tk-b{border-top-left-radius:4px;background:color-mix(in srgb,var(--s4) 10%,var(--surface))}
.tk.r .tk-b{border-top-right-radius:4px}
.tk-n{display:block;font-size:11px;font-weight:700;color:var(--muted);line-height:1.4}
.tk-b b{color:var(--alert);background:linear-gradient(transparent 62%,color-mix(in srgb,var(--s4) 35%,transparent) 62%)}
.av{display:inline-block;vertical-align:middle}
/* 図解 */
figure.dg{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 14px 8px;margin:8px 0}
figure.dg svg{width:100%;height:auto;display:block}
.dg-h{font-size:14px;font-weight:800;fill:var(--text)}
.dg-in{font-size:14px;font-weight:800;fill:#fff}
.dg-in2{font-size:12px;font-weight:700;fill:var(--text)}
.dg-s{font-size:11px;fill:var(--sub)}
.dg-num{font-size:18px;font-weight:900;fill:#fff}
.dg-h2{font-size:14px;font-weight:800;fill:var(--text)}
.dg-s2{font-size:12px;fill:var(--sub)}
.lim{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:8px 0}
.lim-row{padding:8px 0;border-bottom:1px dashed var(--line)}
.lim-row:last-of-type{border-bottom:0}
.lim-k{font-size:14px;font-weight:700;margin-bottom:4px}
.lim-bars{display:grid;gap:4px}
.lim-bar{height:24px;border-radius:6px;display:flex;align-items:center;min-width:fit-content}
.lim-bar span{font-size:12px;font-weight:800;padding:0 8px;white-space:nowrap}
.lim-bar.old{background:var(--grid);color:var(--sub)}
.lim-bar.new{background:var(--s2);color:#fff}
.lim-row small{font-size:11px}
ol.tl{list-style:none;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 16px 6px 18px;margin:8px 0;position:relative}
ol.tl li{position:relative;padding:0 0 14px 30px;display:flex;flex-direction:column;line-height:1.45}
ol.tl li::before{content:"";position:absolute;left:0;top:3px;width:16px;height:16px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px var(--surface)}
ol.tl li:not(:last-child)::after{content:"";position:absolute;left:7px;top:20px;bottom:0;width:2px;background:var(--line)}
ol.tl b{font-size:17px;font-weight:900;color:var(--c)}
ol.tl span{font-size:14px;color:var(--sub)}
ol.tl .s1{--c:var(--s1)}ol.tl .s2{--c:var(--s2)}ol.tl .s3{--c:var(--s3)}ol.tl .s4{--c:var(--s4)}
/* シミュレーター */
.sim{margin:24px 0;border:2px solid var(--accent)}
.sim .sim-h{margin:0 0 10px;font-size:18px}
.sim-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}
.sim-f label{display:grid;gap:4px;font-size:13px;font-weight:700;color:var(--sub)}
.sim-f input,.sim-f select{width:100%;font-size:22px;font-weight:800;padding:6px 10px;border:2px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.sim-f input:focus{outline:none;border-color:var(--accent)}
.sim-f b{color:var(--text);white-space:nowrap}
.tiles.four{grid-template-columns:repeat(4,1fr);margin-bottom:12px}
@media (max-width:560px){.tiles.four{grid-template-columns:1fr 1fr}}
.tiles.four .tile .v{font-size:clamp(18px,4.8vw,24px)}
.tile.main{background:var(--s3);border-color:transparent;color:#fff}
.tile.main .k{color:#fff;opacity:.9}
/* ポイント・ニュース・FAQ */
.pt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.pt{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;border-top:4px solid var(--s1)}
.pt:nth-child(2){border-top-color:var(--s3)}.pt:nth-child(3){border-top-color:var(--s4)}.pt:nth-child(4){border-top-color:var(--s2)}
.pt-i{font-size:26px;line-height:1;display:block;margin-bottom:6px}
.pt b{display:block;font-size:16px;line-height:1.45;margin-bottom:4px}
.pt p{font-size:14px;color:var(--sub);margin:0}
ul.news{list-style:none;display:grid;gap:8px}
ul.news li{position:relative;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--s2);border-radius:12px;padding:10px 14px;font-size:14px}
details.faq{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:8px}
details.faq summary{cursor:pointer;font-weight:700;padding:12px 14px;font-size:15px;list-style:none}
details.faq summary::before{content:"Q.";color:var(--accent);font-weight:900;margin-right:6px}
details.faq[open] summary{border-bottom:1px dashed var(--line)}
details.faq p{padding:10px 14px 4px;font-size:14px;margin:0 0 6px}
/* トレンド一覧・トップのトレンド */
.guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
@media (max-width:560px){.guide-grid{grid-template-columns:1fr}}
.guide-card{display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;text-decoration:none;color:var(--text);transition:transform .15s,border-color .15s}
.guide-card:hover{transform:translateY(-2px);border-color:var(--accent)}
.gc-i{font-size:34px;line-height:1}
.guide-card b{font-size:17px;line-height:1.45}
.guide-card small{font-size:13px}
.gc-stats{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.gc-stats em{font-style:normal;font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:2px 9px}
.trend-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}
@media (max-width:560px){.trend-strip{grid-template-columns:1fr 1fr}}
.trend-strip a{display:flex;flex-direction:column;gap:2px;border-radius:16px;padding:12px;text-decoration:none;color:#fff;line-height:1.35}
.trend-strip a:nth-child(1){background:var(--s1)}.trend-strip a:nth-child(2){background:var(--s3)}.trend-strip a:nth-child(3){background:var(--s2)}.trend-strip a:nth-child(4){background:var(--s4);color:#2a1d00}.trend-strip a:nth-child(4) small{color:#2a1d00}
.trend-strip .ti{font-size:24px}
.trend-strip b{font-size:15px}
.trend-strip small{color:#fff;opacity:.92;font-size:12px}
.hello{display:flex;gap:12px;align-items:center;margin:4px 0 12px}
.hello .hb-av{flex:0 0 64px;height:64px}
.hello h1{margin:0}
.hello p{margin:0}
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
${config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : ''}
${gaHead}
${adHead}
${head}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div>
<a class="logo" href="${SITE}/">💴 手取り<b>ナビ</b></a>
<a class="tt-btn" href="${SITE}/topics/">💡 今日の豆知識</a>
<nav><a href="${SITE}/">計算する</a><a href="${SITE}/nenshu/">早見表</a><a href="${SITE}/guide/">🔥トレンド</a><a href="${SITE}/part-kabe.html">年収の壁</a><a href="${SITE}/hikaku.html">2社比較</a></nav>
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

// 年収別ページのキャラクター会話。数字はすべて計算エンジンから出す
function senseiTalk(n, r) {
  const now = idecoSaving(r, 23000 * 12);
  const next = idecoSaving(r, 62000 * 12);
  const answer = next >= 10000
    ? `iDeCoなら、会社員（企業年金なし）は<b>2027年から掛金の上限が月6.2万円</b>に上がる。年収${n}万円なら節税額は今の上限で年約${yen(now)}円、新しい上限なら<b>年約${yen(next)}円</b>じゃ。<a href="${SITE}/guide/ideco.html">iDeCoの図解 →</a>`
    : `この年収だと税金が少ないから、iDeCoの節税効果は小さめじゃ。増えた分に税金がかからない<b>新NISA</b>で、少しずつ積み立てるのがおすすめ。<a href="${SITE}/guide/nisa.html">新NISAの図解 →</a>`;
  return talk([
    ['yuto', `年収${n}万円で、手取りを増やすにはどうしたらいいですか？`],
    ['sensei', answer],
  ]);
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
${senseiTalk(n, r)}

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
<p class="h2-sub">独身・40歳未満の人と比べて、手取りがいくら変わるか</p>
${familyBars(n)}

<h2 id="area">住んでいる地域・ボーナスで変わる？</h2>
<p class="h2-sub">東京都で働く・ボーナスなしの場合と比べて、手取りがいくら変わるか</p>
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
function trendStrip() {
  const sub = { nisa: '年360万円まで非課税', ideco: '2027年〜月6.2万円に', 'kodomo-nisa': '2027年スタート' };
  return `<div class="trend-strip">${GUIDES.map((g) => `<a href="${SITE}/guide/${g.slug}.html"><span class="ti">${g.icon}</span><b>${esc(g.short)}</b><small>${sub[g.slug] || ''}</small></a>`).join('')}<a href="${SITE}/part-kabe.html"><span class="ti">🧱</span><b>年収の壁</b><small>パート・学生の一覧</small></a></div>`;
}

function indexPage() {
  const popular = [300, 400, 500, 600, 700, 800, 1000, 1200, 1500];
  const ctas = { furusato: cta('furusato'), ideco: cta('ideco') };
  const body = `
<div class="hello"><span class="hb-av">${CHARS.sensei.svg}</span><div><h1>手取り計算ツール【${RULES.label}】</h1>
<p class="lead">年収か月給を入れるだけ。手取り・家賃の目安・節税額までひと目でわかります。入力内容は送信されません。</p></div></div>
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
<h2>🔥 いま話題のお金の制度</h2>
<p class="h2-sub">2027年はiDeCoの上限アップとこどもNISAのスタートが重なる年</p>
${trendStrip()}
${todayTopicCard()}
${adSlot()}
<div class="related" style="margin-top:24px">
<a href="${SITE}/hikaku.html">転職・内定で迷ったら<b>2社の手取りを比べる →</b></a>
<a href="${SITE}/kabe.html">2026年の手取りの壁<b>損する年収は？ →</b></a>
<a href="${SITE}/topics/">明日話せるお金の豆知識<b>${TOPICS.length}本 →</b></a>
<a href="${SITE}/part-kabe.html">扶養内パートの年収の壁<b>2026年版の一覧 →</b></a>
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

// ─── 明日話せるお金の豆知識 ────────────────────────────────
const TOPICS = topics();
// 豆知識を始めた日（これより前の日付はバックナンバーに出さない）
const TOPIC_LAUNCH = '2026-10-13';

function topicPage(t, i) {
  const prev = TOPICS[(i - 1 + TOPICS.length) % TOPICS.length];
  const next = TOPICS[(i + 1) % TOPICS.length];
  const shareText = encodeURIComponent(`${t.doya}\n${t.title}`);
  const shareUrl = encodeURIComponent(`${SITE}/topics/${t.slug}.html`);
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › <a href="${SITE}/topics/">明日話せるお金の豆知識</a> › ${esc(t.tag)}</div>
<span class="tag">${esc(t.tag)}</span>
<h1>${esc(t.title)}</h1>
<div class="doya"><div class="doya-k">💬 明日、こう話せます</div><p>「${esc(t.doya)}」</p></div>
<h2>くわしく</h2>
<ol class="steps">${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
<div class="related" style="margin-top:20px"><a href="${SITE}${t.link[0]}">${esc(t.link[1])}<b>計算ツールで確かめる →</b></a></div>
<p class="note">出典：${t.src[1] ? `<a href="${esc(t.src[1])}" rel="noopener">${esc(t.src[0])}</a>` : esc(t.src[0])}／${RULES.label}の制度で計算（最終確認 ${RULES.updated}）</p>
<a class="share-x" href="https://x.com/intent/post?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener">𝕏 でシェア</a>
<h2>ほかの豆知識</h2>
<div class="related">
<a href="${SITE}/topics/${prev.slug}.html">← ${esc(prev.title)}</a>
<a href="${SITE}/topics/${next.slug}.html">${esc(next.title)} →</a>
</div>
<p style="margin-top:14px"><a href="${SITE}/topics/">豆知識の一覧へ</a></p>`;
  return layout({
    title: `${t.title}｜明日話せるお金の豆知識`,
    description: `${t.doya} ${t.points[0]}`.slice(0, 160),
    path: `topics/${t.slug}.html`, body,
    sticky: `<a class="p" href="${SITE}${t.link[0]}">${esc(t.link[1])}</a>`,
  });
}

function topicsIndex() {
  const N = TOPICS.length;
  const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dayIdx = Math.floor(Date.parse(`${jst}T00:00:00Z`) / 86400000);
  const full = (t, i) => `
<article class="today-full" data-i="${i}"${i === dayIdx % N ? '' : ' hidden'}>
  <span class="tag">${esc(t.tag)}</span>
  <h2 class="tf-title">${esc(t.title)}</h2>
  <div class="doya"><div class="doya-k">💬 明日、こう話せます</div><p>「${esc(t.doya)}」</p></div>
  <ol class="steps">${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
  <div class="related" style="margin-top:14px"><a href="${SITE}${t.link[0]}">${esc(t.link[1])}<b>計算ツールで確かめる →</b></a></div>
  <p class="note">出典：${t.src[1] ? `<a href="${esc(t.src[1])}" rel="noopener">${esc(t.src[0])}</a>` : esc(t.src[0])}</p>
  <a class="share-x" href="https://x.com/intent/post?text=${encodeURIComponent(`${t.doya}\n${t.title}`)}&url=${encodeURIComponent(`${SITE}/topics/${t.slug}.html`)}" target="_blank" rel="noopener">𝕏 でシェア</a>
</article>`;
  const backRows = [];
  for (let k = 1; k < N; k++) {
    const i = (((dayIdx - k) % N) + N) % N;
    backRows.push(`<li><a href="${SITE}/topics/${TOPICS[i].slug}.html"><span class="bn-d"></span><span class="tag">${esc(TOPICS[i].tag)}</span><b>${esc(TOPICS[i].title)}</b></a></li>`);
  }
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 今日の豆知識</div>
<h1>💡 今日の豆知識</h1>
<p class="lead" id="today-date">明日だれかに話したくなる、お金の「へぇ〜」を毎日1本。</p>
${TOPICS.map(full).join('')}
<h2 id="backnum-h">バックナンバー</h2>
<ul class="backnum" id="backnum"></ul>
<h2>ほかの豆知識</h2>
<ul class="backnum" id="others">${backRows.join('')}</ul>
<script>
(function(){
  var T=${JSON.stringify(TOPICS.map((t) => ({ slug: t.slug, tag: t.tag, title: t.title })))}, N=T.length;
  var jst=new Date(Date.now()+9*3600*1000), d0=Math.floor(Date.parse(jst.toISOString().slice(0,10)+'T00:00:00Z')/86400000);
  var w=['日','月','火','水','木','金','土'];
  var fmt=function(day){var d=new Date(day*86400000);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+'（'+w[d.getUTCDay()]+'）'};
  var e=function(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  document.querySelectorAll('.today-full').forEach(function(el){el.hidden=+el.dataset.i!==d0%N});
  document.getElementById('today-date').textContent=fmt(d0)+'の豆知識。明日だれかに話したくなる、お金の「へぇ〜」を毎日1本。';
  var L=Math.floor(Date.parse('${TOPIC_LAUNCH}T00:00:00Z')/86400000), h='', o='';
  for(var k=1;k<N;k++){var i=((d0-k)%N+N)%N, past=d0-k>=L;
    var li='<li><a href="${SITE}/topics/'+T[i].slug+'.html"><span class="bn-d">'+(past?fmt(d0-k):'')+'</span><span class="tag">'+e(T[i].tag)+'</span><b>'+e(T[i].title)+'</b></a></li>';
    if(past)h+=li;else o+=li;}
  document.getElementById('backnum').innerHTML=h;
  document.getElementById('backnum-h').hidden=!h;document.getElementById('backnum').hidden=!h;
  document.getElementById('others').innerHTML=o;
})();
</script>`;
  return layout({
    title: `今日の豆知識｜明日話せるお金の話【${RULES.label}】年収の壁・社会保険・節税｜${config.siteName}`,
    description: '「103万円の壁はもう古い」「4〜6月の残業で社会保険料が決まる」など、明日だれかに話したくなるお金の豆知識を毎日1本。数字はすべて2026年の制度で計算。',
    path: 'topics/', body,
  });
}

// トップに出す「今日の豆知識」（ブラウザで日付から選ぶ）
function todayTopicCard() {
  const list = TOPICS.map(({ slug, tag, title, doya }) => ({ slug, tag, title, doya }));
  return `
<div id="today-topic"></div>
<script>
(function(){
  var T=${JSON.stringify(list)};
  var d=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
  var t=T[Math.floor(Date.parse(d+'T00:00:00Z')/86400000)%T.length];
  var e=function(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  document.getElementById('today-topic').innerHTML='<a class="today-topic" href="${SITE}/topics/'+t.slug+'.html" data-next="topic"><span class="tt-k">💡 今日の豆知識</span><b>'+e(t.title)+'</b><small>'+e(t.doya)+'</small></a>';
})();
</script>`;
}

// ─── 扶養内パートの年収の壁 一覧 ───────────────────────────
function wallLine(walls) {
  const W = 400, L = 14, R = 14, min = 100, max = 215;
  const x = (v) => L + ((v - min) / (max - min)) * (W - L - R);
  const ticks = [100, 130, 160, 190, 210];
  const pts = walls.filter((w) => w.at);
  return `
<svg class="wl" viewBox="0 0 ${W} 92" role="img" aria-label="年収の壁の位置">
  <line class="wl-axis" x1="${L}" x2="${W - R}" y1="56" y2="56"/>
  ${ticks.map((t) => `<text class="wl-t" x="${x(t)}" y="84" text-anchor="middle">${t}万</text>`).join('')}
  <rect class="wl-me" x="${L}" y="52" width="0" height="8" rx="4"/>
  ${pts.map((w, i) => `<g><line x1="${x(w.at)}" x2="${x(w.at)}" y1="${i % 2 ? 30 : 18}" y2="64" stroke="${WALL_TYPES[w.type].color}" stroke-width="2"/><circle cx="${x(w.at)}" cy="56" r="6" fill="${WALL_TYPES[w.type].color}" stroke="var(--surface)" stroke-width="2"/><text class="wl-v" x="${x(w.at)}" y="${i % 2 ? 26 : 14}" text-anchor="middle">${w.at}</text></g>`).join('')}
</svg>`;
}

function wallCards(key, walls) {
  return walls.map((w, i) => `
<article class="wall${w.impact === 3 ? ' big' : ''}" data-at="${w.at ?? ''}" style="--c:${WALL_TYPES[w.type].color}">
  <div class="wall-h">
    <div class="wall-amt">${w.at ? `${w.at}<small>万円</small>` : `<span class="wall-amt-s">${esc(w.label)}</span>`}</div>
    <div class="wall-chips"><span class="chip" style="--c:${WALL_TYPES[w.type].color}">${WALL_TYPES[w.type].label}</span><span class="chip who">影響する人：${esc(w.who)}</span></div>
    <span class="passed">✓ 越えている</span>
  </div>
  <h3>${esc(w.title)}</h3>
  <p class="impact i${w.impact}">手取りへの影響：<b>${IMPACT_LABEL[w.impact]}</b></p>
  <p>${esc(w.what)}</p>
  <p class="note">${esc(w.note)}　出典：<a href="${esc(w.src[1])}" rel="noopener">${esc(w.src[0])}</a></p>
</article>`).join('');
}

function partKabePage() {
  const tabs = Object.entries(PART_WALLS);
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 扶養内パートの年収の壁</div>
<h1>扶養内パートの「年収の壁」一覧【2026年版】</h1>
<p class="lead">103万円・106万円・130万円……。2026年は税制改正と社会保険の見直しで、壁の金額が大きく変わりました。<strong>本当に気をつけるべき壁</strong>と、<strong>実は気にしなくていい壁</strong>を1ページで整理します。</p>

<div class="callout"><span class="ci">💡</span><div><b>結論：本当に手取りが減る大きな壁は「社会保険」の2つだけ。</b><br>「週20時間（勤務先の社会保険）」と「130万円（学生は150万円）」です。税金の壁は、超えた分にだけかかるので手取りが逆転しません。</div></div>

<div class="seg tabs" role="tablist">
${tabs.map(([k, v], i) => `<label><input type="radio" name="who" value="${k}"${i ? '' : ' checked'}>${esc(v.label)}</label>`).join('')}
</div>

<section class="hero wall-hero">
  <label class="big" for="kv">あなたの年収（見込み・交通費込み）</label>
  <div class="inrow"><input id="kv" type="number" inputmode="numeric" min="50" max="300" step="1" value="125"><span>万円</span></div>
  <input id="ks" type="range" min="90" max="220" step="1" value="125" aria-label="年収スライダー">
  <div id="ksum" class="ksum"></div>
  ${tabs.map(([k, v], i) => `<div class="wl-wrap" data-who="${k}"${i ? ' hidden' : ''}>${wallLine(v.walls)}</div>`).join('')}
  <div class="legend">${Object.values(WALL_TYPES).map((t) => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('')}</div>
</section>

${tabs.map(([k, v], i) => `<div class="walls" data-who="${k}"${i ? ' hidden' : ''}>
<h2>${esc(v.label)}の壁（年収の低い順）</h2>
${wallCards(k, v.walls)}
</div>`).join('')}

<h2>よくある誤解</h2>
<ul class="points">
<li><b>「103万円の壁」はもうありません。</b>2026年は、本人に所得税がかかるのは年収178万円を超えてから。配偶者・親の控除も136万円まで満額です。</li>
<li><b>「106万円の壁」は2026年10月になくなりました。</b>代わりに「週20時間以上」働くかどうかで、勤務先の社会保険に入るかが決まります（従業員51人以上の会社）。</li>
<li><b>「136万円」は壁ではありません。</b>控除の名前が変わるだけで、配偶者・親の控除額は変わりません。</li>
</ul>

<div class="callout info"><span class="ci">📌</span><div>金額は「給与収入だけ」の場合の目安です。配偶者の年収、勤務先の規模、自治体、加入している健康保険組合によって変わることがあります。迷ったら勤務先や健康保険組合に確認してください。</div></div>

<div class="related" style="margin-top:20px">
<a href="${SITE}/kabe.html">会社員の「手取りの壁」<b>年収666万円など →</b></a>
<a href="${SITE}/topics/">明日話せるお金の豆知識<b>一覧へ →</b></a>
</div>

<script>
(function(){
  var $=function(s){return document.querySelector(s)};
  var D=${JSON.stringify(Object.fromEntries(tabs.map(([k, v]) => [k, v.walls.filter((w) => w.at).map((w) => ({ at: w.at, title: w.title, impact: w.impact }))])))};
  var x=function(v){return 14+((Math.min(215,Math.max(100,v))-100)/115)*372};
  function who(){return document.querySelector('[name=who]:checked').value}
  function render(){
    var w=who(), n=Math.max(0,parseFloat($('#kv').value)||0);
    $('#ks').value=Math.min(220,Math.max(90,n));
    document.querySelectorAll('[data-who]').forEach(function(el){el.hidden=el.dataset.who!==w});
    document.querySelectorAll('.walls[data-who="'+w+'"] .wall').forEach(function(el){var a=parseFloat(el.dataset.at);el.classList.toggle('is-passed',a&&n>a)});
    var me=document.querySelector('.wl-wrap[data-who="'+w+'"] .wl-me'); if(me) me.setAttribute('width',Math.max(0,x(n)-14));
    var list=D[w], passed=list.filter(function(o){return n>o.at}), next=list.find(function(o){return n<=o.at});
    var big=passed.filter(function(o){return o.impact===3});
    $('#ksum').innerHTML='<div class="ksum-main">越えている壁：<b>'+passed.length+'</b> / '+list.length+'</div>'+
      (next?'<div>次の壁まで あと <b>'+(Math.round((next.at-n)*10)/10)+'万円</b>（'+next.at+'万円：'+next.title+'）</div>':'<div>すべての壁を越えています</div>')+
      (big.length?'<div class="warn-line">⚠️ 手取りが大きく減る壁（'+big.map(function(o){return o.at+'万円'}).join('・')+'）を越えています</div>':'');
  }
  $('#ks').addEventListener('input',function(){$('#kv').value=$('#ks').value;render()});
  $('#kv').addEventListener('input',render);
  document.querySelectorAll('[name=who]').forEach(function(r){r.addEventListener('change',render)});
  render();
})();
</script>`;
  return layout({
    title: `扶養内パートの年収の壁 一覧【2026年】103万・106万・130万・136万・178万はどう変わった？｜${config.siteName}`,
    description: '2026年の扶養内パートの年収の壁を一覧で整理。住民税119万円、社会保険の週20時間・130万円、配偶者控除136万円・169万円、所得税178万円。学生（19〜22歳）の150万円の壁も。本当に気をつけるべき壁がひと目でわかります。',
    path: 'part-kabe.html', body,
    sticky: `<a class="p" href="#kv">自分の年収で確かめる</a>`,
  });
}

// ─── トレンド解説（新NISA・iDeCo・こどもNISA） ─────────────
const GUIDES = guides();

const SIMS = {
  nisa: {
    form: `<div class="sim-f">
  <label>毎月の積立<span class="inrow"><input id="g-m" type="number" min="0.1" max="30" step="0.1" value="3"><b>万円</b></span></label>
  <label>積み立てる年数<span class="inrow"><input id="g-y" type="number" min="1" max="50" step="1" value="20"><b>年</b></span></label>
  <label>想定の利回り（年）<span class="inrow"><input id="g-r" type="number" min="0" max="10" step="0.5" value="3"><b>%</b></span></label>
</div>`,
    js: `var m=num('g-m')*10000,y=Math.round(num('g-y')),r=num('g-r')/100/12,n=y*12;
  var fv=r?m*(Math.pow(1+r,n)-1)/r:m*n, p=m*n, g=fv-p, tax=g*0.20315;
  out.innerHTML=tiles([['積み立てた元本',man(p)+'万円'],[''+y+'年後の金額',man(fv)+'万円'],['増えたお金',man(g)+'万円'],['NISAで払わずに済む税金',man(tax)+'万円','hl']])+
  bar([[p,'元本','var(--s1)'],[g,'増えた分','var(--s3)']])+
  '<p class="note">毎月同じ額を積み立て、利回りが一定と仮定した計算（手数料は含まない）。'+(m*12>1200000?'つみたて投資枠は年120万円（月10万円）まで。超える分は成長投資枠を使います。':'')+'</p>';`,
  },
  ideco: {
    form: `<div class="sim-f">
  <label>年収（額面）<span class="inrow"><input id="g-i" type="number" min="100" max="3000" step="10" value="500"><b>万円</b></span></label>
  <label>毎月の掛金<span class="inrow"><input id="g-m" type="number" min="5000" max="75000" step="1000" value="23000"><b>円</b></span></label>
  <label>今の年齢<span class="inrow"><input id="g-a" type="number" min="18" max="64" step="1" value="30"><b>歳</b></span></label>
  <label>想定の利回り（年）<span class="inrow"><input id="g-r" type="number" min="0" max="10" step="0.5" value="3"><b>%</b></span></label>
</div>`,
    js: `var inc=num('g-i')*10000,m=num('g-m'),age=Math.round(num('g-a')),y=Math.max(0,60-age),r=num('g-r')/100/12,n=y*12;
  var save=idecoSaving(calcTakeHome({income:inc}),m*12);
  var fv=r?m*(Math.pow(1+r,n)-1)/r:m*n;
  out.innerHTML=tiles([['1年で軽くなる税金',yen(save)+'円','hl'],['60歳までの節税の合計',man(save*y)+'万円'],['60歳までの元本',man(m*n)+'万円'],['60歳時点の金額（目安）',man(fv)+'万円']])+
  bar([[m*n,'元本','var(--s1)'],[fv-m*n,'増えた分','var(--s3)'],[save*y,'節税','var(--s4)']])+
  '<p class="note">節税額は、掛金を差し引く前後の所得税・住民税の差（独身・賞与なしで計算）。'+(m>23000?'<b>会社員（企業年金なし）の上限は2026年12月分まで月2.3万円、2027年1月分から月6.2万円。</b>':'')+'</p>';`,
  },
  kodomo: {
    form: `<div class="sim-f">
  <label>毎月の積立<span class="inrow"><input id="g-m" type="number" min="1000" max="50000" step="1000" value="10000"><b>円</b></span></label>
  <label>子どもの今の年齢<span class="inrow"><input id="g-a" type="number" min="0" max="17" step="1" value="0"><b>歳</b></span></label>
  <label>想定の利回り（年）<span class="inrow"><input id="g-r" type="number" min="0" max="10" step="0.5" value="3"><b>%</b></span></label>
</div>`,
    js: `var m=Math.min(50000,num('g-m')),age=Math.round(num('g-a')),r=num('g-r')/100/12;
  function at(target){var v=0,p=0;for(var k=0;k<(target-age)*12;k++){var c=p+m<=6000000?m:Math.max(0,6000000-p);p+=c;v=v*(1+r)+c;}return [v,p]}
  var a12=age<12?at(12):null,a18=at(18);
  out.innerHTML=tiles([a12?['12歳のとき',man(a12[0])+'万円']:['12歳のとき','—'],['18歳のとき',man(a18[0])+'万円','hl'],['積み立てた元本',man(a18[1])+'万円'],['払わずに済む税金',man((a18[0]-a18[1])*0.20315)+'万円']])+
  bar([[a18[1],'元本','var(--s1)'],[a18[0]-a18[1],'増えた分','var(--s3)']])+
  '<p class="note">月5万円（年60万円）まで。総額600万円に達したら積立が止まる計算。制度開始（2027年1月）からの積立を想定。</p>';`,
  },
};

function simBlock(key) {
  const s = SIMS[key];
  return `
<section class="sim card">
  <h2 class="sim-h">🧮 シミュレーター</h2>
  ${s.form}
  <div id="g-out"></div>
</section>
<script type="module">
import { calcTakeHome, idecoSaving, yen, man } from '../assets/tax.js';
const $ = (id) => document.getElementById(id);
const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
const out = $('g-out');
const tiles = (t) => '<div class="tiles four">' + t.map((x) => '<div class="tile' + (x[2] ? ' main' : '') + '"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>').join('') + '</div>';
const bar = (segs) => { const tot = segs.reduce((a, s) => a + Math.max(0, s[0]), 0) || 1; return '<div class="split">' + segs.map((s) => '<span style="flex:' + Math.max(0, s[0]) + ' 0 0;background:' + s[2] + '"></span>').join('') + '</div><ul class="split-legend">' + segs.map((s) => '<li><i style="background:' + s[2] + '"></i>' + s[1] + '<b>' + man(Math.max(0, s[0])) + '万</b></li>').join('') + '</ul>'; };
function render() { ${s.js} }
document.querySelectorAll('.sim input').forEach((el) => el.addEventListener('input', render));
render();
</script>`;
}

function guidePage(g) {
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › <a href="${SITE}/guide/">お金のトレンド</a> › ${esc(g.short)}</div>
<section class="banner">
  <div class="banner-t"><span class="banner-ic">${g.icon}</span><h1>${esc(g.title)}</h1><p>${esc(g.lead)}</p></div>
  <div class="banner-av">${CHARS.sensei.svg}</div>
  <div class="banner-stats">${g.stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
</section>
${g.talk}
<h2>図でわかる</h2>
${g.diagram}
${simBlock(g.sim)}
<h2>ここだけ押さえればOK</h2>
<div class="pt-grid">${g.points.map(([i, t, d]) => `<div class="pt"><span class="pt-i">${i}</span><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
<h2>📰 2026年の最新トピック</h2>
<ul class="news">${g.news.map((n) => `<li>${n}</li>`).join('')}</ul>
<h2>⚠️ 気をつけたいこと</h2>
<ul class="points">${g.cautions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
${cta(g.cta)}
<h2>よくある質問</h2>
${g.faq.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
<p class="note" style="margin-top:16px">出典：${g.src.map(([n, u]) => `<a href="${esc(u)}" rel="noopener">${esc(n)}</a>`).join('／')}（${RULES.updated}時点の情報。制度の詳細は公式発表で確認してください）</p>
<h2>ほかのトレンドも読む</h2>
<div class="related">${others.map((o) => `<a href="${SITE}/guide/${o.slug}.html">${o.icon} ${esc(o.short)}<b>${esc(o.title.split('【')[0].slice(0, 22))}… →</b></a>`).join('')}</div>`;
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return layout({
    title: `${g.title}｜${config.siteName}`, description: g.lead, path: `guide/${g.slug}.html`, body,
    head: `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`,
    sticky: `<a class="p" href="#g-out">シミュレーターで試す</a>`,
  });
}

function guideIndex() {
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › お金のトレンド</div>
<section class="banner">
  <div class="banner-t"><span class="banner-ic">🔥</span><h1>2026年 お金のトレンド</h1><p>新NISA・iDeCoの大改正・こどもNISA。いま知っておきたい制度を、図とキャラクターの会話でやさしく解説します。</p></div>
  <div class="banner-av">${CHARS.sensei.svg}</div>
</section>
${talk([['sensei', '2027年は<b>iDeCoの上限アップ</b>と<b>こどもNISAのスタート</b>が重なる大きな年じゃ。今のうちに仕組みを知っておこう！']])}
<div class="guide-grid">
${GUIDES.map((g) => `<a class="guide-card" href="${SITE}/guide/${g.slug}.html"><span class="gc-i">${g.icon}</span><b>${esc(g.title)}</b><small>${esc(g.lead)}</small><span class="gc-stats">${g.stats.map(([k, v]) => `<em>${k}：${v}</em>`).join('')}</span></a>`).join('')}
<a class="guide-card" href="${SITE}/part-kabe.html"><span class="gc-i">🧱</span><b>扶養内パートの年収の壁【2026年版】</b><small>103万・106万・130万…本当に気をつけるべき壁はどれ？</small></a>
</div>`;
  return layout({
    title: `2026年 お金のトレンド｜新NISA・iDeCo改正・こどもNISAを図解｜${config.siteName}`,
    description: '新NISA、2027年のiDeCo上限引き上げ（月6.2万円・70歳まで）、2027年開始のこどもNISAを、図解とシミュレーターでわかりやすく解説。',
    path: 'guide/', body,
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
// 壁の前後の手取りを折れ線で（損する区間に色を塗る）
function wallChart(w) {
  const span = Math.max(30000, w.recover - w.at);
  const x0 = w.at - span * 1.5, x1 = w.recover + span * 1.2;
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const inc = Math.round((x0 + (x1 - x0) * i / 80) / 1000) * 1000;
    pts.push([inc, calcTakeHome({ income: inc, ...w.opt }).takeHome]);
  }
  const ys = pts.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 400, H = 150, T = 18, B = 26;
  const X = (v) => ((v - x0) / (x1 - x0)) * W;
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  return `<figure class="dg wall-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="年収${man(w.at)}万〜${man(w.recover)}万円は、手取りが壁の手前より少なくなる">
<rect x="${X(w.at)}" y="${T - 6}" width="${X(w.recover) - X(w.at)}" height="${H - T - B + 6}" fill="var(--alert-bg)"/>
<line x1="0" x2="${W}" y1="${Y(w.before.takeHome)}" y2="${Y(w.before.takeHome)}" stroke="var(--gross)" stroke-dasharray="4 4"/>
<polyline points="${pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="3" stroke-linejoin="round"/>
<text class="dg-s2" x="${X(w.at)}" y="${H - 8}" text-anchor="end">${man(w.at)}万</text>
<text class="dg-s2" x="${X(w.recover) + 2}" y="${H - 8}">${man(w.recover)}万</text>
<text class="wall-loss" x="${(X(w.at) + X(w.recover)) / 2}" y="${T + 4}" text-anchor="middle">損する区間</text>
</svg><figcaption class="note">青い線＝手取り、点線＝壁の手前の手取り。年収が増えても、色の区間は点線より下（損）です。</figcaption></figure>`;
}

function kabePage() {
  const loss = (w) => w.before.takeHome - w.after.takeHome;
  const lossText = (w) => (loss(w) < 10000 ? `${yen(loss(w))}円` : `${man(loss(w))}万円`);
  const zone = (w) => `<a class="zone" href="#${w.key}">
  <span class="zone-r"><small>年収</small>${man(w.at)}万〜${man(w.recover)}万円</span>
  <span class="zone-l">最大 −${lossText(w)}</span>
  <span class="zone-t">${esc(w.title.replace(/（配偶者を扶養している人）/, ''))}</span>
</a>`;
  const all = WALLS.filter((w) => !w.opt.spouse);
  const sp = WALLS.filter((w) => w.opt.spouse);
  const zonesJson = JSON.stringify(WALLS.map((w) => ({ at: w.at, spouse: !!w.opt.spouse, title: w.title, key: w.key })));
  const sections = WALLS.map((w) => `
<section class="wall-sec" id="${w.key}">
<h3>年収${man(w.at)}万〜${man(w.recover)}万円：${esc(w.title)}</h3>
<p>${esc(w.why)}</p>
${wallChart(w)}
<div class="wall-steps">
  <div><small>壁の手前</small><span>年収 ${yen(w.before.income)}円</span><b>手取り ${yen(w.before.takeHome)}円</b></div>
  <div class="bad"><small>越えた直後</small><span>年収 ${yen(w.after.income)}円</span><b>手取り ${yen(w.after.takeHome)}円</b><em>−${yen(loss(w))}円</em></div>
  <div class="ok"><small>元に戻る</small><span>年収 ${yen(w.recover)}円</span><b>手取り ${yen(calcTakeHome({ income: w.recover, ...w.opt }).takeHome)}円</b></div>
</div>
</section>`).join('\n');
  const body = `
<div class="crumb"><a href="${SITE}/">手取りナビ</a> › 手取りの壁</div>
<h1>年収が増えると手取りが減る「壁」はいくら？【${RULES.label}】</h1>
<section class="verdict">
  <div class="verdict-h">結論：損するのは、この年収の区間だけ</div>
  <div class="zone-g"><div class="zone-gh">👤 すべての会社員</div>${all.map(zone).join('')}</div>
  <div class="zone-g"><div class="zone-gh">💍 配偶者（収入なし）を扶養している人は、さらに</div>${sp.map(zone).join('')}</div>
  <p class="verdict-f">損は数千円〜数万円。<b>区間の上の端（元に戻る年収）まで上がれば取り戻せます。</b>昇給を断るほどではありません。</p>
</section>

<section class="sim card">
  <h2 class="sim-h">🔎 自分は壁にかかる？</h2>
  <div class="sim-f">
    <label>年収（額面・賞与なし）<span class="inrow"><input id="w-i" type="number" min="100" max="3000" step="1" value="${Math.round(WALLS[0].at / 10000)}"><b>万円</b></span></label>
    <label>配偶者（収入なし）を扶養<span class="inrow"><select id="w-s"><option value="">していない</option><option value="1">している</option></select></span></label>
  </div>
  <div id="w-out" aria-live="polite"></div>
</section>
<script type="module">
import { calcTakeHome, yen, man } from './assets/tax.js';
const Z = ${zonesJson};
const $ = (id) => document.getElementById(id);
function render() {
  const inc = Math.round((parseFloat($('w-i').value) || 0) * 10000);
  const spouse = !!$('w-s').value;
  const zs = Z.filter((z) => spouse || !z.spouse);
  const th = (i) => calcTakeHome({ income: i, spouse }).takeHome;
  let html = '';
  for (const z of zs) {
    if (inc < z.at) continue;
    const before = th(z.at - 1000);
    if (th(inc) >= before) continue;
    let rec = inc; while (th(rec) < before) rec += 1000;
    html = '<div class="wcheck bad"><b>⚠️ 壁の区間に入っています</b><span>' + z.title + '</span><span>壁の手前（年収' + man(z.at - 1000) + '万円）より手取りが<strong>' + yen(before - th(inc)) + '円少ない</strong>。年収をあと<strong>' + man(rec - inc) + '万円</strong>上げると元に戻ります。</span><a href="#' + z.key + '">くわしく →</a></div>';
    break;
  }
  if (!html) {
    const next = zs.find((z) => z.at > inc && z.at - inc <= 500000);
    html = next
      ? '<div class="wcheck warn"><b>🟡 いまは大丈夫。でも、あと' + man(next.at - inc) + '万円で壁</b><span>' + next.title + '</span><a href="#' + next.key + '">くわしく →</a></div>'
      : '<div class="wcheck ok"><b>✅ 壁の区間には入っていません</b><span>年収が増えれば、そのぶん手取りも増えます。</span></div>';
  }
  $('w-out').innerHTML = html;
}
document.querySelectorAll('#w-i,#w-s').forEach((el) => el.addEventListener('input', render));
render();
</script>

${talk([
    ['yuto', 'えっ、年収が増えて手取りが減るなんてことあるんですか？'],
    ['sensei', `2026・2027年は、所得が一定以下の人の<b>基礎控除が上乗せ</b>されておる。年収が約${man(WALLS[0].at)}万円を超えると上乗せが急に減るから、税金が一気に増えるんじゃ。`],
    ['yuto', 'iDeCoで所得を減らせば避けられますか？'],
    ['sensei', 'それが<b>避けられない</b>んじゃ。壁を決めるのは「合計所得」で、iDeCoの掛金は合計所得を減らさないからの。iDeCoは税金そのものは減らすが、壁の位置は動かんぞ。'],
    ['yuto', 'じゃあ、どうすれば？'],
    ['sensei', '<b>越えるなら、元に戻る年収までしっかり越える</b>。少しだけ越えそうなら、残業や昇給の時期を会社と相談するのもアリじゃ。'],
  ])}
${adSlot()}
<h2>壁ごとのくわしい計算</h2>
<p class="h2-sub">会社員・賞与なし・東京都の場合</p>
${sections}
<h2 id="grade">社会保険料の等級による小さな段差</h2>
<p>社会保険料は月給を「標準報酬月額」の等級に当てはめて決まるため、月給が等級の境目を越えると保険料が一段上がります。境目のすぐ上では、昇給額より保険料の増加が大きくなり、手取りがわずかに減ることがあります（年数千円〜3万円程度）。</p>
<ul class="points">
<li>23歳未満の子どもを扶養しているなど「所得金額調整控除」を受ける人は、合計所得が少し下がるため、年収850万円超の壁の位置が少し上にずれます。</li>
</ul>
<h2>パート・アルバイトの壁は？</h2>
<div class="related"><a href="${SITE}/part-kabe.html">103万・106万・130万…<b>扶養内パートの年収の壁 一覧 →</b></a><a href="${SITE}/">自分の年収で<b>手取りを計算する →</b></a></div>`;
  return layout({
    title: `${RULES.label}の手取りの壁｜年収が増えると手取りが減るのはいくら？`,
    description: `2026年の税制改正で生まれた「手取りの壁」。年収${man(WALLS[0].at)}万〜${man(WALLS[0].recover)}万円は手取りが最大${man(loss(WALLS[0]))}万円減ります。損する年収の区間と、自分が当てはまるかのチェック、元に戻る年収を計算。`,
    path: 'kabe.html', body,
    sticky: `<a class="p" href="#w-out">自分は壁にかかる？</a>`,
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
<li>住民税は同じ所得に対する年額（実際は翌年6月から納付）。税率10%、均等割5,000円（森林環境税含む）、2026年の所得にかかる令和9年度分として、給与所得控除の最低保障は74万円で計算しています。</li>
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
<p>サイト改善のため、Google が提供するアクセス解析ツール「Google アナリティクス」を利用しています。Google アナリティクスは Cookie を使用して、どのページが見られたか・どのボタンが押されたかなどのデータを匿名で収集します。個人を特定する情報は含まれません。計算ツールに入力した年収などの数値は送信していません。詳しくは<a href="https://marketingplatform.google.com/about/analytics/terms/jp/" rel="noopener">Google アナリティクス利用規約</a>と<a href="https://policies.google.com/privacy?hl=ja" rel="noopener">Google のプライバシーポリシー</a>をご覧ください。</p>
<h2>免責事項</h2>
<p>当サイトの計算結果は概算であり、正確性を保証するものではありません。当サイトの情報を利用したことによる損害について、一切の責任を負いかねます。</p>`;
  return layout({ title: `プライバシーポリシー｜${config.siteName}`, description: '手取りナビのプライバシーポリシーと免責事項。', path: 'privacy.html', body });
}

// ─── 出力 ─────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });
copyFileSync(join(ROOT, 'src/tax.js'), join(DIST, 'assets/tax.js'));
copyFileSync(join(ROOT, 'src/view.js'), join(DIST, 'assets/view.js'));
copyFileSync(join(ROOT, 'src/chars.js'), join(DIST, 'assets/chars.js'));
// static/ のファイル（Search Console の確認用ファイルなど）はそのまま公開する
if (existsSync(join(ROOT, 'static'))) cpSync(join(ROOT, 'static'), DIST, { recursive: true });

write('index.html', indexPage());
write('nenshu/index.html', nenshuIndex());
for (const n of pageIncomes) write(`nenshu/${n}.html`, nenshuPage(n));
write('kabe.html', kabePage());
write('about.html', aboutPage());
write('hikaku.html', hikakuPage());
write('operator.html', operatorPage());
write('part-kabe.html', partKabePage());
write('guide/index.html', guideIndex());
GUIDES.forEach((g) => write(`guide/${g.slug}.html`, guidePage(g)));
write('topics/index.html', topicsIndex());
TOPICS.forEach((t, i) => write(`topics/${t.slug}.html`, topicPage(t, i)));
write('privacy.html', privacyPage());
write('404.html', layout({ title: 'ページが見つかりません', description: '', path: '404.html', body: `<h1>ページが見つかりません</h1><p><a href="${SITE}/">手取り計算ツールへ戻る</a></p>` }));

const urls = ['', 'nenshu/', 'hikaku.html', 'kabe.html', 'part-kabe.html', 'guide/', ...GUIDES.map((g) => `guide/${g.slug}.html`), 'topics/', ...TOPICS.map((t) => `topics/${t.slug}.html`), 'about.html', 'operator.html', ...pageIncomes.map((n) => `nenshu/${n}.html`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${RULES.updated}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
if (config.adsenseClient) write('ads.txt', `google.com, ${config.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`dist/ に ${urls.length + 2} ページを生成しました（${TODAY}）`);
for (const w of WALLS) console.log(`  壁: ${w.title} 年収${w.at}円 手取り${w.after.takeHome - w.before.takeHome}円 回復${w.recover}円`);
