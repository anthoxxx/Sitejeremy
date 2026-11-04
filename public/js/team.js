// The Paradise — équipe de modération : bandeau en haut du chat, liste de l'équipe, candidatures
const Team = {
  // Bandeau : l'équipe connectée en ce moment, avec la couleur de chacun
  renderBar() {
    const bar = $('teamBar');
    if (!bar || !state.online) return;
    const staff = state.online.filter(u => ['moderator', 'admin', 'superadmin'].includes(u.role) && !u.ghost)
      .sort((a, b) => LC.rank(b) - LC.rank(a) || (b.modLevel || 0) - (a.modLevel || 0));
    bar.classList.remove('hidden');
    bar.onclick = () => Team.open();
    bar.replaceChildren(
      el('span', { class: 'tb-title' }, '🛡️', el('span', { class: 'lbl2' }, ' Modération en ligne'), ' :'),
      ...(staff.length ? staff.map(u => el('span', { class: 'team-chip', style: '--tc:' + LC.roleColor(u), title: LC.roleName(u) }, LC.avatar(u), u.username, el('span', { class: 'dot' })))
        : [el('span', { style: 'color:var(--muted)' }, 'personne pour le moment')]),
      el('span', { class: 'tb-more' }, 'Voir l\'équipe ›'));
  },

  async open() {
    let d;
    try { d = await api('/api/team'); } catch (e) { return toast(e.message); }
    const groups = [
      ['Administration', LC.STAFF_RED, u => u.role === 'admin' || u.role === 'superadmin', 'Tous les pouvoirs, durées au choix.'],
      ...[3, 2, 1].map(l => {
        const L = d.levels[l];
        return [L.label, L.color, u => u.role === 'moderator' && (u.modLevel || 1) === l,
          `Expulsion ${L.kick ? LC.dur(L.kick) + ' sans revenir' : '(peut revenir)'} · Exclusion ${LC.dur(L.exclusion)} · Bannissement ${LC.dur(L.ban)}`];
      }),
    ];
    const person = u => el('div', { class: 'team-person', onclick: () => { close(); openProfile(u.id); } },
      LC.avatar(u), el('b', { style: 'color:' + (u.color || 'inherit') }, u.username), LC.badge(u),
      el('span', { class: 'st' + (u.online ? ' on' : '') }, u.online ? '🟢 en ligne' : 'hors ligne'));
    const a = d.apply;
    const applyBox = a.allowed ? el('div', { class: 'apply-box' },
      el('b', {}, '🙋 Devenir modérateur'),
      el('p', { class: 'help', style: 'margin:4px 0 8px' }, `Tu peux faire 2 demandes par an (${a.used}/2 utilisée${a.used > 1 ? 's' : ''}).`),
      a.pending ? el('p', { class: 'help' }, '⏳ Ta demande est en cours d\'examen par l\'équipe.')
        : a.used >= 2 ? el('p', { class: 'help' }, `Prochaine demande possible le ${new Date(a.nextAt).toLocaleDateString('fr-FR')}.`)
          : el('button', { class: 'btn btn-primary btn-sm', onclick: () => { close(); Team.apply(a); } }, 'Proposer ma candidature')) : null;
    const close = modal(el('h3', {}, '🛡️ L\'équipe de modération'),
      el('p', { class: 'help', style: 'margin:-4px 0 4px' }, 'Besoin d\'aide ? Clique sur un membre de l\'équipe pour lui écrire.'),
      ...groups.map(([title, color, test, powers]) => {
        const list = d.team.filter(test);
        return el('div', { class: 'team-group', style: '--tc:' + color },
          el('h4', {}, el('span', { class: 'sw' }), title, el('small', { class: 'help' }, `(${list.length})`)),
          el('div', { class: 'powers' }, powers),
          ...(list.length ? list.map(person) : [el('div', { class: 'help' }, 'Personne pour le moment')]));
      }),
      applyBox,
      el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:14px', onclick: () => close() }, 'Fermer'));
  },

  apply(a) {
    const motivation = el('textarea', { class: 'input', rows: 4, maxlength: 1000, placeholder: 'Pourquoi veux-tu rejoindre l\'équipe ? Comment réagirais-tu face à quelqu\'un d\'insultant ?' });
    const availability = el('input', { class: 'input', maxlength: 200, placeholder: 'Ex. : tous les soirs de 20 h à minuit, le week-end…' });
    const experience = el('textarea', { class: 'input', rows: 2, maxlength: 600, placeholder: 'As-tu déjà modéré un chat, un serveur Discord… ? (facultatif)' });
    const err = el('div', { class: 'error' });
    const close = modal(el('h3', {}, '🙋 Candidature de modérateur'),
      el('p', { class: 'help', style: 'margin:-4px 0 10px' }, `Demande ${a.used + 1}/2 cette année. Un administrateur te répondra par notification.`),
      el('div', { class: 'field' }, el('label', {}, 'Ta motivation'), motivation),
      el('div', { class: 'field' }, el('label', {}, 'Tes disponibilités'), availability),
      el('div', { class: 'field' }, el('label', {}, 'Ton expérience'), experience),
      err,
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          err.textContent = '';
          try {
            await api('/api/team/apply', { method: 'POST', body: { motivation: motivation.value, availability: availability.value, experience: experience.value } });
            close(); toast('🙋 Candidature envoyée ! L\'équipe te répondra par notification.');
          } catch (e) { err.textContent = e.message; }
        } }, 'Envoyer ma candidature')));
    motivation.focus();
  },
};
