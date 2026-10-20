# 宣伝の自動化（𝕏・はてなブログ・note）

## しくみ
- **毎日 12:15（日本時間）**：SNS の投稿案を作る（Bluesky は自動投稿、𝕏 はタップ投稿 or API で自動）。ふだんは**リンクなしの日記のような「お金メモ」**（手取りの内訳、昇給、県の差、NISA・iDeCo、季節の手続き、豆知識など。数字は計算エンジンから）。**宣伝（サイトへのリンクつき）は7日に1回**（`PROMO_EVERY`）で、豆知識の紹介と計算ツールの紹介を交互に
- **毎週 月・水・金 7:05**：ブログ記事の案を作る（はてなブログ用。note にも貼れる）。記事は約80本の一覧（ふるさと納税の上限・年収別・月給別・豆知識・新NISA/iDeCo/こどもNISA・扶養内パート/学生の壁・都道府県・昇給・扶養・ボーナス）から、**まだ出していないものを順に**選ぶ。同じ種類は続かない。出したかどうかは Issue（本文の `<!-- article:キー -->`、昔のものはタイトル）で判定
- **記事をまとめて作る**：Actions → 「宣伝の投稿案づくり」→ Run workflow で「記事」と本数（最大10）を選ぶ
- はてなブログのカテゴリはタイトルから自動で付く（ふるさと納税・iDeCo・NISA・年収の壁・年収別 など）
- 文章は計算エンジンの数字から自動で作る（AI不使用・費用ゼロ）。30日以内に同じ文面は出ない
- **確認モード**（`site.config.json` の `promo.auto: false`）：投稿案が GitHub の Issue に届く → 内容がよければ `承認` ラベルを付ける → 自動で投稿され、Issue にリンクが付いて閉じる
- **自動モード**（`promo.auto: true`）：作った投稿案をそのまま投稿（Bluesky・はてなブログ・API設定時の 𝕏）。𝕏 の API がなければ「𝕏用」Issue（タップ投稿）、記事は note 貼り付け用の Issue だけ作る
- note は公式の投稿APIがなく自動投稿は規約上のリスクがあるため、**貼り付けは手作業**
- **𝕏 は無料でも使える**：API を設定しなくても、投稿案の Issue に「📱 𝕏 で投稿する」リンクが付く。タップすると文面入りの投稿画面が開くので「ポスト」を押すだけ。API（有料）を設定した場合だけ完全自動になる

## 初回設定（オーナー）

### 1. 𝕏 API（有料・従量課金。**任意**：使わなければタップ投稿で無料）
1. https://developer.x.com でデベロッパー登録し、App を作る
2. App の「User authentication settings」で権限を **Read and write** にする
3. 「Keys and tokens」で次の4つを発行（権限を変えた後に Access Token を発行し直す）
   - API Key / API Key Secret / Access Token / Access Token Secret
4. クレジットを購入（最低 $5 程度）。**支出上限（spend cap）を低め（例：$10）に設定する**
   - 目安：リンク付き投稿は1件約 $0.20 → 1日1件で月 約 $6

### 2. Bluesky（無料）
1. https://bsky.app でアカウントを作る（例：`tedorinavi.bsky.social`）
2. 設定 → プライバシーとセキュリティ → **アプリパスワード** → 追加（名前は「手取りナビ」など）
3. 表示されたパスワードを控える（ログイン用のパスワードとは別物。こちらだけを登録する）

### 3. はてなブログ（無料）
1. はてなブログを開設し、設定 → 基本設定 → 編集モードを **Markdown** にする
2. 設定 → 詳細設定 → 「AtomPub」欄の **APIキー** を確認

### 4. GitHub に登録
リポジトリの Settings → Secrets and variables → Actions → **New repository secret** で登録：

| 名前 | 中身 |
|---|---|
| `BLUESKY_HANDLE` | Bluesky のハンドル（例：`tedorinavi.bsky.social`） |
| `BLUESKY_APP_PASSWORD` | アプリパスワード |
| `X_API_KEY` | API Key（任意） |
| `X_API_SECRET` | API Key Secret（任意） |
| `X_ACCESS_TOKEN` | Access Token（任意） |
| `X_ACCESS_SECRET` | Access Token Secret（任意） |
| `HATENA_ID` | はてなID |
| `HATENA_BLOG_ID` | ブログのドメイン（例：`xxxx.hatenablog.com`） |
| `HATENA_API_KEY` | AtomPub の APIキー |

登録した値は誰にも（Claude にも）見えません。チャットに貼らないでください。

## 運用
- 試しに今すぐ動かす：Actions → 「宣伝の投稿案づくり」→ Run workflow
- 2週間ほど確認して問題なければ、Claude に「宣伝を自動モードにして」と頼む（`promo.auto` を `true` にする）
- 止めたいとき：Actions → 該当ワークフロー → 「…」→ Disable workflow
- 投稿文を確認する：`npm run promo:preview`（7日分の 𝕏 投稿と今週の記事を表示）

## 方針
- 数字はサイトと同じ計算エンジンから出すので、サイトと食い違わない
- 宣伝だけの投稿にせず、投稿単体で役に立つ数字を必ず入れる
- 𝕏 のリンクは検索順位への直接の効果は小さい（nofollow）。目的は人に知ってもらい、使ってもらうこと
