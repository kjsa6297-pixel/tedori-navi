// SNS投稿文とブログ記事を、計算エンジンの数字から作る（AIは使わない・費用ゼロ）。
// 同じ日付なら同じ内容になる。
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTakeHome, idecoSaving, PREF_HEALTH, RULES, yen, man } from '../../src/tax.js';
import { AVERAGES } from '../../src/view.js';
import { topics } from '../../src/topics.js';
import { guides } from '../../src/guides.js';
import { PART_WALLS, IMPACT_LABEL } from '../../src/walls.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
export const SITE = config.siteUrl.replace(/\/$/, '');

// アフィリエイト（site.config.json の affiliates）。URL が入っているものだけ記事に出し、「PR」と明記する
export const adLink = (key, aff = config.affiliates || {}) => {
  const a = aff[key];
  return a?.url ? `\n\n👉 **[${a.label}](${a.url.replace(/^\/\//, 'https://')})**（PR）` : '';
};
// 広告リンクを含む記事は、冒頭に広告であることを書く（ステマ規制）
export const disclose = (body) => (/（PR）/.test(body) ? `※この記事にはプロモーション（広告）が含まれます。\n\n${body}` : body);

const calc = (n, opt = {}) => calcTakeHome({ income: n * 10000, ...opt });
const pct = (x) => `${Math.round(x * 100)}%`;
const POPULAR = [300, 350, 400, 450, 500, 550, 600, 650, 700, 800, 900, 1000];

// 日付 → 通し番号（ローテーション用）
function dayIndex(date) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
}

// 所得税の基礎控除が104万→67万に下がる年収（2026・2027年の特例）
export function wallAt(limit, opt = {}) {
  let at = 1000000;
  while (calcTakeHome({ income: at, ...opt }).totalIncome <= limit) at += 1000;
  const before = calcTakeHome({ income: at - 1000, ...opt });
  const after = calcTakeHome({ income: at, ...opt });
  return { at, drop: before.takeHome - after.takeHome };
}
export const basicWall = () => wallAt(4890000);

const WALL_FACTS = [
  () => { const w = basicWall(); return `年収が約${man(w.at, 0)}万円を超えると、所得税の基礎控除が104万円→67万円に下がり、手取りが約${man(w.drop)}万円減ります（独身の場合）。`; },
  () => { const w = wallAt(9000000, { spouse: true }); return `配偶者を扶養している人は、年収約${man(w.at, 0)}万円を超えると配偶者控除が38万円→26万円に下がり、手取りが約${man(w.drop)}万円減ります。`; },
  () => { const w = wallAt(6550000); return `年収約${man(w.at, 0)}万円を超えると、基礎控除の上乗せ（5万円）がなくなり、手取りが約${yen(w.drop)}円減ります。`; },
];

function prefExtremes(n) {
  const rates = Object.entries(PREF_HEALTH).sort((a, b) => a[1] - b[1]);
  const [low] = rates[0];
  const [high] = rates[rates.length - 1];
  return { low, high, lowR: calc(n, { pref: low }), highR: calc(n, { pref: high }) };
}

// ─── 𝕏 の投稿文 ────────────────────────────────────────────
// 𝕏 の文字数：全角は2、URLは23として280以内
export function xWeight(text) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  let rest = text;
  for (const u of urls) rest = rest.replace(u, '');
  let w = urls.length * 23;
  for (const ch of rest) w += /[\u0000-ჿ -‍‐-‟′-‷]/.test(ch) ? 1 : 2;
  return w;
}

const X_TEMPLATES = [
  (i) => {
    const n = POPULAR[i % POPULAR.length];
    const r = calc(n);
    const up = calc(n + 50);
    return `【年収${n}万円の手取り｜2026年】\n月${man(r.takeHomeMonthly)}万円・年${man(r.takeHome)}万円（独身・東京）\n\nあと50万円上がると手取りは+${man(up.takeHome - r.takeHome)}万円。増えた分の${pct((up.takeHome - r.takeHome) / 500000)}が残ります。\n\n内訳・家賃の目安はこちら👇\n${SITE}/nenshu/${n}.html\n#手取り #年収`;
  },
  (i) => {
    const head = ['⚠️2026年の「手取りの壁」', '年収が増えたのに手取りが減る？（2026年）'][Math.floor(i / WALL_FACTS.length) % 2];
    const tail = ['越えるなら「元に戻る年収」まで。前後の手取りを計算しました👇', '壁の前後の手取りと、元に戻る年収はこちら👇'][Math.floor(i / WALL_FACTS.length) % 2];
    return `${head}\n\n${WALL_FACTS[i % WALL_FACTS.length]()}\n\n${tail}\n${SITE}/kabe.html\n#手取り #年収の壁`;
  },
  (i) => {
    const n = [400, 500, 600, 350, 700, 450, 800][i % 7];
    const p = prefExtremes(n);
    return `同じ年収${n}万円でも、住む県で手取りが変わります。\n\n${p.low}：${man(p.lowR.takeHome)}万円\n${p.high}：${man(p.highR.takeHome)}万円\n差は年${yen(p.lowR.takeHome - p.highR.takeHome)}円（健康保険料率の違い）\n\n47都道府県に対応した手取り計算👇\n${SITE}/\n#手取り`;
  },
  (i) => {
    const [x, y] = [[550, 600], [400, 450], [650, 720], [480, 520], [800, 900], [350, 400], [700, 760]][i % 7];
    const a = calc(x);
    const b = calc(y);
    return `転職で年収${x}万→${y}万。手取りはいくら増える？\n\n額面の差：+${y - x}万円\n手取りの差：+${man(b.takeHome - a.takeHome)}万円（月+${man((b.takeHome - a.takeHome) / 12)}万円）\n\n内定・オファーを手取りで比べるツールを作りました👇\n${SITE}/hikaku.html\n#転職 #手取り`;
  },
  (i) => {
    const n = [400, 500, 600, 700, 450, 550, 800, 650][i % 8];
    const r = calc(n);
    return `年収${n}万円の人が使える節税の目安（2026年・独身）\n\n🎁ふるさと納税の上限：約${man(r.furusato)}万円\n🐷iDeCo月2万円で税金が年${man(idecoSaving(r, 240000))}万円軽く\n\n自分の年収で計算👇\n${SITE}/?income=${n}\n#ふるさと納税 #iDeCo`;
  },
  (i) => {
    const n = [450, 550, 650, 380, 520, 750, 420, 600, 900][i % 9];
    const avg = AVERAGES.rows[0][1];
    const r = calc(n);
    return `会社員の平均年収は${avg}万円（${AVERAGES.source.replace(/「|」/g, '')}）。\n\n年収${n}万円なら平均より${n >= avg ? `${n - avg}万円上` : `${avg - n}万円下`}で、手取りは月${man(r.takeHomeMonthly)}万円。\n\nあなたの年収と手取りを比べる👇\n${SITE}/nenshu/${n}.html\n#年収 #手取り`;
  },
];

// 1日おきに「明日話せるお金の豆知識」
function topicPost(i) {
  const list = topics();
  const t = list[i % list.length];
  return `💡明日話せるお金の話\n\n${t.doya}\n\n${t.title}👇\n${SITE}/topics/${t.slug}.html\n#お金の豆知識 #${t.tag.replace(/\s/g, '')}`;
}

// ─── 日記のような「お金メモ」（リンクなし） ─────────────────
// ふだんはリンクを貼らず、読んだ人がその場で得をするメモだけを投稿する。宣伝は週1回（PROMO_EVERY日に1回）
export const PROMO_EVERY = 7;
const MEMO_HEAD = ['📝今日のお金メモ', '📝お金のメモ', '📝きょうの手取りメモ'];
const DIARY_INCOMES = [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 900];
const ni = (i, list = DIARY_INCOMES) => list[i % list.length];
const HOW_NISA = [
  '新NISAの枠は、年360万円・一生で1,800万円まで。\n売った分の枠は翌年また使えるようになります。「一度使ったら終わり」ではないのがポイント。',
  '新NISAは非課税で持てる期間が無期限。\n昔のNISAのように「5年で終わり」を気にしなくていいので、慌てて売らなくて大丈夫です。',
  'NISAの「つみたて投資枠」は年120万円、「成長投資枠」は年240万円。\n両方あわせて使えます。まずは毎月の積立から始める人が多いですね。',
  'iDeCo、会社員（企業年金なし）は2027年1月の掛金から上限が月2.3万→6.2万円に上がる予定です。\nただし原則60歳まで引き出せないので、使う予定のないお金で。',
  'こどもNISAは2027年に始まる予定。0〜17歳が対象で、年60万円・総額600万円まで。\n12歳から教育費などに引き出せるのが、昔のジュニアNISAとの違いです。',
];
// 季節のメモ（月ごとに3つ。制度の説明は確実なものだけ）
const SEASON = {
  1: ['源泉徴収票が届く時期。\n「支払金額」が額面の年収、「源泉徴収税額」が1年間に払った所得税です。手取りの答え合わせに。', '1月はふるさと納税の「ワンストップ特例」の申請書の締め切り（1月10日必着）がある月。出し忘れていないか確認を。', '年が明けたら、去年の源泉徴収票で「年収」と「手取り」を一度見比べてみるのがおすすめ。差の大きさにびっくりするかも。'],
  2: ['確定申告の時期（例年2月16日〜3月15日）。\n会社員でも、医療費が年10万円を超えた人などは申告で税金が戻ることがあります。', '会社員の「還付申告」は5年前までさかのぼってできます。医療費控除の出し忘れ、意外と多いです。', 'ふるさと納税で寄付先が6自治体以上になった人は、ワンストップ特例が使えないので確定申告が必要です。'],
  4: ['4〜6月の給料の平均で、9月からの社会保険料が決まります。\nこの時期に残業が多いと、1年間保険料が高くなることも。', '新年度。昇給した人は、額面ではなく「手取りでいくら増えたか」を一度計算してみると現実が見えます。', '4〜6月の残業代も社会保険料の計算に入ります。「残業した分、まるまる得」とは限らないんですよね。'],
  6: ['6月から住民税が新しい年度の額に変わります。\n去年の所得で決まるので、去年昇給した人は今月から天引きが増えるかも。', '住民税は「前の年の所得」にかかる税金。だから就職1年目は住民税がほとんど引かれず、2年目に手取りが減ったように感じます。', '夏のボーナスにも社会保険料と所得税がかかります。額面の8割くらいが手取りの目安です。'],
  9: ['9月分から社会保険料が新しい額に（4〜6月の給料で決まったもの）。\n10月の給与明細で、保険料が変わっていないか見てみてください。', '給与明細の「健康保険」「厚生年金」は、会社も同じ額を払っています。実は見えないところで倍かかっているんです。', '秋は年末調整の準備期間。生命保険や地震保険の「控除証明書」が届いたら、捨てずに取っておきましょう。'],
  11: ['年末調整の書類の季節。\n生命保険・地震保険の控除証明書、iDeCoを自分で払っている人は掛金の証明書を添付します。', 'ふるさと納税は1月1日〜12月31日の寄付がその年の分。年末は駆け込みで混むので、早めがおすすめ。', '年末調整で戻ってくるお金は、12月か1月の給料と一緒に入ることが多いです。給与明細の「年調還付」の欄を見てみて。'],
};
const seasonOf = (m) => SEASON[[0, 1, 2, 2, 4, 4, 6, 6, 9, 9, 11, 11, 11][m]];

const DIARY = [
  (i, date) => {
    const n = ni(i); const r = calc(n);
    const minus = (r.income - r.takeHome) / 12; const soc = r.social / 12; const tax = (r.incomeTax + r.residentTax) / 12;
    return `年収${n}万円の手取りは、月にすると約${man(r.takeHomeMonthly)}万円。\n引かれるのは月${man(minus)}万円で、そのうち社会保険料が${man(soc)}万円、税金が${man(tax)}万円。\n${soc > tax ? '税金より保険料のほうが大きい、というのは意外と知られていない気がします。' : 'この年収になると、保険料より税金のほうが大きくなります。'}`;
  },
  (i) => {
    const n = ni(i + 3); const r = calc(n); const u = calc(n + 50); const g = u.takeHome - r.takeHome;
    return `年収が${n}万→${n + 50}万円に上がっても、手取りの増え方は約${man(g)}万円。\n増えた分のうち${pct(1 - g / 500000)}は税金と保険料に。\n昇給の話は「手取りでいくら」で考えると冷静になれます。`;
  },
  (i) => {
    const n = ni(i, [400, 500, 600, 350, 700, 450, 800, 550]); const p = prefExtremes(n);
    return `同じ年収${n}万円でも、${p.low}と${p.high}では手取りが年${yen(p.lowR.takeHome - p.highR.takeHome)}円違います。\n健康保険料の率が都道府県ごとに違うからなんですよね。`;
  },
  (i) => {
    const t = topics()[i % topics().length];
    const extra = t.points.find((x) => xWeight(`💡今日の豆知識\n\n${t.doya}\n\n${x}\n#お金の豆知識`) <= 270) || '';
    return `💡今日の豆知識\n\n${t.doya}${extra ? `\n\n${extra}` : ''}`;
  },
  (i) => {
    const n = ni(i + 5, [400, 500, 600, 700, 450, 550, 800, 650, 350]); const r = calc(n);
    return r.furusato
      ? `年収${n}万円・独身なら、ふるさと納税で自己負担2,000円に収まる寄付は約${man(r.furusato)}万円まで（目安）。\n家族構成やほかの控除で下がるので、少し余裕をもって。`
      : `年収${n}万円だと住民税が少ないので、ふるさと納税の得はほとんどありません。無理にやらなくて大丈夫です。`;
  },
  (i) => {
    const n = ni(i + 2, [350, 450, 500, 600, 700, 400, 550, 800]); const r = calc(n);
    return `iDeCoに月2万円を出すと、年収${n}万円なら税金が年${yen(idecoSaving(r, 240000))}円減る計算です。\nただし原則60歳まで引き出せないので、まずは生活費の貯金を作ってから。`;
  },
  (i) => HOW_NISA[i % HOW_NISA.length],
  (i, date) => { const m = Number(date.slice(5, 7)); return seasonOf(m)[i % 3]; },
  (i) => {
    const n = ni(i + 7); const a = calc(n); const b = calc(n, { over40: true });
    return `40歳になると介護保険料が加わって、年収${n}万円なら手取りが年${yen(a.takeHome - b.takeHome)}円減ります。\n誕生日の前の日がある月から、というのも地味に知られていないポイント。`;
  },
  (i) => WALL_FACTS[i % WALL_FACTS.length]() + '\n越えるなら、手取りが元に戻る年収までしっかり越えるのがコツです。',
];
const TAGS = ['#お金の勉強', '#手取り', '#家計管理', '#お金の豆知識'];

function diaryPost(k, date) {
  const t = DIARY[k % DIARY.length](Math.floor(k / DIARY.length), date);
  const head = /^💡/.test(t) ? '' : `${MEMO_HEAD[k % MEMO_HEAD.length]}\n\n`;
  return `${head}${t}\n${TAGS[k % TAGS.length]}`;
}

// 宣伝（リンクつき）：豆知識と計算ツールの紹介を交互に
function promoPost(k) {
  if (k % 2) return topicPost(Math.floor(k / 2));
  const d = Math.floor(k / 2);
  return X_TEMPLATES[d % X_TEMPLATES.length](Math.floor(d / X_TEMPLATES.length));
}

export function xPost(date) {
  const day = dayIndex(date);
  const promo = day % PROMO_EVERY === 0;
  const text = promo ? promoPost(Math.floor(day / PROMO_EVERY)) : diaryPost(day - Math.floor(day / PROMO_EVERY) - 1, date);
  const first = text.split('\n').find((l) => l && !/^📝/.test(l)) || text.split('\n')[0];
  return { kind: 'x', promo, title: first, body: text };
}

// ─── ブログ記事（はてなブログ・note 共通の Markdown） ───────────
const table = (head, rows, left = false) => `| ${head.join(' | ')} |\n|${head.map((_, i) => (i && !left ? '---:' : '---')).join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
const footer = (path, text) => `\n\n---\n\n**${text}** → [手取りナビ](${SITE}/${path})\n\n※${RULES.label}の制度で計算した概算です（会社員・賞与なし・協会けんぽ東京都・独身・40歳未満が基本の前提）。実際の金額は勤務先・自治体・各種控除で変わります。計算方法と出典は[こちら](${SITE}/about.html)。`;

const ARTICLES = [
  // 都道府県ランキング
  (c) => {
    const n = [500, 400, 600, 700][c % 4];
    const rows = Object.entries(PREF_HEALTH)
      .map(([p, rate]) => [p, rate, calc(n, { pref: p }).takeHome])
      .sort((a, b) => b[2] - a[2]);
    const best = rows[0], worst = rows[rows.length - 1];
    return {
      title: `【2026年】同じ年収${n}万円でも手取りは住む県で変わる｜47都道府県ランキング`,
      body: `会社員の健康保険料（協会けんぽ）は都道府県ごとに料率が違います。2026年度（令和8年度）の料率で、年収${n}万円の手取りを47都道府県で比べました。\n\n## 結論\n\n- 手取りが一番多いのは**${best[0]}**（年${yen(best[2])}円）\n- 一番少ないのは**${worst[0]}**（年${yen(worst[2])}円）\n- その差は**年${yen(best[2] - worst[2])}円**。同じ会社・同じ給料でも、勤務地（加入する支部）でこれだけ変わります\n\n## 47都道府県ランキング（年収${n}万円・独身・40歳未満）\n\n${table(['順位', '都道府県', '健康保険料率', '手取り（年）'], rows.map(([p, rate, t], i) => [i + 1, p, `${(rate * 100).toFixed(2)}%`, `${yen(t)}円`]))}\n\n## なぜ差が出るの？\n\n協会けんぽの料率は、その都道府県の医療費の水準などをもとに毎年決まります。料率の本人負担は半分なので、料率が0.1%違うと、年収${n}万円の人で年およそ${yen(n * 10000 * 0.0005)}円の差になります。\n\n健康保険組合（大企業などの健保）に入っている人は、この表とは料率が違います。給与明細で確認してみてください。${footer('', '47都道府県・ボーナスありで自分の手取りを計算する')}`,
    };
  },
  // 手取りの壁
  (c) => {
    if (c % 2) {
      const w = wallAt(9000000, { spouse: true });
      const rows = [-30, -1, 0, 30, 60, 100].map((d) => {
        const income = w.at + d * 10000;
        return [`${yen(income)}円`, `${yen(calcTakeHome({ income, spouse: true }).takeHome)}円`];
      });
      return {
        title: `【2026年】配偶者を扶養している人の「手取りの壁」は年収約${man(w.at, 0)}万円から`,
        body: `配偶者（収入なし）を扶養している会社員は、本人の合計所得が900万円を超えると配偶者控除が段階的に減ります。年収にすると**約${man(w.at, 0)}万円**からで、越えた直後は手取りが**約${man(w.drop)}万円減ります**。\n\n## 壁の前後の手取り（配偶者を扶養）\n\n${table(['年収', '手取り（年）'], rows)}\n\n## 3段階で減る\n\n- 合計所得900万円超：38万円→26万円\n- 950万円超：26万円→13万円\n- 1,000万円超：0円（受けられない）\n\nそれぞれの境目で手取りが一時的に減ります。昇給や賞与の額が調整できる場合は、手取りが元に戻る年収まで上がるかを確認しておくと安心です。${footer('kabe.html', 'すべての壁と、手取りが元に戻る年収を見る')}`,
      };
    }
    const w = basicWall();
    const rows = [-30, -10, -1, 0, 10, 30, 60].map((d) => {
      const income = w.at + d * 10000;
      return [`${yen(income)}円`, `${yen(calcTakeHome({ income }).takeHome)}円`];
    });
    return {
      title: `【2026年】年収約${man(w.at, 0)}万円を超えると手取りが減る「手取りの壁」とは`,
      body: `2026年（令和8年）の税制改正で、所得税の基礎控除が最大104万円に引き上げられました。ただしこの上乗せには所得の条件があり、**年収約${man(w.at, 0)}万円を超えると基礎控除が104万円→67万円に下がります**。\n\nその結果、壁を越えた直後は**年収が増えたのに手取りが約${man(w.drop)}万円減る**区間ができています（会社員・独身・賞与なしの場合）。\n\n## 壁の前後の手取り\n\n${table(['年収', '手取り（年）'], rows)}\n\n## 損をしないためにできること\n\n- **昇給・残業の時期を調整する**：年収がちょうど壁の少し上になりそうなら、手取りが壁の手前に戻る水準まで上がるかを確認\n- **iDeCoでは壁は避けられない**：壁を決めるのは「合計所得」で、iDeCoの掛金（所得控除）は合計所得を減らしません。税金そのものは減るので節税には役立ちます\n- **配偶者を扶養している人**は、年収約1,095万〜1,195万円にも配偶者控除が減る壁があります\n\n2026年・2027年の特例なので、2028年以降はまた制度が変わる可能性があります。${footer('kabe.html', 'すべての壁と、手取りが元に戻る年収を見る')}`,
    };
  },
  // 昇給で残る割合
  (c) => {
    const ns = [300, 400, 500, 600, 700, 800, 1000, 1200];
    const up = [50, 30, 100][c % 3];
    return {
      title: `昇給${up}万円で手取りはいくら増える？年収別「手元に残る割合」【2026年】`,
      body: `「年収が${up}万円上がる」と聞くとうれしいですが、手取りが${up}万円増えるわけではありません。年収別に、${up}万円の昇給で実際にいくら残るかを計算しました。\n\n${table(['今の年収', '昇給後', '増える手取り', '残る割合'], ns.map((n) => {
        const g = calc(n + up).takeHome - calc(n).takeHome;
        return [`${n}万円`, `${n + up}万円`, `+${man(g)}万円`, pct(g / (up * 10000))];
      }))}\n\n## ポイント\n\n- 年収が高いほど、増えた分にかかる税率が上がり、残る割合は小さくなります\n- 年収約${man(basicWall().at, 0)}万円の前後では、2026年の基礎控除の変更で残る割合が特に小さくなります\n- 転職で年収アップを考えるときは、**額面の差ではなく手取りの差**で比べるのがおすすめです${footer('hikaku.html', '2社のオファーを手取りで比べる')}`,
    };
  },
  // ボーナスの有無
  (c) => {
    const ns = [400, 500, 600, 800];
    const months = [4, 2, 6][c % 3];
    return {
      title: `ボーナス年${months}か月分だと手取りは変わる？同じ年収で比較【2026年・社会保険料のしくみ】`,
      body: `同じ年収でも「ボーナスなし（月給のみ）」と「ボーナスあり」では、社会保険料のかかり方が違うため手取りが少し変わります。年${months}か月分のボーナスがある場合と比べました。\n\n${table(['年収', 'ボーナスなし', `ボーナス年${months}か月分`, '差'], ns.map((n) => {
        const a = calc(n).takeHome;
        const b = calc(n, { bonus: n * 10000 * months / (12 + months) }).takeHome;
        return [`${n}万円`, `${man(a)}万円`, `${man(b)}万円`, `${b - a >= 0 ? '+' : '−'}${yen(Math.abs(b - a))}円`];
      }))}\n\n## なぜ変わるの？\n\n- 月給の社会保険料は、月給を「標準報酬月額」という等級に当てはめて決まります。等級の区切りの位置によって、実際の月給より少し低い等級になる人も高い等級になる人もいます\n- ボーナスの保険料は、ボーナスの額（1,000円未満切り捨て）にそのままかかります\n- 厚生年金はボーナス1回150万円、健康保険は年度573万円が上限です\n\n差は年数千円〜数万円なので、転職先の比較では「年収の総額」と「手取り」を両方見ておけば十分です。${footer('', 'ボーナス込みで自分の手取りを計算する')}`,
    };
  },
  // 年収別の徹底解説（年収を順番に）
  (cycle) => {
    const n = NENSHU[cycle % NENSHU.length];
    const r = calc(n);
    const married = calc(n, { spouse: true });
    const over40 = calc(n, { over40: true });
    return {
      title: `年収${n}万円の手取りは月${man(r.takeHomeMonthly)}万円【2026年】内訳・家賃の目安・節税まで`,
      body: `年収${n}万円の会社員（独身・40歳未満・賞与なし・東京都）の手取りを、2026年の制度で計算しました。\n\n## 手取りは年${man(r.takeHome)}万円・月${man(r.takeHomeMonthly)}万円\n\n${table(['項目', '年額', '月額'], [
        ['年収（額面）', `${yen(r.income)}円`, `${yen(r.income / 12)}円`],
        ['健康保険料（子ども・子育て支援金含む）', `${yen(r.health)}円`, `${yen(r.health / 12)}円`],
        ['厚生年金保険料', `${yen(r.pension)}円`, `${yen(r.pension / 12)}円`],
        ['雇用保険料', `${yen(r.koyou)}円`, `${yen(r.koyou / 12)}円`],
        ['所得税', `${yen(r.incomeTax)}円`, `${yen(r.incomeTax / 12)}円`],
        ['住民税', `${yen(r.residentTax)}円`, `${yen(r.residentTax / 12)}円`],
        ['**手取り**', `**${yen(r.takeHome)}円**`, `**${yen(r.takeHomeMonthly)}円**`],
      ])}\n\n額面の${pct(r.rate)}が手元に残ります。\n\n## 暮らしの目安\n\n- 家賃（手取りの25〜30%）：月${man(r.takeHomeMonthly * 0.25, 1)}〜${man(r.takeHomeMonthly * 0.3, 1)}万円\n- 貯金（手取りの10〜20%）：月${man(r.takeHomeMonthly * 0.1, 1)}〜${man(r.takeHomeMonthly * 0.2, 1)}万円\n\n## 結婚・年齢で変わる\n\n- 配偶者（収入なし）を扶養：年${man(married.takeHome)}万円（${married.takeHome >= r.takeHome ? '+' : '−'}${man(Math.abs(married.takeHome - r.takeHome))}万円）\n- 40歳以上（介護保険料あり）：年${man(over40.takeHome)}万円（−${man(r.takeHome - over40.takeHome)}万円）\n\n## 税金を減らす方法\n\n- ふるさと納税の上限の目安：約${man(r.furusato)}万円\n- iDeCoで月2万円積み立てると、税金が年約${man(idecoSaving(r, 240000))}万円軽くなります${adLink('furusato')}${adLink('ideco')}\n\n## 平均と比べると\n\n${AVERAGES.source}によると、1年を通じて勤務した給与所得者の平均年収は${AVERAGES.rows[0][1]}万円です。年収${n}万円は平均より${n >= AVERAGES.rows[0][1] ? `${n - AVERAGES.rows[0][1]}万円高い` : `${AVERAGES.rows[0][1] - n}万円低い`}水準です。${footer(`nenshu/${n}.html`, `年収${n}万円のグラフ・昇給シミュレーションを見る`)}`,
    };
  },
  // 扶養
  (c) => {
    const ns = [400, 500, 600, 800, 1000, 1200];
    const kids = c % 2;
    const who = kids ? '配偶者と16歳以上の子1人' : '配偶者';
    return {
      title: `${kids ? '配偶者と子どもを扶養' : '結婚して配偶者を扶養'}すると手取りはいくら増える？年収別【2026年】`,
      body: `${who}（収入なし）を扶養すると、配偶者控除${kids ? '・扶養控除' : ''}で所得税・住民税が軽くなります。年収別に手取りの増え方を計算しました。\n\n${table(['年収', '独身', `${who}を扶養`, '増える手取り'], ns.map((n) => {
        const a = calc(n).takeHome, b = calc(n, { spouse: true, dependents: kids }).takeHome;
        return [`${n}万円`, `${man(a)}万円`, `${man(b)}万円`, `+${man(b - a)}万円`];
      }))}\n\n## ポイント\n\n- 本人の年収が約1,095万円を超えると配偶者控除は段階的に減り、約1,195万円を超えるとなくなります\n- 配偶者に収入がある場合は「配偶者特別控除」になり、金額が変わります（この表は収入なしの場合）\n- 16歳未満の子どもは扶養控除の対象外のため、税金は変わりません${footer('', '家族構成を変えて手取りを計算する')}`,
    };
  },
];


// 年収別・月給別の記事にする金額（「年収○万 手取り」「月給○万 手取り」で検索されやすい順）
const NENSHU = [500, 400, 600, 300, 450, 350, 700, 550, 800, 650, 250, 1000, 750, 900, 480, 520, 380, 420, 850, 1200, 280, 950, 1100, 1500];
const GEKKYU = [25, 30, 20, 35, 22, 28, 40, 18, 24, 32, 45, 26, 50, 23, 38, 27, 60, 21];

// サイト内の HTML（<b>・相対リンク）をブログの Markdown に直す
const md = (html, base) => String(html)
  .replace(/<b>(.*?)<\/b>/g, '**$1**')
  .replace(/<a href="([^"]+)">(.*?)<\/a>/g, (_, href, t) => `[${t}](${/^https?:/.test(href) ? href : `${base}/${href}`})`)
  .replace(/<[^>]+>/g, '');
const srcLine = ([name, url]) => (url ? `[${name}](${url})` : name);

const MORE = [
  ['nenshu/', '年収別の手取り早見表'],
  ['kabe.html', '手取りが減る「年収の壁」'],
  ['guide/ideco.html', 'iDeCoの節税額シミュレーター'],
  ['topics/', '明日話せるお金の豆知識'],
];
const more = (skip) => `\n\n## あわせて読みたい\n\n${MORE.filter(([p]) => p !== skip).slice(0, 3).map(([p, t]) => `- [${t}](${SITE}/${p})`).join('\n')}`;

// ふるさと納税の上限（年末の締め切り前に読まれる）
const FAMILIES = [
  ['独身', {}, '独身・共働き'],
  ['夫婦（配偶者を扶養）', { spouse: true }, '配偶者を扶養'],
  ['夫婦＋子（16歳以上の子1人を扶養）', { spouse: true, dependents: 1 }, '配偶者と高校生以上の子を扶養'],
];
function furusatoArticle(c) {
  const [who, opt, short] = FAMILIES[c % FAMILIES.length];
  const ns = [300, 350, 400, 450, 500, 550, 600, 700, 800, 900, 1000, 1200];
  const r5 = calc(500, opt);
  return {
    title: `【2026年】ふるさと納税の上限はいくら？年収別の早見表（${short}）`,
    body: `ふるさと納税は、上限の範囲内なら**自己負担2,000円**で返礼品がもらえる制度です。2026年の寄付の締め切りは**12月31日**。${who}の会社員について、上限の目安を年収別に計算しました。\n\n## 結論\n\n- 年収500万円（${who}）なら、上限の目安は**約${man(r5.furusato)}万円**\n- 年収が高いほど上限は上がります。家族を扶養していると、その分だけ少し下がります\n\n## 年収別の上限の目安（${who}）\n\n${table(['年収', '上限の目安', '手取り（年）'], ns.map((n) => {
      const r = calc(n, opt);
      return [`${n}万円`, r.furusato ? `約${yen(r.furusato)}円` : '—', `${man(r.takeHome)}万円`];
    }))}\n\n## 申し込みの前に確認したいこと\n\n- **ワンストップ特例**：会社員で寄付先が5自治体以内なら、確定申告をしなくても申請書を出すだけで控除が受けられます（翌年1月10日必着）\n- **住宅ローン控除・医療費控除がある人**は、上限がこの表より下がることがあります\n- 上限を超えた分は自己負担になります。ぎりぎりを狙わず、少し余裕を持って寄付するのが安心です${adLink('furusato')}${footer('', '自分の条件でふるさと納税の上限を計算する')}${more()}`,
  };
}

// 月給別（「月給30万 手取り」）
function gekkyuArticle(c) {
  const m = GEKKYU[c % GEKKYU.length];
  const r = calcTakeHome({ income: m * 120000 });
  const near = [-5, -2, 0, 2, 5].map((d) => m + d).filter((x) => x >= 15);
  return {
    title: `月給${m}万円の手取りは約${man(r.takeHomeMonthly)}万円【2026年】年収・内訳・ボーナスありの場合`,
    body: `月給（額面）${m}万円の会社員の手取りを、2026年の制度で計算しました（ボーナスなし・独身・40歳未満・東京都）。\n\n## 結論：手取りは月約${man(r.takeHomeMonthly)}万円\n\n- 年収にすると${m * 12}万円、手取りは年${man(r.takeHome)}万円\n- 額面の${pct(r.rate)}が手元に残り、約${man(r.income / 12 - r.takeHomeMonthly)}万円が毎月の税金・社会保険料です\n\n## 毎月引かれるもの\n\n${table(['項目', '月額'], [
      ['健康保険料（子ども・子育て支援金含む）', `${yen(r.health / 12)}円`],
      ['厚生年金保険料', `${yen(r.pension / 12)}円`],
      ['雇用保険料', `${yen(r.koyou / 12)}円`],
      ['所得税', `${yen(r.incomeTax / 12)}円`],
      ['住民税', `${yen(r.residentTax / 12)}円`],
      ['**手取り**', `**${yen(r.takeHomeMonthly)}円**`],
    ])}\n\n※税金は年額を12で割った平均です。実際は、住民税は前年の所得で決まり（新卒1年目はかからない）、所得税は年末調整で精算されます。\n\n## 近い月給と比べる\n\n${table(['月給', '手取り（月）', '手取り（年）'], near.map((x) => {
      const q = calcTakeHome({ income: x * 120000 });
      return [`${x}万円`, `${man(q.takeHomeMonthly)}万円`, `${man(q.takeHome)}万円`];
    }))}\n\n## ボーナスがある場合\n\nボーナスが年2か月分（${m * 2}万円）あると年収は${m * 14}万円になり、手取りは年${man(calcTakeHome({ income: m * 140000, bonus: m * 20000 }).takeHome)}万円です。${footer(`?mode=month&monthly=${m}`, 'ボーナス・都道府県を入れて手取りを計算する')}${more()}`,
  };
}

// 豆知識（src/topics.js）をくわしい記事に
function topicArticle(c) {
  const all = topics();
  const t = all[c % all.length];
  const others = all.filter((x) => x.slug !== t.slug && x.tag === t.tag).concat(all.filter((x) => x.tag !== t.tag)).slice(0, 3);
  return {
    title: `${t.title}【2026年・お金の豆知識】`,
    body: `> ${t.doya}\n\n知っていると、ちょっと人に話したくなるお金の話です。\n\n## ポイント\n\n${t.points.map((x) => `- ${md(x, SITE)}`).join('\n')}\n\n## もっとくわしく\n\n- [${t.link[1]}](${SITE}${t.link[0]})\n- [この豆知識のページ](${SITE}/topics/${t.slug}.html)\n\n出典：${srcLine(t.src)}\n\n## ほかの豆知識\n\n${others.map((x) => `- [${x.title}](${SITE}/topics/${x.slug}.html)`).join('\n')}${footer('topics/', '明日話せるお金の豆知識をもっと読む')}`,
  };
}

// トレンド解説（src/guides.js）。iDeCo は年収別の節税額の表つき
function guideArticle(c) {
  const all = guides();
  const g = all[c % all.length];
  const base = `${SITE}/guide`;
  const ideco = g.slug === 'ideco'
    ? `\n\n## 年収別：iDeCoで税金はいくら減る？（会社員・独身・企業年金なし）\n\n${table(['年収', '月2.3万円（今の上限）', '月6.2万円（2027年〜）'], [300, 400, 500, 600, 700, 800, 1000].map((n) => {
      const r = calc(n);
      return [`${n}万円`, `年${yen(idecoSaving(r, 276000))}円`, `年${yen(idecoSaving(r, 744000))}円`];
    }))}\n\n所得税と住民税の合計です。掛金を引いた後の課税所得で計算しているので、年収が低い人は上限まで積み立てても節税額が頭打ちになります。`
    : '';
  return {
    title: g.title,
    body: `${md(g.lead, base)}\n\n${table(['項目', '内容'], g.stats, true)}\n\n## 押さえておきたい4つのポイント\n\n${g.points.map(([icon, h, t]) => `### ${icon} ${h}\n\n${md(t, base)}`).join('\n\n')}${ideco}${adLink(g.cta)}\n\n## 最近の変更・これからの予定\n\n${g.news.map((x) => `- ${md(x, base)}`).join('\n')}\n\n## 注意点\n\n${g.cautions.map((x) => `- ${x}`).join('\n')}\n\n## よくある質問\n\n${g.faq.map(([q, a]) => `**Q. ${q}**\n\n${a}`).join('\n\n')}\n\n出典：${g.src.map(srcLine).join('、')}${footer(`guide/${g.slug}.html`, '図解とシミュレーターで確かめる')}${more(g.slug === 'ideco' ? 'guide/ideco.html' : '')}`,
  };
}

// 扶養内パート・学生の年収の壁（src/walls.js）
function partArticle(c) {
  const keys = Object.keys(PART_WALLS);
  const k = keys[c % keys.length];
  const w = PART_WALLS[k];
  const student = k !== 'spouse';
  const big = w.walls.filter((x) => x.impact === 3);
  const at = (x) => (x.at ? `${x.at}万円` : x.label);
  return {
    title: student
      ? '【2026年】学生バイトの年収の壁まとめ｜150万円・159万円・197万円、親への影響は？'
      : '【2026年】扶養内パートの年収の壁まとめ｜本当に気をつけるのは2つだけ',
    body: `2026年は税制改正と社会保険の見直しで、${w.label}の「年収の壁」が大きく変わりました。給与収入だけの場合の壁を、年収の低い順にまとめます。\n\n## 結論：手取りが大きく減るのは${big.map(at).join('と')}\n\n${big.map((x) => `- **${at(x)}**：${x.title}`).join('\n')}\n\nそれ以外の壁は、超えても影響が小さいか、${student ? '親' : '配偶者'}の税金が少しずつ増えるだけです。\n\n## 年収の壁一覧\n\n${table(['年収', '何が起きる', 'だれに', '手取りへの影響'], w.walls.map((x) => [at(x), x.title, x.who, IMPACT_LABEL[x.impact]]), true)}\n\n## 壁ごとのくわしい説明\n\n${w.walls.map((x) => `### ${at(x)}：${x.title}\n\n${x.what}${x.note ? `\n\n${x.note}` : ''}`).join('\n\n')}\n\n出典：${[...new Map(w.walls.map((x) => [x.src[0], x.src])).values()].map(srcLine).join('、')}${footer('part-kabe.html', '年収スライダーで、越えた壁を確かめる')}${more()}`,
  };
}

// 記事の一覧。種類ごとに1本ずつ順番に出すので、同じ種類が続かない
const GROUPS = [
  ['furusato', FAMILIES.length, furusatoArticle],
  ['nenshu', NENSHU.length, ARTICLES[4]],
  ['topic', topics().length, topicArticle],
  ['gekkyu', GEKKYU.length, gekkyuArticle],
  ['guide', guides().length, guideArticle],
  ['kabe', 2, ARTICLES[1]],
  ['part', Object.keys(PART_WALLS).length, partArticle],
  ['pref', 4, ARTICLES[0]],
  ['raise', 3, ARTICLES[2]],
  ['fuyou', 2, ARTICLES[5]],
  ['bonus', 3, ARTICLES[3]],
];
export const ARTICLE_KEYS = (() => {
  const keys = [];
  const max = Math.max(...GROUPS.map(([, n]) => n));
  for (let c = 0; c < max; c++) for (const [g, n] of GROUPS) if (c < n) keys.push(`${g}-${c}`);
  return keys;
})();

export function articleByKey(key) {
  const [g, c] = key.split('-');
  const a = GROUPS.find(([name]) => name === g)[2](Number(c));
  return { kind: 'article', key, title: a.title, body: disclose(a.body) };
}

// 次に出す記事：まだ出していない（used に含まれない）ものを一覧の順に。全部出したら最初から
export function nextArticle(used = []) {
  const done = new Set(used);
  const key = ARTICLE_KEYS.find((k) => !done.has(k)) ?? ARTICLE_KEYS[used.length % ARTICLE_KEYS.length];
  return articleByKey(key);
}

// 出した記録がないとき（プレビュー）は日付で選ぶ
export function article(date) {
  return articleByKey(ARTICLE_KEYS[dayIndex(date) % ARTICLE_KEYS.length]);
}

// はてなブログのカテゴリ（タイトルから）
export function categoriesFor(title) {
  const cats = ['手取り', 'お金'];
  for (const [re, c] of [[/ふるさと納税/, 'ふるさと納税'], [/iDeCo/, 'iDeCo'], [/NISA/, 'NISA'], [/壁/, '年収の壁'], [/扶養|パート|学生/, '扶養'],
    [/年収\d+万円の手取り/, '年収別'], [/月給/, '月給別'], [/豆知識/, '豆知識'], [/ボーナス|社会保険|年金/, '社会保険']]) if (re.test(title)) cats.push(c);
  return cats;
}
