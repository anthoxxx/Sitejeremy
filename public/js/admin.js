// The Paradise — panneau d'administration
const { el, api } = LC;
const page = document.getElementById('page');
let me = null;
const isAdmin = () => LC.isAdminRole(me);
const isSuper = () => me && me.role === 'superadmin';

function toast(text) {
  const t = el('div', { class: 'toast', onclick: () => t.remove() }, text);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 4000);
}
async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast('✅ ' + okMsg); return r; } catch (e) { toast('❌ ' + e.message); throw e; }
}
const header = (title, sub) => [el('h1', {}, title), el('p', { class: 'subtitle' }, sub)];
const roleLabel = LC.roleLabel;

// ---------- Navigation ----------
const pages = { dashboard, users, reports, messages, rooms, radios, settings, site, backups, codes, logs };
function go() {
  let name = location.hash.slice(1) || 'dashboard';
  if (!pages[name] || (!isAdmin() && ['rooms', 'radios', 'settings'].includes(name)) || (!isSuper() && ['site', 'backups', 'codes'].includes(name))) name = 'dashboard';
  document.querySelectorAll('#nav [data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === name));
  page.replaceChildren(el('p', { class: 'empty' }, 'Chargement…'));
  pages[name]().catch(e => page.replaceChildren(el('p', { class: 'empty' }, e.message)));
}
document.querySelectorAll('#nav [data-page]').forEach(x => x.onclick = () => { location.hash = x.dataset.page; });
window.addEventListener('hashchange', go);

// ---------- Tableau de bord ----------
async function dashboard() {
  const s = await api('/api/admin/stats');
  updateReportBadge(s.openReports);
  const kpi = (label, value) => el('div', { class: 'kpi' }, el('span', {}, label), el('b', {}, value));
  const max = Math.max(1, ...s.rooms.map(r => r.count));
  const text = el('input', { class: 'input', maxlength: 300, placeholder: 'Message à envoyer à tous les connectés…' });
  page.replaceChildren(
    ...header('Tableau de bord', `Bonjour ${s.me.username} 👋 Voici l'activité de The Paradise.`),
    el('div', { class: 'kpis' },
      kpi('🟢 En ligne', s.online), kpi('👤 Membres', s.members), kpi('🎭 Invités', s.guests),
      kpi('✨ Nouveaux (24 h)', s.newToday), kpi('💬 Messages (24 h)', s.messagesToday), kpi('💌 Privés (24 h)', s.pmToday),
      kpi('⚠️ Signalements', s.openReports), kpi('⛔ Bannis', s.banned)),
    el('div', { class: 'panel' }, el('h2', {}, '📢 Annonce instantanée'),
      el('div', { class: 'toolbar' }, text,
        el('button', { class: 'btn btn-primary', onclick: async () => { await run(() => api('/api/admin/broadcast', { method: 'POST', body: { text: text.value } }), 'Annonce envoyée'); text.value = ''; } }, 'Envoyer à tous'))),
    el('div', { class: 'panel' }, el('h2', {}, '🏠 Fréquentation des salons'),
      ...s.rooms.map(r => el('div', { style: 'margin-bottom:12px' },
        el('div', { style: 'display:flex;justify-content:space-between;margin-bottom:5px;font-size:.9rem' }, el('span', {}, `${r.icon} ${r.name}`), el('b', {}, r.count)),
        el('div', { class: 'bar' }, el('i', { style: `width:${(r.count / max) * 100}%` }))))));
}
function updateReportBadge(n) {
  const b = document.getElementById('navReports');
  b.textContent = n; b.classList.toggle('hidden', !n);
}

// ---------- Utilisateurs ----------
const usersState = { q: '', filter: 'all', page: 0 };
async function users() {
  const search = el('input', { class: 'input', placeholder: 'Rechercher un pseudo…', value: usersState.q });
  const filter = el('select', { class: 'input', style: 'max-width:190px' },
    ...[['all', 'Tous'], ['online', 'En ligne'], ['members', 'Membres'], ['guests', 'Invités'], ['staff', 'Équipe'], ['unverified', '🛂 À vérifier'], ['banned', 'Bannis']]
      .map(([v, l]) => el('option', { value: v, selected: usersState.filter === v }, l)));
  const tableBox = el('div', { class: 'table-wrap' });
  const pager = el('div', { class: 'pager' });
  page.replaceChildren(...header('Utilisateurs', 'Gère les comptes, les rôles et les sanctions.'),
    el('div', { class: 'panel' }, el('div', { class: 'toolbar' }, search, filter), tableBox, pager));

  let timer;
  search.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { usersState.q = search.value; usersState.page = 0; load(); }, 250); };
  filter.onchange = () => { usersState.filter = filter.value; usersState.page = 0; load(); };

  async function load() {
    const d = await api(`/api/admin/users?q=${encodeURIComponent(usersState.q)}&filter=${usersState.filter}&page=${usersState.page}`);
    if (!d.users.length) { tableBox.replaceChildren(el('p', { class: 'empty' }, 'Aucun utilisateur trouvé')); pager.replaceChildren(); return; }
    tableBox.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Utilisateur', 'Profil', 'Rôle', 'Statut', 'Inscrit le', 'Actions'].map(h => el('th', {}, h)))),
      el('tbody', {}, ...d.users.map(userRow))));
    const pages = Math.ceil(d.total / 25);
    pager.replaceChildren(
      el('button', { class: 'btn btn-sm', disabled: usersState.page === 0, onclick: () => { usersState.page--; load(); } }, '←'),
      `Page ${d.page + 1} / ${pages} · ${d.total} utilisateur(s)`,
      el('button', { class: 'btn btn-sm', disabled: usersState.page + 1 >= pages, onclick: () => { usersState.page++; load(); } }, '→'));
  }

  function userRow(u) {
    const self = u.id === me.id;
    const canAct = !self && (isSuper() || LC.rank(me) > LC.rank(u));
    const muted = u.mutedUntil && u.mutedUntil > Date.now();
    const status = u.banned ? el('span', { class: 'status-ban', title: u.banReason }, '⛔ Banni')
      : u.online ? el('span', { class: 'status-on' }, '🟢 En ligne') : el('span', { style: 'color:var(--muted)' }, 'Hors ligne');
    // Le super-admin peut donner tous les rôles ; un admin seulement membre / modérateur
    const assignable = isSuper() ? LC.ROLES : LC.ROLES.filter(r => LC.ROLES.indexOf(r) < LC.rank(me));
    const role = isAdmin() && canAct && !u.isGuest
      ? el('select', { class: 'input', style: 'padding:6px 8px;width:auto', onchange: async e => {
        if (e.target.value === 'superadmin' && !confirm(`Donner le rôle SUPER-ADMIN à ${u.username} ? Il pourra tout modifier sur le site, y compris toi.`)) { e.target.value = u.role; return; }
        await run(() => api('/api/admin/users/' + u.id, { method: 'PATCH', body: { role: e.target.value } }), 'Rôle modifié (notifié)').catch(() => {}); load();
      } }, ...assignable.map(r => el('option', { value: r, selected: u.role === r }, roleLabel(r))))
      : el('span', {}, u.isGuest ? 'Invité' : roleLabel(u.role));
    return el('tr', {},
      el('td', {}, el('div', { style: 'display:flex;gap:10px;align-items:center' }, LC.avatar(u), el('div', {}, el('b', {}, u.username), ' ', LC.badge(u),
        el('div', { style: 'color:var(--muted);font-size:.78rem' }, 'Vu : ' + LC.date(u.lastSeen)),
        u.linkedAccounts ? el('div', { style: 'color:var(--gold);font-size:.78rem', title: 'Comptes créés depuis le même appareil ou la même connexion' }, `🔗 ${u.linkedAccounts} autre(s) compte(s) lié(s)`) : null))),
      el('td', {}, `${LC.genderIcon(u.gender)} ${u.age || '?'} ans${u.city ? ' · ' + u.city : ''}`),
      el('td', {}, role),
      el('td', {}, status, !u.verified && u.role === 'user' ? el('div', { style: 'font-size:.78rem;color:#4fb3ff' }, '🛂 à vérifier') : null, muted ? el('div', { style: 'font-size:.78rem;color:var(--gold)' }, '🔇 muet') : null),
      el('td', {}, LC.date(u.createdAt)),
      el('td', {},
        el('button', { class: 'btn btn-sm', onclick: () => showHistory(u) }, '📄'),
        !u.verified && u.role === 'user' ? el('button', { class: 'btn btn-sm btn-primary', title: 'Valider : il passe la douane', onclick: async () => { await run(() => api('/api/customs/verify/' + u.id, { method: 'POST', body: { verified: true } }), `${u.username} a passé la douane`); load(); } }, '✅ Valider') : null,
        canAct ? [
          el('button', { class: 'btn btn-sm btn-danger', title: 'Sanctionner (avertir, muet, expulser, bannir)', onclick: () => LC.sanctionModal(u, { toast, onDone: load }) }, '🛡️ Sanctionner'),
          muted ? el('button', { class: 'btn btn-sm', title: 'Rendre la parole', onclick: async () => { await run(() => api(`/api/admin/users/${u.id}/mute`, { method: 'POST', body: { minutes: 0 } }), 'Parole rendue (notifié)'); load(); } }, '🔊') : null,
          u.banned ? el('button', { class: 'btn btn-sm', onclick: async () => { await run(() => api('/api/admin/users/' + u.id, { method: 'PATCH', body: { banned: false } }), 'Débanni (notifié)'); load(); } }, '✅ Débannir') : null,
          el('button', { class: 'btn btn-sm', title: 'Réinitialiser le profil (photo, bannière, bio…)', onclick: async () => { if (confirm(`Effacer la photo, la bannière, la bio et les infos de profil de ${u.username} ?`)) { await run(() => api(`/api/admin/users/${u.id}/reset-profile`, { method: 'POST' }), 'Profil réinitialisé'); load(); } } }, '🧹'),
          isAdmin() ? el('button', { class: 'btn btn-sm btn-danger', title: 'Supprimer le compte', onclick: async () => { if (confirm(`Supprimer définitivement ${u.username} et tous ses messages ?`)) { await run(() => api('/api/admin/users/' + u.id, { method: 'DELETE' }), 'Compte supprimé'); load(); } } }, '🗑') : null,
        ] : null));
  }
  await load();
}

async function showHistory(u) {
  const { messages } = await run(() => api(`/api/admin/users/${u.id}/messages`));
  const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } },
    el('div', { class: 'card modal', style: 'max-width:600px' },
      el('h3', {}, 'Derniers messages de ' + u.username),
      messages.length ? el('div', {}, ...messages.map(m => el('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' },
        el('div', { style: 'font-size:.78rem;color:var(--muted)' }, `${m.room} · ${LC.date(m.createdAt)}`), el('div', {}, m.content))))
        : el('p', { class: 'empty' }, 'Aucun message public'),
      el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:14px', onclick: () => back.remove() }, 'Fermer')));
  document.body.append(back);
}

// ---------- Signalements ----------
async function reports() {
  let status = 'open';
  const box = el('div', { class: 'table-wrap' });
  const tabs = el('div', { class: 'filters', style: 'max-width:300px;margin:0 0 14px' },
    el('button', { class: 'active', 'data-s': 'open' }, 'Ouverts'), el('button', { 'data-s': 'closed' }, 'Traités'));
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => { status = b.dataset.s; tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); load(); });
  page.replaceChildren(...header('Signalements', 'Les alertes envoyées par les utilisateurs.'), el('div', { class: 'panel' }, tabs, box));
  async function load() {
    const { reports } = await api('/api/admin/reports?status=' + status);
    if (status === 'open') updateReportBadge(reports.length);
    if (!reports.length) return box.replaceChildren(el('p', { class: 'empty' }, status === 'open' ? '🎉 Aucun signalement en attente' : 'Aucun signalement traité'));
    box.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Date', 'Par', 'Contre', 'Raison', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, ...reports.map(r => el('tr', {},
        el('td', {}, LC.date(r.createdAt)), el('td', {}, r.reporter || '—'), el('td', {}, el('b', {}, r.target || '—')),
        el('td', { style: 'max-width:380px' }, r.reason),
        el('td', {},
          r.target ? el('button', { class: 'btn btn-sm', onclick: () => { usersState.q = r.target; usersState.filter = 'all'; location.hash = 'users'; } }, '👤 Voir') : null,
          el('button', { class: 'btn btn-sm' + (status === 'open' ? ' btn-primary' : ''), onclick: async () => { await run(() => api('/api/admin/reports/' + r.id, { method: 'PATCH', body: { status: status === 'open' ? 'closed' : 'open' } }), 'Mis à jour'); load(); } },
            status === 'open' ? '✓ Traité' : '↺ Rouvrir')))))));
  }
  await load();
}

// ---------- Messages ----------
async function messages() {
  const search = el('input', { class: 'input', placeholder: 'Rechercher un mot ou un pseudo…' });
  const box = el('div', { class: 'table-wrap' });
  page.replaceChildren(...header('Messages', 'Les 100 derniers messages publics, avec recherche.'),
    el('div', { class: 'panel' }, el('div', { class: 'toolbar' }, search), box));
  let timer;
  search.oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  async function load() {
    const { messages } = await api('/api/admin/messages?q=' + encodeURIComponent(search.value));
    if (!messages.length) return box.replaceChildren(el('p', { class: 'empty' }, 'Aucun message'));
    box.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Date', 'Salon', 'Auteur', 'Message', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, ...messages.map(m => el('tr', {},
        el('td', { style: 'white-space:nowrap' }, LC.date(m.createdAt)), el('td', {}, m.room), el('td', {}, el('b', {}, m.username)),
        el('td', { style: 'max-width:420px;overflow-wrap:anywhere' }, m.content),
        el('td', {}, el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { await run(() => api('/api/admin/messages/' + m.id, { method: 'DELETE' }), 'Message supprimé'); load(); } }, '🗑')))))));
  }
  await load();
}

// ---------- Salons ----------
async function rooms() {
  const { rooms } = await api('/api/admin/rooms');
  const form = roomForm({}, async body => { await run(() => api('/api/admin/rooms', { method: 'POST', body }), 'Salon créé'); rooms_(); });
  page.replaceChildren(...header('Salons', 'Crée, modifie, réordonne ou supprime les salons.'),
    el('div', { class: 'panel' }, el('h2', {}, '➕ Nouveau salon'), form),
    el('div', { class: 'panel' }, el('h2', {}, 'Salons existants'), el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['', 'Nom', 'Description', 'Ordre', 'Accès', 'Connectés', 'Vocal', 'Actions'].map(h => el('th', {}, h)))),
      el('tbody', {}, ...rooms.map(r => el('tr', {},
        el('td', { style: 'font-size:1.3rem' }, r.icon), el('td', {}, el('b', {}, r.name), el('div', { style: 'font-size:.75rem;color:var(--muted)' }, '#' + r.slug)),
        el('td', {}, r.description, r.station ? el('div', { style: 'font-size:.75rem;color:var(--muted)' }, '📻 ' + r.station.name) : null),
        el('td', {}, r.ownerId ? '—' : r.sort),
        el('td', {}, r.ownerId ? `${r.temporary ? '⏳ temporaire' : '📌 permanent'} · 👑 ${r.ownerName}${r.isPrivate ? ' · 🔒 fermé' : ''}` : r.membersOnly ? '💎 Membres' : 'Tous'),
        el('td', {}, r.count), el('td', {}, r.voiceEnabled ? `🎙️ ${r.voice}` : 'off'),
        el('td', {},
          el('button', { class: 'btn btn-sm', title: 'Modifier', onclick: () => editRoom(r) }, '✏️'),
          el('button', { class: 'btn btn-sm', title: 'Vider les messages', onclick: async () => { if (confirm(`Vider tous les messages de ${r.name} ?`)) await run(() => api(`/api/admin/rooms/${r.id}/messages`, { method: 'DELETE' }), 'Salon vidé'); } }, '🧹'),
          el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (confirm(`Supprimer le salon ${r.name} ?`)) { await run(() => api('/api/admin/rooms/' + r.id, { method: 'DELETE' }), 'Salon supprimé'); rooms_(); } } }, '🗑')))))))));
}

// ---------- Radios ----------
async function radios() {
  const { stations, checking } = await api('/api/admin/stations');
  const preview = new Audio();
  const statusOf = st => st.status === 'ok' ? el('span', { class: 'status-on', title: st.check_note }, '✅ Marche')
    : st.status === 'broken' ? el('span', { class: 'status-ban', title: st.check_note }, '❌ En panne (masquée)')
    : el('span', { style: 'color:var(--muted)' }, '❔ Pas encore testée');
  const checkBtn = el('button', { class: 'btn btn-primary', disabled: checking, onclick: async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = '⏳ Vérification en cours (1 à 2 minutes)…';
    try {
      const { report } = await api('/api/admin/stations/check', { method: 'POST', body: { repair: true } });
      toast(`📻 ${report.ok} radio(s) OK · ${report.repaired.length} réparée(s) · ${report.broken.length} en panne (masquée(s))`);
    } catch (e) { toast('❌ ' + e.message); }
    radios();
  } }, checking ? '⏳ Vérification en cours…' : '🔍 Vérifier et réparer toutes les radios');
  let previewId = null;
  const form = (st, onSave) => {
    const icon = el('input', { class: 'input', maxlength: 4, value: st.icon || '📻', style: 'max-width:70px' });
    const name = el('input', { class: 'input', maxlength: 40, placeholder: 'Nom (ex : NRJ)', value: st.name || '' });
    const url = el('input', { class: 'input', placeholder: 'Lien du flux https://…', value: st.url || '', style: 'min-width:260px;flex:2' });
    const genre = el('input', { class: 'input', maxlength: 40, placeholder: 'Style', value: st.genre || '' });
    const sort = el('input', { class: 'input', type: 'number', value: st.sort ?? 20, style: 'max-width:80px', title: 'Ordre' });
    return el('div', { class: 'toolbar' }, icon, name, url, genre, sort,
      el('button', { class: 'btn btn-primary', onclick: () => onSave({ icon: icon.value, name: name.value, url: url.value, genre: genre.value, sort: sort.value }) }, st.id ? 'Enregistrer' : 'Ajouter'));
  };
  const test = (st, btn) => {
    if (previewId === st.id) { preview.pause(); previewId = null; btn.textContent = '▶ Tester'; return; }
    previewId = st.id; preview.src = st.url;
    document.querySelectorAll('.test-btn').forEach(b => { b.textContent = '▶ Tester'; });
    btn.textContent = '⏳';
    preview.play().then(() => { btn.textContent = '⏸ Stop'; }).catch(() => { btn.textContent = '❌ Ne marche pas'; previewId = null; });
  };
  page.replaceChildren(...header('Radios', 'Les radios que tout le monde peut écouter dans le lecteur et mettre dans les salons.'),
    el('div', { class: 'panel' }, el('h2', {}, '➕ Ajouter une radio'), form({}, async body => { await run(() => api('/api/admin/stations', { method: 'POST', body }), 'Radio ajoutée'); radios(); }),
      el('p', { style: 'color:var(--muted);font-size:.85rem;margin:6px 0 0' }, 'Astuce : le lien doit être un flux audio direct (mp3/aac) en https. Tu trouves les liens officiels sur le site de chaque radio ou sur radio-browser.info.')),
    el('div', { class: 'panel' }, el('h2', {}, '🩺 État des radios'),
      el('p', { class: 'help', style: 'margin:0 0 12px' }, 'Le site teste chaque radio au démarrage puis toutes les 6 heures. Une radio qui ne marche plus est réparée automatiquement si un nouveau lien officiel est trouvé, sinon elle est masquée pour les utilisateurs (tu peux corriger son lien à la main).'),
      checkBtn,
      el('p', { class: 'help', style: 'margin:10px 0 0' }, `✅ ${stations.filter(x => x.status === 'ok').length} qui marchent · ❌ ${stations.filter(x => x.status === 'broken').length} en panne · ❔ ${stations.filter(x => !x.status || x.status === 'unknown').length} pas encore testées`)),
    el('div', { class: 'panel' }, el('h2', {}, `📻 ${stations.length} radio(s)`),
      stations.length ? el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ...['', 'Nom', 'Style', 'État', 'Lien', 'Actions'].map(h => el('th', {}, h)))),
        el('tbody', {}, ...stations.map(st => {
          const testBtn = el('button', { class: 'btn btn-sm test-btn' }, '▶ Tester');
          testBtn.onclick = () => test(st, testBtn);
          return el('tr', {},
            el('td', { style: 'font-size:1.3rem' }, st.icon), el('td', {}, el('b', {}, st.name)), el('td', {}, st.genre),
            el('td', {}, statusOf(st), st.checked_at ? el('div', { class: 'help' }, LC.date(st.checked_at)) : null, st.check_note && st.status === 'broken' ? el('div', { class: 'help' }, st.check_note) : null),
            el('td', { style: 'max-width:280px;overflow-wrap:anywhere;font-size:.8rem;color:var(--muted)' }, st.url),
            el('td', {}, testBtn,
              el('button', { class: 'btn btn-sm', title: 'Vérifier / réparer cette radio', onclick: async e => {
                e.target.textContent = '⏳';
                try { const { report } = await api('/api/admin/stations/check', { method: 'POST', body: { ids: [st.id] } }); toast(report.ok ? '✅ Elle marche' : report.repaired.length ? '🔧 Réparée !' : '❌ En panne, masquée'); } catch (err) { toast('❌ ' + err.message); }
                radios();
              } }, '🩺'),
              el('button', { class: 'btn btn-sm', onclick: () => {
                const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } });
                back.append(el('div', { class: 'card modal', style: 'max-width:820px' }, el('h3', {}, 'Modifier ' + st.name),
                  form(st, async body => { await run(() => api('/api/admin/stations/' + st.id, { method: 'PATCH', body }), 'Radio modifiée'); back.remove(); radios(); })));
                document.body.append(back);
              } }, '✏️'),
              el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (confirm(`Supprimer ${st.name} ?`)) { await run(() => api('/api/admin/stations/' + st.id, { method: 'DELETE' }), 'Radio supprimée'); radios(); } } }, '🗑')));
        })))) : el('p', { class: 'empty' }, 'Aucune radio')));
  window.addEventListener('hashchange', () => preview.pause(), { once: true });
}
const rooms_ = () => rooms().catch(() => {});
function roomForm(r, onSave) {
  const icon = el('input', { class: 'input', maxlength: 4, value: r.icon || '💬', style: 'max-width:80px' });
  const name = el('input', { class: 'input', maxlength: 30, placeholder: 'Nom du salon', value: r.name || '' });
  const desc = el('input', { class: 'input', maxlength: 120, placeholder: 'Description', value: r.description || '' });
  const sort = el('input', { class: 'input', type: 'number', value: r.sort ?? 10, style: 'max-width:90px', title: 'Ordre' });
  const members = el('input', { type: 'checkbox', checked: !!r.membersOnly });
  return el('div', { class: 'toolbar' }, icon, name, desc, sort,
    el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:.9rem' }, members, 'Membres seulement'),
    el('button', { class: 'btn btn-primary', onclick: () => onSave({ icon: icon.value, name: name.value, description: desc.value, sort: sort.value, membersOnly: members.checked }) }, r.id ? 'Enregistrer' : 'Créer'));
}
function editRoom(r) {
  const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } });
  back.append(el('div', { class: 'card modal', style: 'max-width:720px' }, el('h3', {}, 'Modifier ' + r.name),
    roomForm(r, async body => { await run(() => api('/api/admin/rooms/' + r.id, { method: 'PATCH', body }), 'Salon modifié'); back.remove(); rooms_(); })));
  document.body.append(back);
}

// ---------- Réglages ----------
async function settings() {
  const { settings: s } = await api('/api/admin/settings');
  const announcement = el('textarea', { class: 'input', rows: 2, maxlength: 300, placeholder: 'Affichée en haut de chaque salon (laisser vide pour aucune)' }, s.announcement);
  const words = el('textarea', { class: 'input', rows: 3, placeholder: 'mot1, mot2, mot3…' }, s.bannedWords);
  const guests = el('input', { type: 'checkbox', checked: s.guestsAllowed === '1' });
  const reg = el('input', { type: 'checkbox', checked: s.registrationOpen === '1' });
  const minAge = el('input', { class: 'input', type: 'number', min: 13, max: 99, value: s.minAge, style: 'max-width:100px' });
  const voiceOn = el('input', { type: 'checkbox', checked: s.voiceEnabled === '1' });
  const voiceMax = el('input', { class: 'input', type: 'number', min: 2, max: 20, value: s.voiceMax, style: 'max-width:100px' });
  const userRooms = el('input', { type: 'checkbox', checked: s.userRoomsEnabled === '1' });
  const maxRooms = el('input', { class: 'input', type: 'number', min: 0, max: 20, value: s.maxUserRooms, style: 'max-width:100px' });
  const tempOn = el('input', { type: 'checkbox', checked: s.tempRoomsEnabled !== '0' });
  const customsOnBox = el('input', { type: 'checkbox', checked: s.customsEnabled === '1' });
  const tempMin = el('input', { class: 'input', type: 'number', min: 1, max: 1440, value: s.tempRoomMinutes || 5, style: 'max-width:100px' });
  page.replaceChildren(...header('Réglages', 'Configure le fonctionnement général du chat.'),
    el('div', { class: 'panel' },
      el('div', { class: 'field' }, el('label', {}, '📢 Annonce permanente'), announcement),
      el('div', { class: 'field' }, el('label', {}, '🚫 Mots interdits (remplacés par des ***), séparés par des virgules'), words),
      el('div', { class: 'switch' }, el('span', {}, '🎭 Autoriser la connexion en invité (sans inscription)'), guests),
      el('div', { class: 'switch' }, el('span', {}, '✍️ Inscriptions ouvertes'), reg),
      el('div', { class: 'switch' }, el('span', {}, '🔞 Âge minimum'), minAge),
      el('div', { class: 'switch' }, el('span', {}, '🎙️ Chat vocal activé'), voiceOn),
      el('div', { class: 'switch' }, el('span', {}, '👥 Personnes maximum par vocal'), voiceMax),
      el('div', { class: 'switch' }, el('span', {}, '🏠 Les membres peuvent créer leur salon'), userRooms),
      el('div', { class: 'switch' }, el('span', {}, '🔢 Salons permanents maximum par membre'), maxRooms),
      el('div', { class: 'switch' }, el('span', {}, '🛂 Douane : les nouveaux arrivants doivent être vérifiés par le staff avant d\'accéder au site'), customsOnBox),
      el('div', { class: 'switch' }, el('span', {}, '⏳ Tout le monde peut créer un salon temporaire (même les invités)'), tempOn),
      el('div', { class: 'switch' }, el('span', {}, '⏱️ Un salon temporaire vide se ferme après (minutes)'), tempMin),
      el('button', { class: 'btn btn-primary', style: 'margin-top:18px', onclick: () => run(() => api('/api/admin/settings', { method: 'PUT', body: {
        announcement: announcement.value, bannedWords: words.value, guestsAllowed: guests.checked, registrationOpen: reg.checked, minAge: minAge.value,
        voiceEnabled: voiceOn.checked, voiceMax: voiceMax.value, userRoomsEnabled: userRooms.checked, maxUserRooms: maxRooms.value,
        tempRoomsEnabled: tempOn.checked, tempRoomMinutes: tempMin.value, customsEnabled: customsOnBox.checked,
      } }), 'Réglages enregistrés') }, 'Enregistrer les réglages')));
}

// ---------- Site (super-admin) : tout le contenu modifiable ----------
async function site() {
  const { site: s } = await api('/api/site');
  const input = (key, max, ph) => el('input', { class: 'input', maxlength: max, value: s[key] || '', placeholder: ph || '' });
  const area = (key, rows) => el('textarea', { class: 'input', rows, style: 'font-family:inherit' }, s[key] || '');
  const name = input('siteName', 40), domain = input('siteDomain', 60), title = input('heroTitle', 120), footer = input('footerText', 120);
  const heroText = area('heroText', 3);
  const colors = ['colorViolet', 'colorRose', 'colorGold'].map(k => el('input', { type: 'color', value: s[k] || '#8b6cff', class: 'color-input', style: 'width:56px;height:40px' }));
  const maxAcc = el('input', { class: 'input', type: 'number', min: 0, max: 20, value: s.maxAccounts, style: 'max-width:100px' });
  const permColor = el('input', { type: 'color', value: s.colorRoomPerm || '#4fb3ff', class: 'color-input', style: 'width:56px;height:40px' });
  const tempColor = el('input', { type: 'color', value: s.colorRoomTemp || '#ffb547', class: 'color-input', style: 'width:56px;height:40px' });
  const roomPreview = el('div', { class: 'room-color-preview' });
  const drawRoomPreview = () => roomPreview.replaceChildren(
    el('span', { style: `color:${permColor.value}` }, '📌 Général (permanent)'), el('span', { style: `color:${tempColor.value}` }, '⏳ Salon de Lina (temporaire)'));
  [permColor, tempColor].forEach(c => c.addEventListener('input', drawRoomPreview));
  drawRoomPreview();
  // Thème de fête
  let themeMode = s.themeMode || 'auto';
  const themeBox = el('div', { class: 'theme-grid' });
  const drawThemes = () => themeBox.replaceChildren(...[
    ['auto', '📅', 'Automatique', 'Selon la date'], ['none', '🚫', 'Aucun', 'Thème normal'],
    ...Object.entries(LC.SEASONS).map(([k, t]) => [k, t.icon, t.label, 'Toujours actif']),
  ].map(([k, icon, label, sub]) => el('button', {
    type: 'button', class: 'theme-card' + (themeMode === k ? ' active' : ''),
    style: LC.SEASONS[k] ? `--t1:${LC.SEASONS[k].colors[0]};--t2:${LC.SEASONS[k].colors[1]};--t3:${LC.SEASONS[k].colors[2]}` : '',
    onclick: () => { themeMode = k; drawThemes(); LC.applySeason(k === 'auto' ? s.theme : k === 'none' ? '' : k); },
  }, el('span', { class: 'theme-ico' }, icon), el('b', {}, label), el('small', {}, sub))));
  drawThemes();
  const editor = (key, label) => {
    const ta = area(key, 16);
    const prev = el('div', { class: 'page-content rich-preview' });
    const draw = () => prev.replaceChildren(LC.richText(ta.value));
    ta.addEventListener('input', draw); draw();
    return { ta, box: el('div', { class: 'panel' }, el('h2', {}, label),
      el('p', { class: 'help', style: 'margin:0 0 10px' }, 'Mise en forme : « # Titre », « ## Sous-titre », « - élément de liste », « **gras** ». Les liens sont cliquables.'),
      el('div', { class: 'rich-editor' }, ta, prev)) };
  };
  const hist = editor('historyContent', '📖 Page « Notre histoire »');
  const rules = editor('rulesContent', '📜 Page « Règlement »');
  const save = async () => {
    const body = {
      siteName: name.value, siteDomain: domain.value, heroTitle: title.value, heroText: heroText.value, footerText: footer.value,
      colorViolet: colors[0].value, colorRose: colors[1].value, colorGold: colors[2].value, maxAccounts: maxAcc.value, theme: themeMode,
      colorRoomPerm: permColor.value, colorRoomTemp: tempColor.value,
      historyContent: hist.ta.value, rulesContent: rules.ta.value,
    };
    const { site: saved } = await run(() => api('/api/admin/site', { method: 'PUT', body }), 'Site mis à jour pour tout le monde');
    LC.applySite(saved);
    try { localStorage.setItem('lc_site', JSON.stringify(saved)); } catch (e) {}
  };
  colors.forEach((c, i) => c.addEventListener('input', () => document.documentElement.style.setProperty(['--violet', '--rose', '--gold'][i], c.value)));
  page.replaceChildren(...header('🌐 Site', 'Réservé au super-admin : modifie le nom, les textes, les couleurs, l\'histoire et le règlement du site.'),
    el('div', { class: 'panel' }, el('h2', {}, '🏷️ Identité'),
      el('div', { class: 'row' }, el('div', { class: 'field' }, el('label', {}, 'Nom du site'), name), el('div', { class: 'field' }, el('label', {}, 'Nom de domaine'), domain)),
      el('div', { class: 'field' }, el('label', {}, 'Grand titre de l\'accueil (mets un mot entre *étoiles* pour le colorer)'), title),
      el('div', { class: 'field' }, el('label', {}, 'Texte de présentation de l\'accueil'), heroText),
      el('div', { class: 'field' }, el('label', {}, 'Texte du bas de page'), footer)),
    el('div', { class: 'panel' }, el('h2', {}, '🎉 Thème de fête'),
      el('p', { class: 'help', style: 'margin:0 0 12px' }, `En automatique : 🎃 Halloween du 24 oct. au 1er nov., ❄️ Hiver du 2 au 30 nov. puis du 4 janv. au 20 mars (hors Saint-Valentin), 🎄 Noël du 1er au 26 déc., 🎆 Nouvel An du 27 déc. au 3 janv., 💘 Saint-Valentin du 10 au 15 févr., 🐣 Pâques (3 jours avant à 1 jour après). Thème actif aujourd'hui : ${s.theme ? LC.SEASONS[s.theme].icon + ' ' + LC.SEASONS[s.theme].label : 'aucun'}. Les couleurs du thème remplacent les couleurs du site pendant la fête.`),
      themeBox),
    el('div', { class: 'panel' }, el('h2', {}, '🎨 Couleurs du site'),
      el('div', { class: 'toolbar' }, ...['Couleur 1', 'Couleur 2', 'Couleur 3'].map((l, i) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, colors[i], l)),
        el('button', { class: 'btn btn-sm', onclick: () => { ['#8b6cff', '#ff5fa2', '#ffb547'].forEach((c, i) => { colors[i].value = c; colors[i].dispatchEvent(new Event('input')); }); } }, '↺ Couleurs d\'origine')),
      el('div', { class: 'grad-preview' }, 'Aperçu du dégradé')),
    el('div', { class: 'panel' }, el('h2', {}, '🏠 Couleur des noms de salons'),
      el('div', { class: 'toolbar' },
        el('label', { style: 'display:flex;gap:8px;align-items:center' }, permColor, '📌 Salons permanents'),
        el('label', { style: 'display:flex;gap:8px;align-items:center' }, tempColor, '⏳ Salons temporaires')),
      roomPreview),
    el('div', { class: 'panel' }, el('h2', {}, '👥 Comptes'),
      el('div', { class: 'switch' }, el('span', {}, 'Nombre maximum de comptes par personne (même appareil ou même connexion) — 0 = illimité'), maxAcc)),
    hist.box, rules.box,
    el('div', { class: 'save-bar' }, el('button', { class: 'btn btn-primary', onclick: save }, '💾 Enregistrer tout le site')));
}

// ---------- Journal ----------
// ---------- Codes staff (super-admin) ----------
async function codes(newCode) {
  const d = await api('/api/admin/staff-codes');
  const ROLE = { superadmin: '👑 Super-admin', admin: '🛡️ Admin', moderator: '🎖️ Modérateur' };
  const role = el('select', { class: 'input', style: 'max-width:190px' }, ...Object.entries(ROLE).reverse().map(([v, l]) => el('option', { value: v }, l)));
  const uses = el('input', { class: 'input', type: 'number', min: 1, max: 50, value: 1, style: 'max-width:90px', title: 'Nombre d\'utilisations' });
  const days = el('input', { class: 'input', type: 'number', min: 0, max: 365, value: 7, style: 'max-width:90px', title: 'Valable (jours), 0 = sans limite' });
  const note = el('input', { class: 'input', maxlength: 60, placeholder: 'Pour qui ? (facultatif)' });
  const fresh = el('div', {});
  if (newCode) fresh.append(el('div', { class: 'backup-ok' }, el('b', {}, 'Nouveau code — donne-le à la personne :'),
    el('div', { class: 'toolbar', style: 'margin:6px 0 0' }, el('code', { class: 'code-show' }, newCode), el('button', { class: 'btn btn-sm', onclick: () => { navigator.clipboard?.writeText(newCode); toast('📋 Code copié'); } }, '📋 Copier')),
    el('div', { class: 'help' }, `Elle va sur ${location.origin}/staff, se connecte avec son compte et entre ce code.`)));
  const masterBox = el('code', { class: 'code-show' }, '••••-••••-••••');
  const copy = t => { navigator.clipboard?.writeText(t); toast('📋 Code copié'); };
  page.replaceChildren(...header('🔑 Codes staff', 'Donne un rôle à quelqu\'un de ton équipe : il va sur /staff, se connecte et entre le code.'),
    el('div', { class: 'panel' }, el('h2', {}, '➕ Créer un code'),
      el('div', { class: 'toolbar' }, role, el('label', { class: 'help' }, 'Utilisations'), uses, el('label', { class: 'help' }, 'Jours'), days, note,
        el('button', { class: 'btn btn-primary', onclick: async () => {
          if (role.value === 'superadmin' && !confirm('Un code SUPER-ADMIN donne TOUS les pouvoirs (y compris sur toi). Continuer ?')) return;
          const r = await run(() => api('/api/admin/staff-codes', { method: 'POST', body: { role: role.value, uses: uses.value, days: days.value, note: note.value } }), 'Code créé');
          codes(r.code);
        } }, 'Créer')),
      fresh),
    el('div', { class: 'panel' }, el('h2', {}, '📋 Codes actifs'),
      d.codes.length ? el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ...['Code', 'Rôle', 'Restant', 'Expire', 'Pour', 'Créé par', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, ...d.codes.map(c => el('tr', {},
          el('td', {}, el('code', {}, c.code)), el('td', {}, ROLE[c.role] || c.role), el('td', {}, c.uses_left),
          el('td', {}, c.expires_at ? LC.date(c.expires_at) : 'jamais'), el('td', {}, c.note || '—'), el('td', {}, c.created_by),
          el('td', {}, el('button', { class: 'btn btn-sm', onclick: () => copy(c.code) }, '📋'),
            el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { await run(() => api('/api/admin/staff-codes/' + encodeURIComponent(c.code), { method: 'DELETE' }), 'Code supprimé'); codes(); } }, '🗑')))))))
        : el('p', { class: 'empty' }, 'Aucun code actif')),
    el('div', { class: 'panel' }, el('h2', {}, '🆘 Code de secours super-admin'),
      el('p', { class: 'help', style: 'margin:0 0 10px' }, 'Si un jour tu perds ton rôle de super-admin, ce code te le redonne sur /staff. Garde-le pour toi seul.' + (d.fromEnv ? ' Il est fixé par le réglage SUPERADMIN_CODE du serveur.' : '')),
      el('div', { class: 'toolbar' }, masterBox,
        el('button', { class: 'btn btn-sm', onclick: () => { masterBox.textContent = masterBox.textContent.includes('•') ? d.master : '••••-••••-••••'; } }, '👁️ Afficher'),
        el('button', { class: 'btn btn-sm', onclick: () => copy(d.master) }, '📋 Copier'),
        d.fromEnv ? null : el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (!confirm('Créer un nouveau code de secours ? L\'ancien ne marchera plus.')) return; const r = await run(() => api('/api/admin/staff-codes/master', { method: 'POST' }), 'Nouveau code de secours'); d.master = r.master; masterBox.textContent = r.master; } }, '🔄 Changer'))));
}

// ---------- Sauvegardes (super-admin) ----------
async function backups() {
  const info = await api('/api/admin/backup/info');
  const roleCount = r => info.counts[r] || 0;
  const file = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  const optRoles = el('input', { type: 'checkbox', checked: true });
  const optSettings = el('input', { type: 'checkbox' });
  const result = el('div', {});
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    result.replaceChildren(el('p', { class: 'help' }, '⏳ Restauration en cours…'));
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.users)) throw new Error('Ce fichier n\'est pas une sauvegarde des membres');
      if (!confirm(`Restaurer ${data.users.length} membre(s) depuis ce fichier ?`)) { result.replaceChildren(); return; }
      const { report } = await api('/api/admin/backup/import', { method: 'POST', body: { users: data.users, settings: data.settings, options: { roles: optRoles.checked, settings: optSettings.checked } } });
      result.replaceChildren(el('div', { class: 'backup-ok' },
        el('b', {}, '✅ Restauration terminée'),
        el('div', {}, `✨ ${report.created} compte(s) recréé(s) · 🎖️ ${report.updated} rôle(s) remis · ${report.skipped} déjà à jour ou ignoré(s)`),
        el('div', { class: 'help' }, 'Les membres restaurés se connectent avec leur pseudo et leur mot de passe habituels.')));
      toast('✅ Sauvegarde restaurée');
    } catch (e) { result.replaceChildren(el('p', { class: 'error' }, '❌ ' + e.message)); }
    file.value = '';
  };
  const fmtSize = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');
  page.replaceChildren(...header('💾 Sauvegardes', 'Garde une copie de tes membres et de leurs rôles, et remets-les en place si besoin.'),
    el('div', { class: 'kpis' },
      el('div', { class: 'kpi' }, el('span', {}, '👤 Membres inscrits'), el('b', {}, info.total)),
      el('div', { class: 'kpi' }, el('span', {}, '👑 Super-admins'), el('b', {}, roleCount('superadmin'))),
      el('div', { class: 'kpi' }, el('span', {}, '🛡️ Admins'), el('b', {}, roleCount('admin'))),
      el('div', { class: 'kpi' }, el('span', {}, '🎖️ Modérateurs'), el('b', {}, roleCount('moderator')))),
    el('div', { class: 'panel' }, el('h2', {}, '⬇️ Télécharger une sauvegarde'),
      el('p', { class: 'help', style: 'margin:0 0 12px' }, 'Le fichier contient tous les membres inscrits avec leur rôle, leur profil et leur mot de passe (chiffré : personne ne peut le lire). Garde-le précieusement, ne le partage pas.'),
      el('div', { class: 'toolbar' },
        el('a', { class: 'btn btn-primary', href: '/api/admin/backup/users', download: '' }, '👥 Membres + rôles (.json)'),
        el('a', { class: 'btn', href: '/api/admin/backup/db', download: '' }, '🗄️ Sauvegarde complète (.db)')),
      el('p', { class: 'help', style: 'margin:8px 0 0' }, 'La sauvegarde complète contient tout (messages, salons, scores…) : utile pour déménager le site sur un autre serveur.')),
    el('div', { class: 'panel' }, el('h2', {}, '⬆️ Restaurer les membres'),
      el('p', { class: 'help', style: 'margin:0 0 10px' }, 'Choisis un fichier « sauvegarde-membres-….json ». Les comptes manquants sont recréés ; les comptes déjà présents ne sont pas touchés (sauf leur rôle si tu coches la case).'),
      el('label', { class: 'switch' }, el('span', {}, '🎖️ Remettre les rôles (super-admin, admin, modérateur)'), optRoles),
      el('label', { class: 'switch' }, el('span', {}, '🌐 Restaurer aussi les réglages du site (nom, textes, règlement, couleurs…)'), optSettings),
      el('button', { class: 'btn btn-primary', style: 'margin-top:12px', onclick: () => file.click() }, '📂 Choisir le fichier de sauvegarde'),
      file, result),
    el('div', { class: 'panel' }, el('h2', {}, '🕒 Sauvegardes automatiques du serveur'),
      el('p', { class: 'help', style: 'margin:0 0 10px' }, 'Le site fait une sauvegarde tout seul chaque jour et garde les 14 derniers jours. ⚠️ Elles sont sur le serveur : si le serveur est effacé (ex. Render gratuit), elles disparaissent aussi. Télécharge régulièrement une copie sur ton ordinateur.'),
      info.auto.length ? el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ...['Fichier', 'Taille', 'Date', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, ...info.auto.map(a => el('tr', {}, el('td', {}, a.name.endsWith('.json') ? '👥 ' + a.name : '🗄️ ' + a.name), el('td', {}, fmtSize(a.size)), el('td', {}, LC.date(a.date)),
          el('td', {}, el('a', { class: 'btn btn-sm', href: '/api/admin/backup/auto/' + encodeURIComponent(a.name), download: '' }, '⬇️')))))))
        : el('p', { class: 'empty' }, 'La première sauvegarde automatique sera faite quelques secondes après le démarrage du site.')));
}

// ---------- Logs : tout ce qui se passe sur le site (accès staff) ----------
const LOG_LABELS = {
  ban: '⛔ Bannissement', unban: '✅ Débannissement', kick: '👢 Expulsion', mute: '🔇 Mute', unmute: '🔊 Parole rendue', warn: '⚠️ Avertissement',
  role: '🎖️ Rôle', delete_user: '🗑 Compte supprimé', profile_reset: '🧹 Profil réinitialisé', broadcast: '📢 Annonce',
  report_open: '⚠️ Signalement rouvert', report_closed: '✅ Signalement traité', report_new: '🚨 Nouveau signalement',
  message_delete: '🗑 Message supprimé', room_clear: '🧹 Salon vidé',
  register: '✨ Inscription', login: '🔑 Connexion', logout: '🚪 Déconnexion', guest: '🎭 Invité', admin_auto: '👑 Super-admin', profile_update: '🖼️ Profil modifié', account_limit: '🚫 Limite de comptes',
  room_create: '🏠 Salon créé', room_edit: '✏️ Salon modifié', room_delete: '🗑 Salon supprimé', room_kick: '🚪 Exclusion de salon', room_invite: '🎟️ Invitation', room_private: '🔒 Salon fermé/ouvert', room_background: '🖼️ Fond de salon',
  voice_join: '🎙️ Vocal', call: '📞 Appel',
  settings: '⚙️ Réglages', site: '🌐 Site', station_create: '📻 Radio ajoutée', station_edit: '📻 Radio modifiée', station_delete: '📻 Radio supprimée', stations_check: '🩺 Radios vérifiées', ghost: '👻 Mode fantôme', staff_code: '🔑 Code staff', verify: '✅ Douane passée', unverify: '🛂 Renvoyé à la douane', customs: '🛂 Douane', backup: '💾 Sauvegarde',
};
const LOG_TABS = [['all', '📜 Tout'], ['moderation', '🛡️ Modération'], ['messages', '🗑 Messages supprimés'], ['accounts', '👤 Comptes'], ['rooms', '🏠 Salons'], ['voice', '🎙️ Vocal & appels'], ['reports', '🚨 Signalements'], ['system', '⚙️ Système']];
let logsPoll = null;
async function logs() {
  clearInterval(logsPoll);
  let category = 'all', q = '', newest = 0, oldest = 0;
  const list = el('div', { class: 'log-list' });
  const more = el('button', { class: 'btn btn-ghost hidden', style: 'width:100%;margin-top:12px' }, 'Voir plus ancien');
  const tabs = el('div', { class: 'log-tabs' });
  const search = el('input', { class: 'input', placeholder: 'Rechercher un pseudo, un mot…' });
  const live = el('span', { class: 'live-dot' }, '● En direct');

  const row = l => {
    const extra = [];
    if (l.action === 'message_delete' && l.data?.content) {
      extra.push(el('div', { class: 'log-deleted' },
        el('div', { class: 'help' }, `Message de ${l.data.author || '?'} dans ${l.data.room || '?'}${l.data.sentAt ? ' · envoyé le ' + LC.date(l.data.sentAt) : ''}`),
        l.data.kind === 'audio' && l.data.media ? audioPlayerAdmin(l.data.media)
          : l.data.kind === 'image' && l.data.media ? el('div', {}, el('a', { href: l.data.media, target: '_blank' }, el('img', { class: 'log-img', src: l.data.media, alt: '' })), l.data.content !== '🖼️ Photo' ? el('div', { class: 'log-quote' }, l.data.content) : null)
          : el('div', { class: 'log-quote' }, l.data.content)));
    }
    if (l.data?.image) extra.push(el('a', { href: l.data.image, target: '_blank' }, el('img', { class: 'log-img', src: l.data.image, alt: '', loading: 'lazy' })));
    return el('div', { class: 'log-row cat-' + l.category, 'data-id': l.id },
      el('div', { class: 'log-time' }, LC.date(l.createdAt)),
      el('div', { class: 'log-main' },
        el('div', { class: 'log-head' },
          el('span', { class: 'log-tag' }, LOG_LABELS[l.action] || l.action),
          el('button', { class: 'log-actor', title: 'Voir toutes les actions de ' + l.actor, onclick: () => { search.value = l.actor; q = l.actor; load(); } }, l.actor || 'système'),
          l.ip ? el('span', { class: 'log-ip', title: 'Adresse IP (visible par le super-admin uniquement)' }, l.ip) : null),
        l.action === 'message_delete' ? null : el('div', { class: 'log-details' }, l.details),
        ...extra));
  };
  const drawTabs = counts => tabs.replaceChildren(...LOG_TABS.map(([k, label]) => el('button', {
    class: 'choice' + (category === k ? ' active' : ''), onclick: () => { category = k; load(); },
  }, label, k !== 'all' && counts?.[k] ? el('span', { class: 'pill', style: 'margin-left:6px' }, counts[k]) : null)));

  const url = extra => `/api/admin/logs?category=${category}&q=${encodeURIComponent(q)}${extra}`;
  async function load() {
    const d = await api(url(''));
    drawTabs(d.counts);
    list.replaceChildren(...(d.logs.length ? d.logs.map(row) : [el('p', { class: 'empty' }, 'Rien pour le moment')]));
    newest = d.logs[0]?.id || newest;
    oldest = d.logs[d.logs.length - 1]?.id || 0;
    more.classList.toggle('hidden', !d.more);
  }
  more.onclick = async () => {
    const d = await api(url('&before=' + oldest));
    list.append(...d.logs.map(row));
    oldest = d.logs[d.logs.length - 1]?.id || oldest;
    more.classList.toggle('hidden', !d.more);
  };
  let t;
  search.oninput = () => { clearTimeout(t); t = setTimeout(() => { q = search.value.trim(); load(); }, 300); };

  page.replaceChildren(...header('📜 Logs', 'Tout ce qui se passe sur le site : connexions, inscriptions, messages supprimés (avec leur contenu), salons, vocal, appels, sanctions… Gardés 90 jours.'),
    el('div', { class: 'panel' }, el('div', { class: 'toolbar' }, search, live), tabs, list, more));
  await load();
  // Mise à jour en direct
  logsPoll = setInterval(async () => {
    if (!document.body.contains(list)) return clearInterval(logsPoll);
    if (!newest) return;
    try {
      const d = await api(url('&after=' + newest));
      if (!d.logs.length) return;
      if (list.querySelector('.empty')) list.replaceChildren();
      d.logs.slice().reverse().forEach(l => { const r = row(l); r.classList.add('fresh'); list.prepend(r); });
      newest = d.logs[0].id;
      drawTabs(d.counts);
    } catch (e) {}
  }, 4000);
}
function audioPlayerAdmin(url) {
  return el('audio', { controls: true, preload: 'none', src: url, style: 'width:100%;max-width:320px;margin-top:6px' });
}

// ---------- Démarrage ----------
(async () => {
  try {
    const d = await api('/api/admin/stats');
    me = d.me;
  } catch (e) {
    page.replaceChildren(el('div', { class: 'card', style: 'max-width:440px;margin:80px auto;text-align:center' },
      el('h2', {}, '🔒 Accès réservé'), el('p', { style: 'color:var(--muted)' }, 'Cette page est réservée à l\'équipe de modération.'),
      el('a', { class: 'btn btn-primary', href: '/' }, 'Retour à l\'accueil')));
    document.getElementById('nav').classList.add('hidden');
    return;
  }
  if (!isAdmin()) document.querySelectorAll('.admin-only').forEach(x => x.remove());
  if (!isSuper()) document.querySelectorAll('.super-only').forEach(x => x.remove());
  go();
})();

// Sur téléphone, les tableaux deviennent des fiches : chaque cellule reçoit le nom de sa colonne
function labelTables(root) {
  root.querySelectorAll('table').forEach(t => {
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!heads.length) return;
    t.classList.add('cards-on-mobile');
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (heads[i] && !td.dataset.label) td.dataset.label = heads[i]; }));
  });
}
new MutationObserver(() => labelTables(document.getElementById('page'))).observe(document.getElementById('page'), { childList: true, subtree: true });
