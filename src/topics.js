// 「明日話せるお金の豆知識」。数字はすべて計算エンジンから出す（手で書かない）。
// 制度そのものの説明は、出典で確認できたものだけを書く。新しい話題を足すときも同じルールで。
import { calcTakeHome, healthStandard, pensionStandard, PREF_HEALTH, RULES, yen, man } from './tax.js';

const calc = (n, opt = {}) => calcTakeHome({ income: n * 10000, ...opt });
const pct = (x) => `${Math.round(x * 100)}%`;
const SRC = {
  nta: ['国税庁（令和8年分の基礎控除・給与所得控除）', 'https://www.nta.go.jp/users/gensen/nencho/index/kyuyosyotokusya.htm'],
  kenpo: ['協会けんぽ「令和8年度の保険料率」', 'https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/index.html'],
  nenkin: ['日本年金機構「厚生年金保険料額表」', 'https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html'],
  koyou: ['厚生労働省「雇用保険料率について」', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html'],
  minkan: ['国税庁「令和7年分 民間給与実態統計調査」', 'https://www.nta.go.jp/publication/statistics/kokuzeicho/minkan/gaiyou/2025.htm'],
  teiji: ['日本年金機構（定時決定・算定基礎届）', 'https://www.nenkin.go.jp/'],
  calc: ['手取りナビの計算（2026年の制度）', null],
};

function firstIncome(pred, opt = {}) {
  for (let i = 1000000; i <= 30000000; i += 1000) if (pred(calcTakeHome({ income: i, ...opt }))) return i;
  return null;
}

export function topics() {
  const wall666 = firstIncome((r) => r.totalIncome > 4890000);
  const w666 = calcTakeHome({ income: wall666 - 1000 }).takeHome - calcTakeHome({ income: wall666 }).takeHome;
  const wallSp = firstIncome((r) => r.totalIncome > 9000000, { spouse: true });
  const wSp = calcTakeHome({ income: wallSp - 1000, spouse: true }).takeHome - calcTakeHome({ income: wallSp, spouse: true }).takeHome;
  const up = calc(550).takeHome - calc(500).takeHome;
  const rates = Object.entries(PREF_HEALTH).sort((a, b) => a[1] - b[1]);
  const [lowP] = rates[0];
  const [highP] = rates[rates.length - 1];
  const prefDiff = calc(500, { pref: lowP }).takeHome - calc(500, { pref: highP }).takeHome;
  const kodomo = Math.round(healthStandard(5000000 / 12) * RULES.kodomoRate / 2) * 12;
  const kaigo = calc(500).takeHome - calc(500, { over40: true }).takeHome;
  const half = (std, rate) => Math.round(std * rate / 2);
  const ot = (half(healthStandard(350000), RULES.healthRate + RULES.kodomoRate) + half(pensionStandard(350000), RULES.pensionRate))
    - (half(healthStandard(300000), RULES.healthRate + RULES.kodomoRate) + half(pensionStandard(300000), RULES.pensionRate));
  const bonusDiff = calc(500).takeHome - calc(500, { bonus: 1250000 }).takeHome;
  const r500 = calc(500);
  const ideco = Math.round(240000 * (r500.marginalIT * 1.021 + 0.1));
  const cap = Math.round(650000 * RULES.pensionRate / 2);
  const sp = calc(500, { spouse: true }).takeHome - calc(500).takeHome;

  return [
    {
      slug: 'wall-178', tag: '年収の壁', title: '「103万円の壁」はもう古い？2026年は178万円',
      doya: '2026年は、給与だけなら年収178万円までは所得税がかからないんだよ。',
      points: [
        '2026年（令和8年分）は、所得税の基礎控除が最大104万円、給与所得控除の最低額が74万円に引き上げられました。',
        `足すと74万＋104万＝${man(740000 + 1040000, 0)}万円。給与収入がこれ以下なら所得税はゼロです（社会保険料などの控除がない場合）。`,
        'ただし住民税や、配偶者の扶養から外れる「130万円の壁」（社会保険）は別のルールなので注意。',
      ],
      link: ['/part-kabe.html', '扶養内パートの年収の壁を見る'], src: SRC.nta,
    },
    {
      slug: 'part-walls', tag: '年収の壁', title: '扶養内パート、本当に怖い壁は2つだけ',
      doya: '2026年の扶養内パートで本当に手取りが減る壁は、「週20時間」と「130万円」の社会保険の2つだけなんだよ。',
      points: [
        '2026年10月から月収8.8万円（旧106万円）の条件がなくなり、従業員51人以上の会社で週20時間以上働くと、年収に関係なく勤務先の社会保険に入ります。',
        '見込み年収130万円以上で配偶者の扶養から外れ、自分で健康保険・年金に入ります（19〜22歳の子は150万円）。',
        '税金の壁（住民税119万円・所得税178万円など）は超えた分にだけかかるので、手取りは逆転しません。配偶者の控除も169万円まで満額です。',
      ],
      link: ['/part-kabe.html', '年収の壁を一覧で見る'], src: ['厚生労働省（社会保険の適用拡大）', 'https://www.mhlw.go.jp/tekiyoukakudai/'],
    },
    {
      slug: 'wall-666', tag: '手取りの壁', title: '年収が増えたのに手取りが減る？「666万円の壁」',
      doya: `年収約${man(wall666, 0)}万円を超えると、手取りが逆に約${man(w666)}万円減るんだって。`,
      points: [
        '基礎控除の上乗せ（最大104万円）は、合計所得489万円以下の人だけが対象です。',
        `会社員だと年収約${man(wall666)}万円がその境目。1円でも超えると基礎控除が67万円に下がり、手取りが約${yen(w666)}円減ります（独身の場合）。`,
        '2026年・2027年の特例なので、今だけの壁です。',
      ],
      link: ['/kabe.html#basic67', '壁の前後の手取りを見る'], src: SRC.calc,
    },
    {
      slug: 'raise-50', tag: '昇給', title: '昇給50万円、手取りは50万円増える？',
      doya: `年収500万の人が50万円昇給しても、手取りは${man(up)}万円しか増えないよ。`,
      points: [
        `年収500万円→550万円のとき、増える手取りは約${man(up)}万円（増えた分の${pct(up / 500000)}）。`,
        '残りは所得税・住民税・社会保険料に回ります。年収が高いほど残る割合は小さくなります。',
        '転職のオファーは「額面の差」ではなく「手取りの差」で比べるのがおすすめ。',
      ],
      link: ['/hikaku.html', '2社の手取りを比べる'], src: SRC.calc,
    },
    {
      slug: 'pref', tag: '地域', title: '同じ給料でも、住む県で手取りが違う',
      doya: `同じ年収500万でも、${lowP}と${highP}で手取りが年${yen(prefDiff)}円違うんだよ。`,
      points: [
        '会社員の健康保険（協会けんぽ）の料率は、都道府県ごとに毎年決まります。',
        `2026年度は${lowP}が${(rates[0][1] * 100).toFixed(2)}%で最も低く、${highP}が${(rates[rates.length - 1][1] * 100).toFixed(2)}%で最も高い。`,
        `年収500万円だと、手取りの差は年${yen(prefDiff)}円になります。`,
      ],
      link: ['/', '自分の県で計算する'], src: SRC.kenpo,
    },
    {
      slug: 'overtime-april', tag: '社会保険', title: '4〜6月の残業で、1年間の社会保険料が決まる',
      doya: '4月〜6月に残業しすぎると、その後1年間の社会保険料が高くなるんだよ。',
      points: [
        '社会保険料のもとになる「標準報酬月額」は、原則4・5・6月の給料の平均で決まり、9月から1年間使われます（定時決定）。',
        `月給30万円の人が4〜6月だけ残業で月35万円になると、保険料は月${yen(ot)}円、1年で約${yen(ot * 12)}円増えます。`,
        'その分、将来の厚生年金が少し増えるという面もあります。',
      ],
      link: ['/', '月給から手取りを計算する'], src: SRC.teiji,
    },
    {
      slug: 'kodomo', tag: '2026年の変更', title: '2026年4月から、給料から「子ども・子育て支援金」',
      doya: `今年の4月から、健康保険料に「子ども・子育て支援金」が上乗せされてるの、知ってた？`,
      points: [
        `子ども・子育て支援金の料率は${(RULES.kodomoRate * 100).toFixed(2)}%（会社と半分ずつ）。2026年4月分から健康保険料と一緒に引かれています。`,
        `年収500万円（賞与なし）の人で、本人負担は年約${yen(kodomo)}円です。`,
        '給与明細の健康保険料が少し上がっていたら、これが理由かもしれません。',
      ],
      link: ['/about.html', '計算に使っている料率を見る'], src: SRC.kenpo,
    },
    {
      slug: 'age40', tag: '社会保険', title: '40歳の誕生月から、手取りが減る理由',
      doya: `40歳になると介護保険料が始まって、年収500万だと手取りが年${man(kaigo)}万円くらい減るよ。`,
      points: [
        `40〜64歳は健康保険料に介護保険料（2026年度は${(RULES.kaigoRate * 100).toFixed(2)}%、会社と半分ずつ）が加わります。`,
        `年収500万円なら、手取りは年約${yen(kaigo)}円減ります（税金が少し減る分を差し引いた額）。`,
        '「40歳の誕生日の前日」が属する月の分から徴収が始まります。',
      ],
      link: ['/nenshu/500.html#family', '年齢・家族別の手取りを見る'], src: SRC.kenpo,
    },
    {
      slug: 'bonus', tag: '社会保険', title: '同じ年収でも、ボーナスがあると手取りが変わる',
      doya: '同じ年収でも、ボーナスがあるかないかで手取りがちょっと変わるんだよ。',
      points: [
        '月給の保険料は「標準報酬月額」という等級で決まり、ボーナスの保険料は実際の額にかかります。',
        `年収500万円で、ボーナスなしと「年4か月分のボーナスあり」を比べると、手取りの差は年${yen(Math.abs(bonusDiff))}円（${bonusDiff >= 0 ? 'ボーナスなしの方が多い' : 'ボーナスありの方が多い'}）。`,
        '差は小さいので、比べるなら「年収の総額」と「手取り」を見れば十分です。',
      ],
      link: ['/', 'ボーナス込みで計算する'], src: SRC.calc,
    },
    {
      slug: 'furusato-deadline', tag: '節税', title: 'ふるさと納税は「12月31日」が締め切り',
      doya: `ふるさと納税は1月〜12月の分。年収500万の独身なら上限の目安は約${man(r500.furusato)}万円だよ。`,
      points: [
        'ふるさと納税は、1月1日〜12月31日に寄付した分がその年の控除の対象です。年末は駆け込みで混み合います。',
        `自己負担2,000円で済む上限の目安は、年収500万円・独身で約${man(r500.furusato)}万円（他の控除があると下がります）。`,
        '会社員で寄付先が5自治体以内なら「ワンストップ特例」で確定申告が不要です。',
      ],
      link: ['/nenshu/500.html#save', '自分の上限の目安を見る'], src: SRC.calc,
    },
    {
      slug: 'ideco', tag: '節税', title: 'iDeCoは「積立しながら税金が減る」',
      doya: `iDeCoで月2万円積み立てると、年収500万なら税金が年${man(ideco)}万円くらい軽くなるよ。`,
      points: [
        'iDeCoの掛金は全額が所得から差し引かれるので、所得税と住民税が軽くなります。',
        `年収500万円（独身）で月2万円（年24万円）なら、軽くなる税金は年約${yen(ideco)}円。`,
        'ただし原則60歳まで引き出せないので、生活費とは分けて考えましょう。',
      ],
      link: ['/nenshu/500.html#save', '年収別の節税額を見る'], src: SRC.calc,
    },
    {
      slug: 'pension-cap', tag: '社会保険', title: '厚生年金保険料には「上限」がある',
      doya: `厚生年金の保険料は月${yen(cap)}円が上限。月給が63.5万円を超えるとそれ以上増えないんだよ。`,
      points: [
        '厚生年金の標準報酬月額は65万円が最高等級です。',
        `月給（年収÷12）が63.5万円以上の人は、保険料が月${yen(cap)}円（本人負担）で頭打ちになります。`,
        'そのぶん将来の年金額にも上限があります。',
      ],
      link: ['/nenshu/800.html', '高年収の手取りを見る'], src: SRC.nenkin,
    },
    {
      slug: 'spouse', tag: '家族', title: '配偶者を扶養すると、手取りはいくら増える？',
      doya: `収入のない配偶者を扶養すると、年収500万なら手取りが年${man(sp)}万円くらい増えるよ。`,
      points: [
        '配偶者控除で、所得税は38万円、住民税は33万円が所得から差し引かれます（配偶者に収入がない場合）。',
        `年収500万円なら、手取りは年約${yen(sp)}円増えます。`,
        `ただし本人の年収が約${man(wallSp, 0)}万円を超えると控除が段階的に減り、手取りが約${man(wSp)}万円減る壁があります。`,
      ],
      link: ['/nenshu/500.html#family', '家族構成別の手取りを見る'], src: SRC.calc,
    },
    {
      slug: 'average', tag: '統計', title: '会社員の平均年収は487万円',
      doya: '会社員の平均年収は487万円。でも一番人数が多いのは300万円台なんだよ。',
      points: [
        '国税庁の調査（令和7年分）では、1年を通じて勤務した給与所得者の平均給与は487万円で、5年連続で増えています。',
        '男性は597万円、女性は342万円、正社員は559万円。',
        '一部の高い人が平均を引き上げるので、「人数が一番多い層」は年収300万円超400万円以下です。',
      ],
      link: ['/nenshu/', '年収別の手取り早見表'], src: SRC.minkan,
    },
    {
      slug: 'koyou', tag: '2026年の変更', title: '2026年度、雇用保険料が下がった',
      doya: '今年の4月から雇用保険料がちょっと下がってるんだよ。',
      points: [
        `2026年度（令和8年4月〜）の雇用保険料率は、一般の事業で働く人の負担が${(RULES.koyouRate * 1000).toFixed(1)}/1000（前年度は5.5/1000）。`,
        `年収500万円なら本人負担は年${yen(5000000 * RULES.koyouRate)}円で、前年度より年${yen(5000000 * 0.0005)}円安くなりました。`,
        '小さな変化ですが、給与明細の雇用保険料をチェックしてみてください。',
      ],
      link: ['/about.html', '計算の前提と出典'], src: SRC.koyou,
    },
    {
      slug: 'deduction-850', tag: '税金', title: '年収850万円で「給与所得控除」は打ち止め',
      doya: '会社員の経費みたいな「給与所得控除」は、年収850万円で上限195万円に達するんだよ。',
      points: [
        '会社員は、給与収入から「給与所得控除」を差し引いた残りに税金がかかります。',
        '控除は収入に応じて増えますが、年収850万円で195万円に達し、それ以上は増えません。',
        `そのため、年収850万円を超えると増えた分がまるごと課税対象になり、手取りの増え方が鈍くなります。`,
      ],
      link: ['/nenshu/850.html', '年収850万円の手取りを見る'], src: SRC.nta,
    },
  ];
}

// 日付から「今日の豆知識」を選ぶ（JST の日付で毎日入れ替わる）
export function topicIndexFor(date, count) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % count;
}
