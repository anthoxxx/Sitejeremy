// The Paradise — Les boutiques de la Ville 🏙️ : on entre dedans et on y fait vraiment des choses
// Coiffeur (changer de coupe), boutique de vêtements, bijouterie, restos (on mange dans la Ville),
// supermarché et pharmacie (pour son animal), hôpital, salle de sport, banque, fleuriste, poste, librairie, hôtel, bar…
const City = (() => {
  const SHOPS = {
    Coiffeur: { icon: '💇', color: '#ff4fd8', npc: '✂️ Jessy, la coiffeuse', hello: 'Installe-toi dans le fauteuil ! On change de tête aujourd\'hui ?', blurb: 'Change la couleur de tes cheveux (en 3D)' },
    Boutique: { icon: '👗', color: '#c64dff', npc: '🛍️ Inès, la vendeuse', hello: 'Bienvenue ! Les cabines d\'essayage sont au fond, essaie tout ce que tu veux.', blurb: 'Le magasin de vêtements 3D : essaie et achète de vraies tenues' },
    Bijouterie: { icon: '💍', color: '#ffd76a', npc: '💎 Monsieur Diamant', hello: 'Couronnes, auréoles, ailes… rien n\'est trop beau pour toi.', blurb: 'Couronnes, lunettes, ailes et bijoux en 3D' },
    Boulangerie: { icon: '🥖', color: '#ffd34d', npc: '🥐 Paulette, la boulangère', hello: 'Tout est sorti du four ce matin, ça sent bon hein ?', blurb: 'Baguette, croissants et gâteaux' },
    Pizzeria: { icon: '🍕', color: '#ff2d55', npc: '🇮🇹 Luigi, le pizzaïolo', hello: 'Mamma mia ! Qu\'est-ce que je te prépare ?', blurb: 'Pizzas et pâtes tout juste sorties du four' },
    Sushi: { icon: '🍣', color: '#ff8a1f', npc: '🍱 Kenji, le chef', hello: 'Irasshaimase ! Tout est frais du jour.', blurb: 'Sushis, ramen et mochis' },
    Burger: { icon: '🍔', color: '#ffd34d', npc: '🍟 Max, au comptoir', hello: 'Salut ! Menu XXL ou petite faim ?', blurb: 'Burgers, frites et sodas' },
    Glacier: { icon: '🍦', color: '#38dce6', npc: '🍨 Lola, la glacière', hello: 'Il fait toujours beau pour une glace !', blurb: 'Glaces, bubble tea et smoothies' },
    Bar: { icon: '🍸', color: '#ff2d55', npc: '🍹 Tony, le barman', hello: 'Qu\'est-ce que je te sers ? La maison offre le sourire.', blurb: 'Cocktails et boissons' },
    'Station-service': { icon: '⛽', color: '#2bff88', npc: '🧢 Kevin, à la caisse', hello: 'Un petit café pour la route ? Le plein, c\'est offert aujourd\'hui ⛽', blurb: 'Café, sandwichs et boissons pour la route' },
    Supermarché: { icon: '🛒', color: '#2fa8ff', npc: '🧾 Nadia, à la caisse', hello: 'Il y a tout ce qu\'il faut, même pour ton animal !', blurb: 'Courses, friandises et croquettes pour ton animal' },
    Pharmacie: { icon: '💊', color: '#2bff88', npc: '⚕️ Le Dr Pilule', hello: 'Bonjour ! Ton compagnon a besoin d\'un petit remontant ?', blurb: 'Vitamines et soins pour ton animal' },
    Hôpital: { icon: '🏥', color: '#ffffff', npc: '🩺 La Dre Bobo', hello: 'Pas de panique, ici on soigne tout le monde (même les animaux).', blurb: 'Check-up gratuit pour toi et ton animal' },
    'Salle de sport': { icon: '🏋️', color: '#2fa8ff', npc: '💪 Coach Rocky', hello: 'Allez on se motive ! 10 secondes, tape le plus vite possible !', blurb: 'Fais du sport et gagne des pièces' },
    Banque: { icon: '🏦', color: '#38dce6', npc: '👔 Monsieur Picsou', hello: 'Votre argent est en sécurité chez nous. Et il rapporte !', blurb: 'Ton compte et tes intérêts du jour' },
    Fleuriste: { icon: '💐', color: '#ff4fd8', npc: '🌷 Rose, la fleuriste', hello: 'Un bouquet pour quelqu\'un de spécial ? Je le livre tout de suite !', blurb: 'Envoie un bouquet de fleurs à un ami' },
    Poste: { icon: '📮', color: '#ffd34d', npc: '✉️ Gégé, le facteur', hello: 'Une carte postale ? C\'est gratuit et ça fait toujours plaisir.', blurb: 'Envoie une carte postale à un ami' },
    Librairie: { icon: '📚', color: '#2bff88', npc: '📖 Madame Plume', hello: 'Choisis un livre au hasard : blagues, anecdotes, citations…', blurb: 'Lis des blagues, des anecdotes et des citations' },
    Hôtel: { icon: '🏨', color: '#c64dff', npc: '🛎️ Gaston, le réceptionniste', hello: 'Bienvenue au Paradise Hôtel ! Votre suite vous attend.', blurb: 'Room service et ta chambre (ta maison)' },
  };
  let catalog = null, close = null;
  const blurb = name => SHOPS[name]?.blurb || '';
  const coinsTxt = () => `💰 ${state.me?.coins ?? 0}`;
  const setCoins = c => { if (c != null && state.me) { state.me.coins = c; window.Shop?.counter?.(); } const b = document.querySelector('.city-coins'); if (b) b.textContent = coinsTxt(); };
  async function cat() { if (!catalog) catalog = await api('/api/city/catalog'); return catalog; }
  const friendsList = async () => (await api('/api/friends')).friends || [];

  async function open(name) {
    const S = SHOPS[name]; if (!S) return;
    if (state.me?.isGuest) return toast('Inscris-toi pour entrer dans les boutiques 🏙️');
    // 👗💇💍 directement dans le magasin 3D (vêtements, coiffeur, bijouterie) : ça change le vrai personnage 3D
    if (window.Outfits && { Boutique: 1, Coiffeur: 1, Bijouterie: 1 }[name]) return window.Outfits.open({ Boutique: 'clothes', Coiffeur: 'hair', Bijouterie: 'acc' }[name]);
    if (close) close();
    const body = el('div', { class: 'city-body' }, el('p', { class: 'help' }, 'Chargement…'));
    const box = el('div', { class: 'city-shop', style: `--shop:${S.color}` },
      el('div', { class: 'city-head' },
        el('div', { class: 'city-sign' }, el('span', { class: 'city-ico' }, S.icon), el('div', {}, el('b', {}, name), el('small', {}, S.blurb))),
        el('span', { class: 'city-coins' }, coinsTxt()),
        el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      el('div', { class: 'city-npc' }, el('div', { class: 'city-npc-face' }, S.npc.split(' ')[0]), el('div', { class: 'city-bubble' }, el('b', {}, S.npc.split(' ').slice(1).join(' ')), el('span', {}, S.hello))),
      body);
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back', 'city-back');
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    try { body.replaceChildren(...(await content(name, S))); } catch (e) { body.replaceChildren(el('p', { class: 'help' }, e.message)); }
  }
  const leaveTo = fn => () => { close && close(); fn(); };
  const lookShop = (only, o) => leaveTo(() => window.Look?.open({ only, ...o, foot: 'Ton personnage s\'affichera avec ce style dans la Ville' }));

  async function content(name, S) {
    const c = await cat();
    // 💇 Coiffeur
    if (name === 'Coiffeur') return [
      el('div', { class: 'city-actions' },
        el('button', { class: 'city-big', onclick: lookShop(['hair', 'face'], { title: '💇 Le salon de coiffure', sub: 'Choisis ta coupe, ta couleur, ta barbe… C\'est offert par la maison !', done: '💇 Superbe nouvelle coupe ! Va te montrer dans la Ville ✨', confetti: ['✂️', '💇', '✨'] }) }, el('span', {}, '💺'), el('b', {}, 'M\'asseoir dans le fauteuil'), el('small', {}, 'Choisis toi-même ta nouvelle coupe et ta couleur')),
        el('button', { class: 'city-big', onclick: surpriseCut }, el('span', {}, '🎲'), el('b', {}, 'Coupe surprise !'), el('small', {}, 'Jessy choisit pour toi… tu ne sais pas ce qui t\'attend 😱'))),
      el('p', { class: 'help' }, '✂️ Toutes les coupes et les couleurs sont gratuites.')];
    // 👗 la boutique de vêtements : on entre dans le vrai magasin 3D et le personnage 3D se change
    if (name === 'Boutique') { setTimeout(leaveTo(() => window.Outfits?.open()), 0); return [el('p', { class: 'help' }, '👗 On entre dans le magasin…')]; }
    if (name === 'Bijouterie') return [el('div', { class: 'city-actions' },
      el('button', { class: 'city-big', onclick: lookShop(['acc', 'extra'], { title: '💍 La vitrine de la bijouterie', sub: 'Couronnes, auréoles, ailes d\'ange… Les pièces rares se paient en pièces 💰', done: '💎 Tu brilles de mille feux !', confetti: ['💍', '👑', '✨'] }) }, el('span', {}, '💎'), el('b', {}, 'Voir la vitrine'), el('small', {}, 'Accessoires de tête et ailes dans le dos')))];
    const parts = [];
    // 💊 la pharmacie soigne aussi ton personnage (toux, grippe, indigestion…) ; 🩺 l'hôpital remet en pleine forme
    if (name === 'Pharmacie') { const { meds } = await api('/api/needs/meds'), N = window.Needs?.state?.() || {};
      parts.push(el('h4', { class: 'city-h' }, '💊 Pour toi'), el('p', { class: 'help' }, N.sick ? `${N.sickInfo?.icon || '🤧'} Tu as ${N.sickInfo?.name || 'quelque chose'} : choisis le bon remède !` : '❤️ Tu vas bien ! La vitamine C te protège du rhume pendant 1 heure.'),
        el('div', { class: 'city-grid' }, ...Object.entries(meds).map(([id, m]) => el('button', { class: 'city-item', onclick: async () => { try { const r = await api('/api/needs/med', { method: 'POST', body: { id } }); toast(r.msg); setCoins(r.coins); } catch (e) { toast(e.message); } } }, el('span', {}, m.icon), el('b', {}, m.name), el('small', {}, `${m.price} 💰`))))); }
    if (name === 'Hôpital') parts.push(el('div', { class: 'city-actions' }, el('button', { class: 'city-big', onclick: async () => { try { await api('/api/needs/hospital', { method: 'POST', body: {} }); } catch (e) { toast(e.message); } } }, el('span', {}, '🩺'), el('b', {}, 'Me faire soigner'), el('small', {}, 'Gratuit une fois par jour : santé au maximum et plus aucune maladie'))));
    if (c.food[name]) parts.push(el('h4', { class: 'city-h' }, name === 'Hôtel' ? '🛎️ Le room service' : name === 'Bar' ? '🍹 La carte' : '🍽️ Le menu'), foodGrid(name, c.food[name]));
    const petItems = Object.entries(c.pet).filter(([, p]) => p.shop === name);
    if (petItems.length) parts.push(el('h4', { class: 'city-h' }, '🐾 Pour ton animal'), el('div', { class: 'city-grid' }, ...petItems.map(([id, p]) => el('button', { class: 'city-item', onclick: () => petBuy(id, p) }, el('span', {}, p.icon), el('b', {}, p.name), el('em', {}, p.price ? `${p.price} 💰` : 'Gratuit')))));
    if (name === 'Hôpital') parts.unshift(el('div', { class: 'city-actions' }, el('button', { class: 'city-big', onclick: checkup }, el('span', {}, '🩺'), el('b', {}, 'Faire mon check-up'), el('small', {}, 'Gratuit, et le diagnostic est garanti 100 % fiable (ou presque)'))));
    if (name === 'Hôtel') parts.unshift(el('div', { class: 'city-actions' }, el('button', { class: 'city-big', onclick: leaveTo(() => window.Island?.goHome()) }, el('span', {}, '🛏️'), el('b', {}, 'Monter dans ma suite'), el('small', {}, 'Direction ta maison'))));
    if (name === 'Salle de sport') return gymGame();
    if (name === 'Banque') return bank();
    if (name === 'Fleuriste') return sendForm('flowers', c.flowers);
    if (name === 'Poste') return sendForm('postcard', c.cards);
    if (name === 'Librairie') return library();
    return parts.length ? parts : [el('p', { class: 'help' }, 'Bientôt plein de choses ici !')];
  }

  // 🍽️ Acheter à manger : le personnage le tient ensuite dans la Ville
  function foodGrid(shop, list) {
    return el('div', { class: 'city-grid' }, ...list.map(([e, n, p], i) => el('button', { class: 'city-item', onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try { const r = await api('/api/city/food', { method: 'POST', body: { shop, idx: i } }); setCoins(r.coins); window.Island?.eat(r.emoji); toast(`${r.emoji} ${r.name} : bon appétit ! Ton personnage le mange dans la Ville 😋`); LC.confetti([r.emoji, '✨']); } catch (e2) { toast(e2.message); }
      b.disabled = false;
    } }, el('span', {}, e), el('b', {}, n), el('em', {}, `${p} 💰`))));
  }
  async function petBuy(id, p) {
    try { const r = await api('/api/city/pet', { method: 'POST', body: { item: id } }); setCoins(r.coins); toast(`${p.icon} ${r.pet.name} adore ça ! ${r.pet.moodIcon} (faim ${r.pet.food}/100 · joie ${r.pet.joy}/100)`); LC.confetti([p.icon, r.pet.icon, '💖']); } catch (e) { toast(e.message); }
  }
  // 🎲 La coupe surprise
  async function surpriseCut() {
    if (!confirm('Jessy choisit ta coupe et ta couleur au hasard. On y va ? 😱')) return;
    try {
      const d = await api('/api/look'), L = { ...(window.Look.defaults(state.me)), ...(d.look || {}) };
      const hairs = window.Look.CAT.hair.map(h => h[0]).filter(h => h !== L.hair);
      const colors = ['#1c1410', '#4a2c17', '#8a5a2b', '#d9a441', '#f4e08a', '#b5341f', '#ff6fb5', '#4fb3ff', '#8b5cf6', '#f2f2f2', '#2bd07a', '#ff8a1f'];
      L.hair = hairs[Math.floor(Math.random() * hairs.length)]; L.hairColor = colors[Math.floor(Math.random() * colors.length)];
      await api('/api/look', { method: 'POST', body: { look: L, mode: 'look' } });
      const nm = (window.Look.CAT.hair.find(h => h[0] === L.hair) || [])[1];
      close && close(); LC.confetti(['✂️', '💇', '😱', '✨']);
      toast(`✂️ Tadaaa ! Nouvelle coupe : ${nm} 😱 Regarde ton personnage dans la Ville`);
    } catch (e) { toast(e.message); }
  }
  function checkup() {
    const D = ['Tu es en pleine forme ! Petit conseil : un sourire par heure 😁', 'Diagnostic : trop de charme. Aucun traitement possible 😎', 'Légère carence en câlins : va voir tes amis dans Général 🤗', 'Tension parfaite, cœur en or 💛', 'Tu as attrapé le virus de la bonne humeur. C\'est contagieux 🦠😂', 'Un peu fatigué(e) : une sieste dans ta maison s\'impose 😴', 'Allergie aux lundis détectée. Rien de grave 📅'];
    toast('🩺 ' + D[Math.floor(Math.random() * D.length)]);
  }

  // 🏋️ La salle de sport : tape le plus vite possible pendant 10 secondes
  function gymGame() {
    let n = 0, end = 0, timer = 0;
    const best = (() => { try { return +localStorage.getItem('city_gym_best') || 0; } catch (e) { return 0; } })();
    const bar = el('div', { class: 'gym-bar' }, el('i'));
    const cnt = el('div', { class: 'gym-count' }, '0');
    const info = el('p', { class: 'help', style: 'text-align:center' }, `Record : ${best} · 30 coups minimum pour gagner des pièces (3 séances payées par jour)`);
    const btn = el('button', { class: 'gym-btn' }, '🏋️ Commencer');
    const tick = () => { const left = Math.max(0, end - Date.now()); bar.firstChild.style.width = (left / 100) + '%'; if (!left) finish(); };
    const finish = async () => {
      clearInterval(timer); timer = 0; btn.disabled = true; btn.textContent = '⏱️ Terminé !';
      try { if (n > best) localStorage.setItem('city_gym_best', n); } catch (e) {}
      try { const r = await api('/api/city/gym', { method: 'POST', body: { score: n } }); setCoins(r.coins); info.textContent = `${n} coups ! ${n > best ? '🏆 Nouveau record ! ' : ''}${r.gain ? `+${r.gain} 💰` : n < 30 ? 'Encore un effort pour gagner des pièces 💪' : 'Plus de pièces aujourd\'hui, mais quel athlète !'}`; if (r.gain) LC.confetti(['💪', '🏋️', '💰']); } catch (e) { info.textContent = e.message; }
      setTimeout(() => { btn.disabled = false; btn.textContent = '🔁 Recommencer'; n = 0; }, 2500);
    };
    btn.onclick = () => {
      if (!timer) { n = 0; cnt.textContent = '0'; end = Date.now() + 10000; timer = setInterval(tick, 50); btn.textContent = '💪 TAPE !'; return; }
      n++; cnt.textContent = n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop');
    };
    return [el('div', { class: 'gym' }, el('div', { class: 'gym-ico' }, '🏋️'), cnt, bar, btn, info)];
  }
  // 🏦 La banque
  async function bank() {
    const b = await api('/api/city/bank');
    const fmt = t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const solde = el('b', {}, `${b.coins} 💰`);
    const btn = el('button', { class: 'btn btn-primary', disabled: !b.interestReady, onclick: async () => {
      try { const r = await api('/api/city/bank/interest', { method: 'POST' }); setCoins(r.coins); solde.textContent = `${r.coins} 💰`; toast(`🏦 +${r.gain} pièces d'intérêts !`); LC.confetti(['💰', '🏦', '✨']); btn.disabled = true; btn.textContent = '✅ Intérêts touchés, reviens demain'; } catch (e) { toast(e.message); }
    } }, b.interestReady ? `💰 Toucher mes intérêts du jour (+${b.interest})` : '✅ Intérêts touchés, reviens demain');
    return [el('div', { class: 'bank-card' }, el('small', {}, 'Solde de ton compte'), solde, el('small', {}, `Gagné depuis ton arrivée : ${b.total} pièces`)), btn,
      el('p', { class: 'help' }, 'Les intérêts : 2 % de ton solde chaque jour (entre 2 et 30 pièces).'),
      el('h4', { class: 'city-h' }, '🧾 Tes dernières opérations'),
      el('div', { class: 'bank-log' }, ...(b.log.length ? b.log.map(l => el('div', { class: 'bank-row' }, el('span', {}, l.reason), el('em', {}, fmt(l.created_at)), el('b', { class: l.amount > 0 ? 'plus' : 'minus' }, (l.amount > 0 ? '+' : '') + l.amount))) : [el('p', { class: 'help' }, 'Aucune opération pour l\'instant')]))];
  }
  // 💐 Fleurs / 📮 Carte postale
  async function sendForm(kind, items) {
    const friends = await friendsList();
    if (!friends.length) return [el('p', { class: 'help' }, 'Ajoute d\'abord des amis pour leur envoyer quelque chose 🤝')];
    let pick = Object.keys(items)[0];
    const grid = el('div', { class: 'city-grid' });
    const draw = () => grid.replaceChildren(...Object.entries(items).map(([id, v]) => el('button', { class: 'city-item' + (pick === id ? ' on' : ''), onclick: () => { pick = id; draw(); } },
      ...(kind === 'flowers' ? [el('span', {}, v[0]), el('b', {}, v[1]), el('em', {}, `${v[2]} 💰`)] : [el('span', {}, v.split(' ')[0]), el('b', {}, v.split(' ').slice(1).join(' ')), el('em', {}, 'Gratuit')]))));
    draw();
    const to = el('select', { class: 'input' }, ...friends.map(f => el('option', { value: f.id }, `${f.online ? '🟢' : '⚪'} ${f.username}`)));
    const txt = el('input', { class: 'input', maxlength: 140, placeholder: 'Un petit mot (facultatif)' });
    const go = el('button', { class: 'btn btn-primary', style: 'width:100%', onclick: async () => {
      go.disabled = true;
      try { const r = await api('/api/city/send', { method: 'POST', body: { kind, to: to.value, item: pick, text: txt.value } }); setCoins(r.coins); toast(kind === 'flowers' ? '💐 Bouquet livré ! Il l\'a reçu dans ses messages privés' : '📮 Carte postale envoyée !'); LC.confetti(kind === 'flowers' ? ['💐', '🌹', '💖'] : ['📮', '💌', '✨']); txt.value = ''; } catch (e) { toast(e.message); }
      go.disabled = false;
    } }, kind === 'flowers' ? '💐 Faire livrer le bouquet' : '📮 Poster la carte');
    return [el('h4', { class: 'city-h' }, kind === 'flowers' ? '💐 Choisis un bouquet' : '📮 Choisis une carte'), grid, el('h4', { class: 'city-h' }, '👤 Pour qui ?'), to, txt, go];
  }
  // 📚 La librairie
  function library() {
    const page = el('div', { class: 'book hidden' });
    const btn = el('button', { class: 'city-big', onclick: async () => {
      try { const r = await api('/api/city/read', { method: 'POST' }); page.replaceChildren(el('small', {}, r.kind), el('p', {}, r.text), r.gain ? el('em', {}, `+${r.gain} 💰 pour la lecture`) : null); page.classList.remove('hidden'); page.classList.remove('flip'); void page.offsetWidth; page.classList.add('flip'); if (r.gain) window.Shop?.counter?.(); } catch (e) { toast(e.message); }
    } }, el('span', {}, '📖'), el('b', {}, 'Prendre un livre au hasard'), el('small', {}, 'Blagues, anecdotes, citations, horoscope…'));
    return [el('div', { class: 'city-actions' }, btn), page];
  }
  // 💐 Quelqu'un m'a envoyé des fleurs
  socket.on('city_gift', g => LC.confetti([g.icon, '💖', '✨']));
  return { open, blurb, SHOPS };
})();
window.City = City;
