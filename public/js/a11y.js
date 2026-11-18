// The Paradise — ♿ L'accessibilité : pour que tout le monde soit bien sur le site
// 👁️ aveugles et malvoyants : lecture à voix haute des messages, gros texte, fort contraste, police très lisible, filtres daltoniens
// 👂 sourds et malentendants : alertes visuelles (l'écran clignote), vibrations, sous-titres du vocal
// 🤐 muets : phrases rapides, et « Écrire pour parler » dans le vocal (les autres entendent le texte lu à voix haute)
// 🖐️ difficultés avec la souris : gros boutons, contour bien visible au clavier, moins d'animations
const A11y = (() => {
  const DEF = { size: '100', contrast: false, font: '', calm: false, links: false, big: false, color: '', reader: 'off', rate: '1', flash: false, vibrate: false, phrases: false, ttsHear: true, captions: false };
  let opt = { ...DEF };
  try { opt = { ...DEF, ...JSON.parse(localStorage.getItem('lc_a11y') || '{}') }; } catch (e) {}
  const save = () => { try { localStorage.setItem('lc_a11y', JSON.stringify(opt)); } catch (e) {} };
  const html = document.documentElement;

  // ---------- Appliquer les réglages ----------
  function apply() {
    html.dataset.a11ySize = opt.size;
    html.classList.toggle('a11y-contrast', !!opt.contrast);
    html.classList.toggle('a11y-calm', !!opt.calm);
    html.classList.toggle('a11y-links', !!opt.links);
    html.classList.toggle('a11y-big', !!opt.big);
    html.dataset.a11yFont = opt.font || '';
    html.dataset.a11yColor = opt.color || '';
    if (opt.font && !document.getElementById('a11yFonts')) document.head.append(Object.assign(document.createElement('link'), { id: 'a11yFonts', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@400;600&display=swap' }));
    if (opt.color && !document.getElementById('a11ySvg')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'a11ySvg'; svg.setAttribute('style', 'position:absolute;width:0;height:0');
      // corrections pour les daltoniens (protanopie : rouge, deutéranopie : vert, tritanopie : bleu)
      svg.innerHTML = `<filter id="a11y-protan"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>
        <filter id="a11y-deutan"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter>
        <filter id="a11y-tritan"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>
        <filter id="a11y-gray"><feColorMatrix type="saturate" values="0"/></filter>`;
      document.body?.append(svg);
    }
    if (opt.calm) { try { if (localStorage.getItem('lc_fx') !== '0') { localStorage.setItem('lc_fx', '0'); LC.applySeason?.(LC.site?.theme); } } catch (e) {} }
    renderPhrases();
  }

  // ---------- 🔊 Lire les messages à voix haute ----------
  const speak = (text, { urgent } = {}) => {
    if (!('speechSynthesis' in window) || !text) return;
    if (urgent) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, 'un lien')); u.lang = (window.Translator?.lang || 'fr'); u.rate = parseFloat(opt.rate) || 1;
    speechSynthesis.speak(u);
  };
  let quietUntil = 0; // pas de lecture pendant qu'on charge l'historique d'un salon
  document.addEventListener('viewchange', () => { quietUntil = Date.now() + 1500; });
  function watchMessages() {
    const box = document.getElementById('messages'); if (!box) return;
    new MutationObserver(list => {
      if (opt.reader === 'off' || Date.now() < quietUntil) return;
      if (list.reduce((n, m) => n + m.addedNodes.length, 0) > 3) return; // tout un historique qui arrive d'un coup : on ne lit pas
      for (const m of list) for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.classList.contains('msg')) {
          const who = n.querySelector('.who')?.textContent?.trim() || '', text = n.querySelector('.text')?.textContent?.trim() || (n.querySelector('audio') ? 'un message vocal' : n.querySelector('img') ? 'une photo' : '');
          if (!text || who === state.me?.username) continue;
          const mention = n.classList.contains('mention');
          if (opt.reader === 'all' || mention) speak(`${who} ${mention ? 'te parle' : 'dit'} : ${text}`);
        } else if (n.classList.contains('bubble-row') && !n.classList.contains('mine')) {
          const text = n.querySelector('.text')?.textContent?.trim() || 'un message';
          const who = state.convs?.get(state.view?.userId)?.user?.username || '';
          speak(`Message privé de ${who} : ${text}`);
        } else if (n.classList.contains('sys') && opt.reader === 'all') speak(n.textContent);
      }
    }).observe(box, { childList: true });
  }

  // ---------- 👀 Alertes visuelles (à la place des sons) ----------
  function alert() {
    if (opt.flash) { document.body.classList.remove('a11y-flash'); void document.body.offsetWidth; document.body.classList.add('a11y-flash'); setTimeout(() => document.body.classList.remove('a11y-flash'), 1300); }
    if (opt.vibrate) try { navigator.vibrate?.([200, 100, 200]); } catch (e) {}
  }

  // ---------- 💬 Les phrases rapides (pour écrire vite, ou quand on ne peut pas parler) ----------
  const PHRASES = ['👋 Bonjour !', '✅ Oui', '❌ Non', '🙏 Merci', '😊 D\'accord', '⏳ Attends une seconde', '🔁 Tu peux répéter ?', '🤟 Je ne peux pas parler, j\'écris', '🧏 Je suis sourd(e), écris-moi s\'il te plaît', '👋 À plus tard !'];
  function renderPhrases() {
    const comp = document.getElementById('composer'); if (!comp) return;
    let bar = document.getElementById('a11yPhrases');
    if (!opt.phrases) { bar?.remove(); return; }
    if (!bar) { bar = LC.el('div', { id: 'a11yPhrases', class: 'a11y-phrases', role: 'toolbar', 'aria-label': 'Phrases rapides' }); comp.parentNode.insertBefore(bar, comp); }
    bar.replaceChildren(...PHRASES.map(p => LC.el('button', { type: 'button', class: 'a11y-phrase', onclick: () => { const i = document.getElementById('input'); if (!i || i.disabled) return; i.value = (i.value ? i.value + ' ' : '') + p; i.dispatchEvent(new Event('input')); i.focus(); } }, p)));
  }

  // ---------- ⌨️ Écrire pour parler dans le vocal ----------
  function sayBox() {
    if (!window.Voice?.slug) return toast('🎙️ Rejoins d\'abord le vocal (ou écoute-le 🎧)');
    const inp = LC.el('input', { class: 'input', maxlength: 300, placeholder: 'Écris ce que tu veux dire…', 'aria-label': 'Texte à dire dans le vocal' });
    const go = () => { const t = inp.value.trim(); if (!t) return; VoiceCap.say(t); inp.value = ''; inp.focus(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    modal(LC.el('div', { class: 'a11y-say' },
      LC.el('h3', {}, '⌨️ Écrire pour parler'),
      LC.el('p', { class: 'help' }, 'Ce que tu écris est lu à voix haute chez les autres personnes du vocal, et s\'affiche en sous-titres. Parfait si tu ne peux pas (ou ne veux pas) parler.'),
      LC.el('div', { class: 'row', style: 'gap:8px' }, inp, LC.el('button', { class: 'btn btn-primary', onclick: go }, '🔊 Dire')),
      LC.el('div', { class: 'a11y-phrases', style: 'margin-top:10px' }, ...PHRASES.map(p => LC.el('button', { type: 'button', class: 'a11y-phrase', onclick: () => VoiceCap.say(p.replace(/^\S+\s/, '')) }, p)))));
    setTimeout(() => inp.focus(), 60);
  }

  // ---------- ⚙️ Le panneau ----------
  function open() {
    const row = (icon, label, help, ctrl) => LC.el('div', { class: 'a11y-row' }, LC.el('div', {}, LC.el('b', {}, icon + ' ' + label), help ? LC.el('small', {}, help) : null), ctrl);
    const sw = key => { const i = LC.el('input', { type: 'checkbox', checked: !!opt[key], 'aria-label': key, onchange: e => { opt[key] = e.target.checked; save(); apply(); if (key === 'flash' && opt.flash) alert(); if (key === 'captions' && window.VoiceCap) toast(opt.captions ? '💬 Les sous-titres du vocal s\'afficheront' : 'Sous-titres du vocal coupés'); } }); return LC.el('label', { class: 'switch a11y-sw' }, i); };
    const seg = (key, list) => LC.el('div', { class: 'a11y-seg', role: 'radiogroup' }, ...list.map(([v, l]) => LC.el('button', { type: 'button', role: 'radio', 'aria-checked': String(opt[key] === v), class: opt[key] === v ? 'on' : '', onclick: e => { opt[key] = v; save(); apply(); e.currentTarget.parentNode.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); }); if (key === 'reader' && v !== 'off') speak('La lecture des messages à voix haute est activée', { urgent: true }); if (key === 'rate') speak('Voici la nouvelle vitesse de lecture', { urgent: true }); } }, l)));
    const close = modal(LC.el('div', { class: 'a11y-panel', role: 'dialog', 'aria-label': 'Accessibilité' },
      LC.el('div', { class: 'a11y-head' }, LC.el('h3', {}, '♿ Accessibilité'), LC.el('button', { class: 'btn btn-sm', onclick: () => close(), 'aria-label': 'Fermer' }, '✕')),
      LC.el('p', { class: 'help' }, 'Règle le site pour qu\'il soit confortable pour toi. Tes choix sont gardés sur cet appareil.'),
      LC.el('h4', {}, '👁️ Pour bien voir (aveugles et malvoyants)'),
      row('🔊', 'Lire les messages à voix haute', 'Le site lit les nouveaux messages pour toi', seg('reader', [['off', 'Non'], ['mentions', 'Seulement pour moi'], ['all', 'Tous']])),
      row('🐢', 'Vitesse de lecture', '', seg('rate', [['0.8', 'Lente'], ['1', 'Normale'], ['1.3', 'Rapide']])),
      row('🔠', 'Taille du texte', '', seg('size', [['100', 'Normal'], ['115', 'Grand'], ['130', 'Très grand'], ['150', 'Énorme']])),
      row('🌗', 'Fort contraste', 'Textes plus blancs, contours bien marqués, moins de transparence', sw('contrast')),
      row('🔤', 'Police très lisible', 'Une écriture plus simple à lire (dyslexie, fatigue des yeux)', seg('font', [['', 'Normale'], ['lisible', 'Très lisible'], ['dys', 'Dyslexie']])),
      row('🎨', 'Aide pour les daltoniens', '', seg('color', [['', 'Non'], ['protan', 'Rouge'], ['deutan', 'Vert'], ['tritan', 'Bleu'], ['gray', 'Gris']])),
      row('🔗', 'Liens soulignés et contour bien visible', 'Pratique aussi pour naviguer au clavier (touche Tab)', sw('links')),
      LC.el('h4', {}, '👂 Pour ceux qui n\'entendent pas (sourds et malentendants)'),
      row('💡', 'Alertes visuelles', 'L\'écran clignote quand un son de notification devrait sonner', sw('flash')),
      row('📳', 'Vibrations', 'Le téléphone vibre aux nouveaux messages', sw('vibrate')),
      row('💬', 'Sous-titres du vocal', 'Ce que disent les autres au micro s\'écrit à l\'écran (bouton 🌐 Traduire dans le vocal)', LC.el('button', { class: 'btn btn-sm', onclick: () => { close(); window.VoiceCap?.panel(); } }, 'Régler')),
      LC.el('h4', {}, '🤐 Pour ceux qui ne parlent pas (muets)'),
      row('⌨️', 'Écrire pour parler dans le vocal', 'Tu écris, et les autres l\'entendent à voix haute', LC.el('button', { class: 'btn btn-sm btn-primary', onclick: () => { close(); sayBox(); } }, 'Ouvrir')),
      row('⚡', 'Phrases rapides', 'Des boutons « Bonjour », « Oui », « Merci »… au-dessus de la zone de message', sw('phrases')),
      row('🔈', 'Entendre les textes des personnes muettes', 'Dans le vocal, les textes écrits pour parler sont lus à voix haute', sw('ttsHear')),
      LC.el('h4', {}, '🖐️ Pour bouger moins (souris, mains, épilepsie)'),
      row('👆', 'Gros boutons', 'Des boutons plus grands, plus faciles à toucher', sw('big')),
      row('🧘', 'Moins d\'animations', 'Coupe les effets qui bougent et clignotent (conseillé en cas d\'épilepsie)', sw('calm')),
      row('🗣️', 'Écrire avec la voix', 'Le bouton 🗣️ à côté de la zone de message : tu parles, ça écrit', null),
      LC.el('button', { class: 'btn', style: 'width:100%;margin-top:12px', onclick: () => { opt = { ...DEF }; save(); apply(); close(); toast('♿ Réglages remis à zéro'); } }, '↺ Tout remettre comme avant')));
  }

  apply();
  document.addEventListener('DOMContentLoaded', () => { apply(); watchMessages(); });
  if (document.readyState !== 'loading') setTimeout(watchMessages, 0);
  // raccourci clavier : Alt + A ouvre l'accessibilité
  document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); open(); } });
  return { open, alert, speak, sayBox, get opt() { return opt; } };
})();
window.A11y = A11y;
