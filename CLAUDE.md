# 手取りナビ — Claude 向けメモ

会社員の手取りを2026年（令和8年）の制度で計算する無料ツールサイト。GitHub Pages で公開し、広告・アフィリエイトで収益化を目指す。

**作業を始める前に `docs/PLAN.md` を読み、終わったら「進捗ログ」を更新すること。** 会話をまたいだ記憶はこのファイルで引き継ぐ。

## 方針
- 収益は他者貢献の結果。読者が得をする情報・リンクだけを載せる。報酬目的で読者のためにならない広告は載せない
- 計算の正確さが最優先。制度値を変えたら `test/tax.test.mjs` に手計算の期待値を追加・更新する
- 画面は「ひと目でわかる」が基準。数字は大きく、文章は短く、次に知りたいことへの導線を必ず置く

## 構成
- `src/tax.js` 計算ロジック（ブラウザとNode共通）。制度値は `RULES` と各表
- `src/view.js` 画面部品（HTML文字列）。ビルドと計算ツールの両方で使う
- `scripts/build.mjs` 全ページを `dist/` に生成
- `scripts/promo/` 宣伝の自動化（投稿文の生成・𝕏/はてなブログへの投稿）。説明は `docs/PROMO.md`
- `site.config.json` サイトURL、AdSense・GA4・アフィリエイトリンク、「次に知りたいこと」の並び順（`nextOrder`）

## コマンド
- `npm test` 計算テスト
- `npm run build` ビルド（`SITE_URL=http://localhost:8765 npm run build` でローカル確認用）
- `cd dist && python3 -m http.server 8765` でプレビュー

## 注意
- `static/google877b994e362b25c4.html` は Search Console の所有権確認ファイル。削除すると確認が外れる

## 公開
main への push で GitHub Actions がテスト→ビルド→Pages 公開。テストが落ちると公開されない。
