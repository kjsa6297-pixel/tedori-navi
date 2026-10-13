// キャラクター（オリジナルのSVGイラスト。外部素材は使っていないので自由に使える）と会話の部品
export const CHARS = {
  sensei: {
    name: 'コイン先生',
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#f2b632" stroke="#c98500" stroke-width="3"/><circle cx="32" cy="32" r="22" fill="none" stroke="#ffd56b" stroke-width="2" stroke-dasharray="3 3"/><circle cx="23" cy="28" r="6.5" fill="#fff" stroke="#3a2a00" stroke-width="2.2"/><circle cx="41" cy="28" r="6.5" fill="#fff" stroke="#3a2a00" stroke-width="2.2"/><line x1="29.5" y1="28" x2="34.5" y2="28" stroke="#3a2a00" stroke-width="2.2"/><circle cx="24" cy="29" r="2.2" fill="#3a2a00"/><circle cx="42" cy="29" r="2.2" fill="#3a2a00"/><path d="M22 41c4 4 16 4 20 0" fill="none" stroke="#3a2a00" stroke-width="2.6" stroke-linecap="round"/><path d="M25 38c2-2 5-2 7 0c2-2 5-2 7 0" fill="#3a2a00"/><circle cx="16" cy="38" r="3" fill="#ff9a8a" opacity=".6"/><circle cx="48" cy="38" r="3" fill="#ff9a8a" opacity=".6"/></svg>`,
  },
  yuto: {
    name: 'ゆうと（26歳・会社員）',
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#dbe8fb"/><path d="M12 64c2-12 10-17 20-17s18 5 20 17z" fill="#2a78d6"/><path d="M27 47h10l-5 7z" fill="#fff"/><circle cx="32" cy="29" r="13" fill="#ffd9bf"/><path d="M19 27c0-10 7-15 14-15c8 0 13 6 12 14c-3-4-7-6-12-6c-5 0-10 2-14 7z" fill="#3b2a20"/><circle cx="27" cy="30" r="1.8" fill="#2b1d14"/><circle cx="37" cy="30" r="1.8" fill="#2b1d14"/><path d="M28 36c2 2 6 2 8 0" fill="none" stroke="#2b1d14" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  mika: {
    name: 'みか（34歳・パート、子ども1人）',
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#fde3d6"/><path d="M12 64c2-12 10-17 20-17s18 5 20 17z" fill="#eb6834"/><circle cx="46" cy="18" r="6" fill="#5a3a28"/><circle cx="32" cy="29" r="13" fill="#ffdcc6"/><path d="M18 31c-1-11 6-18 14-18c9 0 15 7 14 17c-2-6-7-9-14-9c-6 0-11 3-14 10z" fill="#5a3a28"/><circle cx="27" cy="30" r="1.8" fill="#2b1d14"/><circle cx="37" cy="30" r="1.8" fill="#2b1d14"/><path d="M28 36c2 2 6 2 8 0" fill="none" stroke="#2b1d14" stroke-width="1.8" stroke-linecap="round"/><circle cx="23" cy="34" r="2.2" fill="#ff9a8a" opacity=".5"/><circle cx="41" cy="34" r="2.2" fill="#ff9a8a" opacity=".5"/></svg>`,
  },
};

// 会話：[['sensei', '本文'], ['yuto', '本文'], ...]。先生は左、ほかは右。本文はHTML可（自前の文章だけを渡す）
export function talk(lines) {
  return `
<div class="talk">
${lines.map(([who, text]) => {
    const c = CHARS[who];
    return `<div class="tk ${who === 'sensei' ? 'l' : 'r'}"><div class="tk-av" title="${c.name}">${c.svg}</div><div class="tk-b"><span class="tk-n">${c.name.split('（')[0]}</span>${text}</div></div>`;
  }).join('')}
</div>`;
}

export function avatar(who, size = 56) {
  return `<span class="av" style="width:${size}px;height:${size}px">${CHARS[who].svg}</span>`;
}
