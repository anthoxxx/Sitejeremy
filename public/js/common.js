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
    const a = LC.el('div', { class: 'avatar' + (big ? ' lg' : ''), style: `background:${u.color || '#8b6cff'}` }, (u.username || '?')[0].toUpperCase());
    return a;
  },
  badge(u) {
    if (u.role === 'admin') return LC.el('span', { class: 'badge admin' }, 'Admin');
    if (u.role === 'moderator') return LC.el('span', { class: 'badge moderator' }, 'Modo');
    if (u.isGuest) return LC.el('span', { class: 'badge guest' }, 'Invité');
    return null;
  },
};
