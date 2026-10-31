// Fonctions partagées
(function () {
  try { const t = localStorage.getItem('lc_theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
})();
window.LC = {
  async api(url, opts = {}) {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) { const err = new Error(data.error || 'Erreur ' + res.status); err.status = res.status; throw err; }
    return data;
  },
  el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  },
  toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = cur;
    try { localStorage.setItem('lc_theme', cur); } catch (e) {}
  },
  genderLabel: g => ({ h: 'Homme', f: 'Femme', x: 'Autre' }[g] || 'Autre'),
  genderIcon: g => ({ h: '♂', f: '♀', x: '⚥' }[g] || '⚥'),
  time(ts) { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); },
  date(ts) { return ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; },
  avatar(u, big) {
    const a = LC.el('div', { class: 'avatar' + (big ? ' lg' : '') + (u.frame && u.frame !== 'none' ? ' frame frame-' + u.frame : ''), style: `--avbg:${u.color || '#8b6cff'};--accent:${u.accent || u.color || '#ff5fa2'}` });
    if (u.avatar) a.append(LC.el('img', { src: u.avatar, alt: '', loading: 'lazy' }));
    else a.append((u.username || '?')[0].toUpperCase());
    return a;
  },
  // Pseudo avec sa couleur et son effet
  name(u, extraClass = '') {
    const fx = u.nameEffect && u.nameEffect !== 'none' ? ' fx fx-' + u.nameEffect : '';
    return LC.el('span', { class: 'uname' + fx + (extraClass ? ' ' + extraClass : ''), style: `--c:${u.color || '#8b6cff'};color:${u.color || '#8b6cff'}` }, u.username);
  },
  BANNERS: {
    aurora: 'linear-gradient(135deg,#8b6cff,#ff5fa2 60%,#ffb547)',
    sunset: 'linear-gradient(135deg,#ff7a59,#ff3d77 50%,#7b2ff7)',
    ocean: 'linear-gradient(135deg,#0ea5e9,#2563eb 50%,#312e81)',
    neon: 'linear-gradient(135deg,#00f5d4,#7b2ff7 55%,#f72585)',
    forest: 'linear-gradient(135deg,#16a34a,#0d9488 50%,#164e63)',
    midnight: 'linear-gradient(135deg,#1e1b4b,#312e81 50%,#0f172a)',
    candy: 'linear-gradient(135deg,#f9a8d4,#c4b5fd 50%,#a5f3fc)',
    lava: 'linear-gradient(135deg,#f97316,#dc2626 50%,#450a0a)',
  },
  bannerCss(u) {
    return u.banner ? `url("${u.banner}") center/cover no-repeat` : (LC.BANNERS[u.bannerStyle] || LC.BANNERS.aurora);
  },
  // Fenêtre de sanction (chat + admin) : la personne reçoit une notification avec la raison
  sanctionModal(u, { toast, onDone } = {}) {
    const el = LC.el;
    const say = toast || (t => alert(t));
    const TYPES = [['warn', '⚠️ Avertir'], ['mute', '🔇 Rendre muet'], ['kick', '👢 Expulser'], ['ban', '⛔ Bannir']];
    const QUICK = ['Insultes', 'Spam / flood', 'Harcèlement', 'Contenu inapproprié', 'Pseudo inapproprié', 'Publicité', 'Non-respect des règles'];
    let type = 'warn';
    const duration = el('select', { class: 'input' }, ...[[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 heure'], [180, '3 heures'], [1440, '24 heures'], [10080, '7 jours']]
      .map(([v, l]) => el('option', { value: v, selected: v === 15 }, l)));
    const durField = el('div', { class: 'field hidden' }, el('label', {}, 'Durée'), duration);
    const reason = el('textarea', { class: 'input', rows: 3, maxlength: 200, placeholder: 'Explique pourquoi (la personne le verra)' });
    const err = el('div', { class: 'error' });
    const typeRow = el('div', { class: 'choice-row' });
    const drawTypes = () => {
      typeRow.replaceChildren(...TYPES.map(([v, l]) => el('button', { type: 'button', class: 'choice' + (type === v ? ' active' : ''), onclick: () => { type = v; drawTypes(); } }, l)));
      durField.classList.toggle('hidden', type !== 'mute');
    };
    drawTypes();
    const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } });
    back.append(el('div', { class: 'card modal' },
      el('h3', {}, '🛡️ Sanctionner ' + u.username),
      el('div', { class: 'field' }, el('label', {}, 'Type de sanction'), typeRow),
      durField,
      el('div', { class: 'field' }, el('label', {}, 'Raison'),
        el('div', { class: 'choice-row', style: 'margin-bottom:8px' }, ...QUICK.map(q => el('button', { type: 'button', class: 'choice', onclick: () => { reason.value = q; } }, q))),
        reason),
      el('p', { class: 'help', style: 'margin:0 0 10px' }, '🔔 ' + u.username + ' recevra une notification avec la sanction et la raison.'),
      err,
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-ghost', onclick: () => back.remove() }, 'Annuler'),
        el('button', { class: 'btn btn-danger', onclick: async () => {
          err.textContent = '';
          const r = reason.value.trim();
          if (type === 'warn' && !r) { err.textContent = 'Indique la raison de l\'avertissement'; return; }
          try {
            if (type === 'warn') await LC.api(`/api/admin/users/${u.id}/warn`, { method: 'POST', body: { reason: r } });
            if (type === 'mute') await LC.api(`/api/admin/users/${u.id}/mute`, { method: 'POST', body: { minutes: parseInt(duration.value, 10), reason: r } });
            if (type === 'kick') await LC.api(`/api/admin/users/${u.id}/kick`, { method: 'POST', body: { reason: r } });
            if (type === 'ban') {
              if (!confirm(`Bannir ${u.username} ? Il ne pourra plus se connecter.`)) return;
              await LC.api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { banned: true, banReason: r } });
            }
            back.remove();
            say(`✅ Sanction appliquée à ${u.username} (notifié)`);
            onDone && onDone(type);
          } catch (e) { err.textContent = e.message; }
        } }, 'Appliquer la sanction'))));
    document.body.append(back);
  },
  badge(u) {
    if (u.role === 'admin') return LC.el('span', { class: 'badge admin' }, 'Admin');
    if (u.role === 'moderator') return LC.el('span', { class: 'badge moderator' }, 'Modo');
    if (u.isGuest) return LC.el('span', { class: 'badge guest' }, 'Invité');
    return null;
  },
};
