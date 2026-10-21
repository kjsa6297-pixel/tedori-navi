#!/usr/bin/env node
// GitHub Actions 用。Issue の本文などを シェルに通さず Node から gh を呼ぶ。
//   node scripts/promo/action.mjs draft x|article [本数] … 投稿案を作り、確認モードなら Issue、自動モードなら即投稿
//     記事は、これまでの Issue（記事・note用）を記録として、まだ出していないものを選ぶ
//   node scripts/promo/action.mjs publish           … 「承認」ラベルが付いた Issue の内容を投稿
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { hasX, hasBluesky } from './publish.mjs';
import { ARTICLE_KEYS, articleByKey } from './content.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN = join(ROOT, 'scripts/promo/run.mjs');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const auto = Boolean(config.promo?.auto);

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const node = (args, env = {}) => execFileSync('node', [RUN, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }).trim();

// 出した記事のキー。Issue 本文の印（<!-- article:キー -->）と、印がない昔の Issue はタイトルで照合する
function usedArticles() {
  const issues = ['promo:article', 'promo:note'].flatMap((label) => JSON.parse(gh('issue', 'list', '--label', label, '--state', 'all', '--limit', '1000', '--json', 'title,body')));
  const used = new Set(issues.flatMap((i) => [...(i.body || '').matchAll(/<!-- article:([\w-]+) -->/g)].map((m) => m[1])));
  const titles = new Set(issues.map((i) => i.title.replace(/^(記事|note用)：/, '')));
  for (const k of ARTICLE_KEYS) if (!used.has(k) && titles.has(articleByKey(k).title.slice(0, 60))) used.add(k);
  return [...used];
}

function ensureLabels() {
  for (const [name, color, desc] of [
    ['承認', '2da44e', 'このラベルを付けると投稿されます'],
    ['promo:x', '1d9bf0', 'SNS（Bluesky・𝕏）の投稿案'],
    ['promo:x-tap', '0f1419', '𝕏 にタップで投稿するもの（投稿したら閉じる）'],
    ['promo:article', 'f5a623', 'ブログ記事の案（はてなブログ）'],
    ['promo:note', '41c9b4', 'note に貼る記事'],
  ]) gh('label', 'create', name, '--color', color, '--description', desc, '--force');
}

function createIssue(title, body, label) {
  const file = join(ROOT, '.promo-body.md');
  writeFileSync(file, body);
  return gh('issue', 'create', '--title', title, '--body-file', file, '--label', label);
}

const [cmd, kind, countArg] = process.argv.slice(2);

if (cmd === 'draft') {
  ensureLabels();
  const used = kind === 'article' ? usedArticles() : [];
  // 記事はまとめて何本か作れる（手動実行の「本数」）。SNS は1日1本
  const count = kind === 'article' ? Math.min(10, Math.max(1, Number(countArg) || 1)) : 1;
  for (let n = 0; n < count; n++) {
    const d = JSON.parse(node(['draft', kind], kind === 'article' ? { PROMO_USED: used.join(',') } : {}));
    const label = kind === 'x' ? 'promo:x' : 'promo:article';
    // ブログ記事は自動モードでも必ず人が確認してから（もしもの規約：AI で作った記事は校正・事実確認が必要）
    if (!auto || kind === 'article') {
      console.log(createIssue(`${kind === 'x' ? 'SNS' : '記事'}：${d.title.slice(0, 60)}`, d.body, label));
    } else if (kind === 'x') {
      // Bluesky（と、API を設定していれば 𝕏）は自動投稿。𝕏 の API がなければタップ投稿用の Issue を作る
      const file = join(ROOT, '.promo-text.md');
      writeFileSync(file, d.text);
      let done = '';
      if (hasBluesky() || hasX()) {
        done = node(['publish-text', 'x', file]);
        console.log(`投稿しました:\n${done}`);
      }
      if (!hasX()) {
        const body = `${done ? `自動で投稿しました：\n${done}\n\n` : ''}${d.body.split('\n\n<sub>')[0]}\n\n${d.body.slice(d.body.indexOf('<!-- promo:start -->'))}`;
        console.log(createIssue(`𝕏用：${d.title.slice(0, 60)}`, body, 'promo:x-tap'));
      }
    } else {
      const file = join(ROOT, '.promo-text.md');
      writeFileSync(file, d.text);
      const url = node(['publish-text', kind, file]);
      console.log(`投稿しました: ${url}`);
      if (kind === 'article') {
        // note は自動投稿できないので、貼り付け用の Issue を作る
        const body = `はてなブログに公開しました：${url}\n\nnote にも載せる場合は、下の枠内（1行目のタイトルを除く）をコピーして貼り付け、終わったらこの Issue を閉じてください。\n\n${d.body.slice(d.body.indexOf('<!-- promo:start -->'))}`;
        console.log(createIssue(`note用：${d.title.slice(0, 60)}`, body, 'promo:note'));
      }
    }
    if (d.key) used.push(d.key);
  }
} else if (cmd === 'publish') {
  const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const issue = ev.issue;
  const labels = issue.labels.map((l) => l.name);
  const k = labels.includes('promo:x') ? 'x' : labels.includes('promo:article') ? 'article' : null;
  if (!k) process.exit(0);
  // 自動で作った Issue だけを投稿対象にする
  if (!['github-actions[bot]', 'github-actions'].includes(issue.user.login)) throw new Error('自動作成された Issue ではないため投稿しません');
  const file = join(ROOT, '.promo-issue.md');
  writeFileSync(file, issue.body || '');
  try {
    const url = node(['publish', k, file]);
    gh('issue', 'comment', String(issue.number), '--body', `✅ 投稿しました：${url}`);
    gh('issue', 'close', String(issue.number));
  } catch (e) {
    const lines = String(e.stderr || e.message).split('\n').filter(Boolean);
    const msg = lines.find((l) => l.startsWith('Error:'))?.replace(/^Error:\s*/, '') || lines.slice(-3).join('\n');
    gh('issue', 'comment', String(issue.number), '--body', `⚠️ 投稿できませんでした。\n\n\`\`\`\n${msg}\n\`\`\`\n\n認証情報（Settings → Secrets and variables → Actions）を確認してから、\`承認\` ラベルを一度外して付け直してください。`);
    process.exit(1);
  }
} else {
  console.error('使い方: action.mjs draft x|article / action.mjs publish');
  process.exit(1);
}
