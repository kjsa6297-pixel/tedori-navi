// 投稿案の Issue 本文の組み立てと取り出し
import { xWeight } from './content.mjs';

const START = '<!-- promo:start -->';
const END = '<!-- promo:end -->';

// Issue 本文：START〜END の中身が投稿される（Issue を編集すれば投稿内容も変わる）
export function issueBody(p) {
  const text = p.kind === 'x' ? p.body : `# ${p.title}\n\n${p.body}`;
  const how = p.kind === 'x'
    ? '内容がよければ、この Issue に **`承認`** ラベルを付けてください。𝕏 に投稿されます。直したいときは、下の枠内を編集してからラベルを付けてください。'
    : '内容がよければ **`承認`** ラベルを付けてください。はてなブログに公開されます。\n\n**note にも載せる場合**：下の枠内（1行目のタイトルを除く）をコピーして、note の新規記事に貼り付けてください。';
  return `${how}\n\n${START}\n\`\`\`\`markdown\n${text}\n\`\`\`\`\n${END}\n\n${p.kind === 'x' ? `文字数：${xWeight(p.body)}/280` : ''}\n\n---\n_手取りナビの宣伝自動化（scripts/promo）で作成_`;
}

export function extract(body) {
  const i = body.indexOf(START), j = body.indexOf(END);
  if (i < 0 || j < 0) throw new Error('Issue 本文に投稿案の印（promo:start / promo:end）が見つかりません');
  return body.slice(i + START.length, j).trim().replace(/^````\w*\n/, '').replace(/\n````$/, '').trim();
}
