// The Paradise — Madame Paradisia, la Voyante du Paradise 🔮
// L'horoscope du jour, le tirage des 3 cartes, l'âme sœur du jour et la compatibilité amoureuse.
// C'est pour s'amuser : tout est tiré au hasard (mais reste le même toute la journée pour chacun).
const Fortune = (() => {
  const SIGNS = [
    ['capricorne', 'Capricorne', '♑', [12, 22]], ['verseau', 'Verseau', '♒', [1, 20]], ['poissons', 'Poissons', '♓', [2, 19]], ['belier', 'Bélier', '♈', [3, 21]],
    ['taureau', 'Taureau', '♉', [4, 20]], ['gemeaux', 'Gémeaux', '♊', [5, 21]], ['cancer', 'Cancer', '♋', [6, 21]], ['lion', 'Lion', '♌', [7, 23]],
    ['vierge', 'Vierge', '♍', [8, 23]], ['balance', 'Balance', '♎', [9, 23]], ['scorpion', 'Scorpion', '♏', [10, 23]], ['sagittaire', 'Sagittaire', '♐', [11, 22]],
  ];
  const signOf = (d, m) => { let s = SIGNS[0]; for (const x of SIGNS) if (m > x[3][0] || (m === x[3][0] && d >= x[3][1])) s = x; return m === 12 && d >= 22 ? SIGNS[0] : m === 1 && d < 20 ? SIGNS[0] : s; };
  const LOVE = ['Une conversation inattendue pourrait faire battre ton cœur aujourd\'hui 💘', 'Ose envoyer ce message que tu n\'oses pas envoyer : la réponse va te surprendre 😍', 'Quelqu\'un pense à toi en secret… regarde bien qui te parle ce soir 👀', 'Journée calme côté cœur : profite-en pour prendre soin de toi 🌸', 'Un sourire échangé sur le chat peut devenir bien plus qu\'un sourire 💞', 'Les étoiles te conseillent la franchise : dis ce que tu ressens 💌', 'Une belle rencontre se cache peut-être dans le salon Rencontres 💖', 'Ton charme est au maximum aujourd\'hui : tout le monde le remarque ✨'];
  const FRIEND = ['Un ami a besoin de toi : un petit message lui fera très plaisir 🤝', 'Une nouvelle amitié pourrait naître autour d\'une partie de babyfoot ⚽', 'Tes amis te réservent une belle surprise 🎁', 'C\'est le jour parfait pour inviter quelqu\'un dans ta maison sur l\'Île 🏡', 'Ton humour va faire rire tout le salon aujourd\'hui 😂', 'Rapproche-toi de quelqu\'un que tu connais peu : vous avez beaucoup en commun 🌟'];
  const LUCK = ['La chance te sourit aux jeux : tente le Mot d\'Or ou la machine à sous 🎰', 'Prudence aujourd\'hui : réfléchis avant de répondre 🧘', 'Ton énergie est au top : tu pourrais gagner une partie de la Roue 🎡', 'Les étoiles sont avec toi au Sommet du Paradise 🏔️', 'Journée parfaite pour aller danser au Paradise Club 🪩', 'Un petit cadeau inattendu pourrait arriver dans tes notifications 🔔'];
  const COLORS = [['Rose néon', '#ff4fd8'], ['Bleu électrique', '#2fa8ff'], ['Or', '#ffc94d'], ['Vert émeraude', '#2bff88'], ['Violet mystique', '#c64dff'], ['Rouge passion', '#ff2d55'], ['Orange soleil', '#ff8a1f'], ['Blanc lumière', '#ffffff']];
  // Les cartes du Paradise (un jeu de cartes inventé pour le site)
  const CARDS = [
    ['🌟', 'L\'Étoile du Paradise', 'Un vœu va bientôt se réaliser'], ['🌴', 'Le Palmier', 'Le repos et la douceur de vivre'], ['🌙', 'La Lune', 'Les secrets et les rêves'],
    ['💖', 'Le Cœur Néon', 'Une émotion forte arrive'], ['🗼', 'Le Phare', 'Une lumière pour te guider'], ['🌊', 'La Vague', 'Un grand changement approche'],
    ['🔥', 'Le Feu de camp', 'Des moments chaleureux entre amis'], ['🪩', 'La Boule à facettes', 'La fête et la joie'], ['🗝️', 'La Clé d\'or', 'Une porte va s\'ouvrir'],
    ['🦋', 'Le Papillon', 'Une renaissance, un nouveau départ'], ['⚡', 'L\'Éclair', 'Une idée brillante et soudaine'], ['🌹', 'La Rose', 'L\'amour et la tendresse'],
    ['🎭', 'Le Masque', 'Quelqu\'un cache ses vrais sentiments'], ['👑', 'La Couronne', 'La réussite et la fierté'], ['🌈', 'L\'Arc-en-ciel', 'Après la pluie, le beau temps'],
    ['🐚', 'Le Coquillage', 'Écoute ton intuition'], ['☀️', 'Le Soleil', 'Le bonheur et la réussite'], ['🦉', 'Le Hibou', 'La sagesse et les bons conseils'],
    ['🎲', 'Le Dé', 'Le hasard fait bien les choses'], ['💌', 'La Lettre', 'Un message important arrive'], ['🏝️', 'L\'Île', 'Un voyage ou une évasion'], ['💎', 'Le Diamant', 'Une valeur cachée en toi'],
  ];
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const today = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const pick = (arr, seed) => arr[hash(seed) % arr.length];
  let tab = 'horo', flipped = false, close = null;
  function mySign() {
    if (state.me.birthDay && state.me.birthMonth) return signOf(state.me.birthDay, state.me.birthMonth);
    let k = ''; try { k = localStorage.getItem('fortuneSign') || ''; } catch (e) {}
    return SIGNS.find(s => s[0] === k) || null;
  }
  function open(which = 'horo') {
    tab = which; flipped = false;
    if (close) close();
    const box = el('div', { class: 'fortune' });
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back', 'fortune-back');
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    api('/api/fortune/visit', { method: 'POST' }).catch(() => {});
    render();
  }
  function render() {
    const box = document.querySelector('.fortune');
    if (!box) return;
    box.replaceChildren(
      el('div', { class: 'ft-head' }, el('div', { class: 'ft-ball' }, '🔮'), el('div', {}, el('b', {}, 'Madame Paradisia'), el('small', {}, 'La Voyante du Paradise voit tout… ✨')), el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      el('div', { class: 'shop-tabs' }, ...[['horo', '♈ Horoscope'], ['cards', '🃏 Les cartes'], ['soul', '💘 Âme sœur'], ['compat', '💞 Compatibilité']].map(([k, l]) => el('button', { class: 'shop-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; flipped = false; render(); } }, l))),
      el('div', { class: 'shop-body' }, ...({ horo, cards, soul, compat }[tab])()),
      el('small', { class: 'ft-note' }, '🎲 C\'est pour s\'amuser : les prédictions sont tirées au hasard chaque jour.'));
  }
  function horo() {
    const s = mySign();
    if (!s) {
      return [el('p', {}, 'Dis-moi ton signe, et je lirai ton avenir dans les étoiles… 🌙'), el('div', { class: 'ft-signs' }, ...SIGNS.map(x => el('button', { class: 'ft-sign', onclick: () => { try { localStorage.setItem('fortuneSign', x[0]); } catch (e) {} render(); } }, el('span', {}, x[2]), x[1])))];
    }
    const seed = s[0] + today(), stars = 2 + hash(seed + 'c') % 4, col = pick(COLORS, seed + 'col'), num = 1 + hash(seed + 'n') % 99;
    const row = (i, t, txt) => el('div', { class: 'ft-row' }, el('span', {}, i), el('div', {}, el('b', {}, t), el('p', {}, txt)));
    return [el('div', { class: 'ft-sign-big' }, el('span', {}, s[2]), el('b', {}, s[1]), el('small', {}, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))),
      row('💘', 'Amour', pick(LOVE, seed + 'l')), row('🤝', 'Amitié', pick(FRIEND, seed + 'f')), row('🍀', 'Chance', `${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)} · ${pick(LUCK, seed + 'k')}`),
      el('div', { class: 'ft-extra' }, el('span', {}, '🎨 Couleur du jour : ', el('b', { style: 'color:' + col[1] }, col[0])), el('span', {}, '🔢 Chiffre porte-bonheur : ', el('b', {}, num))),
      !state.me.birthDay ? el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { try { localStorage.removeItem('fortuneSign'); } catch (e) {} render(); } }, 'Changer de signe') : null];
  }
  function cards() {
    const seed = state.me.id + today(), deck = [...CARDS], hand = [];
    let h = hash(seed);
    for (let i = 0; i < 3; i++) { hand.push(deck.splice(h % deck.length, 1)[0]); h = hash(String(h)); }
    const labels = ['Ton passé', 'Ton présent', 'Ton avenir'];
    return [el('p', { class: 'ft-center' }, flipped ? 'Voici ce que les cartes me disent pour toi aujourd\'hui…' : 'Concentre-toi bien… puis retourne les cartes 🃏'),
      el('div', { class: 'ft-cards' + (flipped ? ' flipped' : '') }, ...hand.map((c, i) => el('div', { class: 'ft-card', style: `animation-delay:${i * .25}s` },
        el('div', { class: 'ft-card-in' }, el('div', { class: 'ft-back' }, '✨'), el('div', { class: 'ft-front' }, el('small', {}, labels[i]), el('span', {}, c[0]), el('b', {}, c[1]), el('em', {}, c[2])))))),
      !flipped ? el('button', { class: 'btn btn-primary daily-btn', onclick: () => { flipped = true; render(); } }, '🃏 Retourner les cartes') : null];
  }
  function soul() {
    const pool = (state.online || []).filter(u => u.id !== state.me.id && !u.ghost && u.role !== 'bot');
    if (!pool.length) return [el('div', { class: 'ft-center' }, el('p', {}, '🔮 Ma boule de cristal est toute brumeuse… Personne d\'autre n\'est connecté pour l\'instant. Reviens quand il y a du monde !'))];
    const u = pool[hash(state.me.id + today() + pool.map(x => x.id).sort().join(',')) % pool.length];
    const pct = 70 + hash(state.me.id + ':' + u.id + today()) % 31;
    return [el('div', { class: 'ft-soul' }, el('p', {}, 'Les étoiles ont parlé… aujourd\'hui, ton âme sœur sur The Paradise est :'),
      el('div', { class: 'ft-soul-card' }, LC.avatar(u, true), LC.name(u), el('div', { class: 'ft-meter' }, el('i', { style: `--p:${pct}%` })), el('b', { class: 'ft-pct' }, `💘 ${pct} % de compatibilité`)),
      el('button', { class: 'btn btn-primary', onclick: () => { close && close(); openProfile(u.id); } }, '👀 Voir son profil'))];
  }
  function compat() {
    const a = el('input', { class: 'input', placeholder: 'Premier pseudo', value: state.me.username, maxlength: 30 });
    const b = el('input', { class: 'input', placeholder: 'Deuxième pseudo', maxlength: 30 });
    const res = el('div', { class: 'ft-res' });
    const go = () => {
      const x = a.value.trim(), y = b.value.trim();
      if (!x || !y) return toast('Écris les deux pseudos');
      const key = [x.toLowerCase(), y.toLowerCase()].sort().join('💞');
      const pct = x.toLowerCase() === y.toLowerCase() ? 100 : hash(key) % 101;
      const verdict = pct >= 90 ? '🔥 Âmes sœurs ! Les étoiles sont formelles' : pct >= 70 ? '💖 Une très belle alchimie' : pct >= 50 ? '😊 Un joli potentiel, à vous de jouer' : pct >= 30 ? '🤝 Plutôt une belle amitié' : '🌧️ Les étoiles hésitent… mais l\'amour est imprévisible !';
      res.replaceChildren(el('div', { class: 'ft-meter big' }, el('i', { style: `--p:${pct}%` })), el('b', { class: 'ft-pct' }, `${x} 💞 ${y} : ${pct} %`), el('p', {}, verdict));
      LC.confetti(pct >= 70 ? ['💖', '💘', '✨'] : ['✨']);
    };
    return [el('p', {}, 'Écris deux pseudos, et je te dirai si l\'amour est écrit dans les étoiles… 💫'), el('div', { class: 'ft-compat' }, a, el('span', {}, '💞'), b), el('button', { class: 'btn btn-primary', onclick: go }, '🔮 Calculer'), res];
  }
  return { open };
})();
window.Fortune = Fortune;
