// The Paradise — chat vocal dans les salons (WebRTC, connexions directes entre participants)
// ---------- Volume réglable de 0 à 200 % (au-delà de 100 % le son est amplifié) ----------
// Si le navigateur bloque l'amplificateur (iPhone, onglet pas encore touché…), le son passe
// directement par l'élément audio : on n'a jamais de silence, seulement pas d'amplification.
function volumeChain(audioEl, stream) {
  const chain = { gain: null, src: null, v: 1 };
  const ctx = Voice.audioCtx();
  if (ctx) {
    try {
      chain.src = ctx.createMediaStreamSource(stream);
      chain.gain = ctx.createGain();
      chain.src.connect(chain.gain).connect(ctx.destination);
    } catch (e) { chain.gain = null; }
  }
  chain.set = v => {
    chain.v = v;
    const amp = chain.gain && ctx && ctx.state === 'running';
    if (amp) { chain.gain.gain.value = v; audioEl.muted = true; }
    else {
      if (chain.gain) chain.gain.gain.value = 0;
      audioEl.muted = v === 0; audioEl.volume = Math.max(0, Math.min(1, v));
      audioEl.play().catch(() => Voice.needUnlock());
    }
  };
  chain.close = () => { try { chain.src?.disconnect(); chain.gain?.disconnect(); } catch (e) {} };
  return chain;
}
const loadNum = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
const pct = v => Math.round(v * 100) + ' %';

const Voice = {
  master: loadNum('lc_voice_vol', 1),   // volume général du vocal
  userVols: (() => { try { return JSON.parse(localStorage.getItem('lc_user_vol') || '{}'); } catch (e) { return {}; } })(), // volume par personne
  slug: null,          // salon dont on est dans le vocal
  stream: null,        // notre micro
  peers: new Map(),    // socketId -> { pc, audio, chain, pending }
  muted: false,
  deaf: false,
  ice: null,
  meters: new Map(),   // clé -> analyseur de volume (pour l'effet "parle")
  ctx: null,
  joining: false,
  cam: null,           // piste vidéo de notre caméra (null = caméra coupée)
  listening: false,    // on écoute seulement (sans micro)
  relayTo: new Set(),  // personnes à qui on envoie notre voix par le site (connexion directe impossible)
  relayProc: null,
  autoListen: (() => { try { return localStorage.getItem('lc_autolisten') === '1'; } catch (e) { return false; } })(),
  facing: 'user',      // caméra avant / arrière (téléphone)

  // listen = true : écouter le vocal sans micro
  async join(listen = false) {
    if (this.joining || state.view?.type !== 'room') return;
    if (!listen && state.view.slug !== 'douane' && !mediaOk('voice')) return askVerify('voice');
    this.unlock(); // tout de suite, pendant le clic : sinon le navigateur bloque le son
    if (!window.RTCPeerConnection || (!listen && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)))
      return toast('🎤 Le vocal nécessite un navigateur récent et un site en https');
    if (this.slug) this.leave();
    this.joining = true;
    renderVoice();
    if (!listen) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        this.joining = false; renderVoice();
        return toast('🎤 Accès au micro refusé : autorise le micro dans ton navigateur');
      }
    }
    if (!this.ice) {
      try { this.ice = (await api('/api/ice')).iceServers; } catch (e) { this.ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
    }
    const slug = state.view?.slug;
    socket.emit('voice_join', listen ? { listen: true } : null, res => {
      this.joining = false;
      if (!res || res.error) { this.stopLocal(); renderVoice(); return res?.needVoice ? askVerify('voice') : toast(res ? res.error : 'Erreur vocal'); }
      this.slug = slug;
      this.listening = listen;
      this.muted = listen;
      this.audioCtx();
      if (this.stream) this.meter('me', this.stream);
      res.peers.forEach(p => this.createPeer(p.socketId, true));
      renderVoice();
    });
  },

  leave(notify = true) {
    if (notify && this.slug) socket.emit('voice_leave');
    if (this.cam) { this.cam.stop(); this.cam = null; }
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.relayTo.clear();
    this.stopRelayCapture();
    this.stopLocal();
    this.slug = null;
    this.listening = false;
    this.joining = false;
    renderVoice();
  },
  setAutoListen(on) {
    this.autoListen = on;
    try { localStorage.setItem('lc_autolisten', on ? '1' : '0'); } catch (e) {}
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
    const p = { pc, audio, chain: Promise.resolve(), pending: [], videoSender: null, videoStream: null };
    this.peers.set(id, p);
    if (this.stream) this.stream.getTracks().forEach(t => pc.addTrack(t, this.stream));
    else if (initiator) pc.addTransceiver('audio', { direction: 'recvonly' }); // auditeur : on reçoit seulement
    // Un canal vidéo est toujours prévu : allumer la caméra n'a pas besoin de renégocier
    if (initiator) p.videoSender = pc.addTransceiver(this.cam || 'video', { direction: this.stream ? 'sendrecv' : 'recvonly' }).sender;
    pc.onicecandidate = e => { if (e.candidate) socket.emit('voice_signal', { to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = e => {
      if (e.track.kind === 'video') {
        p.videoStream = new MediaStream([e.track]);
        renderVideoGrid();
        return;
      }
      const stream = e.streams[0] || new MediaStream([e.track]);
      audio.srcObject = stream;
      audio.play().catch(() => this.needUnlock());
      p.vol?.close();
      p.vol = volumeChain(audio, stream);
      this.applyVolumes();
      this.meter(id, stream);
    };
    // Pas connecté au bout de 7 s : le son passera par le site
    p.relayTimer = setTimeout(() => { if (this.peers.get(id) === p && pc.connectionState !== 'connected') this.useRelay(id); }, 7000);
    pc.onconnectionstatechange = () => {
      p.state = pc.connectionState;
      if (pc.connectionState === 'connected') clearTimeout(p.relayTimer);
      renderVoice();
      if (pc.connectionState !== 'failed') return;
      // Nouvel essai de connexion (une fois), puis message clair
      if (initiator && !p.restarted) {
        p.restarted = true;
        p.chain = p.chain.then(async () => {
          pc.restartIce?.();
          await pc.setLocalDescription(await pc.createOffer({ iceRestart: true }));
          socket.emit('voice_signal', { to: id, data: { sdp: pc.localDescription } });
        }).catch(() => {});
        return;
      }
      this.useRelay(id);
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
    clearTimeout(p.relayTimer);
    try { p.relayGain?.disconnect(); } catch (e) {}
    this.relayTo.delete(id);
    p.vol?.close();
    p.audio.srcObject = null;
    this.peers.delete(id);
    this.unmeter(id);
  },

  signal(from, data) {
    if (!this.slug || (!this.stream && !this.listening)) return;
    const p = this.peers.get(from) || this.createPeer(from, false);
    p.chain = p.chain.then(async () => {
      if (data.sdp) {
        await p.pc.setRemoteDescription(data.sdp);
        for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
        p.pending = [];
        if (data.sdp.type === 'offer') {
          const t = p.pc.getTransceivers().find(x => x.receiver.track && x.receiver.track.kind === 'video');
          if (t && this.stream) { t.direction = 'sendrecv'; p.videoSender = t.sender; if (this.cam) await t.sender.replaceTrack(this.cam).catch(() => {}); }
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

  async toggleCam() {
    if (!this.cam && this.slug !== 'douane' && !mediaOk('cam')) return askVerify('cam');
    if (this.cam) {
      this.cam.stop();
      this.cam = null;
      this.peers.forEach(p => p.videoSender && p.videoSender.replaceTrack(null).catch(() => {}));
      socket.emit('voice_video', false);
      renderVoice(); renderVideoGrid();
      return;
    }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      this.cam = st.getVideoTracks()[0];
    } catch (e) { return toast('📷 Accès à la caméra refusé ou aucune caméra trouvée'); }
    this.peers.forEach(p => p.videoSender && p.videoSender.replaceTrack(this.cam).catch(() => {}));
    socket.emit('voice_video', true);
    renderVoice(); renderVideoGrid();
  },
  async switchCam() {
    if (!this.cam) return;
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      const old = this.cam;
      this.cam = st.getVideoTracks()[0];
      this.peers.forEach(p => p.videoSender && p.videoSender.replaceTrack(this.cam).catch(() => {}));
      old.stop();
      renderVideoGrid();
    } catch (e) { toast('📷 Impossible de changer de caméra'); }
  },

  toggleDeaf() {
    this.deaf = !this.deaf;
    this.applyVolumes();
    renderVoice();
  },
  // Applique : son coupé, sourdine personnelle, volume général × volume de la personne
  applyVolumes() {
    const parts = state.voice.get(this.slug) || [];
    for (const [id, p] of this.peers) {
      const who = parts.find(x => x.socketId === id);
      const silenced = this.deaf || (who && typeof isUserMuted === 'function' && isUserMuted(who.userId));
      const v = silenced ? 0 : this.master * (who ? this.userVols[who.userId] ?? 1 : 1);
      if (p.vol) p.vol.set(v); else p.audio.muted = v === 0;
      if (p.relayGain) p.relayGain.gain.value = v;
    }
  },
  setMaster(v) {
    this.master = v;
    try { localStorage.setItem('lc_voice_vol', String(v)); } catch (e) {}
    this.applyVolumes();
  },
  setUserVol(userId, v) {
    this.userVols[userId] = v;
    try { localStorage.setItem('lc_user_vol', JSON.stringify(this.userVols)); } catch (e) {}
    this.applyVolumes();
  },

  // ----- Son relayé par le site -----
  // Quand deux personnes n'arrivent pas à se connecter directement (4G, box…), la voix passe par
  // le serveur du site, par la même connexion que les messages du chat. Qualité téléphone, mais ça marche partout.
  useRelay(id) {
    const p = this.peers.get(id);
    if (!p || p.relay) return;
    p.relay = true;
    socket.emit('voice_relay_need', id);
    renderVoice();
  },
  onRelayPeer(peer) {
    let p = this.peers.get(peer);
    if (!p && this.slug) p = this.createPeer(peer, false);
    if (!p) return;
    p.relay = true;
    clearTimeout(p.relayTimer);
    if (this.stream) { this.relayTo.add(peer); this.startRelayCapture(); }
    renderVoice();
  },
  startRelayCapture() {
    if (this.relayProc || !this.stream) return;
    const ctx = this.audioCtx();
    if (!ctx) return;
    const src = ctx.createMediaStreamSource(this.stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const ratio = ctx.sampleRate / 16000;
    let loudAt = 0;
    proc.onaudioprocess = e => {
      e.outputBuffer.getChannelData(0).fill(0);
      if (this.muted || !this.relayTo.size) return;
      const input = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      if (Math.sqrt(sum / input.length) > 0.008) loudAt = Date.now();
      if (Date.now() - loudAt > 600) return; // silence : on n'envoie rien
      const n = Math.floor(input.length / ratio);
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = muEncode(input[Math.floor(i * ratio)]);
      // Seulement vers ceux qu'on n'arrive pas à joindre directement
      const to = [...this.relayTo].filter(id => this.peers.get(id)?.state !== 'connected');
      if (to.length) socket.emit('voice_relay_audio', { to, data: out.buffer });
    };
    src.connect(proc);
    proc.connect(ctx.destination);
    this.relayProc = { src, proc };
  },
  stopRelayCapture() {
    if (!this.relayProc) return;
    try { this.relayProc.src.disconnect(); this.relayProc.proc.disconnect(); } catch (e) {}
    this.relayProc = null;
  },
  playRelay(from, data) {
    const p = this.peers.get(from);
    const ctx = this.audioCtx();
    if (!p || !ctx || !this.slug) return;
    if (!p.relay) { p.relay = true; renderVoice(); }
    if (!p.relayGain) {
      p.relayGain = ctx.createGain();
      p.relayGain.connect(ctx.destination);
      const an = ctx.createAnalyser(); an.fftSize = 256; p.relayGain.connect(an);
      this.meters.set(from, { src: { disconnect: () => an.disconnect() }, an, data: new Uint8Array(an.frequencyBinCount) });
      p.relayAt = 0;
      this.applyVolumes();
    }
    if (p.state === 'connected') return; // la connexion directe marche : pas de double son
    if (ctx.state !== 'running') return this.needUnlock();
    const bytes = new Uint8Array(data);
    const buf = ctx.createBuffer(1, bytes.length, 16000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) ch[i] = muDecode(bytes[i]);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(p.relayGain);
    // Petite réserve de 150 ms pour absorber les à-coups du réseau
    const t = ctx.currentTime;
    if (p.relayAt < t + 0.03 || p.relayAt > t + 1) p.relayAt = t + 0.15;
    src.start(p.relayAt);
    p.relayAt += buf.duration;
  },

  // ----- Détection de la parole -----
  audioCtx() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.onstatechange = () => this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) {}
    return this.ctx;
  },
  // Débloque le son : à appeler pendant un clic ou un toucher de l'utilisateur
  unlock() {
    this.audioCtx();
    for (const [, p] of this.peers) if (p.audio.srcObject) p.audio.play().catch(() => {});
    if (this.locked) { this.locked = false; renderVoice(); }
  },
  needUnlock() {
    if (this.locked || !this.slug) return;
    this.locked = true;
    renderVoice();
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
  renderVoiceMini();
  if (!r || state.view?.type !== 'room') { bar.classList.add('hidden'); return; }
  const parts = state.voice.get(r.slug) || [];
  const speakers = parts.filter(p => !p.listener), listeners = parts.filter(p => p.listener);
  const inThis = Voice.slug === r.slug;
  const speaking = inThis && !Voice.listening;
  const listening = inThis && Voice.listening;

  btn.className = 'btn btn-sm ' + (speaking ? 'btn-danger' : 'btn-primary') + (!state.voiceEnabled || !r.voiceEnabled ? ' hidden' : '');
  btn.textContent = Voice.joining ? '🎙️ Connexion…' : speaking ? '📞 Quitter le vocal' : `🎙️ Vocal${speakers.length ? ' (' + speakers.length + ')' : ''}`;
  btn.onclick = () => (speaking ? Voice.leave() : Voice.join());

  if (!speakers.length && !inThis) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const manage = canManage(r);
  const listenInfo = listeners.length ? el('span', { class: 'voice-listeners', title: 'En écoute : ' + listeners.map(p => p.username).join(', ') }, `🎧 ${listeners.length} écoute${listeners.length > 1 ? 'nt' : ''}`) : null;
  let ctrl;
  if (speaking) {
    ctrl = el('div', { class: 'voice-ctrl' },
      el('button', { class: 'btn btn-sm' + (Voice.muted ? ' btn-danger' : ''), title: Voice.muted ? 'Rallumer le micro' : 'Couper le micro', onclick: () => Voice.toggleMute() }, Voice.muted ? '🔇' : '🎤', el('span', { class: 'lbl' }, Voice.muted ? ' Micro coupé' : ' Micro')),
      el('button', { class: 'btn btn-sm' + (Voice.cam ? ' btn-primary' : ''), title: Voice.cam ? 'Couper la caméra' : 'Allumer la caméra', onclick: () => Voice.toggleCam() }, '📷', el('span', { class: 'lbl' }, Voice.cam ? ' Caméra on' : ' Caméra')),
      Voice.cam ? el('button', { class: 'btn btn-sm', title: 'Changer de caméra', onclick: () => Voice.switchCam() }, '🔄') : null,
      el('button', { class: 'btn btn-sm' + (Voice.deaf ? ' btn-danger' : ''), title: 'Son', onclick: () => Voice.toggleDeaf() }, Voice.deaf ? '🔈' : '🎧', el('span', { class: 'lbl' }, Voice.deaf ? ' Son coupé' : ' Son')),
      el('button', { class: 'btn btn-sm', title: 'Régler le volume', onclick: () => openVoiceVolume() }, '🔊', el('span', { class: 'lbl' }, ' ' + pct(Voice.master))),
      el('button', { class: 'btn btn-sm btn-danger', onclick: () => Voice.leave() }, '📞'));
  } else if (listening) {
    ctrl = el('div', { class: 'voice-ctrl' },
      el('span', { class: 'voice-listening' }, '🎧 Tu écoutes'),
      el('button', { class: 'btn btn-sm', title: 'Régler le volume', onclick: () => openVoiceVolume() }, '🔊', el('span', { class: 'lbl' }, ' ' + pct(Voice.master))),
      el('button', { class: 'btn btn-sm btn-primary', title: 'Prendre la parole (avec ton micro)', onclick: () => Voice.join() }, '🎙️', el('span', { class: 'lbl' }, ' Parler')),
      el('button', { class: 'btn btn-sm' + (Voice.autoListen ? ' btn-ok' : ''), title: 'Écouter tout seul le vocal quand j\'arrive dans un salon', onclick: () => Voice.setAutoListen(!Voice.autoListen) }, Voice.autoListen ? '🔁 Auto ✓' : '🔁 Auto'),
      el('button', { class: 'btn btn-sm btn-danger', title: 'Arrêter d\'écouter', onclick: () => Voice.leave() }, '⏹'));
  } else {
    ctrl = el('div', { class: 'voice-ctrl' },
      el('button', { class: 'btn btn-sm', title: 'Entendre le vocal sans y aller (sans micro)', onclick: () => Voice.join(true) }, '🎧 Écouter'),
      el('button', { class: 'btn btn-sm btn-primary', onclick: () => Voice.join() }, 'Rejoindre'));
  }
  const unlockBtn = inThis && Voice.locked ? el('button', { class: 'btn btn-sm btn-primary voice-unlock', onclick: () => Voice.unlock() }, '🔊 Touche ici pour activer le son') : null;
  bar.replaceChildren(
    unlockBtn,
    el('span', { class: 'voice-label' }, '🎙️ Vocal'),
    el('div', { class: 'voice-people' }, ...speakers.map(p => {
      const mine = p.socketId === socket.id;
      return el('div', { class: 'voice-chip' + (p.muted ? ' muted' : ''), 'data-voice': mine ? 'me' : p.socketId, title: p.username },
        LC.avatar(p),
        el('span', { class: 'vname' }, p.username), p.video ? el('span', {}, '📷') : null, p.muted ? el('span', {}, '🔇') : null,
        !mine && inThis ? connBadge(Voice.peers.get(p.socketId)) : null,
        manage && !mine && p.userId !== r.ownerId ? el('button', { class: 'voice-x', title: 'Retirer du vocal', onclick: () => socket.emit('voice_kick', p.socketId, res => res?.error && toast(res.error)) }, '✕') : null);
    }), listenInfo),
    ctrl);
}
// Petite barre « tu es en vocal ailleurs » : le vocal reste connecté quand on change de salon ou qu'on ouvre un message privé
function renderVoiceMini() {
  const mini = $('voiceMini');
  if (!mini) return;
  const here = state.view?.type === 'room' && state.view.slug === Voice.slug;
  if (!Voice.slug || here) { mini.classList.add('hidden'); return; }
  const room = state.rooms.find(x => x.slug === Voice.slug);
  const n = (state.voice.get(Voice.slug) || []).filter(p => !p.listener).length;
  mini.classList.remove('hidden');
  mini.replaceChildren(
    el('span', { class: 'vm-dot' }),
    el('button', { class: 'vm-where', title: 'Revenir au salon du vocal', onclick: () => joinRoom(Voice.slug) },
      Voice.listening ? '🎧 Tu écoutes : ' : '🔊 En vocal : ', el('b', {}, room ? room.name : 'un salon'), el('small', {}, ` · ${n} en vocal`)),
    Voice.listening ? null : el('button', { class: 'btn btn-sm' + (Voice.muted ? ' btn-danger' : ''), title: Voice.muted ? 'Rallumer le micro' : 'Couper le micro', onclick: () => Voice.toggleMute() }, Voice.muted ? '🔇' : '🎤'),
    el('button', { class: 'btn btn-sm', title: 'Revenir au salon', onclick: () => joinRoom(Voice.slug) }, '↩'),
    el('button', { class: 'btn btn-sm btn-danger', title: 'Quitter le vocal', onclick: () => Voice.leave() }, '📞'));
}
// Pendant un vocal ou un appel, les liens vers d'autres pages (Admin, Histoire…) s'ouvrent dans un nouvel onglet pour ne pas couper
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || e.defaultPrevented) return;
  const busy = Voice.slug || (typeof Call !== 'undefined' && Call.id);
  if (!busy) return;
  let url;
  try { url = new URL(a.href, location.href); } catch (err) { return; }
  if (url.origin !== location.origin || url.pathname === location.pathname) return;
  e.preventDefault();
  window.open(url.href, '_blank');
  toast('🎙️ Ouvert dans un nouvel onglet pour ne pas couper ton vocal');
});
// Petit indicateur de connexion avec chaque personne du vocal
function connBadge(peer) {
  const st = peer?.state;
  if (peer?.relay && st !== 'connected') return el('span', { class: 'conn-relay', title: 'Son relayé par le site (connexion directe impossible) : la caméra ne passe pas' }, '📡');
  if (!peer || st === 'connected') return null;
  if (st === 'failed') return el('span', { class: 'conn-bad', title: 'Connexion impossible avec cette personne (réseau)' }, '⚠️');
  return el('span', { class: 'conn-wait', title: 'Connexion en cours…' }, '⏳');
}
// Écoute automatique : en arrivant dans un salon où ça parle, on écoute tout seul
function maybeAutoListen() {
  const r = state.currentRoom;
  if (!Voice.autoListen || Voice.slug || Voice.joining || !r || state.view?.type !== 'room' || state.view.slug !== r.slug) return;
  if (!state.voiceEnabled || !r.voiceEnabled) return;
  if ((state.voice.get(r.slug) || []).some(p => !p.listener)) Voice.join(true);
}
document.addEventListener('viewchange', () => setTimeout(maybeAutoListen, 300));

// Compression « µ-law » : 8 bits par échantillon, comme le téléphone
function muEncode(x) {
  const s = Math.max(-1, Math.min(1, x)) * 32767;
  const sign = s < 0 ? 0x80 : 0;
  let v = Math.min(Math.abs(s) + 132, 32635), exp = 7;
  for (let m = 0x4000; (v & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((v >> (exp + 3)) & 0x0f)) & 0xff;
}
function muDecode(b) {
  b = ~b & 0xff;
  const sign = b & 0x80, exp = (b >> 4) & 7, mant = b & 0x0f;
  const v = (((mant << 3) + 132) << exp) - 132;
  return (sign ? -v : v) / 32768;
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
  renderVideoGrid();
  renderRooms();
  if (Voice.slug === slug) Voice.applyVolumes();
  maybeAutoListen();
  // Plus personne ne parle : l'auditeur arrête d'écouter
  if (Voice.slug === slug && Voice.listening && !participants.some(p => !p.listener)) Voice.leave();
  if (typeof afterMuteChange === 'function' && Voice.slug === slug) setTimeout(afterMuteChange, 500);
});
socket.on('voice_signal', ({ from, data }) => Voice.signal(from, data));
// Le serveur refuse la caméra (badge 📷 manquant) : on l'éteint
socket.on('voice_cam_refused', ({ error }) => { if (Voice.cam) { Voice.cam.stop(); Voice.cam = null; Voice.peers.forEach(p => p.videoSender && p.videoSender.replaceTrack(null).catch(() => {})); renderVoice(); renderVideoGrid(); } toast(error); });
socket.on('voice_relay_peer', ({ peer }) => Voice.onRelayPeer(peer));
socket.on('voice_relay_audio', ({ from, data }) => Voice.playRelay(from, data));
socket.on('voice_peer_left', ({ socketId }) => Voice.closePeer(socketId));
socket.on('voice_kicked', ({ reason }) => {
  Voice.leave(false);
  if (reason !== 'Tu as été retiré du vocal') toast('🎙️ ' + reason); // le retrait par le propriétaire arrive en notification
});
window.addEventListener('beforeunload', () => Voice.leave());
// Le moindre toucher ou clic débloque le son s'il était bloqué
['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, () => { if (Voice.slug && (Voice.locked || Voice.ctx?.state === 'suspended')) Voice.unlock(); }, { passive: true }));

// ----- Mosaïque vidéo du salon -----
const videoEls = new Map(); // clé -> élément <div class="vtile">
function renderVideoGrid() {
  const grid = $('videoGrid');
  const r = state.currentRoom;
  const inThis = r && state.view?.type === 'room' && Voice.slug === r.slug;
  const parts = inThis ? (state.voice.get(r.slug) || []).filter(p => p.video) : [];
  const tiles = [];
  for (const p of parts) {
    const mine = p.socketId === socket.id;
    const stream = mine ? (Voice.cam ? new MediaStream([Voice.cam]) : null) : Voice.peers.get(p.socketId)?.videoStream;
    if (!stream) continue;
    const key = mine ? 'me' : p.socketId;
    let tile = videoEls.get(key);
    if (!tile) {
      const v = el('video', { autoplay: true, playsinline: true, muted: true });
      v.muted = true;
      tile = el('div', { class: 'vtile' + (mine ? ' mine' : ''), onclick: () => tile.classList.toggle('big') }, v, el('span', { class: 'vtile-name' }));
      videoEls.set(key, tile);
    }
    const v = tile.querySelector('video');
    const track = stream.getVideoTracks()[0];
    if (!v.srcObject || v.srcObject.getVideoTracks()[0] !== track) { v.srcObject = stream; v.play().catch(() => {}); }
    tile.querySelector('.vtile-name').textContent = mine ? 'Toi' : p.username;
    tiles.push([key, tile]);
  }
  for (const k of [...videoEls.keys()]) if (!tiles.some(([key]) => key === k)) videoEls.delete(k);
  grid.replaceChildren(...tiles.map(([, t]) => t));
  grid.classList.toggle('hidden', !tiles.length);
  grid.dataset.count = Math.min(tiles.length, 4);
}

// Curseur de volume réutilisable (0 à 200 %)
function volumeSlider(value, onChange) {
  const label = el('b', { class: 'vol-val' }, pct(value));
  const range = el('input', { type: 'range', min: 0, max: 2, step: 0.05, value, class: 'vol-range' });
  range.oninput = () => { const v = parseFloat(range.value); label.textContent = pct(v); onChange(v); };
  return el('div', { class: 'vol-row' }, el('span', {}, '🔈'), range, el('span', {}, '🔊'), label);
}
// Fenêtre : volume général du vocal + volume de chaque personne
function openVoiceVolume() {
  const parts = (state.voice.get(Voice.slug) || []).filter(p => p.socketId !== socket.id && !p.listener);
  const close = modal(
    el('h3', {}, '🔊 Volume du vocal'),
    el('div', { class: 'field' }, el('label', {}, 'Volume général'), volumeSlider(Voice.master, v => { Voice.setMaster(v); renderVoice(); })),
    parts.length ? el('div', { class: 'field' }, el('label', {}, 'Volume de chaque personne'),
      ...parts.map(p => el('div', { class: 'vol-person' }, el('div', { class: 'vol-who' }, LC.avatar(p), el('span', {}, p.username)),
        volumeSlider(Voice.userVols[p.userId] ?? 1, v => Voice.setUserVol(p.userId, v)))))
      : el('p', { class: 'help' }, 'Personne d\'autre dans le vocal pour le moment.'),
    el('p', { class: 'help' }, 'Au-dessus de 100 %, le son est amplifié. Ces réglages sont gardés sur cet appareil.'),
    el('button', { class: 'btn btn-ghost', style: 'width:100%', onclick: () => close() }, 'Fermer'));
}

// ----- Validation de la voix 🎙️ et de la caméra 📷 par l'équipe -----
function mediaOk(kind) {
  if (!state.customs?.media || isStaff()) return true;
  return kind === 'voice' ? !!state.me?.voiceOk : !!state.me?.camOk;
}
function askVerify(kind) {
  const voice = kind === 'voice';
  const close = modal(
    el('h3', {}, voice ? '🎙️ Ta voix n\'est pas encore validée' : '📷 Ta caméra n\'est pas encore validée'),
    el('p', { class: 'help', style: 'margin:-4px 0 12px' }, voice
      ? 'Pour parler dans le vocal et passer des appels, l\'équipe doit d\'abord valider ta voix. En attendant, tu peux écouter le vocal 🎧.'
      : 'Pour allumer ta caméra dans le vocal et en appel vidéo, l\'équipe doit d\'abord valider ta caméra.'),
    el('div', { class: 'verify-steps' },
      el('div', {}, '1️⃣ Va dans le salon ', el('b', {}, 'Vérification'), ' : là-bas, le micro et la caméra marchent pour tout le monde.'),
      el('div', {}, '2️⃣ Rejoins le vocal avec ton micro', voice ? '' : ' et ta caméra', '.'),
      el('div', {}, '3️⃣ Un membre de l\'équipe te valide : tu reçois le badge ', voice ? '🎙️' : '📷', '.')),
    el('div', { class: 'actions', style: 'margin-top:14px' },
      el('button', { class: 'btn btn-primary', onclick: () => { close(); joinRoom('douane'); } }, '🛂 Aller à la Vérification'),
      el('button', { class: 'btn', onclick: async () => {
        try { const r = await api('/api/verify/request', { method: 'POST' }); toast(r.already ? '✅ Tu as déjà tes badges' : r.staffOnline ? `📣 Demande envoyée à ${r.staffOnline} membre(s) de l'équipe en ligne` : '📣 Demande envoyée : l\'équipe te répondra dès qu\'elle sera connectée'); }
        catch (e) { toast(e.message); }
      } }, '📣 Prévenir l\'équipe'),
      voice && state.view?.type === 'room' && state.view.slug !== 'douane' ? el('button', { class: 'btn', onclick: () => { close(); Voice.join(true); } }, '🎧 Écouter seulement') : null),
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:8px', onclick: () => close() }, 'Fermer'));
}
