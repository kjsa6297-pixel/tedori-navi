// もしもアフィリエイトの規約・ガイドライン（docs/MOSHIMO.html）に反する表現やリンクがないかを検査する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { xPost, ARTICLE_KEYS, articleByKey, adLink } from '../scripts/promo/content.mjs';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));

// 根拠のない最上級・あいまいな価格表現、報酬目的で押させる言い方（運営ガイドライン「景品表示法」「成果報酬対象行為を依頼、助長する表現」）
const NG = [/最安/, /激安/, /業界(No|ナンバー)\.?1/, /実質(無料|タダ|[0-9０-９])/, /このリンクから/, /(購入|申し?込み?|登録|クリック)してください/, /今すぐ(購入|申し?込)/, /必ず(稼げ|儲か|得)/];
// アフィリエイトリンクのドメイン
const AFF = /af\.moshimo\.com|px\.a8\.net|a8\.net\/|i\.moshimo\.com|hb\.afl\.rakuten|amzn\.to/;

const check = (where, text) => {
  for (const re of NG) assert.doesNotMatch(text, re, `${where}: 禁止表現 ${re}`);
};
const day = (i) => new Date(Date.UTC(2026, 9, 13) + i * 86400000).toISOString().slice(0, 10);

test('ブログ記事に禁止表現がない', () => {
  for (const k of ARTICLE_KEYS) { const a = articleByKey(k); check(k, a.title + a.body); }
});

test('SNS 投稿に禁止表現とアフィリエイトリンクがない（𝕏はフォロワー3,000人未満、Bluesky は登録対象外）', () => {
  for (let i = 0; i < 365; i++) {
    const p = xPost(day(i)).body;
    check(day(i), p);
    assert.doesNotMatch(p, AFF, `${day(i)}: SNS にアフィリエイトリンク`);
  }
});

test('サイトの文章に禁止表現がない', () => {
  const files = [...readdirSync(new URL('../src/', import.meta.url)).map((f) => `../src/${f}`), '../scripts/build.mjs'];
  for (const f of files) check(f, readFileSync(new URL(f, import.meta.url), 'utf8'));
});

test('アフィリエイトのリンクは設定の場所にだけあり、ラベルも禁止表現を含まない', () => {
  for (const [k, a] of Object.entries(config.affiliates)) check(`affiliates.${k}`, a.label);
  // ソースやテンプレートにアフィリエイトリンクを直接書かない（site.config.json の affiliates だけ）
  for (const f of ['../scripts/build.mjs', '../scripts/promo/content.mjs', ...readdirSync(new URL('../src/', import.meta.url)).map((x) => `../src/${x}`)]) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), AFF, `${f}: アフィリエイトリンクの直書き`);
  }
  // はてなブログが未提携の間（blogAds が false）は記事に広告を出さない
  if (!config.promo?.blogAds) for (const k of ARTICLE_KEYS) assert.doesNotMatch(articleByKey(k).body, /（PR）|プロモーション（広告）/, k);
  assert.equal(adLink('furusato', { furusato: { url: 'https://example.com/x?a=1&b=2', label: 'x' } }, true).includes('https://example.com/x?a=1&b=2'), true, 'リンクは改変しない');
});
