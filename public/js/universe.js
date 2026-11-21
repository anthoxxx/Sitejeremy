// The Paradise — 🌌 Un univers pour chaque salon : fond à ses couleurs, animations (cœurs, étoiles, notes, pixels…),
// une enseigne néon avec des dessins lumineux qui se balancent, et une petite phrase du jour.
// (La Cuisine et l'Arc-en-ciel ont leur propre décor, dans kitchen.js et chat.js.)
const Universe = (() => {
  // les dessins néon (des traits, comme des tubes lumineux) — viewBox 0 0 64 64
  const ICON = {
    heart: 'M32 54C14 40 6 30 6 20a12 12 0 0 1 26-6 12 12 0 0 1 26 6c0 10-8 20-26 34z',
    hearts: 'M22 44C10 35 4 28 4 21a8 8 0 0 1 18-4 8 8 0 0 1 18 4c0 7-6 14-18 23z M44 58C36 52 32 47 32 42a6 6 0 0 1 12-3 6 6 0 0 1 12 3c0 5-4 10-12 16z',
    star: 'M32 6l7 17 18 1-14 12 5 18-16-10-16 10 5-18L7 24l18-1z',
    moon: 'M42 8a24 24 0 1 0 14 40A20 20 0 0 1 42 8z',
    pad: 'M18 22h28a12 12 0 0 1 12 12l2 12a6 6 0 0 1-11 4l-5-8H20l-5 8a6 6 0 0 1-11-4l2-12a12 12 0 0 1 12-12z M18 30v10 M13 35h10 M44 32h.1 M50 38h.1',
    invader: 'M20 14h4v4h-4z M40 14h4v4h-4z M24 18h16v4H24z M18 22h28v4H18z M14 26h36v8H14z M14 34h4v8h-4z M46 34h4v8h-4z M22 34h20v4H22z M24 42h6v4h-6z M34 42h6v4h-6z',
    note: 'M24 46V12l28-6v34 M24 46a7 6 0 1 1-1-.1z M52 40a7 6 0 1 1-1-.1z M24 20l28-6',
    phones: 'M10 38v-6a22 22 0 0 1 44 0v6 M6 38h10v16H6z M48 38h10v16H48z',
    glass: 'M18 6h28c0 14-4 24-14 26C22 30 18 20 18 6z M32 32v20 M22 56h20 M20 16h24',
    mic: 'M24 8h16v24a8 8 0 0 1-16 0z M16 28a16 16 0 0 0 32 0 M32 44v12 M24 58h16',
    tv: 'M8 16h48v32H8z M24 6l8 10 8-10 M14 22h28v20H14z M48 26h.1 M48 34h.1',
    bulb: 'M32 6a16 16 0 0 0-9 29c2 2 3 5 3 8h12c0-3 1-6 3-8A16 16 0 0 0 32 6z M26 50h12 M28 56h8 M32 16v10',
    diamond: 'M16 8h32l10 14-26 34L6 22z M6 22h52 M24 8l-4 14 12 34 12-34-4-14',
    balloon: 'M32 6a14 16 0 0 1 0 32 14 16 0 0 1 0-32z M30 38h4l-2 4z M32 42c-4 6 4 10 0 16',
    palm: 'M30 58c2-14 2-26 0-36 M30 22c-6-8-16-8-22-4 M30 22c4-9 14-12 22-8 M30 22c-10-2-18 4-20 12 M30 22c10-1 18 5 20 13 M30 22c0-8 4-14 10-16',
    cup: 'M14 10h36c0 18-8 28-18 28S14 28 14 10z M32 38v12 M22 54h20 M14 14H6c0 8 4 12 10 12 M50 14h8c0 8-4 12-10 12',
    crown: 'M8 48h48l4-28-14 10-14-18-14 18L4 20z M8 56h48',
    spark: 'M32 4v14 M32 46v14 M4 32h14 M46 32h14 M12 12l10 10 M42 42l10 10 M52 12 42 22 M22 42 12 52',
  };
  // chaque salon : ses 3 couleurs, son enseigne, ses dessins, ses animations, son fond, ses phrases
  const U = {
    general: { c: ['#ff2d55', '#ffb547', '#38e8ff'], title: 'PARADISE', sub: 'le salon de tout le monde · bienvenue !', icons: ['palm', 'star', 'cup', 'palm'], fx: 'sparkle', glyphs: ['✨', '⭐', '💫'], bg: 'aurora',
      tips: ['💬 Dis bonjour aux nouveaux : un simple « salut » fait toujours plaisir !', '🏙️ Tu connais la Ville 3D ? Touche 🏙️ en haut pour t\'y promener', '🔫 Une partie de Laser Game ? Va dans la Ville et touche « Laser Game »', '🎁 Ton bonus du jour t\'attend dans la boutique 💰', '🎤 Le salon Karaoké est ouvert à tous : prends le micro !'] },
    suggestions: { c: ['#ff8a1f', '#ffd23f', '#fff3c4'], title: 'IDÉES', sub: 'toutes tes idées pour améliorer le site', icons: ['bulb', 'spark', 'bulb', 'star'], fx: 'rise', glyphs: ['💡', '✨', '⚡'], bg: 'grid',
      tips: ['💡 Une idée, même petite, peut changer le site : écris-la !', '🛠️ Plein de nouveautés du site viennent de vos idées', '📝 Explique bien ton idée : à quoi elle sert et comment elle marcherait', '👍 Réagis aux idées des autres pour montrer que tu es d\'accord'] },
    rencontres: { c: ['#ff4fd8', '#ff2d55', '#ffb6e6'], title: 'RENCONTRES', sub: 'des cœurs qui battent, des sourires qui se croisent', icons: ['heart', 'hearts', 'heart', 'hearts'], fx: 'rise', glyphs: ['💖', '💕', '💘', '💗'], bg: 'love',
      tips: ['💌 Un compliment sincère vaut mieux que mille emojis', '😊 Sois toi-même : c\'est comme ça qu\'on fait les plus belles rencontres', '🛡️ Ne donne jamais ton adresse ni ton argent à quelqu\'un que tu ne connais pas', '💬 Pose des questions sur ses passions : c\'est le meilleur début de conversation', '🙅 Un « non » est un « non » : le respect avant tout'] },
    '18-25': { c: ['#2fa8ff', '#ff2bd6', '#00f0ff'], title: '18 — 25', sub: 'la jeunesse, la musique et les soirées', icons: ['phones', 'note', 'phones', 'spark'], fx: 'eq', glyphs: ['🎧', '🎶', '⚡'], bg: 'club',
      tips: ['🎧 Quel son tourne en boucle chez toi en ce moment ?', '🎮 Une partie de Laser Game entre potes ?', '🎤 Le karaoké, c\'est plus drôle à plusieurs !', '📸 Mets une belle photo de profil : c\'est la première chose qu\'on voit'] },
    '25-40': { c: ['#c084fc', '#ffb547', '#ff6b9d'], title: 'LOUNGE', sub: '26 – 40 ans · ambiance détente', icons: ['glass', 'star', 'glass', 'moon'], fx: 'bokeh', bg: 'lounge',
      tips: ['🍷 Installe-toi, sers-toi un verre (virtuel) et raconte ta journée', '🎵 Une playlist pour ce soir ? Le salon Musique est là pour ça', '☕ Pause café, pause chat : bienvenue au lounge', '🌆 Un week-end de prévu ? Partage tes bons plans'] },
    '40-plus': { c: ['#2fa8ff', '#ffd76a', '#b9d7ff'], title: '40 ET +', sub: 'sous les étoiles, entre gens de goût', icons: ['moon', 'star', 'star', 'moon'], fx: 'stars', bg: 'night',
      tips: ['🌙 La plus belle des choses, c\'est une bonne conversation', '📖 Un livre, un film, une série à conseiller ?', '🎶 Les chansons de notre jeunesse… tu en as une préférée ?', '☕ Ici on prend le temps : pas de presse, que du bon temps'] },
    amitie: { c: ['#2bff88', '#ffd23f', '#38e8ff'], title: 'AMITIÉ', sub: 'se faire des amis, sans prise de tête', icons: ['balloon', 'star', 'balloon', 'balloon'], fx: 'rise', glyphs: ['🎈', '🤝', '😊', '🎉'], bg: 'sun',
      tips: ['🤝 Ajoute en ami les personnes avec qui tu t\'entends bien', '🎮 Défie quelqu\'un à un jeu : ça rapproche !', '🏠 Invite tes amis dans ta maison de la Ville', '🎁 Offre quelques pièces à un ami pour lui faire plaisir'] },
    gaming: { c: ['#39ff14', '#ff2bd6', '#00f0ff'], title: 'GAMING', sub: 'manettes en main, à toi de jouer', icons: ['pad', 'invader', 'pad', 'invader'], fx: 'pixel', bg: 'synth',
      tips: ['🎮 À quoi tu joues en ce moment ?', '🏆 Défie un membre au Puissance 4 ou au morpion depuis son profil', '🔫 Le Laser Game du Paradise : 3 cartes, Rouges contre Bleus', '🕹️ La salle d\'arcade t\'attend dans la Ville', '🎯 Les quêtes du jour rapportent de l\'expérience et des pièces'] },
    musique: { c: ['#ff8a1f', '#ff2bd6', '#ffd23f'], title: 'MUSIQUE', sub: 'partage tes sons, tout le salon écoute', icons: ['note', 'phones', 'note', 'note'], fx: 'notes', glyphs: ['🎵', '🎶', '🎼'], bg: 'club',
      tips: ['🎵 Mets une musique : tout le salon l\'écoute en même temps', '🎧 Fais découvrir un artiste que personne ne connaît', '📻 La radio est en bas à gauche, avec plein de stations', '🎤 Envie de chanter ? Direction le salon Karaoké'] },
    karaoke: { c: ['#ffb547', '#ff2d55', '#fff3c4'], title: 'KARAOKÉ', sub: 'prends le micro, c\'est ton moment', icons: ['mic', 'star', 'mic', 'note'], fx: 'spot', bg: 'stage',
      tips: ['🎤 Inscris-toi avec « Choisir une chanson », puis rejoins le vocal', '👏 Applaudis les chanteurs, même quand ça chante faux 😄', '🌟 Pas de honte : ici tout le monde est une star', '🎶 Les paroles s\'affichent à l\'écran pendant la chanson'] },
    tv: { c: ['#33d6a6', '#38e8ff', '#b9fff0'], title: 'TV DU MONDE', sub: 'les chaînes du monde entier, ensemble', icons: ['tv', 'star', 'tv', 'spark'], fx: 'scan', bg: 'tv',
      tips: ['📺 Change de chaîne avec « Changer de chaîne » : il y en a de tous les pays', '🌍 Regarde une chaîne d\'un pays que tu ne connais pas !', '🍿 Plus drôle à plusieurs : commentez ensemble', '⌨️ Tape !aide pour voir les commandes'] },
    membres: { c: ['#ffd76a', '#ffffff', '#c9971c'], title: 'VIP', sub: 'le salon réservé aux membres inscrits', icons: ['diamond', 'crown', 'diamond', 'star'], fx: 'sparkle', glyphs: ['💎', '✨', '👑'], bg: 'gold',
      tips: ['💎 Bienvenue dans le salon VIP, réservé aux membres inscrits', '👑 Les badges de palier montrent ta richesse en pièces', '🛍️ La boutique a plus de 120 objets à découvrir', '✨ Un beau cadre et un effet de pseudo, et tu brilles partout'] },
  };
  let small = innerWidth < 760; try { const v = localStorage.getItem('lc_uv_small'); if (v) small = v === '1'; } catch (e) {}
  const NS = 'http://www.w3.org/2000/svg';
  function icon(name, col, i) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('class', 'uv-ic'); s.style.color = col;
    s.style.animationDuration = `${3 + (i * 1.1) % 2.2}s, ${5 + i * 1.9}s`; s.style.animationDelay = `${-i * .8}s, ${-i * 2}s`;
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICON[name] || ICON.star); s.append(p); return s;
  }
  function fxLayer(u) {
    const kids = [];
    const N = u.fx === 'eq' || u.fx === 'scan' ? 0 : 14;
    for (let i = 0; i < N; i++) {
      const left = (i * 37 + 9) % 96, delay = -((i * 1.9) % 14), dur = 9 + (i % 5) * 2.2, col = u.c[i % 3];
      if (u.fx === 'rise' || u.fx === 'notes' || u.fx === 'sparkle') kids.push(el('span', { class: 'uv-p uv-rise', style: `left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;font-size:${14 + (i % 4) * 6}px;color:${col}` }, u.glyphs[i % u.glyphs.length]));
      else if (u.fx === 'stars') kids.push(el('span', { class: 'uv-p uv-star', style: `left:${left}%;top:${(i * 53) % 70}%;animation-delay:${delay / 3}s;animation-duration:${2 + (i % 4)}s` }));
      else if (u.fx === 'bokeh') kids.push(el('span', { class: 'uv-p uv-bokeh', style: `left:${left}%;top:${(i * 41) % 85}%;width:${30 + (i % 4) * 22}px;height:${30 + (i % 4) * 22}px;background:${col};animation-delay:${delay}s;animation-duration:${dur}s` }));
      else if (u.fx === 'pixel') kids.push(el('span', { class: 'uv-p uv-pix', style: `left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;background:${col};box-shadow:0 0 8px ${col}` }));
      else if (u.fx === 'spot' && i < 3) kids.push(el('span', { class: 'uv-p uv-spot', style: `left:${15 + i * 35}%;animation-delay:${-i * 2}s;--sc:${col}` }));
    }
    if (u.fx === 'stars') kids.push(el('span', { class: 'uv-shoot' }), el('span', { class: 'uv-shoot two' }));
    if (u.fx === 'eq') kids.push(el('div', { class: 'uv-eq' }, ...Array.from({ length: 24 }, (_, i) => el('i', { style: `animation-delay:${-(i * .23) % 1.4}s;background:${u.c[i % 3]}` }))));
    if (u.fx === 'scan') kids.push(el('div', { class: 'uv-scan' }));
    if (u.bg === 'synth') kids.unshift(el('div', { class: 'uv-floor' })); // la grille rétro qui défile au sol
    return el('div', { id: 'uvFx', class: 'uv-fx' }, ...kids);
  }
  function banner(slug, u) {
    const day = Math.floor((Date.now() + 3600e3) / 86400e3), tip = u.tips[day % u.tips.length];
    const b = el('div', { id: 'uvBanner', class: 'uv-banner' + (small ? ' small' : '') },
      el('div', { class: 'uv-side' }, icon(u.icons[0], u.c[0], 0), icon(u.icons[1], u.c[1], 1)),
      el('div', { class: 'uv-sign' }, el('b', { class: 'uv-neon' }, u.title), el('small', { class: 'uv-sub' }, u.sub), el('div', { class: 'uv-tip' }, tip)),
      el('div', { class: 'uv-side' }, icon(u.icons[2], u.c[2], 2), icon(u.icons[3], u.c[0], 3)),
      el('button', { type: 'button', class: 'uv-toggle', title: 'Réduire ou agrandir le décor', onclick: () => { small = !small; try { localStorage.setItem('lc_uv_small', small ? '1' : '0'); } catch (e) {} b.classList.toggle('small', small); } }, '↕'));
    return b;
  }
  let cur = '';
  function set(slug) {
    const main = document.querySelector('.main'); if (!main) return;
    const u = U[slug];
    if (cur && cur !== slug) main.classList.remove('universe', 'uv-' + cur.replace(/[^a-z0-9-]/g, ''));
    $('uvFx')?.remove(); $('uvBanner')?.remove(); cur = '';
    if (!u) { main.style.removeProperty('--u1'); delete main.dataset.uvbg; return; }
    cur = slug;
    main.classList.add('universe', 'uv-' + slug.replace(/[^a-z0-9-]/g, ''));
    main.style.setProperty('--u1', u.c[0]); main.style.setProperty('--u2', u.c[1]); main.style.setProperty('--u3', u.c[2]);
    main.dataset.uvbg = u.bg;
    main.prepend(fxLayer(u));
    $('messages').before(banner(slug, u));
  }
  return { set, has: slug => !!U[slug] };
})();
window.Universe = Universe;
