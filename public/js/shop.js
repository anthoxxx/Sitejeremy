// The Paradise — Paradise Coins 💰 et la boutique (côté navigateur)
// Le compteur de pièces en haut, le bonus du jour, la boutique, les cadeaux, le classement et les entrées en scène.
const Shop = (() => {
  let data = null, tab = 'shop', close = null;
  const SLOTS = [
    ['frame', '⭕ Cadres photo', 'Un cadre exclusif autour de ta photo, partout sur le site'],
    ['name', '✨ Effets de pseudo', 'Ton pseudo qui brille dans le chat'],
    ['badge', '🏅 Badges', 'Un badge à côté de ton pseudo'],
    ['entry', '🎬 Entrées en scène', 'Une animation quand tu arrives dans un salon'],
    ['furniture', '🛋️ Meubles rares', 'Pour ta maison sur l\'Île du Paradise 🏝️'],
  ];
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');

  // ---------- Le compteur en haut ----------
  function counter() {
    const b = $('coinsBtn');
    if (!b || !state.me) return;
    b.classList.toggle('hidden', !!state.me.isGuest);
    b.querySelector('.coins-n').textContent = fmt(state.me.coins);
    b.classList.toggle('gift', !!data && !data.daily.claimed);
  }
  function gainFx(gain, reason) {
    const b = $('coinsBtn');
    if (!b) return;
    const f = el('span', { class: 'coin-pop' + (gain < 0 ? ' minus' : '') }, `${gain > 0 ? '+' : ''}${gain} 💰`);
    b.append(f); setTimeout(() => f.remove(), 1600);
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    if (gain >= 5 && reason) toast(`💰 ${gain > 0 ? '+' : ''}${gain} pièces · ${reason}`);
  }
  socket.on('coins', d => {
    if (!state.me) return;
    state.me.coins = d.coins;
    counter();
    if (d.gain) gainFx(d.gain, d.reason);
    if (data) { data.coins = d.coins; if (close) render(); }
  });
  async function load() { try { data = await api('/api/shop'); state.me.coins = data.coins; counter(); return data; } catch (e) { return null; } }
  // Au démarrage : on rappelle le bonus du jour une fois par jour
  async function init() {
    if (!state.me || state.me.isGuest) return counter();
    await load();
    if (data && !data.daily.claimed) {
      let key = ''; try { key = localStorage.getItem('dailyHint') || ''; } catch (e) {}
      const today = new Date().toDateString();
      if (key !== today) { try { localStorage.setItem('dailyHint', today); } catch (e) {} setTimeout(() => toast('🎁 Ton bonus du jour t\'attend ! Touche ici pour le prendre', () => open('daily')), 2500); }
    }
  }

  // ---------- La fenêtre ----------
  async function open(which = 'shop') {
    if (state.me?.isGuest) return toast('Inscris-toi pour gagner des Paradise Coins 💰');
    tab = which;
    if (close) close();
    const box = el('div', { class: 'shop' }, el('div', { class: 'isl-wait' }, 'Chargement…'));
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back');
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    await load();
    render();
  }
  function render() {
    const box = document.querySelector('.shop');
    if (!box || !data) return;
    const tabs = [['shop', '🛍️ Boutique'], ['daily', '🎁 Bonus du jour'], ['earn', '💡 Gagner'], ['gift', '💝 Offrir'], ['top', '🏆 Classement'], ['history', '📜 Historique']];
    box.replaceChildren(
      el('div', { class: 'shop-head' },
        el('div', { class: 'shop-wallet' }, el('span', { class: 'shop-coin' }, '💰'), el('div', {}, el('b', {}, `${fmt(data.coins)} pièces`), el('small', {}, `${fmt(data.total)} gagnées depuis le début · ${data.rank}e du classement`))),
        el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      window.EventState?.live ? el('div', { class: 'shop-boost' }, `${window.EventState.live.icon} C'est la ${window.EventState.live.title} : les jeux rapportent le DOUBLE de pièces !`) : null,
      el('div', { class: 'shop-tabs' }, ...tabs.map(([k, l]) => el('button', { class: 'shop-tab' + (tab === k ? ' on' : '') + (k === 'daily' && !data.daily.claimed ? ' dot' : ''), onclick: () => { tab = k; render(); } }, l))),
      el('div', { class: 'shop-body' }, ...({ shop: shopTab, daily: dailyTab, earn: earnTab, gift: giftTab, top: topTab, history: historyTab }[tab])()));
  }
  function preview(i) {
    const me = { ...state.me, frame: state.me.frame, nameEffect: state.me.nameEffect };
    if (i.slot === 'frame') return LC.avatar({ ...me, frame: i.value }, true);
    if (i.slot === 'name') return el('div', { class: 'shop-pv-name' }, LC.name({ ...me, nameEffect: i.value, shopBadge: '', isBirthday: false }));
    if (i.slot === 'badge') return el('div', { class: 'shop-pv-name' }, LC.name({ ...me, shopBadge: i.value, isBirthday: false }));
    return el('div', { class: 'shop-pv-icon' }, i.icon);
  }
  function shopTab() {
    return SLOTS.map(([slot, title, desc]) => el('section', { class: 'shop-sec' },
      el('h3', {}, title), el('small', { class: 'shop-desc' }, desc),
      el('div', { class: 'shop-grid' }, ...data.items.filter(i => i.slot === slot).map(i => el('div', { class: 'shop-item' + (i.owned ? ' owned' : '') + (i.equipped ? ' on' : '') },
        el('div', { class: 'shop-pv' }, preview(i)),
        el('b', {}, `${i.icon} ${i.name}`), el('small', {}, i.desc),
        i.slot === 'entry' ? el('button', { class: 'btn btn-sm btn-ghost', onclick: () => playEntry(i.value, state.me.username, true) }, '👀 Voir') : null,
        !i.owned ? el('button', { class: 'btn btn-sm' + (data.coins >= i.price ? ' btn-primary' : ''), onclick: () => buy(i) }, `${fmt(i.price)} 💰`)
          : i.slot === 'furniture' ? el('span', { class: 'shop-ok' }, '✅ À toi ! (🛠️ Mes meubles)')
          : i.equipped ? el('button', { class: 'btn btn-sm', onclick: () => equip(null, i.slot) }, '✓ Équipé · Retirer')
          : el('button', { class: 'btn btn-sm btn-primary', onclick: () => equip(i.id) }, 'Équiper'))))));
  }
  async function buy(i) {
    if (data.coins < i.price) return toast(`Il te manque ${fmt(i.price - data.coins)} pièces 💰 Va voir « 💡 Gagner » !`);
    if (!confirm(`Acheter « ${i.name} » pour ${fmt(i.price)} pièces ?`)) return;
    try {
      const r = await api('/api/shop/buy', { method: 'POST', body: { id: i.id } });
      data = r; Object.assign(state.me, r.user); renderMe(); counter(); render();
      LC.confetti([i.icon, '💰', '✨']);
      toast(`🎉 « ${i.name} » est à toi !${i.slot === 'furniture' ? ' Place-le chez toi avec 🛠️ Mes meubles' : ''}`);
      if (i.slot === 'entry') playEntry(i.value, state.me.username, true);
    } catch (e) { toast(e.message); }
  }
  async function equip(id, slot) {
    try { const r = await api('/api/shop/equip', { method: 'POST', body: { id, slot } }); data = r; Object.assign(state.me, r.user); renderMe(); render(); toast(id ? '✨ C\'est équipé !' : 'Retiré'); } catch (e) { toast(e.message); }
  }
  function dailyTab() {
    const d = data.daily, week = Array.from({ length: 7 }, (_, i) => i + 1);
    const cur = ((d.streak - 1) % 7) + 1;
    return [el('div', { class: 'daily' },
      el('div', { class: 'daily-gift' + (d.claimed ? ' done' : '') }, d.claimed ? '✅' : '🎁'),
      el('b', {}, d.claimed ? `Bonus pris ! Reviens demain pour le jour ${d.streak + 1} 🔥` : `Jour ${d.streak} : ${d.amount} pièces t'attendent !`),
      el('div', { class: 'daily-week' }, ...week.map(n => el('div', { class: 'daily-day' + (n < cur || (n === cur && d.claimed) ? ' got' : '') + (n === cur ? ' now' : '') }, el('small', {}, `Jour ${n}`), el('span', {}, n === 7 ? '🎉' : '💰'), el('b', {}, `${Math.min(50, 20 + (n - 1) * 5) + (n === 7 ? 100 : 0)}`)))),
      el('small', { class: 'shop-desc' }, 'Reviens chaque jour : le bonus grandit, et le 7e jour c\'est 100 pièces en plus ! Si tu rates un jour, ça recommence au jour 1.'),
      !d.claimed ? el('button', { class: 'btn btn-primary daily-btn', onclick: async e => {
        e.target.disabled = true;
        try { const r = await api('/api/coins/daily', { method: 'POST' }); data = r; state.me.coins = r.coins; counter(); render(); LC.confetti(['💰', '🎁', '✨']); } catch (err) { toast(err.message); e.target.disabled = false; }
      } }, '🎁 Prendre mon bonus') : null)];
  }
  function earnTab() {
    const rows = [
      ['🎁', 'Le bonus du jour', '20 à 150 pièces chaque jour'],
      ['💬', 'Discuter dans les salons', '1 pièce par message (40 par jour au maximum)'],
      ['🏆', 'Gagner aux jeux', 'Mot d\'Or, Paroles d\'Or, Blind Test, La Roue : 30 pièces · Le Sommet : 40 pièces'],
      ['⚽', 'Gagner au babyfoot', '20 pièces (10 contre le robot)'],
      ['🎰', 'La machine à sous de l\'Arcade', 'Mise de 5 pièces : jackpot = 50 pièces !'],
      ['🎯', 'Fléchettes et pince à peluches', '10 pièces pour un « 50 », 8 pièces par peluche gagnée'],
      ['🎉', 'Les soirées événements', '10 pièces toutes les 15 minutes, et tous les jeux rapportent le DOUBLE'],
      ['💝', 'Les cadeaux de tes amis', 'Tes amis peuvent t\'offrir des pièces'],
    ];
    return [el('div', { class: 'earn' }, ...rows.map(([i, t, d]) => el('div', { class: 'earn-row' }, el('span', {}, i), el('div', {}, el('b', {}, t), el('small', {}, d))))),
      el('small', { class: 'shop-desc' }, 'Les Paradise Coins sont des pièces virtuelles : elles ne s\'achètent pas avec de l\'argent et ne servent que sur The Paradise. Les jeux rapportent des pièces quelques fois par jour.')];
  }
  function giftTab() {
    const friends = state.friends?.friends || [];
    const sel = el('select', { class: 'input' }, el('option', { value: '' }, friends.length ? '— Choisis un ami —' : 'Ajoute des amis pour leur offrir des pièces'), ...friends.map(u => el('option', { value: u.id }, u.username)));
    const amount = el('input', { class: 'input', type: 'number', min: 5, max: 500, value: 20 });
    const msg = el('input', { class: 'input', maxlength: 120, placeholder: 'Un petit mot (facultatif)' });
    return [el('div', { class: 'gift' },
      el('p', {}, '💝 Fais plaisir à un ami : offre-lui des pièces (500 par jour au maximum).'),
      el('label', {}, 'À qui ?'), sel, el('label', {}, 'Combien ?'), amount, msg,
      el('button', { class: 'btn btn-primary', onclick: async () => {
        if (!sel.value) return toast('Choisis un ami');
        try { const r = await api('/api/coins/gift', { method: 'POST', body: { to: Number(sel.value), amount: Number(amount.value), message: msg.value } }); state.me.coins = r.coins; data.coins = r.coins; counter(); toast('💝 Cadeau envoyé !'); LC.confetti(['💝', '💰']); render(); } catch (e) { toast(e.message); }
      } }, '💝 Offrir'))];
  }
  function topTab() {
    const box = el('div', { class: 'top' }, el('div', { class: 'isl-wait' }, 'Chargement…'));
    api('/api/coins/top').then(r => box.replaceChildren(...r.top.map((u, i) => el('div', { class: 'top-row' + (u.id === state.me.id ? ' me' : '') },
      el('span', { class: 'top-rank' }, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`), LC.avatar(u), el('div', { class: 'top-name' }, LC.name(u)),
      el('b', {}, `${fmt(u.total)} 💰`))))).catch(() => {});
    return [el('small', { class: 'shop-desc' }, 'Les membres qui ont gagné le plus de pièces depuis le début'), box];
  }
  function historyTab() {
    return [el('div', { class: 'hist' }, ...(data.history.length ? data.history.map(h => el('div', { class: 'hist-row' }, el('span', {}, h.reason), el('b', { class: h.amount < 0 ? 'minus' : '' }, `${h.amount > 0 ? '+' : ''}${h.amount}`), el('small', {}, LC.date(h.created_at))))
      : [el('div', { class: 'isl-wait' }, 'Rien pour l\'instant : prends ton bonus du jour ! 🎁')]))];
  }

  // ---------- 🎬 Les entrées en scène ----------
  const ENTRY = {
    sparkles: { emojis: ['✨', '⭐', '💫'], text: '✨ {n} fait son entrée !' },
    hearts: { emojis: ['💖', '💕', '💗'], text: '💖 {n} arrive avec plein d\'amour !' },
    fireworks: { emojis: ['🎆', '🎇', '✨'], text: '🎆 {n} fait une entrée explosive !' },
    thunder: { emojis: ['⚡', '🌩️', '💥'], text: '⚡ {n} débarque comme l\'éclair !' },
    carpet: { emojis: ['🌟', '📸', '✨'], text: '🌟 Tapis rouge pour {n} !' },
    rainbow: { emojis: ['🌈', '🦄', '✨'], text: '🌈 {n} arrive sur un arc-en-ciel !' },
  };
  function playEntry(fx, name, preview) {
    const e = ENTRY[fx];
    if (!e) return;
    document.querySelector('.entry-fx')?.remove();
    const banner = el('div', { class: 'entry-fx efx-' + fx }, el('span', {}, e.text.replace('{n}', name)));
    document.body.append(banner);
    setTimeout(() => banner.remove(), 3400);
    LC.confetti(e.emojis);
    if (!preview && fx === 'thunder') { document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 400); }
  }
  socket.on('entry_fx', d => { if (state.view?.type === 'room' && state.view.slug === d.room) playEntry(d.fx, d.username); });

  return { open, init, counter, load, owned: id => (state.me?.owned || []).includes(id), playEntry };
})();
window.Shop = Shop;
$('coinsBtn').onclick = () => Shop.open();
