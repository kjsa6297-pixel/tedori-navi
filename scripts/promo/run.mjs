#!/usr/bin/env node
// 宣伝投稿のコマンド。GitHub Actions から使う。
//   node scripts/promo/run.mjs draft x|article [YYYY-MM-DD]   → 投稿案を Issue 本文の形式で標準出力
//     記事は環境変数 PROMO_USED（出した記事のキーをカンマ区切り）にないものを一覧の順に選ぶ
//   node scripts/promo/run.mjs publish x|article <file>        → Issue 本文から投稿案を取り出して投稿
//   node scripts/promo/run.mjs preview [YYYY-MM-DD]             → 7日分の 𝕏 投稿と今週の記事を表示（確認用）
import { readFileSync } from 'node:fs';
import { xPost, article, nextArticle, categoriesFor, xWeight } from './content.mjs';
import { postToX, postToHatena, postToBluesky, hasX, hasBluesky } from './publish.mjs';
import { issueBody, extract } from './issue.mjs';

function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function make(kind, date) {
  const used = (process.env.PROMO_USED || '').split(',').filter(Boolean);
  const p = kind === 'x' ? xPost(date) : process.env.PROMO_USED !== undefined ? nextArticle(used) : article(date);
  if (kind === 'x' && xWeight(p.body) > 280) throw new Error(`𝕏 の文字数オーバー（${xWeight(p.body)}/280）: ${p.title}`);
  return p;
}

async function publish(kind, text) {
  if (kind === 'x') {
    // SNS：設定されている投稿先すべて（Bluesky は無料、𝕏 は API を設定した場合のみ）
    if (xWeight(text) > 280) throw new Error(`𝕏 の文字数オーバー（${xWeight(text)}/280）`);
    const targets = [hasBluesky() && postToBluesky, hasX() && postToX].filter(Boolean);
    if (!targets.length) throw new Error('SNS の認証情報が未設定です（Bluesky：BLUESKY_HANDLE と BLUESKY_APP_PASSWORD）');
    const urls = [];
    for (const post of targets) urls.push(await post(text));
    return urls.join('\n');
  }
  const [first, ...rest] = text.split('\n');
  const title = first.replace(/^#\s*/, '');
  return postToHatena(title, rest.join('\n').trim(), process.env, categoriesFor(title));
}

const [cmd, kind, arg] = process.argv.slice(2);
if (cmd === 'draft') {
  const p = make(kind, arg || todayJST());
  process.stdout.write(JSON.stringify({ key: p.key, title: p.title, body: issueBody(p), text: p.kind === 'x' ? p.body : `# ${p.title}\n\n${p.body}` }));
} else if (cmd === 'publish') {
  const url = await publish(kind, extract(readFileSync(arg, 'utf8')));
  console.log(url);
} else if (cmd === 'publish-text') {
  const url = await publish(kind, readFileSync(arg, 'utf8').trim());
  console.log(url);
} else if (cmd === 'preview') {
  const base = Date.parse(`${kind || todayJST()}T00:00:00Z`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const p = make('x', d);
    console.log(`── ${d}（${xWeight(p.body)}/280）\n${p.body}\n`);
  }
  const a = make('article', kind || todayJST());
  console.log(`══ 今週の記事：${a.title}\n${a.body.slice(0, 600)}…`);
} else {
  console.error('使い方: run.mjs draft|publish|preview ...');
  process.exit(1);
}
