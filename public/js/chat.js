// GajoxGaming — client du chat
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
const isStaff = () => state.me && ['admin', 'moderator'].includes(state.me.role);

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
function renderSoundBtn() { $('soundBtn').textContent = state.sound ? '🔊' : '🔇'; }
$('soundBtn').onclick = () => {
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

// ---------- Rendu : en-tête utilisateur ----------
function renderMe() {
  const chip = $('meChip');
  chip.replaceChildren(...[LC.avatar(state.me), el('span', { class: 'me-name' }, state.me.username), LC.badge(state.me)].filter(Boolean));
  chip.onclick = openMyProfile;
  $('adminLink').classList.toggle('hidden', !isStaff());
}

// ---------- Salons ----------
async function loadRooms() {
  const d = await api('/api/rooms');
  state.rooms = d.rooms;
  state.canCreate = d.canCreate;
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
const canManage = r => !!r && (r.ownerId ? (r.ownerId === state.me.id || isStaff()) : state.me.role === 'admin');

function roomItem(r, counts) {
  const locked = r.membersOnly && state.me.isGuest;
  const v = (state.voice.get(r.slug) || []).length;
  return el('div', {
    class: 'list-item' + (state.view?.type === 'room' && state.view.slug === r.slug ? ' active' : ''),
    title: r.description, style: locked ? 'opacity:.5' : '',
    onclick: () => locked ? toast('🔒 Salon réservé aux membres inscrits') : joinRoom(r.slug),
  },
    el('div', { class: 'ico' }, r.icon),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, r.name, r.isPrivate ? ' 🔒' : '', locked ? ' 🔒' : '', r.ownerId === state.me.id ? ' 👑' : ''),
      el('div', { class: 'sub' }, r.ownerId ? `par ${r.ownerName}${r.station ? ' · 📻 ' + r.station.name : ''}` : (r.station ? '📻 ' + r.station.name : r.description))),
    v ? el('span', { class: 'pill voice-pill', title: 'En vocal' }, '🎙️' + v) : null,
    el('span', { class: 'pill' + (counts[r.slug] ? ' hot' : '') }, counts[r.slug] || 0));
}
function renderRooms() {
  const counts = {};
  state.online.forEach(u => { if (u.room) counts[u.room] = (counts[u.room] || 0) + 1; });
  const official = state.rooms.filter(r => !r.ownerId);
  const members = state.rooms.filter(r => r.ownerId).sort((a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0));
  $('roomList').replaceChildren(...official.map(r => roomItem(r, counts)));
  $('userRoomList').replaceChildren(...(members.length ? members.map(r => roomItem(r, counts))
    : [el('div', { class: 'side-empty' }, state.canCreate ? 'Aucun salon pour l\'instant. Crée le tien !' : 'Inscris-toi pour créer ton propre salon.')]));
  $('createRoomBtn').classList.toggle('hidden', !state.canCreate);
}

function renderRoomHead() {
  const r = state.currentRoom;
  const inRoom = state.view?.type === 'room' && r;
  $('headRadio').classList.toggle('hidden', !inRoom || !r.station);
  $('headVoice').classList.toggle('hidden', !inRoom || !state.voiceEnabled || !r.voiceEnabled);
  $('headSettings').classList.toggle('hidden', !inRoom || !canManage(r));
  if (!inRoom) { $('voiceBar').classList.add('hidden'); return; }
  $('headIcon').textContent = r.icon;
  $('headTitle').textContent = r.name + (r.isPrivate ? ' 🔒' : '');
  $('headSub').textContent = r.ownerId ? `Salon de ${r.ownerName}${r.description ? ' · ' + r.description : ''}` : r.description;
  if (r.station) {
    const playing = Media.isPlaying(r.station);
    $('headRadio').textContent = `${r.station.icon} ${r.station.name} ${playing ? '⏸' : '▶'}`;
    $('headRadio').onclick = () => playing ? Media.toggle() : Media.play(r.station, true);
  }
  $('headSettings').onclick = () => openRoomSettings(r);
  renderVoice();
}

function joinRoom(slug) {
  socket.emit('join', slug, res => {
    if (res.error) return toast(res.error);
    if (Voice.slug && Voice.slug !== slug) Voice.leave(false);
    state.view = { type: 'room', slug };
    state.currentRoom = res.room;
    state.voice.set(slug, res.voice || []);
    try { localStorage.setItem('lc_room', slug); } catch (e) {}
    $('headProfile').classList.add('hidden');
    $('input').placeholder = `Message dans ${res.room.name}…`;
    $('messages').replaceChildren();
    res.history.forEach(m => addRoomMessage(m, false));
    addSys('Bienvenue dans ' + res.room.name + ' ! Sois respectueux 💜');
    if (res.room.station && !Media.isPlaying(res.room.station)) addSys(`📻 Ce salon écoute ${res.room.station.name} — clique sur ${res.room.station.name} ▶ en haut pour l'écouter.`);
    scrollDown(true);
    renderRoomHead(); renderRooms(); renderConvs(); renderUsers();
    closeDrawers();
    $('input').focus();
  });
}
function joinDefaultRoom() {
  const r = state.rooms.find(x => !x.ownerId && !(x.membersOnly && state.me.isGuest)) || state.rooms[0];
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
  const mention = m.userId !== state.me.id && new RegExp('@' + state.me.username + '\\b', 'i').test(m.content);
  const user = { id: m.userId, username: m.username, color: m.color, role: m.role, avatar: m.avatar, frame: m.frame, nameEffect: m.nameEffect };
  const row = el('div', { class: 'msg' + (mention ? ' mention' : ''), 'data-id': m.id },
    LC.avatar(user),
    el('div', { class: 'body' },
      el('div', {},
        el('span', { class: 'who', onclick: () => openProfile(m.userId) }, LC.name(user)),
        ' ', el('span', { class: 'g-' + m.gender }, LC.genderIcon(m.gender)), ' ', LC.badge(user),
        el('span', { class: 'time' }, LC.time(m.createdAt))),
      el('div', { class: 'text' }, linkify(m.content))),
    isStaff() ? el('button', { class: 'btn btn-sm btn-danger del', title: 'Supprimer', onclick: () => deleteMessage(m.id) }, '🗑') : null);
  $('messages').append(row);
  trimMessages();
  if (live) { scrollDown(m.userId === state.me.id); if (mention) { ding(); toast(`${m.username} t'a mentionné`); } }
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
  document.title = (total ? `(${total}) ` : '') + 'GajoxGaming — Salons';
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
  $('input').placeholder = `Message privé à ${user.username}…`;
  $('messages').replaceChildren(el('div', { class: 'sys' }, 'Conversation privée avec ' + user.username));
  renderConvs(); renderRooms(); closeDrawers();
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
    el('div', { class: 'bubble' }, linkify(m.content), el('span', { class: 'time' }, LC.time(m.createdAt)))));
  trimMessages();
}

// ---------- Utilisateurs connectés ----------
function renderUsers() {
  const q = $('userSearch').value.trim().toLowerCase();
  let users = state.online.filter(u => !state.blocked.has(u.id));
  $('onlineCount').textContent = state.online.length;
  if (state.filter === 'f' || state.filter === 'h') users = users.filter(u => u.gender === state.filter);
  if (state.filter === 'room') users = users.filter(u => state.view?.type === 'room' && u.room === state.view.slug);
  if (q) users = users.filter(u => u.username.toLowerCase().includes(q));
  const rank = u => (u.role === 'admin' ? 0 : u.role === 'moderator' ? 1 : 2);
  users.sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  const roomName = slug => state.rooms.find(r => r.slug === slug)?.name || '';
  if (!users.length) return $('userList').replaceChildren(el('div', { class: 'empty' }, 'Personne ici pour le moment'));
  $('userList').replaceChildren(...users.map(u => {
    const av = LC.avatar(u); av.append(el('span', { class: 'on' }));
    return el('div', { class: 'list-item', onclick: () => openProfile(u.id) },
      av,
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, LC.name(u), ' ', el('span', { class: 'g-' + u.gender }, LC.genderIcon(u.gender)), ' ', LC.badge(u)),
        el('div', { class: 'sub' }, u.statusText || u.statusEmoji ? `${u.statusEmoji} ${u.statusText}`.trim()
          : [u.age ? u.age + ' ans' : '', u.city, roomName(u.room)].filter(Boolean).join(' · '))));
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
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.href = '/';
}

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
  const done = res => {
    if (res && res.error) return toast(res.error);
    input.value = ''; input.style.height = 'auto';
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
  const names = [...typers.entries()].filter(([, t]) => now - t < 3000).map(([n]) => n);
  $('typing').textContent = names.length ? `${names.slice(0, 3).join(', ')} ${names.length > 1 ? 'écrivent' : 'écrit'}…` : '';
}
setInterval(renderTyping, 1000);

socket.on('connect_error', err => {
  if (err.message === 'unauthorized' || err.message === 'banned') location.href = '/';
});
socket.on('hello', async ({ user, announcement }) => {
  state.me = user;
  renderMe();
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
  if (!state.rooms.find(r => r.slug === slug && !(r.membersOnly && user.isGuest))) return joinDefaultRoom();
  joinRoom(slug);
});
socket.on('presence', ({ users }) => {
  state.online = users;
  const me = users.find(u => u.id === state.me?.id);
  if (me && (me.role !== state.me.role)) { state.me = { ...state.me, role: me.role }; renderMe(); }
  renderUsers(); renderRooms(); renderConvs();
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
socket.on('broadcast', ({ text, from }) => {
  ding();
  toast(`📢 ${from} : ${text}`);
  if (state.view?.type === 'room') addSys(`📢 Annonce de ${from} : ${text}`, 'broadcast');
});
socket.on('staff_alert', ({ text }) => { ding(); toast('🛡️ ' + text, () => location.href = '/admin#reports'); });
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
