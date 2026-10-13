# 手取りナビ

会社員の「年収から手取りはいくら？」「年収が上がると手取りはいくら増える？」に、2026年（令和8年）の制度で正確に答える無料ツールサイトです。

- 公開URL（予定）: https://kjsa6297-pixel.github.io/tedori-navi/

## 誰の役に立つか
- 転職・昇給の交渉をする人：額面ではなく**手取りの差**で判断できる
- 2026年の税制改正（基礎控除の引き上げ）で自分の手取りがどうなるか知りたい人
- **手取りの壁**（年収約666万円など、収入が増えると手取りが減るポイント）を避けたい人
- ふるさと納税・iDeCoでいくら得するか知りたい人

## ページ構成（すべて自動生成）

| ページ | 内容 |
|---|---|
| `/` | 手取り計算ツール（入力はブラウザ内で計算、送信しない） |
| `/nenshu/200.html` 〜 `/nenshu/2000.html` | 年収別の手取り（10万円刻み・181ページ）。内訳、年収アップ時の増加額、家族構成別、節税の目安 |
| `/nenshu/` | 年収別の早見表 |
| `/hikaku.html` | 内定・転職オファー比較（2社の手取りの差） |
| `/kabe.html` | 2026年の手取りの壁 |
| `/part-kabe.html` | 扶養内パート・学生アルバイトの年収の壁 一覧（2026年版） |
| `/topics/` | 明日話せるお金の豆知識（年収の壁・社会保険・節税など） |
| `/about.html`, `/operator.html`, `/privacy.html` | 計算方法と前提・出典、運営者情報、プライバシーポリシー |

ページを作るのはAIではなく `scripts/build.mjs` というプログラムです。数秒で全ページを生成し、費用もかかりません。

## 自動運用の仕組み

```
main に push / 毎月1日 / 手動実行
  → テスト（npm test：手計算した値と一致するか、全年収で破綻しないか）
  → 全ページ生成（npm run build）
  → GitHub Pages に公開

1月・3月・4月（制度が変わる時期）
  → 「制度改正の確認」Issue を自動作成
  → src/tax.js の料率を更新して push すれば、全ページが新しい制度に
```

テストが失敗すると公開されないので、計算を間違えたページが出ることを防げます。

## 初回だけやること

1. Settings → Pages → Source を **GitHub Actions** にする
2. 収益化（任意）: `site.config.json` に記入
   - `affiliates.furusato` / `ideco` / `career`: A8.net・もしもアフィリエイト等の広告リンク（空なら非表示）
   - `adsenseClient`: Google AdSense の `ca-pub-...`（独自ドメイン推奨。`ads.txt` がドメイン直下に必要なため）
3. [Google Search Console](https://search.google.com/search-console) に登録して `sitemap.xml` を送信

## 開発

```bash
npm test        # 計算のテスト
npm run build   # dist/ にサイトを生成
npx serve dist  # ローカル確認（任意）
```

画面部品は `src/view.js`、「次に知りたいこと」の並び順は `site.config.json` の `nextOrder` で変えられます。GA4 の測定ID（`gaMeasurementId`）を設定すると、どのカードが押されたか（`next_click`）を計測できます。

計算の前提（賞与なし、協会けんぽ東京、など）は `src/tax.js` 冒頭と `/about.html` に記載しています。
