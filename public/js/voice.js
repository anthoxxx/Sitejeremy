// GajoxGaming — chat vocal dans les salons (WebRTC, connexions directes entre participants)
const Voice = {
  slug: null,          // salon dont on est dans le vocal
  stream: null,        // notre micro
  peers: new Map(),    // socketId -> { pc, audio, chain, pending }
  muted: false,
  deaf: false,
  ice: null,
  meters: new Map(),   // clé -> analyseur de volume (pour l'effet "parle")
  ctx: null,
  joining: false,

  async join() {
    if (this.joining || state.view?.type !== 'room') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection)
      return toast('🎤 Le vocal nécessite un navigateur récent et un site en https');
    this.joining = true;
    renderVoice();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      this.joining = false; renderVoice();
      return toast('🎤 Accès au micro refusé : autorise le micro dans ton navigateur');
    }
    if (!this.ice) {
      try { this.ice = (await api('/api/ice')).iceServers; } catch (e) { this.ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
    }
    const slug = state.view?.slug;
    socket.emit('voice_join', null, res => {
      this.joining = false;
      if (!res || res.error) { this.stopLocal(); renderVoice(); return toast(res ? res.error : 'Erreur vocal'); }
      this.slug = slug;
      this.muted = false;
      this.audioCtx();
      this.meter('me', this.stream);
      res.peers.forEach(p => this.createPeer(p.socketId, true));
      renderVoice();
    });
  },

  leave(notify = true) {
    if (notify && this.slug) socket.emit('voice_leave');
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.stopLocal();
    this.slug = null;
    this.joining = false;
    renderVoice();
  },

  stopLocal() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.unmeter('me');
  },

  createPeer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = this.deaf;
    const p = { pc, audio, chain: Promise.resolve(), pending: [] };
    this.peers.set(id, p);
    if (this.stream) this.stream.getTracks().forEach(t => pc.addTrack(t, this.stream));
    pc.onicecandidate = e => { if (e.candidate) socket.emit('voice_signal', { to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = e => {
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
      this.meter(id, e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') toast('⚠️ Connexion vocale impossible avec un participant (réseau trop restrictif)');
    };
    if (initiator) {
      p.chain = p.chain.then(async () => {
        await pc.setLocalDescription(await pc.createOffer());
        socket.emit('voice_signal', { to: id, data: { sdp: pc.localDescription } });
      }).catch(e => console.warn('vocal', e));
    }
    return p;
  },

  closePeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    p.audio.srcObject = null;
    this.peers.delete(id);
    this.unmeter(id);
  },

  signal(from, data) {
    if (!this.slug || !this.stream) return;
    const p = this.peers.get(from) || this.createPeer(from, false);
    p.chain = p.chain.then(async () => {
      if (data.sdp) {
        await p.pc.setRemoteDescription(data.sdp);
        for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
        p.pending = [];
        if (data.sdp.type === 'offer') {
          await p.pc.setLocalDescription(await p.pc.createAnswer());
          socket.emit('voice_signal', { to: from, data: { sdp: p.pc.localDescription } });
        }
      } else if (data.candidate) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate).catch(() => {});
        else p.pending.push(data.candidate);
      }
    }).catch(e => console.warn('vocal', e));
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.stream) this.stream.getAudioTracks().forEach(t => { t.enabled = !this.muted; });
    socket.emit('voice_mute', this.muted);
    renderVoice();
  },

  toggleDeaf() {
    this.deaf = !this.deaf;
    this.peers.forEach(p => { p.audio.muted = this.deaf; });
    renderVoice();
  },

  // ----- Détection de la parole -----
  audioCtx() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
    return this.ctx;
  },
  meter(key, stream) {
    const ctx = this.audioCtx();
    if (!ctx) return;
    this.unmeter(key);
    try {
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      this.meters.set(key, { src, an, data: new Uint8Array(an.frequencyBinCount) });
    } catch (e) {}
  },
  unmeter(key) {
    const m = this.meters.get(key);
    if (m) { try { m.src.disconnect(); } catch (e) {} this.meters.delete(key); }
  },
};

setInterval(() => {
  for (const [key, m] of Voice.meters) {
    m.an.getByteFrequencyData(m.data);
    let sum = 0;
    for (const v of m.data) sum += v;
    const speaking = sum / m.data.length > 14 && !(key === 'me' && Voice.muted);
    document.querySelectorAll(`[data-voice="${key}"]`).forEach(c => c.classList.toggle('speaking', speaking));
  }
}, 150);

// ----- Affichage -----
function renderVoice() {
  const r = state.currentRoom;
  const bar = $('voiceBar');
  const btn = $('headVoice');
  if (!r || state.view?.type !== 'room') { bar.classList.add('hidden'); return; }
  const parts = state.voice.get(r.slug) || [];
  const inThis = Voice.slug === r.slug;

  btn.className = 'btn btn-sm ' + (inThis ? 'btn-danger' : 'btn-primary') + (!state.voiceEnabled || !r.voiceEnabled ? ' hidden' : '');
  btn.textContent = Voice.joining ? '🎙️ Connexion…' : inThis ? '📞 Quitter le vocal' : `🎙️ Vocal${parts.length ? ' (' + parts.length + ')' : ''}`;
  btn.onclick = () => (inThis ? Voice.leave() : Voice.join());

  if (!parts.length && !inThis) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const manage = canManage(r);
  bar.replaceChildren(
    el('span', { class: 'voice-label' }, '🎙️ Vocal'),
    el('div', { class: 'voice-people' }, ...parts.map(p => {
      const mine = p.socketId === socket.id;
      return el('div', { class: 'voice-chip' + (p.muted ? ' muted' : ''), 'data-voice': mine ? 'me' : p.socketId, title: p.username },
        LC.avatar(p),
        el('span', {}, p.username), p.muted ? el('span', {}, '🔇') : null,
        manage && !mine && p.userId !== r.ownerId ? el('button', { class: 'voice-x', title: 'Retirer du vocal', onclick: () => socket.emit('voice_kick', p.socketId, res => res?.error && toast(res.error)) }, '✕') : null);
    })),
    inThis ? el('div', { class: 'voice-ctrl' },
      el('button', { class: 'btn btn-sm' + (Voice.muted ? ' btn-danger' : ''), title: 'Micro', onclick: () => Voice.toggleMute() }, Voice.muted ? '🔇 Micro coupé' : '🎤 Micro'),
      el('button', { class: 'btn btn-sm' + (Voice.deaf ? ' btn-danger' : ''), title: 'Son', onclick: () => Voice.toggleDeaf() }, Voice.deaf ? '🔈 Son coupé' : '🎧 Son'),
      el('button', { class: 'btn btn-sm btn-danger', onclick: () => Voice.leave() }, '📞'))
      : el('button', { class: 'btn btn-sm btn-primary', onclick: () => Voice.join() }, 'Rejoindre'));
}

// ----- Événements serveur -----
socket.on('voice_state', ({ slug, participants }) => {
  state.voice.set(slug, participants);
  if (Voice.slug === slug) {
    // nettoyer les connexions des personnes parties
    const ids = new Set(participants.map(p => p.socketId));
    for (const id of [...Voice.peers.keys()]) if (!ids.has(id)) Voice.closePeer(id);
  }
  renderVoice();
  renderRooms();
});
socket.on('voice_signal', ({ from, data }) => Voice.signal(from, data));
socket.on('voice_peer_left', ({ socketId }) => Voice.closePeer(socketId));
socket.on('voice_kicked', ({ reason }) => {
  Voice.leave(false);
  if (reason !== 'Tu as été retiré du vocal') toast('🎙️ ' + reason); // le retrait par le propriétaire arrive en notification
});
window.addEventListener('beforeunload', () => Voice.leave());
