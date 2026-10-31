// The Paradis — dictée vocale (parler pour écrire) + messages vocaux
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- Lecteur de message vocal ----------
let currentAudio = null;
function audioPlayer(url, duration = 0) {
  const a = new Audio();
  a.preload = 'none';
  a.src = url;
  // Petite forme d'onde décorative (toujours la même pour un même message)
  let seed = [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const bars = Array.from({ length: 28 }, (_, i) => el('i', { style: `height:${Math.round(25 + 75 * (0.35 + 0.65 * Math.abs(Math.sin(i / 3 + rnd() * 2))) * (0.6 + rnd() * 0.4))}%` }));
  const wave = el('div', { class: 'ap-wave' }, ...bars);
  const btn = el('button', { type: 'button', class: 'ap-btn', title: 'Écouter' }, '▶');
  const time = el('span', { class: 'ap-time' }, fmtSec(duration));
  const total = () => (isFinite(a.duration) && a.duration > 0 ? a.duration : duration || 1);
  const paint = () => {
    const ratio = Math.min(1, a.currentTime / total());
    const n = Math.round(ratio * bars.length);
    bars.forEach((b, i) => b.classList.toggle('on', i < n));
    time.textContent = a.paused && a.currentTime === 0 ? fmtSec(duration) : fmtSec(a.currentTime);
  };
  btn.onclick = () => {
    if (a.paused) {
      if (currentAudio && currentAudio !== a) currentAudio.pause();
      currentAudio = a;
      a.play().catch(() => toast('🎤 Lecture impossible'));
    } else a.pause();
  };
  a.onplay = () => { btn.textContent = '⏸'; };
  a.onpause = () => { btn.textContent = '▶'; };
  a.ontimeupdate = paint;
  a.onended = () => { a.currentTime = 0; btn.textContent = '▶'; paint(); };
  wave.onclick = e => {
    const r = wave.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    try { a.currentTime = ratio * total(); } catch (err) {}
    if (a.paused) btn.click();
  };
  return el('div', { class: 'audio-msg' }, btn, wave, time);
}

// ---------- Dictée vocale (reconnaissance de la voix du navigateur) ----------
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const Dictation = {
  rec: null,
  on: false,
  base: '',
  finalText: '',
  start() {
    if (!SpeechRec) return toast('🗣️ La dictée n\'est pas disponible sur ce navigateur (essaie Chrome, Edge ou Safari)');
    if (state.ghost || isMuted()) return toast(state.ghost ? '👻 Quitte le mode fantôme pour écrire' : '🔇 Tu es rendu muet pour le moment');
    const rec = new SpeechRec();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    this.base = input.value.trim();
    this.finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) this.finalText += ' ' + t; else interim += ' ' + t;
      }
      input.value = this.tidy(`${this.base} ${this.finalText} ${interim}`);
      input.dispatchEvent(new Event('input'));
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('🗣️ Autorise le micro pour utiliser la dictée');
      else if (e.error === 'no-speech') toast('🗣️ Je n\'ai rien entendu, réessaie');
    };
    rec.onend = () => { if (this.on) this.stop(); };
    try { rec.start(); } catch (e) { return; }
    this.rec = rec;
    this.on = true;
    this.render();
  },
  stop() {
    this.on = false;
    try { this.rec && this.rec.stop(); } catch (e) {}
    this.rec = null;
    input.value = this.tidy(input.value);
    input.dispatchEvent(new Event('input'));
    this.render();
    input.focus();
  },
  // Ponctuation dictée + majuscules + espaces propres
  tidy(text) {
    let t = ' ' + text.replace(/\s+/g, ' ') + ' ';
    const words = [
      [/ point d'interrogation /gi, '? '], [/ point d'exclamation /gi, '! '], [/ points de suspension /gi, '… '],
      [/ deux points /gi, ' : '], [/ point virgule /gi, ' ; '], [/ virgule /gi, ', '], [/ point /gi, '. '],
      [/ à la ligne /gi, '\n'], [/ nouvelle ligne /gi, '\n'],
    ];
    for (const [re, rep] of words) t = t.replace(re, rep);
    t = t.replace(/\s+([,.…])/g, '$1').replace(/\s*([?!:;])/g, ' $1').replace(/ +/g, ' ').replace(/\n /g, '\n').trim();
    // Majuscule en début de phrase
    t = t.replace(/(^|[.!?…]\s+|\n)([a-zàâäéèêëïîôöùûüç])/g, (m, p, c) => p + c.toUpperCase());
    return t;
  },
  render() {
    const b = $('dictateBtn');
    b.classList.toggle('active', this.on);
    b.title = this.on ? 'Arrêter la dictée' : 'Dictée vocale : parle, ça écrit';
    input.placeholder = this.on ? '🗣️ Parle, j\'écris pour toi… (dis « point », « virgule »…)' : (state.view?.type === 'pm' ? 'Message privé…' : 'Écris ton message…');
  },
};
if (SpeechRec) $('dictateBtn').classList.remove('hidden');
$('dictateBtn').onclick = () => (Dictation.on ? Dictation.stop() : Dictation.start());

// ---------- Enregistrement d'un message vocal ----------
const Recorder = {
  mr: null, stream: null, chunks: [], startedAt: 0, timer: null, sending: false,
  async start() {
    if (this.mr) return;
    if (!state.view) return;
    if (state.ghost) return toast('👻 Quitte le mode fantôme pour envoyer un vocal');
    if (isMuted()) return toast('🔇 Tu es rendu muet pour le moment');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('🎤 Ton navigateur ne permet pas d\'enregistrer (il faut un site en https)');
    if (Dictation.on) Dictation.stop();
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return toast('🎤 Autorise le micro pour envoyer un message vocal'); }
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    this.mr = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    this.chunks = [];
    this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.start(250);
    this.startedAt = Date.now();
    this.target = state.view.type === 'room' ? { room: state.view.slug } : { pm: state.view.userId };
    this.render();
    this.timer = setInterval(() => {
      const s = (Date.now() - this.startedAt) / 1000;
      const t = $('recBar').querySelector('.rec-time');
      if (t) t.textContent = fmtSec(s) + ' / 2:00';
      if (s >= 120) this.stop(true);
    }, 250);
  },
  stop(send) {
    if (!this.mr) return;
    const mr = this.mr;
    const duration = Math.round((Date.now() - this.startedAt) / 1000);
    const target = this.target;
    clearInterval(this.timer);
    mr.onstop = async () => {
      this.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(this.chunks, { type: mr.mimeType || 'audio/webm' });
      this.mr = null; this.stream = null; this.chunks = [];
      this.render();
      if (!send) return;
      if (duration < 1 || blob.size < 500) return toast('🎤 Message trop court');
      this.sending = true; this.render();
      try {
        const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        const { url } = await api('/api/audio', { method: 'POST', body: { data } });
        const audio = { url, duration };
        const ack = r => { if (r && r.error) toast(r.error); };
        if (target.room) socket.emit('message', { audio }, ack);
        else socket.emit('pm', { to: target.pm, audio }, ack);
      } catch (e) { toast('🎤 ' + e.message); }
      this.sending = false; this.render();
    };
    mr.stop();
  },
  render() {
    const bar = $('recBar');
    const recording = !!this.mr;
    $('composer').classList.toggle('recording', recording || this.sending);
    if (this.sending) {
      bar.replaceChildren(el('span', { class: 'rec-dot sending' }), el('span', {}, 'Envoi du message vocal…'));
    } else if (recording) {
      bar.replaceChildren(
        el('button', { type: 'button', class: 'btn btn-icon', title: 'Annuler', onclick: () => this.stop(false) }, '🗑'),
        el('span', { class: 'rec-dot' }), el('span', { class: 'rec-time' }, '0:00 / 2:00'),
        el('span', { class: 'rec-hint' }, 'Enregistrement…'),
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.stop(true) }, '➤ Envoyer'));
    }
    bar.classList.toggle('hidden', !recording && !this.sending);
  },
};
$('recBtn').onclick = () => Recorder.start();

// Sur téléphone : micro quand le champ est vide, flèche d'envoi quand on écrit
const syncComposer = () => $('composer').classList.toggle('empty', !input.value.trim());
input.addEventListener('input', syncComposer);
syncComposer();
