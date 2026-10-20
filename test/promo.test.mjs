import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oauthSignature, hatenaEntry } from '../scripts/promo/publish.mjs';
import { xPost, xWeight, article, ARTICLE_KEYS, articleByKey, nextArticle, categoriesFor, adLink, disclose } from '../scripts/promo/content.mjs';
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
    if (!xPost(day(i)).promo) { assert.ok(!/https?:/.test(text), `${day(i)}: ふだんの投稿にリンクがある`); continue; }
    assert.ok(facets.some((f) => f.features[0].$type.endsWith('#link')), `${day(i)}: リンクがない`);
    for (const f of facets) {
      const s = buf.subarray(f.index.byteStart, f.index.byteEnd).toString('utf8');
      const feat = f.features[0];
      assert.equal(s, feat.uri ?? `#${feat.tag}`, day(i));
    }
    assert.equal(blueskyRecord(text).embed.external.uri, facets.find((f) => f.features[0].uri).features[0].uri);
  }
});

test('宣伝（リンクつき）は週1回だけで、ふだんは日記のようなメモ', () => {
  let promo = 0;
  for (let i = 0; i < 70; i++) {
    const p = xPost(day(i));
    if (p.promo) { promo++; assert.match(p.body, /https:\/\//); } else assert.doesNotMatch(p.body, /https?:/);
  }
  assert.equal(promo, 10);
});

test('記事の一覧はすべて作れて、タイトルが重複せず、HTML の残りや壊れた値がない', () => {
  assert.ok(ARTICLE_KEYS.length >= 70, `${ARTICLE_KEYS.length}本`);
  const titles = new Set();
  for (const k of ARTICLE_KEYS) {
    const a = articleByKey(k);
    assert.ok(a.title.length > 10 && a.body.length > 400, k);
    assert.ok(!/NaN|undefined|null|<\/?[a-z]/.test(a.title + a.body), k);
    assert.ok(!titles.has(a.title), `${k}: タイトルが重複`);
    titles.add(a.title);
    assert.ok(a.body.includes('https://'), `${k}: サイトへのリンクがない`);
  }
});

test('記事はまだ出していないものを順に選び、同じ種類が続かない', () => {
  const used = [];
  for (let i = 0; i < ARTICLE_KEYS.length; i++) used.push(nextArticle(used).key);
  assert.equal(new Set(used).size, ARTICLE_KEYS.length);
  for (let i = 1; i < 11; i++) assert.notEqual(used[i].split('-')[0], used[i - 1].split('-')[0]);
  assert.ok(nextArticle(used).key);
});

test('記事の Issue には記録用の印が付き、投稿内容には含まれない', () => {
  const a = nextArticle([]);
  const body = issueBody(a);
  assert.match(body, new RegExp(`<!-- article:${a.key} -->`));
  assert.doesNotMatch(extract(body), /article:/);
});

test('はてなブログのカテゴリをタイトルから付ける', () => {
  assert.deepEqual(categoriesFor('【2026年】ふるさと納税の上限はいくら？'), ['手取り', 'お金', 'ふるさと納税']);
  assert.ok(categoriesFor('年収500万円の手取りは月32万円【2026年】').includes('年収別'));
});

test('アフィリエイトは URL があるときだけ「PR」つきで出し、記事の冒頭に広告の表示を入れる', () => {
  assert.equal(adLink('furusato', { furusato: { url: '', label: 'x' } }), '');
  const l = adLink('furusato', { furusato: { url: '//af.moshimo.com/af/c/click?a_id=1', label: '返礼品を探す' } });
  assert.match(l, /\[返礼品を探す\]\(https:\/\/af\.moshimo\.com\/af\/c\/click\?a_id=1\)\*\*（PR）/);
  assert.match(disclose(`本文${l}`), /^※この記事にはプロモーション（広告）が含まれます。/);
  assert.equal(disclose('本文'), '本文');
});
