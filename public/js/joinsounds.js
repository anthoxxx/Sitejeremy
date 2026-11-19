// The Paradise — 🔔 Les sons d'arrivée : chacun choisit le bruit que les autres entendent quand il arrive dans un salon
// (klaxon, sonnette, fanfare…). Tous les sons sont fabriqués par le navigateur : aucun fichier à télécharger.
(function (root) {
  const LIST = [
    ['ding', '🔔', 'Ding (classique)'], ['klaxon', '🚗', 'Klaxon'], ['pouet', '🤡', 'Pouet de clown'], ['sonnette', '🏠', 'Sonnette ding-dong'],
    ['fanfare', '🎺', 'Fanfare'], ['tada', '🎉', 'Tadaaa !'], ['coucou', '🐦', 'Coucou'], ['canard', '🦆', 'Coin-coin'],
    ['sifflet', '😗', 'Sifflet'], ['laser', '🔫', 'Laser'], ['boing', '🦘', 'Boing'], ['tambour', '🥁', 'Roulement de tambour'],
    ['bravo', '👏', 'Applaudissements'], ['magie', '✨', 'Magie'], ['cloche', '⛪', 'Cloche'], ['train', '🚂', 'Train tchou-tchou'],
    ['moto', '🏍️', 'Vroum de moto'], ['bisou', '💋', 'Bisou'], ['alarme', '🚨', 'Sirène'], ['harpe', '🎶', 'Harpe'],
  ];
  const IDS = LIST.map(x => x[0]);
  if (typeof module !== 'undefined' && module.exports) { module.exports = IDS; return; }

  let AC = null;
  const ctx = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } };
  // une note : fréquence (ou [début, fin] pour une glissade), forme, début, durée, volume
  function note(A, out, f, type, t, len, vol = .2) {
    const o = A.createOscillator(), g = A.createGain(); o.type = type;
    const s = A.currentTime + t;
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], s); o.frequency.exponentialRampToValueAtTime(f[1], s + len); } else o.frequency.setValueAtTime(f, s);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol, s + .015); g.gain.setValueAtTime(vol, s + len * .7); g.gain.exponentialRampToValueAtTime(.001, s + len);
    o.connect(g).connect(out); o.start(s); o.stop(s + len + .05); return o;
  }
  function noise(A, out, t, len, vol = .2, freq = 1200) {
    const b = A.createBuffer(1, Math.ceil(A.sampleRate * len), A.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(); src.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
    const s = A.currentTime + t; g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(.001, s + len);
    src.connect(f).connect(g).connect(out); src.start(s);
  }
  const SOUNDS = {
    ding: (A, o) => { note(A, o, [880, 1320], 'sine', 0, .35, .15); },
    klaxon: (A, o) => { for (const t of [0, .32]) { note(A, o, 370, 'square', t, .24, .09); note(A, o, 466, 'square', t, .24, .08); note(A, o, 185, 'sawtooth', t, .24, .05); } },
    pouet: (A, o) => { note(A, o, [300, 620], 'sawtooth', 0, .18, .12); note(A, o, [620, 260], 'sawtooth', .2, .3, .12); },
    sonnette: (A, o) => { note(A, o, 659, 'sine', 0, .7, .22); note(A, o, 523, 'sine', .45, 1, .22); },
    fanfare: (A, o) => { [[523, 0, .12], [523, .13, .12], [523, .26, .12], [659, .4, .25], [523, .67, .14], [784, .83, .5]].forEach(([f, t, l]) => { note(A, o, f, 'sawtooth', t, l, .07); note(A, o, f * 2, 'square', t, l, .025); }); },
    tada: (A, o) => { note(A, o, 523, 'triangle', 0, .12, .2); [523, 659, 784, 1047].forEach(f => note(A, o, f, 'triangle', .16, .9, .1)); },
    coucou: (A, o) => { for (const t of [0, .55]) { note(A, o, 784, 'sine', t, .2, .2); note(A, o, 622, 'sine', t + .24, .28, .2); } },
    canard: (A, o) => { for (const t of [0, .26]) { note(A, o, [520, 380], 'sawtooth', t, .16, .1); note(A, o, [260, 190], 'square', t, .16, .05); } },
    sifflet: (A, o) => { note(A, o, [1200, 2400], 'sine', 0, .3, .12); note(A, o, [2400, 900], 'sine', .32, .45, .12); },
    laser: (A, o) => { for (const t of [0, .18, .36]) note(A, o, [1800, 120], 'square', t, .16, .06); },
    boing: (A, o) => { note(A, o, [90, 520], 'sine', 0, .12, .25); note(A, o, [520, 160], 'sine', .12, .5, .2); },
    tambour: (A, o) => { for (let i = 0; i < 18; i++) noise(A, o, i * .045, .05, .06 + i * .006, 300); noise(A, o, .85, .5, .3, 180); note(A, o, 80, 'sine', .85, .4, .3); },
    bravo: (A, o) => { for (let i = 0; i < 26; i++) noise(A, o, Math.random() * 1.2, .06, .12, 1500 + Math.random() * 1500); },
    magie: (A, o) => { [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => note(A, o, f, 'sine', i * .07, .5, .07)); },
    cloche: (A, o) => { for (const t of [0, .7]) { note(A, o, 392, 'sine', t, 1.4, .2); note(A, o, 784 * 1.01, 'sine', t, 1, .07); note(A, o, 1176, 'sine', t, .6, .04); } },
    train: (A, o) => { for (const t of [0, .5]) { note(A, o, 554, 'sawtooth', t, .4, .05); note(A, o, 698, 'sawtooth', t, .4, .05); note(A, o, 831, 'sawtooth', t, .4, .04); } },
    moto: (A, o) => { note(A, o, [60, 180], 'sawtooth', 0, .5, .12); note(A, o, [180, 90], 'sawtooth', .5, .4, .1); noise(A, o, 0, .9, .05, 200); },
    bisou: (A, o) => { noise(A, o, 0, .06, .3, 2600); note(A, o, [900, 1800], 'sine', .02, .08, .12); },
    alarme: (A, o) => { for (let i = 0; i < 2; i++) { note(A, o, [650, 1300], 'sawtooth', i * .6, .3, .06); note(A, o, [1300, 650], 'sawtooth', i * .6 + .3, .3, .06); } },
    harpe: (A, o) => { [392, 494, 587, 784, 988, 1175].forEach((f, i) => note(A, o, f, 'triangle', i * .06, .9, .09)); },
  };
  function play(id, volume = 1) {
    const A = ctx(); const fn = SOUNDS[id] || SOUNDS.ding; if (!A) return;
    const out = A.createGain(); out.gain.value = Math.max(0, Math.min(1.5, volume)); out.connect(A.destination);
    try { fn(A, out); } catch (e) {}
  }
  const pref = (k, d) => { try { return localStorage.getItem('lc_js_' + k) ?? d; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('lc_js_' + k, v); } catch (e) {} };
  // 🔊 quand quelqu'un arrive dans mon salon
  let last = 0;
  function onArrive(sound) {
    const mode = pref('mode', 'theirs'); if (mode === 'off') return;
    if (Date.now() - last < 1500) return; last = Date.now(); // pas de cacophonie si plein de monde arrive en même temps
    root.JoinSounds.play(mode === 'mine' ? pref('mine', 'ding') : (sound || 'ding'), +pref('vol', '0.8'));
  }
  // la fenêtre pour choisir
  function open() {
    const box = el('div', { class: 'jsd' });
    let close = null;
    const draw = () => {
      const mine = state.me?.joinSound || 'ding', mode = pref('mode', 'theirs'), hear = pref('mine', 'ding');
      const grid = (cur, pick) => el('div', { class: 'jsd-grid' }, ...LIST.map(([id, ico, n]) => el('button', { class: 'jsd-s' + (cur === id ? ' on' : ''), onclick: () => { play(id, +pref('vol', '0.8')); pick(id); } }, el('span', {}, ico), el('small', {}, n))));
      box.replaceChildren(
        el('h3', {}, '🔔 Les sons d\'arrivée'),
        state.me?.isGuest ? el('p', { class: 'help' }, 'Inscris-toi pour choisir ton propre son d\'arrivée 😉') : el('div', {},
          el('p', { class: 'help' }, '🎺 Mon son : c\'est le bruit que tout le monde entend quand j\'arrive dans un salon. Touche un son pour l\'écouter et le choisir.'),
          grid(mine, async id => { try { await api('/api/me', { method: 'PUT', body: { joinSound: id } }); state.me.joinSound = id; draw(); toast('🔔 Ton son d\'arrivée : ' + LIST.find(x => x[0] === id)[2]); } catch (e) { toast(e.message); } })),
        el('h4', { class: 'jsd-h' }, '👂 Ce que j\'entends quand quelqu\'un arrive'),
        el('div', { class: 'jsd-modes' }, ...[['theirs', '🎭 Le son de chaque personne'], ['mine', '🔁 Toujours le même son'], ['off', '🔇 Aucun son']].map(([v, l]) => el('button', { class: 'btn btn-sm' + (mode === v ? ' btn-primary' : ''), onclick: () => { setPref('mode', v); draw(); } }, l))),
        mode === 'mine' ? grid(hear, id => { setPref('mine', id); draw(); }) : null,
        mode !== 'off' ? el('label', { class: 'jsd-vol' }, '🔈', el('input', { type: 'range', min: 0, max: 1.5, step: .1, value: pref('vol', '0.8'), onchange: e => { setPref('vol', e.target.value); play(mode === 'mine' ? hear : mine, +e.target.value); } }), '🔊') : null,
        el('div', { style: 'text-align:right;margin-top:10px' }, el('button', { class: 'btn btn-primary', onclick: () => close && close() }, 'OK')));
    };
    draw(); close = modal(box);
  }
  root.JoinSounds = { LIST, play, onArrive, open };
})(this);
