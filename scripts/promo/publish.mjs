// 𝕏 と はてなブログ への投稿。依存パッケージなし。認証情報は環境変数（GitHub Secrets）から読む。
import { createHmac, randomBytes } from 'node:crypto';

// 貼り付け時に入りがちな前後の空白・改行を取り除いた認証情報
const clean = (env) => Object.fromEntries(Object.entries(env).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

// ─── 𝕏（OAuth 1.0a ユーザーコンテキスト） ─────────────────────
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// RFC 5849 の署名。JSON本文は署名に含めない
export function oauthSignature(method, url, params, consumerSecret, tokenSecret) {
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&'))].join('&');
  return createHmac('sha1', `${enc(consumerSecret)}&${enc(tokenSecret)}`).update(base).digest('base64');
}

export async function postToX(text, env = process.env) {
  env = clean(env);
  const need = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`𝕏 の認証情報が未設定です: ${missing.join(', ')}`);
  const url = 'https://api.x.com/2/tweets';
  const oauth = {
    oauth_consumer_key: env.X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  oauth.oauth_signature = oauthSignature('POST', url, oauth, env.X_API_SECRET, env.X_ACCESS_SECRET);
  const header = `OAuth ${Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ')}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: header, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`𝕏 への投稿に失敗しました（${res.status}）: ${JSON.stringify(json)}`);
  return `https://x.com/i/web/status/${json.data.id}`;
}

// ─── はてなブログ（AtomPub） ───────────────────────────────────
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function hatenaEntry(title, markdown, categories = ['手取り', '年収', 'お金']) {
  return `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app">
  <title>${xml(title)}</title>
  <content type="text/x-markdown">${xml(markdown)}</content>
  ${categories.map((c) => `<category term="${xml(c)}" />`).join('\n  ')}
  <app:control><app:draft>no</app:draft></app:control>
</entry>`;
}

export async function postToHatena(title, markdown, env = process.env, categories) {
  env = clean(env);
  const need = ['HATENA_ID', 'HATENA_BLOG_ID', 'HATENA_API_KEY'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`はてなブログの認証情報が未設定です: ${missing.join(', ')}`);
  const url = `https://blog.hatena.ne.jp/${env.HATENA_ID}/${env.HATENA_BLOG_ID}/atom/entry`;
  const auth = Buffer.from(`${env.HATENA_ID}:${env.HATENA_API_KEY}`).toString('base64');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/xml' }, body: hatenaEntry(title, markdown, categories) });
  const text = await res.text();
  if (!res.ok) throw new Error(`はてなブログへの投稿に失敗しました（${res.status}）: ${text.slice(0, 300)}`);
  const m = text.match(/<link rel="alternate" type="text\/html" href="([^"]+)"/);
  return m ? m[1] : url;
}

// ─── Bluesky（AT Protocol・無料） ──────────────────────────────
// リンクとハッシュタグは「facet」で指定する。位置は UTF-8 のバイト数で数える
export function blueskyFacets(text) {
  const facets = [];
  const bytes = (s) => Buffer.byteLength(s, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    const start = bytes(text.slice(0, m.index));
    facets.push({ index: { byteStart: start, byteEnd: start + bytes(m[0]) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  for (const m of text.matchAll(/(^|\s)#([^\s#]+)/g)) {
    const at = m.index + m[1].length;
    const start = bytes(text.slice(0, at));
    facets.push({ index: { byteStart: start, byteEnd: start + bytes(`#${m[2]}`) }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2] }] });
  }
  return facets;
}

export const graphemes = (s) => [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(s)].length;

export function blueskyRecord(text, now = new Date()) {
  const url = text.match(/https?:\/\/[^\s]+/)?.[0];
  const record = { $type: 'app.bsky.feed.post', text, createdAt: now.toISOString(), langs: ['ja'], facets: blueskyFacets(text) };
  // リンクカード（画像なし）
  if (url) record.embed = { $type: 'app.bsky.embed.external', external: { uri: url, title: '手取りナビ｜2026年の手取り計算', description: text.split('\n')[0] } };
  return record;
}

export async function postToBluesky(text, env = process.env) {
  env = clean(env);
  const missing = ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Bluesky の認証情報が未設定です: ${missing.join(', ')}`);
  if (graphemes(text) > 300) throw new Error(`Bluesky の文字数オーバー（${graphemes(text)}/300）`);
  const host = 'https://bsky.social/xrpc';
  const s = await fetch(`${host}/com.atproto.server.createSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD }) });
  const session = await s.json().catch(() => ({}));
  if (!s.ok) throw new Error(`Bluesky のログインに失敗しました（${s.status}）: ${session.message || ''}`);
  const res = await fetch(`${host}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record: blueskyRecord(text) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bluesky への投稿に失敗しました（${res.status}）: ${json.message || ''}`);
  return `https://bsky.app/profile/${session.handle}/post/${json.uri.split('/').pop()}`;
}

export const hasX = (env = process.env) => ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'].every((k) => env[k]);
export const hasBluesky = (env = process.env) => Boolean(env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD);
