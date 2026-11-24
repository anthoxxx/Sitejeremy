// The Paradise — 🍔💧❤️ Les barres de faim, de soif et de santé (affichées dans la Ville et le Paradise Complex)
// Le serveur les fait baisser pendant qu'on joue ; manger, boire et se soigner les remontent.
const Needs = (() => {
  let st = { hunger: 100, thirst: 100, health: 100, sick: '', sickInfo: null, slow: 1 }, loaded = false;
  const bars = new Set();
  const COL = { hunger: '#ff9a3d', thirst: '#38c8ff', health: '#ff3b6a' };
  function bar(extra = '') { const b = el('div', { class: 'nd-bars ' + extra, title: 'Faim, soif et santé de ton personnage' }); bars.add(b); render(); if (!loaded) load(); return b; }
  function render() {
    for (const b of bars) {
      if (!b.isConnected && b.__seen) { bars.delete(b); continue; } b.__seen = true;
      const row = (k, ic) => el('div', { class: 'nd-row' + (st[k] < 20 ? ' low' : '') }, el('span', {}, ic), el('i', {}, el('b', { style: `width:${st[k]}%;background:${COL[k]}` })));
      b.replaceChildren(row('hunger', '🍔'), row('thirst', '💧'), row('health', '❤️'), st.sick ? el('div', { class: 'nd-sick', title: 'Va à la pharmacie pour te soigner' }, `${st.sickInfo?.icon || '🤧'} ${st.sickInfo?.name || ''}`) : null);
    }
  }
  async function load() { loaded = true; try { set(await api('/api/needs')); } catch (e) {} }
  function set(d) { if (!d) return; st = { ...st, ...d }; render(); }
  // 🤧 quand on est malade, le personnage tousse de temps en temps (on l'entend, et les autres voient l'émoji)
  let AC = null;
  const cough = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); const t = AC.currentTime;
    for (let k = 0; k < 2; k++) { const n = Math.ceil(AC.sampleRate * .18), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
      const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = 500 + k * 150; f.Q.value = 1.2; g.gain.value = .35; s.connect(f).connect(g).connect(AC.destination); s.start(t + k * .26); } } catch (e) {} };
  setInterval(() => {
    if (!st.sick || !st.sickInfo || Math.random() > .5) return;
    const inCity = window.Island?.isOpen?.() && window.Island.kind?.() === 'island', inClub = window.Casino?.active?.();
    if (!inCity && !inClub) return;
    if (st.sickInfo.sound === 'cough') cough();
    if (inClub) socket.emit('cs_emote', st.sickInfo.icon); else socket.emit('island_emote', st.sickInfo.icon);
  }, 25000);
  socket.on('needs', d => { const was = st.sick; set(d); if (d.msg) toast(d.msg); if (d.sick && !was && d.sickInfo?.sound === 'cough') cough(); });
  socket.on('needs_faint', () => { try { window.LC?.confetti?.(['😵', '🚑']); } catch (e) {} });
  socket.on('connect', () => { if (loaded) load(); });
  return { bar, set, slow: () => st.slow || 1, state: () => ({ ...st }) };
})();
window.Needs = Needs;
