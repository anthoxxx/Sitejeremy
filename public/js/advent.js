// The Paradise — 🎄 Le Calendrier de l'Avent : une case à ouvrir chaque jour du 1er au 24 décembre
const Advent = (() => {
  // l'ordre des cases sur le calendrier (mélangées comme un vrai calendrier)
  const ORDER = [7, 19, 2, 13, 24, 5, 16, 10, 1, 22, 8, 14, 3, 18, 11, 23, 6, 15, 20, 4, 12, 9, 21, 17];
  let close = null;
  async function open() {
    if (state.me?.isGuest) return toast('Inscris-toi pour ouvrir le Calendrier de l\'Avent 🎄');
    let d; try { d = await api('/api/advent'); } catch (e) { return toast(e.message); }
    if (close) close();
    const box = el('div', { class: 'adv' });
    close = modal(box); box.closest('.modal-back')?.classList.add('adv-back');
    new MutationObserver((m, o) => { if (!document.body.contains(box)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    render(box, d);
  }
  function render(box, d) {
    const now = new Date(), dec1 = new Date(now.getFullYear(), 11, 1), days = Math.ceil((dec1 - now) / 86400000);
    box.replaceChildren(
      el('div', { class: 'adv-head' }, el('h3', {}, '🎄 Le Calendrier de l\'Avent'), el('small', {}, d.live ? `Nous sommes le ${d.today} décembre : ouvre ta case du jour ! 🎁` : `Il s'ouvre le 1er décembre : encore ${days} jour${days > 1 ? 's' : ''} ⏳`), el('button', { class: 'btn btn-sm adv-x', onclick: () => close && close() }, '✕')),
      el('div', { class: 'adv-grid' }, ...ORDER.map(n => {
        const c = d.days[n - 1], isToday = d.live && n === d.today, locked = !d.live || n > d.today;
        return el('button', { class: 'adv-door' + (c.opened ? ' open' : '') + (isToday && !c.opened ? ' today' : '') + (c.missed ? ' missed' : '') + (n === 24 ? ' big' : ''), disabled: c.opened || locked || c.missed, title: c.opened ? c.gift.name : c.missed ? 'Case ratée 😢' : locked ? `S'ouvre le ${n} décembre` : 'Ouvre-moi !',
          onclick: async e => {
            const b = e.currentTarget; b.classList.add('opening');
            try { const r = await api('/api/advent/open', { method: 'POST', body: { day: n } }); setTimeout(() => { reveal(r.gift, n); api('/api/advent').then(nd => render(box, nd)).catch(() => {}); }, 650); }
            catch (er) { b.classList.remove('opening'); toast(er.message); }
          } },
          el('span', { class: 'adv-num' }, n), c.opened ? el('span', { class: 'adv-gift' }, c.gift.icon) : c.missed ? el('span', { class: 'adv-gift' }, '😢') : locked ? null : el('span', { class: 'adv-shine' }, '✨'));
      })),
      el('p', { class: 'help', style: 'text-align:center' }, '🎁 Une case par jour, à ouvrir le jour même : pièces, sapin et bonhomme de neige pour ta maison, bonnet de Père Noël… et un énorme cadeau le 24 !'));
  }
  function reveal(g, n) {
    LC.confetti(['🎁', '🎄', '⭐', '❄️', g.icon]);
    try { navigator.vibrate?.([80, 60, 80]); } catch (e) {}
    modal(el('div', { class: 'adv-reveal' }, el('div', { class: 'adv-reveal-ico' }, g.icon), el('h3', {}, `Case du ${n} décembre`), el('p', {}, g.name),
      g.type === 'item' ? el('p', { class: 'help' }, '🏠 Il t\'attend dans ta maison : bouton « ➕ Ajouter un meuble » quand tu ranges ta maison') : g.type === 'look' ? el('p', { class: 'help' }, '🧍 Mets-le dans « Mon personnage » → Accessoires') : g.type === 'badge' ? el('p', { class: 'help' }, '🎅 Il est déjà à côté de ton pseudo. Joyeux Noël !') : null));
    api('/api/me').then(d => { Object.assign(state.me, d.user); renderMe?.(); }).catch(() => {}); // pour que le nouveau meuble / badge soit à toi tout de suite
  }
  // 🎁 en décembre, on rappelle la case du jour à l'arrivée sur le site
  document.addEventListener('site', e => {
    const s = e.detail; if (!s?.xmas || state.me?.isGuest || window.__advTold) return; window.__advTold = true;
    setTimeout(() => api('/api/advent').then(d => { if (d.live && !d.days[d.today - 1]?.opened && d.today <= 24) toast(`🎄 Ta case du ${d.today} décembre t'attend dans le Calendrier de l'Avent !`, () => open()); }).catch(() => {}), 3500);
  });
  return { open };
})();
window.Advent = Advent;
