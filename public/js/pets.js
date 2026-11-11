// The Paradise — Mon animal de compagnie 🐾 (côté navigateur)
const Pets = (() => {
  let data = null, close = null, pickSpecies = 'chiot';
  const fmt = n => Number(n || 0).toLocaleString('fr-FR');
  async function open() {
    if (state.me?.isGuest) return toast('Inscris-toi pour adopter un animal 🐾');
    if (close) close();
    let timer = 0;
    const box = el('div', { class: 'pets' }, el('div', { class: 'isl-wait' }, 'Chargement…'));
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back');
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; clearInterval(timer); o.disconnect(); } }).observe(document.body, { childList: true });
    data = await api('/api/pets').catch(e => { toast(e.message); return null; });
    render();
    timer = setInterval(() => { if (data?.pet) { for (const k in data.pet.ready) data.pet.ready[k] = Math.max(0, data.pet.ready[k] - 1000); renderButtons(); } }, 1000);
  }
  const post = async (url, body) => { try { const r = await api(url, { method: 'POST', body }); if (r.pet !== undefined) data.pet = r.pet; if (r.coins != null) { data.coins = r.coins; state.me.coins = r.coins; window.Shop?.counter(); } return r; } catch (e) { toast(e.message); return null; } };
  function render() {
    const box = document.querySelector('.pets');
    if (!box || !data) return;
    if (!data.pet) return renderAdopt(box);
    const p = data.pet;
    const bar = (label, v, cls) => el('div', { class: 'pet-stat' }, el('small', {}, label), el('div', { class: 'prog-bar ' + cls }, el('i', { style: `width:${v}%` })), el('b', {}, v + '%'));
    box.replaceChildren(
      el('div', { class: 'shop-head' }, el('div', {}, el('b', { class: 'pet-title' }, `🐾 ${p.name}`), el('small', {}, `${p.speciesName} · ${p.stageName} · né le ${new Date(p.bornAt).toLocaleDateString('fr-FR')}`)), el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      el('div', { class: 'pet-stage-box mood-' + p.mood },
        el('div', { class: 'pet-big stage-' + p.stage, onclick: () => act('hug') }, el('span', { class: 'pet-emoji' }, p.icon), p.accIcon ? el('span', { class: 'pet-acc' }, p.accIcon) : null),
        el('div', { class: 'pet-mood' }, `${p.moodIcon} ${p.name} ${p.moodText}`)),
      el('div', { class: 'pet-stats' }, bar('🍖 Ventre', p.food, 'food'), bar('💖 Bonheur', p.joy, 'joy'),
        p.nextAt ? el('div', { class: 'pet-stat' }, el('small', {}, `🌱 Vers « ${p.nextName} »`), el('div', { class: 'prog-bar' }, el('i', { style: `width:${Math.min(100, Math.round(p.xp * 100 / p.nextAt))}%` })), el('b', {}, `${p.xp}/${p.nextAt}`)) : el('div', { class: 'pet-stat' }, el('small', {}, '✨ Ton animal est légendaire !'))),
      el('div', { class: 'pet-actions' }),
      el('h3', { class: 'pet-h' }, '🎀 Ses accessoires'),
      el('div', { class: 'isl-menu' },
        el('button', { type: 'button', class: 'isl-dish' + (!p.accessory ? ' on' : ''), onclick: () => post('/api/pets/accessory', { id: '' }).then(render) }, el('span', {}, '🚫'), 'Rien'),
        ...Object.entries(data.accessories).map(([k, a]) => el('button', { type: 'button', class: 'isl-dish' + (p.accessory === k ? ' on' : '') + (p.items.includes(k) ? '' : ' locked'), onclick: async () => {
          if (!p.items.includes(k) && !confirm(`Acheter « ${a.name} » pour ${a.price} pièces ?`)) return;
          const r = await post('/api/pets/accessory', { id: k, buy: !p.items.includes(k) }); if (r) { render(); if (!p.items.includes(k)) LC.confetti([a.icon, '✨']); }
        } }, el('span', {}, a.icon), a.name, p.items.includes(k) ? null : el('small', {}, `${a.price} 💰`)))),
      el('div', { class: 'pet-foot' },
        el('button', { class: 'btn btn-sm', onclick: async () => { const n = prompt('Le nouveau nom de ton animal :', p.name); if (n && await post('/api/pets/rename', { name: n })) render(); } }, '✏️ Changer son nom'),
        el('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { if (!confirm(`Confier ${p.name} à un refuge ? Tu pourras adopter un autre animal, mais ${p.name} partira pour toujours 😢`)) return; if (await post('/api/pets/release')) { data.pet = null; render(); } } }, '🏠 Le confier à un refuge')),
      el('small', { class: 'shop-desc' }, `💡 ${p.name} te suit partout sur l'Île du Paradise 🏝️ ! Son ventre et son bonheur baissent avec le temps : reviens t'en occuper chaque jour pour qu'il grandisse.`));
    renderButtons();
  }
  function renderButtons() {
    const box = document.querySelector('.pets .pet-actions');
    if (!box || !data?.pet) return;
    box.replaceChildren(...Object.entries(data.actions).map(([k, a]) => {
      const wait = data.pet.ready[k] || 0;
      return el('button', { class: 'pet-act' + (wait ? ' wait' : ''), disabled: !!wait, onclick: () => act(k) }, el('span', {}, a.icon), el('b', {}, a.name),
        el('small', {}, wait ? `⏳ ${Math.ceil(wait / 60000)} min` : a.price ? `${a.price} 💰` : 'Prêt !'));
    }));
  }
  async function act(k) {
    const r = await post('/api/pets/act', { action: k });
    if (!r) return;
    const fx = { feed: ['🍖', '😋'], play: ['🎾', '⚽'], hug: ['💖', '💕'], treat: ['🍬', '🍭'] }[k];
    const big = document.querySelector('.pet-big'); if (big) { big.classList.remove('bounce'); void big.offsetWidth; big.classList.add('bounce'); }
    LC.confetti(fx);
    render();
    if (r.grew) toast(`🎉 ${data.pet.name} a grandi : il est maintenant « ${r.grew} » !`);
  }
  function renderAdopt(box) {
    const name = el('input', { class: 'input', maxlength: 20, placeholder: 'Son nom (ex. Rex, Minou, Caramel…)' });
    const draw = () => {
      box.replaceChildren(
        el('div', { class: 'shop-head' }, el('div', {}, el('b', { class: 'pet-title' }, '🐾 Adopte ton animal'), el('small', {}, 'Il te suivra partout sur l\'Île du Paradise')), el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
        el('div', { class: 'shop-body' },
          el('div', { class: 'pet-choose' }, ...Object.entries(data.species).map(([k, s]) => el('button', { type: 'button', class: 'pet-choice' + (pickSpecies === k ? ' on' : ''), onclick: () => { pickSpecies = k; draw(); } },
            el('span', {}, s.icon), el('b', {}, s.name), el('small', {}, s.price ? `${fmt(s.price)} 💰` : 'Gratuit')))),
          el('label', {}, 'Comment veux-tu l\'appeler ?'), name,
          el('button', { class: 'btn btn-primary daily-btn', onclick: async () => {
            const r = await post('/api/pets/adopt', { species: pickSpecies, name: name.value });
            if (!r) return;
            LC.confetti([data.species[pickSpecies].icon, '💖', '✨']); toast(`🎉 Bienvenue à ${r.pet.name} !`); render();
          } }, `🐾 J'adopte ${data.species[pickSpecies].icon}`)));
    };
    draw();
  }
  return { open };
})();
window.Pets = Pets;
