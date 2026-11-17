// The Paradise — 🌐 La traduction du vocal : quand quelqu'un parle au micro (dans n'importe quelle langue),
// son navigateur écrit ce qu'il dit, et chacun le reçoit traduit dans SA langue (en sous-titres, et à voix haute si on veut).
const VoiceCap = (() => {
  const SPEAK_LANGS = [['fr-FR', '🇫🇷 Français'], ['en-US', '🇬🇧 English'], ['es-ES', '🇪🇸 Español'], ['de-DE', '🇩🇪 Deutsch'], ['it-IT', '🇮🇹 Italiano'], ['pt-PT', '🇵🇹 Português'], ['ar-SA', '🇸🇦 العربية'], ['tr-TR', '🇹🇷 Türkçe'], ['ru-RU', '🇷🇺 Русский'], ['pl-PL', '🇵🇱 Polski'], ['ro-RO', '🇷🇴 Română'], ['nl-NL', '🇳🇱 Nederlands'], ['zh-CN', '🇨🇳 中文'], ['ja-JP', '🇯🇵 日本語'], ['ko-KR', '🇰🇷 한국어'], ['hi-IN', '🇮🇳 हिन्दी'], ['uk-UA', '🇺🇦 Українська']];
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  let opt = { talk: false, lang: 'fr-FR', read: false, show: true };
  try { opt = { ...opt, ...JSON.parse(localStorage.getItem('lc_voicecap') || '{}') }; } catch (e) {}
  opt.talk = false; // on ne rallume jamais le micro tout seul
  const save = () => { try { localStorage.setItem('lc_voicecap', JSON.stringify(opt)); } catch (e) {} };
  let rec = null, lastInterim = 0;
  const box = () => { let b = document.getElementById('voiceCaps'); if (!b) { b = el('div', { id: 'voiceCaps', class: 'voice-caps' }); document.body.append(b); } return b; };
  const myLang = () => (window.Translator?.lang || 'fr');
  const base = l => String(l || '').split('-')[0].toLowerCase();

  // 🎙️ Mes sous-titres : le navigateur écoute ma voix et l'écrit
  function start() {
    if (!R) { toast('🌐 Ton navigateur ne sait pas écrire la voix : utilise Google Chrome (ordinateur ou Android) ou Safari récent'); return false; }
    if (!window.Voice?.slug || Voice.listening) { toast('🎙️ Rejoins le vocal avec ton micro d\'abord'); return false; }
    stop(true);
    rec = new R(); rec.lang = opt.lang; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      if (Voice.muted) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], text = r[0].transcript.trim(); if (!text) continue;
        if (r.isFinal) { socket.emit('voice_caption', { text, lang: opt.lang, final: true }); show({ username: state.me.username, mine: true, text, final: true }); }
        else if (Date.now() - lastInterim > 800) { lastInterim = Date.now(); socket.emit('voice_caption', { text, lang: opt.lang, final: false }); }
      }
    };
    rec.onerror = e => { if (e.error === 'not-allowed') { toast('🎙️ Autorise le micro pour les sous-titres'); opt.talk = false; } };
    rec.onend = () => { if (opt.talk && Voice.slug && !Voice.listening) { try { rec.start(); } catch (e) {} } };
    try { rec.start(); } catch (e) { return false; }
    opt.talk = true; save(); return true;
  }
  function stop(silent) { opt.talk = false; if (rec) { try { rec.onend = null; rec.stop(); } catch (e) {} rec = null; } if (!silent) save(); }

  // 💬 Les sous-titres des autres, traduits dans ma langue
  const lines = new Map(); // userId -> élément (pour remplacer le texte provisoire)
  async function show(c) {
    if (!opt.show) return;
    const b = box(), key = c.mine ? 'me' : c.userId;
    let line = lines.get(key);
    if (!line || !b.contains(line)) { line = el('div', { class: 'vcap' + (c.mine ? ' mine' : '') }); b.append(line); lines.set(key, line); }
    const set = (t, tr) => line.replaceChildren(el('b', {}, (c.mine ? '🎙️ ' : '🗣️ ') + c.username), el('span', { class: tr ? 'tr' : '' }, t), tr ? el('em', {}, ' 🌐') : null);
    set(c.text, false); line.classList.toggle('interim', !c.final);
    clearTimeout(line._t); line._t = setTimeout(() => { line.classList.add('bye'); setTimeout(() => { line.remove(); if (lines.get(key) === line) lines.delete(key); }, 500); }, c.final ? 9000 : 4000);
    while (b.children.length > 4) b.firstChild.remove();
    if (!c.final || c.mine) return;
    let text = c.text;
    if (base(c.lang) !== base(myLang())) {
      try { const r = await api('/api/translate', { method: 'POST', body: { text: c.text, to: myLang() } }); if (r.text) { text = r.text; set(text, true); } } catch (e) {}
    }
    if (opt.read && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = myLang(); u.rate = 1.05; speechSynthesis.speak(u); }
    lines.delete(key);
  }
  socket.on('voice_caption', c => show(c));

  // ⚙️ Les réglages
  function panel() {
    const sel = el('select', { class: 'input' }, ...SPEAK_LANGS.map(([v, l]) => el('option', { value: v, selected: opt.lang === v }, l)));
    sel.onchange = () => { opt.lang = sel.value; save(); if (opt.talk) start(); };
    const tr = window.Translator?.LANGS?.find(l => l[0] === myLang())?.[1] || myLang();
    const sw = (label, key, fn) => el('label', { class: 'switch' }, el('span', {}, label), el('input', { type: 'checkbox', checked: !!opt[key], onchange: e => { opt[key] = e.target.checked; save(); fn && fn(e.target.checked); } }));
    const close = modal(el('div', { class: 'vcap-panel' },
      el('h3', {}, '🌐 Traduction du vocal'),
      el('p', { class: 'help' }, 'Quand quelqu\'un parle au micro dans une autre langue, tu lis (et tu entends si tu veux) ce qu\'il dit traduit en ' + tr + '.'),
      sw('💬 Afficher les sous-titres traduits', 'show'),
      sw('🔊 Lire les traductions à voix haute', 'read'),
      el('hr'),
      el('h4', {}, '🎙️ Mes sous-titres'),
      el('p', { class: 'help' }, 'Allume-les pour que les autres puissent lire (et traduire) ce que tu dis. Choisis la langue dans laquelle tu parles :'),
      sel,
      el('button', { class: 'btn ' + (opt.talk ? 'btn-danger' : 'btn-primary'), style: 'width:100%;margin-top:10px', onclick: () => { if (opt.talk) { stop(); toast('🎙️ Sous-titres coupés'); } else if (start()) toast('🎙️ Tes sous-titres sont allumés : parle !'); close(); window.renderVoice?.(); } }, opt.talk ? '⏹ Couper mes sous-titres' : '▶ Allumer mes sous-titres'),
      R ? null : el('p', { class: 'help', style: 'color:#ffb547' }, '⚠️ Ton navigateur ne sait pas écrire la voix : tu peux lire les sous-titres des autres, mais pas envoyer les tiens (utilise Google Chrome).'),
      el('p', { class: 'help', style: 'margin-top:8px' }, 'Ta langue de traduction se change avec le bouton 🌐 du salon.')));
  }
  return { panel, start, stop, get talking() { return opt.talk; }, onLeave: () => stop(true) };
})();
window.VoiceCap = VoiceCap;
