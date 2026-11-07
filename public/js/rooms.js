// The Paradise — salons créés par les membres : création, gestion, invitations, exclusions
const ROOM_ICONS = ['🏠', '🎮', '🎧', '🔥', '💜', '🌙', '🍕', '⚽', '🎬', '🎤', '🕹️', '👾', '🏆', '💬', '🌴', '🍻'];

function iconPicker(current) {
  let value = current || ROOM_ICONS[0];
  const box = el('div', { class: 'icon-pick' });
  const draw = () => box.replaceChildren(...ROOM_ICONS.map(i =>
    el('button', { type: 'button', class: i === value ? 'active' : '', onclick: () => { value = i; draw(); } }, i)));
  draw();
  return { box, get: () => value };
}
const field = (label, input) => el('div', { class: 'field' }, el('label', {}, label), input);
const toggleRow = (label, help, input) => el('label', { class: 'switch' }, el('span', {}, label, help ? el('small', { class: 'help' }, help) : null), input);

$('createRoomBtn').onclick = () => openCreateRoom(state.canCreate ? 'perm' : 'temp');
$('createTempBtn').onclick = () => openCreateRoom('temp');

// Création d'un salon : permanent (membres) ou temporaire (tout le monde), à son pseudo ou avec un nom au choix
function openCreateRoom(kind = 'temp') {
  let type = kind === 'perm' && state.canCreate ? 'perm' : 'temp';
  let naming = 'pseudo';
  const icon = iconPicker('🎮');
  const name = el('input', { class: 'input', maxlength: 30, placeholder: 'Ex : La team Paradise' });
  const desc = el('input', { class: 'input', maxlength: 120, placeholder: 'De quoi on parle ici ?' });
  const priv = el('input', { type: 'checkbox' });
  const err = el('div', { class: 'error' });
  const typeRow = el('div', { class: 'room-type' });
  const nameRow = el('div', {});
  const draw = () => {
    typeRow.replaceChildren(
      el('button', { type: 'button', class: 'room-type-card perm' + (type === 'perm' ? ' active' : ''), disabled: !state.canCreate,
        title: state.canCreate ? '' : 'Inscris-toi pour créer un salon permanent', onclick: () => { type = 'perm'; draw(); } },
        el('b', {}, '📌 Permanent'), el('small', {}, state.canCreate ? `Reste ouvert tout le temps (${state.maxUserRooms} max par membre)` : 'Réservé aux membres inscrits')),
      el('button', { type: 'button', class: 'room-type-card temp' + (type === 'temp' ? ' active' : ''), onclick: () => { type = 'temp'; draw(); } },
        el('b', {}, '⏳ Temporaire'), el('small', {}, `Se ferme tout seul ${state.tempMinutes || 5} min après le départ du dernier`)));
    const pseudoName = `Salon de ${state.me.username}`;
    nameRow.replaceChildren(type === 'temp'
      ? field('Nom du salon', el('div', {},
        el('div', { class: 'choice-row', style: 'margin-bottom:8px' },
          el('button', { type: 'button', class: 'choice' + (naming === 'pseudo' ? ' active' : ''), onclick: () => { naming = 'pseudo'; draw(); } }, `👤 À mon pseudo : « ${pseudoName} »`),
          el('button', { type: 'button', class: 'choice' + (naming === 'custom' ? ' active' : ''), onclick: () => { naming = 'custom'; draw(); name.focus(); } }, '✏️ Nom au choix')),
        naming === 'custom' ? name : null))
      : field('Nom du salon', name));
  };
  draw();
  const close = modal(
    el('h3', {}, '✨ Créer un salon'),
    field('Type de salon', typeRow),
    nameRow,
    field('Icône', icon.box), field('Description (facultatif)', desc),
    toggleRow('🔒 Salon fermé', 'Seules les personnes que tu invites pourront entrer', priv),
    err,
    el('div', { class: 'actions', style: 'margin-top:14px' },
      el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        err.textContent = '';
        try {
          const body = { name: name.value, description: desc.value, icon: icon.get(), isPrivate: priv.checked };
          if (type === 'temp') Object.assign(body, { temporary: true, usePseudo: naming === 'pseudo' });
          const { room } = await api('/api/rooms', { method: 'POST', body });
          close();
          await loadRooms();
          joinRoom(room.slug);
          toast(room.temporary ? `⏳ Salon temporaire « ${room.name} » ouvert !` : room.isPrivate ? '🔒 Salon fermé créé ! Ouvre ⚙️ pour inviter du monde.' : '🎉 Ton salon est ouvert !');
          if (room.isPrivate) setTimeout(() => openRoomSettings(room), 400);
        } catch (e) { err.textContent = e.message; }
      } }, 'Créer le salon')));
}

async function openRoomSettings(room) {
  const icon = iconPicker(room.icon);
  const name = el('input', { class: 'input', maxlength: 30, value: room.name });
  const desc = el('input', { class: 'input', maxlength: 120, value: room.description || '' });
  const priv = el('input', { type: 'checkbox', checked: room.isPrivate });
  const voiceOn = el('input', { type: 'checkbox', checked: room.voiceEnabled });
  if (!Media.stations.length) await Media.load();
  const radio = el('select', { class: 'input' },
    el('option', { value: '' }, '— Pas de radio —'),
    ...Media.stations.map(s => el('option', { value: s.id, selected: room.station?.id === s.id }, `${s.icon} ${s.name}${s.genre ? ' · ' + s.genre : ''}`)));
  const err = el('div', { class: 'error' });

  // Fond d'écran du salon : fond animé tout prêt, GIF animé, vidéo ou image
  const bgPreview = el('div', { class: 'bg-preview room-bg' });
  const presets = el('div', { class: 'bg-presets' });
  const applyRoom = updated => {
    room.background = updated.background;
    if (state.currentRoom?.id === room.id) state.currentRoom.background = updated.background;
    drawBg(); renderRoomHead();
  };
  const drawBg = () => {
    paintRoomBg(bgPreview, room.background);
    if (!room.background) bgPreview.append(el('span', { class: 'bg-none' }, 'Aucun fond'));
    presets.replaceChildren(...BG_PRESETS.map(([k, label]) => el('button', {
      type: 'button', class: 'bg-preset' + (room.background === 'preset:' + k ? ' active' : ''), title: label,
      onclick: async () => {
        try { const { room: u } = await api('/api/rooms/' + room.id, { method: 'PATCH', body: { backgroundPreset: k } }); applyRoom(u); bgStatus.textContent = `✅ Fond animé « ${label} » appliqué`; } catch (e) { toast(e.message); }
      },
    }, el('span', { class: 'room-bg preset-' + k }, el('i'), el('i'), el('i')), el('small', {}, label))));
  };
  const bgFile = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm', class: 'hidden' });
  const bgStatus = el('small', { class: 'help' });
  bgFile.onchange = async () => {
    const f = bgFile.files[0];
    if (!f) return;
    bgStatus.textContent = '⏳ Envoi…';
    try {
      let updated;
      if (f.type === 'image/gif' || f.type.startsWith('video/')) {
        // GIF animés et vidéos : envoyés tels quels pour garder l'animation
        if (f.size > (f.type.startsWith('video/') ? 12 : 6) * 1024 * 1024) throw new Error(f.type.startsWith('video/') ? 'Vidéo trop lourde (12 Mo max, quelques secondes en boucle suffisent)' : 'GIF trop lourd (6 Mo max)');
        const r = await fetch(`/api/rooms/${room.id}/background/file`, { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Envoi impossible');
        updated = d.room;
      } else {
        const data = await readImage(f, 1600, 1000);
        updated = (await api(`/api/rooms/${room.id}/background`, { method: 'POST', body: { data } })).room;
      }
      applyRoom(updated);
      bgStatus.textContent = '✅ Fond appliqué';
    } catch (e) { bgStatus.textContent = '❌ ' + e.message; }
    bgFile.value = '';
  };
  drawBg();
  const bgField = field('🖼️ Fond d\'écran du salon (visible par tous dans ce salon)', el('div', {},
    bgPreview,
    el('div', { class: 'help', style: 'margin:10px 0 6px' }, '✨ Fonds animés :'),
    presets,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px;flex-wrap:wrap' },
      el('button', { type: 'button', class: 'btn btn-sm btn-primary', style: 'flex:none', onclick: () => bgFile.click() }, '📁 Mon image, GIF ou vidéo'),
      el('button', { type: 'button', class: 'btn btn-sm', style: 'flex:none', onclick: async () => {
        try {
          await api(`/api/rooms/${room.id}/background`, { method: 'DELETE' });
          applyRoom({ background: '' }); bgStatus.textContent = 'Fond retiré';
        } catch (e) { toast(e.message); }
      } }, 'Retirer')),
    el('small', { class: 'help', style: 'display:block;margin-top:4px' }, 'GIF animé (6 Mo max) ou petite vidéo MP4/WebM en boucle (12 Mo max, sans le son).'),
    bgFile, bgStatus));

  const inviteInput = el('input', { class: 'input', maxlength: 20, placeholder: 'Pseudo à inviter' });
  const memberList = el('div', { class: 'people-list' });

  async function loadPeople() {
    try {
      const { members } = await api(`/api/rooms/${room.id}/members`);
      memberList.replaceChildren(...(members.length ? members.map(u => personRow(u, '✕ Retirer', async () => {
        await api(`/api/rooms/${room.id}/members/${u.id}`, { method: 'DELETE' }); loadPeople();
      })) : [el('div', { class: 'side-empty' }, 'Personne pour l\'instant')]));

    } catch (e) { err.textContent = e.message; }
  }
  const personRow = (u, label, action) => el('div', { class: 'person' },
    LC.avatar(u), el('span', { style: 'flex:1' }, u.username),
    el('button', { class: 'btn btn-sm', onclick: () => action().catch(e => toast(e.message)) }, label));

  const invite = async () => {
    if (!inviteInput.value.trim()) return;
    try {
      const { user } = await api(`/api/rooms/${room.id}/members`, { method: 'POST', body: { username: inviteInput.value.trim() } });
      toast(`🎟️ ${user.username} est invité`);
      inviteInput.value = '';
      loadPeople();
    } catch (e) { toast(e.message); }
  };
  inviteInput.addEventListener('keydown', e => { if (e.key === 'Enter') invite(); });

  const close = modal(
    el('h3', {}, '⚙️ Gérer « ' + room.name + ' »'),
    isRoomOwner(room) || !room.ownerId ? null : el('p', { class: 'help', style: 'margin-top:-6px' }, `👑 Tu es co-gérant de ce salon (propriétaire : ${room.ownerName}).`),
    field('Icône', icon.box),
    field('Nom', name),
    field('Description', desc),
    bgField,
    field('📻 Radio du salon (tout le monde peut l\'écouter)', radio),
    toggleRow('🔒 Salon fermé', 'Seules les personnes invitées peuvent entrer. Les autres sont sortis immédiatement.', priv),
    toggleRow('🎙️ Chat vocal', 'Autoriser le vocal dans ce salon', voiceOn),
    err,
    el('button', { class: 'btn btn-primary', style: 'width:100%;margin:10px 0 4px', onclick: async () => {
      err.textContent = '';
      try {
        const body = { stationId: radio.value ? parseInt(radio.value, 10) : null, isPrivate: priv.checked, voiceEnabled: voiceOn.checked };
        Object.assign(body, { name: name.value, description: desc.value, icon: icon.get() });
        const { room: updated } = await api('/api/rooms/' + room.id, { method: 'PATCH', body });
        Object.assign(room, updated);
        if (state.currentRoom?.id === room.id) state.currentRoom = updated;
        renderRoomHead();
        toast('✅ Salon mis à jour');
      } catch (e) { err.textContent = e.message; }
    } }, 'Enregistrer'),
    el('div', { class: 'staff-actions' },
      el('h4', {}, '🎟️ Personnes invitées'),
      el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, inviteInput, el('button', { class: 'btn', style: 'flex:none', onclick: invite }, 'Inviter')),
      memberList),
    el('div', { class: 'staff-actions' }, el('h4', {}, '🛡️ Sanctions en cours'), roomBansList(room)),
    roomModsBox(room),
    room.ownerId ? managersBox(room) : null,
    room.ownerId && isRoomOwner(room) ? el('div', { class: 'staff-actions' },
      el('button', { class: 'btn btn-danger', style: 'width:100%', onclick: async () => {
        if (!confirm(`Supprimer définitivement le salon « ${room.name} » ?`)) return;
        try { await api('/api/rooms/' + room.id, { method: 'DELETE' }); close(); toast('🗑 Salon supprimé'); } catch (e) { toast(e.message); }
      } }, '🗑 Supprimer le salon')) : null,
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Fermer'));
  loadPeople();
}

// Propriétaire (ou équipe) du salon : peut le supprimer et choisir les co-gérants
const isRoomOwner = r => !!r && (r.ownerId ? r.ownerId === state.me.id || isStaff() : LC.isAdminRole(state.me));

// Co-gérants : d'autres personnes qui peuvent modifier le salon avec le propriétaire
function managersBox(room) {
  const list = el('div', { class: 'people-list' });
  const input = el('input', { class: 'input', maxlength: 20, placeholder: 'Pseudo du co-gérant' });
  const draw = managers => {
    room.managers = managers;
    list.replaceChildren(...(managers.length ? managers.map(m => el('div', { class: 'person' },
      el('span', { style: 'flex:1' }, '👑 ' + m.username),
      isRoomOwner(room) || m.id === state.me.id ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { draw((await api(`/api/rooms/${room.id}/managers/${m.id}`, { method: 'DELETE' })).managers); toast(m.id === state.me.id ? 'Tu n\'es plus co-gérant' : `${m.username} n'est plus co-gérant`); } catch (e) { toast(e.message); }
      } }, m.id === state.me.id ? 'Me retirer' : '✕ Retirer') : null))
      : [el('div', { class: 'side-empty' }, 'Aucun co-gérant pour l\'instant')]));
  };
  const add = async () => {
    if (!input.value.trim()) return;
    try { draw((await api(`/api/rooms/${room.id}/managers`, { method: 'POST', body: { username: input.value.trim() } })).managers); toast(`👑 ${input.value.trim()} est maintenant co-gérant`); input.value = ''; } catch (e) { toast(e.message); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  draw(room.managers || []);
  return el('div', { class: 'staff-actions' },
    el('h4', {}, '👑 Co-gérants'),
    el('p', { class: 'help', style: 'margin:0 0 8px' }, 'Ils peuvent modifier le salon (nom, fond, radio, invités, exclusions) mais pas le supprimer.'),
    isRoomOwner(room) ? el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, input, el('button', { class: 'btn', style: 'flex:none', onclick: add }, 'Nommer')) : null,
    list);
}

// Boutons ajoutés dans la fiche profil quand on gère ou modère le salon actuel
function roomActions(u, closeProfile) {
  const r = state.currentRoom;
  if (state.view?.type !== 'room' || !canModRoom(r) || u.id === r.ownerId || u.id === state.me.id) return null;
  const manage = canManage(r);
  return el('div', { class: 'staff-actions' },
    el('h4', {}, r.ownerId === state.me.id ? `Mon salon « ${r.name} »` : `Salon « ${r.name} »`),
    el('div', { class: 'actions' },
      manage && r.ownerId && isRoomOwner(r) && !(r.managers || []).some(m => m.id === u.id) && !u.isGuest ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${r.id}/managers`, { method: 'POST', body: { userId: u.id } }); toast(`👑 ${u.username} est maintenant co-gérant`); closeProfile(); } catch (e) { toast(e.message); }
      } }, '👑 Nommer co-gérant') : null,
      isRoomOwner(r) && !u.isGuest ? (isRoomModOf(r, u.id)
        ? el('button', { class: 'btn btn-sm', onclick: () => setRoomMod(r, u, false) }, '🤍 Retirer modo du salon')
        : el('button', { class: 'btn btn-sm', onclick: () => setRoomMod(r, u, true) }, '🤍 Nommer modo du salon')) : null,
      manage && r.isPrivate ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${r.id}/members`, { method: 'POST', body: { userId: u.id } }); toast(`🎟️ ${u.username} invité`); } catch (e) { toast(e.message); }
      } }, '🎟️ Inviter') : null,
      ...Object.entries(ROOM_SANCTIONS).map(([k, S]) => el('button', { class: 'btn btn-sm btn-danger', onclick: () => roomSanction(r, u, k, closeProfile) }, S.icon + ' ' + S.btn))));
}

// ---------- Modération des salons (modo simple : badge blanc, 4 par salon) ----------
const ROOM_SANCTIONS = {
  expulsion: { icon: '⏱️', btn: 'Expulsion 1 h', label: 'expulsé 1 h', text: 'Il pourra revenir dans 1 heure.' },
  exclusion: { icon: '🚪', btn: 'Exclusion 5 h', label: 'exclu 5 h', text: 'Il pourra revenir dans 5 heures.', reason: true },
  ban: { icon: '⛔', btn: 'Bannir à vie', label: 'banni à vie', text: 'Il ne pourra plus revenir, sauf si on le débannit.' },
};
const isRoomModOf = (r, id) => !!r && (r.mods || []).some(m => m.id === id);
const canModRoom = r => !!r && state.me && !state.me.isGuest && (canManage(r) || isRoomModOf(r, state.me.id));
async function roomSanction(r, u, kind, done) {
  const S = ROOM_SANCTIONS[kind];
  let reason = '';
  if (S.reason) {
    reason = prompt(`🚪 Exclusion de ${u.username} pendant 5 h\nMotif (obligatoire) :`, '');
    if (reason === null) return;
    reason = reason.trim();
    if (reason.length < 3) return toast('Indique le motif de l\'exclusion');
  } else if (!confirm(`${S.icon} ${S.btn} : ${u.username} du salon « ${r.name} » ?\n${S.text}`)) return;
  try {
    await api(`/api/rooms/${r.id}/sanction`, { method: 'POST', body: { kind, userId: u.id, reason } });
    toast(`${S.icon} ${u.username} ${S.label}`);
    done && done();
  } catch (e) { toast(e.message); }
}
async function setRoomMod(r, u, on) {
  try {
    if (on) await api(`/api/rooms/${r.id}/mods`, { method: 'POST', body: { userId: u.id } });
    else await api(`/api/rooms/${r.id}/mods/${u.id}`, { method: 'DELETE' });
    toast(on ? `🤍 ${u.username} est modérateur du salon` : `${u.username} n'est plus modérateur du salon`);
  } catch (e) { toast(e.message); }
}
// Liste des personnes sanctionnées, avec le bouton « Débannir »
function roomBansList(room) {
  const box = el('div', { class: 'people-list' }, el('div', { class: 'side-empty' }, 'Chargement…'));
  const fmt = t => new Date(t).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const load = async () => {
    try {
      const { bans } = await api(`/api/rooms/${room.id}/bans`);
      box.replaceChildren(...(bans.length ? bans.map(b => el('div', { class: 'person ban-row' },
        LC.avatar(b),
        el('div', { style: 'flex:1;min-width:0' },
          el('b', {}, b.username), ' ', el('span', { class: 'ban-kind k-' + b.kind }, (ROOM_SANCTIONS[b.kind] || ROOM_SANCTIONS.ban).icon + ' ' + (b.until ? (b.kind === 'exclusion' ? 'Exclu' : 'Expulsé') + ' jusqu\'à ' + fmt(b.until) : 'Banni à vie')),
          el('div', { class: 'help', style: 'margin:2px 0 0' }, [b.reason ? 'Motif : ' + b.reason : '', b.by ? 'par ' + b.by : ''].filter(Boolean).join(' · '))),
        el('button', { class: 'btn btn-sm btn-ok', onclick: async () => {
          try { await api(`/api/rooms/${room.id}/bans/${b.userId}`, { method: 'DELETE' }); toast(`✅ ${b.username} peut revenir`); load(); } catch (e) { toast(e.message); }
        } }, '↺ Débannir'))) : [el('div', { class: 'side-empty' }, 'Personne n\'est sanctionné dans ce salon')]));
    } catch (e) { box.replaceChildren(el('div', { class: 'side-empty' }, e.message)); }
  };
  load();
  return box;
}
function openRoomBans(room) {
  const close = modal(el('h3', {}, `🛡️ Sanctions · ${room.name}`),
    el('p', { class: 'help' }, 'Les expulsions (1 h) et exclusions (5 h) se lèvent toutes seules. Le bannissement est à vie, sauf si on débannit.'),
    roomBansList(room),
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Fermer'));
}
// Les modérateurs du salon (4 maximum), nommés par le propriétaire (ou les admins pour les salons officiels)
function roomModsBox(room) {
  const list = el('div', { class: 'people-list' });
  const input = el('input', { class: 'input', maxlength: 20, placeholder: 'Pseudo du modérateur' });
  const owner = isRoomOwner(room);
  const draw = () => {
    const mods = room.mods || [];
    list.replaceChildren(...(mods.length ? mods.map(m => el('div', { class: 'person' },
      el('span', { style: 'flex:1' }, el('span', { class: 'badge roommod' }, 'Modo'), ' ', m.username),
      owner || m.id === state.me.id ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${room.id}/mods/${m.id}`, { method: 'DELETE' }); room.mods = mods.filter(x => x.id !== m.id); draw(); } catch (e) { toast(e.message); }
      } }, m.id === state.me.id ? 'Me retirer' : '✕ Retirer') : null))
      : [el('div', { class: 'side-empty' }, 'Aucun modérateur pour l\'instant')]));
  };
  const add = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await api(`/api/rooms/${room.id}/mods`, { method: 'POST', body: { username: name } });
      const { rooms } = await api('/api/rooms');
      room.mods = rooms.find(x => x.id === room.id)?.mods || room.mods;
      input.value = ''; draw(); toast(`🤍 ${name} est modérateur du salon`);
    } catch (e) { toast(e.message); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  draw();
  return el('div', { class: 'staff-actions' },
    el('h4', {}, '🤍 Modérateurs du salon (4 maximum)'),
    el('p', { class: 'help', style: 'margin:0 0 8px' }, 'Clic droit (ou appui long) sur un pseudo : expulsion 1 h, exclusion 5 h avec motif, bannissement à vie et débannissement.'),
    owner ? el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, input, el('button', { class: 'btn', style: 'flex:none', onclick: add }, 'Nommer')) : null,
    list);
}

// Badge blanc « Modo » des modérateurs du salon où l'on est
function roomModBadge(id) {
  const r = state.view?.type === 'room' ? state.currentRoom : null;
  return isRoomModOf(r, id) ? el('span', { class: 'badge roommod', title: `Modérateur du salon « ${r.name} »` }, 'Modo salon') : null;
}

// ---------- Menu clic droit (ou appui long sur téléphone) sur un pseudo ----------
function openUserMenu(uid, x, y) {
  document.querySelector('.ctx-menu')?.remove();
  const u = (state.online || []).find(o => o.id === uid) || { id: uid, username: '' };
  const r = state.view?.type === 'room' ? state.currentRoom : null;
  const items = [];
  const item = (label, fn, cls = '') => items.push(el('button', { class: 'ctx-item ' + cls, onclick: () => { menu.remove(); fn(); } }, label));
  item('👤 Voir le profil', () => openProfile(uid));
  if (uid !== state.me.id && u.username) item('💌 Message privé', () => openPm(u));
  if (uid !== state.me.id && u.username && !u.isGuest && !state.me.isGuest && typeof friendAction === 'function') {
    const fr = state.friends || { friends: [], incoming: [], outgoing: [] };
    if (fr.incoming.some(x => x.id === uid)) item('✅ Accepter son amitié', () => friendAction(u, 'accept'));
    else if (!fr.friends.some(x => x.id === uid) && !fr.outgoing.some(x => x.id === uid)) item('➕ Ajouter en ami', () => friendAction(u, 'add'));
  }
  if (r && canModRoom(r) && uid !== state.me.id && uid !== r.ownerId) {
    items.push(el('div', { class: 'ctx-sep' }, `🛡️ ${r.name}`));
    for (const [k, S] of Object.entries(ROOM_SANCTIONS)) item(S.icon + ' ' + S.btn, () => roomSanction(r, u, k), 'danger');
    if (isRoomOwner(r) && !u.isGuest) item(isRoomModOf(r, uid) ? '🤍 Retirer modo du salon' : '🤍 Nommer modo du salon', () => setRoomMod(r, u, !isRoomModOf(r, uid)));
  }
  if (r && canModRoom(r)) item('📋 Sanctions / débannir', () => openRoomBans(r));
  const menu = el('div', { class: 'ctx-menu' }, u.username ? el('div', { class: 'ctx-head' }, u.username) : null, ...items);
  document.body.append(menu);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
}
document.addEventListener('contextmenu', e => {
  const t = e.target.closest && e.target.closest('[data-uid]');
  if (!t || !state.me) return;
  e.preventDefault();
  openUserMenu(parseInt(t.dataset.uid, 10), e.clientX, e.clientY);
});
// Appui long sur téléphone
(() => {
  let timer = null, sx = 0, sy = 0;
  document.addEventListener('touchstart', e => {
    const t = e.target.closest && e.target.closest('[data-uid]');
    if (!t || !state.me) return;
    const p = e.touches[0]; sx = p.clientX; sy = p.clientY;
    timer = setTimeout(() => {
      timer = null;
      openUserMenu(parseInt(t.dataset.uid, 10), sx, sy);
      const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
      t.addEventListener('click', stop, { capture: true, once: true }); // pas d'ouverture du profil en plus
      setTimeout(() => t.removeEventListener('click', stop, { capture: true }), 600);
    }, 550);
  }, { passive: true });
  const cancel = e => { if (!timer) return; if (e.type === 'touchmove') { const p = e.touches[0]; if (Math.hypot(p.clientX - sx, p.clientY - sy) < 10) return; } clearTimeout(timer); timer = null; };
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev => document.addEventListener(ev, cancel, { passive: true }));
})();

// ---------- Fonds de salon (aussi utilisés par chat.js) ----------
const BG_PRESETS = [['aurore', 'Aurore'], ['etoiles', 'Étoiles'], ['galaxie', 'Galaxie'], ['vagues', 'Vagues néon'], ['bulles', 'Bulles'], ['pluie', 'Pluie'], ['coucher', 'Coucher de soleil'], ['feu', 'Feu de camp']];
function paintRoomBg(box, bg) {
  box.className = box.className.split(' ').filter(c => !c.startsWith('preset-')).join(' ');
  box.style.backgroundImage = '';
  box.replaceChildren();
  if (!bg) return;
  if (bg.startsWith('preset:')) { box.classList.add('preset-' + bg.slice(7)); box.append(el('i'), el('i'), el('i')); return; }
  if (/\.(mp4|webm)$/i.test(bg)) {
    const v = el('video', { autoplay: true, muted: true, loop: true, playsinline: true, src: bg });
    v.muted = true; box.append(v); v.play().catch(() => {});
    return;
  }
  box.style.backgroundImage = `url("${bg}")`;
}
function renderRoomBg(r) {
  const box = $('roomBg');
  const bg = r?.background || '';
  document.querySelector('.main').classList.toggle('has-room-bg', !!bg);
  if (box.dataset.bg === bg) return;
  box.dataset.bg = bg;
  paintRoomBg(box, bg);
}
