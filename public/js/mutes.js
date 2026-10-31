// The Paradise — mettre quelqu'un en sourdine pour soi seul, pendant un temps choisi (en secondes)
state.mutes = new Map(); // userId -> fin (timestamp)
const isUserMuted = id => (state.mutes.get(id) || 0) > Date.now();
const muteLeftText = id => {
  const s = Math.max(0, Math.ceil(((state.mutes.get(id) || 0) - Date.now()) / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)} j ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${s} s`;
};

async function loadMutes() {
  try {
    const { mutes } = await api('/api/mutes');
    state.mutes = new Map(mutes.map(m => [m.userId, m.until]));
    afterMuteChange();
  } catch (e) {}
}
async function muteUser(u, seconds) {
  try {
    const r = await api('/api/mutes/' + u.id, { method: 'POST', body: { seconds } });
    state.mutes.set(u.id, r.until);
    toast(`🔇 ${u.username} est en sourdine pour toi pendant ${muteLeftText(u.id)}`);
    afterMuteChange();
  } catch (e) { toast(e.message); }
}
async function unmuteUser(u) {
  try { await api('/api/mutes/' + u.id, { method: 'DELETE' }); } catch (e) {}
  state.mutes.delete(u.id);
  toast(`🔊 Tu entends de nouveau ${u.username}`);
  afterMuteChange();
}
function afterMuteChange() {
  renderUsers();
  // Couper aussi sa voix dans le vocal
  const parts = state.voice.get(Voice.slug) || [];
  for (const p of parts) { const peer = Voice.peers.get(p.socketId); if (peer) peer.audio.muted = Voice.deaf || isUserMuted(p.userId); }
}

// Fenêtre « mettre en sourdine » avec choix de la durée
function openMutePicker(u, after) {
  const presets = [[30, '30 s'], [60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, '1 h'], [86400, '24 h']];
  const num = el('input', { class: 'input', type: 'number', min: 1, value: 90, style: 'max-width:110px' });
  const unit = el('select', { class: 'input', style: 'max-width:140px' }, el('option', { value: 1 }, 'secondes'), el('option', { value: 60 }, 'minutes'), el('option', { value: 3600 }, 'heures'));
  const close = modal(
    el('h3', {}, `🔇 Mettre ${u.username} en sourdine`),
    el('p', { class: 'help', style: 'margin-top:-6px' }, 'Pour toi seulement : tu ne verras plus ses messages, et il ne pourra plus t\'écrire en privé, t\'appeler ni te défier pendant ce temps. Il n\'est pas prévenu.'),
    el('div', { class: 'choice-row', style: 'margin:12px 0' }, ...presets.map(([s, l]) => el('button', { class: 'choice', onclick: () => { close(); muteUser(u, s); after && after(); } }, l))),
    el('div', { class: 'field' }, el('label', {}, '⏱️ Durée personnalisée'),
      el('div', { class: 'row', style: 'gap:8px;align-items:center' }, num, unit,
        el('button', { class: 'btn btn-primary', style: 'flex:none', onclick: () => {
          const s = Math.round((parseFloat(num.value) || 0) * parseInt(unit.value, 10));
          if (s < 1) return toast('Durée invalide');
          close(); muteUser(u, s); after && after();
        } }, 'OK'))),
    el('button', { class: 'btn btn-ghost', style: 'width:100%', onclick: () => close() }, 'Annuler'));
}

// Compte à rebours en direct + fin automatique
setInterval(() => {
  const now = Date.now();
  for (const [id, until] of [...state.mutes]) {
    if (until <= now) {
      state.mutes.delete(id);
      const u = state.online.find(x => x.id === id);
      toast(`🔊 Fin de la sourdine${u ? ' pour ' + u.username : ''}`);
      afterMuteChange();
    }
  }
  document.querySelectorAll('[data-mute-left]').forEach(e => { e.textContent = isUserMuted(+e.dataset.muteLeft) ? '🔇 ' + muteLeftText(+e.dataset.muteLeft) : ''; });
}, 1000);
