import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oauthSignature, hatenaEntry } from '../scripts/promo/publish.mjs';
import { xPost, xWeight, article } from '../scripts/promo/content.mjs';
import { issueBody, extract } from '../scripts/promo/issue.mjs';

test('OAuth 1.0a 署名が 𝕏 公式ドキュメントの例と一致する', () => {
  const sig = oauthSignature('POST', 'https://api.twitter.com/1.1/statuses/update.json', {
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    include_entities: 'true',
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
  }, 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE');
  assert.equal(sig, 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
});

const day = (i) => new Date(Date.UTC(2026, 9, 13) + i * 86400000).toISOString().slice(0, 10);

test('𝕏 の投稿は1年間すべて280以内で、30日以内に同じ文面がない', () => {
  const seen = new Map();
  for (let i = 0; i < 365; i++) {
    const p = xPost(day(i));
    assert.ok(xWeight(p.body) <= 280, `${day(i)}: ${xWeight(p.body)}`);
    assert.ok(!/NaN|undefined/.test(p.body), day(i));
    if (seen.has(p.body)) assert.ok(i - seen.get(p.body) >= 30, `${day(i)} が ${seen.get(p.body)}日目と同じ`);
    seen.set(p.body, i);
  }
});

test('記事は1年分すべて作れて、壊れた値を含まない', () => {
  for (let w = 0; w < 52; w++) {
    const a = article(day(w * 7));
    assert.ok(a.title.length > 10 && a.body.length > 300, a.title);
    assert.ok(!/NaN|undefined/.test(a.title + a.body), a.title);
  }
});

test('はてなブログの投稿XMLは特殊文字をエスケープする', () => {
  const x = hatenaEntry('A&B <壁>', '本文 "x" & y');
  assert.match(x, /<title>A&amp;B &lt;壁&gt;<\/title>/);
  assert.match(x, /本文 &quot;x&quot; &amp; y/);
});

test('Issue 本文から投稿内容をそのまま取り出せる', () => {
  const x = xPost('2026-10-13');
  assert.equal(extract(issueBody(x)), x.body);
  const a = article('2026-10-13');
  assert.equal(extract(issueBody(a)), `# ${a.title}\n\n${a.body}`);
});

test('Bluesky のリンク・タグ位置（UTF-8バイト）が1年分すべて正しく、300文字以内', async () => {
  const { blueskyFacets, blueskyRecord, graphemes } = await import('../scripts/promo/publish.mjs');
  for (let i = 0; i < 365; i++) {
    const text = xPost(day(i)).body;
    assert.ok(graphemes(text) <= 300, day(i));
    const buf = Buffer.from(text, 'utf8');
    const facets = blueskyFacets(text);
    assert.ok(facets.some((f) => f.features[0].$type.endsWith('#link')), `${day(i)}: リンクがない`);
    for (const f of facets) {
      const s = buf.subarray(f.index.byteStart, f.index.byteEnd).toString('utf8');
      const feat = f.features[0];
      assert.equal(s, feat.uri ?? `#${feat.tag}`, day(i));
    }
    assert.equal(blueskyRecord(text).embed.external.uri, facets.find((f) => f.features[0].uri).features[0].uri);
  }
});
