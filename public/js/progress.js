// The Paradise — Quêtes du jour 🎯, Succès 🏆 et Niveaux ⭐ (côté navigateur)
const Progress = (() => {
  let data = null, tab = 'quests', close = null;
  async function load() { try { data = await api('/api/progress'); badge(); return data; } catch (e) { return null; } }
  // La petite pastille sur le bouton 🎯 : combien de quêtes restent à faire aujourd'hui
  function badge() {
    const b = $('questBtn'); if (!b || !data) return;
    const left = data.quests.filter(q => !q.done).length;
    b.querySelector('.notif-count').textContent = left;
    b.querySelector('.notif-count').classList.toggle('hidden', !left);
  }
  async function open(which = 'quests') {
    if (state.me?.isGuest) return toast('Inscris-toi pour avoir des quêtes et des succès 🎯');
    tab = which;
    if (close) close();
    const box = el('div', { class: 'prog' }, el('div', { class: 'isl-wait' }, 'Chargement…'));
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back');
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; o.disconnect(); } }).observe(document.body, { childList: true });
    await load(); render();
  }
  function render() {
    const box = document.querySelector('.prog');
    if (!box || !data) return;
    const pct = Math.round(data.into * 100 / data.need);
    box.replaceChildren(
      el('div', { class: 'shop-head prog-head' },
        el('div', { class: 'prog-lvl' }, el('span', {}, '⭐'), el('b', {}, data.level)),
        el('div', { class: 'prog-xp' }, el('b', {}, `Niveau ${data.level}`), el('div', { class: 'prog-bar' }, el('i', { style: `width:${pct}%` })), el('small', {}, `${data.into} / ${data.need} XP pour le niveau ${data.level + 1}`)),
        el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      el('div', { class: 'shop-tabs' }, ...[['quests', '🎯 Quêtes du jour'], ['ach', `🏆 Succès ${data.unlocked}/${data.total}`], ['how', '💡 Gagner de l\'XP']].map(([k, l]) => el('button', { class: 'shop-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; render(); } }, l))),
      el('div', { class: 'shop-body' }, ...(tab === 'quests' ? quests() : tab === 'ach' ? achievements() : how())));
  }
  function quests() {
    const all = data.quests.every(q => q.done);
    return [
      el('small', { class: 'shop-desc' }, 'Chaque jour, 3 nouvelles quêtes (elles changent à minuit). Réussis les 3 pour gagner 50 pièces bonus 💰'),
      ...data.quests.map(q => el('div', { class: 'quest' + (q.done ? ' done' : '') },
        el('span', { class: 'quest-ico' }, q.done ? '✅' : q.icon),
        el('div', { class: 'quest-txt' }, el('b', {}, q.text), el('div', { class: 'prog-bar' }, el('i', { style: `width:${Math.round(q.progress * 100 / q.goal)}%` })), el('small', {}, `${q.progress} / ${q.goal}`)),
        el('span', { class: 'quest-gain' }, `+${q.coins} 💰`, el('small', {}, `+${q.xp} XP`)))),
      all ? el('div', { class: 'quest-all' }, '🎉 Bravo, toutes les quêtes du jour sont réussies ! Reviens demain') : null,
    ];
  }
  function achievements() {
    const list = [...data.achievements].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0));
    return [el('div', { class: 'ach-grid' }, ...list.map(a => el('div', { class: 'ach' + (a.unlocked ? ' on' : '') },
      el('span', { class: 'ach-ico' }, a.unlocked ? a.icon : '🔒'), el('b', {}, a.name), el('small', {}, a.desc),
      a.unlocked ? el('small', { class: 'ach-date' }, `✅ ${new Date(a.unlocked).toLocaleDateString('fr-FR')}`) : el('div', { class: 'prog-bar' }, el('i', { style: `width:${Math.round(a.progress * 100 / a.goal)}%` })),
      el('small', { class: 'ach-gain' }, `+${a.coins} 💰`))))];
  }
  function how() {
    return [el('div', { class: 'earn' }, ...[
      ['💬', 'Discuter', '1 XP par message'], ['🏆', 'Gagner aux jeux', '25 XP par victoire, 5 XP par partie'], ['⚽', 'Le babyfoot', '15 XP par victoire'],
      ['🏝️', 'L\'Île du Paradise', 'Se promener, visiter les lieux et les maisons, danser, commander au café'], ['🐾', 'Ton animal', '2 XP à chaque repas, jeu ou câlin'],
      ['🎯', 'Les quêtes du jour', '20 à 50 XP par quête'], ['🏆', 'Les succès', '40 XP par succès débloqué'], ['🎁', 'Le bonus du jour', '10 XP'],
    ].map(([i, t, d]) => el('div', { class: 'earn-row' }, el('span', {}, i), el('div', {}, el('b', {}, t), el('small', {}, d))))),
    el('small', { class: 'shop-desc' }, 'À chaque niveau gagné, tu reçois des pièces (niveau × 10) 💰 Ton niveau est affiché sur ton profil.')];
  }

  // Les annonces en direct
  socket.on('progress', d => { if (data) { Object.assign(data, d); if (close) render(); } });
  socket.on('quest', d => { const q = data?.quests.find(x => x.id === d.id); if (q) { q.progress = d.progress; q.done = d.done; badge(); if (close) render(); } });
  socket.on('quest_done', q => { toast(`🎯 Quête réussie : ${q.text} · +${q.coins} 💰`, () => open('quests')); LC.confetti(['🎯', '💰', '✨']); });
  socket.on('achievement', a => { celebrate(a.icon, 'Succès débloqué !', a.name, a.desc); load().then(() => close && render()); });
  socket.on('level_up', d => celebrate('⭐', `Niveau ${d.level} !`, 'Tu montes de niveau', `+${d.gift} pièces 💰`));
  function celebrate(icon, title, name, desc) {
    document.querySelector('.celebrate')?.remove();
    const c = el('div', { class: 'celebrate', onclick: () => c.remove() }, el('span', { class: 'cel-ico' }, icon), el('div', {}, el('small', {}, title), el('b', {}, name), el('span', {}, desc)));
    document.body.append(c); setTimeout(() => c.remove(), 5000);
    LC.confetti([icon, '✨', '🎉']);
  }
  return { open, load, badge };
})();
window.Progress = Progress;
$('questBtn').onclick = () => Progress.open();
