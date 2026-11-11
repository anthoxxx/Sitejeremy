// Sécurité d'affichage : un élément vide (null) ne doit jamais s'écrire « null » à l'écran
for (const m of ['replaceChildren', 'append', 'prepend']) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...items) { return orig.apply(this, items.filter(x => x != null && x !== false)); };
}
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
  genderIcon: g => ({ h: '💙', f: '🩷', x: '💜' }[g] || '💜'),
  GENDERS: [['h', '💙 Homme'], ['f', '🩷 Femme'], ['x', '💜 Autre']],
  GENDER_COLORS: { h: '#4fb3ff', f: '#ff5fa2', x: '#a78bfa' },
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
    ['--violet', '--rose', '--gold'].forEach((v, i) => { if (colors[i]) root.setProperty(v, colors[i]); });
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
  fxEnabled() { try { return localStorage.getItem('lc_fx') !== '0' && !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } },
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
  date(ts) { return ts ? new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; },
  // Néon de chaque personne sur tout le site : rouge = administrateurs, bleu = hommes, rose = femmes
  neonOf(u) {
    if (!u || u.role === 'moderation' || u.role === 'bot') return '';
    if (u.role === 'admin' || u.role === 'superadmin') return 'admin';
    return u.gender === 'h' ? 'h' : u.gender === 'f' ? 'f' : '';
  },
  avatar(u, big) {
    const nn = LC.neonOf(u);
    const a = LC.el('div', { class: 'avatar' + (big ? ' lg' : '') + (nn ? ' av-nn-' + nn : '') + (u.frame && u.frame !== 'none' ? ' frame frame-' + u.frame : ''), style: `--avbg:${u.color || '#8b6cff'};--accent:${u.accent || u.color || '#ff5fa2'}` });
    if (u.avatar) a.append(LC.el('img', { src: u.avatar, alt: '', loading: 'lazy' }));
    else a.append((u.username || '?')[0].toUpperCase());
    if (u.validated) a.append(LC.el('span', { class: 'v-tick', title: 'Accepté : voix et caméra validées' }, '✓'));
    return a;
  },
  // Badges de la douane : 🎙️ voix et 📷 caméra (vert = validé)
  douaneBadges(u, withPhoto = true) {
    return LC.el('span', { class: 'dbadges', title: `Voix ${u.voiceOk ? 'validée' : 'pas encore validée'} · Caméra ${u.camOk ? 'validée' : 'pas encore validée'}${withPhoto ? ' · Photo ' + (u.photoOk ? 'vérifiée' : 'pas vérifiée') : ''}` },
      LC.el('span', { class: 'dbadge' + (u.voiceOk ? ' ok' : '') }, '🎙️'), LC.el('span', { class: 'dbadge' + (u.camOk ? ' ok' : '') }, '📷'),
      withPhoto ? LC.photoBadge(u) : null);
  },
  // Badge V : photo de profil vérifiée par le staff
  photoBadge(u) { return LC.el('span', { class: 'dbadge vphoto' + (u.photoOk ? ' ok' : ''), title: u.photoOk ? 'Photo de profil vérifiée par le staff' : 'Photo de profil pas encore vérifiée' }, 'V'); },
  // Pseudo avec sa couleur et son effet
  name(u, extraClass = '') {
    const fx = u.nameEffect && u.nameEffect !== 'none' ? ' fx fx-' + u.nameEffect : '';
    const nn = fx ? '' : LC.neonOf(u);
    const n = LC.el('span', { class: 'uname' + fx + (nn ? ' nn-' + nn : '') + (extraClass ? ' ' + extraClass : ''), style: `--c:${u.color || '#8b6cff'};color:${u.color || '#8b6cff'}` }, u.username);
    // badge acheté dans la boutique 💰
    const badge = u.shopBadge ? LC.el('span', { class: 'shop-badge', title: 'Badge de la boutique' }, u.shopBadge) : null;
    if (!u.isBirthday && !badge) return n;
    return LC.el('span', { class: 'uname-wrap' }, n, badge, u.isBirthday ? LC.el('span', { class: 'bday-cake', title: 'C\'est son anniversaire aujourd\'hui !' }, ' 🎂') : null);
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
    const typeRow = el('div', { class: 'choice-row' });
    const drawTypes = () => {
      typeRow.replaceChildren(...TYPES.map(([v, l]) => el('button', { type: 'button', class: 'choice' + (type === v ? ' active' : ''), onclick: () => { type = v; drawTypes(); } }, l)));
      // Les modérateurs n'ont pas le choix de la durée (sauf pour le muet)
      const show = type === 'mute' || (!isMod && CHOICES[type]);
      durField.classList.toggle('hidden', !show);
      if (show) duration.replaceChildren(...CHOICES[type].map(([v, l], i) => el('option', { value: v, selected: type === 'mute' ? v === 15 : i === 0 }, l)));
    };
    drawTypes();
    const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } });
    back.append(el('div', { class: 'card modal' },
      el('h3', {}, '🛡️ Sanctionner ' + u.username),
      isMod ? el('p', { class: 'help', style: 'margin:-4px 0 10px' }, `Tu es ${L.label} : les durées de ton niveau s'appliquent.`) : null,
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
            else if (type === 'mute') await LC.api(`/api/admin/users/${u.id}/mute`, { method: 'POST', body: { minutes: parseInt(duration.value, 10), reason: r } });
            else {
              const min = isMod ? L[type] : parseInt(duration.value, 10);
              if (type === 'ban' && !confirm(`Bannir ${u.username} ${min ? 'pendant ' + LC.dur(min) : 'définitivement'} ?`)) return;
              await LC.api(`/api/admin/users/${u.id}/sanction`, { method: 'POST', body: { type, minutes: min, reason: r } });
            }
            back.remove();
            say(`✅ Sanction appliquée à ${u.username} (notifié)`);
            onDone && onDone(type);
          } catch (e) { err.textContent = e.message; }
        } }, 'Appliquer la sanction'))));
    document.body.append(back);
  },
  badge(u) {
    if (u.role === 'moderation') return LC.el('span', { class: 'badge moderator' }, 'Équipe');
    if (u.role === 'superadmin') return LC.el('span', { class: 'badge superadmin' }, 'Super Admin');
    if (u.role === 'admin') return LC.el('span', { class: 'badge admin' }, 'Admin');
    if (u.role === 'moderator') { const l = u.modLevel || 1; return LC.el('span', { class: 'badge moderator mod' + l, title: LC.MOD_LEVELS[l].label }, 'Modo ' + l); }
    if (u.isGuest) return LC.el('span', { class: 'badge guest' }, 'Invité');
    return null;
  },
};

document.addEventListener('DOMContentLoaded', () => LC.loadSite());
