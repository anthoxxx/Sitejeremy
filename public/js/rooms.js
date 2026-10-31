// GajoxGaming — salons créés par les membres : création, gestion, invitations, exclusions
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
  const name = el('input', { class: 'input', maxlength: 30, placeholder: 'Ex : La team Gajox' });
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
    room.ownerId ? field('Icône', icon.box) : null,
    room.ownerId ? field('Nom', name) : null,
    room.ownerId ? field('Description', desc) : null,
    field('📻 Radio du salon (tout le monde peut l\'écouter)', radio),
    toggleRow('🔒 Salon fermé', 'Seules les personnes invitées peuvent entrer. Les autres sont sortis immédiatement.', priv),
    toggleRow('🎙️ Chat vocal', 'Autoriser le vocal dans ce salon', voiceOn),
    err,
    el('button', { class: 'btn btn-primary', style: 'width:100%;margin:10px 0 4px', onclick: async () => {
      err.textContent = '';
      try {
        const body = { stationId: radio.value ? parseInt(radio.value, 10) : null, isPrivate: priv.checked, voiceEnabled: voiceOn.checked };
        if (room.ownerId) Object.assign(body, { name: name.value, description: desc.value, icon: icon.get() });
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
    room.ownerId ? el('div', { class: 'staff-actions' },
      el('button', { class: 'btn btn-danger', style: 'width:100%', onclick: async () => {
        if (!confirm(`Supprimer définitivement le salon « ${room.name} » ?`)) return;
        try { await api('/api/rooms/' + room.id, { method: 'DELETE' }); close(); toast('🗑 Salon supprimé'); } catch (e) { toast(e.message); }
      } }, '🗑 Supprimer le salon')) : null,
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Fermer'));
  loadPeople();
}

// Boutons ajoutés dans la fiche profil quand on gère le salon actuel
function roomActions(u, closeProfile) {
  const r = state.currentRoom;
  if (state.view?.type !== 'room' || !canManage(r) || u.id === r.ownerId || u.id === state.me.id) return null;
  return el('div', { class: 'staff-actions' },
    el('h4', {}, `Mon salon « ${r.name} »`),
    el('div', { class: 'actions' },
      r.isPrivate ? el('button', { class: 'btn btn-sm', onclick: async () => {
        try { await api(`/api/rooms/${r.id}/members`, { method: 'POST', body: { userId: u.id } }); toast(`🎟️ ${u.username} invité`); } catch (e) { toast(e.message); }
      } }, '🎟️ Inviter') : null,
      el('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
        if (!confirm(`Exclure ${u.username} du salon ? Il ne pourra plus y revenir.`)) return;
        try { await api(`/api/rooms/${r.id}/kick/${u.id}`, { method: 'POST' }); toast(`🚪 ${u.username} exclu`); closeProfile(); } catch (e) { toast(e.message); }
      } }, '🚪 Exclure du salon')));
}
