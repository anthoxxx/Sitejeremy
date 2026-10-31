// The Paradis — salons créés par les membres : création, gestion, invitations, exclusions
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

$('createRoomBtn').onclick = openCreateRoom;

function openCreateRoom() {
  const icon = iconPicker('🎮');
  const name = el('input', { class: 'input', maxlength: 30, placeholder: 'Ex : La team Paradis' });
  const desc = el('input', { class: 'input', maxlength: 120, placeholder: 'De quoi on parle ici ?' });
  const priv = el('input', { type: 'checkbox' });
  const err = el('div', { class: 'error' });
  const close = modal(
    el('h3', {}, '✨ Créer mon salon'),
    field('Icône', icon.box), field('Nom du salon', name), field('Description', desc),
    toggleRow('🔒 Salon fermé', 'Seules les personnes que tu invites pourront entrer', priv),
    err,
    el('div', { class: 'actions', style: 'margin-top:14px' },
      el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        try {
          const { room } = await api('/api/rooms', { method: 'POST', body: { name: name.value, description: desc.value, icon: icon.get(), isPrivate: priv.checked } });
          close();
          await loadRooms();
          joinRoom(room.slug);
          toast(room.isPrivate ? '🔒 Salon fermé créé ! Ouvre ⚙️ pour inviter du monde.' : '🎉 Ton salon est ouvert !');
          if (room.isPrivate) setTimeout(() => openRoomSettings(room), 400);
        } catch (e) { err.textContent = e.message; }
      } }, 'Créer le salon')));
  name.focus();
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
  const banList = el('div', { class: 'people-list' });

  async function loadPeople() {
    try {
      const { members, bans } = await api(`/api/rooms/${room.id}/members`);
      memberList.replaceChildren(...(members.length ? members.map(u => personRow(u, '✕ Retirer', async () => {
        await api(`/api/rooms/${room.id}/members/${u.id}`, { method: 'DELETE' }); loadPeople();
      })) : [el('div', { class: 'side-empty' }, 'Personne pour l\'instant')]));
      banList.replaceChildren(...(bans.length ? bans.map(u => personRow(u, '↺ Autoriser', async () => {
        await api(`/api/rooms/${room.id}/bans/${u.id}`, { method: 'DELETE' }); loadPeople();
      })) : [el('div', { class: 'side-empty' }, 'Aucune personne exclue')]));
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
    el('div', { class: 'staff-actions' }, el('h4', {}, '🚪 Personnes exclues'), banList),
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

// Boutons ajoutés dans la fiche profil quand on gère le salon actuel
function roomActions(u, closeProfile) {
  const r = state.currentRoom;
  if (state.view?.type !== 'room' || !canManage(r) || u.id === r.ownerId || u.id === state.me.id) return null;
  return el('div', { class: 'staff-actions' },
    el('h4', {}, r.ownerId === state.me.id ? `Mon salon « ${r.name} »` : `Salon « ${r.name} »`),
    el('div', { class: 'actions' },
      r.ownerId && isRoomOwner(r) && !(r.managers || []).some(m => m.id === u.id) && !u.isGuest ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${r.id}/managers`, { method: 'POST', body: { userId: u.id } }); toast(`👑 ${u.username} est maintenant co-gérant`); closeProfile(); } catch (e) { toast(e.message); }
      } }, '👑 Nommer co-gérant') : null,
      r.isPrivate ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${r.id}/members`, { method: 'POST', body: { userId: u.id } }); toast(`🎟️ ${u.username} invité`); } catch (e) { toast(e.message); }
      } }, '🎟️ Inviter') : null,
      el('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
        if (!confirm(`Exclure ${u.username} du salon ? Il ne pourra plus y revenir.`)) return;
        try { await api(`/api/rooms/${r.id}/kick/${u.id}`, { method: 'POST' }); toast(`🚪 ${u.username} exclu`); closeProfile(); } catch (e) { toast(e.message); }
      } }, '🚪 Exclure du salon')));
}

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
