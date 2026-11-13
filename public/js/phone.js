// The Paradise — le téléphone virtuel 📱
// Un vrai petit téléphone sur le site : Messages, Appels, Snap (photos qui disparaissent, stories, flammes 🔥),
// Contacts, Appareil photo, et des raccourcis vers la Ville, les jeux, la boutique…
const Phone = (() => {
  let root, screen, stack = [], snapsUnread = 0, pmUnread = 0, convOpen = null, camStream = null, timers = [];
  const WALLS = {
    neon: 'radial-gradient(circle at 20% 15%, #ff4fd8 0, transparent 45%), radial-gradient(circle at 85% 80%, #2fa8ff 0, transparent 45%), linear-gradient(160deg, #2a0f48, #0b0618)',
    plage: 'linear-gradient(180deg, #ffb36b 0%, #ff6fa8 40%, #6a5cff 75%, #1a2a6c 100%)',
    ocean: 'linear-gradient(160deg, #38dce6, #2f6fd6 55%, #1a1a5e)',
    foret: 'linear-gradient(160deg, #2bd07a, #1c7a4a 55%, #0f2e22)',
    or: 'linear-gradient(160deg, #ffe08a, #d99a00 55%, #4a2c00)',
    nuit: 'radial-gradient(circle at 70% 20%, #ffffff22 0, transparent 20%), linear-gradient(180deg, #0b1640, #1a0b2e)',
  };
  const opt = (k, d) => { try { return localStorage.getItem('ph_' + k) || d; } catch (e) { return d; } };
  const setOpt = (k, v) => { try { localStorage.setItem('ph_' + k, v); } catch (e) {} };
  const time = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ago = ts => { const s = Math.floor((Date.now() - ts) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : new Date(ts).toLocaleDateString('fr-FR'); };
  const friends = () => (state.friends?.friends || []).map(f => ({ ...f, online: (state.online || []).some(o => o.id === f.id) }));
  const back = () => { stack.pop(); stopCam(); const f = stack.pop(); f ? go(f.fn, f.title) : home(); };
  const dark = on => root?.querySelector('.ph-device').classList.toggle('light', !on); // l'heure en haut : blanche sur fond sombre, noire sur fond clair
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- Le téléphone ----------
  function build() {
    root = el('div', { class: 'phone hidden', onclick: e => { if (e.target === root) close(); } },
      el('div', { class: 'ph-device' },
        el('div', { class: 'ph-status' }, el('b', { class: 'ph-time' }, time()), el('span', { class: 'ph-notch' }), el('span', { class: 'ph-icons' }, '📶 🔋')),
        screen = el('div', { class: 'ph-screen' }),
        el('div', { class: 'ph-nav' },
          el('button', { class: 'ph-navbtn', title: 'Retour', onclick: () => (stack.length > 1 ? back() : home()) }, '‹'),
          el('button', { class: 'ph-homebtn', title: 'Accueil', onclick: () => home() }),
          el('button', { class: 'ph-navbtn', title: 'Ranger le téléphone', onclick: () => close() }, '✕'))));
    document.body.append(root);
    setInterval(() => { const t = root.querySelector('.ph-time'); if (t) t.textContent = time(); const c = root.querySelector('.ph-clock b'); if (c) c.textContent = time(); }, 15000);
  }
  function open(app) {
    if (state.me?.isGuest) return toast('Inscris-toi pour avoir ton téléphone 📱');
    if (!root) build();
    root.classList.remove('hidden'); document.body.classList.add('phone-open');
    refreshBadges();
    if (app && APPS[app]) APPS[app].open(); else home();
  }
  function close() { if (!root) return; stopCam(); clearTimers(); convOpen = null; root.classList.add('hidden'); document.body.classList.remove('phone-open'); }
  const isOpen = () => root && !root.classList.contains('hidden');
  function go(fn, title, actions) {
    stopCam(); clearTimers();
    stack.push({ fn, title });
    screen.style.background = ''; dark(!title);
    const body = el('div', { class: 'ph-app-body' });
    screen.replaceChildren(el('div', { class: 'ph-app' },
      title ? el('div', { class: 'ph-bar' }, el('button', { class: 'ph-back', onclick: back }, '‹'), el('b', {}, title), el('span', { class: 'ph-bar-act' }, ...(actions || []))) : null, body));
    fn(body);
  }

  // ---------- L'écran d'accueil ----------
  const APPS = {
    messages: { icon: '💬', name: 'Messages', c: '#2bd07a', open: () => go(messages, '💬 Messages'), badge: () => pmUnread },
    phone: { icon: '📞', name: 'Téléphone', c: '#2fa8ff', open: () => go(calls, '📞 Téléphone') },
    snap: { icon: '👻', name: 'Snap', c: '#ffe600', open: () => go(snapHome, '👻 Snap', [el('button', { class: 'ph-mini', onclick: () => go(camera, '') }, '📷')]), badge: () => snapsUnread },
    camera: { icon: '📷', name: 'Appareil photo', c: '#9aa3b2', open: () => go(camera, '') },
    contacts: { icon: '👥', name: 'Contacts', c: '#ff8a1f', open: () => go(contacts, '👥 Contacts') },
    city: { icon: '🏙️', name: 'Ville', c: '#c64dff', open: () => { close(); window.Island?.open(); } },
    games: { icon: '🎮', name: 'Jeux', c: '#ff2d55', open: () => { close(); Hub.open(); } },
    shop: { icon: '💰', name: 'Boutique', c: '#ffd34d', open: () => { close(); window.Shop?.open(); } },
    quests: { icon: '🎯', name: 'Quêtes', c: '#38dce6', open: () => { close(); window.Progress?.open(); } },
    pet: { icon: '🐾', name: 'Mon animal', c: '#ff5fa2', open: () => { close(); window.Pets?.open(); } },
    fortune: { icon: '🔮', name: 'Voyante', c: '#8b5cf6', open: () => { close(); window.Fortune?.open(); } },
    notifs: { icon: '🔔', name: 'Notifs', c: '#ff8a1f', open: () => { close(); $('notifBtn')?.click(); } },
    settings: { icon: '⚙️', name: 'Réglages', c: '#6b7280', open: () => go(settings, '⚙️ Réglages') },
  };
  function appIcon(k, small) {
    const a = APPS[k], n = a.badge ? a.badge() : 0;
    return el('button', { class: 'ph-appicon' + (small ? ' dock' : ''), onclick: () => a.open() },
      el('span', { class: 'ph-ico', style: `--c:${a.c}` }, a.icon, n ? el('i', {}, n > 99 ? '99+' : n) : null), small ? null : el('small', {}, a.name));
  }
  function home() {
    stopCam(); clearTimers(); stack = []; convOpen = null;
    screen.style.background = WALLS[opt('wall', 'neon')] || WALLS.neon; dark(true);
    const d = new Date();
    screen.replaceChildren(el('div', { class: 'ph-home' },
      el('div', { class: 'ph-clock' }, el('b', {}, time()), el('small', {}, d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))),
      el('div', { class: 'ph-grid' }, ...['messages', 'snap', 'phone', 'contacts', 'camera', 'city', 'games', 'shop', 'quests', 'pet', 'fortune', 'notifs', 'settings'].map(k => appIcon(k))),
      el('div', { class: 'ph-dock' }, ...['phone', 'messages', 'snap', 'camera'].map(k => appIcon(k, true)))));
  }
  async function refreshBadges() {
    try { const d = await api('/api/phone/badge'); snapsUnread = d.snaps; } catch (e) {}
    pmUnread = [...(state.convs?.values?.() || [])].reduce((s, c) => s + (c.unread || 0), 0);
    const b = $('phoneBtn'); if (b) { const n = snapsUnread + pmUnread; b.querySelector('.notif-count').textContent = n; b.querySelector('.notif-count').classList.toggle('hidden', !n); }
    if (isOpen() && !stack.length) home();
  }

  // ---------- 💬 Messages ----------
  async function messages(body) {
    body.replaceChildren(el('div', { class: 'ph-wait' }, 'Chargement…'));
    let d; try { d = await api('/api/pm'); } catch (e) { return body.replaceChildren(el('div', { class: 'ph-wait' }, e.message)); }
    const list = d.conversations || [];
    body.replaceChildren(
      el('button', { class: 'ph-new', onclick: () => pickFriend('Nouveau message', u => go(b => conversation(b, u), u.username)) }, '✏️ Nouveau message'),
      ...(list.length ? list.map(c => el('button', { class: 'ph-row', onclick: () => go(b => conversation(b, c.user), c.user.username, [el('button', { class: 'ph-mini', onclick: () => Call.start(c.user, false) }, '📞'), el('button', { class: 'ph-mini', onclick: () => Call.start(c.user, true) }, '📹')]) },
        avatarOn(c.user, c.online), el('div', { class: 'ph-row-txt' }, el('b', {}, c.user.username), el('small', {}, c.last?.content || '')),
        el('div', { class: 'ph-row-end' }, el('small', {}, c.last ? ago(c.last.created_at) : ''), c.unread ? el('i', { class: 'ph-dot' }, c.unread) : null)))
        : [el('div', { class: 'ph-wait' }, 'Pas encore de messages 💬')]));
  }
  async function conversation(body, u) {
    convOpen = u.id;
    const list = el('div', { class: 'ph-bubbles' });
    const input = el('input', { class: 'ph-input', placeholder: 'Message…', maxlength: 1000 });
    const file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { const url = await upload(f); socket.emit('pm', { to: u.id, image: { url }, text: '' }, r => r?.error && toast(r.error)); } catch (e) { toast(e.message); } } });
    const sendIt = () => { const t = input.value.trim(); if (!t) return; input.value = ''; socket.emit('pm', { to: u.id, text: t }, r => r?.error && toast(r.error)); };
    body.classList.add('ph-chat');
    body.replaceChildren(list, el('div', { class: 'ph-compose' }, el('button', { class: 'ph-mini', onclick: () => file.click() }, '🖼️'), file, input, el('button', { class: 'ph-send', onclick: sendIt }, '➤')));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendIt(); } });
    try { const d = await api('/api/pm/' + u.id); list.replaceChildren(...d.messages.map(bubble)); list.scrollTop = list.scrollHeight; } catch (e) {}
    const c = state.convs?.get(u.id); if (c) c.unread = 0; socket.emit('pm_read', u.id); refreshBadges();
  }
  const bubble = m => el('div', { class: 'ph-bub ' + (m.from === state.me.id ? 'me' : 'them') },
    m.kind === 'image' ? el('img', { src: m.media, alt: '', onclick: () => window.open(m.media, '_blank') }) : m.kind === 'audio' ? el('audio', { src: m.media, controls: true }) : null,
    m.kind !== 'audio' && !(m.kind === 'image' && m.content === '🖼️ Photo') ? el('span', {}, m.content) : null, el('small', {}, new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })));
  socket.on('pm', m => {
    if (isOpen() && convOpen && (m.from === convOpen || m.to === convOpen)) { const l = root.querySelector('.ph-bubbles'); if (l) { l.append(bubble(m)); l.scrollTop = l.scrollHeight; } if (m.from === convOpen) socket.emit('pm_read', convOpen); }
    else if (m.from !== state.me?.id) { setTimeout(refreshBadges, 300); if (isOpen()) ping(`💬 ${m.fromUser?.username || 'Message'} : ${m.content}`, () => go(b => conversation(b, m.fromUser), m.fromUser.username)); }
  });

  // ---------- 📞 Téléphone ----------
  const recents = () => { try { return JSON.parse(localStorage.getItem('ph_calls_' + state.me.id) || '[]'); } catch (e) { return []; } };
  function logCall(u, video, way) { const l = recents(); l.unshift({ id: u.id, username: u.username, avatar: u.avatar || '', color: u.color, gender: u.gender, video, way, at: Date.now() }); try { localStorage.setItem('ph_calls_' + state.me.id, JSON.stringify(l.slice(0, 40))); } catch (e) {} }
  function calls(body, tab = 'contacts') {
    const f = friends().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
    const others = (state.online || []).filter(o => o.id !== state.me.id && !f.some(x => x.id === o.id) && !o.ghost);
    const row = (u, online, extra) => el('div', { class: 'ph-row' }, avatarOn(u, online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username), el('small', {}, extra || (online ? '🟢 En ligne' : '⚪ Hors ligne'))),
      el('button', { class: 'ph-call a', disabled: !online, onclick: () => Call.start(u, false) }, '📞'), el('button', { class: 'ph-call v', disabled: !online, onclick: () => Call.start(u, true) }, '📹'));
    body.replaceChildren(
      el('div', { class: 'ph-tabs' }, ...[['contacts', '👥 Amis'], ['online', '🟢 En ligne'], ['recent', '🕘 Récents']].map(([k, l]) => el('button', { class: tab === k ? 'on' : '', onclick: () => calls(body, k) }, l))),
      ...(tab === 'contacts' ? (f.length ? f.map(u => row(u, u.online)) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis pour les appeler 🤝')])
        : tab === 'online' ? (others.length ? others.map(u => row(u, true)) : [el('div', { class: 'ph-wait' }, 'Personne d\'autre en ligne')])
          : (recents().length ? recents().map(c => row(c, (state.online || []).some(o => o.id === c.id), `${c.way === 'in' ? '↙️ Reçu' : '↗️ Passé'} ${c.video ? '📹' : '📞'} · ${ago(c.at)}`)) : [el('div', { class: 'ph-wait' }, 'Aucun appel pour l\'instant')])));
  }
  // les appels passés et reçus vont dans « Récents »
  if (window.Call) {
    const start = Call.start.bind(Call); Call.start = (u, video) => { logCall(u, video, 'out'); if (isOpen()) close(); return start(u, video); };
    socket.on('call_incoming', d => { if (d?.from) logCall(d.from, !!d.video, 'in'); if (isOpen()) close(); });
  }

  // ---------- 👥 Contacts ----------
  function contacts(body) {
    const f = friends();
    body.replaceChildren(...(f.length ? f.map(u => el('div', { class: 'ph-row' }, avatarOn(u, u.online),
      el('div', { class: 'ph-row-txt', onclick: () => { close(); openProfile(u.id); } }, el('b', {}, u.username), el('small', {}, [u.age ? u.age + ' ans' : '', u.city].filter(Boolean).join(' · ') || 'Mon ami')),
      el('button', { class: 'ph-mini', title: 'Message', onclick: () => go(b => conversation(b, u), u.username) }, '💬'),
      el('button', { class: 'ph-mini', title: 'Snap', onclick: () => go(b => camera(b, [u.id]), '') }, '👻'),
      el('button', { class: 'ph-mini', title: 'Appeler', disabled: !u.online, onclick: () => Call.start(u, false) }, '📞')))
      : [el('div', { class: 'ph-wait' }, 'Tu n\'as pas encore d\'amis : ajoute-en depuis leur profil 🤝')]));
  }

  // ---------- 👻 Snap ----------
  async function snapHome(body) {
    body.classList.add('ph-snap');
    body.replaceChildren(el('div', { class: 'ph-wait' }, 'Chargement…'));
    let people = [], stories = [];
    try { [people, stories] = await Promise.all([api('/api/phone/snaps').then(d => d.people), api('/api/phone/stories').then(d => d.stories)]); } catch (e) { return body.replaceChildren(el('div', { class: 'ph-wait' }, e.message)); }
    const mineStory = stories.find(s => s.user.id === state.me.id);
    body.replaceChildren(
      el('div', { class: 'ph-stories' },
        el('button', { class: 'ph-story me', onclick: () => (mineStory ? viewStories([mineStory], 0) : go(b => camera(b, [], true), '')) }, el('span', { class: 'ph-st-ring' + (mineStory ? '' : ' add') }, LC.avatar(state.me)), el('small', {}, mineStory ? 'Ma story' : '＋ Ma story')),
        ...stories.filter(s => s.user.id !== state.me.id).map((s, i, all) => el('button', { class: 'ph-story', onclick: () => viewStories(all, i) }, el('span', { class: 'ph-st-ring' + (s.items.every(x => x.seen) ? ' seen' : '') }, LC.avatar(s.user)), el('small', {}, s.user.username)))),
      ...(people.length ? people.map(p => {
        const status = p.unread.length ? el('span', { class: 'ph-snap-st new' }, '🟥 Nouveau snap · touche pour voir') : p.sentAt ? el('span', { class: 'ph-snap-st' }, p.sentOpened ? `👀 Ouvert · ${ago(p.sentAt)}` : `📤 Envoyé · ${ago(p.sentAt)}`) : el('span', { class: 'ph-snap-st' }, 'Touche 📷 pour lui envoyer un snap');
        return el('div', { class: 'ph-row' + (p.unread.length ? ' unread' : '') }, LC.avatar(p.user),
          el('div', { class: 'ph-row-txt', onclick: () => (p.unread.length ? viewSnaps(p.unread) : go(b => camera(b, [p.user.id]), '')) }, el('b', {}, p.user.username, p.streak ? el('span', { class: 'ph-flame' }, ` 🔥${p.streak}`) : null), status),
          el('button', { class: 'ph-mini', onclick: () => go(b => camera(b, [p.user.id]), '') }, '📷'));
      }) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis pour vous envoyer des snaps 👻')]),
      el('small', { class: 'ph-hint' }, '🔥 Envoyez-vous un snap chaque jour pour garder votre flamme !'),
      el('button', { class: 'ph-shutter-big', onclick: () => go(camera, '') }, '📷'));
  }
  // Ouvrir les snaps reçus, l'un après l'autre, avec le compte à rebours
  async function viewSnaps(ids) {
    const id = ids.shift(); if (!id) return go(snapHome, '👻 Snap');
    let s; try { s = await api(`/api/phone/snaps/${id}/open`, { method: 'POST' }); } catch (e) { toast(e.message); return go(snapHome, '👻 Snap'); }
    clearTimers(); stack.push({ fn: snapHome, title: '👻 Snap' });
    const ring = el('span', { class: 'ph-count' }, s.seconds || '∞');
    const view = el('div', { class: 'ph-viewer', onclick: () => viewSnaps(ids) },
      el('img', { src: s.media, alt: '' }), s.caption ? el('div', { class: 'ph-caption' }, s.caption) : null,
      el('div', { class: 'ph-v-top' }, LC.avatar(s.from), el('b', {}, s.from.username), el('small', {}, ago(s.createdAt)), ring),
      el('small', { class: 'ph-v-tap' }, 'Touche pour passer · ce snap va disparaître 👻'));
    screen.style.background = '#000'; dark(true); screen.replaceChildren(view);
    if (s.seconds) { let left = s.seconds; const tick = () => { left--; ring.textContent = left; if (left <= 0) return viewSnaps(ids); timers.push(setTimeout(tick, 1000)); }; timers.push(setTimeout(tick, 1000)); }
    snapsUnread = Math.max(0, snapsUnread - 1); refreshBadges();
  }
  function viewStories(groups, gi, ii = 0) {
    const g = groups[gi]; if (!g) return go(snapHome, '👻 Snap');
    const it = g.items[ii]; if (!it) return viewStories(groups, gi + 1, 0);
    clearTimers(); stack.push({ fn: snapHome, title: '👻 Snap' });
    if (g.user.id !== state.me.id) api(`/api/phone/stories/${it.id}/view`, { method: 'POST' }).catch(() => {});
    const view = el('div', { class: 'ph-viewer story' },
      el('div', { class: 'ph-bars' }, ...g.items.map((x, k) => el('i', { class: k < ii ? 'done' : k === ii ? 'run' : '' }))),
      el('img', { src: it.media, alt: '' }), it.caption ? el('div', { class: 'ph-caption' }, it.caption) : null,
      el('div', { class: 'ph-v-top' }, LC.avatar(g.user), el('b', {}, g.user.username), el('small', {}, ago(it.createdAt))),
      g.user.id === state.me.id ? el('div', { class: 'ph-v-own' }, el('span', {}, `👀 ${it.views || 0} vue${it.views > 1 ? 's' : ''}`), el('button', { class: 'ph-mini', onclick: async e => { e.stopPropagation(); if (!confirm('Supprimer cette story ?')) return; await api('/api/phone/stories/' + it.id, { method: 'DELETE' }).catch(() => {}); go(snapHome, '👻 Snap'); } }, '🗑️'), el('button', { class: 'ph-mini', onclick: e => { e.stopPropagation(); go(b => camera(b, [], true), ''); } }, '＋')) : null);
    view.onclick = e => { const r = view.getBoundingClientRect(); if (e.clientX - r.left < r.width / 3) viewStories(groups, ii ? gi : Math.max(0, gi - 1), ii ? ii - 1 : 0); else viewStories(groups, gi, ii + 1); };
    screen.style.background = '#000'; dark(true); screen.replaceChildren(view);
    timers.push(setTimeout(() => viewStories(groups, gi, ii + 1), 5000));
  }

  // ---------- 📷 L'appareil photo ----------
  function stopCam() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
  async function camera(body, preselect = [], story = false) {
    screen.style.background = '#000';
    body.classList.add('ph-cam');
    const video = el('video', { autoplay: true, playsinline: true, muted: true });
    const file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => { const f = file.files[0]; file.value = ''; if (f) edit(body, await blobToCanvas(f), preselect, story); } });
    let facing = 'user';
    const start = async () => { stopCam(); try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false }); video.srcObject = camStream; video.classList.toggle('mirror', facing === 'user'); } catch (e) { body.querySelector('.ph-cam-msg').textContent = '📷 La caméra n\'est pas disponible : choisis une photo dans ta galerie 🖼️'; } };
    body.replaceChildren(video, el('div', { class: 'ph-cam-msg' }),
      el('div', { class: 'ph-cam-top' }, el('button', { class: 'ph-round', onclick: back }, '✕'), el('button', { class: 'ph-round', onclick: () => { facing = facing === 'user' ? 'environment' : 'user'; start(); } }, '🔄')),
      el('div', { class: 'ph-cam-bottom' }, el('button', { class: 'ph-round', onclick: () => file.click() }, '🖼️'),
        el('button', { class: 'ph-shutter', onclick: () => { if (!camStream) return file.click(); const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; const g = c.getContext('2d'); if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(video, 0, 0); flash(); stopCam(); edit(body, c, preselect, story); } }),
        el('span', { style: 'width:46px' })), file);
    start();
  }
  const flash = () => { const f = el('div', { class: 'ph-flash' }); screen.append(f); setTimeout(() => f.remove(), 300); };
  async function blobToCanvas(f) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible')); i.src = URL.createObjectURL(f); });
    const k = Math.min(1, 1440 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  }
  // Après la photo : texte, filtres, minuteur, puis on choisit à qui l'envoyer
  function edit(body, canvas, preselect, story) {
    let filter = 'none', seconds = 5;
    const FILTERS = [['none', 'Normal'], ['saturate(1.6) contrast(1.1)', 'Vif'], ['grayscale(1)', 'N&B'], ['sepia(.8)', 'Vintage'], ['hue-rotate(290deg) saturate(1.5)', 'Néon'], ['brightness(1.15) saturate(1.3) hue-rotate(-15deg)', 'Soleil']];
    const img = el('img', { src: canvas.toDataURL('image/jpeg', .9), alt: '' });
    const cap = el('input', { class: 'ph-cap-in', placeholder: 'Écris quelque chose…', maxlength: 120 });
    const fbar = el('div', { class: 'ph-filters' }, ...FILTERS.map(([f, n]) => el('button', { class: f === filter ? 'on' : '', onclick: e => { filter = f; img.style.filter = f; fbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
    const tbar = el('div', { class: 'ph-timer' }, ...[[3, '3 s'], [5, '5 s'], [10, '10 s'], [0, '∞']].map(([v, l]) => el('button', { class: v === seconds ? 'on' : '', onclick: e => { seconds = v; tbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); } }, '⏱ ' + l)));
    body.replaceChildren(el('div', { class: 'ph-edit' }, img, cap,
      el('div', { class: 'ph-cam-top' }, el('button', { class: 'ph-round', onclick: () => camera(body, preselect, story) }, '✕'), el('button', { class: 'ph-round', title: 'Enregistrer sur mon appareil', onclick: () => { const a = el('a', { href: render(canvas, filter, cap.value), download: 'the-paradise.jpg' }); a.click(); } }, '⬇️')),
      el('div', { class: 'ph-edit-bottom' }, fbar, tbar, el('button', { class: 'ph-sendto', onclick: () => sendTo(canvas, filter, cap.value, seconds, preselect, story) }, 'Envoyer à ➤'))));
    cap.focus();
  }
  // la photo finale (filtre et texte dessinés dedans)
  function render(canvas, filter, caption) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d');
    g.filter = filter; g.drawImage(canvas, 0, 0); g.filter = 'none';
    if (caption) { const h = Math.round(c.height * .07); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, c.height * .62, c.width, h * 1.5); g.fillStyle = '#fff'; g.font = `700 ${h * .8}px Outfit, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(caption, c.width / 2, c.height * .62 + h * .75, c.width * .94); }
    return c.toDataURL('image/jpeg', .86);
  }
  function sendTo(canvas, filter, caption, seconds, preselect, story) {
    const chosen = new Set(preselect), f = friends();
    let toStory = story;
    const list = el('div', { class: 'ph-pick' });
    const draw = () => list.replaceChildren(
      el('button', { class: 'ph-row' + (toStory ? ' on' : ''), onclick: () => { toStory = !toStory; draw(); } }, el('span', { class: 'ph-st-ring' }, LC.avatar(state.me)), el('div', { class: 'ph-row-txt' }, el('b', {}, '📖 Ma story'), el('small', {}, 'Tous tes amis pendant 24 h')), el('span', { class: 'ph-check' }, toStory ? '✅' : '⬜')),
      ...f.map(u => el('button', { class: 'ph-row' + (chosen.has(u.id) ? ' on' : ''), onclick: () => { chosen.has(u.id) ? chosen.delete(u.id) : chosen.add(u.id); draw(); } }, avatarOn(u, u.online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username), el('small', {}, u.online ? '🟢 En ligne' : '')), el('span', { class: 'ph-check' }, chosen.has(u.id) ? '✅' : '⬜'))),
      f.length ? null : el('div', { class: 'ph-wait' }, 'Ajoute des amis pour leur envoyer des snaps 🤝'));
    draw();
    go(body => body.replaceChildren(list, el('button', { class: 'ph-sendto big', onclick: async e => {
      if (!chosen.size && !toStory) return toast('Choisis au moins un ami ou ta story');
      e.target.disabled = true; e.target.textContent = 'Envoi…';
      try {
        const blob = await (await fetch(render(canvas, filter, caption))).blob();
        const url = await upload(blob);
        if (chosen.size) { const r = await api('/api/phone/snaps', { method: 'POST', body: { to: [...chosen], url, caption: '', seconds } }); toast(`👻 Snap envoyé à ${r.sent} ami${r.sent > 1 ? 's' : ''} !`); }
        if (toStory) { const u2 = chosen.size ? await upload(blob) : url; await api('/api/phone/stories', { method: 'POST', body: { url: u2, caption: '' } }); toast('📖 Ta story est publiée pour 24 h !'); }
        LC.confetti(['👻', '📸', '✨']); go(snapHome, '👻 Snap');
      } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Envoyer ➤'; }
    } }, 'Envoyer ➤')), 'Envoyer à…');
  }
  async function upload(blobOrFile) {
    const b = blobOrFile instanceof Blob && !(blobOrFile instanceof File) ? blobOrFile : await shrinkPhoto(blobOrFile);
    const r = await fetch('/api/media', { method: 'POST', body: b, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Envoi impossible'); return d.url;
  }
  socket.on('snap_new', d => { snapsUnread++; refreshBadges(); if (isOpen()) ping(`👻 ${d.from.username} t'a envoyé un snap`, () => go(snapHome, '👻 Snap')); else toast(`👻 ${d.from.username} t'a envoyé un snap · touche ici`, () => open('snap')); });
  socket.on('snap_opened', d => { if (isOpen()) ping(`👀 ${d.username} a ouvert ton snap`); });
  socket.on('story_new', () => { if (isOpen() && stack.at(-1)?.fn === snapHome) go(snapHome, '👻 Snap'); });

  // ---------- ⚙️ Réglages ----------
  function settings(body) {
    body.replaceChildren(el('h4', { class: 'ph-h' }, '🖼️ Fond d\'écran'),
      el('div', { class: 'ph-walls' }, ...Object.entries(WALLS).map(([k, v]) => el('button', { class: 'ph-wall' + (opt('wall', 'neon') === k ? ' on' : ''), style: `background:${v}`, onclick: () => { setOpt('wall', k); settings(body); } }))),
      el('h4', { class: 'ph-h' }, '👤 Mon téléphone'), el('div', { class: 'ph-row' }, LC.avatar(state.me), el('div', { class: 'ph-row-txt' }, el('b', {}, state.me.username), el('small', {}, 'Ton numéro : ' + ('06 ' + String(1000000 + state.me.id * 7919 % 9000000).replace(/(\d{2})(?=\d)/g, '$1 '))))));
  }

  // ---------- Petits outils ----------
  function avatarOn(u, online) { const a = LC.avatar(u); if (online) a.append(el('span', { class: 'on' })); return a; }
  function ping(text, onclick) { const n = el('div', { class: 'ph-ping', onclick: () => { n.remove(); onclick && onclick(); } }, el('b', {}, '📱 The Paradise'), el('span', {}, text)); screen.append(n); setTimeout(() => n.remove(), 4500); }
  function pickFriend(title, cb) { go(body => body.replaceChildren(...(friends().length ? friends().map(u => el('button', { class: 'ph-row', onclick: () => cb(u) }, avatarOn(u, u.online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username)))) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis d\'abord 🤝')])), title); }
  setTimeout(refreshBadges, 3000);
  return { open, close, isOpen, refreshBadges };
})();
window.Phone = Phone;
$('phoneBtn').onclick = () => (Phone.isOpen() ? Phone.close() : Phone.open());
