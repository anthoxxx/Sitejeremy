// Sécurité d'affichage : un élément vide (null) ne doit jamais s'écrire « null » à l'écran
for (const m of ['replaceChildren', 'append', 'prepend']) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...items) { return orig.apply(this, items.filter(x => x != null && x !== false)); };
}
// Fonctions partagées
(function () {
  try { const t = localStorage.getItem('lc_theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  try { const k = localStorage.getItem('lc_skin'); if (k) document.documentElement.dataset.skin = k; } catch (e) {} // 🎨 le thème choisi
})();
// 🪪 La carte d'identité de l'appareil (pour que la modération reconnaisse un appareil banni, même avec un autre compte).
// Elle est rangée à trois endroits (cookie, stockage local, base du navigateur) : en vider un ne suffit pas.
window.LC_DEV = (() => {
  const ok = v => /^[a-f0-9]{32}$/.test(v || '');
  const fromCookie = () => (document.cookie.match(/(?:^|; )lc_pid=([a-f0-9]{32})/) || [])[1];
  let pid = null; try { pid = localStorage.getItem('lc_pid'); } catch (e) {}
  if (!ok(pid)) pid = fromCookie();
  const save = v => { try { localStorage.setItem('lc_pid', v); } catch (e) {} document.cookie = `lc_pid=${v}; max-age=${5 * 365 * 86400}; path=/; samesite=lax`;
    try { const r = indexedDB.open('lc_id', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => { try { r.result.transaction('k', 'readwrite').objectStore('k').put(v, 'pid'); } catch (e) {} }; } catch (e) {} };
  if (!ok(pid)) { // on regarde aussi dans la base du navigateur avant d'en créer une nouvelle
    pid = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    try { const r = indexedDB.open('lc_id', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => { try { const q = r.result.transaction('k').objectStore('k').get('pid'); q.onsuccess = () => { if (ok(q.result)) { info.pid = q.result; save(q.result); } }; } catch (e) {} }; } catch (e) {}
  }
  save(pid);
  // l'empreinte de l'appareil (écran, carte graphique, langue…) : un simple indice, jamais une preuve
  let fp = '';
  try {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 220; c.height = 30; g.textBaseline = 'top'; g.font = '16px Arial'; g.fillStyle = '#f60'; g.fillRect(100, 1, 62, 20); g.fillStyle = '#069'; g.fillText('Paradise 💜 ÀÉ', 2, 4);
    const gl = document.createElement('canvas').getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const parts = [c.toDataURL(), ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '', screen.width + 'x' + screen.height + 'x' + screen.colorDepth, devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.platform, navigator.hardwareConcurrency, navigator.deviceMemory || ''].join('|');
    let h1 = 0x811c9dc5, h2 = 0x1505; for (let i = 0; i < parts.length; i++) { const k = parts.charCodeAt(i); h1 = Math.imul(h1 ^ k, 16777619) >>> 0; h2 = (Math.imul(h2, 33) + k) >>> 0; }
    fp = h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  } catch (e) {}
  const info = { pid, fp }; return info;
})();
window.LC = {
  async api(url, opts = {}) {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), 'X-LC-Pid': LC_DEV.pid, 'X-LC-Fp': LC_DEV.fp },
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
  // 🎨 Les thèmes du site : chacun change toutes les couleurs et ajoute une petite touche de décor
  SKINS: [['', 'Paradise', '🌴', ['#0d0a1a', '#8b6cff', '#ff5fa2', '#ffb547']], ['galaxie', 'Galaxie', '🌌', ['#070618', '#7b2ff7', '#f72585', '#4fb3ff']], ['ocean', 'Océan', '🌊', ['#04121c', '#00b4d8', '#48cae4', '#90e0ef']],
    ['sakura', 'Sakura', '🌸', ['#1a0d14', '#ff8fab', '#ffc2d1', '#fb6f92']], ['luxe', 'Luxe noir et or', '👑', ['#0a0906', '#d4af37', '#f5d77a', '#8a6a10']], ['lave', 'Lave', '🌋', ['#140604', '#ff3d00', '#ff9500', '#ffd23f']],
    ['bonbon', 'Bonbon', '🍬', ['#160c1c', '#ff7eb9', '#7afcff', '#feff9c']], ['foret', 'Forêt', '🌲', ['#06120a', '#2bd07a', '#9be564', '#e8d27a']], ['neon', 'Néon', '💡', ['#05050a', '#00f0ff', '#ff2bd6', '#39ff14']],
    ['clair', 'Clair', '☀️', ['#f6f3ff', '#8b6cff', '#ff5fa2', '#ffb547']]],
  setSkin(k) {
    const r = document.documentElement;
    if (k === 'clair') { delete r.dataset.skin; r.dataset.theme = 'light'; } else { r.dataset.theme = 'dark'; if (k) r.dataset.skin = k; else delete r.dataset.skin; }
    try { localStorage.setItem('lc_skin', k === 'clair' ? '' : k); localStorage.setItem('lc_theme', r.dataset.theme); } catch (e) {}
  },
  toggleTheme() { // le bouton 🌓 ouvre maintenant le choix des thèmes
    const el = LC.el, r = document.documentElement, cur = r.dataset.theme === 'light' ? 'clair' : (r.dataset.skin || '');
    document.querySelector('.skin-back')?.remove();
    const back = el('div', { class: 'skin-back', onclick: e => { if (e.target === back) back.remove(); } });
    const grid = el('div', { class: 'skin-grid' }, ...LC.SKINS.map(([k, name, icon, c]) => el('button', { type: 'button', class: 'skin-card' + (k === cur ? ' on' : ''), onclick: e => { const b0 = e.currentTarget; LC.setSkin(k); grid.querySelectorAll('.skin-card').forEach(b => b.classList.remove('on')); b0.classList.add('on'); } },
      el('span', { class: 'skin-prev', style: `background:linear-gradient(135deg, ${c[0]} 0 40%, ${c[1]} 40% 60%, ${c[2]} 60% 80%, ${c[3]} 80%)` }, el('i', {}, icon)), el('b', {}, name))));
    back.append(el('div', { class: 'skin-box' }, el('h3', {}, '🎨 Choisis ton thème'), el('p', { class: 'help' }, 'Il change les couleurs de tout le site, rien que pour toi. Tu peux en changer quand tu veux.'), grid,
      el('button', { class: 'btn btn-primary', style: 'width:100%;margin-top:12px', onclick: () => back.remove() }, '✅ C\'est parfait')));
    document.body.append(back);
  },
  genderLabel: g => ({ h: 'Homme', f: 'Femme', g: 'Homme', v: 'Autre', t: 'Autre', x: 'Autre' }[g] || 'Autre'),
  // 🏳️‍🌈 Les cœurs d'identité (choisis dans le profil, affichés à côté du pseudo)
  IDENTITIES: [['', 'Aucun (cœur de mon genre)', ''], ['gay', 'Gay', '🖤'], ['lesbienne', 'Lesbienne', '🧡'], ['bi', 'Bi', '💚'], ['pan', 'Pan', '💛'], ['trans', 'Trans', '💜'], ['trav', 'Trav', '🤎'], ['queer', 'Queer', '🩵'], ['nonbinaire', 'Non-binaire', '💞'], ['hetero', 'Hétéro', '💝']],
  identityHeart: id => (LC.IDENTITIES.find(x => x[0] === id) || [])[2] || '',
  identityLabel: id => (LC.IDENTITIES.find(x => x[0] === id) || [])[1] || '',
  // Le cœur à côté du pseudo : ❤️ pour les admins (+ 🩶 si donné), puis le cœur d'identité choisi, sinon celui du genre
  heartOf: u => { if (!u) return ''; const idh = LC.identityHeart(u.identity); const admin = u.role === 'admin' || u.role === 'superadmin'; return admin ? '❤️' + (u.grey ? '🩶' : '') + idh : idh || LC.genderIcon(u.gender); },
  // ✍️ Le style d'écriture choisi pour ses messages
  MSG_FONTS: [['', 'Normal'], ['manuscrite', 'Manuscrite'], ['machine', 'Machine à écrire'], ['fantaisie', 'Fantaisie'], ['pixel', 'Pixel'], ['elegante', 'Élégante'], ['bd', 'Bande dessinée'], ['gras', 'Gras'], ['italique', 'Italique']],
  msgStyle: u => ({ class: u?.msgFont ? 'mf-' + u.msgFont : '', style: u?.msgColor ? `color:${u.msgColor}` : '' }),
  // Le cœur après le pseudo : ❤️ rouge pour les admins, sinon selon le genre choisi
  genderIcon: (g, role, grey) => (role === 'admin' || role === 'superadmin') ? '❤️' + (grey ? '🩶' : '') : ({ h: '💙', f: '🩷', g: '🖤', v: '🤎', t: '💜', x: '🤍' }[g] || '🤍'),
  GENDERS: [['h', 'Homme'], ['f', 'Femme'], ['x', 'Autre']],
  GENDER_COLORS: { h: '#4fb3ff', f: '#ff5fa2', g: '#c9ccd8', v: '#d09060', t: '#b46cff', x: '#a78bfa' },
  ROLES: ['user', 'moderator', 'admin', 'superadmin'],
  rank(u) { return LC.ROLES.indexOf(u?.role); },
  isAdminRole(u) { return LC.rank(u) >= 2; },
  roleLabel: r => ({ superadmin: 'Super-admin', admin: 'Admin', moderator: 'Modérateur', user: 'Membre' }[r] || r),
  // Niveaux de modérateur : durées en minutes (0 pour l'expulsion = la personne peut revenir)
  MOD_LEVELS: {
    1: { label: 'Modérateur 1', color: '#7cc8ff', kick: 0, exclusion: 1440, ban: 10080 },
    2: { label: 'Modérateur 2', color: '#2457c5', kick: 60, exclusion: 2880, ban: 43200 },
    3: { label: 'Modérateur 3', color: '#ff8a1f', kick: 10080, exclusion: 4320, ban: 525600 },
  },
  STAFF_RED: '#e5384d',
  // Nom complet du rôle, avec le niveau pour les modérateurs
  roleName(u) {
    if (!u) return '';
    if (u.role === 'moderator') return LC.MOD_LEVELS[u.modLevel || 1].label;
    return LC.roleLabel(u.role);
  },
  // Couleur du rôle : bleu clair / bleu foncé / orange pour les modérateurs, rouge pour les admins
  roleColor(u) {
    if (u?.role === 'moderator') return LC.MOD_LEVELS[u.modLevel || 1].color;
    if (u?.role === 'admin' || u?.role === 'superadmin') return LC.STAFF_RED;
    return '';
  },
  dur(min) {
    if (!min) return '';
    if (min % 525600 === 0) return `${min / 525600} an${min > 525600 ? 's' : ''}`;
    if (min % 43200 === 0) return `${min / 43200} mois`;
    if (min % 10080 === 0) return `${min / 10080} semaine${min > 10080 ? 's' : ''}`;
    if (min % 1440 === 0) return `${min / 1440} jour${min > 1440 ? 's' : ''}`;
    if (min % 60 === 0) return `${min / 60} h`;
    return `${min} min`;
  },

  // ----- Contenu du site (nom, couleurs, textes) modifiable par le super-admin -----
  site: null,
  async loadSite() {
    try { const cached = JSON.parse(localStorage.getItem('lc_site') || 'null'); if (cached) LC.applySite(cached); } catch (e) {}
    try {
      const { site } = await LC.api('/api/site');
      LC.applySite(site);
      try { localStorage.setItem('lc_site', JSON.stringify(site)); } catch (e) {}
      return site;
    } catch (e) { return LC.site; }
  },
  applySite(site) {
    if (!site) return;
    LC.site = site;
    const parts = site.siteName.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : null;
    document.querySelectorAll('.logo .word').forEach(w => w.replaceChildren(last ? parts.join(' ') + ' ' : '', LC.el('span', {}, last || parts[0])));
    if (document.title.includes(' — ')) document.title = document.title.replace(/^(\(\d+\) )?.*? — /, `$1${site.siteName} — `);
    else document.title = site.siteName;
    const root = document.documentElement.style;
    const season = LC.SEASONS[site.theme];
    const colors = season ? season.colors : [site.colorViolet, site.colorRose, site.colorGold];
    // les couleurs du site (ou de la saison) : seulement si le membre n'a pas choisi son propre thème 🎨
    ['--violet', '--rose', '--gold'].forEach(v => root.removeProperty(v));
    let st = document.getElementById('siteColors'); if (!st) { st = document.createElement('style'); st.id = 'siteColors'; document.head.append(st); }
    st.textContent = ':root:not([data-skin]) {' + ['--violet', '--rose', '--gold'].map((v, i) => (colors[i] ? `${v}:${colors[i]};` : '')).join('') + '}';
    if (site.colorRoomPerm) root.setProperty('--room-perm', site.colorRoomPerm);
    if (site.colorRoomTemp) root.setProperty('--room-temp', site.colorRoomTemp);
    LC.applySeason(site.theme);
    document.querySelectorAll('[data-site]').forEach(e => { e.textContent = site[e.dataset.site] || ''; });
    document.querySelectorAll('[data-site-rich]').forEach(e => e.replaceChildren(LC.emphasis(site[e.dataset.siteRich] || '')));
    document.dispatchEvent(new CustomEvent('site', { detail: site }));
  },
  // ----- Thèmes de fête -----
  SEASONS: {
    'automne-hiver': { label: 'Automne-Hiver', icon: '🍂', colors: ['#c2562f', '#f29a3a', '#5aa7e0'], fx: ['🍂', '🍁', '🍂', '❄️', '🍁'], anim: 'snow', flakes: true, flakesFew: true, greeting: '🍂 L\'automne s\'installe et l\'hiver approche : viens te réchauffer sur le chat ! ❄️' },
    hiver: { label: 'Hiver', icon: '❄️', colors: ['#5b8cff', '#8fd3ff', '#e6f4ff'], fx: ['❄️', '❅', '❆'], anim: 'snow', flakes: true, greeting: '❄️ L\'hiver est là : couvre-toi bien et viens te réchauffer sur le chat !' },
    noel: { label: 'Noël', icon: '🎄', colors: ['#1fa055', '#e63946', '#ffd166'], fx: ['❄️', '❄', '❅', '✨', '❆'], anim: 'snow', flakes: true, greeting: '🎄 Joyeux Noël à toutes et à tous !' },
    'nouvel-an': { label: 'Nouvel An', icon: '🎆', colors: ['#6d5dfc', '#ff4fd8', '#ffd700'], fx: ['✨', '🎉', '🎊', '🥂', '⭐'], anim: 'snow', greeting: '' },
    'saint-valentin': { label: 'Saint-Valentin', icon: '💘', colors: ['#ff3d7f', '#ff8fab', '#ffc2d1'], fx: ['💖', '💘', '💕', '🌹'], anim: 'float', greeting: '💘 Joyeuse Saint-Valentin ! Partagez l\'amour' },
    paques: { label: 'Pâques', icon: '🐣', colors: ['#3fbf7f', '#f472b6', '#facc15'], fx: ['🥚', '🐣', '🌷', '🐰', '🍫'], anim: 'snow', greeting: '🐣 Joyeuses Pâques ! La chasse aux œufs est ouverte' },
    ete: { label: 'Été', icon: '☀️', colors: ['#00b4ff', '#ff8a00', '#ffd60a'], fx: ['☀️', '🌴', '🍉', '🏖️', '🍹'], anim: 'float', greeting: '☀️ Bel été à tous !' },
  },
  greeting(key) {
    const s = LC.SEASONS[key];
    if (!s) return '';
    if (key === 'nouvel-an') { const d = new Date(); return `🎆 Bonne année ${d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()} ! Plein de bonheur à tous ✨`; }
    return s.greeting;
  },
  // les effets (feuilles, neige…) : coupés si le téléphone demande moins d'animations, SAUF si on les a rallumés avec le bouton « ✨ Effets »
  fxEnabled() { try { const v = localStorage.getItem('lc_fx'); return v === '1' || (v !== '0' && !matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return true; } },
  applySeason(key) {
    const s = LC.SEASONS[key];
    document.documentElement.dataset.season = s ? key : '';
    document.querySelectorAll('.logo').forEach(l => {
      l.querySelector('.season-badge')?.remove();
      if (s) l.append(LC.el('span', { class: 'season-badge', title: s.label }, s.icon));
    });
    document.querySelectorAll('[data-season-greeting]').forEach(e => { e.textContent = LC.greeting(key); e.classList.toggle('hidden', !s); });
    let box = document.getElementById('seasonFx');
    if (box) box.remove();
    if (!s || !LC.fxEnabled() || !document.body) return;
    box = LC.el('div', { id: 'seasonFx', class: 'season-fx ' + s.anim, 'aria-hidden': 'true' });
    const n = innerWidth < 760 ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const dur = 9 + Math.random() * 10;
      box.append(LC.el('span', { style: `left:${Math.random() * 100}%;animation-duration:${dur}s;animation-delay:-${Math.random() * dur}s;font-size:${12 + Math.random() * 16}px;--drift:${(Math.random() * 80 - 40).toFixed(0)}px` }, s.fx[i % s.fx.length]));
    }
    // Vraie neige : de petits flocons blancs qui tombent doucement, en plus des emojis
    if (s.flakes) {
      const m = (innerWidth < 760 ? 35 : 70) / (s.flakesFew ? 2 : 1);
      for (let i = 0; i < m; i++) {
        const dur = 7 + Math.random() * 12, size = 2 + Math.random() * 5;
        box.append(LC.el('i', { class: 'flake', style: `left:${Math.random() * 100}%;width:${size}px;height:${size}px;opacity:${(0.35 + Math.random() * 0.6).toFixed(2)};animation-duration:${dur}s;animation-delay:-${Math.random() * dur}s;--drift:${(Math.random() * 60 - 30).toFixed(0)}px;filter:blur(${size > 5 ? 1 : 0}px)` }));
      }
    }
    document.body.append(box);
  },
  toggleFx() {
    try { localStorage.setItem('lc_fx', LC.fxEnabled() ? '0' : '1'); } catch (e) {}
    LC.applySeason(LC.site?.theme);
    return LC.fxEnabled();
  },
  // Pluie de confettis (anniversaires, nouvel an…)
  confetti(emojis) {
    if (!LC.fxEnabled()) return;
    const colors = ['#ff5fa2', '#8b6cff', '#ffb547', '#33d6a6', '#4fb3ff', '#ff4d4d'];
    const box = LC.el('div', { class: 'confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < 90; i++) {
      const emoji = emojis && i % 6 === 0 ? emojis[i % emojis.length] : '';
      box.append(LC.el('i', { style: `left:${Math.random() * 100}%;background:${emoji ? 'none' : colors[i % colors.length]};animation-delay:${Math.random() * .8}s;animation-duration:${2.4 + Math.random() * 1.8}s;--r:${Math.random() * 720 - 360}deg;--x:${Math.random() * 160 - 80}px` }, emoji));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 5000);
  },
  MONTHS: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],

  // *mot* → mot mis en valeur (dégradé)
  emphasis(text) {
    const f = document.createDocumentFragment();
    String(text).split(/(\*[^*]+\*)/).forEach(p => f.append(/^\*[^*]+\*$/.test(p) ? LC.el('em', {}, p.slice(1, -1)) : p));
    return f;
  },
  // Mise en forme simple : # Titre, ## Sous-titre, - liste, **gras**, liens
  richText(text) {
    const root = document.createDocumentFragment();
    const inline = line => {
      const f = document.createDocumentFragment();
      String(line).split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/).forEach(p => {
        if (/^\*\*[^*]+\*\*$/.test(p)) f.append(LC.el('strong', {}, p.slice(2, -2)));
        else if (/^https?:\/\//.test(p)) f.append(LC.el('a', { href: p, target: '_blank', rel: 'noopener noreferrer' }, p));
        else f.append(p);
      });
      return f;
    };
    let list = null, para = [];
    const flush = () => {
      if (para.length) { root.append(LC.el('p', {}, ...para.flatMap((l, i) => (i ? [LC.el('br'), inline(l)] : [inline(l)])))); para = []; }
      if (list) { root.append(list); list = null; }
    };
    for (const raw of String(text).split('\n')) {
      const line = raw.trimEnd();
      if (/^#\s+/.test(line)) { flush(); root.append(LC.el('h1', {}, inline(line.replace(/^#\s+/, '')))); }
      else if (/^##+\s+/.test(line)) { flush(); root.append(LC.el('h2', {}, inline(line.replace(/^##+\s+/, '')))); }
      else if (/^[-•*]\s+/.test(line)) { if (para.length) { const l = list; list = null; flush(); list = l; } list = list || LC.el('ul'); list.append(LC.el('li', {}, inline(line.replace(/^[-•*]\s+/, '')))); }
      else if (!line.trim()) flush();
      else { if (list) { root.append(list); list = null; } para.push(line); }
    }
    flush();
    return root;
  },
  time(ts) { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); },
  // 📅 la date et l'heure d'un message : « Aujourd'hui 14:24 », « Hier 22:10 », « 16/11/2026 08:05 »
  when(ts) {
    const d = new Date(ts), now = new Date(), t = LC.time(ts), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    return diff === 0 ? 'Aujourd\'hui ' + t : diff === 1 ? 'Hier ' + t : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + t;
  },
  isDark(c) { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.12; },
  date(ts) { return ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; },
  // Néon de chaque personne sur tout le site : rouge = administrateurs, bleu = hommes, rose = femmes
  neonOf(u) {
    if (!u || u.role === 'moderation' || u.role === 'bot') return '';
    if (u.role === 'admin' || u.role === 'superadmin') return 'admin';
    return u.gender === 'h' ? 'h' : u.gender === 'f' ? 'f' : '';
  },
  avatar(u, big) {
    const nn = LC.neonOf(u);
    const a = LC.el('div', { class: 'avatar' + (big ? ' lg' : '') + (nn ? ' av-nn-' + nn : '') + (u.frame && u.frame !== 'none' ? ' frame frame-' + u.frame : '') + (u.avatarFx && u.avatarFx !== 'none' ? ' afx afx-' + u.avatarFx : ''), style: `--avbg:${u.color || '#8b6cff'};--accent:${u.accent || u.color || '#ff5fa2'}` });
    if (u.avatar) a.append(LC.el('img', { src: u.avatar, alt: '', loading: 'lazy' }));
    else a.append((u.username || '?')[0].toUpperCase());
    if (u.validated) a.append(LC.el('span', { class: 'v-tick', title: 'Accepté : voix et caméra validées' }, '✓'));
    return a;
  },
  // Badges de la douane : 🎙️ voix et 📷 caméra (vert = validé)
  douaneBadges(u, withPhoto = true) {
    return LC.el('span', { class: 'dbadges', title: `Voix ${u.voiceOk ? 'validée' : 'pas encore validée'} · Caméra ${u.camOk ? 'validée' : 'pas encore validée'}${withPhoto ? ' · Photo ' + (u.photoOk ? 'vérifiée' : 'pas vérifiée') : ''}` },
      LC.el('span', { class: 'dbadge' + (u.voiceOk ? ' ok' : '') }, LC.el('i', { class: 'di' }, '🎙️')), LC.el('span', { class: 'dbadge' + (u.camOk ? ' ok' : '') }, LC.el('i', { class: 'di' }, '📷')),
      withPhoto ? LC.photoBadge(u) : null);
  },
  // Badge V : photo de profil vérifiée par le staff
  photoBadge(u) { return LC.el('span', { class: 'dbadge vphoto' + (u.photoOk ? ' ok' : ''), title: u.photoOk ? 'Photo de profil vérifiée par le staff' : 'Photo de profil pas encore vérifiée' }, LC.el('i', { class: 'di' }, 'V')); },
  // Pseudo avec sa couleur et son effet
  // ⭕ la couleur autour de toute la ligne (photo + pseudo) dans la liste des connectés
  // 📱💻 connecté sur téléphone, tablette ou ordinateur
  deviceTag(u) { const D = { phone: ['📱', 'sur téléphone'], tablet: ['📲', 'sur tablette'], pc: ['💻', 'sur ordinateur'] }; const l = (u?.devices || []).filter(d => D[d]); if (!l.length) return null; return LC.el('span', { class: 'dev-tag', title: 'Connecté ' + l.map(d => D[d][1]).join(' et ') }, l.map(d => D[d][0]).join('')); },
  ringRow(u) { const [rs, rc, rc2] = String(u?.nameRing || '').split(':'); return rs ? { cls: ' nrr nrr-' + rs + (rc2 ? ' nrr2' : ''), style: `--nr:${rc || '#ff5fa2'};--c:${u.color || '#8b6cff'}` + (rc2 ? `;--nr2:${rc2}` : '') } : { cls: '', style: '' }; },
  name(u, extraClass = '') {
    const fx = u.nameEffect && u.nameEffect !== 'none' ? ' fx fx-' + u.nameEffect : '';
    const nn = fx ? '' : LC.neonOf(u);
    const [rs, rc, rc2] = String(u.nameRing || '').split(':'); /* ⭕ la couleur (ou les 2 couleurs) autour du pseudo */
    const n = LC.el('span', { class: 'uname' + fx + (nn ? ' nn-' + nn : '') + (LC.isDark(u.color) ? ' uname-black' : '') + (rs ? ' nr nr-' + rs + (rc2 ? ' nr2' : '') : '') + (extraClass ? ' ' + extraClass : ''), style: `--c:${u.color || '#8b6cff'};color:${u.color || '#8b6cff'}` + (rc ? `;--nr:${rc}` : '') + (rc2 ? `;--nr2:${rc2}` : '') }, u.username);
    // badge acheté dans la boutique 💰
    const badge = u.shopBadge ? LC.el('span', { class: 'shop-badge', title: 'Badge de la boutique' }, u.shopBadge) : null;
    const T = LC.COIN_TIERS[(u.coinTier || 0) - 1]; // 💰 le badge du palier de pièces
    const tier = T ? LC.el('span', { class: 'coin-tier t' + u.coinTier, title: `💰 Palier ${T[1]} : ${T[2]} pièces et plus` }, T[0]) : null;
    if (!u.isBirthday && !badge && !tier) return n;
    return LC.el('span', { class: 'uname-wrap' }, n, badge, tier, u.isBirthday ? LC.el('span', { class: 'bday-cake', title: 'C\'est son anniversaire aujourd\'hui !' }, ' 🎂') : null);
  },
  COIN_TIERS: [['🥉', 'Bronze', '100'], ['🥈', 'Argent', '500'], ['🥇', 'Or', '1 000'], ['💠', 'Platine', '2 500'], ['💎', 'Diamant', '5 000'], ['👑', 'Royal', '10 000'], ['🌟', 'Légende', '25 000'], ['🚀', 'Mythique', '50 000'], ['🏆', 'Milliardaire', '100 000']],
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
  // Fenêtre de sanction. Un modérateur a les durées fixes de son niveau ; un admin choisit.
  sanctionModal(u, { toast, onDone } = {}) {
    const el = LC.el;
    const say = toast || (t => alert(t));
    const me = (typeof state !== 'undefined' && state.me) || (typeof window.me !== 'undefined' && window.me) || LC.me || {};
    const isMod = me.role === 'moderator';
    const L = LC.MOD_LEVELS[me.modLevel || 1];
    const label = (t, min) => ({ kick: '👢 Expulser', exclusion: '🚪 Exclure', ban: '⛔ Bannir' }[t]) + (t === 'kick' && !min ? ' (peut revenir)' : ' ' + LC.dur(min));
    const TYPES = [['warn', '⚠️ Avertir'], ['mute', '🔇 Rendre muet'],
      ...(isMod ? ['kick', 'exclusion', 'ban'].map(t => [t, label(t, L[t])]) : [['kick', '👢 Expulser'], ['exclusion', '🚪 Exclure'], ['ban', '⛔ Bannir']])];
    const QUICK = ['Insultes', 'Spam / flood', 'Harcèlement', 'Contenu inapproprié', 'Pseudo inapproprié', 'Publicité', 'Non-respect des règles'];
    const CHOICES = {
      mute: [[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 heure'], [180, '3 heures'], [1440, '24 heures'], [10080, '7 jours']],
      kick: [[0, 'Peut revenir tout de suite'], [60, '1 heure'], [1440, '24 heures'], [10080, '1 semaine']],
      exclusion: [[1440, '24 heures'], [2880, '48 heures'], [4320, '72 heures'], [10080, '1 semaine']],
      ban: [[10080, '1 semaine'], [43200, '1 mois'], [525600, '1 an'], [0, 'Définitif']],
    };
    let type = 'warn';
    const duration = el('select', { class: 'input' });
    const durField = el('div', { class: 'field hidden' }, el('label', {}, 'Durée'), duration);
    const reason = el('textarea', { class: 'input', rows: 3, maxlength: 200, placeholder: 'Explique pourquoi (la personne le verra)' });
    const err = el('div', { class: 'error' });
    // 🔗 bannir aussi tous ses appareils (PC, téléphone, tablette…) et ses autres comptes sur ces appareils
    const every = el('input', { type: 'checkbox', checked: true });
    const linkInfo = el('small', { class: 'help', style: 'display:block;margin-top:4px' }, '⏳ Recherche de ses appareils…');
    const everyField = el('div', { class: 'field hidden ban-every' }, el('label', { class: 'switch', style: 'margin:0' }, el('span', {}, '🔗 Bannir aussi tous ses appareils (PC, téléphone, tablette…) et ses autres comptes sur ces appareils'), every), linkInfo);
    LC.api(`/api/admin/users/${u.id}/links`).then(l => {
      const acc = l.accounts.filter(a => a.strong), weak = l.accounts.filter(a => !a.strong);
      linkInfo.replaceChildren(`📱 ${l.devices} appareil${l.devices > 1 ? 's' : ''} · 🌐 ${l.ips.length} connexion${l.ips.length > 1 ? 's' : ''}`,
        acc.length ? el('div', {}, '👥 Autres comptes sur ses appareils (bannis aussi) : ', el('b', {}, acc.map(a => a.username + (a.banned ? ' ⛔' : '')).join(', '))) : null,
        weak.length ? el('div', {}, '🌐 Même connexion seulement (pas bannis, peut-être sa famille ou le même wifi) : ', weak.map(a => a.username).join(', ')) : null);
    }).catch(() => linkInfo.textContent = '');
    const typeRow = el('div', { class: 'choice-row' });
    const drawTypes = () => {
      typeRow.replaceChildren(...TYPES.map(([v, l]) => el('button', { type: 'button', class: 'choice' + (type === v ? ' active' : ''), onclick: () => { type = v; drawTypes(); } }, l)));
      // Les modérateurs n'ont pas le choix de la durée (sauf pour le muet)
      const show = type === 'mute' || (!isMod && CHOICES[type]);
      durField.classList.toggle('hidden', !show);
      everyField.classList.toggle('hidden', type !== 'ban');
      if (show) duration.replaceChildren(...CHOICES[type].map(([v, l], i) => el('option', { value: v, selected: type === 'mute' ? v === 15 : i === 0 }, l)));
    };
    drawTypes();
    const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } });
    back.append(el('div', { class: 'card modal' },
      el('h3', {}, '🛡️ Sanctionner ' + u.username),
      isMod ? el('p', { class: 'help', style: 'margin:-4px 0 10px' }, `Tu es ${L.label} : les durées de ton niveau s'appliquent.`) : null,
      el('div', { class: 'field' }, el('label', {}, 'Type de sanction'), typeRow),
      durField,
      everyField,
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
            else if (type === 'mute') await LC.api(`/api/admin/users/${u.id}/mute`, { method: 'POST', body: { minutes: parseInt(duration.value, 10), reason: r } });
            else {
              const min = isMod ? L[type] : parseInt(duration.value, 10);
              if (type === 'ban' && !confirm(`Bannir ${u.username} ${min ? 'pendant ' + LC.dur(min) : 'définitivement'} ?`)) return;
              var res = await LC.api(`/api/admin/users/${u.id}/sanction`, { method: 'POST', body: { type, minutes: min, reason: r, everywhere: type === 'ban' ? every.checked : false } });
            }
            back.remove();
            const ev = typeof res !== 'undefined' && res?.everywhere;
            say(`✅ Sanction appliquée à ${u.username} (notifié)` + (ev ? ` · 🔗 ${ev.devices} appareil(s) et ${ev.ips} connexion(s) bannis${ev.accounts.length ? ', + ' + ev.accounts.join(', ') : ''}` : ''));
            onDone && onDone(type);
          } catch (e) { err.textContent = e.message; }
        } }, 'Appliquer la sanction'))));
    document.body.append(back);
  },
  // 🏅 La petite rangée de badges sous le pseudo
  badgesRow(list, small) {
    if (!list || !list.length) return null;
    return LC.el('div', { class: 'ubadges' + (small ? ' sm' : '') }, ...list.map((b, i) => LC.el('span', { class: 'ubadge', style: `animation-delay:${i * .12}s`, title: `${b.n} : ${b.d}`, onclick: e => { e.stopPropagation(); typeof toast === 'function' && toast(`${b.i} ${b.n} · ${b.d}`); } }, b.i)));
  },
  badge(u) {
    // 💻 Le Développeur du site : son badge à lui, en plus de son rôle
    // 👑 Miss & Mister Paradise du mois
    if (u.crown) { const r = LC.badge({ ...u, crown: '' }); const c = LC.el('span', { class: 'badge crown', title: u.crown === 'miss' ? 'Miss Paradise du mois' : 'Mister Paradise du mois' }, u.crown === 'miss' ? '👸 Miss' : '🤴 Mister'); return r ? LC.el('span', { class: 'badge-pair' }, r, ' ', c) : c; }
    if (u.dev) { const r = LC.badge({ ...u, dev: false }); const d = LC.el('span', { class: 'badge dev', title: 'Le développeur du site' }, '💻 ', LC.el('span', { class: 'dev-long' }, 'Développeur'), LC.el('span', { class: 'dev-short' }, 'Dev')); return r ? LC.el('span', { class: 'badge-pair' }, r, ' ', d) : d; }
    if (u.role === 'moderation') return LC.el('span', { class: 'badge moderator' }, 'Équipe');
    if (u.role === 'superadmin') return LC.el('span', { class: 'badge superadmin' }, 'Super Admin');
    if (u.role === 'admin') return LC.el('span', { class: 'badge admin' }, 'Admin');
    if (u.role === 'moderator') { const l = u.modLevel || 1; return LC.el('span', { class: 'badge moderator mod' + l, title: LC.MOD_LEVELS[l].label }, 'Modo ' + l); }
    if (u.isGuest) return LC.el('span', { class: 'badge guest' }, 'Invité');
    return null;
  },
};

document.addEventListener('DOMContentLoaded', () => LC.loadSite());
