// The Paradise — Les jeux de la Ville (côté écran) : 🗺️ Chasse au trésor du jour et 🏁 Courses de voitures
const CityGames = (() => {
  let race = { state: 'idle', racers: [], checkpoints: [] }, heat = 0, near = null, nearAt = 0, myCar = '🏎️', hud = null;
  try { myCar = localStorage.getItem('lc_car') || '🏎️'; } catch (e) {}
  const mine = () => race.racers.find(r => r.id === state.me?.id);
  const fmt = ms => (Math.max(0, ms) / 1000).toFixed(1) + ' s';

  // ---------- 🏎️ Pendant la course ----------
  const carOf = id => (race.state === 'running' ? race.racers.find(r => r.id === id)?.car : null);
  function speed() {
    const r = mine(); if (!r || race.state !== 'running') return 1;
    if (Date.now() < race.startAt) return 0; // 3, 2, 1… on ne bouge pas encore
    return r.done ? 1 : 2.1;
  }
  function getHud() {
    const root = window.Island?.root?.(); if (!root) return null;
    if (!hud || !root.contains(hud)) { hud = el('div', { class: 'cg-hud' }); root.append(hud); }
    return hud;
  }
  function renderHud() {
    const h = getHud(); if (!h) return;
    const r = mine(), heatTxt = ['', '🧊 Froid', '🌤️ Tiède', '🔥 Chaud', '🔥🔥 Brûlant !'][heat] || '';
    const parts = [];
    if (heat && !(r && race.state === 'running')) parts.push(el('div', { class: 'cg-heat lvl' + heat, title: 'Chasse au trésor : plus c\'est chaud, plus tu es près du coffre' }, '🗺️ ', heatTxt));
    if (r && race.state === 'lobby') parts.push(el('div', { class: 'cg-race' }, el('b', {}, '🏁 Départ dans ', el('span', { class: 'cg-lobby' }, Math.max(0, Math.ceil((race.lobbyEnd - Date.now()) / 1000)) + ' s')), el('small', {}, `${race.racers.length} pilote${race.racers.length > 1 ? 's' : ''} : ${race.racers.map(x => x.username).join(', ')}`)));
    if (r && race.state === 'running') {
      const left = race.startAt - Date.now();
      if (left > 0) parts.push(el('div', { class: 'cg-count' }, Math.ceil(left / 1000)));
      else if (left > -900) parts.push(el('div', { class: 'cg-count go' }, 'PARTEZ !'));
      parts.push(el('div', { class: 'cg-race' }, race.endAt ? el('small', { class: 'cg-end' }, `⏳ Fin de la course dans ${Math.max(0, Math.ceil((race.endAt - Date.now()) / 1000))} s`) : null, el('b', {}, r.done ? `🏁 Arrivé ! ${fmt(r.done - race.startAt)}` : `⏱️ ${fmt(Date.now() - race.startAt)} · point ${Math.min(r.cp + 1, race.checkpoints.length)}/${race.checkpoints.length}`),
        el('ol', { class: 'cg-rank' }, ...race.racers.slice(0, 5).map(x => el('li', { class: x.id === state.me.id ? 'me' : '' }, `${x.car} ${x.username}`, x.done ? ' 🏁' : ` · ${x.cp}/${race.checkpoints.length}`)))));
    }
    h.replaceChildren(...parts);
  }
  setInterval(() => { if (window.Island?.isOpen?.() && window.Island.kind() === 'island') renderHud(); else if (hud) hud.replaceChildren(); }, 250);

  // ---------- 🎨 Dessin sur la carte de la Ville ----------
  function drawGround(ctx, t) {
    const r = mine();
    if (race.state === 'idle' || !race.checkpoints.length) return;
    // la ligne de départ en damier
    ctx.save(); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; ctx.fillRect(440 + j * 10, 430 + i * 12, 10, 12); } ctx.restore();
    if (!r) return;
    race.checkpoints.forEach(([x, y], i) => {
      const next = i === r.cp && !r.done, passed = i < r.cp;
      ctx.save(); ctx.globalAlpha = passed ? .25 : next ? 1 : .55;
      ctx.strokeStyle = next ? `hsl(${(t * 200) % 360},100%,60%)` : passed ? '#2bd07a' : '#ffd34d'; ctx.lineWidth = next ? 8 : 4;
      ctx.beginPath(); ctx.arc(x, y, next ? 60 + Math.sin(t * 6) * 6 : 50, 0, 7); ctx.stroke();
      ctx.font = '900 22px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      const lab = i === race.checkpoints.length - 1 ? '🏁' : String(i + 1); ctx.strokeText(lab, x, y); ctx.fillText(lab, x, y); ctx.restore();
    });
  }
  function drawTop(ctx, t, me) {
    // ✨ le coffre au trésor brille quand on est tout près
    if (near && Date.now() - nearAt < 3000) {
      const { x, y } = near, b = Math.sin(t * 5) * 4;
      ctx.save(); ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 25; ctx.font = '44px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText('🧰', x, y - 10 + b); ctx.shadowBlur = 0; ctx.font = '18px sans-serif';
      for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.25; ctx.fillText('✨', x + Math.cos(a) * 34, y - 10 + Math.sin(a) * 22); }
      ctx.restore();
    }
    // ➡️ la flèche vers le prochain point de passage
    const r = mine();
    if (me && r && race.state === 'running' && !r.done && race.checkpoints[r.cp]) {
      const [cx, cy] = race.checkpoints[r.cp], a = Math.atan2(cy - me.y, cx - me.x);
      ctx.save(); ctx.translate(me.dx ?? me.x, (me.dy ?? me.y) - 80); ctx.rotate(a); ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-10, -14); ctx.lineTo(-4, 0); ctx.lineTo(-10, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // ---------- 🗺️ Le panneau de la chasse au trésor ----------
  async function treasurePanel() {
    let d; try { d = await api('/api/city/treasure'); } catch (e) { return toast(e.message); }
    modal(el('div', { class: 'cg-panel treasure' },
      el('div', { class: 'cg-big' }, '🗺️'), el('h3', {}, 'La Chasse au trésor du jour'),
      el('p', { class: 'cg-riddle' }, d.riddle),
      el('div', { class: 'cg-hints' }, ...d.hints.list.map(h => el('div', { class: 'cg-hint' }, h)), d.hints.next ? el('div', { class: 'cg-hint locked' }, `🔒 Nouvel indice à ${d.hints.next}`) : null),
      el('p', { class: 'help' }, '🌡️ Promène-toi dans la Ville : l\'indicateur en haut te dit si tu chauffes ou si tu refroidis. Quand tu es tout près, le coffre 🧰 apparaît : marche dessus !'),
      el('div', { class: 'cg-prize' }, d.winner ? `🏆 Déjà trouvé par ${d.winner} ! Il reste ${d.prize.others} 💰 pour chaque autre chercheur` : `🏆 Le premier qui le trouve gagne ${d.prize.first} 💰 (les suivants ${d.prize.others} 💰)`),
      d.found ? el('p', { class: 'cg-done' }, '✅ Tu l\'as déjà trouvé aujourd\'hui. Reviens demain pour un nouveau coffre !') : null));
  }
  // ---------- 🏁 Le panneau des courses ----------
  async function racePanel() {
    let d; try { d = await api('/api/city/race'); } catch (e) { return toast(e.message); }
    race = { ...race, ...d };
    const r = mine();
    const close = modal(el('div', { class: 'cg-panel' },
      el('div', { class: 'cg-big' }, '🏁'), el('h3', {}, 'Les Courses de la Ville'),
      el('p', { class: 'help' }, 'Fais le tour de la Ville en passant par tous les points dans l\'ordre (une flèche jaune te montre le chemin). Ta voiture va deux fois plus vite que ton personnage !'),
      el('h4', {}, '🚘 Choisis ta voiture'),
      el('div', { class: 'cg-cars' }, ...d.cars.map(c => el('button', { class: 'cg-car' + (c === myCar ? ' on' : ''), onclick: e => { myCar = c; try { localStorage.setItem('lc_car', c); } catch (er) {} e.currentTarget.parentNode.querySelectorAll('.cg-car').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, c))),
      el('div', { class: 'cg-prize' }, '🥇 100 💰 · 🥈 60 💰 · 🥉 40 💰 · arrivée 15 💰 (en solo : 15 💰)'),
      d.state === 'running' ? el('p', { class: 'cg-done' }, '⏳ Une course est en cours : attends la fin pour la prochaine.') : null,
      r ? el('button', { class: 'btn', style: 'width:100%', onclick: async () => { await api('/api/city/race/leave', { method: 'POST' }).catch(() => {}); close(); toast('Tu as quitté la course'); } }, '🚪 Quitter la course')
        : el('button', { class: 'btn btn-primary', style: 'width:100%', disabled: d.state === 'running', onclick: async () => { try { await api('/api/city/race/join', { method: 'POST', body: { car: myCar } }); close(); toast('🏁 Tu es inscrit ! Le départ est donné 20 secondes après le premier pilote'); } catch (e) { toast(e.message); } } }, d.state === 'lobby' ? `🏎️ Rejoindre la course (${d.racers.length} pilote${d.racers.length > 1 ? 's' : ''})` : '🏎️ Lancer une course'),
      el('h4', {}, '🏆 Meilleurs temps de la semaine'),
      d.leaderboard.length ? el('ol', { class: 'cg-board' }, ...d.leaderboard.map(b => el('li', {}, el('b', {}, b.username), ' ', fmt(b.ms)))) : el('p', { class: 'help' }, 'Personne n\'a encore couru cette semaine : sois le premier !')));
  }

  // ---------- Les nouvelles du serveur ----------
  socket.on('race_state', s => { const was = mine(); race = { ...race, ...s }; if (!was && mine() && s.state === 'running') toast('🏁 À vos marques… prêts…'); });
  socket.on('race_open', ({ by }) => { if (window.Island?.isOpen?.() && by !== state.me?.username && !mine()) toast(`🏁 ${by} lance une course dans la Ville ! Touche « Course » pour la rejoindre`, () => racePanel()); });
  socket.on('race_finish', ({ rank, ms }) => { LC.confetti(rank === 1 ? ['🏆', '🏁', '🥇'] : ['🏁', '✨']); toast(`🏁 Arrivée ! ${rank === 1 ? '🥇 1er' : rank + 'e'} en ${fmt(ms)}`); });
  socket.on('race_results', ({ results, solo }) => {
    const mineR = results.find(r => r.id === state.me.id);
    modal(el('div', { class: 'cg-panel' }, el('div', { class: 'cg-big' }, '🏆'), el('h3', {}, 'Résultats de la course'),
      results.length ? el('ol', { class: 'cg-board podium' }, ...results.map(r => el('li', { class: r.id === state.me.id ? 'me' : '' }, ['🥇', '🥈', '🥉'][r.rank - 1] || '🏁', ' ', el('b', {}, r.username), ` ${fmt(r.ms)}`, r.gain ? ` · +${r.gain} 💰` : ''))) : el('p', {}, 'Personne n\'a fini la course 😅'),
      mineR ? null : el('p', { class: 'help' }, 'Tu n\'as pas terminé à temps (2 minutes). Retente ta chance !'), solo ? el('p', { class: 'help' }, 'Course en solo : invite des amis pour gagner plus de pièces !') : null));
  });
  socket.on('treasure_heat', ({ lvl }) => { heat = lvl; if (lvl === 4) try { navigator.vibrate?.(60); } catch (e) {} });
  socket.on('treasure_near', p => { near = p; nearAt = Date.now(); });
  socket.on('treasure_found', ({ rank, gain }) => { LC.confetti(['🧰', '💰', '🗺️', '✨']); toast(rank === 1 ? `🏆 BRAVO ! Tu as trouvé le trésor du jour en premier : +${gain} 💰` : `🧰 Trésor trouvé ! +${gain} 💰 (${rank}e chercheur)`); near = null; });
  socket.on('treasure_winner', ({ username }) => { if (username !== state.me?.username) toast(`🗺️ ${username} a trouvé le trésor du jour ! Il reste un petit butin pour les suivants…`); });
  return { speed, carOf, drawGround, drawTop, treasurePanel, racePanel };
})();
window.CityGames = CityGames;
