// The Paradise — appels audio / vidéo en tête-à-tête (WebRTC)
const Call = {
  id: null,           // identifiant de l'appel en cours
  peer: null,         // l'autre personne
  video: false,       // appel vidéo ?
  role: null,         // 'caller' | 'callee'
  pc: null,
  local: null,        // notre flux (micro + caméra)
  remote: null,
  chain: Promise.resolve(),
  pending: [],
  muted: false,
  camOff: false,
  facing: 'user',
  startedAt: 0,
  incoming: null,     // { callId, from, video } quand ça sonne
  volume: loadNum('lc_call_vol', 1), // volume de l'autre personne (0 à 200 %)
  vol: null,
  ui: null,

  async getMedia(video) {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video ? { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  },

  // ----- Lancer un appel -----
  async start(user, video) {
    if (this.id || this.incoming) return toast('📞 Tu es déjà en appel');
    const toStaff = ['moderator', 'admin', 'superadmin'].includes(user.role);
    if (!toStaff && typeof mediaOk === 'function') {
      if (!mediaOk('voice')) return askVerify('voice');
      if (video && !mediaOk('cam')) return askVerify('cam');
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return toast('📞 Les appels nécessitent un navigateur récent et un site en https');
    try { this.local = await this.getMedia(video); }
    catch (e) { return toast(video ? '📹 Autorise la caméra et le micro pour passer un appel vidéo' : '🎤 Autorise le micro pour passer un appel'); }
    this.peer = user; this.video = video; this.role = 'caller'; this.muted = false; this.camOff = false;
    this.showScreen('calling');
    socket.emit('call_invite', { to: user.id, video }, res => {
      if (!res || res.error) { this.cleanup(); return toast('📞 ' + (res ? res.error : 'Appel impossible')); }
      this.id = res.callId;
      Ring.start('out');
    });
  },

  // ----- Répondre -----
  async accept(withVideo) {
    const inc = this.incoming;
    if (!inc) return;
    // Caméra pas encore validée : on répond en audio (sauf si c'est l'équipe qui appelle pour valider)
    if (withVideo && typeof mediaOk === 'function' && !mediaOk('cam') && !['moderator', 'admin', 'superadmin'].includes(inc.from?.role)) { withVideo = false; toast('📷 Caméra pas encore validée : tu réponds en audio'); }
    Ring.stop();
    try { this.local = await this.getMedia(withVideo); }
    catch (e) {
      try { this.local = await this.getMedia(false); withVideo = false; toast('📹 Caméra indisponible : appel en audio'); }
      catch (e2) { toast('🎤 Autorise le micro pour répondre'); return this.decline(); }
    }
    this.id = inc.callId; this.peer = inc.from; this.video = inc.video; this.role = 'callee';
    this.camOff = !withVideo; this.muted = false;
    this.incoming = null;
    closeRingModal();
    this.showScreen('connecting');
    await this.createPc();
    socket.emit('call_accept', this.id);
  },
  decline() {
    const inc = this.incoming;
    Ring.stop();
    closeRingModal();
    this.incoming = null;
    if (inc) socket.emit('call_decline', inc.callId);
  },
  hangup() {
    if (this.id) socket.emit('call_end', this.id);
    this.cleanup();
  },

  async createPc() {
    const ice = await (Voice.ice ? Promise.resolve(Voice.ice) : api('/api/ice').then(d => (Voice.ice = d.iceServers)).catch(() => [{ urls: 'stun:stun.l.google.com:19302' }]));
    const pc = new RTCPeerConnection({ iceServers: ice });
    this.pc = pc;
    this.remote = new MediaStream();
    this.local.getAudioTracks().forEach(t => pc.addTrack(t, this.local));
    // Canal vidéo toujours prévu (on peut allumer la caméra en cours d'appel)
    const vt = this.local.getVideoTracks()[0] || null;
    if (this.role === 'caller') this.videoSender = pc.addTransceiver(vt || 'video', { direction: 'sendrecv', streams: [this.local] }).sender;
    pc.ontrack = e => {
      this.remote.addTrack(e.track);
      if (e.track.kind === 'audio') {
        // Le son de l'autre passe par un amplificateur réglable
        this.vol?.close();
        this.volEl = this.volEl || new Audio();
        this.volEl.srcObject = new MediaStream([e.track]);
        this.volEl.play().catch(() => {});
        this.vol = volumeChain(this.volEl, new MediaStream([e.track]));
        if (!this.vol.gain) this.volEl.muted = false;
        this.vol.set(this.volume);
      }
      this.renderMedia();
    };
    pc.onicecandidate = e => { if (e.candidate) socket.emit('call_signal', { callId: this.id, data: { candidate: e.candidate } }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { if (!this.startedAt) this.startedAt = Date.now(); this.showScreen('live'); }
      if (pc.connectionState === 'failed') { toast('⚠️ Connexion impossible (réseau trop restrictif)'); this.hangup(); }
    };
  },

  async onAccepted() {
    Ring.stop();
    this.showScreen('connecting');
    await this.createPc();
    this.chain = this.chain.then(async () => {
      await this.pc.setLocalDescription(await this.pc.createOffer());
      socket.emit('call_signal', { callId: this.id, data: { sdp: this.pc.localDescription } });
    }).catch(e => console.warn('appel', e));
    this.sendMediaState();
  },

  onSignal(data) {
    if (!this.pc) return;
    this.chain = this.chain.then(async () => {
      if (data.sdp) {
        await this.pc.setRemoteDescription(data.sdp);
        for (const c of this.pending) await this.pc.addIceCandidate(c).catch(() => {});
        this.pending = [];
        if (data.sdp.type === 'offer') {
          const t = this.pc.getTransceivers().find(x => x.receiver.track && x.receiver.track.kind === 'video');
          if (t) {
            t.direction = 'sendrecv';
            this.videoSender = t.sender;
            const vt = this.local.getVideoTracks()[0];
            if (vt) await t.sender.replaceTrack(vt);
          }
          await this.pc.setLocalDescription(await this.pc.createAnswer());
          socket.emit('call_signal', { callId: this.id, data: { sdp: this.pc.localDescription } });
          this.sendMediaState();
        }
      } else if (data.candidate) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(data.candidate).catch(() => {});
        else this.pending.push(data.candidate);
      }
    }).catch(e => console.warn('appel', e));
  },

  sendMediaState() {
    if (this.id) socket.emit('call_media', { callId: this.id, video: !!this.local?.getVideoTracks()[0] && !this.camOff, muted: this.muted });
  },

  toggleMute() {
    this.muted = !this.muted;
    this.local?.getAudioTracks().forEach(t => { t.enabled = !this.muted; });
    this.sendMediaState();
    this.renderControls();
  },
  async toggleCam() {
    let vt = this.local?.getVideoTracks()[0];
    if (!vt) {
      // Allumer la caméra pendant un appel audio
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
        vt = st.getVideoTracks()[0];
        this.local.addTrack(vt);
        if (this.videoSender) await this.videoSender.replaceTrack(vt);
        this.camOff = false;
      } catch (e) { return toast('📷 Caméra indisponible'); }
    } else {
      this.camOff = !this.camOff;
      vt.enabled = !this.camOff;
    }
    this.sendMediaState();
    this.renderMedia();
  },
  async switchCam() {
    const old = this.local?.getVideoTracks()[0];
    if (!old) return;
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing } });
      const vt = st.getVideoTracks()[0];
      if (this.videoSender) await this.videoSender.replaceTrack(vt);
      this.local.removeTrack(old); old.stop();
      this.local.addTrack(vt);
      this.renderMedia();
    } catch (e) { toast('📷 Impossible de changer de caméra'); }
  },

  cleanup(reason) {
    Ring.stop();
    if (this.pc) { try { this.pc.close(); } catch (e) {} }
    if (this.local) this.local.getTracks().forEach(t => t.stop());
    this.vol?.close(); this.vol = null;
    if (this.volEl) { this.volEl.srcObject = null; this.volEl = null; }
    const dur = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    if (reason) toast(`📞 ${reason}${dur ? ' · ' + fmtDur(dur) : ''}`);
    Object.assign(this, { id: null, peer: null, pc: null, local: null, remote: null, chain: Promise.resolve(), pending: [], startedAt: 0, videoSender: null, remoteVideo: false, remoteMuted: false });
    if (this.ui) { this.ui.remove(); this.ui = null; }
    document.body.classList.remove('in-call');
  },

  // ----- Écran d'appel -----
  showScreen(phase) {
    this.phase = phase;
    if (!this.ui) {
      this.ui = el('div', { class: 'call-screen' });
      document.body.append(this.ui);
      document.body.classList.add('in-call');
    }
    const p = this.peer;
    this.ui.replaceChildren(
      el('video', { class: 'call-remote', autoplay: true, playsinline: true }),
      el('div', { class: 'call-avatar' }, LC.avatar(p, true), el('h2', {}, LC.name(p)),
        el('p', { class: 'call-status' }, phase === 'calling' ? `${this.video ? '📹 Appel vidéo' : '📞 Appel'} en cours… ça sonne` : phase === 'connecting' ? 'Connexion…' : '')),
      el('div', { class: 'call-top' }, el('span', { class: 'call-peer' }, p.username), el('span', { class: 'call-timer' }, '')),
      el('video', { class: 'call-local', autoplay: true, playsinline: true, muted: true }),
      el('div', { class: 'call-controls' }));
    this.renderMedia();
  },
  renderMedia() {
    if (!this.ui) return;
    const rv = this.ui.querySelector('.call-remote');
    const lv = this.ui.querySelector('.call-local');
    if (this.remote && rv.srcObject !== this.remote) { rv.srcObject = this.remote; rv.play().catch(() => {}); }
    rv.muted = true; // le son est joué à part, avec le réglage de volume
    const hasRemoteVideo = this.remoteVideo && this.remote?.getVideoTracks().length;
    this.ui.classList.toggle('remote-video', !!hasRemoteVideo);
    const myVideo = this.local?.getVideoTracks()[0];
    if (myVideo && !this.camOff) {
      if (lv.srcObject?.getVideoTracks()[0] !== myVideo) { lv.srcObject = new MediaStream([myVideo]); lv.muted = true; lv.play().catch(() => {}); }
      lv.classList.remove('hidden');
    } else lv.classList.add('hidden');
    const st = this.ui.querySelector('.call-status');
    if (this.phase === 'live') st.textContent = this.remoteMuted ? '🔇 Micro coupé' : (hasRemoteVideo ? '' : '🎧 En appel');
    this.renderControls();
  },
  setVolume(v) {
    this.volume = v;
    try { localStorage.setItem('lc_call_vol', String(v)); } catch (e) {}
    this.vol?.set(v);
  },
  renderControls() {
    if (!this.ui) return;
    const hasCam = !!this.local?.getVideoTracks()[0];
    let volBox = this.ui.querySelector('.call-volume');
    if (!volBox) {
      volBox = el('div', { class: 'call-volume' }, volumeSlider(this.volume, v => this.setVolume(v)));
      this.ui.append(volBox);
    }
    this.ui.querySelector('.call-controls').replaceChildren(...[
      el('button', { class: 'call-btn' + (this.muted ? ' off' : ''), title: 'Micro', onclick: () => this.toggleMute() }, this.muted ? '🔇' : '🎤'),
      el('button', { class: 'call-btn' + (!hasCam || this.camOff ? ' off' : ''), title: 'Caméra', onclick: () => this.toggleCam() }, '📷'),
      hasCam && !this.camOff ? el('button', { class: 'call-btn', title: 'Changer de caméra', onclick: () => this.switchCam() }, '🔄') : null,
      el('button', { class: 'call-btn hang', title: 'Raccrocher', onclick: () => this.hangup() }, '📞')].filter(Boolean));
  },
};
const fmtDur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
setInterval(() => {
  const t = Call.ui?.querySelector('.call-timer');
  if (t) t.textContent = Call.startedAt ? fmtDur(Math.round((Date.now() - Call.startedAt) / 1000)) : '';
}, 1000);

// ----- Sonnerie (générée, aucun fichier) -----
const Ring = {
  timer: null,
  start(kind) {
    this.stop();
    const play = () => {
      try {
        const ctx = Voice.audioCtx();
        const notes = kind === 'out' ? [[440, 0], [440, 0.5]] : [[660, 0], [880, 0.18], [660, 0.36], [880, 0.54]];
        for (const [f, t] of notes) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = f; o.type = 'sine';
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(kind === 'out' ? 0.05 : 0.15, ctx.currentTime + t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + (kind === 'out' ? 0.4 : 0.16));
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.45);
        }
      } catch (e) {}
      if (navigator.vibrate && kind === 'in') navigator.vibrate([300, 150, 300]);
    };
    play();
    this.timer = setInterval(play, kind === 'out' ? 3000 : 2000);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
};

// ----- Appel entrant -----
let ringModal = null;
function closeRingModal() { if (ringModal) { ringModal.remove(); ringModal = null; } }
socket.on('call_incoming', inc => {
  if (Call.id || Call.incoming) return socket.emit('call_decline', inc.callId);
  if (state.blocked.has(inc.from.id)) return socket.emit('call_decline', inc.callId);
  Call.incoming = inc;
  Ring.start('in');
  closeRingModal();
  ringModal = el('div', { class: 'modal-back ring-back' },
    el('div', { class: 'card modal ring-card' },
      el('div', { class: 'ring-avatar' }, LC.avatar(inc.from, true)),
      el('h3', {}, LC.name(inc.from)),
      el('p', {}, inc.video ? '📹 t\'appelle en visio…' : '📞 t\'appelle…'),
      el('div', { class: 'ring-actions' },
        el('button', { class: 'call-btn hang', title: 'Refuser', onclick: () => Call.decline() }, '📞'),
        inc.video ? el('button', { class: 'call-btn accept', title: 'Répondre en audio', onclick: () => Call.accept(false) }, '🎤') : null,
        el('button', { class: 'call-btn accept', title: inc.video ? 'Répondre en vidéo' : 'Répondre', onclick: () => Call.accept(inc.video) }, inc.video ? '📹' : '📞'))));
  document.body.append(ringModal);
  desktopNotify({ id: 'call' + inc.callId, title: `${inc.video ? '📹' : '📞'} ${inc.from.username} t'appelle`, text: 'Reviens sur le site pour répondre' });
});
socket.on('call_cancelled', ({ callId }) => {
  if (Call.incoming?.callId === callId) { Ring.stop(); closeRingModal(); Call.incoming = null; }
});
socket.on('call_accepted', ({ callId }) => { if (callId === Call.id) Call.onAccepted(); });
socket.on('call_signal', ({ callId, data }) => { if (callId === Call.id) Call.onSignal(data); });
socket.on('call_media', ({ callId, video, muted }) => {
  if (callId !== Call.id) return;
  Call.remoteVideo = video; Call.remoteMuted = muted;
  Call.renderMedia();
});
socket.on('call_ended', ({ callId, reason }) => {
  if (callId === Call.id) Call.cleanup(reason);
  if (Call.incoming?.callId === callId) { Ring.stop(); closeRingModal(); Call.incoming = null; }
});
socket.on('disconnect', () => { if (Call.id) Call.cleanup('Connexion perdue'); });
window.addEventListener('beforeunload', () => { if (Call.id) socket.emit('call_end', Call.id); });
