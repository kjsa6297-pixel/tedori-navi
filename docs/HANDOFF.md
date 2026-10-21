# 引き継ぎ書（手取りナビ）

最終更新：2026-10-21。**新しいセッションは、まずこのファイル → `docs/PLAN.md`（進捗ログ）→ `CLAUDE.md` の順に読む。**

## 1. これは何か
- 会社員の手取りを2026年（令和8年）の制度で計算する無料サイト。目的は「読者の得になる情報を届け、その結果として広告・アフィリエイトで収益化」（オーナーの考え：お金を稼ぐのは他者貢献）
- 公開URL：https://kjsa6297-pixel.github.io/tedori-navi/
- リポジトリ：`kjsa6297-pixel/tedori-navi`（public）。**main に直接 push してよい**（オーナー了承済み）。push → GitHub Actions がテスト→ビルド→Pages 公開。テストが落ちると公開されない
- 費用ゼロで運用中（GitHub Pages・Actions、SNSは無料の方法）
- 別件：`kjsa6297-pixel/team-KJ` の `claude/automated-revenue-system-5rirpn` ブランチに最初に作った占いサイトがある（現在は手を付けていない）

## 2. 役割分担
- **オーナー**：アカウント登録・お金・最終判断。Search Console / GA4 / ASP / AdSense の操作、数字の共有、投稿の承認
- **Claude**：開発・修正・制度改正対応・データ分析と提案。日本語で、専門用語を避けて説明する（オーナーは非エンジニア。手順は画面のどこを押すかまで具体的に）

## 3. サイトの中身（全211ページ、`scripts/build.mjs` が生成）
| ページ | 内容 |
|---|---|
| `/` | 手取り計算（年収/月給、ボーナス、47都道府県、扶養）。結果の下に「次に知りたいこと」3テーマパネル、話題の制度カード、今日の豆知識 |
| `/nenshu/200〜2000.html`（181） | 年収別。コイン先生の会話（iDeCo節税額）、暮らしの目安、昇給、平均比較、家族・地域の違い |
| `/kabe.html` | 手取りの壁。冒頭に「結論：損する年収の区間」、自分チェック、壁ごとの折れ線 |
| `/part-kabe.html` | 扶養内パート・学生の壁一覧 |
| `/hikaku.html` | 内定2社の手取り比較 |
| `/guide/`（新NISA・iDeCo・こどもNISA） | 図解・キャラ会話・シミュレーター・FAQ |
| `/topics/` | 明日話せるお金の豆知識16本（今日の1本＋バックナンバー） |
| about / operator / privacy / 404 / sitemap / robots | |

主なファイル：`src/tax.js`（計算エンジン。`calcTakeHome`, `idecoSaving`）、`src/view.js`（画面部品）、`src/topics.js`、`src/walls.js`、`src/guides.js`、`src/chars.js`（キャラSVG・`talk()`）、`site.config.json`

## 4. 必ず守ること
1. **計算の正確さが最優先**。数字は計算エンジンから出し、手で書かない。制度値を変えたら `test/*.test.mjs` に手計算の期待値を足す（現在26件）
2. 制度の説明は**出典で確認できたことだけ**。不確かなら書かない
3. 画面は「ひと目でわかる」：結論を先に、数字は大きく、次に知りたいことへの導線を必ず置く（オーナーは「のっぺり」「わかりづらい」を何度も指摘している）
4. **秘密情報（APIキー・アプリパスワード・はてなの投稿用メールアドレス）をファイル・コミット・チャットに書かない**。GitHub Secrets にオーナーが直接入れる
5. `static/google877b994e362b25c4.html`（Search Console の所有権確認）は**削除しない**
6. コミットにモデル名を書かない
7. 作業後は `docs/PLAN.md` の進捗ログを更新する

## 5. 外部サービスの状態
| サービス | 状態 |
|---|---|
| Google Search Console | 所有権確認済み（HTMLファイル）、sitemap 送信済み（新しいサイトなので「取得できませんでした」表示は様子見でOK） |
| GA4 | `G-CXW4RBT75B` 設置済み。「次に知りたいこと」のクリックは `next_click` イベント |
| はてなブログ | https://kou-kj.hatenablog.com 自動投稿を確認済み（毎週月曜7:05に記事案） |
| Bluesky | https://bsky.app/profile/kj6060.bsky.social 自動投稿を確認済み |
| 𝕏 | 無料の「タップで投稿」リンク方式（API未使用） |
| ASP / AdSense | 未登録。`site.config.json` の `affiliates.*.url` と `adsenseClient` は空 |
| ドメイン | github.io のまま。**AdSense 申請時に独自ドメインを取得する**（ads.txt をドメイン直下に置く必要があるため）。候補 tedori-navi.com（Cloudflare、年10ドル前後） |

## 6. 宣伝の自動化（詳細は `docs/PROMO.md`）
- 毎日12:15に SNS 投稿案 → GitHub Issue に作成 → オーナーが「承認」ラベル → 投稿（`promo.auto` が false の間）
- **投稿方針（2026-10-15 オーナー決定）**：ふだんはリンクなしの日記風「📝お金メモ」、サイトへのリンク付き宣伝は**7日に1回**（`PROMO_EVERY`）
- 確認期間は 2026-10-12〜約2週間。**オーナーの合図で `promo.auto` を true にする**（未実施）

## 7. 未解決・確認待ち
- [ ] **過去の投稿の確認（オーナー）**：以前の投稿テンプレに「iDeCoで壁を避けられる」という誤り（実際は避けられない：壁は合計所得で決まり、iDeCo掛金は合計所得を減らさない）があった。「昇給の時期やiDeCoで避けられることも」「iDeCoなどで所得を下げる」を含む投稿が 𝕏・Bluesky・はてなに出ていれば削除・修正。テンプレは修正済み
- [ ] `promo.auto` を true にするか（オーナーの合図待ち。10/26ごろが目安）
- [ ] Search Console・GA4 の数字の共有（オーナー）→ 次に作るページと `nextOrder` の並び替え
- [ ] ASP 登録（A8.net・もしもアフィリエイト）→ 読者の得になる広告だけを `affiliates` に設定
- [ ] 「上位○%」表示：国税庁「民間給与実態統計調査」の給与階級別分布の表が必要（作業環境から公式サイトに接続できないため、オーナーがPDFの表を共有したら実装）
- [ ] こどもNISAの細則：金融庁の発表が出たら `src/guides.js` を更新
- [ ] 大手計算サイトとの結果の突き合わせ（オーナー、任意）
- 新ページの候補：副業の手取り / ボーナスの手取り / 住宅ローン / NISA積立

## 8. 作業環境のメモ（Claude 向け）
- 作業環境のネットワークは公的サイト（nta.go.jp など）や github.io に接続できない。調べものは WebSearch で複数の情報源を突き合わせる
- 確認：`npm test` → `SITE_URL=http://localhost:8765 npm run build` → `cd dist && python3 -m http.server 8765` → Playwright（`/opt/node-tools/node_modules/playwright/index.mjs`）でスマホ幅390px・ライト/ダークのスクリーンショット
- 公開の確認は GitHub MCP の `actions_list`（workflow `deploy.yml`）
