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
  d.rooms.forEach(r => { if (!state.voice.has(r.slug)) state.voice.set(r.slug, []); });
  if (state.view?.type === 'room') {
    const cur = d.rooms.find(r => r.slug === state.view.slug);
    if (cur) state.currentRoom = cur;
  }
  renderRooms();
  renderRoomHead();
}
const canManage = r => !!r && (r.ownerId ? (r.ownerId === state.me.id || isStaff() || (r.managers || []).some(m => m.id === state.me.id)) : LC.isAdminRole(state.me));

function roomItem(r, counts) {
  const customsLock = needsCustoms() && r.slug !== 'douane';
  const locked = (r.membersOnly && state.me.isGuest) || customsLock;
  const v = (state.voice.get(r.slug) || []).length;
  return el('div', {
    class: 'list-item' + (state.view?.type === 'room' && state.view.slug === r.slug ? ' active' : ''),
    title: r.description, style: locked ? 'opacity:.5' : '',
    onclick: () => (customsLock ? toast('🛂 Passe d\'abord par la Douane : un membre du staff va te vérifier') : locked ? toast('🔒 Salon réservé aux membres inscrits') : joinRoom(r.slug)),
  },
    el('div', { class: 'ico' }, r.icon),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, el('span', { class: r.temporary ? 'room-temp' : 'room-perm' }, r.name), r.isPrivate ? ' 🔒' : '', locked ? ' 🔒' : '', r.ownerId === state.me.id || (r.managers || []).some(m => m.id === state.me.id) ? ' 👑' : ''),
      el('div', { class: 'sub' }, r.temporary ? tempLabel(r) : r.ownerId ? `par ${r.ownerName}${r.station ? ' · 📻 ' + r.station.name : ''}` : (r.station ? '📻 ' + r.station.name : r.description))),
    v ? el('span', { class: 'pill voice-pill', title: 'En vocal' }, '🎙️' + v) : null,
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
  if (!inRoom) { $('voiceBar').classList.add('hidden'); renderVideoGrid(); return; }
  $('headIcon').textContent = r.icon;
  $('headTitle').textContent = r.name + (r.isPrivate ? ' 🔒' : '');
  $('headTitle').className = r.temporary ? 'room-temp' : 'room-perm';
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

function joinRoom(slug) {
  socket.emit('join', slug, res => {
    if (res.error) return toast(res.error);
    if (Voice.slug && Voice.slug !== slug) Voice.leave(false);
    state.view = { type: 'room', slug };
    typers.clear(); renderTyping();
    state.currentRoom = res.room;
    state.voice.set(slug, res.voice || []);
    try { localStorage.setItem('lc_room', slug); } catch (e) {}
    $('headProfile').classList.add('hidden');
    setPlaceholder(`Message dans ${res.room.name}…`);
    $('messages').replaceChildren();
    res.history.forEach(m => addRoomMessage(m, false));
    addSys('Bienvenue dans ' + res.room.name + ' ! Sois respectueux 💜');
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
  const r = state.rooms.find(x => !x.ownerId && x.slug !== 'douane' && !(x.membersOnly && state.me.isGuest)) || state.rooms[0];
  if (r) joinRoom(r.slug);
}

// ---------- Messages ----------
const nearBottom = () => { const m = $('messages'); return m.scrollHeight - m.scrollTop - m.clientHeight < 120; };
function scrollDown(force) { const m = $('messages'); if (force || nearBottom()) m.scrollTop = m.scrollHeight; }

function linkify(text) {
  const frag = document.createDocumentFragment();
  const re = /(https?:\/\/[^\s<]+)|(@[\p{L}\p{N}_\-]{3,20})/gu;
  let last = 0, m;
  while ((m = re.exec(text))) {
    frag.append(text.slice(last, m.index));
    if (m[1]) frag.append(el('a', { href: m[1], target: '_blank', rel: 'noopener noreferrer nofollow' }, m[1]));
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
  const user = { id: m.userId, username: m.username, color: m.color, role: m.role, avatar: m.avatar, frame: m.frame, nameEffect: m.nameEffect, isBirthday: m.isBirthday };
  const row = el('div', { class: 'msg' + (mention ? ' mention' : ''), 'data-id': m.id },
    LC.avatar(user),
    el('div', { class: 'body' },
      el('div', {},
        el('span', { class: 'who', onclick: () => m.anon ? toast('🛡️ Message de l\'équipe de modération') : openProfile(m.userId) }, m.anon ? '🛡️ ' : '', LC.name(user)),
        ' ', el('span', { class: 'g-' + m.gender }, LC.genderIcon(m.gender)), ' ', LC.badge(user),
        el('span', { class: 'time' }, LC.time(m.createdAt))),
      ...messageBody(m)),
    isStaff() ? el('button', { class: 'btn btn-sm btn-danger del', title: 'Supprimer', onclick: () => deleteMessage(m.id) }, '🗑') : null);
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
      c.unread ? el('span', { class: 'pill hot' }, c.unread) : null);
  }));
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
  $('messages').append(el('div', { class: 'bubble-row' + (mine ? ' mine' : '') },
    el('div', { class: 'bubble' + (m.kind === 'audio' ? ' audio' : m.kind === 'image' ? ' photo' : '') }, ...messageBody(m), el('span', { class: 'time' }, LC.time(m.createdAt)))));
  trimMessages();
}

// ---------- Utilisateurs connectés ----------
function renderUsers() {
  const q = $('userSearch').value.trim().toLowerCase();
  let users = state.online.filter(u => !state.blocked.has(u.id));
  $('onlineCount').textContent = state.online.filter(u => !u.ghost).length;
  if (state.filter === 'f' || state.filter === 'h') users = users.filter(u => u.gender === state.filter);
  if (state.filter === 'room') users = users.filter(u => state.view?.type === 'room' && u.room === state.view.slug);
  if (q) users = users.filter(u => u.username.toLowerCase().includes(q));
  const rank = u => 3 - LC.rank(u);
  users.sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  const roomName = slug => state.rooms.find(r => r.slug === slug)?.name || '';
  if (!users.length) return $('userList').replaceChildren(el('div', { class: 'empty' }, 'Personne ici pour le moment'));
  $('userList').replaceChildren(...users.map(u => {
    const av = LC.avatar(u); av.append(el('span', { class: 'on' }));
    const muted = typeof isUserMuted === 'function' && isUserMuted(u.id);
    const toCheck = state.customs?.enabled && !u.verified && isStaff();
    return el('div', { class: 'list-item' + (u.ghost ? ' is-ghost' : '') + (muted ? ' is-muted' : ''), title: u.ghost ? 'En mode fantôme (visible seulement par les super-admins)' : '', onclick: () => openProfile(u.id) },
      av,
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, u.ghost ? '👻 ' : '', state.customs?.enabled && !u.verified ? '🛂 ' : '', LC.name(u), ' ', el('span', { class: 'g-' + u.gender }, LC.genderIcon(u.gender)), ' ', LC.badge(u)),
        el('div', { class: 'sub' }, muted ? el('span', { class: 'mute-left', 'data-mute-left': u.id }, '🔇 ' + muteLeftText(u.id)) : (u.statusText || u.statusEmoji ? `${u.statusEmoji} ${u.statusText}`.trim()
          : [u.age ? u.age + ' ans' : '', u.city, roomName(u.room)].filter(Boolean).join(' · ')))),
      toCheck ? el('button', { class: 'btn btn-sm verify-btn', title: 'Valider : il passe la douane', onclick: e => { e.stopPropagation(); verifyUser(u, true); } }, '✅') : null);
  }));
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
    el('div', { class: 'um-head' }, LC.avatar(state.me), el('div', {}, el('b', {}, state.me.username), el('div', { class: 'help' }, state.me.isGuest ? 'Invité' : LC.roleLabel(state.me.role)))),
    item('✏️', 'Personnaliser mon profil', openMyProfile),
    item('🎮', 'Mini-jeux', () => Hub.open()),
    isStaff() ? item('🛡️', 'Administration', () => { location.href = '/admin'; }) : null,
    item('🌓', 'Changer le thème', () => LC.toggleTheme()),
    el('div', { class: 'um-sep' }),
    item('🚪', 'Se déconnecter', askLogout, 'danger')].filter(Boolean));
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
  if (state.view.type === 'room') socket.emit('message', text, done);
  else socket.emit('pm', { to: state.view.userId, text }, done);
};
$('emojiPanel').append(...EMOJIS.map(em => el('button', { type: 'button', onclick: () => { input.value += em; input.focus(); } }, em)));
$('emojiBtn').onclick = () => $('emojiPanel').classList.toggle('hidden');
document.addEventListener('click', e => { if (!e.target.closest('#emojiPanel, #emojiBtn')) $('emojiPanel').classList.add('hidden'); });

// ---------- Socket ----------
const socket = io();
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
  state.me = user;
  state.ghostAnon = !!ghostAnon;
  renderMe();
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
socket.on('message_deleted', ({ id }) => document.querySelector(`.msg[data-id="${id}"]`)?.remove());
socket.on('room_cleared', ({ slug }) => { if (state.view?.slug === slug) { $('messages').replaceChildren(); addSys('Le salon a été vidé par un administrateur.'); } });
socket.on('room_deleted', ({ slug }) => {
  if (Voice.slug === slug) Voice.leave(false);
  if (state.view?.slug === slug) { toast('Ce salon a été supprimé'); state.view = null; state.currentRoom = null; joinDefaultRoom(); }
});
socket.on('room_ejected', ({ slug, reason }) => {
  if (Voice.slug === slug) Voice.leave(false);
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
socket.on('staff_alert', ({ text, slug }) => { ding(); toast((slug ? '' : '🛡️ ') + text, () => (slug ? joinRoom(slug) : (location.href = '/admin#reports'))); });
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
async function verifyUser(u, verified) {
  try {
    await api('/api/customs/verify/' + u.id, { method: 'POST', body: { verified } });
    toast(verified ? `✅ ${u.username} a passé la douane` : `🛂 ${u.username} renvoyé à la douane`);
  } catch (e) { toast(e.message); }
}
async function setCustomsOpen(open) {
  try { await api('/api/customs/open', { method: 'POST', body: { open } }); } catch (e) { toast(e.message); }
}
function renderCustoms() {
  const b = $('customsBanner');
  const r = state.currentRoom;
  const inDouane = state.view?.type === 'room' && r?.slug === 'douane';
  const c = state.customs || {};
  if (!c.enabled || !inDouane && !needsCustoms()) { b.classList.add('hidden'); return renderMuteBanner(); }
  b.classList.remove('hidden');
  if (isStaff()) {
    const waiting = state.online.filter(u => !u.verified && u.room === 'douane').length;
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, `Douane ${c.open ? 'ouverte' : 'fermée'}`),
        el('div', { class: 'help' }, waiting ? `${waiting} personne(s) attendent d'être vérifiées : clique sur ✅ à côté de leur pseudo.` : 'Personne n\'attend pour le moment.')),
      el('button', { class: 'btn btn-sm ' + (c.open ? 'btn-danger' : 'btn-primary'), onclick: () => setCustomsOpen(!c.open) }, c.open ? '🔒 Fermer la douane' : '🔓 Ouvrir la douane'));
  } else {
    b.replaceChildren(el('span', { class: 'ghost-ico' }, '🛂'),
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, c.open ? 'Bienvenue à la douane !' : 'La douane est fermée pour le moment'),
        el('div', { class: 'help' }, c.open
          ? 'Présente-toi ici : un membre du staff va te vérifier. Ensuite tu auras accès à tous les salons, aux messages privés et à tout le site.'
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
socket.on('verified_state', ({ verified }) => {
  state.me.verified = verified;
  loadRooms().then(() => {
    if (verified) { if (state.currentRoom?.slug === 'douane') joinDefaultRoom(); }
    else if (state.view?.slug !== 'douane') joinRoom('douane');
    renderCustoms();
  });
});
