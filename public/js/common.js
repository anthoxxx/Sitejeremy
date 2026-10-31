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
  badge(u) {
    if (u.role === 'admin') return LC.el('span', { class: 'badge admin' }, 'Admin');
    if (u.role === 'moderator') return LC.el('span', { class: 'badge moderator' }, 'Modo');
    if (u.isGuest) return LC.el('span', { class: 'badge guest' }, 'Invité');
    return null;
  },
};
