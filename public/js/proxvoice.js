// The Paradise — 🎙️ Le vocal de proximité (côté écran) : dans la Ville, les maisons et le Paradise Club.
// On entend les gens près de soi : de plus en plus fort quand on s'approche, de plus en plus bas quand on s'éloigne,
// et le son vient de leur côté (gauche / droite), comme en vrai. Les connexions se font toutes seules selon la distance.
const ProxVoice = (() => {
  // distances en mètres ; « unit » = combien d'unités du jeu font 1 mètre
  const CFG = { island: { unit: 24, full: 3, silent: 20, conn: 22, drop: 28 }, casino: { unit: 1, full: 2, silent: 14, conn: 15, drop: 19 } };
  const providers = {}, members = new Map(), peers = new Map(), btns = new Set();
  let retryAt = 0, on = false, space = null, sid = null, stream = null, ice = null, muted = false, talk = true, timer = 0, myMeter = null, starting = false;
  const ack = (ev, ...a) => new Promise(res => socket.emit(ev, ...a, res));
  const VO = () => (typeof Voice !== 'undefined' ? Voice : null); // « Voice » n'est pas sur window
  const ctx = () => (VO()?.audioCtx ? VO().audioCtx() : null);
  const cur = () => (providers.casino ? ['casino', providers.casino] : providers.island ? ['island', providers.island] : [null, null]);

  // l'endroit où l'on est (la Ville, une maison, le club) se présente ici
  function use(key, prov) { if (prov) providers[key] = prov; else delete providers[key]; if (on) { if (!cur()[1]) stop(true); else resync(); } render(); }

  async function start() {
    if (on || starting) return; const [, P] = cur(); if (!P) return toast('🎙️ Entre dans la Ville ou le Paradise Club pour parler aux gens autour de toi');
    if (VO()?.slug) return toast('🎙️ Quitte d\'abord le vocal du salon');
    if (!window.RTCPeerConnection) return toast('🎙️ Le vocal nécessite un navigateur récent');
    starting = true; render();
    try { VO()?.unlock?.(); } catch (e) {}
    try { if (!ice) ice = (await api('/api/ice')).iceServers; } catch (e) { ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
    talk = typeof mediaOk === 'function' ? mediaOk('voice') : true;
    if (talk) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); myMeter = meter(stream); }
      catch (e) { talk = false; toast('🎤 Micro refusé ou introuvable : tu écoutes seulement 🎧'); }
    } else toast('🎧 Tu écoutes seulement : ta voix doit d\'abord être validée par l\'équipe pour parler');
    starting = false; on = true; muted = false; space = null;
    await resync(); clearInterval(timer); timer = setInterval(tick, 200); render();
    if (talk) toast('🎙️ Vocal de proximité activé : approche-toi des gens pour leur parler !');
  }
  function stop(quiet) {
    if (!on && !starting) return; on = false; clearInterval(timer);
    for (const k of [...peers.keys()]) closePeer(k, true);
    if (space) socket.emit('pv_leave'); space = null; members.clear();
    stream?.getTracks().forEach(t => t.stop()); stream = null; myMeter = null; render();
    if (!quiet) toast('🔇 Vocal de proximité coupé');
  }
  function toggleMute() { if (!on || !stream) return; muted = !muted; stream.getAudioTracks().forEach(t => { t.enabled = !muted; }); socket.emit('pv_mute', muted); render(); }
  async function resync() {
    const [key, P] = cur(), sp = P?.space?.() || null; if (sp === space || Date.now() < retryAt) return;
    for (const k of [...peers.keys()]) closePeer(k, true); members.clear();
    if (space) socket.emit('pv_leave'); space = sp; if (!sp) return;
    const r = await ack('pv_join', sp); if (space !== sp) return;
    if (!r || r.error) { space = null; retryAt = Date.now() + 3000; return; } sid = r.sid; for (const m of r.peers) members.set(m.sid, m); void key;
  }

  // ---------- la distance règle tout ----------
  function tick() {
    if (!on) return; const [key, P] = cur(); if (!P) return stop(true);
    if ((P.space?.() || null) !== space) { resync(); return; }
    const C = CFG[key], me = P.me(); if (!me) return; const yaw = P.yaw ? P.yaw() : null, A = ctx();
    for (const [s, m] of members) {
      const p = P.pos(m.uid), d = p ? Math.hypot(p.x - me.x, p.z - me.z) / C.unit : Infinity, peer = peers.get(s);
      if (!peer && d < C.conn && sid < s) connect(s, true);
      if (peer && d > C.drop) { closePeer(s, true); continue; }
      if (!peer || !peer.audio) continue;
      const v = d <= C.full ? 1 : Math.max(0, Math.pow(1 - (d - C.full) / (C.silent - C.full), 1.6));
      let pan = 0; if (p && d > .3) { const dx = p.x - me.x, dz = p.z - me.z, L = Math.hypot(dx, dz); pan = yaw == null ? dx / L : (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / L; pan = Math.max(-.85, Math.min(.85, pan)) * Math.min(1, d / 4); }
      peer.vol = v;
      if (A && A.state === 'running' && peer.gain) { peer.gain.gain.setTargetAtTime(v, A.currentTime, .12); peer.pan?.pan.setTargetAtTime(pan, A.currentTime, .12); peer.audio.muted = true; }
      else { peer.audio.muted = v === 0; peer.audio.volume = Math.min(1, v); peer.audio.play().catch(() => {}); }
    }
    render(true);
  }
  // ---------- les connexions (WebRTC) ----------
  function makePc(s) {
    const pc = new RTCPeerConnection({ iceServers: ice || [] }), peer = { pc, audio: null, gain: null, pan: null, meter: null, vol: 0 };
    peers.set(s, peer);
    pc.onicecandidate = e => { if (e.candidate) socket.emit('pv_signal', { to: s, data: { ice: e.candidate } }); };
    pc.ontrack = e => {
      if (peer.audio) return; const st = e.streams[0] || new MediaStream([e.track]);
      const a = new Audio(); a.autoplay = true; a.playsInline = true; a.srcObject = st; a.muted = true; a.play().catch(() => {}); peer.audio = a;
      const A = ctx(); if (A) { try { const src = A.createMediaStreamSource(st), g = A.createGain(), pn = A.createStereoPanner ? A.createStereoPanner() : null; g.gain.value = 0; src.connect(g); if (pn) g.connect(pn).connect(A.destination); else g.connect(A.destination); peer.gain = g; peer.pan = pn; peer.src = src; } catch (err) { peer.gain = null; } }
      peer.meter = meter(st);
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closePeer(s, false); };
    return peer;
  }
  async function connect(s, initiator) {
    const peer = makePc(s), pc = peer.pc;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream)); else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (!initiator) return peer;
    try { const o = await pc.createOffer(); await pc.setLocalDescription(o); socket.emit('pv_signal', { to: s, data: { offer: pc.localDescription } }); } catch (e) { closePeer(s, true); }
    return peer;
  }
  function closePeer(s, tell) {
    const p = peers.get(s); if (!p) return; peers.delete(s);
    try { p.src?.disconnect(); p.gain?.disconnect(); p.pan?.disconnect(); } catch (e) {}
    try { p.audio && (p.audio.srcObject = null); p.pc.close(); } catch (e) {}
    if (tell) socket.emit('pv_signal', { to: s, data: { bye: 1 } });
  }
  socket.on('pv_signal', async ({ from, data }) => {
    if (!on || !data) return;
    try {
      if (data.bye) return closePeer(from, false);
      if (data.offer) {
        if (peers.has(from)) closePeer(from, false);
        const peer = makePc(from), pc = peer.pc;
        await pc.setRemoteDescription(data.offer);
        if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
        const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        socket.emit('pv_signal', { to: from, data: { answer: pc.localDescription } });
      } else if (data.answer) { await peers.get(from)?.pc.setRemoteDescription(data.answer); }
      else if (data.ice) { await peers.get(from)?.pc.addIceCandidate(data.ice).catch(() => {}); }
    } catch (e) { console.warn('pv', e); }
  });
  socket.on('pv_peer', m => { if (on) members.set(m.sid, m); });
  socket.on('pv_gone', ({ sid: s }) => { members.delete(s); closePeer(s, false); });
  socket.on('pv_mute', ({ sid: s, muted: m }) => { const x = members.get(s); if (x) x.muted = m; });
  socket.on('pv_kicked', () => { if (!on) return; for (const k of [...peers.keys()]) closePeer(k, false); members.clear(); space = null; });
  socket.on('connect', () => { if (on) { for (const k of [...peers.keys()]) closePeer(k, false); members.clear(); space = null; resync(); } });

  // ---------- qui parle ? (pour allumer les noms) ----------
  function meter(st) {
    const A = ctx(); if (!A) return null;
    try { const an = A.createAnalyser(); an.fftSize = 512; A.createMediaStreamSource(st).connect(an); const buf = new Uint8Array(an.fftSize); return () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) * (v - 128); return Math.sqrt(s / buf.length); }; } catch (e) { return null; }
  }
  function speaking(uid) {
    if (!on) return false;
    if (uid === state.me?.id) return !!(myMeter && !muted && myMeter() > 6);
    for (const [s, p] of peers) { const m = members.get(s); if (m && m.uid === uid) return !!(p.meter && p.vol > .02 && p.meter() > 5); }
    return false;
  }
  const heard = () => [...peers.entries()].filter(([, p]) => p.vol > .02).map(([s]) => members.get(s)).filter(Boolean);

  // ---------- le bouton ----------
  function button(extraClass = '') { const b = el('div', { class: 'pv-btn ' + extraClass }); btns.add(b); render(); return b; }
  let lastTxt = '';
  function render(light) {
    for (const b of btns) if (!b.isConnected && b.__seen) btns.delete(b); else b.__seen = true;
    const H = heard(), talkers = H.filter(m => speaking(m.uid)).map(m => m.name);
    const txt = [on, muted, talk, starting, H.length, talkers.join(',')].join('|'); if (light && txt === lastTxt) return; lastTxt = txt;
    for (const b of btns) {
      if (!on) { b.replaceChildren(el('button', { class: 'pv-main', title: 'Parler aux gens autour de toi', onclick: () => start() }, starting ? '⏳ Vocal…' : '🎙️ Vocal de proximité')); b.classList.remove('on'); continue; }
      b.classList.add('on');
      b.replaceChildren(
        el('button', { class: 'pv-mic' + (muted || !talk ? ' off' : ''), title: talk ? (muted ? 'Rallumer ton micro' : 'Couper ton micro') : 'Tu écoutes seulement', onclick: () => (talk ? toggleMute() : toast('🎧 Ta voix doit être validée par l\'équipe pour parler')) }, !talk ? '🎧' : muted ? '🔇' : '🎙️'),
        el('span', { class: 'pv-info' }, talkers.length ? '🔊 ' + talkers.slice(0, 2).join(', ') : H.length ? `👂 ${H.length} personne${H.length > 1 ? 's' : ''} près de toi` : '👂 Personne autour'),
        el('button', { class: 'pv-x', title: 'Quitter le vocal de proximité', onclick: () => stop() }, '✕'));
    }
  }
  return { use, start, stop, toggleMute, speaking, button, isOn: () => on, debug: () => ({ space, sid, members: [...members.values()].map(m => m.name + ':' + m.uid), peers: [...peers.entries()].map(([k, p]) => [k, p.pc.connectionState, +p.vol.toFixed(2), !!p.gain]), prov: cur()[0], ctx: ctx()?.state }) };
})();
window.ProxVoice = ProxVoice;
