// SNS投稿文とブログ記事を、計算エンジンの数字から作る（AIは使わない・費用ゼロ）。
// 同じ日付なら同じ内容になる。
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTakeHome, deductionValue, PREF_HEALTH, RULES, yen, man } from '../../src/tax.js';
import { AVERAGES } from '../../src/view.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
export const SITE = config.siteUrl.replace(/\/$/, '');

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
    const tail = ['昇給の時期やiDeCoで避けられることも。前後の手取りを計算しました👇', '壁の前後の手取りと、元に戻る年収はこちら👇'][Math.floor(i / WALL_FACTS.length) % 2];
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
    return `年収${n}万円の人が使える節税の目安（2026年・独身）\n\n🎁ふるさと納税の上限：約${man(r.furusato)}万円\n🐷iDeCo月2万円で税金が年${man(240000 * deductionValue(r))}万円軽く\n\n自分の年収で計算👇\n${SITE}/?income=${n}\n#ふるさと納税 #iDeCo`;
  },
  (i) => {
    const n = [450, 550, 650, 380, 520, 750, 420, 600, 900][i % 9];
    const avg = AVERAGES.rows[0][1];
    const r = calc(n);
    return `会社員の平均年収は${avg}万円（${AVERAGES.source.replace(/「|」/g, '')}）。\n\n年収${n}万円なら平均より${n >= avg ? `${n - avg}万円上` : `${avg - n}万円下`}で、手取りは月${man(r.takeHomeMonthly)}万円。\n\nあなたの年収と手取りを比べる👇\n${SITE}/nenshu/${n}.html\n#年収 #手取り`;
  },
];

export function xPost(date) {
  const d = dayIndex(date);
  const text = X_TEMPLATES[d % X_TEMPLATES.length](Math.floor(d / X_TEMPLATES.length));
  return { kind: 'x', title: text.split('\n')[0], body: text };
}

// ─── ブログ記事（はてなブログ・note 共通の Markdown） ───────────
const table = (head, rows) => `| ${head.join(' | ')} |\n|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
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
      body: `2026年（令和8年）の税制改正で、所得税の基礎控除が最大104万円に引き上げられました。ただしこの上乗せには所得の条件があり、**年収約${man(w.at, 0)}万円を超えると基礎控除が104万円→67万円に下がります**。\n\nその結果、壁を越えた直後は**年収が増えたのに手取りが約${man(w.drop)}万円減る**区間ができています（会社員・独身・賞与なしの場合）。\n\n## 壁の前後の手取り\n\n${table(['年収', '手取り（年）'], rows)}\n\n## 損をしないためにできること\n\n- **昇給・残業の時期を調整する**：年収がちょうど壁の少し上になりそうなら、手取りが壁の手前に戻る水準まで上がるかを確認\n- **iDeCoなどで所得を下げる**：iDeCoの掛金は全額が所得から差し引かれるので、壁の内側にとどまれる場合があります\n- **配偶者を扶養している人**は、年収約1,095万〜1,195万円にも配偶者控除が減る壁があります\n\n2026年・2027年の特例なので、2028年以降はまた制度が変わる可能性があります。${footer('kabe.html', 'すべての壁と、手取りが元に戻る年収を見る')}`,
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
    const n = [500, 400, 600, 700, 300, 800, 1000][cycle % 7];
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
      ])}\n\n額面の${pct(r.rate)}が手元に残ります。\n\n## 暮らしの目安\n\n- 家賃（手取りの25〜30%）：月${man(r.takeHomeMonthly * 0.25, 1)}〜${man(r.takeHomeMonthly * 0.3, 1)}万円\n- 貯金（手取りの10〜20%）：月${man(r.takeHomeMonthly * 0.1, 1)}〜${man(r.takeHomeMonthly * 0.2, 1)}万円\n\n## 結婚・年齢で変わる\n\n- 配偶者（収入なし）を扶養：年${man(married.takeHome)}万円（${married.takeHome >= r.takeHome ? '+' : '−'}${man(Math.abs(married.takeHome - r.takeHome))}万円）\n- 40歳以上（介護保険料あり）：年${man(over40.takeHome)}万円（−${man(r.takeHome - over40.takeHome)}万円）\n\n## 税金を減らす方法\n\n- ふるさと納税の上限の目安：約${man(r.furusato)}万円\n- iDeCoで月2万円積み立てると、税金が年約${man(240000 * deductionValue(r))}万円軽くなります\n\n## 平均と比べると\n\n${AVERAGES.source}によると、1年を通じて勤務した給与所得者の平均年収は${AVERAGES.rows[0][1]}万円です。年収${n}万円は平均より${n >= AVERAGES.rows[0][1] ? `${n - AVERAGES.rows[0][1]}万円高い` : `${AVERAGES.rows[0][1] - n}万円低い`}水準です。${footer(`nenshu/${n}.html`, `年収${n}万円のグラフ・昇給シミュレーションを見る`)}`,
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

export function article(date) {
  const w = Math.floor(dayIndex(date) / 7);
  const a = ARTICLES[w % ARTICLES.length](Math.floor(w / ARTICLES.length));
  return { kind: 'article', title: a.title, body: a.body };
}
