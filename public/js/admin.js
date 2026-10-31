// LustryChat — panneau d'administration
const { el, api } = LC;
const page = document.getElementById('page');
let me = null;
const isAdmin = () => me && me.role === 'admin';

function toast(text) {
  const t = el('div', { class: 'toast', onclick: () => t.remove() }, text);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 4000);
}
async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast('✅ ' + okMsg); return r; } catch (e) { toast('❌ ' + e.message); throw e; }
}
const header = (title, sub) => [el('h1', {}, title), el('p', { class: 'subtitle' }, sub)];
const roleLabel = r => ({ admin: 'Admin', moderator: 'Modérateur', user: 'Membre' }[r] || r);

// ---------- Navigation ----------
const pages = { dashboard, users, reports, messages, rooms, settings, logs };
function go() {
  let name = location.hash.slice(1) || 'dashboard';
  if (!pages[name] || (!isAdmin() && ['rooms', 'settings'].includes(name))) name = 'dashboard';
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
    ...header('Tableau de bord', `Bonjour ${s.me.username} 👋 Voici l'activité de LustryChat.`),
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
    ...[['all', 'Tous'], ['online', 'En ligne'], ['members', 'Membres'], ['guests', 'Invités'], ['staff', 'Équipe'], ['banned', 'Bannis']]
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
    const canAct = !self && (isAdmin() || u.role === 'user');
    const muted = u.mutedUntil && u.mutedUntil > Date.now();
    const status = u.banned ? el('span', { class: 'status-ban', title: u.banReason }, '⛔ Banni')
      : u.online ? el('span', { class: 'status-on' }, '🟢 En ligne') : el('span', { style: 'color:var(--muted)' }, 'Hors ligne');
    const role = isAdmin() && !self && !u.isGuest
      ? el('select', { class: 'input', style: 'padding:6px 8px;width:auto', onchange: async e => { await run(() => api('/api/admin/users/' + u.id, { method: 'PATCH', body: { role: e.target.value } }), 'Rôle modifié').catch(load); } },
        ...['user', 'moderator', 'admin'].map(r => el('option', { value: r, selected: u.role === r }, roleLabel(r))))
      : el('span', {}, u.isGuest ? 'Invité' : roleLabel(u.role));
    return el('tr', {},
      el('td', {}, el('div', { style: 'display:flex;gap:10px;align-items:center' }, LC.avatar(u), el('div', {}, el('b', {}, u.username), ' ', LC.badge(u),
        el('div', { style: 'color:var(--muted);font-size:.78rem' }, 'Vu : ' + LC.date(u.lastSeen))))),
      el('td', {}, `${LC.genderIcon(u.gender)} ${u.age || '?'} ans${u.city ? ' · ' + u.city : ''}`),
      el('td', {}, role),
      el('td', {}, status, muted ? el('div', { style: 'font-size:.78rem;color:var(--gold)' }, '🔇 muet') : null),
      el('td', {}, LC.date(u.createdAt)),
      el('td', {},
        el('button', { class: 'btn btn-sm', onclick: () => showHistory(u) }, '📄'),
        canAct ? [
          u.online ? el('button', { class: 'btn btn-sm', title: 'Expulser', onclick: async () => { const r = prompt('Raison de l\'expulsion ?'); if (r !== null) { await run(() => api(`/api/admin/users/${u.id}/kick`, { method: 'POST', body: { reason: r } }), 'Expulsé'); load(); } } }, '👢') : null,
          el('button', { class: 'btn btn-sm', title: muted ? 'Rendre la parole' : 'Rendre muet', onclick: async () => {
            let minutes = 0;
            if (!muted) { const v = prompt('Durée du mutisme (minutes) ?', '30'); if (v === null) return; minutes = parseInt(v, 10) || 0; }
            await run(() => api(`/api/admin/users/${u.id}/mute`, { method: 'POST', body: { minutes } }), minutes ? 'Rendu muet' : 'Parole rendue'); load();
          } }, muted ? '🔊' : '🔇'),
          u.banned
            ? el('button', { class: 'btn btn-sm', onclick: async () => { await run(() => api('/api/admin/users/' + u.id, { method: 'PATCH', body: { banned: false } }), 'Débanni'); load(); } }, '✅ Débannir')
            : el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { const r = prompt('Raison du bannissement ?'); if (r !== null) { await run(() => api('/api/admin/users/' + u.id, { method: 'PATCH', body: { banned: true, banReason: r } }), 'Banni'); load(); } } }, '⛔ Bannir'),
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
      el('thead', {}, el('tr', {}, ...['', 'Nom', 'Description', 'Ordre', 'Accès', 'Connectés', 'Actions'].map(h => el('th', {}, h)))),
      el('tbody', {}, ...rooms.map(r => el('tr', {},
        el('td', { style: 'font-size:1.3rem' }, r.icon), el('td', {}, el('b', {}, r.name), el('div', { style: 'font-size:.75rem;color:var(--muted)' }, '#' + r.slug)),
        el('td', {}, r.description), el('td', {}, r.sort), el('td', {}, r.membersOnly ? '💎 Membres' : 'Tous'), el('td', {}, r.count),
        el('td', {},
          el('button', { class: 'btn btn-sm', onclick: () => editRoom(r) }, '✏️'),
          el('button', { class: 'btn btn-sm', title: 'Vider les messages', onclick: async () => { if (confirm(`Vider tous les messages de ${r.name} ?`)) await run(() => api(`/api/admin/rooms/${r.id}/messages`, { method: 'DELETE' }), 'Salon vidé'); } }, '🧹'),
          el('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (confirm(`Supprimer le salon ${r.name} ?`)) { await run(() => api('/api/admin/rooms/' + r.id, { method: 'DELETE' }), 'Salon supprimé'); rooms_(); } } }, '🗑')))))))));
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
  page.replaceChildren(...header('Réglages', 'Configure le fonctionnement général du chat.'),
    el('div', { class: 'panel' },
      el('div', { class: 'field' }, el('label', {}, '📢 Annonce permanente'), announcement),
      el('div', { class: 'field' }, el('label', {}, '🚫 Mots interdits (remplacés par des ***), séparés par des virgules'), words),
      el('div', { class: 'switch' }, el('span', {}, '🎭 Autoriser la connexion en invité (sans inscription)'), guests),
      el('div', { class: 'switch' }, el('span', {}, '✍️ Inscriptions ouvertes'), reg),
      el('div', { class: 'switch' }, el('span', {}, '🔞 Âge minimum'), minAge),
      el('button', { class: 'btn btn-primary', style: 'margin-top:18px', onclick: () => run(() => api('/api/admin/settings', { method: 'PUT', body: {
        announcement: announcement.value, bannedWords: words.value, guestsAllowed: guests.checked, registrationOpen: reg.checked, minAge: minAge.value,
      } }), 'Réglages enregistrés') }, 'Enregistrer les réglages')));
}

// ---------- Journal ----------
async function logs() {
  const { logs } = await api('/api/admin/logs');
  const labels = { ban: '⛔ Bannissement', unban: '✅ Débannissement', kick: '👢 Expulsion', mute: '🔇 Mutisme', unmute: '🔊 Parole rendue', role: '🎖️ Rôle',
    delete_user: '🗑 Suppression compte', room_create: '🏠 Salon créé', room_edit: '✏️ Salon modifié', room_delete: '🗑 Salon supprimé', room_clear: '🧹 Salon vidé',
    message_delete: '💬 Message supprimé', settings: '⚙️ Réglages', broadcast: '📢 Annonce', report_closed: '⚠️ Signalement traité', report_open: '⚠️ Signalement rouvert', admin_auto: '👑 Admin' };
  page.replaceChildren(...header('Journal de modération', 'Toutes les actions de l\'équipe, des plus récentes aux plus anciennes.'),
    el('div', { class: 'panel' }, logs.length ? el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Date', 'Par', 'Action', 'Détails'].map(h => el('th', {}, h)))),
      el('tbody', {}, ...logs.map(l => el('tr', {}, el('td', { style: 'white-space:nowrap' }, LC.date(l.created_at)), el('td', {}, el('b', {}, l.actor_name || '—')),
        el('td', {}, labels[l.action] || l.action), el('td', {}, l.details || '')))))) : el('p', { class: 'empty' }, 'Aucune action pour le moment')));
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
  go();
})();
