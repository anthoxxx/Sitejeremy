// The Paradise — 👑 Miss & Mister Paradise : l'élection du mois
const Pageant = (() => {
  let tab = 'miss', close = null;
  const left = ts => { const s = Math.max(0, Math.floor((ts - Date.now()) / 1000)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600); return d ? `${d} j ${h} h` : `${h} h ${Math.floor(s % 3600 / 60)} min`; };
  async function open(cat) {
    if (state.me?.isGuest) return toast('Inscris-toi pour participer à l\'élection 👑');
    if (cat) tab = cat;
    let d; try { d = await api('/api/pageant'); } catch (e) { return toast(e.message); }
    if (close) close();
    const box = el('div', { class: 'pg' });
    close = modal(box);
    new MutationObserver((m, o) => { if (!document.body.contains(box)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    render(box, d);
  }
  function render(box, d) {
    const list = d.entries[tab] || [], max = Math.max(1, ...list.map(e => e.votes)), votedFor = d.voted[tab];
    box.replaceChildren(
      el('div', { class: 'pg-head' }, el('div', { class: 'pg-crown' }, '👑'), el('h3', {}, 'Miss & Mister Paradise'), el('small', {}, `Élection du mois · fin dans ${left(d.endsAt)}`), el('button', { class: 'btn btn-sm pg-x', onclick: () => close && close() }, '✕')),
      d.winners ? el('div', { class: 'pg-winners' }, el('small', {}, `🏆 Les gagnants du mois dernier`), el('div', { class: 'pg-win-row' }, ...d.winners.list.map(w => el('div', { class: 'pg-win', onclick: () => openProfile(w.user.id) }, LC.avatar(w.user, true), el('b', {}, w.user.username), el('em', {}, `${w.label} · ${w.votes} votes`))))) : null,
      el('div', { class: 'pg-tabs' }, ...Object.entries(d.cats).map(([k, l]) => el('button', { class: 'pg-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; render(box, d); } }, l, el('span', {}, (d.entries[k] || []).length)))),
      el('p', { class: 'help' }, votedFor ? '✅ Tu as voté aujourd\'hui dans cette catégorie. Reviens demain pour voter encore !' : '🗳️ Tu as 1 vote par jour dans chaque catégorie (+5 💰 pour ton vote). Le gagnant du mois reçoit la couronne, 500 💰 et sa photo sur la page d\'accueil !'),
      list.length ? el('div', { class: 'pg-list' }, ...list.map((e, i) => el('div', { class: 'pg-card' + (i === 0 && e.votes ? ' first' : '') + (votedFor === e.user.id ? ' mine' : '') },
        el('span', { class: 'pg-rank' }, ['🥇', '🥈', '🥉'][i] || i + 1),
        el('div', { class: 'pg-photo', onclick: () => openProfile(e.user.id) }, LC.avatar(e.user, true)),
        el('div', { class: 'pg-info' }, el('b', {}, LC.name(e.user), ' ', LC.heartOf(e.user)), el('div', { class: 'pg-bar' }, el('i', { style: `width:${e.votes / max * 100}%` })), el('small', {}, `${e.votes} vote${e.votes > 1 ? 's' : ''}`)),
        e.user.id === state.me.id ? el('span', { class: 'pg-me' }, 'C\'est toi !') : el('button', { class: 'btn btn-sm ' + (votedFor === e.user.id ? 'btn-ok' : 'btn-primary'), disabled: !!votedFor, onclick: async () => {
          try { await api('/api/pageant/vote', { method: 'POST', body: { to: e.user.id, cat: tab } }); LC.confetti(['🗳️', '👑', '💖']); toast(`🗳️ Tu as voté pour ${e.user.username} !`); d = await api('/api/pageant'); render(box, d); } catch (er) { toast(er.message); }
        } }, votedFor === e.user.id ? '✅ Voté' : '🗳️ Voter')))) : el('p', { class: 'pg-empty' }, 'Personne ne s\'est encore présenté… sois le premier ou la première ! ✨'),
      el('div', { class: 'pg-foot' }, d.mine ? [el('span', {}, `🎀 Tu participes en ${d.cats[d.mine]}`), el('button', { class: 'btn btn-sm', onclick: async () => { if (!confirm('Te retirer de l\'élection ? Tes votes seront perdus.')) return; await api('/api/pageant/withdraw', { method: 'POST' }); d = await api('/api/pageant'); render(box, d); } }, 'Me retirer')]
        : [el('span', {}, '✨ Toi aussi, présente-toi :'), ...Object.entries(d.cats).map(([k, l]) => el('button', { class: 'btn btn-sm btn-primary', onclick: async () => { try { await api('/api/pageant/enter', { method: 'POST', body: { cat: k } }); LC.confetti(['👑', '✨']); toast('👑 Tu es candidat(e) ! Partage ton profil pour avoir des votes'); tab = k; d = await api('/api/pageant'); render(box, d); } catch (er) { toast(er.message); } } }, l))]));
  }
  return { open };
})();
window.Pageant = Pageant;
