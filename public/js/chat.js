// The Paradise — client du chat
const { el, api } = LC;
const $ = id => document.getElementById(id);

const state = {
  me: null,
  rooms: [],
  view: null,            // { type: 'room', slug } | { type: 'pm', userId }
  online: [],
  convs: new Map(),      // userId -> { user, unread, last }
  pmCache: new Map(),    // userId -> [messages]
  blocked: new Set(),
  voice: new Map(),      // slug -> participants du vocal
  currentRoom: null,
  canCreate: false,
  voiceEnabled: true,
  filter: 'all',
  sound: true,
};
try { state.sound = localStorage.getItem('lc_sound') !== '0'; } catch (e) {}

// Émoticônes animées du site (dessinées pour The Paradise) : on les écrit :nom: dans un message
const EMOTES = ['ptdr', 'love', 'coeur', 'feu', 'cool', 'clin', 'bisou', 'wow', 'triste', 'colere', 'fete', 'dodo', 'couronne', 'etoiles', 'palmier', 'gg', 'mdr', 'bravo', 'coucou'];
const EMOTE_SET = new Set(EMOTES);
// Émoticônes créées par les membres à partir d'une photo : code -> { url, owner, id }
const customEmotes = new Map();
let pendingEmotes = [];
const isEmote = code => EMOTE_SET.has(code) || customEmotes.has(code);
const emoteImg = (code, big) => el('img', { class: 'emote' + (big ? ' big' : '') + (/^(gg|mdr|bravo|coucou)$/.test(code) ? ' wide' : '') + (customEmotes.has(code) ? ' custom' : ''),
  src: customEmotes.has(code) ? customEmotes.get(code).url : `/img/emotes/${code}.svg`, alt: `:${code}:`, title: `:${code}:` + (customEmotes.get(code)?.owner ? ` (créée par ${customEmotes.get(code).owner})` : ''), draggable: 'false' });
async function loadEmotes() {
  try {
    const d = await api('/api/emotes');
    customEmotes.clear();
    d.emotes.forEach(e => customEmotes.set(e.code, e));
    pendingEmotes = d.pending || [];
    if (!$('emojiPanel').classList.contains('hidden')) renderEmojiPanel($('emojiPanel').dataset.tab || 'paradise');
  } catch (e) {}
}
const EMOJIS = '😀 😂 🥰 😍 😘 😉 😎 🤩 🥳 😇 🤔 😏 😅 😢 😭 😡 👍 👎 👏 🙏 💪 🔥 ✨ 💯 ❤️ 💜 💕 💋 🌹 🎉 ☕ 🍷'.split(' ');
const isStaff = () => LC.rank(state.me) >= 1;

// ---------- Son ----------
let audioCtx;
function ding() {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + .12);
    g.gain.setValueAtTime(.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .35);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + .35);
  } catch (e) {}
}
function renderSoundBtn() {
  $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
  $('soundBtn2').textContent = state.sound ? '🔊 Son activé' : '🔇 Son coupé';
}
$('soundBtn').onclick = $('soundBtn2').onclick = () => {
  state.sound = !state.sound;
  try { localStorage.setItem('lc_sound', state.sound ? '1' : '0'); } catch (e) {}
  renderSoundBtn();
};
renderSoundBtn();

function toast(text, onclick) {
  const t = el('div', { class: 'toast', onclick: () => { t.remove(); onclick && onclick(); } }, text);
  $('toasts').append(t);
  setTimeout(() => t.remove(), 5000);
}

// ---------- Tiroirs mobiles ----------
function closeDrawers() { $('left').classList.remove('open'); $('right').classList.remove('open'); $('drawerBack').classList.remove('show'); }
$('toggleLeft').onclick = () => { $('right').classList.remove('open'); $('left').classList.toggle('open'); $('drawerBack').classList.toggle('show', $('left').classList.contains('open')); };
$('toggleRight').onclick = () => { $('left').classList.remove('open'); $('right').classList.toggle('open'); $('drawerBack').classList.toggle('show', $('right').classList.contains('open')); };
$('drawerBack').onclick = closeDrawers;

// Texte d'aide de la zone de saisie : version courte sur téléphone
const smallScreen = matchMedia('(max-width: 760px)');
function setPlaceholder(full, short = 'Message…') {
  const inp = $('input');
  inp.dataset.full = full; inp.dataset.short = short;
  inp.placeholder = smallScreen.matches ? short : full;
}
smallScreen.addEventListener?.('change', () => { const inp = $('input'); if (inp.dataset.full) inp.placeholder = smallScreen.matches ? inp.dataset.short : inp.dataset.full; });

// ---------- Rendu : en-tête utilisateur ----------
function renderMe() {
  const chip = $('meChip');
  chip.replaceChildren(...[LC.avatar(state.me), el('span', { class: 'me-name' }, state.me.username), LC.badge(state.me)].filter(Boolean));
  chip.onclick = e => { e.stopPropagation(); toggleUserMenu(); };
  $('adminLink').classList.toggle('hidden', !isStaff());
  $('ghostBtn').classList.toggle('hidden', state.me.role !== 'superadmin');
}

// ---------- Mode fantôme (super-admin) ----------
function setGhost(on) {
  socket.emit('ghost', on, res => {
    if (res?.error) return toast(res.error);
    applyGhost(res.ghost);
    toast(res.ghost ? '👻 Mode fantôme activé : personne ne te voit' : '👋 Tu es de nouveau visible');
  });
}
function setGhostAnon(on) {
  socket.emit('ghost_anon', on, res => {
    if (res?.error) return toast(res.error);
    state.ghostAnon = res.ghostAnon;
    applyGhost(state.ghost);
  });
}
function applyGhost(on) {
  state.ghost = !!on;
  document.body.classList.toggle('ghost-mode', state.ghost);
  $('ghostBtn').classList.toggle('active', state.ghost);
  $('ghostBtn').title = state.ghost ? 'Quitter le mode fantôme' : 'Mode fantôme (invisible)';
  const b = $('ghostBanner');
  b.classList.toggle('hidden', !state.ghost);
  b.replaceChildren(el('span', { class: 'ghost-ico' }, '👻'),
    el('div', { style: 'flex:1;min-width:0' }, el('b', {}, 'Mode fantôme actif'),
      el('div', { class: 'help' }, 'Tu n\'apparais ni dans les connectés ni dans les compteurs. Tu peux tout lire, écrire, modérer, appeler.')),
    el('div', { class: 'ghost-sign' }, el('span', { class: 'help' }, 'Signer :'),
      el('button', { class: 'choice' + (!state.ghostAnon ? ' active' : ''), onclick: () => setGhostAnon(false) }, 'Mon pseudo'),
      el('button', { class: 'choice' + (state.ghostAnon ? ' active' : ''), onclick: () => setGhostAnon(true) }, '🛡️ Modération')),
    el('button', { class: 'btn btn-sm', onclick: () => setGhost(false) }, 'Redevenir visible'));
  renderMuteBanner();
}
$('ghostBtn').onclick = () => setGhost(!state.ghost);

// ---------- Salons ----------
async function loadRooms() {
  const d = await api('/api/rooms');
  state.rooms = d.rooms;
  state.canCreate = d.canCreate;
  state.canCreateTemp = d.canCreateTemp;
  state.customs = d.customs || { enabled: false, open: true };
  state.tempMinutes = d.tempMinutes;
  state.maxUserRooms = d.maxUserRooms;
  state.voiceEnabled = d.voiceEnabled;
  const firstPatch = state.patchLast === undefined;
  state.patchLast = d.patchLast || 0;
  if (firstPatch && patchNew() && patchSeen() > 0) toast('📝 Nouvelle patch note : clique pour voir les nouveautés', () => joinRoom('patchnote'));
  d.rooms.forEach(r => { if (!state.voice.has(r.slug)) state.voice.set(r.slug, []); });
  if (state.view?.type === 'room') {
    const cur = d.rooms.find(r => r.slug === state.view.slug);
    if (cur) state.currentRoom = cur;
  }
  renderRooms();
  renderRoomHead();
  renderUsers();
  if (typeof renderVoice === 'function') renderVoice();
}
const canManage = r => !!r && (r.ownerId ? (r.ownerId === state.me.id || isStaff() || (r.managers || []).some(m => m.id === state.me.id)) : LC.isAdminRole(state.me));

// Chaque icône de salon a son animation (elle tourne, scintille, bat, se balance…)
const ICON_ANIMS = { patchnote: 'wiggle', douane: 'pulse', general: 'twinkle', rencontres: 'heart', '18-25': 'bounce', '25-40': 'swing', '40-plus': 'glow',
  amitie: 'wave', gaming: 'shake', musique: 'dance', karaoke: 'swing', tv: 'flicker', roue: 'spin', blindtest: 'tip', sommet: 'float', membres: 'gem' };
const ANIM_CYCLE = ['bounce', 'twinkle', 'swing', 'float', 'pulse', 'spin', 'wiggle', 'dance'];
function iconAnim(r) {
  if (ICON_ANIMS[r.slug]) return ICON_ANIMS[r.slug];
  let h = 0; for (const c of r.slug) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ANIM_CYCLE[Math.abs(h) % ANIM_CYCLE.length];
}
// Couleur néon de chaque salon officiel (nom, description et contour)
const NEON = { general: 'red', rencontres: 'pink', '18-25': 'blue', '25-40': 'blue', '40-plus': 'blue', amitie: 'green', gaming: 'grey',
  musique: 'orange', karaoke: 'orange', tv: 'black', douane: 'white', patchnote: 'violet' };
// Les salons des jeux s'affichent en doré
// Salons dorés avec le logo animé comme icône
const GOLD_LOGO = new Set(['paroles', 'motdor']);
const GAME_ROOMS = new Set(['roue', 'blindtest', 'sommet', 'paroles', 'motdor']);
function roomItem(r, counts) {
  const customsLock = needsCustoms() && r.slug !== 'douane';
  const locked = (r.membersOnly && state.me.isGuest) || customsLock;
  const v = (state.voice.get(r.slug) || []).filter(p => !p.listener).length;
  return el('div', {
    class: 'list-item' + (GAME_ROOMS.has(r.slug) ? ' game-room' : '') + (r.slug === 'membres' ? ' vip-room' : '') + (r.slug === 'fierte' ? ' pride-room' : '') + (GOLD_LOGO.has(r.slug) ? ' gold-neon-room' : '') + (NEON[r.slug] ? ' neon-room neon-' + NEON[r.slug] : '') + (state.view?.type === 'room' && state.view.slug === r.slug ? ' active' : ''),
    title: r.description, style: locked ? 'opacity:.5' : '',
    onclick: () => (customsLock ? toast('🛂 Passe d\'abord par la Douane : un membre du staff va te vérifier') : locked ? toast('🔒 Salon réservé aux membres inscrits') : joinRoom(r.slug)),
  },
    el('div', { class: 'ico' }, GOLD_LOGO.has(r.slug) ? el('img', { class: 'ico-logo', src: '/img/logo-mark.webp?v=3', alt: '' }) : el('span', { class: 'ico-anim a-' + iconAnim(r) }, r.icon)),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, el('span', { class: r.temporary ? 'room-temp' : 'room-perm' }, r.name), r.isPrivate ? ' 🔒' : '', locked ? ' 🔒' : '', r.ownerId === state.me.id || (r.managers || []).some(m => m.id === state.me.id) ? ' 👑' : ''),
      el('div', { class: 'sub' }, r.temporary ? tempLabel(r) : r.ownerId ? `par ${r.ownerName}${r.station ? ' · 📻 ' + r.station.name : ''}` : (r.station ? '📻 ' + r.station.name : r.description))),
    v ? el('span', { class: 'pill voice-pill', title: 'En vocal' }, '🎙️' + v) : null,
    r.slug === 'patchnote' && patchNew() ? el('span', { class: 'pill patch-new', title: 'Nouvelle patch note' }, 'NEW') : null,
    el('span', { class: 'pill' + (counts[r.slug] ? ' hot' : '') }, counts[r.slug] || 0));
}
// « ⏳ temporaire · par Lina » ou « ⏳ se ferme dans 3 min » quand il est vide
function tempLabel(r) {
  if (r.closesAt) {
    const m = Math.max(0, Math.ceil((r.closesAt - Date.now()) / 60000));
    return `⏳ vide · se ferme dans ${m} min`;
  }
  return `⏳ temporaire · par ${r.ownerName}`;
}
setInterval(() => { if (state.rooms?.some(r => r.temporary)) renderRooms(); }, 30000);
function renderRooms() {
  const counts = {};
  state.online.forEach(u => { if (u.room && !u.ghost) counts[u.room] = (counts[u.room] || 0) + 1; });
  const official = state.rooms.filter(r => !r.ownerId);
  const byCount = (a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0);
  const members = state.rooms.filter(r => r.ownerId && !r.temporary).sort(byCount);
  const temps = state.rooms.filter(r => r.temporary).sort(byCount);
  $('tempRoomList').replaceChildren(...(temps.length ? temps.map(r => roomItem(r, counts))
    : [el('div', { class: 'side-empty' }, 'Aucun salon temporaire. Crée le tien en un clic avec ＋ !')]));
  $('roomList').replaceChildren(...official.map(r => roomItem(r, counts)));
  $('userRoomList').replaceChildren(...(members.length ? members.map(r => roomItem(r, counts))
    : [el('div', { class: 'side-empty' }, state.canCreate ? 'Aucun salon pour l\'instant. Crée le tien !' : 'Inscris-toi pour créer ton propre salon.')]));
  $('createRoomBtn').classList.toggle('hidden', !state.canCreate && !state.canCreateTemp);
  $('createTempBtn').classList.toggle('hidden', !state.canCreateTemp);
}

function renderRoomHead() {
  const r = state.currentRoom;
  const inRoom = state.view?.type === 'room' && r;
  $('headRadio').classList.toggle('hidden', !inRoom || !r.station);
  $('headMedia').classList.toggle('hidden', !inRoom);
  $('headVoice').classList.toggle('hidden', !inRoom || !state.voiceEnabled || !r.voiceEnabled);
  $('headSettings').classList.toggle('hidden', !inRoom || !canManage(r));
  const pmUser = state.view?.type === 'pm' ? state.convs.get(state.view.userId)?.user : null;
  $('headCall').classList.toggle('hidden', !pmUser);
  $('headVideo').classList.toggle('hidden', !pmUser);
  if (pmUser) { $('headCall').onclick = () => Call.start(pmUser, false); $('headVideo').onclick = () => Call.start(pmUser, true); }
  // Fond d'écran du salon (image, GIF, vidéo ou fond animé)
  renderRoomBg(inRoom ? r : null);
  if (!inRoom) { $('voiceBar').classList.add('hidden'); renderVideoGrid(); setPrideUniverse(false); document.querySelector('.room-head').className = 'room-head'; return; }
  $('headIcon').replaceChildren(GOLD_LOGO.has(r.slug) ? el('img', { class: 'ico-logo', src: '/img/logo-mark.webp?v=3', alt: '' }) : el('span', { class: 'ico-anim a-' + iconAnim(r) }, r.icon));
  $('headTitle').textContent = r.name + (r.isPrivate ? ' 🔒' : '');
  $('headTitle').className = r.temporary ? 'room-temp' : 'room-perm';
  // L'en-tête prend la couleur néon du salon (ou doré pour les jeux, arc-en-ciel pour le VIP)
  const head = document.querySelector('.room-head');
  head.className = 'room-head' + (r.slug === 'fierte' ? ' head-pride' : NEON[r.slug] ? ' head-neon neon-' + NEON[r.slug] : GAME_ROOMS.has(r.slug) ? ' head-gold' : r.slug === 'membres' ? ' head-vip' : ' head-neon neon-blue');
  setPrideUniverse(r.slug === 'fierte');
  $('headSub').textContent = r.temporary ? `⏳ Salon temporaire de ${r.ownerName} · se ferme ${state.tempMinutes || 5} min après le départ du dernier` : r.ownerId ? `Salon de ${r.ownerName}${r.description ? ' · ' + r.description : ''}` : r.description;
  if (r.station) {
    const playing = Media.isPlaying(r.station);
    $('headRadio').textContent = `${r.station.icon} ${r.station.name} ${playing ? '⏸' : '▶'}`;
    $('headRadio').onclick = () => playing ? Media.toggle() : Media.play(r.station, true);
  }
  $('headSettings').onclick = () => openRoomSettings(r);
  renderCustoms();
  renderVoice();
}

// ---------- Salon « Patch note » (lecture seule, le bot annonce les nouveautés) ----------
const patchSeen = () => { try { return parseInt(localStorage.getItem('lc_patch_seen') || '0', 10); } catch (e) { return 0; } };
const patchNew = () => (state.patchLast || 0) > patchSeen();
function updateReadonly() {
  const ro = state.view?.type === 'room' && state.view.slug === 'patchnote';
  $('composer').classList.toggle('hidden', ro);
  $('readonlyBar')?.classList.toggle('hidden', !ro);
  if (ro && patchNew()) { try { localStorage.setItem('lc_patch_seen', String(state.patchLast)); } catch (e) {} renderRooms(); }
}
document.addEventListener('viewchange', updateReadonly);
function joinRoom(slug) {
  const fromRoom = state.view?.type === 'room' ? state.view.slug : (state.view ? 'pm' : null);
  socket.emit('join', slug, res => {
    if (res.error) return toast(res.error);
    // 🌫️ un brouillard magique de la couleur du salon (pas au tout premier chargement)
    if (fromRoom && fromRoom !== slug) window.RoomFog?.play(slug);
    state.view = { type: 'room', slug };
    typers.clear(); renderTyping();
    state.currentRoom = res.room;
    state.voice.set(slug, (res.voice || []).map(p => ({ ...p, micEnd: p.micLeft ? Date.now() + p.micLeft : 0 })));
    try { localStorage.setItem('lc_room', slug); } catch (e) {}
    $('headProfile').classList.add('hidden');
    setPlaceholder(`Message dans ${res.room.name}…`);
    $('messages').replaceChildren();
    res.history.forEach(m => addRoomMessage(m, false));
    addSys(slug === 'patchnote' ? '📝 Toutes les nouveautés du site sont ici' : 'Bienvenue dans ' + res.room.name + ' ! Sois respectueux 💜');
    if (res.room.station && !Media.isPlaying(res.room.station)) addSys(`📻 Ce salon écoute ${res.room.station.name} — clique sur ${res.room.station.name} ▶ en haut pour l'écouter.`);
    scrollDown(true);
    renderRoomHead(); renderRooms(); renderConvs(); renderUsers();
    closeDrawers();
    $('input').focus();
    document.dispatchEvent(new CustomEvent('viewchange'));
  });
}
// La personne doit-elle passer par la douane ?
const needsCustoms = () => !!(state.customs?.enabled && state.me && !state.me.verified && !isStaff());
function joinDefaultRoom() {
  if (needsCustoms()) return joinRoom('douane');
  const r = state.rooms.find(x => !x.ownerId && x.slug !== 'douane' && x.slug !== 'patchnote' && !(x.membersOnly && state.me.isGuest)) || state.rooms[0];
  if (r) joinRoom(r.slug);
}

// ---------- Messages ----------
const nearBottom = () => { const m = $('messages'); return m.scrollHeight - m.scrollTop - m.clientHeight < 120; };
function scrollDown(force) { const m = $('messages'); if (force || nearBottom()) m.scrollTop = m.scrollHeight; }

function linkify(text) {
  const frag = document.createDocumentFragment();
  const re = /(https?:\/\/[^\s<]+)|(@[\p{L}\p{N}_\-]{3,20})|:([a-z0-9]{2,15}):/gu;
  // Un message fait seulement d'émoticônes : on les affiche en grand
  const onlyEmotes = /^\s*(:[a-z0-9]{2,15}:\s*){1,6}$/.test(text) && (text.match(/:([a-z0-9]{2,15}):/g) || []).every(x => isEmote(x.slice(1, -1)));
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m[3] && !isEmote(m[3])) continue;
    frag.append(text.slice(last, m.index));
    if (m[1]) frag.append(el('a', { href: m[1], target: '_blank', rel: 'noopener noreferrer nofollow' }, m[1]));
    else if (m[3]) frag.append(emoteImg(m[3], onlyEmotes));
    else frag.append(el('b', { style: 'color:var(--gold)' }, m[2]));
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function addRoomMessage(m, live = true) {
  if (state.blocked.has(m.userId)) return;
  if (!m._force && typeof isUserMuted === 'function' && m.userId && isUserMuted(m.userId)) {
    // Message d'une personne en sourdine : replié, on peut cliquer pour l'afficher
    const ph = el('div', { class: 'sys muted-msg', title: 'Clique pour afficher quand même' }, `🔇 Message masqué de ${m.username} (sourdine)`);
    ph.onclick = () => { addRoomMessage({ ...m, _force: true }, false); ph.replaceWith($('messages').lastChild); };
    $('messages').append(ph);
    return;
  }
  if (m.bot) return addBotMessage(m, live);
  const mention = m.userId !== state.me.id && new RegExp('@' + state.me.username + '\\b', 'i').test(m.content);
  const user = { id: m.userId, username: m.username, color: m.color, gender: m.gender, role: m.role, modLevel: m.modLevel, avatar: m.avatar, frame: m.frame, nameEffect: m.nameEffect, isBirthday: m.isBirthday, validated: m.validated };
  const row = el('div', { class: 'msg' + (mention ? ' mention' : '') + (m.staffOnly ? ' staff-only' : ''), 'data-id': m.id },
    LC.avatar(user),
    el('div', { class: 'body' },
      el('div', {},
        el('span', { class: 'who', 'data-uid': m.anon ? null : m.userId, onclick: () => m.anon ? toast('🛡️ Message de l\'équipe de modération') : openProfile(m.userId) }, m.anon ? '🛡️ ' : '', LC.name(user)),
        ' ', el('span', { class: 'g-' + m.gender }, LC.genderIcon(m.gender)), ' ', LC.badge(user), m.anon ? null : roomModBadge(m.userId),
        el('span', { class: 'time' }, LC.time(m.createdAt)), editedTag(m)),
      m.anon ? null : LC.badgesRow(m.badges),
      ...messageBody(m),
      m.staffOnly ? el('div', { class: 'staff-only-bar' }, el('span', {}, '🔒 Visible seulement par les administrateurs'),
        m.userId === state.me.id || isSuperMe() ? el('button', { class: 'btn btn-sm', onclick: () => socket.emit('message_reveal', { id: m.id }, r => r?.error ? toast(r.error) : toast('👁 Ton message est maintenant visible par tout le monde')) }, '👁 Montrer mon message') : null) : null),
    el('div', { class: 'msg-tools' },
      m.userId !== state.me.id && m.kind !== 'audio' ? el('button', { class: 'btn btn-sm', title: 'Traduire ce message', onclick: () => Translator.translateRow(row) }, '🌐') : null,
      canEdit(m, m.userId) ? el('button', { class: 'btn btn-sm edit', title: 'Modifier (corriger une faute)', onclick: () => startEdit(row, m, 'room') }, '✏️') : null,
      isStaff() ? el('button', { class: 'btn btn-sm btn-danger', title: 'Supprimer', onclick: () => deleteMessage(m.id) }, '🗑') : null));
  row._msg = m;
  $('messages').append(row);
  trimMessages();
  if (live) { scrollDown(m.userId === state.me.id); if (mention) { ding(); toast(`${m.username} t'a mentionné`); } }
}
// Message d'un bot (ex. KaraoBot dans le salon Karaoké)
function addBotMessage(m, live = true) {
  const mention = new RegExp('@' + state.me.username + '\\b', 'i').test(m.content);
  $('messages').append(el('div', { class: 'msg bot-msg' + (mention ? ' mention' : '') },
    el('div', { class: 'avatar bot-av' }, m.botIcon || '🤖'),
    el('div', { class: 'body' },
      el('div', {}, el('span', { class: 'who', style: 'color:' + (m.color || '#ffb547') }, m.username), ' ', el('span', { class: 'badge bot' }, 'Bot'), el('span', { class: 'time' }, LC.time(m.createdAt))),
      el('div', { class: 'text' }, m.content))));
  trimMessages();
  if (live) { scrollDown(); if (mention) { ding(); toast((m.botIcon || '🤖') + ' ' + m.content.slice(0, 90)); } }
}
function addSys(text, cls = '') {
  $('messages').append(el('div', { class: 'sys ' + cls }, text));
  scrollDown();
}
function trimMessages() { const m = $('messages'); while (m.children.length > 300) m.firstChild.remove(); }

async function deleteMessage(id) {
  try { await api('/api/admin/messages/' + id, { method: 'DELETE' }); } catch (e) { toast(e.message); }
}

// ---------- Messages privés ----------
async function loadConvs() {
  const { conversations } = await api('/api/pm');
  state.convs.clear();
  conversations.forEach(c => state.convs.set(c.user.id, c));
  renderConvs();
}
function renderConvs() {
  const list = [...state.convs.values()].filter(c => !state.blocked.has(c.user.id));
  const total = list.reduce((s, c) => s + (c.unread || 0), 0);
  $('pmTotal').textContent = total;
  $('pmTotal').classList.toggle('hot', total > 0);
  document.title = (total ? `(${total}) ` : '') + 'The Paradise — Salons';
  if (!list.length) return $('pmList').replaceChildren(el('div', { class: 'sub', style: 'padding:6px 10px;color:var(--muted);font-size:.85rem' }, 'Clique sur un pseudo pour lui écrire en privé.'));
  const onlineIds = new Set(state.online.map(u => u.id));
  $('pmList').replaceChildren(...list.map(c => {
    const av = LC.avatar(c.user);
    if (onlineIds.has(c.user.id)) av.append(el('span', { class: 'on' }));
    return el('div', { class: 'list-item' + (state.view?.type === 'pm' && state.view.userId === c.user.id ? ' active' : ''), onclick: () => openPm(c.user) },
      av,
      el('div', { class: 'meta' }, el('div', { class: 'name' }, c.user.username), el('div', { class: 'sub' }, c.last?.content || '')),
      c.unread ? el('span', { class: 'pill hot' }, c.unread) : null,
      el('button', { class: 'btn btn-sm conv-del', title: 'Supprimer la conversation pour tout le monde', onclick: e => { e.stopPropagation(); deleteConv(c.user); } }, '🗑'));
  }));
}
// Supprimer toute la conversation : elle disparaît aussi chez l'autre personne
function deleteConv(user) {
  if (!confirm(`Supprimer toute la conversation avec ${user.username} pour tout le monde ?\nTous les messages disparaîtront aussi chez ${user.username}.`)) return;
  socket.emit('pm_delete_conv', { userId: user.id }, res => res?.error ? toast(res.error) : toast('🗑 Conversation supprimée'));
}

async function openPm(user) {
  state.view = { type: 'pm', userId: user.id };
  typers.clear(); renderTyping();
  if (!state.convs.has(user.id)) state.convs.set(user.id, { user, unread: 0, last: null });
  const conv = state.convs.get(user.id);
  conv.unread = 0;
  $('headIcon').textContent = '💌';
  $('headTitle').textContent = user.username;
  const isOn = state.online.some(u => u.id === user.id);
  $('headSub').textContent = `${LC.genderLabel(user.gender)}${user.age ? ' · ' + user.age + ' ans' : ''}${user.city ? ' · ' + user.city : ''} · ${isOn ? '🟢 en ligne' : 'hors ligne'}`;
  $('headProfile').classList.remove('hidden');
  $('headProfile').onclick = () => openProfile(user.id);
  renderRoomHead();
  setPlaceholder(`Message privé à ${user.username}…`, `À ${user.username}…`);
  $('messages').replaceChildren(el('div', { class: 'sys' }, 'Conversation privée avec ' + user.username));
  renderConvs(); renderRooms(); closeDrawers();
  document.dispatchEvent(new CustomEvent('viewchange'));
  try {
    const { messages } = await api('/api/pm/' + user.id);
    state.pmCache.set(user.id, messages);
    if (state.view?.userId !== user.id) return;
    messages.forEach(addBubble);
    scrollDown(true);
  } catch (e) { toast(e.message); }
  $('input').focus();
}
function addBubble(m) {
  const mine = m.from === state.me.id;
  const row = el('div', { class: 'bubble-row' + (mine ? ' mine' : ''), 'data-pm': m.id },
    !mine && m.kind !== 'audio' ? el('button', { class: 'btn btn-sm bubble-tr', title: 'Traduire ce message', onclick: () => Translator.translateRow(row) }, '🌐') : null,
    mine ? el('div', { class: 'bubble-tools' },
      canEdit(m, m.from) ? el('button', { class: 'btn btn-sm edit', title: 'Modifier (corriger une faute)', onclick: () => startEdit(row, m, 'pm') }, '✏️') : null,
      el('button', { class: 'btn btn-sm', title: 'Supprimer pour tout le monde', onclick: () => deletePm(m) }, '🗑')) : null,
    el('div', { class: 'bubble' + (m.kind === 'audio' ? ' audio' : m.kind === 'image' ? ' photo' : '') }, ...messageBody(m), el('span', { class: 'time' }, LC.time(m.createdAt), editedTag(m))));
  row._msg = m;
  $('messages').append(row);
  trimMessages();
}

// ---------- Modifier son message (faute d'orthographe…) pendant 15 minutes ----------
const EDIT_MS = 15 * 60 * 1000;
const canEdit = (m, authorId) => !!state.me && authorId === state.me.id && !m.anon && m.kind !== 'audio' && Date.now() - m.createdAt < EDIT_MS;
const editedTag = m => m.editedAt ? el('span', { class: 'edited', title: 'Modifié à ' + LC.time(m.editedAt) }, ' (modifié)') : null;
function startEdit(row, m, kind) {
  if (row.querySelector('.edit-box')) return;
  if (Date.now() - m.createdAt >= EDIT_MS) return toast('Trop tard : on peut modifier un message pendant 15 minutes');
  const old = m.content === '🖼️ Photo' ? '' : m.content;
  const area = el('textarea', { class: 'input edit-input', rows: Math.min(6, old.split('\n').length + 1), maxlength: kind === 'pm' ? 1000 : 500 });
  area.value = old;
  const target = kind === 'pm' ? row.querySelector('.bubble') : row.querySelector('.body');
  const save = () => {
    const text = area.value.trim();
    if (text === old) return cancel();
    if (!text && m.kind !== 'image') return toast('Le message est vide');
    socket.emit(kind === 'pm' ? 'pm_edit' : 'message_edit', { id: m.id, text }, res => {
      if (res?.error) return toast(res.error);
      cancel();
    });
  };
  const cancel = () => { box.remove(); row.classList.remove('editing'); };
  area.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  const box = el('div', { class: 'edit-box' }, area,
    el('div', { class: 'edit-actions' },
      el('small', { class: 'help' }, 'Entrée pour enregistrer · Échap pour annuler'),
      el('button', { class: 'btn btn-sm', onclick: cancel }, 'Annuler'),
      el('button', { class: 'btn btn-sm btn-primary', onclick: save }, '✔ Enregistrer')));
  row.classList.add('editing');
  target.append(box);
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
}
// Un message a été corrigé : on met à jour son texte partout
function applyEdit(row, m, kind) {
  if (!row) return;
  if (kind === 'pm') {
    const bubble = row.querySelector('.bubble'), time = bubble.querySelector(':scope > .time');
    [...bubble.children].forEach(c => { if (c !== time && !c.classList.contains('edit-box')) c.remove(); });
    messageBody(m).forEach(n => bubble.insertBefore(n, time));
    if (!time.querySelector('.edited')) time.append(editedTag(m));
  } else {
    const body = row.querySelector('.body'), head = body.firstElementChild;
    [...body.children].forEach(c => { if (c !== head && !c.classList.contains('edit-box')) c.remove(); });
    body.append(...messageBody(m));
    if (!head.querySelector('.edited')) head.append(editedTag(m));
  }
}

// ---------- Amis ----------
state.friends = { friends: [], incoming: [], outgoing: [] };
async function loadFriends() {
  if (!state.me || state.me.isGuest) { $('friendList')?.replaceChildren(); return; }
  try { state.friends = await api('/api/friends'); } catch (e) { return; }
  renderFriends();
}
function renderFriends() {
  const box = $('friendList');
  if (!box) return;
  const f = state.friends, online = new Set(state.online.map(u => u.id));
  $('friendTotal').textContent = f.incoming.length ? '+' + f.incoming.length : f.friends.filter(x => online.has(x.id)).length;
  $('friendTotal').classList.toggle('hot', f.incoming.length > 0);
  const rows = [];
  for (const u of f.incoming) rows.push(el('div', { class: 'list-item friend-req', 'data-uid': u.id, onclick: () => openProfile(u.id) },
    LC.avatar(u),
    el('div', { class: 'meta' }, el('div', { class: 'name' }, u.username), el('div', { class: 'sub' }, '👋 veut être ton ami')),
    el('button', { class: 'btn btn-sm btn-ok', title: 'Accepter', onclick: e => { e.stopPropagation(); friendAction(u, 'accept'); } }, '✅'),
    el('button', { class: 'btn btn-sm', title: 'Refuser', onclick: e => { e.stopPropagation(); friendAction(u, 'refuse'); } }, '❌')));
  for (const u of f.friends) {
    const av = LC.avatar(u);
    if (online.has(u.id)) av.append(el('span', { class: 'on' }));
    rows.push(el('div', { class: 'list-item', 'data-uid': u.id, onclick: () => openProfile(u.id) },
      av, el('div', { class: 'meta' }, el('div', { class: 'name' }, u.username), el('div', { class: 'sub' }, online.has(u.id) ? '🟢 en ligne' : 'hors ligne')),
      el('button', { class: 'btn btn-sm conv-del', title: 'Message privé', onclick: e => { e.stopPropagation(); openPm(u); } }, '💌')));
  }
  for (const u of f.outgoing) rows.push(el('div', { class: 'list-item friend-out', 'data-uid': u.id, onclick: () => openProfile(u.id) },
    LC.avatar(u), el('div', { class: 'meta' }, el('div', { class: 'name' }, u.username), el('div', { class: 'sub' }, '⏳ demande envoyée'))));
  box.replaceChildren(...(rows.length ? rows : [el('div', { class: 'side-empty' }, 'Ajoute des amis depuis leur profil ➕')]));
}
async function friendAction(u, action) {
  try {
    const path = `/api/friends/${u.id}` + (action === 'accept' ? '/accept' : action === 'refuse' ? '/refuse' : '');
    const r = await api(path, { method: action === 'remove' ? 'DELETE' : 'POST' });
    toast({ sent: `👋 Demande d'ami envoyée à ${u.username}`, friends: `🤝 ${u.username} et toi êtes maintenant amis`, none: action === 'refuse' ? `Demande de ${u.username} refusée` : action === 'remove' ? `${u.username} n'est plus dans tes amis` : '' }[r.status] || 'OK');
    loadFriends();
    return r.status;
  } catch (e) { toast(e.message); }
}
// Le bouton d'ami sur un profil, selon où on en est
function friendButton(u, status, done) {
  const go = a => { done && done(); friendAction(u, a); };
  if (status === 'friends') return el('button', { class: 'btn', onclick: () => { if (confirm(`Retirer ${u.username} de tes amis ?`)) go('remove'); } }, '🤝 Amis ✓');
  if (status === 'sent') return el('button', { class: 'btn', onclick: () => go('remove') }, '⏳ Demande envoyée (annuler)');
  if (status === 'received') return el('div', { class: 'friend-choice' },
    el('button', { class: 'btn btn-ok', onclick: () => go('accept') }, '✅ Accepter l\'ami'),
    el('button', { class: 'btn', onclick: () => go('refuse') }, '❌ Refuser'));
  return el('button', { class: 'btn', onclick: () => go('add') }, '➕ Ajouter en ami');
}

// ---------- Utilisateurs connectés ----------
function renderUsers() {
  if (typeof renderFriends === 'function') renderFriends();
  if (typeof Team !== 'undefined') Team.renderBar();
  const q = $('userSearch').value.trim().toLowerCase();
  let users = state.online.filter(u => !state.blocked.has(u.id));
  const nOnline = state.online.filter(u => !u.ghost).length;
  $('onlineCount').textContent = nOnline;
  // Sur téléphone, le nombre de connectés s'affiche sur le bouton 👥
  const ob = $('onlineBadge');
  if (ob) { ob.textContent = nOnline > 99 ? '99+' : nOnline; ob.classList.toggle('hidden', !nOnline); }
  if (state.filter === 'f' || state.filter === 'h') users = users.filter(u => u.gender === state.filter);
  if (state.filter === 'room') users = users.filter(u => state.view?.type === 'room' && u.room === state.view.slug);
  if (q) users = users.filter(u => u.username.toLowerCase().includes(q));
  const rank = u => 3 - LC.rank(u);
  users.sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  const roomName = slug => state.rooms.find(r => r.slug === slug)?.name || '';
  // 💤 les membres déconnectés récemment, grisés en dessous
  const onIds = new Set(state.online.map(u => u.id));
  const away = (state.filter && state.filter !== 'all' && state.filter !== 'f' && state.filter !== 'h') ? [] : (state.recent || []).filter(u => !onIds.has(u.id) && !state.blocked.has(u.id) && (!q || u.username.toLowerCase().includes(q)) && (state.filter !== 'f' && state.filter !== 'h' || u.gender === state.filter));
  const awayRows = away.length ? [el('div', { class: 'away-title' }, `💤 Déconnectés (${away.length})`), ...away.map(u => el('div', { class: 'list-item is-away', 'data-uid': u.id, onclick: () => openProfile(u.id) }, LC.avatar(u),
    el('div', { class: 'meta' }, el('div', { class: 'name' }, LC.name(u), ' ', el('span', { class: 'g-' + u.gender }, LC.genderIcon(u.gender))), el('div', { class: 'sub' }, '⚪ Déconnecté · ' + timeAgo(u.lastSeen)))))] : [];
  if (!users.length) return $('userList').replaceChildren(el('div', { class: 'empty' }, 'Personne ici pour le moment'), ...awayRows);
  $('userList').replaceChildren(...users.map(u => {
    const av = LC.avatar(u); av.append(el('span', { class: 'on' }));
    const muted = typeof isUserMuted === 'function' && isUserMuted(u.id);
    const staffRole = ['admin', 'superadmin', 'moderator'].includes(u.role);
    // Douane : super-admin seulement ; validation voix/caméra : toute l'équipe
    const toCheck = !staffRole && (state.customs?.enabled ? isSuperMe() && !u.verified : state.customs?.media && isStaff() && !(u.voiceOk && u.camOk));
    return el('div', { class: 'list-item' + (u.ghost ? ' is-ghost' : '') + (muted ? ' is-muted' : ''), 'data-uid': u.id, title: u.ghost ? 'En mode fantôme (visible seulement par les super-admins)' : '', onclick: () => openProfile(u.id) },
      av,
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, u.ghost ? '👻 ' : '', state.customs?.enabled && !u.verified ? (u.refused ? '❌ ' : '🛂 ') : '', LC.name(u), ' ', el('span', { class: 'g-' + u.gender }, LC.genderIcon(u.gender)), ' ', LC.badge(u), roomModBadge(u.id), (state.customs?.enabled ? !u.verified && !u.refused : state.customs?.media && !['admin', 'superadmin', 'moderator'].includes(u.role)) ? LC.douaneBadges(u, false) : null, u.photoOk ? LC.photoBadge(u) : null),
        LC.badgesRow(u.badges, true),
        el('div', { class: 'sub' }, muted ? el('span', { class: 'mute-left', 'data-mute-left': u.id }, '🔇 ' + muteLeftText(u.id)) : (u.statusText || u.statusEmoji ? `${u.statusEmoji} ${u.statusText}`.trim()
          : [u.age ? u.age + ' ans' : '', u.city, roomName(u.room)].filter(Boolean).join(' · ')))),
      toCheck ? el('button', { class: 'btn btn-sm verify-btn' + (u.voiceOk ? ' on' : ''), title: u.voiceOk ? 'Voix validée (cliquer pour retirer)' : 'Valider la voix', onclick: e => { e.stopPropagation(); setBadge(u, 'voice', !u.voiceOk); } }, '🎙️') : null,
      toCheck ? el('button', { class: 'btn btn-sm verify-btn' + (u.camOk ? ' on' : ''), title: u.camOk ? 'Caméra validée (cliquer pour retirer)' : 'Valider la caméra', onclick: e => { e.stopPropagation(); setBadge(u, 'cam', !u.camOk); } }, '📷') : null,
      toCheck && state.customs?.enabled && !u.refused ? el('button', { class: 'btn btn-sm verify-btn refuse', title: 'Refuser : aucun rôle, pas d\'accès', onclick: e => { e.stopPropagation(); verifyUser(u, false, true); } }, '❌') : null);
  }), ...awayRows);
}
$('userSearch').oninput = renderUsers;
$('genderFilter').querySelectorAll('button').forEach(b => b.onclick = () => {
  state.filter = b.dataset.g;
  $('genderFilter').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
  renderUsers();
});

// ---------- Modales ----------
function modal(...content) {
  const back = el('div', { class: 'modal-back', onclick: e => { if (e.target === back) back.remove(); } },
    el('div', { class: 'card modal' }, ...content));
  document.body.append(back);
  const close = () => back.remove();
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  return close;
}

// openProfile() et openMyProfile() sont dans profile.js
async function modAction(url, body, msg, after, method = 'POST') {
  try { await api(url, { method, body }); toast('✅ ' + msg); after && after(); } catch (e) { toast(e.message); }
}
function mention(name) {
  const i = $('input');
  i.value = (i.value ? i.value.trimEnd() + ' ' : '') + '@' + name + ' ';
  i.focus();
}

function openReport(u) {
  const reason = el('textarea', { class: 'input', rows: 4, maxlength: 500, placeholder: 'Explique ce qui s\'est passé…' });
  const err = el('div', { class: 'error' });
  const close = modal(
    el('h3', {}, 'Signaler ' + u.username),
    el('div', { class: 'field' }, reason), err,
    el('div', { class: 'actions' },
      el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
      el('button', { class: 'btn btn-danger', onclick: async () => {
        try { await api('/api/reports', { method: 'POST', body: { targetId: u.id, reason: reason.value } }); close(); toast('Merci, la modération a été prévenue.'); }
        catch (e) { err.textContent = e.message; }
      } }, 'Envoyer le signalement')));
  reason.focus();
}

async function logout() {
  try { if (Voice.slug) Voice.leave(); } catch (e) {}
  try { if (Call.id) Call.hangup(); } catch (e) {}
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  try { sessionStorage.setItem('lc_exit', JSON.stringify({ kind: 'logout', at: Date.now() })); } catch (e) {}
  location.href = '/';
}
// Demande de confirmation avant de se déconnecter
function askLogout() {
  closeUserMenu();
  const close = modal(el('div', { class: 'center' },
    el('div', { style: 'font-size:2.6rem' }, '🚪'),
    el('h3', {}, 'Se déconnecter ?'),
    el('p', { class: 'help' }, state.me?.isGuest ? 'Tu es invité : ton pseudo sera libéré et ton profil effacé dans 24 h.' : 'Tu pourras te reconnecter quand tu veux avec ton pseudo et ton mot de passe.'),
    el('div', { class: 'actions', style: 'margin-top:14px' },
      el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Rester'),
      el('button', { class: 'btn btn-danger', onclick: () => { close(); logout(); } }, '🚪 Se déconnecter'))));
}

// ---------- Menu de mon compte (clic sur mon pseudo) ----------
function closeUserMenu() { $('userMenu').classList.add('hidden'); }
function toggleUserMenu() {
  const m = $('userMenu');
  if (!m.classList.contains('hidden')) return closeUserMenu();
  const item = (icon, label, fn, cls = '') => el('button', { class: 'um-item ' + cls, onclick: () => { closeUserMenu(); fn(); } }, el('span', {}, icon), label);
  m.replaceChildren(...[
    el('div', { class: 'um-head' }, LC.avatar(state.me), el('div', {}, el('b', {}, state.me.username), el('div', { class: 'help' }, state.customs?.enabled && !state.me.verified ? (state.me.refused ? '❌ Refusé : aucun rôle' : '🛂 Aucun rôle : en attente de validation') : state.me.isGuest ? 'Invité' : LC.roleLabel(state.me.role)))),
    item('✏️', 'Personnaliser mon profil', openMyProfile),
    !state.me.isGuest ? item('📱', 'Mon téléphone', () => Phone.open()) : null,
    !state.me.isGuest ? item('🎯', 'Mes quêtes et mes badges', () => Progress.open()) : null,
    !state.me.isGuest ? item('🧍', 'Mon personnage de l\'Île', () => Look.open()) : null,
    !state.me.isGuest ? item('🐾', 'Mon animal', () => Pets.open()) : null,
    item('🔮', 'La Voyante du Paradise', () => Fortune.open()),
    item('🎮', 'Mini-jeux', () => Hub.open()),
    item('🏙️', 'La Ville du Paradise', () => Island.open(), 'mobile-only'),
    item('🏳️‍🌈', 'Espace Arc-en-ciel', () => $('prideBtn').click(), 'mobile-only'),
    !state.me.isGuest ? item('💰', 'Mes pièces et la boutique', () => Shop.open(), 'mobile-only') : null,
    item('🛡️', 'Équipe de modération', () => Team.open()),
    isStaff() ? item('🛡️', 'Administration', () => { location.href = '/admin'; }) : null,
    item('🌓', 'Changer le thème', () => LC.toggleTheme()),
    state.me.googleOn && !state.me.googleLinked && !state.me.isGuest ? item('🔐', 'Relier mon compte Google', () => { location.href = '/auth/google'; }) : null,
    el('div', { class: 'um-sep' }),
    item('🚪', 'Se déconnecter', askLogout, 'danger'),
    el('div', { class: 'um-sig signature' }, '💻 Site créé par ', el('b', {}, 'Anthony'), ' · Développeur JS')].filter(Boolean));
  m.classList.remove('hidden');
}
document.addEventListener('click', e => { if (!e.target.closest('.user-menu-wrap')) closeUserMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeUserMenu(); });

// ---------- Saisie ----------
const input = $('input');
let typingSent = 0;
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  if (Date.now() - typingSent > 2000) {
    typingSent = Date.now();
    if (state.view?.type === 'room') socket.emit('typing');
    else if (state.view?.type === 'pm') socket.emit('pm_typing', state.view.userId);
  }
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); }
});
$('composer').onsubmit = e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !state.view) return;
  if (isMuted()) return toast('🔇 Tu es rendu muet pour le moment');
  if (Dictation.on) Dictation.stop();
  const done = res => {
    if (res && res.error) return toast(res.error);
    input.value = ''; input.style.height = 'auto';
    input.dispatchEvent(new Event('input'));
  };
  if (state.view.type === 'room') socket.emit('message', staffOnlyMode ? { text, staffOnly: true } : text, done);
  else socket.emit('pm', { to: state.view.userId, text }, done);
};
// ---------- Messages réservés aux administrateurs (en orange) ----------
let staffOnlyMode = false;
function updateStaffOnlyBtn() {
  const b = $('staffOnlyBtn');
  const can = LC.isAdminRole(state.me) && state.view?.type === 'room';
  b.classList.toggle('hidden', !can);
  if (!can) staffOnlyMode = false;
  b.classList.toggle('on', staffOnlyMode);
  $('composer').classList.toggle('staff-mode', staffOnlyMode);
  b.textContent = staffOnlyMode ? '🔒' : '🔓';
  b.title = staffOnlyMode ? 'Mode admins : seuls les administrateurs verront ton message (clique pour écrire à tout le monde)' : 'Écrire un message visible seulement par les administrateurs';
  if (state.view?.type === 'room' && state.currentRoom) setPlaceholder(staffOnlyMode ? '🔒 Message visible seulement par les admins…' : `Message dans ${state.currentRoom.name}…`, staffOnlyMode ? '🔒 Admins seulement…' : 'Message…');
}
$('staffOnlyBtn').onclick = () => { staffOnlyMode = !staffOnlyMode; updateStaffOnlyBtn(); $('input').focus(); };
document.addEventListener('viewchange', updateStaffOnlyBtn);
// ---------- Espace Arc-en-ciel LGBTQ+ : un univers aux couleurs de la fierté ----------
$('prideBtn').onclick = () => joinRoom('fierte');
function setPrideUniverse(on) {
  const main = document.querySelector('.main');
  main.classList.toggle('pride-universe', on);
  let fx = $('prideFx'), banner = $('prideBanner');
  if (!on) { fx?.remove(); banner?.remove(); return; }
  if (!fx) {
    // Des cœurs aux couleurs des drapeaux qui montent doucement
    const colors = ['#ff2d55', '#ff9500', '#ffe600', '#34ff6a', '#2fa8ff', '#c64dff', '#5bcefa', '#f5a9b8', '#ffffff', '#ff4fd8'];
    fx = el('div', { id: 'prideFx', class: 'pride-fx' }, ...Array.from({ length: 18 }, (_, i) => el('span', { style: `left:${(i * 97) % 100}%;color:${colors[i % colors.length]};animation-delay:${-(i * 1.3) % 14}s;animation-duration:${10 + (i % 5) * 2}s;font-size:${14 + (i % 4) * 6}px` }, i % 3 ? '♥' : '✦')));
    main.prepend(fx);
  }
  if (!banner) {
    banner = el('div', { id: 'prideBanner', class: 'pride-banner' },
      el('div', { class: 'pride-flags' }, '🏳️‍🌈', el('span', {}, '🏳️‍⚧️'), '💖', '💜', '💙'),
      el('b', {}, 'Bienvenue dans l\'espace Arc-en-ciel'),
      el('small', {}, 'Ici, tout le monde est accepté comme il est. Respect, bienveillance et fierté 💖 La haine n\'a pas sa place : le ModoBot et l\'équipe veillent.'));
    $('messages').before(banner);
  }
}
// Panneau : deux onglets, les émojis classiques et les émoticônes animées du Paradise
function renderEmojiPanel(tab = 'paradise') {
  $('emojiPanel').dataset.tab = tab;
  const add = t => { input.value += (input.value && !input.value.endsWith(' ') ? ' ' : '') + t + ' '; input.focus(); input.dispatchEvent(new Event('input')); };
  $('emojiPanel').replaceChildren(...[
    el('div', { class: 'emoji-tabs' },
      el('button', { type: 'button', class: tab === 'paradise' ? 'on' : '', onclick: e => { e.stopPropagation(); renderEmojiPanel('paradise'); } }, '✨ Paradise'),
      el('button', { type: 'button', class: tab === 'emoji' ? 'on' : '', onclick: e => { e.stopPropagation(); renderEmojiPanel('emoji'); } }, '😀 Émojis')),
    el('div', { class: 'emoji-grid' + (tab === 'paradise' ? ' emotes' : '') }, ...(tab === 'paradise'
      ? [state.me && !state.me.isGuest ? el('button', { type: 'button', class: 'emote-add', title: 'Créer une émoticône avec une photo', onclick: ev => { ev.stopPropagation(); $('emojiPanel').classList.add('hidden'); openCreateEmote(); } }, '➕', el('small', {}, 'Créer')) : null,
        ...EMOTES.map(c => el('button', { type: 'button', class: /^(gg|mdr|bravo|coucou)$/.test(c) ? 'wide' : '', title: `:${c}:`, onclick: () => add(`:${c}:`) }, emoteImg(c))),
        ...[...customEmotes.values()].map(e => el('div', { class: 'emote-cell' },
          el('button', { type: 'button', title: `:${e.code}: · créée par ${e.owner || '?'}`, onclick: () => add(`:${e.code}:`) }, emoteImg(e.code)),
          LC.isAdminRole(state.me) || e.ownerId === state.me?.id ? el('button', { type: 'button', class: 'emote-del', title: 'Supprimer cette émoticône', onclick: ev => { ev.stopPropagation(); deleteEmote(e); } }, '✕') : null)),
        null]
      : EMOJIS.map(em => el('button', { type: 'button', onclick: () => add(em) }, em)))),
    tab === 'paradise' && pendingEmotes.length ? el('div', { class: 'emote-pending' },
      el('b', {}, LC.isAdminRole(state.me) ? '⏳ À valider' : '⏳ En attente de validation'),
      ...pendingEmotes.map(e => el('div', { class: 'emote-prow' },
        el('img', { class: 'emote', src: e.url, alt: e.code }), el('span', {}, `:${e.code}: · ${e.owner}`),
        LC.isAdminRole(state.me) ? el('button', { type: 'button', class: 'btn btn-sm btn-ok', onclick: async ev => { ev.stopPropagation(); try { await api(`/api/emotes/${e.id}/approve`, { method: 'POST' }); toast(`✅ :${e.code}: validée`); loadEmotes(); } catch (er) { toast(er.message); } } }, '✅') : null,
        el('button', { type: 'button', class: 'btn btn-sm', onclick: ev => { ev.stopPropagation(); deleteEmote(e); } }, LC.isAdminRole(state.me) ? '❌' : 'Annuler')))) : null].filter(Boolean));
}
async function deleteEmote(e) {
  if (!confirm(`Supprimer l'émoticône :${e.code}: ?`)) return;
  try { await api('/api/emotes/' + e.id, { method: 'DELETE' }); toast(`🗑 :${e.code}: supprimée`); loadEmotes(); } catch (er) { toast(er.message); }
}
// Créer une émoticône : on choisit une photo, on lui donne un nom, et hop !
function openCreateEmote() {
  let blob = null;
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', class: 'hidden' });
  const preview = el('div', { class: 'emote-preview' }, el('span', {}, '🖼️'));
  const name = el('input', { class: 'input', maxlength: 15, placeholder: 'ex : anthony, rire, fiesta…' });
  const err = el('div', { class: 'error' });
  const isAdm = LC.isAdminRole(state.me);
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    err.textContent = '';
    if (!name.value) name.value = f.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 15);
    try {
      if (f.type === 'image/gif' || f.type === 'image/webp') {
        // Les GIF animés gardent leur animation
        if (f.size > 2 * 1024 * 1024) throw new Error('GIF trop lourd (2 Mo maximum)');
        blob = f;
      } else blob = await squareImage(f, 160);
      preview.replaceChildren(el('img', { src: URL.createObjectURL(blob), alt: '' }));
    } catch (e) { err.textContent = e.message; blob = null; }
  };
  const close = modal(
    el('h3', {}, '😊 Créer une émoticône'),
    el('p', { class: 'help', style: 'margin-top:-6px' }, isAdm ? 'Ajoute une photo, donne-lui un nom, et hop : tout le monde peut l\'utiliser tout de suite !' : 'Ajoute une photo et donne-lui un nom. Un administrateur la validera, puis tout le monde pourra l\'utiliser.'),
    el('div', { class: 'emote-create' }, preview,
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => file.click() }, '📁 Choisir une photo ou un GIF')),
    el('small', { class: 'help' }, 'PNG, JPG, GIF animé ou WEBP. La photo est recadrée en carré.'),
    field('Nom de l\'émoticône (on l\'écrira :nom: dans les messages)', name),
    err, file,
    el('button', { class: 'btn btn-primary', style: 'width:100%;margin-top:6px', onclick: async () => {
      err.textContent = '';
      const code = name.value.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!blob) return (err.textContent = 'Choisis d\'abord une photo');
      if (code.length < 2) return (err.textContent = 'Donne-lui un nom (2 à 15 lettres ou chiffres)');
      try {
        const r = await fetch('/api/emotes?code=' + encodeURIComponent(code), { method: 'POST', body: blob, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Envoi impossible');
        close();
        toast(d.emote.status === 'ok' ? `🎉 :${d.emote.code}: est prête ! Écris :${d.emote.code}: dans un message` : `⏳ :${d.emote.code}: est envoyée : un admin va la valider`);
        loadEmotes();
      } catch (e) { err.textContent = e.message; }
    } }, '✨ Créer l\'émoticône'));
  return close;
}
// Recadre une photo en carré (centre) et la réduit
function squareImage(f, size) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      c.toBlob(b => (b ? ok(b) : ko(new Error('Image illisible'))), 'image/png');
    };
    img.onerror = () => ko(new Error('Image illisible'));
    img.src = URL.createObjectURL(f);
  });
}
renderEmojiPanel();
$('emojiBtn').onclick = () => { const p = $('emojiPanel'); const opening = p.classList.contains('hidden'); if (opening) renderEmojiPanel(p.dataset.tab || 'paradise'); p.classList.toggle('hidden'); if (opening) loadEmotes(); };
document.addEventListener('click', e => { if (!e.target.closest('#emojiPanel, #emojiBtn')) $('emojiPanel').classList.add('hidden'); });

// ---------- Socket ----------
const socket = io();
// Nouvelle version du site en ligne : on recharge la page tout seul (après un court message)
let myBuild = null;
socket.on('build', b => {
  if (!myBuild) { myBuild = b; return; }
  if (b === myBuild) return;
  const busy = (typeof Call !== 'undefined' && Call.id) || (typeof Voice !== 'undefined' && Voice.slug);
  const go = () => location.reload();
  if (busy) { toast('✨ Le site a été mis à jour : recharge la page quand tu auras fini ton vocal ou ton appel'); return; }
  toast('✨ Le site vient d\'être mis à jour : rechargement…');
  setTimeout(go, 2500);
});
const typers = new Map();
function renderTyping() {
  const now = Date.now();
  for (const [n, t] of typers) if (now - t > 4000) typers.delete(n);
  const names = [...typers.keys()];
  const box = $('typing');
  box.classList.toggle('on', names.length > 0);
  if (!names.length) { box.replaceChildren(); markTypingUsers(); return; }
  const who = names.length === 1 ? `${names[0]} est en train d'écrire`
    : names.length === 2 ? `${names[0]} et ${names[1]} sont en train d'écrire`
    : names.length === 3 ? `${names[0]}, ${names[1]} et ${names[2]} sont en train d'écrire`
    : 'Plusieurs personnes sont en train d\'écrire';
  box.replaceChildren(el('span', { class: 'typing-dots' }, el('i'), el('i'), el('i')), el('span', { class: 'typing-text' }, who));
  markTypingUsers();
}
// « ✍️ écrit… » à côté des pseudos dans la liste des connectés
function markTypingUsers() {
  document.querySelectorAll('#userList .list-item').forEach(li => {
    const name = li.querySelector('.uname')?.textContent;
    li.classList.toggle('is-typing', !!name && typers.has(name));
  });
}
setInterval(renderTyping, 1000);

socket.on('connect_error', err => {
  if (err.message === 'unauthorized' || err.message === 'banned') location.href = '/';
});
socket.on('hello', async ({ user, announcement, ghost, ghostAnon }) => {
  // On attend que tous les fichiers du site soient chargés (sinon une connexion très rapide arrive trop tôt)
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  state.me = user;
  state.ghostAnon = !!ghostAnon;
  renderMe();
  window.Shop?.init();
  if (!user.isGuest) window.Progress?.load();
  applyGhost(ghost);
  loadBirthdays();
  loadMutes();
  showSeasonBanner();
  setAnnouncement(announcement);
  loadNotifications();
  renderMuteBanner();
  try {
    const { ids } = await api('/api/blocks');
    state.blocked = new Set(ids);
    await loadRooms();
    await loadConvs();
    loadFriends();
    loadEmotes();
  } catch (e) { return toast(e.message); }
  if (state.view?.type === 'pm') return;
  let slug = state.view?.slug;
  try { slug = slug || localStorage.getItem('lc_room'); } catch (e) {}
  Media.load();
  if (needsCustoms() || slug === 'douane' && !state.customs?.enabled) return joinDefaultRoom();
  if (!state.rooms.find(r => r.slug === slug && !(r.membersOnly && user.isGuest))) return joinDefaultRoom();
  joinRoom(slug);
});
socket.on('presence', ({ users }) => {
  state.online = users;
  const me = users.find(u => u.id === state.me?.id);
  if (me && (me.role !== state.me.role)) { state.me = { ...state.me, role: me.role }; renderMe(); }
  renderUsers(); renderRooms(); renderConvs();
  if (state.currentRoom?.slug === 'douane') renderCustoms();
});
socket.on('message', m => {
  if (state.view?.type === 'room' && state.view.slug === m.room) {
    addRoomMessage(m);
    typers.delete(m.username); renderTyping();
  }
});
socket.on('system', ({ room, text }) => {
  if (!room) return toast(text);
  if (state.view?.type === 'room' && state.view.slug === room) addSys(text);
});
socket.on('typing', ({ room, username }) => {
  const who = state.online.find(u => u.username === username);
  if (who && typeof isUserMuted === 'function' && isUserMuted(who.id)) return;
  if (state.view?.type === 'room' && state.view.slug === room) { typers.set(username, Date.now()); renderTyping(); }
});
socket.on('pm_typing', ({ from }) => {
  if (state.view?.type === 'pm' && state.view.userId === from) {
    typers.clear(); typers.set(state.convs.get(from)?.user.username || '…', Date.now()); renderTyping();
  }
});
socket.on('pm', m => {
  const otherId = m.from === state.me.id ? m.to : m.from;
  if (state.blocked.has(otherId)) return;
  let conv = state.convs.get(otherId);
  if (!conv) {
    const other = m.from === state.me.id ? (state.online.find(u => u.id === m.to) || { id: m.to, username: '…' }) : m.fromUser;
    conv = { user: other, unread: 0, last: null };
    state.convs.set(otherId, conv);
  }
  conv.last = { content: m.content, created_at: m.createdAt };
  // remonter la conversation en tête
  state.convs.delete(otherId); state.convs = new Map([[otherId, conv], ...state.convs]);
  const viewing = state.view?.type === 'pm' && state.view.userId === otherId;
  if (viewing) {
    addBubble(m); scrollDown(m.from === state.me.id);
    if (m.from !== state.me.id) { socket.emit('pm_read', otherId); typers.clear(); renderTyping(); if (document.hidden) ding(); }
  } else if (m.from !== state.me.id) {
    conv.unread = (conv.unread || 0) + 1;
    ding();
    toast(`💌 ${m.fromUser.username} : ${m.content.slice(0, 60)}`, () => openPm(m.fromUser));
  }
  renderConvs();
});
socket.on('friends_changed', () => loadFriends());
socket.on('emotes_changed', () => loadEmotes());
socket.on('message_revealed', ({ id }) => {
  const row = document.querySelector(`.msg[data-id="${id}"]`);
  if (!row) return;
  row.classList.remove('staff-only');
  row.querySelector('.staff-only-bar')?.remove();
  if (row._msg) row._msg.staffOnly = false;
});
socket.on('message_edited', ({ id, content, editedAt }) => {
  const row = document.querySelector(`.msg[data-id="${id}"]`);
  if (!row) return;
  const m = row._msg || {};
  Object.assign(m, { content, editedAt });
  applyEdit(row, m, 'room');
});
// Supprimer son message privé : il disparaît chez les deux personnes
function deletePm(m) {
  if (!confirm('Supprimer ce message pour tout le monde ?\nIl disparaîtra aussi chez l\'autre personne.')) return;
  socket.emit('pm_delete', { id: m.id }, res => res?.error && toast(res.error));
}
socket.on('pm_conv_deleted', ({ a, b }) => {
  const other = a === state.me.id ? b : a;
  state.convs.delete(other);
  state.pmCache.delete(other);
  if (state.view?.type === 'pm' && state.view.userId === other) {
    $('messages').replaceChildren();
    addSys(a === state.me.id ? '🗑 Conversation supprimée' : '🗑 Cette conversation a été supprimée');
  }
  renderConvs();
});
socket.on('pm_deleted', ({ id, from, to }) => {
  const otherId = from === state.me.id ? to : from;
  const list = state.pmCache.get(otherId);
  if (list) state.pmCache.set(otherId, list.filter(x => x.id !== id));
  document.querySelector(`.bubble-row[data-pm="${id}"]`)?.remove();
  if (typeof loadConvs === 'function') loadConvs().catch(() => {});
});
socket.on('pm_edited', ({ id, from, to, content, editedAt }) => {
  const otherId = from === state.me.id ? to : from;
  const list = state.pmCache.get(otherId);
  const cached = list && list.find(x => x.id === id);
  if (cached) Object.assign(cached, { content, editedAt });
  const row = document.querySelector(`.bubble-row[data-pm="${id}"]`);
  if (row) { const m = row._msg || {}; Object.assign(m, { content, editedAt }); applyEdit(row, m, 'pm'); }
});
socket.on('message_deleted', ({ id }) => document.querySelector(`.msg[data-id="${id}"]`)?.remove());
socket.on('room_cleared', ({ slug }) => { if (state.view?.slug === slug) { $('messages').replaceChildren(); addSys('Le salon a été vidé par un administrateur.'); } });
socket.on('room_deleted', ({ slug }) => {
  if (Voice.slug === slug) Voice.leave(false);
  if (state.view?.slug === slug) { toast('Ce salon a été supprimé'); state.view = null; state.currentRoom = null; joinDefaultRoom(); }
});
socket.on('room_ejected', ({ slug, reason }) => {
  if (Voice.slug === slug) { Voice.leave(false); if (state.view?.slug !== slug) toast('🎙️ ' + (reason || 'Tu as quitté le vocal')); }
  if (state.view?.slug === slug) { state.view = null; state.currentRoom = null; joinDefaultRoom(); }
});
// L'invitation arrive aussi comme notification (voir notifications.js)
socket.on('room_invite', () => loadRooms());
socket.on('room_radio', ({ slug, station, by }) => {
  const wasPlayingOld = state.currentRoom?.station && Media.isPlaying(state.currentRoom.station);
  if (state.currentRoom?.slug === slug) state.currentRoom.station = station;
  if (state.view?.slug === slug) {
    addSys(station ? `📻 ${by} a mis ${station.name} dans le salon` : `📻 ${by} a coupé la radio du salon`);
    if (wasPlayingOld) station ? Media.play(station, true) : Media.stop();
  }
  renderRoomHead();
});
socket.on('rooms_changed', async () => { await loadRooms(); if (!state.view) joinDefaultRoom(); });
socket.on('announcement', ({ text }) => setAnnouncement(text));
socket.on('ghost_state', ({ ghost }) => applyGhost(ghost));
socket.on('site_changed', ({ site }) => { LC.applySite(site); try { localStorage.setItem('lc_site', JSON.stringify(site)); } catch (e) {} });
socket.on('broadcast', ({ text, from }) => {
  ding();
  toast(`📢 ${from} : ${text}`);
  if (state.view?.type === 'room') addSys(`📢 Annonce de ${from} : ${text}`, 'broadcast');
});
socket.on('staff_alert', ({ text, slug, url }) => { ding(); toast((slug ? '' : '🛡️ ') + text, () => (slug ? joinRoom(slug) : (location.href = url || '/admin#reports'))); });
// Mon compte a changé côté serveur (ex. photo vérifiée par le staff)
socket.on('me_updated', u => { if (u && state.me && u.id === state.me.id) { Object.assign(state.me, u); renderMe(); } });
// Expulsion / bannissement : on garde le message pour l'afficher sur la page d'accueil
function leaveWith(kind, reason) {
  try { sessionStorage.setItem('lc_exit', JSON.stringify({ kind, reason, at: Date.now() })); } catch (e) {}
  location.href = '/';
}
socket.on('kicked', ({ reason }) => leaveWith('kick', reason));
socket.on('banned', ({ reason }) => leaveWith('ban', reason));
socket.on('disconnect', reason => { Voice.leave(false); if (reason !== 'io server disconnect') addSys('Connexion perdue, reconnexion…'); });

function setAnnouncement(text) {
  $('announce').textContent = text ? '📢 ' + text : '';
  $('announce').classList.toggle('hidden', !text);
}

// ---------- Anniversaires ----------
async function loadBirthdays() {
  try {
    const { users } = await api('/api/birthdays');
    const box = $('bdayList');
    $('bdaySection').classList.toggle('hidden', !users.length);
    box.replaceChildren(...users.map(u => el('div', { class: 'list-item bday-item' },
      LC.avatar(u),
      el('div', { class: 'meta', onclick: () => openProfile(u.id) }, el('div', { class: 'name' }, LC.name(u)), el('div', { class: 'sub' }, u.online ? '🟢 en ligne' : 'hors ligne')),
      u.id !== state.me.id ? el('button', { class: 'btn btn-sm', title: 'Lui souhaiter', onclick: () => wishBirthday(u) }, '🎉') : el('span', { class: 'pill hot' }, 'Toi !'))));
  } catch (e) {}
}
function wishBirthday(u) {
  openPm(u);
  setTimeout(() => { input.value = `Joyeux anniversaire ${u.username} ! 🎂🎉 Passe une super journée !`; input.dispatchEvent(new Event('input')); input.focus(); }, 300);
}
socket.on('birthday', ({ user }) => {
  loadBirthdays();
  if (user.id === state.me?.id) return; // la personne reçoit sa propre fenêtre de fête
  LC.confetti(['🎂', '🎉', '🎈']);
  ding();
  toast(`🎂 C'est l'anniversaire de ${user.username} aujourd'hui ! Clique pour lui souhaiter 🎉`, () => wishBirthday(user));
  if (state.view?.type === 'room') addSys(`🎂 C'est l'anniversaire de ${user.username} aujourd'hui ! Souhaitez-lui plein de bonnes choses 🎉`, 'broadcast');
});

// ---------- Thème de fête : bannière du jour ----------
function showSeasonBanner() {
  const key = LC.site?.theme;
  const b = $('seasonBanner');
  let closed = '';
  try { closed = localStorage.getItem('lc_season_closed') || ''; } catch (e) {}
  const today = new Date().toDateString() + key;
  if (!key || !LC.SEASONS[key] || closed === today) return b.classList.add('hidden');
  b.replaceChildren(el('span', { style: 'flex:1' }, LC.greeting(key)),
    el('button', { class: 'btn btn-icon', title: 'Fermer', onclick: () => { b.classList.add('hidden'); try { localStorage.setItem('lc_season_closed', today); } catch (e) {} } }, '✕'));
  b.classList.remove('hidden');
}
document.addEventListener('site', () => showSeasonBanner());
$('fxBtn').onclick = () => { const on = LC.toggleFx(); $('fxBtn').textContent = on ? '✨ Effets' : '✨ Effets coupés'; };

// ---------- Douane ----------
const isSuperMe = () => state.me?.role === 'superadmin';
// Donner ou retirer un badge de la douane (🎙️ voix ou 📷 caméra)
async function setBadge(u, kind, on) {
  try {
    const r = await api('/api/customs/verify/' + u.id, { method: 'POST', body: { [kind]: on } });
    const what = kind === 'voice' ? '🎙️ Voix' : '📷 Caméra';
    toast(r.verified ? `✅ ${u.username} a les deux badges : accepté !` : `${what} de ${u.username} ${on ? 'validée' : 'retirée'}${on ? ' (' + (r.voice ? '' : 'reste la voix') + (r.cam ? '' : 'reste la caméra') + ')' : ''}`);
  } catch (e) { toast(e.message); }
}
async function verifyUser(u, verified, refuse = false) {
  if (refuse && !confirm(`Refuser ${u.username} ? Il n'aura aucun rôle et ne pourra pas accéder au site.`)) return;
  try {
    await api('/api/customs/verify/' + u.id, { method: 'POST', body: { verified, refuse } });
    toast(verified ? `✅ ${u.username} est validé` : refuse ? `❌ ${u.username} est refusé` : `🛂 ${u.username} renvoyé à la douane`);
  } catch (e) { toast(e.message); }
}
async function setCustomsOpen(open) {
  try { await api('/api/customs/open', { method: 'POST', body: { open } }); } catch (e) { toast(e.message); }
}
// Salon « Vérification » : explications et badges de la personne, ou les personnes à valider pour l'équipe
function renderVerifyBanner(b) {
  b.classList.remove('hidden');
  const waiting = state.online.filter(u => u.room === 'douane' && !['admin', 'superadmin', 'moderator'].includes(u.role) && !(u.voiceOk && u.camOk));
  if (isStaff()) {
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, 'Salle de vérification'),
        el('div', { class: 'help' }, waiting.length ? `${waiting.length} personne(s) à valider. Écoute-les au vocal, puis clique sur 🎙️ (voix) ou 📷 (caméra) à côté de leur pseudo.` : 'Personne n\'attend de validation pour le moment.')));
  } else {
    const me = state.me;
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, me.voiceOk && me.camOk ? '✅ Tu as tes deux badges !' : 'Fais valider ta voix et ta caméra'),
        el('div', { class: 'help' }, me.voiceOk && me.camOk ? 'Tu peux parler et allumer ta caméra partout sur le site.' : 'Ici, le micro et la caméra marchent pour tout le monde. Rejoins le vocal 🎙️ avec ta caméra : un membre de l\'équipe va te valider.'),
        el('div', { style: 'margin-top:4px;font-weight:700' }, `🎙️ Voix : ${me.voiceOk ? '✅' : '⏳'} · 📷 Caméra : ${me.camOk ? '✅' : '⏳'}`)),
      me.voiceOk && me.camOk ? null : el('button', { class: 'btn btn-sm btn-primary', onclick: async () => {
        try { const r = await api('/api/verify/request', { method: 'POST' }); toast(r.staffOnline ? `📣 ${r.staffOnline} membre(s) de l'équipe prévenu(s)` : '📣 Demande envoyée : l\'équipe te répondra dès qu\'elle sera connectée'); } catch (e) { toast(e.message); }
      } }, '📣 Prévenir l\'équipe'));
  }
  renderMuteBanner();
}
function renderCustoms() {
  const b = $('customsBanner');
  const r = state.currentRoom;
  const inDouane = state.view?.type === 'room' && r?.slug === 'douane';
  const c = state.customs || {};
  if (!c.enabled && c.media && inDouane) return renderVerifyBanner(b);
  if (!c.enabled || !inDouane && !needsCustoms()) { b.classList.add('hidden'); return renderMuteBanner(); }
  b.classList.remove('hidden');
  if (isStaff()) {
    const waiting = state.online.filter(u => !u.verified && u.room === 'douane').length;
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, `Douane ${c.open ? 'ouverte' : 'fermée'}`),
        el('div', { class: 'help' }, waiting ? `${waiting} personne(s) attendent. ${isSuperMe() ? 'Fais-les venir au vocal avec la caméra, puis valide 🎙️ la voix et 📷 la caméra à côté de leur pseudo (les deux sont nécessaires), ou ❌ pour refuser.' : 'Seul un super-admin peut les valider.'}` : 'Personne n\'attend pour le moment.')),
      el('button', { class: 'btn btn-sm ' + (c.open ? 'btn-danger' : 'btn-primary'), onclick: () => setCustomsOpen(!c.open) }, c.open ? '🔒 Fermer la douane' : '🔓 Ouvrir la douane'));
  } else {
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, state.me.refused ? '❌ Ta demande a été refusée' : c.open ? 'Bienvenue à la douane !' : 'La douane est fermée pour le moment'),
        el('button', { class: 'customs-online', onclick: () => { if (!$('right').classList.contains('open') && getComputedStyle($('toggleRight')).display !== 'none') $('toggleRight').click(); } },
          `👥 ${state.online.filter(u => !u.ghost).length} personne(s) en ligne sur le site`, el('span', { class: 'help' }, ' · voir qui')),
        el('div', { class: 'help' }, state.me.refused
          ? 'Un super-admin a refusé ton accès : tu n\'as aucun rôle et tu ne peux pas écrire pour le moment.'
          : c.open
            ? `Rejoins le vocal 🎙️ de la douane avec ta caméra 📷 allumée : un super-admin valide ta voix puis ta caméra. Il faut les deux badges pour accéder au site. Tes badges : 🎙️ ${state.me.voiceOk ? '✅' : '⏳'} · 📷 ${state.me.camOk ? '✅' : '⏳'}`
            : 'Un membre du staff va bientôt l\'ouvrir. Reste ici, tu pourras écrire dès qu\'elle sera ouverte.')));
  }
  renderMuteBanner();
}
socket.on('customs', c => {
  state.customs = c;
  loadRooms();
  renderCustoms();
  renderUsers();
});
socket.on('verified_state', ({ verified, refused, voiceOk, camOk }) => {
  state.me.verified = verified;
  if (voiceOk !== undefined) { state.me.voiceOk = voiceOk; state.me.camOk = camOk; if (typeof renderVoice === 'function') renderVoice(); }
  state.me.refused = !!refused;
  state.me.validated = !!(verified && state.customs?.enabled);
  if (typeof renderMe === 'function') renderMe();
  loadRooms().then(() => {
    if (verified) { if (state.currentRoom?.slug === 'douane') joinDefaultRoom(); }
    else if (state.view?.slug !== 'douane') joinRoom('douane');
    renderCustoms();
  });
});

// Sur téléphone : les boutons d'un message (🌐 traduire, ✏️ modifier, 🗑 supprimer) s'affichent quand on touche le message
if (matchMedia('(hover: none)').matches) {
  document.addEventListener('click', e => {
    const m = e.target.closest('.msg');
    if (e.target.closest('a, button, .avatar, .uname, img, video, audio, input, .msg-tools')) return;
    document.querySelectorAll('.msg.tools-open').forEach(x => x !== m && x.classList.remove('tools-open'));
    if (m && m.querySelector('.msg-tools')) m.classList.toggle('tools-open');
  });
}

// 🏅 Un membre gagne un badge : il apparaît tout de suite sous son pseudo, partout
socket.on('badges', ({ userId, badges }) => {
  const u = (state.online || []).find(x => x.id === userId); if (u) u.badges = badges;
  document.querySelectorAll(`.msg .who[data-uid="${userId}"]`).forEach(w => {
    const body = w.closest('.body'); if (!body) return;
    body.querySelector(':scope > .ubadges')?.remove();
    const row = LC.badgesRow(badges); if (row) { row.classList.add('fresh'); body.children[0].after(row); }
  });
  if (u) renderUsers();
});

// 💤 la liste des membres déconnectés récemment (mise à jour chaque minute)
async function loadRecent() { try { state.recent = (await api('/api/users/recent')).users; renderUsers(); } catch (e) {} }
setTimeout(loadRecent, 2500); setInterval(loadRecent, 60000);
