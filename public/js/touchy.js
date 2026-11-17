// The Paradise — 🐱 Les émojis qu'on peut toucher : dans les messages, touche un émoji et il prend vie !
// Le chat lèche l'écran, le chien aboie, les cœurs s'envolent, le fantôme traverse l'écran, la fusée décolle…
const Touchy = (() => {
  const GROUPS = {
    lick: ['🐱', '😺', '😸', '😻', '🐈', '😽', '😹', '🐈‍⬛'],
    dog: ['🐶', '🐕', '🐩', '🦮'],
    love: ['❤️', '💖', '💕', '💗', '💓', '😍', '🥰', '💘', '💞', '🩷', '💜', '💙', '💚', '💛', '🧡', '🖤', '🤍'],
    fire: ['🔥'],
    party: ['🎉', '🥳', '🎊', '🎈'],
    ghost: ['👻'],
    laugh: ['😂', '🤣', '😆'],
    star: ['⭐', '🌟', '✨', '💫'],
    rocket: ['🚀'],
    kiss: ['💋', '😘', '😚'],
    rose: ['🌹', '🌸', '🌺', '💐'],
    frog: ['🐸'],
    poop: ['💩'],
    snow: ['❄️', '⛄', '☃️'],
    money: ['💰', '💸', '🤑', '💵'],
  };
  const KIND = new Map(); for (const [k, list] of Object.entries(GROUPS)) for (const e of list) KIND.set(e, k);
  const RE = new RegExp('(' + [...KIND.keys()].sort((a, b) => b.length - a.length).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gu');
  // on entoure les émojis animables d'un petit <span> qu'on peut toucher
  function wrap(node) {
    const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest('a, .emo') ? NodeFilter.FILTER_REJECT : RE.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const t of nodes) {
      RE.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = RE.exec(t.data))) { if (m.index > last) frag.append(t.data.slice(last, m.index)); frag.append(el('span', { class: 'emo', 'data-k': KIND.get(m[0]), title: 'Touche-moi !' }, m[0])); last = m.index + m[0].length; }
      frag.append(t.data.slice(last)); t.replaceWith(frag);
    }
  }
  const layer = (cls, ms = 2600) => { const d = el('div', { class: 'tch ' + cls }); document.body.append(d); setTimeout(() => d.remove(), ms); return d; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const burst = (emojis, n, cls, x, y) => { const d = layer('tch-burst ' + (cls || ''), 3000); for (let i = 0; i < n; i++) d.append(el('span', { style: `left:${x ?? rnd(5, 95)}%;top:${y ?? rnd(60, 100)}%;--dx:${rnd(-140, 140)}px;--dy:${rnd(-520, -200)}px;--r:${rnd(-60, 60)}deg;--d:${rnd(0, .5)}s;font-size:${rnd(22, 46)}px` }, emojis[Math.floor(Math.random() * emojis.length)])); };
  const ANIM = {
    // 👅 le chat arrive en bas de l'écran et lèche l'écran (les traces restent un peu)
    lick: e => { const d = layer('tch-lick', 3400); d.append(el('div', { class: 'tch-cat' }, el('span', { class: 'tch-cat-face' }, e), el('span', { class: 'tch-tongue' })), el('div', { class: 'tch-wet w1' }), el('div', { class: 'tch-wet w2' }), el('div', { class: 'tch-wet w3' }), el('b', { class: 'tch-say' }, 'Slurp slurp 😛')); },
    dog: e => { const d = layer('tch-dog', 2800); d.append(el('span', { class: 'tch-dog-face' }, e), el('b', { class: 'tch-say' }, 'Wouf ! Wouf ! 🐾')); for (let i = 0; i < 8; i++) d.append(el('span', { class: 'tch-paw', style: `left:${8 + i * 11}%;top:${70 - (i % 2) * 8 - i * 4}%;--d:${i * .15}s` }, '🐾')); },
    love: e => burst([e, '💖', '💕', '❤️', '💗'], 26),
    fire: () => { const d = layer('tch-fire', 2600); for (let i = 0; i < 22; i++) d.append(el('span', { style: `left:${rnd(0, 100)}%;--d:${rnd(0, .6)}s;font-size:${rnd(40, 90)}px` }, '🔥')); },
    party: () => { LC.confetti(['🎉', '🎊', '🥳', '✨', '🎈']); burst(['🎉', '🎊', '🎈'], 12); },
    ghost: e => { const d = layer('tch-ghost', 3200); d.append(el('span', { class: 'tch-ghost-face' }, e), el('b', { class: 'tch-say' }, 'Bouh ! 👻')); },
    laugh: e => { document.body.classList.add('tch-shake'); setTimeout(() => document.body.classList.remove('tch-shake'), 700); const d = layer('tch-big', 1800); d.append(el('span', {}, e)); burst(['😂', '🤣', 'HA', 'HA'], 14); },
    star: () => burst(['⭐', '🌟', '✨', '💫'], 30, 'tch-spark', 50, 55),
    rocket: e => { const d = layer('tch-rocket', 2600); d.append(el('span', {}, e)); for (let i = 0; i < 10; i++) d.append(el('i', { style: `--d:${i * .08}s` }, '💨')); },
    kiss: e => { const d = layer('tch-kiss', 3000); for (let i = 0; i < 6; i++) d.append(el('span', { style: `left:${rnd(10, 85)}%;top:${rnd(15, 75)}%;--d:${i * .18}s;--r:${rnd(-30, 30)}deg` }, '💋')); },
    rose: () => { const d = layer('tch-fall', 4200); for (let i = 0; i < 26; i++) d.append(el('span', { style: `left:${rnd(0, 100)}%;--d:${rnd(0, 1.5)}s;--dx:${rnd(-80, 80)}px;font-size:${rnd(18, 32)}px` }, ['🌸', '🌹', '🥀', '🌺'][Math.floor(Math.random() * 4)])); },
    snow: () => { const d = layer('tch-fall', 4200); for (let i = 0; i < 30; i++) d.append(el('span', { style: `left:${rnd(0, 100)}%;--d:${rnd(0, 1.5)}s;--dx:${rnd(-60, 60)}px;font-size:${rnd(16, 30)}px` }, '❄️')); },
    money: () => { const d = layer('tch-fall', 4200); for (let i = 0; i < 24; i++) d.append(el('span', { style: `left:${rnd(0, 100)}%;--d:${rnd(0, 1.2)}s;--dx:${rnd(-60, 60)}px;font-size:${rnd(22, 38)}px` }, ['💸', '💰', '💵', '🪙'][Math.floor(Math.random() * 4)])); },
    frog: e => { const d = layer('tch-frog', 2600); d.append(el('span', {}, e)); },
    poop: e => { const d = layer('tch-poop', 2400); d.append(el('span', {}, e), el('b', { class: 'tch-say' }, 'Splash ! 🤢')); },
  };
  document.addEventListener('click', ev => {
    const s = ev.target.closest('.emo'); if (!s) return;
    if (document.querySelectorAll('.tch').length > 3) return; // pas trop d'animations en même temps
    s.classList.remove('emo-pop'); void s.offsetWidth; s.classList.add('emo-pop');
    try { navigator.vibrate?.(30); } catch (e) {}
    (ANIM[s.dataset.k] || ANIM.love)(s.textContent);
  });
  return { wrap };
})();
window.Touchy = Touchy;
