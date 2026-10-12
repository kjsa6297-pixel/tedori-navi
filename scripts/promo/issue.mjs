// 投稿案の Issue 本文の組み立てと取り出し
import { xWeight } from './content.mjs';

const START = '<!-- promo:start -->';
const END = '<!-- promo:end -->';

// Issue 本文：START〜END の中身が投稿される（Issue を編集すれば投稿内容も変わる）
export function issueBody(p) {
  const text = p.kind === 'x' ? p.body : `# ${p.title}\n\n${p.body}`;
  const how = p.kind === 'x'
    ? `### [📱 𝕏 で投稿する（タップ → 「ポスト」を押すだけ・無料）](https://x.com/intent/post?text=${encodeURIComponent(p.body)})\n\n投稿したらこの Issue を閉じてください。\n\n<sub>\`承認\` ラベルを付けると Bluesky に自動で投稿されます（𝕏 API を設定済みなら 𝕏 にも）。直したいときは下の枠内を編集してからラベルを付けてください（上のリンクは元の文面のままです）。</sub>`
    : '内容がよければ **`承認`** ラベルを付けてください。はてなブログに公開されます。\n\n**note にも載せる場合**：下の枠内（1行目のタイトルを除く）をコピーして、note の新規記事に貼り付けてください。';
  return `${how}\n\n${START}\n\`\`\`\`markdown\n${text}\n\`\`\`\`\n${END}\n\n${p.kind === 'x' ? `文字数：${xWeight(p.body)}/280` : ''}\n\n---\n_手取りナビの宣伝自動化（scripts/promo）で作成_`;
}

export function extract(body) {
  const i = body.indexOf(START), j = body.indexOf(END);
  if (i < 0 || j < 0) throw new Error('Issue 本文に投稿案の印（promo:start / promo:end）が見つかりません');
  return body.slice(i + START.length, j).trim().replace(/^````\w*\n/, '').replace(/\n````$/, '').trim();
}
