// 画面部品（HTML文字列を返す）。ビルド時（Node）と計算ツール（ブラウザ）の両方で使う。
import { calcTakeHome, deductionValue, PREF_HEALTH, yen, man } from './tax.js';

// 国税庁「令和7年分 民間給与実態統計調査」1年を通じて勤務した給与所得者の平均給与（万円）
export const AVERAGES = {
  source: '国税庁「令和7年分 民間給与実態統計調査」',
  sourceUrl: 'https://www.nta.go.jp/publication/statistics/kokuzeicho/minkan/gaiyou/2025.htm',
  rows: [['全体の平均', 487], ['男性の平均', 597], ['女性の平均', 342], ['正社員の平均', 559]],
  mode: '300万円超400万円以下', // 最も人数が多い層（全体）
};
export const PREFS = Object.keys(PREF_HEALTH);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x, d = 1) => (x * 100).toFixed(d);
const calc = (n, opt = {}) => calcTakeHome({ income: n * 10000, ...opt });

export const SERIES = [
  ['takeHome', '手取り', 'var(--s1)'],
  ['social', '社会保険料', 'var(--s2)'],
  ['incomeTax', '所得税', 'var(--s3)'],
  ['residentTax', '住民税', 'var(--s4)'],
];

// ─── 結果のヒーロー ─────────────────────────────────────────
export function hero(n, r, opt = {}) {
  return `
<section class="hero">
  <div class="hero-label">年収${n.toLocaleString('ja-JP')}万円の手取り</div>
  <div class="hero-main"><span class="hero-k">${opt.bonus ? '月平均' : '月'}</span><span class="hero-v">${man(r.takeHomeMonthly)}</span><span class="hero-u">万円</span></div>
  <div class="hero-sub">年 <strong>${man(r.takeHome)}万円</strong>　・　手取り率 <strong>${pct(r.rate)}%</strong>${opt.bonus ? '<br><small>月平均はボーナス分を12か月で割った額です</small>' : ''}</div>
  ${splitBar(r)}
</section>`;
}

// 年収を100%とした内訳バー＋値つき凡例（色だけに頼らない）
export function splitBar(r) {
  return `
<div class="split" role="img" aria-label="年収の内訳：手取り${pct(r.rate)}%">
  ${SERIES.map(([k, label, c]) => `<span style="flex:${r[k]} 0 0;background:${c}" title="${label} ${yen(r[k])}円"></span>`).join('')}
</div>
<ul class="split-legend">
  ${SERIES.map(([k, label, c]) => `<li><i style="background:${c}"></i>${label}<b>${man(r[k])}万</b><small>${pct(r[k] / r.income)}%</small></li>`).join('')}
</ul>`;
}

// ─── 次に知りたいこと ───────────────────────────────────────
// 並び順は site.config.json の nextOrder で決める（アクセス解析のクリック数で更新する）
export function nextItems(n, r, opt = {}) {
  const up50 = calc(n + 50, opt);
  const married = calc(n, { ...opt, spouse: true });
  const rentLo = r.takeHomeMonthly * 0.25;
  const rentHi = r.takeHomeMonthly * 0.3;
  const ideco = Math.round(240000 * deductionValue(r));
  return {
    rent: { icon: '🏠', q: '家賃はいくらまで？', a: `月${man(rentLo, 0)}〜${man(rentHi, 0)}万円`, href: '#life' },
    up: { icon: '📈', q: '年収+50万円なら？', a: `手取り+${man(up50.takeHome - r.takeHome)}万円`, href: '#up' },
    family: { icon: '👪', q: '結婚・扶養で変わる？', a: opt.spouse ? '条件別に比較' : `手取り+${man(married.takeHome - r.takeHome)}万円`, href: '#family' },
    furusato: { icon: '🎁', q: 'ふるさと納税はいくらまで？', a: r.furusato ? `約${man(r.furusato)}万円` : '対象外', href: '#save' },
    ideco: { icon: '🐷', q: 'iDeCoでいくら節税？', a: `年${man(ideco)}万円`, href: '#save' },
    avg: { icon: '📊', q: '平均年収と比べると？', a: `${n >= AVERAGES.rows[0][1] ? '+' : '−'}${Math.abs(n - AVERAGES.rows[0][1]).toLocaleString('ja-JP')}万円`, href: '#avg' },
  };
}

export function nextCards(items, order, extra = []) {
  const list = [...extra, ...order.filter((k) => items[k]).map((k) => ({ key: k, ...items[k] }))];
  return `
<nav class="next" aria-label="次に知りたいこと">
  <h2 class="next-h">次に知りたいこと</h2>
  <div class="next-grid">
  ${list.map((i) => `<a class="next-card${i.alert ? ' alert' : ''}" href="${esc(i.href)}" data-next="${esc(i.key)}"><span class="ni">${i.icon}</span><span class="nq">${esc(i.q)}</span><span class="na">${esc(i.a)}</span></a>`).join('')}
  </div>
</nav>`;
}

// ─── 年収アップ：額面の増加（薄い帯）のうち手取りに残る分（濃い帯） ───
export function upBars(n, r, opt = {}, link = () => null) {
  const steps = [10, 30, 50, 100, 200];
  const max = steps[steps.length - 1] * 10000;
  return `
<div class="upbars">
  ${steps.map((d) => {
    const u = calc(n + d, opt);
    const gain = u.takeHome - r.takeHome;
    const href = link(n + d);
    const label = `${(n + d).toLocaleString('ja-JP')}万円`;
    return `
  <div class="up-row">
    <div class="up-k">${href ? `<a href="${href}">${label}</a>` : label}<small>+${d}万</small></div>
    <div class="up-track" style="width:${(d * 10000 / max) * 100}%"><span style="width:${Math.max(0, gain / (d * 10000)) * 100}%"></span></div>
    <div class="up-v"><b>+${man(gain)}万</b><small>${pct(gain / (d * 10000), 0)}%残る</small></div>
  </div>`;
  }).join('')}
  <p class="note"><i class="sw sw-track"></i>額面で増える額　<i class="sw sw-fill"></i>そのうち手取りに残る額</p>
</div>`;
}

// ─── 年収と手取りの関係（折れ線＋自分の位置） ────────────────
export function lineChart(n, opt = {}) {
  const xMax = Math.max(2000, Math.ceil((n * 1.25) / 500) * 500);
  const xMin = 100;
  const W = 400, H = 250, L = 46, R = 22, T = 12, B = 30;
  const pts = [];
  for (let x = xMin; x <= xMax; x += xMax > 3000 ? 50 : 20) pts.push([x, calc(x, opt).takeHome / 10000]);
  const sx = (x) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
  const sy = (y) => T + (1 - y / xMax) * (H - T - B);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  const area = `${pts.map(([x], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(x).toFixed(1)}`).join('')}${pts.slice().reverse().map(([x, y]) => `L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('')}Z`;
  const tickStep = xMax > 3000 ? 1000 : 500;
  const ticks = [];
  for (let t = 0; t <= xMax; t += tickStep) ticks.push(t);
  const me = calc(n, opt).takeHome / 10000;
  const data = pts.map(([x, y]) => [x, Math.round(y * 10) / 10]);
  return `
<figure class="chart" data-chart='${JSON.stringify({ L, R, T, B, W, H, xMin, xMax, data })}'>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="年収と手取りの関係。年収${n}万円で手取り約${man(me * 10000)}万円">
  ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text class="ax" x="${L - 6}" y="${sy(t) + 4}" text-anchor="end">${t ? `${t}万` : '0'}</text>`).join('')}
  ${ticks.filter((t) => t >= xMin).map((t) => `<text class="ax" x="${sx(t)}" y="${H - 10}" text-anchor="${t === xMax ? 'end' : 'middle'}">${t}万</text>`).join('')}
  <path class="gap" d="${area}"/>
  <line class="gross" x1="${sx(xMin)}" y1="${sy(xMin)}" x2="${sx(xMax)}" y2="${sy(xMax)}"/>
  <path class="take" d="${line}"/>
  <line class="me-v" x1="${sx(n)}" x2="${sx(n)}" y1="${sy(n)}" y2="${H - B}"/>
  <circle class="me" cx="${sx(n)}" cy="${sy(me)}" r="6"/>
  <text class="me-t" x="${sx(n) + (n > xMax * 0.7 ? -10 : 10)}" y="${sy(me) + 20}" text-anchor="${n > xMax * 0.7 ? 'end' : 'start'}">あなた：手取り${man(me * 10000, 0)}万</text>
  <g class="hover" style="display:none"><line class="cross" y1="${T}" y2="${H - B}"/><circle class="dot" r="5"/></g>
  <rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
</svg>
<div class="tip" hidden></div>
<figcaption><span><i class="sw sw-take"></i>手取り</span><span><i class="sw sw-gross"></i>額面（年収）</span><span><i class="sw sw-gap"></i>差＝税金・社会保険料</span></figcaption>
</figure>`;
}

// ─── 家族構成・年齢による違い ─────────────────────────────────
// 条件を変えたときの手取りの違い：「〜すると → 手取り ○万円（±△万）」を理由つきで並べる
function compareList(baseLabel, base, rows) {
  const sign = (v) => `${v >= 0 ? '+' : '−'}${man(Math.abs(v))}万円`;
  return `
<div class="cl">
  <div class="cl-base"><span>基準：${baseLabel}</span><b>年${man(base.takeHome)}万円</b></div>
  ${rows.map(([icon, label, why, r]) => {
    const d = r.takeHome - base.takeHome;
    return `<div class="cl-row"><span class="cl-ico">${icon}</span><div class="cl-k"><b>${label}</b><small>${why}</small></div><div class="cl-v ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}"><b>${d ? sign(d) : '±0'}</b><small>年${man(r.takeHome)}万円</small></div></div>`;
  }).join('')}
</div>`;
}

export function familyBars(n, opt = {}) {
  const o = { ...opt, over40: false, spouse: false, dependents: 0 };
  return compareList('独身・40歳未満', calc(n, o), [
    ['🎂', '40歳になると', '介護保険料が加わるため', calc(n, { ...o, over40: true })],
    ['💍', '配偶者（収入なし）を扶養すると', '配偶者控除で税金が減るため', calc(n, { ...o, spouse: true })],
    ['👨‍👩‍👦', 'さらに16歳以上の子を1人扶養すると', '扶養控除で税金がさらに減るため', calc(n, { ...o, spouse: true, dependents: 1 })],
  ]);
}

// 住んでいる地域（健康保険料率）とボーナスの有無による違い
export function conditionBars(n) {
  const rates = Object.entries(PREF_HEALTH).sort((a, b) => a[1] - b[1]);
  const [lowPref] = rates[0];
  const [highPref] = rates[rates.length - 1];
  return compareList('東京都・ボーナスなし', calc(n), [
    ['📍', `${lowPref}で働くと`, '健康保険料率が全国で最も低いため', calc(n, { pref: lowPref })],
    ['📍', `${highPref}で働くと`, '健康保険料率が全国で最も高いため', calc(n, { pref: highPref })],
    ['💰', '同じ年収で、ボーナスが年4か月分あると', '社会保険料のかかり方が変わるため', calc(n, { bonus: n * 10000 * 4 / 16 })],
  ]);
}

// 平均年収との比較（0から描く棒）
export function avgBars(n) {
  const rows = [['あなた', n, true], ...AVERAGES.rows];
  const max = Math.max(...rows.map((r) => r[1]));
  return `
<div class="hbars">
${rows.map(([k, v, me]) => `<div class="hb-row avg"><div class="hb-k">${me ? '<b>あなた</b>' : k}</div><div class="hb-bar"><span class="${me ? 'me' : 'base'}" style="width:${(v / max) * 100}%"></span></div><div class="hb-v"><b>${v.toLocaleString('ja-JP')}万</b>${me ? '' : `<small>${n >= v ? '+' : '−'}${Math.abs(n - v).toLocaleString('ja-JP')}万</small>`}</div></div>`).join('')}
<p class="note">額面の年収で比較。出典：<a href="${AVERAGES.sourceUrl}" rel="noopener">${AVERAGES.source}</a>（1年を通じて勤務した給与所得者）。最も人数が多いのは年収${AVERAGES.mode}の層です。</p>
</div>`;
}

// ─── 暮らしの目安 ───────────────────────────────────────────
export function lifeTiles(r) {
  const m = r.takeHomeMonthly;
  return `
<div class="tiles">
  <div class="tile"><div class="k">🏠 家賃の目安（手取りの25〜30%）</div><div class="v">${man(m * 0.25, 1)}〜${man(m * 0.3, 1)}<small>万円/月</small></div></div>
  <div class="tile"><div class="k">💰 貯金の目安（手取りの10〜20%）</div><div class="v">${man(m * 0.1, 1)}〜${man(m * 0.2, 1)}<small>万円/月</small></div></div>
  <div class="tile"><div class="k">📅 1日あたりの手取り</div><div class="v">${yen(r.takeHome / 365)}<small>円</small></div></div>
</div>
<p class="note">家賃・貯金の割合は家計相談でよく使われる一般的な目安です。</p>`;
}

export function saveTiles(r, ctaFurusato = '', ctaIdeco = '') {
  const ideco = Math.round(240000 * deductionValue(r));
  return `
<div class="tiles two">
  <div class="tile"><div class="k">🎁 ふるさと納税の上限（目安）</div><div class="v">${r.furusato ? `${man(r.furusato)}<small>万円</small>` : '—'}</div>
  <p class="note">自己負担2,000円で返礼品がもらえる寄付額。他の控除があると下がるので少し余裕を。</p>${ctaFurusato}</div>
  <div class="tile"><div class="k">🐷 iDeCoで月2万円積み立てると</div><div class="v">−${man(ideco)}<small>万円/年の税金</small></div>
  <p class="note">掛金が全額控除になる分、所得税・住民税が軽くなります。原則60歳まで引き出せません。</p>${ctaIdeco}</div>
</div>`;
}

// ─── ブラウザ：グラフのホバー ─────────────────────────────────
export function attachCharts(root = document) {
  root.querySelectorAll('figure.chart:not([data-bound])').forEach((fig) => {
    fig.dataset.bound = '1';
    const c = JSON.parse(fig.dataset.chart);
    const svg = fig.querySelector('svg');
    const hover = svg.querySelector('.hover');
    const cross = hover.querySelector('.cross');
    const dot = hover.querySelector('.dot');
    const tip = fig.querySelector('.tip');
    const sx = (x) => c.L + ((x - c.xMin) / (c.xMax - c.xMin)) * (c.W - c.L - c.R);
    const sy = (y) => c.T + (1 - y / c.xMax) * (c.H - c.T - c.B);
    const move = (ev) => {
      const box = svg.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * c.W;
      const x = c.xMin + ((px - c.L) / (c.W - c.L - c.R)) * (c.xMax - c.xMin);
      let best = c.data[0];
      for (const d of c.data) if (Math.abs(d[0] - x) < Math.abs(best[0] - x)) best = d;
      hover.style.display = '';
      cross.setAttribute('x1', sx(best[0])); cross.setAttribute('x2', sx(best[0]));
      dot.setAttribute('cx', sx(best[0])); dot.setAttribute('cy', sy(best[1]));
      tip.hidden = false;
      tip.innerHTML = `年収 <b>${best[0]}万円</b><br>手取り <b>${best[1]}万円</b>（${((best[1] / best[0]) * 100).toFixed(0)}%）`;
      const left = (sx(best[0]) / c.W) * box.width;
      tip.style.left = `${Math.min(box.width - 150, Math.max(0, left - 75))}px`;
    };
    const hit = svg.querySelector('.hit');
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hover.style.display = 'none'; tip.hidden = true; });
  });
}

// クリックされた「次に知りたいこと」を計測（GA4 が設定されている場合のみ）
export function trackNext(root = document) {
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-next]');
    if (a && typeof window.gtag === 'function') window.gtag('event', 'next_click', { item: a.dataset.next, page_path: location.pathname });
  });
}
