// 𝕏 と はてなブログ への投稿。依存パッケージなし。認証情報は環境変数（GitHub Secrets）から読む。
import { createHmac, randomBytes } from 'node:crypto';

// ─── 𝕏（OAuth 1.0a ユーザーコンテキスト） ─────────────────────
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// RFC 5849 の署名。JSON本文は署名に含めない
export function oauthSignature(method, url, params, consumerSecret, tokenSecret) {
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&'))].join('&');
  return createHmac('sha1', `${enc(consumerSecret)}&${enc(tokenSecret)}`).update(base).digest('base64');
}

export async function postToX(text, env = process.env) {
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

export async function postToHatena(title, markdown, env = process.env) {
  const need = ['HATENA_ID', 'HATENA_BLOG_ID', 'HATENA_API_KEY'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`はてなブログの認証情報が未設定です: ${missing.join(', ')}`);
  const url = `https://blog.hatena.ne.jp/${env.HATENA_ID}/${env.HATENA_BLOG_ID}/atom/entry`;
  const auth = Buffer.from(`${env.HATENA_ID}:${env.HATENA_API_KEY}`).toString('base64');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/xml' }, body: hatenaEntry(title, markdown) });
  const text = await res.text();
  if (!res.ok) throw new Error(`はてなブログへの投稿に失敗しました（${res.status}）: ${text.slice(0, 300)}`);
  const m = text.match(/<link rel="alternate" type="text\/html" href="([^"]+)"/);
  return m ? m[1] : url;
}
