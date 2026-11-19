// The Paradise — le téléphone virtuel 📱
// Un vrai petit téléphone sur le site : Messages, Appels, Snap (photos qui disparaissent, stories, flammes 🔥),
// Contacts, Appareil photo, et des raccourcis vers la Ville, les jeux, la boutique…
const Phone = (() => {
  let root, screen, stack = [], snapsUnread = 0, pmUnread = 0, convOpen = null, camStream = null, timers = [];
  const WALLS = {
    neon: 'radial-gradient(circle at 20% 15%, #ff4fd8 0, transparent 45%), radial-gradient(circle at 85% 80%, #2fa8ff 0, transparent 45%), linear-gradient(160deg, #2a0f48, #0b0618)',
    plage: 'linear-gradient(180deg, #ffb36b 0%, #ff6fa8 40%, #6a5cff 75%, #1a2a6c 100%)',
    ocean: 'linear-gradient(160deg, #38dce6, #2f6fd6 55%, #1a1a5e)',
    foret: 'linear-gradient(160deg, #2bd07a, #1c7a4a 55%, #0f2e22)',
    or: 'linear-gradient(160deg, #ffe08a, #d99a00 55%, #4a2c00)',
    nuit: 'radial-gradient(circle at 70% 20%, #ffffff22 0, transparent 20%), linear-gradient(180deg, #0b1640, #1a0b2e)',
    aurore: 'linear-gradient(180deg, #0b1d3a 0%, #1d6f6a 35%, #6fe3a6 55%, #3a1d6a 80%, #0b0b24 100%)',
    coucher: 'linear-gradient(180deg, #2a1050 0%, #b02a6a 40%, #ff8a3d 70%, #ffd36e 100%)',
    rose: 'radial-gradient(circle at 30% 30%, #ffd1e8, transparent 50%), linear-gradient(160deg, #ff9ac9, #c86bff)',
    lave: 'radial-gradient(circle at 50% 110%, #ff6a00, transparent 55%), linear-gradient(180deg, #1a0505, #5a0f0f 60%, #b02a0a)',
    galaxie: 'radial-gradient(circle at 25% 30%, #ffffff33 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, #ffffff44 0 1px, transparent 2px), radial-gradient(circle at 60% 40%, #c86bff88, transparent 40%), linear-gradient(160deg, #05021a, #1a0b4a 60%, #3a0b5a)',
    menthe: 'linear-gradient(160deg, #d4fff0, #6fe3c4 50%, #1f8a7a)',
    titane: 'linear-gradient(150deg, #e8e4dc, #b9b2a6 45%, #6e675c)',
    noir: 'radial-gradient(circle at 50% 30%, #2a2a32, #000 70%)',
    arcenciel: 'linear-gradient(160deg, #ff2d55, #ff9500, #ffe600, #34c759, #2fa8ff, #af52de)',
    bonbon: 'repeating-linear-gradient(45deg, #ffd1e8 0 22px, #c9f1ff 22px 44px, #fff3b0 44px 66px)',
  };
  const opt = (k, d) => { try { return localStorage.getItem('ph_' + k) || d; } catch (e) { return d; } };
  const setOpt = (k, v) => { try { localStorage.setItem('ph_' + k, v); } catch (e) {} };
  const time = () => { const d = new Date(); if (opt('h24', '1') === '0') { const h = d.getHours() % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, '0')}`; } return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const ago = ts => { const s = Math.floor((Date.now() - ts) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : new Date(ts).toLocaleDateString('fr-FR'); };
  const friends = () => (state.friends?.friends || []).map(f => ({ ...f, online: (state.online || []).some(o => o.id === f.id) }));
  const back = () => { stack.pop(); stopCam(); const f = stack.pop(); f ? go(f.fn, f.title) : home(); };
  const dark = on => root?.querySelector('.ph-device').classList.toggle('light', !on); // l'heure en haut : blanche sur fond sombre, noire sur fond clair
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- Le téléphone ----------
  function build() {
    root = el('div', { class: 'phone hidden', onclick: e => { if (e.target === root && !document.body.classList.contains('island-open')) close(); } },
      el('div', { class: 'ph-device' },
        el('div', { class: 'ph-status' }, el('b', { class: 'ph-time' }, time()), el('span', { class: 'ph-island' }, el('i', { class: 'ph-cam' }), el('span', { class: 'ph-island-txt' })), el('span', { class: 'ph-icons' }, el('span', { class: 'ph-sig' }, el('i'), el('i'), el('i'), el('i')), ' 5G ', el('span', { class: 'ph-bat' }, el('i')))),
        // les vrais boutons sur les côtés : volume + / − et le bouton latéral (verrouiller)
        el('button', { class: 'ph-side ph-side-l1', title: 'Volume +', onclick: () => volume(1) }), el('button', { class: 'ph-side ph-side-l2', title: 'Volume −', onclick: () => volume(-1) }),
        el('button', { class: 'ph-side ph-side-r', title: 'Bouton latéral : verrouiller (appui long : Siri)', onclick: () => { if (sideLong) { sideLong = false; return; } power(); }, onpointerdown: () => { clearTimeout(sideT); sideT = setTimeout(() => { sideLong = true; if (!screenOff) siri(); }, 600); }, onpointerup: () => clearTimeout(sideT), onpointerleave: () => clearTimeout(sideT) }), el('span', { class: 'ph-side ph-side-cam' }),
        screen = el('div', { class: 'ph-screen' }),
        // les zones à toucher ou glisser en haut : notifications (à gauche) et centre de contrôle (à droite)
        el('div', { class: 'ph-edge ph-edge-l', title: 'Centre de notifications' }), el('div', { class: 'ph-edge ph-edge-r', title: 'Centre de contrôle' }),
        el('div', { class: 'ph-overlay hidden' }),
        // la barre du bas : on la glisse vers le haut (ou on la touche) pour revenir à l'accueil, et depuis l'accueil pour ranger le téléphone
        el('div', { class: 'ph-homebar', title: 'Glisse vers le haut : accueil' }, el('i')),
        el('button', { class: 'ph-navbtn ph-close', title: 'Ranger le téléphone', onclick: () => close() }, '✕'),
        el('div', { class: 'ph-hud hidden' })));
    document.body.append(root);
    applyLook();
    setupGestures();
    setInterval(() => { const t = root.querySelector('.ph-time'); if (t) t.textContent = time(); const c = root.querySelector('.ph-clock b'); if (c) c.textContent = time(); }, 15000);
  }
  function open(app) {
    if (state.me?.isGuest) return toast('Inscris-toi pour avoir ton téléphone 📱');
    if (!root) build();
    root.classList.remove('hidden'); document.body.classList.add('phone-open'); hideReturn();
    refreshBadges();
    const go2 = () => (app && APPS[app] ? APPS[app].open() : home());
    // 🔒 comme un vrai iPhone : il faut le déverrouiller (avec code si tu en as mis un), sauf si tu l'as rangé il y a moins de 2 minutes
    const stale = Date.now() - closedAt > 120000;
    if (screenOff) { screenOff = false; root.querySelector('.ph-device').classList.remove('off'); }
    if (!opt('setup', '')) return setupWizard(() => { unlocked = true; go2(); }); // 📲 la première fois : on configure son iPhone tout neuf
    if ((opt('pin', '') && !unlocked) || (!opt('pin', '') && opt('lockopen', '1') === '1' && stale && !app)) lockScreen(go2); else go2();
  }
  function close() { if (!root) return; closedAt = Date.now(); hideOverlay(); if (opt('pin', '')) unlocked = false; /* 🔒 il se reverrouille quand on le range */ stopCam(); clearTimers(); convOpen = null; root.classList.add('hidden'); document.body.classList.remove('phone-open'); }
  const isOpen = () => root && !root.classList.contains('hidden');
  function go(fn, title, actions) {
    stopCam(); clearTimers();
    stack.push({ fn, title });
    screen.style.background = ''; dark(!title);
    const body = el('div', { class: 'ph-app-body' });
    hideOverlay();
    screen.replaceChildren(el('div', { class: 'ph-app ph-zoom-in' },
      title ? el('div', { class: 'ph-bar' }, el('button', { class: 'ph-back', onclick: back }, '‹'), el('b', {}, title), el('span', { class: 'ph-bar-act' }, ...(actions || []))) : null, body));
    fn(body);
  }

  // ---------- L'écran d'accueil ----------
  const APPS = {
    messages: { icon: '💬', name: 'Messages', c: '#2bd07a', open: () => go(messages, '💬 Messages'), badge: () => pmUnread },
    phone: { icon: '📞', name: 'Téléphone', c: '#2fa8ff', open: () => go(calls, '📞 Téléphone') },
    snap: { icon: '👻', name: 'Snap', c: '#ffe600', open: () => go(snapHome, '👻 Snap', [el('button', { class: 'ph-mini', onclick: () => go(camera, '') }, '📷')]), badge: () => snapsUnread },
    camera: { icon: '📷', name: 'Appareil photo', c: '#9aa3b2', open: () => go(camera, '') },
    contacts: { icon: '👥', name: 'Contacts', c: '#ff8a1f', open: () => go(contacts, '👥 Contacts') },
    // sur ordinateur, le téléphone reste ouvert à côté de la Ville ; sur téléphone, on va directement en ville
    city: { icon: '🏙️', name: 'Ville', c: '#c64dff', open: () => { window.Island?.open(); if (innerWidth <= 600) { close(); showReturn(); } else home(); } },
    games: { icon: '🎮', name: 'Jeux', c: '#ff2d55', open: () => { close(); showReturn(); Hub.open(); } },
    shop: { icon: '💰', name: 'Boutique', c: '#ffd34d', open: () => { close(); showReturn(); window.Shop?.open(); } },
    quests: { icon: '🎯', name: 'Quêtes', c: '#38dce6', open: () => { close(); showReturn(); window.Progress?.open(); } },
    pet: { icon: '🐾', name: 'Mon animal', c: '#ff5fa2', open: () => { close(); showReturn(); window.Pets?.open(); } },
    fortune: { icon: '🔮', name: 'Voyante', c: '#8b5cf6', open: () => { close(); showReturn(); window.Fortune?.open(); } },
    notifs: { icon: '🔔', name: 'Notifs', c: '#ff8a1f', open: () => { close(); showReturn(); $('notifBtn')?.click(); } },
    advent: { icon: '🎄', name: 'Avent', c: '#1f8a4c', open: () => { close(); showReturn(); window.Advent?.open(); } },
    pageant: { icon: '👑', name: 'Miss & Mister', c: '#ff5fa2', open: () => { close(); showReturn(); window.Pageant?.open(); } },
    calc: { icon: '🧮', name: 'Calculette', c: '#ff9500', open: () => go(calculator, '🧮 Calculette') },
    weather: { icon: '⛅', name: 'Météo', c: '#2f9bff', open: () => go(weather, '') },
    clock: { icon: '⏰', name: 'Horloge', c: '#1c1c24', open: () => go(clockApp, '⏰ Horloge') },
    notes: { icon: '📝', name: 'Notes', c: '#ffcc00', open: () => go(notes, '📝 Notes') },
    agenda: { icon: '📅', name: 'Calendrier', c: '#ff3b30', open: () => go(calendar, '📅 Calendrier') },
    torch: { icon: '🔦', name: 'Lampe', c: '#5856d6', open: () => go(torch, '') },
    settings: { icon: '⚙️', name: 'Réglages', c: '#6b7280', open: () => go(settings, '⚙️ Réglages') },
    appstore: { icon: '🅰️', name: 'App Store', c: '#1a8cff', open: () => go(appStore, '') },
    // 🆕 les applis à télécharger dans l'App Store
    paint: { icon: '🎨', name: 'Dessin', c: '#ff5fa2', open: () => go(paint, '🎨 Dessin') },
    dice: { icon: '🎲', name: 'Hasard', c: '#8b5cf6', open: () => go(dice, '🎲 Hasard') },
    translate: { icon: '🌐', name: 'Traduction', c: '#2f6fd6', open: () => go(translateApp, '🌐 Traduction') },
    g2048: { icon: '🔢', name: '2048', c: '#edc22e', open: () => go(game2048, '🔢 2048') },
    flappy: { icon: '🐤', name: 'Flappy', c: '#38c0e6', open: () => go(flappy, '') },
    breathe: { icon: '🧘', name: 'Zen', c: '#2bd07a', open: () => go(breathe, '') },
    horoscope: { icon: '♈', name: 'Horoscope', c: '#c64dff', open: () => go(horoscope, '♈ Horoscope') },
    map: { icon: '🗺️', name: 'Plans', c: '#34c759', open: () => go(mapApp, '🗺️ Plans') },
    compass: { icon: '🧭', name: 'Boussole', c: '#1c1c24', open: () => go(compass, '') },
    level: { icon: '📏', name: 'Niveau', c: '#ff9500', open: () => go(levelApp, '') },
    snake: { icon: '🐍', name: 'Serpent', c: '#2bb866', open: () => go(snakeGame, '🐍 Serpent') },
    whack: { icon: '🐹', name: 'Tape-taupe', c: '#a0522d', open: () => go(whack, '🐹 Tape-taupe') },
    simon: { icon: '🧠', name: 'Simon', c: '#ff3b30', open: () => go(simon, '🧠 Simon') },
    tictac: { icon: '⭕', name: 'Morpion', c: '#5856d6', open: () => go(tictac, '⭕ Morpion') },
    memory: { icon: '🃏', name: 'Memory', c: '#ff2d55', open: () => go(memory, '🃏 Memory') },
    breakout: { icon: '🧱', name: 'Casse-briques', c: '#ff9500', open: () => go(breakout, '🧱 Casse-briques') },
    recorder: { icon: '🎙️', name: 'Dictaphone', c: '#1c1c24', open: () => go(recorder, '🎙️ Dictaphone') },
    converter: { icon: '📐', name: 'Convertisseur', c: '#ff9500', open: () => go(converter, '📐 Convertisseur') },
    radio: { icon: '📻', name: 'Radio', c: '#ff2d55', open: () => go(radioApp, '📻 Radio') },
    quotes: { icon: '💡', name: 'Citations', c: '#ffcc00', open: () => go(quotes, '💡 Citations') },
  };
  // 📲 Les applis installées (gardées sur cet appareil). Certaines sont là dès le départ, comme sur un vrai iPhone.
  const SYSTEM = ['messages', 'phone', 'snap', 'camera', 'contacts', 'settings', 'appstore'];
  const STARTER = ['city', 'games', 'shop', 'weather', 'clock', 'calc', 'notes'];
  const STORE = {
    city: ['Ville du Paradise', 'Voyage', 'Promène-toi dans la grande ville', 4.9], games: ['Mini-jeux', 'Jeux', 'Bowling, billard, serpent, quiz…', 4.8], shop: ['Boutique Paradise', 'Shopping', 'Cadres, badges, effets de pseudo', 4.6],
    quests: ['Quêtes & Badges', 'Jeux', 'Tes défis du jour', 4.5], pet: ['Mon animal', 'Divertissement', 'Nourris et câline ton compagnon', 4.8], fortune: ['La Voyante', 'Style de vie', 'Madame Paradisia lit ton avenir', 4.4],
    advent: ['Calendrier de l\'Avent', 'Style de vie', 'Une surprise chaque jour de décembre', 4.9], pageant: ['Miss & Mister', 'Réseaux sociaux', 'Vote pour les plus beaux du mois', 4.3], notifs: ['Notifications', 'Utilitaires', 'Toutes tes alertes', 4.2],
    weather: ['Météo', 'Météo', 'Le temps qu\'il fait au Paradise', 4.6], clock: ['Horloge', 'Utilitaires', 'Chrono et minuteur', 4.7], calc: ['Calculette', 'Utilitaires', 'Pour tous tes calculs', 4.7], notes: ['Notes', 'Productivité', 'Écris tes idées', 4.6],
    agenda: ['Calendrier', 'Productivité', 'Les soirées et anniversaires', 4.5], torch: ['Lampe torche', 'Utilitaires', 'Pour voir dans le noir', 4.3],
    paint: ['Dessin', 'Créativité', 'Dessine avec tes doigts, envoie en snap', 4.8], dice: ['Hasard', 'Divertissement', 'Dé, pile ou face, roue de la décision', 4.5], translate: ['Traduction', 'Utilitaires', 'Traduis dans 20 langues (et écoute)', 4.7],
    g2048: ['2048', 'Jeux', 'Le célèbre jeu de chiffres', 4.8], flappy: ['Flappy Paradise', 'Jeux', 'Fais voler le poussin entre les tuyaux', 4.6], breathe: ['Zen', 'Santé', 'Respire et détends-toi en 1 minute', 4.9],
    horoscope: ['Horoscope', 'Style de vie', 'Ton horoscope du jour', 4.4], map: ['Plans', 'Navigation', 'Tous les lieux de la Ville', 4.7], compass: ['Boussole', 'Navigation', 'Trouve le nord', 4.2], level: ['Niveau à bulle', 'Utilitaires', 'Vérifie si c\'est bien droit', 4.1],
    snake: ['Serpent', 'Jeux', 'Le grand classique : mange les pommes', 4.7], whack: ['Tape-taupe', 'Jeux', 'Tape les hamsters avant qu\'ils se cachent', 4.6], simon: ['Simon', 'Jeux', 'Retiens l\'ordre des couleurs', 4.5],
    tictac: ['Morpion', 'Jeux', 'Bats le téléphone au morpion', 4.4], memory: ['Memory', 'Jeux', 'Retrouve les paires d\'animaux', 4.6], breakout: ['Casse-briques', 'Jeux', 'Casse toutes les briques avec la balle', 4.8],
    recorder: ['Dictaphone', 'Utilitaires', 'Enregistre des mémos vocaux', 4.5], converter: ['Convertisseur', 'Utilitaires', 'Longueurs, poids, températures, monnaies', 4.6],
    radio: ['Radio', 'Musique', 'Toutes les radios du site', 4.7], quotes: ['Citations', 'Style de vie', 'Une belle phrase pour chaque jour', 4.4],
  };
  const FEATURED = ['g2048', 'paint', 'flappy', 'breathe', 'translate', 'map', 'breakout', 'snake', 'whack', 'radio', 'memory', 'simon'];
  const instKey = () => 'ph_apps_' + (state.me?.id || 0);
  function installed() {
    let l = null; try { l = JSON.parse(localStorage.getItem(instKey()) || 'null'); } catch (e) {}
    if (!Array.isArray(l)) l = [...STARTER];
    return l.filter(k => APPS[k] && !SYSTEM.includes(k));
  }
  const setInstalled = l => { try { localStorage.setItem(instKey(), JSON.stringify(l)); } catch (e) {} };
  const isInst = k => SYSTEM.includes(k) || installed().includes(k);
  const install = k => { const l = installed(); if (!l.includes(k)) { l.push(k); setInstalled(l); } };
  const uninstall = k => setInstalled(installed().filter(x => x !== k));
  let jiggle = false;
  // 🔀 l'ordre des applis sur l'écran d'accueil et dans le dock (gardé sur cet appareil)
  const DOCK0 = ['phone', 'messages', 'snap', 'camera'];
  const ordKey = () => 'ph_order_' + (state.me?.id || 0), dockKey = () => 'ph_dock_' + (state.me?.id || 0);
  const readL = k => { try { const l = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(l) ? l : null; } catch (e) { return null; } };
  const writeL = (k, l) => { try { localStorage.setItem(k, JSON.stringify(l)); } catch (e) {} };
  function dockList() { return (readL(dockKey()) || DOCK0).filter(k => APPS[k] && isInst(k)).slice(0, 4); }
  function gridList() {
    const all = ['messages', 'snap', 'contacts', 'appstore', ...installed(), 'settings', 'phone', 'camera'].filter((k, i, a) => a.indexOf(k) === i);
    const dock = dockList(), saved = readL(ordKey()) || ['messages', 'snap', 'contacts', 'appstore', ...installed(), 'settings'];
    const out = saved.filter(k => APPS[k] && isInst(k) && !dock.includes(k));
    for (const k of all) if (!out.includes(k) && !dock.includes(k)) out.push(k); // les nouvelles applis arrivent à la fin
    return out;
  }
  // déplacer une appli : on la glisse sur une autre (ou dans le dock), comme sur iPhone
  let drag = null;
  function startDrag(e, k) {
    const src = e.currentTarget, ico = src.querySelector('.ph-ico'), r = ico.getBoundingClientRect();
    const ghost = ico.cloneNode(true); ghost.classList.add('ph-ghost'); ghost.querySelector('.ph-del')?.remove();
    Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' });
    document.body.append(ghost);
    drag = { k, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, last: '' };
    src.classList.add('dragging');
    const move = ev => {
      if (!drag) return;
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 6) drag.moved = true;
      ghost.style.left = (ev.clientX - drag.dx) + 'px'; ghost.style.top = (ev.clientY - drag.dy) + 'px';
      ghost.style.display = 'none'; const under = document.elementFromPoint(ev.clientX, ev.clientY); ghost.style.display = '';
      const t = under?.closest?.('.ph-appicon[data-k]'), inDock = !!under?.closest?.('.ph-dock');
      const key = t ? t.dataset.k + (inDock ? '@d' : '') : inDock ? '@dock' : '';
      if (!key || key === drag.last || t?.dataset.k === k) return;
      drag.last = key;
      let grid = gridList(), dock = dockList();
      const wasDock = dock.includes(k);
      grid = grid.filter(x => x !== k); dock = dock.filter(x => x !== k);
      if (inDock) {
        const i = t ? dock.indexOf(t.dataset.k) : dock.length;
        dock.splice(i < 0 ? dock.length : i, 0, k);
        if (dock.length > 4) { const out = dock.splice(dock.indexOf(k) === 4 ? 3 : 4, 1)[0]; grid.push(out); } // le dock a 4 places : celle qui dépasse remonte
      } else {
        const i = grid.indexOf(t.dataset.k); grid.splice(i < 0 ? grid.length : i + (wasDock ? 0 : (gridList().indexOf(k) < gridList().indexOf(t.dataset.k) ? 1 : 0)), 0, k);
      }
      writeL(ordKey(), grid); writeL(dockKey(), dock);
      try { navigator.vibrate?.(8); } catch (er) {}
      home();
      screen.querySelector(`.ph-appicon[data-k="${k}"]`)?.classList.add('dragging');
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); ghost.remove(); drag = null; home(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  // 🎨 une icône d'appli : la vraie icône dessinée (comme sur iOS) quand elle existe, sinon l'émoji
  function icoEl(k, cls = '', ...kids) {
    const a = APPS[k], real = window.PhoneIcons?.has(k);
    return el('span', { class: 'ph-ico' + (real ? ' real' : '') + (cls ? ' ' + cls : ''), style: real ? `--c:${a.c};background:${PhoneIcons.bg(k)}` : `--c:${a.c}` }, real ? PhoneIcons.svg(k) : a.icon, ...kids);
  }
  function appIcon(k, small) {
    const a = APPS[k], n = a.badge ? a.badge() : 0;
    let press = 0, long = false;
    // 👆 appui long : les icônes se mettent à trembler et on peut supprimer une appli (comme sur iPhone)
    const b = el('button', { class: 'ph-appicon' + (small ? ' dock' : ''), 'data-k': k, onclick: () => { if (long) { long = false; return; } if (jiggle) return; markRecent(k); a.open(); },
      onpointerdown: e => { if (jiggle && !e.target.closest('.ph-del')) { e.preventDefault(); return startDrag(e, k); } clearTimeout(press); press = setTimeout(() => { long = true; if (!jiggle) { jiggle = true; try { navigator.vibrate?.(30); } catch (e) {} home(); } }, 550); },
      onpointerup: () => clearTimeout(press), onpointerleave: () => clearTimeout(press) },
      icoEl(k, '', n ? el('i', {}, n > 99 ? '99+' : n) : null,
        jiggle && !SYSTEM.includes(k) ? el('b', { class: 'ph-del', onclick: e => { e.stopPropagation(); uninstall(k); home(); toast(`🗑️ « ${a.name} » supprimée (tu peux la retélécharger dans l'App Store)`); } }, '−') : null),
      small ? null : el('small', {}, a.name));
    return b;
  }
  function home() {
    stopCam(); clearTimers(); stack = []; convOpen = null;
    screen.style.background = wallBg(); dark(true);
    const d = new Date();
    hideOverlay();
    const wasApp = !!screen.querySelector('.ph-app');
    screen.replaceChildren(el('div', { class: 'ph-home' + (wasApp ? ' ph-zoom-home' : '') },
      el('div', { class: 'ph-clock' }, el('b', {}, time()), el('small', {}, d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))),
      jiggle ? null : widgets(),
      jiggle ? el('div', { class: 'ph-jhint' }, el('span', {}, '✋ Fais glisser une appli pour la déplacer'), el('button', { class: 'ph-done', onclick: () => { jiggle = false; home(); } }, 'OK')) : null,
      (() => { // 📄 plusieurs pages d'applis, qu'on fait défiler sur le côté (avec les petits points)
        const per = +opt('cols', '4') * (opt('cols', '4') === '3' ? 4 : 5), list = gridList(), pages = [];
        for (let i = 0; i < Math.max(1, list.length); i += per) pages.push(list.slice(i, i + per));
        const dots = el('div', { class: 'ph-dots' + (pages.length < 2 ? ' hidden' : '') }, ...pages.map((_, i) => el('i', { class: i === homePage ? 'on' : '' })));
        const wrap = el('div', { class: 'ph-pages', onscroll: e => { const i = Math.round(e.target.scrollLeft / e.target.clientWidth); if (i !== homePage) { homePage = i; dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i)); } } },
          ...pages.map(p => el('div', { class: 'ph-grid' + (jiggle ? ' jiggle' : '') }, ...p.map(k => appIcon(k)))), jiggle ? null : appLibrary());
        if (!jiggle) dots.append(el('i', { class: 'lib' + (homePage === pages.length ? ' on' : '') }));
        homePage = Math.min(homePage, pages.length - 1); setTimeout(() => { wrap.scrollLeft = homePage * wrap.clientWidth; }, 0);
        return el('div', { class: 'ph-pagewrap' }, wrap, dots);
      })(),
      jiggle ? null : el('button', { class: 'ph-search', onclick: spotlight }, '🔍 Rechercher'),
      el('div', { class: 'ph-dock' + (jiggle ? ' jiggle' : '') }, ...dockList().map(k => appIcon(k, true)))));
  }
  async function refreshBadges() {
    try { const d = await api('/api/phone/badge'); snapsUnread = d.snaps; } catch (e) {}
    pmUnread = [...(state.convs?.values?.() || [])].reduce((s, c) => s + (c.unread || 0), 0);
    const n = snapsUnread + pmUnread;
    for (const b of [$('phoneBtn'), document.querySelector('.isl-phone')]) { const c = b?.querySelector('.notif-count'); if (c) { c.textContent = n; c.classList.toggle('hidden', !n); } }
    if (isOpen() && !stack.length && screen.querySelector('.ph-home') && !jiggle) home(); // seulement si l'accueil est déjà affiché
  }

  // ---------- 💬 Messages ----------
  async function messages(body) {
    body.replaceChildren(el('div', { class: 'ph-wait' }, 'Chargement…'));
    let d; try { d = await api('/api/pm'); } catch (e) { return body.replaceChildren(el('div', { class: 'ph-wait' }, e.message)); }
    const list = d.conversations || [];
    body.replaceChildren(
      el('button', { class: 'ph-new', onclick: () => pickFriend('Nouveau message', u => go(b => conversation(b, u), u.username)) }, '✏️ Nouveau message'),
      ...(list.length ? list.map(c => el('button', { class: 'ph-row', onclick: () => go(b => conversation(b, c.user), c.user.username, [el('button', { class: 'ph-mini', onclick: () => Call.start(c.user, false) }, '📞'), el('button', { class: 'ph-mini', onclick: () => Call.start(c.user, true) }, '📹')]) },
        avatarOn(c.user, c.online), el('div', { class: 'ph-row-txt' }, el('b', {}, c.user.username), el('small', {}, c.last?.content || '')),
        el('div', { class: 'ph-row-end' }, el('small', {}, c.last ? ago(c.last.created_at) : ''), c.unread ? el('i', { class: 'ph-dot' }, c.unread) : null)))
        : [el('div', { class: 'ph-wait' }, 'Pas encore de messages 💬')]));
  }
  async function conversation(body, u) {
    convOpen = u.id;
    const list = el('div', { class: 'ph-bubbles' });
    const input = el('input', { class: 'ph-input', placeholder: 'Message…', maxlength: 1000 });
    const file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { const url = await upload(f); socket.emit('pm', { to: u.id, image: { url }, text: '' }, r => r?.error && toast(r.error)); } catch (e) { toast(e.message); } } });
    const sendIt = () => { const t = input.value.trim(); if (!t) return; input.value = ''; socket.emit('pm', { to: u.id, text: t }, r => r?.error && toast(r.error)); };
    body.classList.add('ph-chat');
    body.replaceChildren(list, el('div', { class: 'ph-compose' }, el('button', { class: 'ph-mini', onclick: () => file.click() }, '🖼️'), el('button', { class: 'ph-mini ph-wizz', title: 'Envoyer un wizz (son écran tremble)', onclick: () => window.sendWizz?.(u) }, '📳'), file, input, el('button', { class: 'ph-send', onclick: sendIt }, '➤')));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendIt(); } });
    try { const d = await api('/api/pm/' + u.id); list.replaceChildren(...d.messages.map(bubble)); list.scrollTop = list.scrollHeight; } catch (e) {}
    const c = state.convs?.get(u.id); if (c) c.unread = 0; socket.emit('pm_read', u.id); refreshBadges();
  }
  const bubble = m => el('div', { class: 'ph-bub ' + (m.from === state.me.id ? 'me' : 'them') },
    m.kind === 'image' ? el('img', { src: m.media, alt: '', onclick: () => window.open(m.media, '_blank') }) : m.kind === 'audio' ? el('audio', { src: m.media, controls: true }) : null,
    m.kind !== 'audio' && !(m.kind === 'image' && m.content === '🖼️ Photo') ? el('span', {}, m.content) : null, el('small', {}, LC.when(m.createdAt)));
  socket.on('pm', m => {
    if (isOpen() && convOpen && (m.from === convOpen || m.to === convOpen)) { const l = root.querySelector('.ph-bubbles'); if (l) { l.append(bubble(m)); l.scrollTop = l.scrollHeight; } if (m.from === convOpen) socket.emit('pm_read', convOpen); }
    else if (m.from !== state.me?.id) { setTimeout(refreshBadges, 300); if (isOpen()) ping(`💬 ${m.fromUser?.username || 'Message'} : ${m.content}`, () => go(b => conversation(b, m.fromUser), m.fromUser.username)); }
  });

  // ---------- 📞 Téléphone ----------
  const recents = () => { try { return JSON.parse(localStorage.getItem('ph_calls_' + state.me.id) || '[]'); } catch (e) { return []; } };
  function logCall(u, video, way) { const l = recents(); l.unshift({ id: u.id, username: u.username, avatar: u.avatar || '', color: u.color, gender: u.gender, video, way, at: Date.now() }); try { localStorage.setItem('ph_calls_' + state.me.id, JSON.stringify(l.slice(0, 40))); } catch (e) {} }
  function calls(body, tab = 'contacts') {
    const f = friends().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
    const others = (state.online || []).filter(o => o.id !== state.me.id && !f.some(x => x.id === o.id) && !o.ghost);
    const row = (u, online, extra) => el('div', { class: 'ph-row' }, avatarOn(u, online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username), el('small', {}, extra || (online ? '🟢 En ligne' : '⚪ Hors ligne'))),
      el('button', { class: 'ph-call a', disabled: !online, onclick: () => Call.start(u, false) }, '📞'), el('button', { class: 'ph-call v', disabled: !online, onclick: () => Call.start(u, true) }, '📹'));
    body.replaceChildren(
      el('div', { class: 'ph-tabs' }, ...[['contacts', '👥 Amis'], ['online', '🟢 En ligne'], ['recent', '🕘 Récents']].map(([k, l]) => el('button', { class: tab === k ? 'on' : '', onclick: () => calls(body, k) }, l))),
      ...(tab === 'contacts' ? (f.length ? f.map(u => row(u, u.online)) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis pour les appeler 🤝')])
        : tab === 'online' ? (others.length ? others.map(u => row(u, true)) : [el('div', { class: 'ph-wait' }, 'Personne d\'autre en ligne')])
          : (recents().length ? recents().map(c => row(c, (state.online || []).some(o => o.id === c.id), `${c.way === 'in' ? '↙️ Reçu' : '↗️ Passé'} ${c.video ? '📹' : '📞'} · ${ago(c.at)}`)) : [el('div', { class: 'ph-wait' }, 'Aucun appel pour l\'instant')])));
  }
  // les appels passés et reçus vont dans « Récents »
  if (window.Call) {
    const start = Call.start.bind(Call); Call.start = (u, video) => { logCall(u, video, 'out'); if (isOpen()) close(); return start(u, video); };
    socket.on('call_incoming', d => { if (d?.from) logCall(d.from, !!d.video, 'in'); if (isOpen()) close(); });
  }

  // ---------- 👥 Contacts ----------
  function contacts(body) {
    const f = friends();
    body.replaceChildren(...(f.length ? f.map(u => el('div', { class: 'ph-row' }, avatarOn(u, u.online),
      el('div', { class: 'ph-row-txt', onclick: () => { close(); openProfile(u.id); } }, el('b', {}, u.username), el('small', {}, [u.age ? u.age + ' ans' : '', u.city].filter(Boolean).join(' · ') || 'Mon ami')),
      el('button', { class: 'ph-mini', title: 'Message', onclick: () => go(b => conversation(b, u), u.username) }, '💬'),
      el('button', { class: 'ph-mini', title: 'Snap', onclick: () => go(b => camera(b, [u.id]), '') }, '👻'),
      el('button', { class: 'ph-mini', title: 'Appeler', disabled: !u.online, onclick: () => Call.start(u, false) }, '📞')))
      : [el('div', { class: 'ph-wait' }, 'Tu n\'as pas encore d\'amis : ajoute-en depuis leur profil 🤝')]));
  }

  // ---------- 👻 Snap ----------
  async function snapHome(body) {
    body.classList.add('ph-snap');
    body.replaceChildren(el('div', { class: 'ph-wait' }, 'Chargement…'));
    let people = [], stories = [];
    try { [people, stories] = await Promise.all([api('/api/phone/snaps').then(d => d.people), api('/api/phone/stories').then(d => d.stories)]); } catch (e) { return body.replaceChildren(el('div', { class: 'ph-wait' }, e.message)); }
    const mineStory = stories.find(s => s.user.id === state.me.id);
    body.replaceChildren(
      el('div', { class: 'ph-stories' },
        el('button', { class: 'ph-story me', onclick: () => (mineStory ? viewStories([mineStory], 0) : go(b => camera(b, [], true), '')) }, el('span', { class: 'ph-st-ring' + (mineStory ? '' : ' add') }, LC.avatar(state.me)), el('small', {}, mineStory ? 'Ma story' : '＋ Ma story')),
        ...stories.filter(s => s.user.id !== state.me.id).map((s, i, all) => el('button', { class: 'ph-story', onclick: () => viewStories(all, i) }, el('span', { class: 'ph-st-ring' + (s.items.every(x => x.seen) ? ' seen' : '') }, LC.avatar(s.user)), el('small', {}, s.user.username)))),
      ...(people.length ? people.map(p => {
        const status = p.unread.length ? el('span', { class: 'ph-snap-st new' }, '🟥 Nouveau snap · touche pour voir') : p.sentAt ? el('span', { class: 'ph-snap-st' }, p.sentOpened ? `👀 Ouvert · ${ago(p.sentAt)}` : `📤 Envoyé · ${ago(p.sentAt)}`) : el('span', { class: 'ph-snap-st' }, 'Touche 📷 pour lui envoyer un snap');
        return el('div', { class: 'ph-row' + (p.unread.length ? ' unread' : '') }, LC.avatar(p.user),
          el('div', { class: 'ph-row-txt', onclick: () => (p.unread.length ? viewSnaps(p.unread) : go(b => camera(b, [p.user.id]), '')) }, el('b', {}, p.user.username, p.streak ? el('span', { class: 'ph-flame' }, ` 🔥${p.streak}`) : null), status),
          el('button', { class: 'ph-mini', onclick: () => go(b => camera(b, [p.user.id]), '') }, '📷'));
      }) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis pour vous envoyer des snaps 👻')]),
      el('small', { class: 'ph-hint' }, '🔥 Envoyez-vous un snap chaque jour pour garder votre flamme !'),
      el('button', { class: 'ph-shutter-big', onclick: () => go(camera, '') }, '📷'));
  }
  // Ouvrir les snaps reçus, l'un après l'autre, avec le compte à rebours
  async function viewSnaps(ids) {
    const id = ids.shift(); if (!id) return go(snapHome, '👻 Snap');
    let s; try { s = await api(`/api/phone/snaps/${id}/open`, { method: 'POST' }); } catch (e) { toast(e.message); return go(snapHome, '👻 Snap'); }
    clearTimers(); stack.push({ fn: snapHome, title: '👻 Snap' });
    const ring = el('span', { class: 'ph-count' }, s.seconds || '∞');
    const view = el('div', { class: 'ph-viewer', onclick: () => viewSnaps(ids) },
      el('img', { src: s.media, alt: '' }), s.caption ? el('div', { class: 'ph-caption' }, s.caption) : null,
      el('div', { class: 'ph-v-top' }, LC.avatar(s.from), el('b', {}, s.from.username), el('small', {}, ago(s.createdAt)), ring),
      el('small', { class: 'ph-v-tap' }, 'Touche pour passer · ce snap va disparaître 👻'));
    screen.style.background = '#000'; dark(true); screen.replaceChildren(view);
    if (s.seconds) { let left = s.seconds; const tick = () => { left--; ring.textContent = left; if (left <= 0) return viewSnaps(ids); timers.push(setTimeout(tick, 1000)); }; timers.push(setTimeout(tick, 1000)); }
    snapsUnread = Math.max(0, snapsUnread - 1); refreshBadges();
  }
  function viewStories(groups, gi, ii = 0) {
    const g = groups[gi]; if (!g) return go(snapHome, '👻 Snap');
    const it = g.items[ii]; if (!it) return viewStories(groups, gi + 1, 0);
    clearTimers(); stack.push({ fn: snapHome, title: '👻 Snap' });
    if (g.user.id !== state.me.id) api(`/api/phone/stories/${it.id}/view`, { method: 'POST' }).catch(() => {});
    const view = el('div', { class: 'ph-viewer story' },
      el('div', { class: 'ph-bars' }, ...g.items.map((x, k) => el('i', { class: k < ii ? 'done' : k === ii ? 'run' : '' }))),
      el('img', { src: it.media, alt: '' }), it.caption ? el('div', { class: 'ph-caption' }, it.caption) : null,
      el('div', { class: 'ph-v-top' }, LC.avatar(g.user), el('b', {}, g.user.username), el('small', {}, ago(it.createdAt))),
      g.user.id === state.me.id ? el('div', { class: 'ph-v-own' }, el('span', {}, `👀 ${it.views || 0} vue${it.views > 1 ? 's' : ''}`), el('button', { class: 'ph-mini', onclick: async e => { e.stopPropagation(); if (!confirm('Supprimer cette story ?')) return; await api('/api/phone/stories/' + it.id, { method: 'DELETE' }).catch(() => {}); go(snapHome, '👻 Snap'); } }, '🗑️'), el('button', { class: 'ph-mini', onclick: e => { e.stopPropagation(); go(b => camera(b, [], true), ''); } }, '＋')) : null);
    view.onclick = e => { const r = view.getBoundingClientRect(); if (e.clientX - r.left < r.width / 3) viewStories(groups, ii ? gi : Math.max(0, gi - 1), ii ? ii - 1 : 0); else viewStories(groups, gi, ii + 1); };
    screen.style.background = '#000'; dark(true); screen.replaceChildren(view);
    timers.push(setTimeout(() => viewStories(groups, gi, ii + 1), 5000));
  }

  // ---------- 📷 L'appareil photo ----------
  function stopCam() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
  async function camera(body, preselect = [], story = false) {
    screen.style.background = '#000';
    body.classList.add('ph-cam');
    const video = el('video', { autoplay: true, playsinline: true, muted: true });
    const file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => { const f = file.files[0]; file.value = ''; if (f) edit(body, await blobToCanvas(f), preselect, story); } });
    let facing = 'user';
    const start = async () => { stopCam(); try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false }); video.srcObject = camStream; video.classList.toggle('mirror', facing === 'user'); } catch (e) { body.querySelector('.ph-cam-msg').textContent = '📷 La caméra n\'est pas disponible : choisis une photo dans ta galerie 🖼️'; } };
    body.replaceChildren(video, el('div', { class: 'ph-cam-msg' }),
      el('div', { class: 'ph-cam-top' }, el('button', { class: 'ph-round', onclick: back }, '✕'), el('button', { class: 'ph-round', onclick: () => { facing = facing === 'user' ? 'environment' : 'user'; start(); } }, '🔄')),
      el('div', { class: 'ph-cam-bottom' }, el('button', { class: 'ph-round', onclick: () => file.click() }, '🖼️'),
        el('button', { class: 'ph-shutter', onclick: () => { if (!camStream) return file.click(); const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; const g = c.getContext('2d'); if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(video, 0, 0); flash(); stopCam(); edit(body, c, preselect, story); } }),
        el('span', { style: 'width:46px' })), file);
    start();
  }
  const flash = () => { const f = el('div', { class: 'ph-flash' }); screen.append(f); setTimeout(() => f.remove(), 300); };
  async function blobToCanvas(f) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible')); i.src = URL.createObjectURL(f); });
    const k = Math.min(1, 1440 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  }
  // Après la photo : texte, filtres, minuteur, puis on choisit à qui l'envoyer
  function edit(body, canvas, preselect, story) {
    let filter = 'none', seconds = 5;
    const FILTERS = [['none', 'Normal'], ['saturate(1.6) contrast(1.1)', 'Vif'], ['grayscale(1)', 'N&B'], ['sepia(.8)', 'Vintage'], ['hue-rotate(290deg) saturate(1.5)', 'Néon'], ['brightness(1.15) saturate(1.3) hue-rotate(-15deg)', 'Soleil']];
    const img = el('img', { src: canvas.toDataURL('image/jpeg', .9), alt: '' });
    const cap = el('input', { class: 'ph-cap-in', placeholder: 'Écris quelque chose…', maxlength: 120 });
    const fbar = el('div', { class: 'ph-filters' }, ...FILTERS.map(([f, n]) => el('button', { class: f === filter ? 'on' : '', onclick: e => { filter = f; img.style.filter = f; fbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
    const tbar = el('div', { class: 'ph-timer' }, ...[[3, '3 s'], [5, '5 s'], [10, '10 s'], [0, '∞']].map(([v, l]) => el('button', { class: v === seconds ? 'on' : '', onclick: e => { seconds = v; tbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); } }, '⏱ ' + l)));
    body.replaceChildren(el('div', { class: 'ph-edit' }, img, cap,
      el('div', { class: 'ph-cam-top' }, el('button', { class: 'ph-round', onclick: () => camera(body, preselect, story) }, '✕'), el('button', { class: 'ph-round', title: 'Enregistrer sur mon appareil', onclick: () => { const a = el('a', { href: render(canvas, filter, cap.value), download: 'the-paradise.jpg' }); a.click(); } }, '⬇️')),
      el('div', { class: 'ph-edit-bottom' }, fbar, tbar, el('button', { class: 'ph-sendto', onclick: () => sendTo(canvas, filter, cap.value, seconds, preselect, story) }, 'Envoyer à ➤'))));
    cap.focus();
  }
  // la photo finale (filtre et texte dessinés dedans)
  function render(canvas, filter, caption) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d');
    g.filter = filter; g.drawImage(canvas, 0, 0); g.filter = 'none';
    if (caption) { const h = Math.round(c.height * .07); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, c.height * .62, c.width, h * 1.5); g.fillStyle = '#fff'; g.font = `700 ${h * .8}px Outfit, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(caption, c.width / 2, c.height * .62 + h * .75, c.width * .94); }
    return c.toDataURL('image/jpeg', .86);
  }
  function sendTo(canvas, filter, caption, seconds, preselect, story) {
    const chosen = new Set(preselect), f = friends();
    let toStory = story;
    const list = el('div', { class: 'ph-pick' });
    const draw = () => list.replaceChildren(
      el('button', { class: 'ph-row' + (toStory ? ' on' : ''), onclick: () => { toStory = !toStory; draw(); } }, el('span', { class: 'ph-st-ring' }, LC.avatar(state.me)), el('div', { class: 'ph-row-txt' }, el('b', {}, '📖 Ma story'), el('small', {}, 'Tous tes amis pendant 24 h')), el('span', { class: 'ph-check' }, toStory ? '✅' : '⬜')),
      ...f.map(u => el('button', { class: 'ph-row' + (chosen.has(u.id) ? ' on' : ''), onclick: () => { chosen.has(u.id) ? chosen.delete(u.id) : chosen.add(u.id); draw(); } }, avatarOn(u, u.online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username), el('small', {}, u.online ? '🟢 En ligne' : '')), el('span', { class: 'ph-check' }, chosen.has(u.id) ? '✅' : '⬜'))),
      f.length ? null : el('div', { class: 'ph-wait' }, 'Ajoute des amis pour leur envoyer des snaps 🤝'));
    draw();
    go(body => body.replaceChildren(list, el('button', { class: 'ph-sendto big', onclick: async e => {
      if (!chosen.size && !toStory) return toast('Choisis au moins un ami ou ta story');
      e.target.disabled = true; e.target.textContent = 'Envoi…';
      try {
        const blob = await (await fetch(render(canvas, filter, caption))).blob();
        const url = await upload(blob);
        if (chosen.size) { const r = await api('/api/phone/snaps', { method: 'POST', body: { to: [...chosen], url, caption: '', seconds } }); toast(`👻 Snap envoyé à ${r.sent} ami${r.sent > 1 ? 's' : ''} !`); }
        if (toStory) { const u2 = chosen.size ? await upload(blob) : url; await api('/api/phone/stories', { method: 'POST', body: { url: u2, caption: '' } }); toast('📖 Ta story est publiée pour 24 h !'); }
        LC.confetti(['👻', '📸', '✨']); go(snapHome, '👻 Snap');
      } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Envoyer ➤'; }
    } }, 'Envoyer ➤')), 'Envoyer à…');
  }
  async function upload(blobOrFile) {
    const b = blobOrFile instanceof Blob && !(blobOrFile instanceof File) ? blobOrFile : await shrinkPhoto(blobOrFile);
    const r = await fetch('/api/media', { method: 'POST', body: b, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Envoi impossible'); return d.url;
  }
  socket.on('snap_new', d => { snapsUnread++; refreshBadges(); if (isOpen()) ping(`👻 ${d.from.username} t'a envoyé un snap`, () => go(snapHome, '👻 Snap')); else toast(`👻 ${d.from.username} t'a envoyé un snap · touche ici`, () => open('snap')); });
  socket.on('snap_opened', d => { if (isOpen()) ping(`👀 ${d.username} a ouvert ton snap`); });
  socket.on('story_new', () => { if (isOpen() && stack.at(-1)?.fn === snapHome) go(snapHome, '👻 Snap'); });

  // ---------- ⚙️ Réglages ----------
  // ---------- 🎨 Le look du téléphone (iPhone 18) ----------
  const FRAME_COLORS = { titane: ['Titane naturel', '#b9b2a6'], noir: ['Titane noir', '#2c2c31'], blanc: ['Titane blanc', '#e8e8ea'], desert: ['Titane désert', '#c9a47e'], bleu: ['Bleu nuit', '#34507a'], rose: ['Rose', '#e9a8c3'], neon: ['Néon violet', '#a855f7'], or: ['Or', '#e7c25a'] };
  function applyLook() {
    const d = root?.querySelector('.ph-device'); if (!d) return;
    d.style.setProperty('--frame', (FRAME_COLORS[opt('frame', 'titane')] || FRAME_COLORS.titane)[1]);
    d.dataset.icons = opt('icons', 'arrondi'); d.dataset.cols = opt('cols', '4'); d.dataset.text = opt('text', 'normal'); d.dataset.theme = opt('theme', 'clair');
    d.dataset.size = opt('size', 'm'); d.classList.toggle('eco', opt('eco', '0') === '1'); d.classList.toggle('bold', opt('bold', '0') === '1'); d.classList.toggle('zoomed', opt('zoom', '0') === '1'); d.classList.toggle('hc', opt('hc', '0') === '1');
    const sc = root.querySelector('.ph-screen'); if (sc) sc.style.filter = `brightness(${(+opt('bright', '100')) / 100})${opt('night', '0') === '1' ? ' sepia(.35) saturate(1.2)' : ''}`;
    const ic = root.querySelector('.ph-icons'); if (ic) { ic.querySelector('.ph-plane')?.remove(); ic.querySelector('.ph-pct')?.remove(); if (opt('plane', '0') === '1') ic.prepend(el('span', { class: 'ph-plane' }, '✈️')); if (opt('batpct', '0') === '1') { const p = el('span', { class: 'ph-pct' }, '87'); ic.append(p); (navigator.getBattery ? navigator.getBattery() : Promise.reject()).then(b => { p.textContent = Math.round(b.level * 100); }).catch(() => {}); } ic.querySelector('.ph-sig')?.classList.toggle('hidden', opt('plane', '0') === '1'); }
  }
  // ---------- 🧮 Calculette ----------
  function calculator(body) {
    let expr = '';
    const disp = el('div', { class: 'ph-calc-disp' }, '0');
    const show = () => { disp.textContent = expr || '0'; };
    const press = k => {
      if (k === 'C') expr = ''; else if (k === '⌫') expr = expr.slice(0, -1);
      else if (k === '=') { try { const v = Function('"use strict";return (' + expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/%/g, '/100') + ')')(); expr = Number.isFinite(v) ? String(Math.round(v * 1e8) / 1e8).replace('.', ',') : 'Erreur'; } catch (e) { expr = 'Erreur'; } }
      else { if (expr === 'Erreur') expr = ''; expr += k; }
      show();
    };
    const keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', ',', '='];
    body.replaceChildren(el('div', { class: 'ph-calc' }, disp, el('div', { class: 'ph-calc-keys' }, ...keys.map(k => el('button', { class: 'ph-ck' + (['÷', '×', '-', '+', '='].includes(k) ? ' op' : ['C', '⌫', '%'].includes(k) ? ' fn' : '') + (k === '0' ? ' zero' : ''), onclick: () => press(k) }, k)))));
  }
  // ---------- ⛅ Météo (au Paradise, il fait toujours beau… ou presque) ----------
  function weather(body) {
    const h = new Date().getHours(), night = h < 7 || h >= 20, seed = new Date().getDate();
    const conds = night ? [['🌙', 'Nuit étoilée'], ['✨', 'Ciel dégagé'], ['🌌', 'Aurore boréale']] : [['☀️', 'Grand soleil'], ['🌤️', 'Quelques nuages'], ['🌈', 'Arc-en-ciel'], ['⛅', 'Éclaircies']];
    const [ic, txt] = conds[seed % conds.length], t = 18 + (seed % 9) - (night ? 6 : 0);
    screen.style.background = night ? 'linear-gradient(180deg, #0b1640, #2a1050)' : 'linear-gradient(180deg, #4fb3ff, #2f6fd6 60%, #6a5cff)';
    body.replaceChildren(el('div', { class: 'ph-weather' },
      el('small', {}, '📍 Ville du Paradise'), el('div', { class: 'ph-w-ico' }, ic), el('b', { class: 'ph-w-t' }, t + '°'), el('div', {}, txt), el('small', {}, `Max ${t + 3}° · Min ${t - 5}°`),
      el('div', { class: 'ph-w-hours' }, ...Array.from({ length: 6 }, (_, i) => { const hh = (h + i) % 24, n = hh < 7 || hh >= 20; return el('div', {}, el('small', {}, i ? hh + ' h' : 'Maint.'), el('span', {}, n ? '🌙' : ['☀️', '🌤️', '⛅'][(seed + i) % 3]), el('b', {}, (t + (i % 3) - 1) + '°')); })),
      el('div', { class: 'ph-w-days' }, ...['Demain', 'Après-demain', 'Dans 3 jours'].map((dd, i) => el('div', {}, el('span', {}, dd), el('span', {}, ['☀️', '🌦️', '🌈'][(seed + i) % 3]), el('b', {}, `${t - 2 + i}° / ${t + 4 + i}°`))))));
  }
  // ---------- ⏰ Horloge : heure, chrono et minuteur ----------
  function clockApp(body) {
    let chrono = 0, chronoAt = 0, run = false, tim = 0, timEnd = 0;
    const big = el('div', { class: 'ph-big-time' }), ch = el('div', { class: 'ph-chrono' }, '00:00,0'), tm = el('div', { class: 'ph-chrono' }, '05:00');
    const fmt = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    const tick = () => {
      if (!body.isConnected) return;
      big.textContent = new Date().toLocaleTimeString('fr-FR');
      if (run) ch.textContent = fmt(chrono + Date.now() - chronoAt) + ',' + Math.floor((chrono + Date.now() - chronoAt) % 1000 / 100);
      if (timEnd) { const left = timEnd - Date.now(); tm.textContent = fmt(Math.max(0, left)); if (left <= 0) { timEnd = 0; island('⏰ Le minuteur est terminé !'); try { navigator.vibrate?.([300, 100, 300]); } catch (e) {} toast('⏰ Minuteur terminé !'); } }
      timers.push(setTimeout(tick, 100));
    };
    const btn = (l, fn, cls = '') => el('button', { class: 'ph-pill ' + cls, onclick: fn }, l);
    body.replaceChildren(el('div', { class: 'ph-clockapp' },
      big, el('small', {}, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
      el('h4', { class: 'ph-h' }, '⏱️ Chronomètre'), ch,
      el('div', { class: 'ph-row-btns' }, btn('▶ / ⏸', () => { if (run) { chrono += Date.now() - chronoAt; run = false; } else { chronoAt = Date.now(); run = true; } }, 'go'), btn('↺', () => { run = false; chrono = 0; ch.textContent = '00:00,0'; })),
      el('h4', { class: 'ph-h' }, '⏳ Minuteur'), tm,
      el('div', { class: 'ph-row-btns' }, ...[1, 3, 5, 10].map(m => btn(m + ' min', () => { tim = m; timEnd = Date.now() + m * 60000; })), btn('⏹', () => { timEnd = 0; tm.textContent = '00:00'; }))));
    tick();
  }
  // ---------- 📝 Notes (gardées sur cet appareil) ----------
  function notes(body) {
    let list = []; try { list = JSON.parse(localStorage.getItem('ph_notes') || '[]'); } catch (e) {}
    const saveN = () => { try { localStorage.setItem('ph_notes', JSON.stringify(list.slice(0, 50))); } catch (e) {} };
    const edit = i => go(b => { const ta = el('textarea', { class: 'ph-note-ta', placeholder: 'Écris ta note…' }, list[i]?.t || ''); ta.oninput = () => { list[i] = { t: ta.value, at: Date.now() }; saveN(); }; b.replaceChildren(ta); setTimeout(() => ta.focus(), 50); }, '📝 Note');
    body.replaceChildren(
      el('button', { class: 'ph-new', onclick: () => { list.unshift({ t: '', at: Date.now() }); saveN(); edit(0); } }, '✏️ Nouvelle note'),
      ...(list.filter(n => n.t.trim()).length ? list.map((n, i) => n.t.trim() ? el('div', { class: 'ph-row', onclick: () => edit(i) }, el('div', { class: 'ph-row-txt' }, el('b', {}, n.t.split('\n')[0].slice(0, 40)), el('small', {}, ago(n.at))), el('button', { class: 'ph-mini', onclick: e => { e.stopPropagation(); list.splice(i, 1); saveN(); notes(body); } }, '🗑')) : null) : [el('div', { class: 'ph-wait' }, 'Aucune note pour l\'instant ✍️')]));
  }
  // ---------- 📅 Calendrier (avec les soirées du Paradise et les anniversaires) ----------
  async function calendar(body) {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const marks = {};
    try { const ev = window.EventState?.next || window.EventState?.live; if (ev?.at) { const d = new Date(ev.at); if (d.getMonth() === m) marks[d.getDate()] = (ev.icon || '🎉') + ' ' + (ev.title || 'Soirée'); } } catch (e) {}
    if (state.me.birthMonth === m + 1 && state.me.birthDay) marks[state.me.birthDay] = '🎂 Mon anniversaire';
    const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    body.replaceChildren(el('div', { class: 'ph-cal' },
      el('b', { class: 'ph-cal-m' }, now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })),
      el('div', { class: 'ph-cal-grid' }, ...['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => el('small', {}, d)), ...cells.map(d => el('span', { class: (d === now.getDate() ? 'today' : '') + (marks[d] ? ' mark' : ''), title: marks[d] || '' }, d || ''))),
      ...Object.entries(marks).map(([d, t]) => el('div', { class: 'ph-row' }, el('div', { class: 'ph-row-txt' }, el('b', {}, t), el('small', {}, `${d} ${now.toLocaleDateString('fr-FR', { month: 'long' })}`))))));
  }
  // ---------- 🔦 Lampe torche ----------
  function torch(body) {
    let on = true;
    const t = el('div', { class: 'ph-torch on', onclick: () => { on = !on; t.classList.toggle('on', on); screen.style.background = on ? '#fffbe8' : '#000'; } }, el('span', {}, '🔦'), el('small', {}, 'Touche pour allumer / éteindre'));
    screen.style.background = '#fffbe8'; body.replaceChildren(t);
  }

  // =================== 🅰️ L'App Store ===================
  const stars = r => '★★★★★'.slice(0, Math.round(r)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r));
  const fakeCount = k => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 9000; return (h + 800).toLocaleString('fr-FR'); };
  function getBtn(k, onDone) {
    if (isInst(k)) return el('button', { class: 'as-get open', onclick: e => { e.stopPropagation(); APPS[k].open(); } }, 'OUVRIR');
    const b = el('button', { class: 'as-get', onclick: e => {
      e.stopPropagation(); if (b.classList.contains('loading')) return;
      b.classList.add('loading'); b.replaceChildren(el('i', { class: 'as-ring' }));
      setTimeout(() => { install(k); try { navigator.vibrate?.(20); } catch (er) {} island(`📲 « ${APPS[k].name} » est installée !`); b.classList.remove('loading'); b.classList.add('open'); b.textContent = 'OUVRIR'; b.onclick = ev => { ev.stopPropagation(); APPS[k].open(); }; onDone && onDone(); }, 1600);
    } }, 'OBTENIR');
    return b;
  }
  const storeRow = k => { const [n, cat, desc, r] = STORE[k], a = APPS[k]; return el('div', { class: 'as-row', onclick: () => go(b => appPage(b, k), '') }, icoEl(k, 'as-ico'), el('div', { class: 'as-txt' }, el('b', {}, n), el('small', {}, desc), el('em', {}, `${stars(r)} ${r.toFixed(1)} · ${cat}`)), getBtn(k)); };
  let asTab = 'today', asQuery = '';
  function appStore(body) {
    screen.style.background = '';
    const tabs = [['today', '📰', 'Aujourd\'hui'], ['games', '🎮', 'Jeux'], ['apps', '📚', 'Apps'], ['search', '🔍', 'Recherche']];
    const keys = Object.keys(STORE);
    let content;
    if (asTab === 'today') {
      const day = new Date().getDate(), star = FEATURED[day % FEATURED.length], a = APPS[star];
      content = [el('div', { class: 'as-date' }, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })), el('h2', { class: 'as-h' }, 'Aujourd\'hui'),
        el('div', { class: 'as-hero', style: `--c:${a.c}`, onclick: () => go(b => appPage(b, star), '') }, el('small', {}, '⭐ L\'APP DU JOUR'), el('b', {}, STORE[star][0]), el('span', {}, STORE[star][2]), el('div', { class: 'as-hero-ico' }, a.icon)),
        el('h3', { class: 'as-h3' }, '🔥 Les plus téléchargées'), ...keys.slice().sort((x, y) => STORE[y][3] - STORE[x][3]).slice(0, 6).map(storeRow)];
    } else if (asTab === 'search') {
      const inp = el('input', { class: 'ph-input', placeholder: '🔍 Jeux, applis…', value: asQuery, oninput: e => { asQuery = e.target.value; list.replaceChildren(...found()); } });
      const found = () => keys.filter(k => (STORE[k][0] + ' ' + STORE[k][1] + ' ' + STORE[k][2]).toLowerCase().includes(asQuery.toLowerCase())).map(storeRow);
      const list = el('div', {}, ...found());
      content = [el('h2', { class: 'as-h' }, 'Recherche'), inp, list]; setTimeout(() => inp.focus(), 50);
    } else {
      const games = asTab === 'games', sel = keys.filter(k => (STORE[k][1] === 'Jeux') === games);
      content = [el('h2', { class: 'as-h' }, games ? 'Jeux' : 'Apps'), ...sel.map(storeRow)];
    }
    body.replaceChildren(el('div', { class: 'as' }, el('div', { class: 'as-body' }, ...content),
      el('div', { class: 'as-tabs' }, ...tabs.map(([t, i, l]) => el('button', { class: asTab === t ? 'on' : '', onclick: () => { asTab = t; appStore(body); } }, el('span', {}, i), l)))));
  }
  function appPage(body, k) {
    const [n, cat, desc, r] = STORE[k], a = APPS[k];
    const draw = () => body.replaceChildren(el('div', { class: 'as as-page' },
      el('div', { class: 'as-top' }, icoEl(k, 'as-big'), el('div', {}, el('b', {}, n), el('small', {}, `The Paradise · ${cat}`), getBtn(k, draw))),
      el('div', { class: 'as-stats' }, el('div', {}, el('b', {}, r.toFixed(1)), el('small', {}, stars(r))), el('div', {}, el('b', {}, fakeCount(k)), el('small', {}, 'notes')), el('div', {}, el('b', {}, '4+'), el('small', {}, 'âge')), el('div', {}, el('b', {}, 'Gratuit'), el('small', {}, 'prix'))),
      el('div', { class: 'as-shot', style: `--c:${a.c}` }, el('span', {}, a.icon), el('small', {}, desc)),
      el('h3', { class: 'as-h3' }, 'Description'), el('p', { class: 'as-desc' }, `${desc}. Une appli de ton téléphone Paradise, gratuite et sans pub 😉`),
      isInst(k) && !SYSTEM.includes(k) ? el('button', { class: 'as-del', onclick: () => { uninstall(k); draw(); toast(`🗑️ « ${a.name} » supprimée`); } }, '🗑️ Supprimer l\'app') : null));
    draw();
  }

  // =================== 🎨 Dessin ===================
  function paint(body) {
    const cv = el('canvas', { class: 'ph-paint', width: 640, height: 860 }), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 860); g.lineCap = g.lineJoin = 'round';
    let color = '#ff2d55', size = 10, last = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 860]; };
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); last = pos(e); g.fillStyle = color; g.beginPath(); g.arc(last[0], last[1], size / 2, 0, 7); g.fill(); };
    cv.onpointermove = e => { if (!last) return; const p = pos(e); g.strokeStyle = color; g.lineWidth = size; g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; };
    cv.onpointerup = () => { last = null; };
    const COLS = ['#111111', '#ff2d55', '#ff9500', '#ffd34d', '#2bd07a', '#2fa8ff', '#8b5cf6', '#ff5fa2', '#8a5a2b', '#ffffff'];
    const bar = el('div', { class: 'ph-pbar' }, ...COLS.map(c => el('button', { class: 'ph-pc' + (c === color ? ' on' : ''), style: `background:${c}`, onclick: e => { color = c; bar.querySelectorAll('.ph-pc').forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
    const sz = el('input', { type: 'range', min: 3, max: 40, value: size, oninput: e => { size = +e.target.value; } });
    const send = async () => {
      pickFriend('Envoyer mon dessin à…', async u => {
        try { const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .9)); const url = await upload(blob); socket.emit('pm', { to: u.id, image: { url }, text: '🎨 Mon dessin' }, r => r?.error ? toast(r.error) : toast(`🎨 Dessin envoyé à ${u.username} !`)); back(); } catch (e) { toast(e.message); }
      });
    };
    body.replaceChildren(el('div', { class: 'ph-paintapp' }, cv, bar, el('div', { class: 'ph-row-btns' }, el('span', {}, '✏️'), sz, el('button', { class: 'ph-pill', onclick: () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 860); } }, '🧽 Effacer'), el('button', { class: 'ph-pill go', onclick: send }, '📤 Envoyer'))));
  }
  // =================== 🎲 Hasard ===================
  function dice(body) {
    const out = el('div', { class: 'ph-dice-out' }, '🎲');
    const roll = (fn, spins = 10) => { let i = 0; const iv = setInterval(() => { out.textContent = fn(); out.classList.toggle('spin'); if (++i >= spins) clearInterval(iv); }, 80); };
    const face = () => '⚀⚁⚂⚃⚄⚅'[Math.floor(Math.random() * 6)];
    const choices = el('input', { class: 'ph-input', placeholder: 'Pizza, Sushi, Burger… (séparés par des virgules)' });
    body.replaceChildren(el('div', { class: 'ph-dice' }, out,
      el('div', { class: 'ph-row-btns' }, el('button', { class: 'ph-pill go', onclick: () => roll(face) }, '🎲 Lancer le dé'), el('button', { class: 'ph-pill', onclick: () => roll(() => Math.random() < .5 ? '🪙 Pile' : '🪙 Face') }, '🪙 Pile ou face'), el('button', { class: 'ph-pill', onclick: () => roll(() => String(1 + Math.floor(Math.random() * 100))) }, '🔢 1 à 100')),
      el('h4', { class: 'ph-h' }, '🎡 La roue de la décision'), choices,
      el('button', { class: 'ph-pill go', style: 'margin-top:8px', onclick: () => { const l = choices.value.split(',').map(x => x.trim()).filter(Boolean); if (l.length < 2) return toast('Écris au moins 2 choix'); roll(() => l[Math.floor(Math.random() * l.length)], 16); } }, '🎡 Faire tourner')));
  }
  // =================== 🌐 Traduction ===================
  function translateApp(body) {
    const langs = window.Translator?.LANGS || [['en', '🇬🇧 English'], ['fr', '🇫🇷 Français']];
    const sel = el('select', { class: 'ph-input' }, ...langs.map(([v, l]) => el('option', { value: v, selected: v === 'en' }, l)));
    const inp = el('textarea', { class: 'ph-input', rows: 4, placeholder: 'Écris ici…' });
    const out = el('div', { class: 'ph-tr-out' });
    const go2 = async () => { if (!inp.value.trim()) return; out.textContent = '…'; try { const r = await api('/api/translate', { method: 'POST', body: { text: inp.value, to: sel.value } }); out.textContent = r.text; } catch (e) { out.textContent = e.message; } };
    body.replaceChildren(el('div', { class: 'ph-tr' }, inp, el('div', { class: 'ph-row-btns' }, el('span', {}, '➡️'), sel, el('button', { class: 'ph-pill go', onclick: go2 }, 'Traduire')), out,
      el('button', { class: 'ph-pill', onclick: () => { if (!out.textContent || !('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance(out.textContent); u.lang = sel.value; speechSynthesis.speak(u); } }, '🔊 Écouter')));
  }
  // =================== 🔢 2048 ===================
  function game2048(body) {
    let b = Array(16).fill(0), score = 0, best = +(opt('best2048', '0')), over = false;
    const add = () => { const e = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) b[e[Math.floor(Math.random() * e.length)]] = Math.random() < .9 ? 2 : 4; };
    const line = l => { l = l.filter(Boolean); for (let i = 0; i < l.length - 1; i++) if (l[i] === l[i + 1]) { l[i] *= 2; score += l[i]; l.splice(i + 1, 1); } while (l.length < 4) l.push(0); return l; };
    const move = dir => {
      if (over) return; const old = b.join();
      for (let k = 0; k < 4; k++) {
        const idx = [0, 1, 2, 3].map(j => dir === 'l' ? k * 4 + j : dir === 'r' ? k * 4 + 3 - j : dir === 'u' ? j * 4 + k : (3 - j) * 4 + k);
        line(idx.map(i => b[i])).forEach((v, j) => { b[idx[j]] = v; });
      }
      if (b.join() !== old) add();
      if (!b.includes(0) && ![0, 1, 2, 3].some(r => [0, 1, 2].some(c => b[r * 4 + c] === b[r * 4 + c + 1] || b[c * 4 + r] === b[(c + 1) * 4 + r]))) over = true;
      if (score > best) { best = score; setOpt('best2048', String(best)); }
      draw();
    };
    const grid = el('div', { class: 'g48' }), info = el('div', { class: 'g48-info' });
    const draw = () => { info.replaceChildren(el('span', {}, `Score ${score}`), el('span', {}, `🏆 ${best}`)); grid.replaceChildren(...b.map(v => el('div', { class: 'g48-c v' + v }, v || ''))); if (over) grid.append(el('div', { class: 'g48-over' }, 'Perdu ! 😅', el('button', { class: 'ph-pill go', onclick: () => game2048(body) }, '🔁 Rejouer'))); };
    let sx = 0, sy = 0;
    grid.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    grid.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); });
    const key = e => { if (!body.isConnected) return document.removeEventListener('keydown', key); const m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }[e.key]; if (m) { e.preventDefault(); move(m); } };
    document.addEventListener('keydown', key);
    add(); add(); draw();
    body.replaceChildren(el('div', { class: 'g48-app' }, info, grid, el('small', { class: 'ph-wait' }, 'Glisse ton doigt (ou les flèches du clavier) pour rassembler les chiffres. Objectif : 2048 !')));
  }
  // =================== 🐤 Flappy Paradise ===================
  function flappy(body) {
    const cv = el('canvas', { class: 'ph-flappy', width: 360, height: 600 }), g = cv.getContext('2d');
    let y = 280, v = 0, pipes = [], score = 0, best = +(opt('bestFlappy', '0')), state0 = 'ready', last = 0;
    const flap = () => { if (state0 === 'over') { y = 280; v = 0; pipes = []; score = 0; state0 = 'ready'; return; } state0 = 'play'; v = -7.4; };
    cv.onpointerdown = flap;
    const loop = ts => {
      if (!body.isConnected) return;
      requestAnimationFrame(loop); const dt = Math.min(2, (ts - last) / 16.7 || 1); last = ts;
      const sky = g.createLinearGradient(0, 0, 0, 600); sky.addColorStop(0, '#6fd3f5'); sky.addColorStop(1, '#c9f1ff'); g.fillStyle = sky; g.fillRect(0, 0, 360, 600);
      g.fillStyle = '#7fc46a'; g.fillRect(0, 560, 360, 40); g.fillStyle = '#d9b97a'; g.fillRect(0, 556, 360, 6);
      if (state0 === 'play') {
        v += .42 * dt; y += v * dt;
        if (!pipes.length || pipes[pipes.length - 1].x < 160) pipes.push({ x: 380, gap: 130 + Math.random() * 300, done: false });
        for (const p of pipes) { p.x -= 2.6 * dt; if (!p.done && p.x < 70) { p.done = true; score++; } }
        pipes = pipes.filter(p => p.x > -70);
        if (y > 540 || y < 0 || pipes.some(p => p.x < 100 && p.x > 20 && (y < p.gap - 70 || y > p.gap + 70))) { state0 = 'over'; if (score > best) { best = score; setOpt('bestFlappy', String(best)); } try { navigator.vibrate?.(80); } catch (e) {} }
      }
      for (const p of pipes) { g.fillStyle = '#2bb866'; g.fillRect(p.x, 0, 56, p.gap - 70); g.fillRect(p.x, p.gap + 70, 56, 556 - p.gap - 70); g.fillStyle = '#1f8a4c'; g.fillRect(p.x - 4, p.gap - 92, 64, 22); g.fillRect(p.x - 4, p.gap + 70, 64, 22); }
      g.save(); g.translate(70, y); g.rotate(Math.max(-.5, Math.min(1.2, v / 10))); g.font = '38px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText('🐤', 0, 0); g.restore();
      g.font = '900 44px Outfit, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5; g.strokeText(score, 180, 80); g.fillText(score, 180, 80);
      if (state0 !== 'play') { g.font = '900 24px Outfit, sans-serif'; const t = state0 === 'ready' ? 'Touche pour voler !' : `Perdu ! Record : ${best}`; g.strokeText(t, 180, 300); g.fillText(t, 180, 300); }
    };
    requestAnimationFrame(loop);
    body.replaceChildren(el('div', { class: 'ph-flappy-app' }, cv));
  }
  // =================== 🧘 Zen ===================
  function breathe(body) {
    screen.style.background = 'radial-gradient(circle at 50% 40%, #2a6f5a, #0b2a24)';
    const c = el('div', { class: 'zen-c' }), t = el('b', { class: 'zen-t' }, 'Inspire…');
    let i = 0; const steps = [['Inspire…', 4000], ['Retiens…', 2000], ['Expire…', 5000]];
    const next = () => { if (!body.isConnected) return; const [l, ms] = steps[i % 3]; t.textContent = l; c.style.transition = `transform ${ms}ms ease-in-out`; c.style.transform = i % 3 === 0 ? 'scale(1.8)' : i % 3 === 2 ? 'scale(1)' : c.style.transform; i++; timers.push(setTimeout(next, ms)); };
    body.replaceChildren(el('div', { class: 'zen' }, c, t, el('small', {}, 'Suis le cercle : respire avec lui pendant une minute 🌿')));
    setTimeout(next, 300);
  }
  // =================== ♈ Horoscope ===================
  function horoscope(body) {
    const SIGNS = ['♈ Bélier', '♉ Taureau', '♊ Gémeaux', '♋ Cancer', '♌ Lion', '♍ Vierge', '♎ Balance', '♏ Scorpion', '♐ Sagittaire', '♑ Capricorne', '♒ Verseau', '♓ Poissons'];
    const L = ['Une belle rencontre t\'attend dans un salon du Paradise 💞', 'Ta bonne humeur sera contagieuse aujourd\'hui ☀️', 'Un message inattendu va te faire sourire 💌', 'C\'est le jour parfait pour tenter ta chance à la Chasse au trésor 🗺️', 'Prends soin de toi : une pause s\'impose ☕', 'Tes amis comptent sur toi : passe leur dire bonjour 👋', 'La chance est avec toi aux mini-jeux aujourd\'hui 🍀', 'Ose chanter au micro, tu vas briller 🎤', 'Une surprise t\'attend ce soir 🎁', 'Ton charme est irrésistible aujourd\'hui 😎'];
    const day = new Date().getDate() + new Date().getMonth() * 31;
    let sign = +(opt('sign', '0'));
    const draw = () => body.replaceChildren(el('div', { class: 'horo' }, el('div', { class: 'horo-signs' }, ...SIGNS.map((s, i) => el('button', { class: 'ph-pill' + (i === sign ? ' go' : ''), onclick: () => { sign = i; setOpt('sign', String(i)); draw(); } }, s))),
      el('div', { class: 'horo-card' }, el('b', {}, SIGNS[sign]), el('div', {}, '💞 Amour : ', L[(day + sign) % L.length]), el('div', {}, '💼 Travail : ', L[(day * 3 + sign) % L.length]), el('div', {}, '🍀 Chance : ', '⭐'.repeat(1 + (day + sign * 7) % 5)), el('small', {}, `Ton chiffre porte-bonheur : ${1 + (day * 7 + sign) % 9}`))));
    draw();
  }
  // =================== 🗺️ Plans ===================
  function mapApp(body) {
    const places = (window.Island?.PLACES || []).filter(p => p.x != null);
    const box = el('div', { class: 'ph-map' }, ...[200, 1000, 1800, 2600, 3400, 4000].map(x => el('i', { class: 'ph-map-st v', style: `left:${x / 42}%` })), ...[260, 980, 1700, 2420, 2790].map(y => el('i', { class: 'ph-map-st h', style: `top:${y / 29}%` })), el('i', { class: 'ph-map-lake' }), ...places.map(p => el('button', { class: 'ph-map-pin', style: `left:${p.x / 4200 * 100}%;top:${p.y / 2900 * 100}%`, title: p.label, onclick: () => info(p) }, p.icon)));
    const card = el('div', { class: 'ph-map-card' }, 'Touche un lieu pour le voir 📍');
    const info = p => card.replaceChildren(el('b', {}, `${p.icon} ${p.label}`), el('button', { class: 'ph-pill go', onclick: () => { window.Island?.open(); if (innerWidth <= 600) { close(); showReturn(); } } }, '🏙️ Aller dans la Ville'));
    body.replaceChildren(el('div', { class: 'ph-mapapp' }, box, card, el('div', { class: 'ph-map-list' }, ...places.map(p => el('button', { class: 'ph-row', onclick: () => info(p) }, el('span', {}, p.icon), el('div', { class: 'ph-row-txt' }, el('b', {}, p.label)))))));
  }
  // =================== 🧭 Boussole & 📏 Niveau (avec les capteurs du téléphone) ===================
  function sensor(body, fn) {
    const h = e => { if (!body.isConnected) return removeEventListener('deviceorientation', h); fn(e); };
    const start = () => { addEventListener('deviceorientation', h); };
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) body.append(el('button', { class: 'ph-pill go', style: 'margin:10px auto;display:block', onclick: e => DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') { start(); e.target.remove(); } }).catch(() => {}) }, '📲 Autoriser les capteurs'));
    else start();
  }
  function compass(body) {
    screen.style.background = '#000';
    const rose = el('div', { class: 'cmp-rose' }, el('i', { class: 'n' }, 'N'), el('i', { class: 'e' }, 'E'), el('i', { class: 's' }, 'S'), el('i', { class: 'w' }, 'O'), el('span', { class: 'cmp-needle' }));
    const deg = el('b', { class: 'cmp-deg' }, '0°');
    body.replaceChildren(el('div', { class: 'cmp' }, deg, rose, el('small', {}, 'Tiens ton téléphone à plat 📱 (sur ordinateur, la boussole ne bouge pas)')));
    sensor(body, e => { const a = e.webkitCompassHeading ?? (360 - (e.alpha || 0)); rose.style.transform = `rotate(${-a}deg)`; deg.textContent = Math.round(a) + '°'; });
  }
  function levelApp(body) {
    screen.style.background = '#000';
    const bub = el('div', { class: 'lvl-bub' }), val = el('b', { class: 'cmp-deg' }, '0°');
    body.replaceChildren(el('div', { class: 'cmp' }, val, el('div', { class: 'lvl-box' }, el('div', { class: 'lvl-cross' }), bub), el('small', {}, 'Pose ton téléphone sur une surface : la bulle est au centre quand c\'est bien droit')));
    sensor(body, e => { const x = Math.max(-45, Math.min(45, e.gamma || 0)), y = Math.max(-45, Math.min(45, (e.beta || 0))); bub.style.transform = `translate(${x * 2}px, ${y * 2}px)`; const t = Math.round(Math.hypot(x, y)); val.textContent = t + '°'; bub.classList.toggle('ok', t <= 1); });
  }

  // =================== ⚙️ Les réglages (comme sur iPhone : une liste, puis une page par réglage) ===================
  const RINGS = { cristal: [880, 1320], marimba: [523, 659, 784], radar: [988, 988, 988], harpe: [392, 523, 659, 784, 1047], aucune: [] };
  function ringTone(name = opt('ring', 'cristal')) {
    const notes = RINGS[name] || []; if (!notes.length) return;
    try { const A = new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((f, i) => { const o = A.createOscillator(), g = A.createGain(); o.type = name === 'radar' ? 'square' : 'sine'; o.frequency.value = f; const t = A.currentTime + i * .14; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12 * (+opt('vol', '7') / 10), t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g).connect(A.destination); o.start(t); o.stop(t + .32); }); } catch (e) {}
    if (opt('vibe', '1') === '1') try { navigator.vibrate?.(120); } catch (e) {}
  }
  const sw = (key, def, after) => el('label', { class: 'ios-sw' }, el('input', { type: 'checkbox', checked: opt(key, def) === '1', onchange: e => { setOpt(key, e.target.checked ? '1' : '0'); applyLook(); after && after(e.target.checked); } }), el('i'));
  const row = (ico, c, label, right, fn) => el(fn ? 'button' : 'div', { class: 'ios-row', onclick: fn || null }, el('span', { class: 'ios-ico', style: `background:${c}` }, ico), el('span', { class: 'ios-lbl' }, label), right ?? null, fn ? el('span', { class: 'ios-chev' }, '›') : null);
  const group = (...rows) => el('div', { class: 'ios-group' }, ...rows.filter(Boolean));
  function settings(body) {
    const pinOn = !!opt('pin', '');
    body.replaceChildren(el('div', { class: 'ios' },
      el('div', { class: 'ios-me', onclick: () => go(aboutPage, 'Général') }, LC.avatar(state.me), el('div', {}, el('b', {}, state.me.username), el('small', {}, 'Identifiant Paradise, iCloud+, contenus multimédias'))),
      group(row('✈️', '#ff9500', 'Mode avion', sw('plane', '0', on => toast(on ? '✈️ Mode avion : plus d\'alertes sur ton téléphone' : '✈️ Mode avion désactivé'))),
        row('🔋', '#34c759', 'Batterie', null, () => go(batteryPage, 'Batterie')),
        row('🌙', '#5856d6', 'Concentration (ne pas déranger)', el('span', { class: 'ios-val' }, state.me.presence === 'dnd' ? 'Activé' : 'Non'), () => { window.setPresence?.(state.me.presence === 'dnd' ? 'auto' : 'dnd'); setTimeout(() => settings(body), 400); })),
      group(row('🔊', '#ff2d55', 'Sons et vibrations', null, () => go(soundPage, 'Sons et vibrations')),
        row('🔆', '#007aff', 'Luminosité et affichage', null, () => go(displayPage, 'Luminosité et affichage')),
        row('🖼️', '#32ade6', 'Fond d\'écran', null, () => go(wallPage, 'Fond d\'écran')),
        row('🧩', '#af52de', 'Écran d\'accueil et widgets', null, () => go(widgetPage, 'Écran d\'accueil'))),
      group(row('🔔', '#ff3b30', 'Notifications', null, () => go(notifPage, 'Notifications')), row('🔮', '#af52de', 'Siri et recherche', null, () => siri())),
      group(row('🔒', '#ff3b30', 'Face ID et code', el('span', { class: 'ios-val' }, pinOn ? 'Activé' : 'Non'), () => go(pinPage, 'Face ID et code')), row('✋', '#007aff', 'Confidentialité et sécurité', null, () => go(privacyPage, 'Confidentialité')), row('♿', '#007aff', 'Accessibilité', null, () => go(a11yPage, 'Accessibilité'))),
      group(row('⚙️', '#8e8e93', 'Mise à jour logicielle', el('span', { class: 'ios-badge' }, '1'), () => go(updatePage, 'Mise à jour logicielle')), row('🕐', '#8e8e93', 'Date et heure', null, () => go(datePage, 'Date et heure')), row('💾', '#8e8e93', 'Stockage iPhone', null, () => go(storagePage, 'Stockage')),
        row('📱', '#8e8e93', 'Général', null, () => go(aboutPage, 'Général')))));
  }
  function batteryPage(body) {
    const pct = el('b', { class: 'ios-big' }, '…');
    (navigator.getBattery ? navigator.getBattery() : Promise.reject()).then(b => { pct.textContent = Math.round(b.level * 100) + ' %' + (b.charging ? ' ⚡' : ''); }).catch(() => { pct.textContent = '87 %'; });
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('small', {}, 'Niveau de la batterie'), pct),
      group(row('💯', '#34c759', 'Afficher le pourcentage', sw('batpct', '0')), row('🔋', '#ffcc00', 'Mode économie d\'énergie', sw('eco', '0', on => toast(on ? '🔋 Économie d\'énergie : moins d\'animations' : 'Mode normal'))))));
  }
  function soundPage(body) {
    body.replaceChildren(el('div', { class: 'ios' },
      el('h4', { class: 'ios-head' }, 'VOLUME DES ALERTES'),
      group(el('div', { class: 'ios-row' }, el('span', {}, '🔈'), el('input', { type: 'range', min: 0, max: 10, value: opt('vol', '7'), class: 'ios-range', onchange: e => { setOpt('vol', e.target.value); ringTone(); } }), el('span', {}, '🔊'))),
      el('h4', { class: 'ios-head' }, 'SONNERIE'),
      group(...Object.keys(RINGS).map(k => row(opt('ring', 'cristal') === k ? '✔️' : '🎵', '#ff2d55', k[0].toUpperCase() + k.slice(1), null, () => { setOpt('ring', k); ringTone(k); soundPage(body); }))),
      group(row('📳', '#ff9500', 'Vibrations', sw('vibe', '1')), row('⌨️', '#8e8e93', 'Clics du clavier', sw('keyclick', '0')))));
  }
  function displayPage(body) {
    const seg = (key, def, list) => el('div', { class: 'ph-seg' }, ...list.map(([v, l]) => el('button', { class: opt(key, def) === v ? 'on' : '', onclick: () => { setOpt(key, v); applyLook(); displayPage(body); } }, l)));
    body.replaceChildren(el('div', { class: 'ios' },
      el('h4', { class: 'ios-head' }, 'LUMINOSITÉ'),
      group(el('div', { class: 'ios-row' }, el('span', {}, '🔅'), el('input', { type: 'range', min: 35, max: 100, value: opt('bright', '100'), class: 'ios-range', oninput: e => { setOpt('bright', e.target.value); applyLook(); } }), el('span', {}, '🔆'))),
      el('h4', { class: 'ios-head' }, 'APPARENCE'), seg('theme', 'clair', [['clair', '☀️ Claire'], ['sombre', '🌙 Sombre']]),
      group(row('🌅', '#ff9500', 'Night Shift (écran plus chaud)', sw('night', '0'))),
      el('h4', { class: 'ios-head' }, 'TAILLE DU TEXTE'), seg('text', 'normal', [['petit', 'Petit'], ['normal', 'Normal'], ['grand', 'Grand']]),
      el('h4', { class: 'ios-head' }, 'TAILLE DU TÉLÉPHONE (sur ordinateur)'), seg('size', 'm', [['s', 'Petit'], ['m', 'Normal'], ['l', 'Grand']]),
      el('h4', { class: 'ios-head' }, 'COULEUR DU TÉLÉPHONE'),
      el('div', { class: 'ph-frames' }, ...Object.entries(FRAME_COLORS).map(([k, [n, c]]) => el('button', { class: 'ph-frame' + (opt('frame', 'titane') === k ? ' on' : ''), title: n, style: `--fc:${c}`, onclick: () => { setOpt('frame', k); applyLook(); displayPage(body); } }))),
      el('h4', { class: 'ios-head' }, 'DYNAMIC ISLAND'), seg('island', '1', [['1', 'Animée'], ['0', 'Discrète']])));
  }
  // 🖼️ les fonds d'écran : modèles, ou jusqu'à 6 photos à soi ; un pour l'accueil et un pour l'écran verrouillé
  const myWalls = () => { try { const l = JSON.parse(localStorage.getItem('ph_wallimgs') || 'null'); if (Array.isArray(l)) return l; const old = localStorage.getItem('ph_wallimg'); return old ? [old] : []; } catch (e) { return []; } };
  const saveWalls = l => { try { localStorage.setItem('ph_wallimgs', JSON.stringify(l)); return true; } catch (e) { toast('📦 Plus de place sur l\'appareil : supprime une photo'); return false; } };
  function wallPage(body) {
    let target = body.dataset.target || 'wall'; // 'wall' = accueil, 'lockwall' = écran verrouillé
    const file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      const img = await createImageBitmap(f).catch(() => null); if (!img) return toast('Image illisible');
      const c = document.createElement('canvas'), k = Math.min(1, 900 / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const l = myWalls(); l.unshift(c.toDataURL('image/jpeg', .78)); if (l.length > 6) l.length = 6;
      if (saveWalls(l)) { setOpt(target, 'photo:0'); toast('🖼️ Ta photo est ton fond d\'écran !'); }
      wallPage(body);
    } });
    const cur = opt(target, target === 'lockwall' ? 'same' : 'neon'), mine = myWalls();
    const pick = v => { setOpt(target, v); wallPage(body); };
    const preview = el('div', { class: 'wp-prev' }, el('div', { class: 'wp-phone', style: `background:${bgOf(opt('lockwall', 'same') === 'same' ? opt('wall', 'neon') : opt('lockwall', 'same'))}` }, el('b', {}, time()), el('small', {}, '🔒 Verrouillé')), el('div', { class: 'wp-phone', style: `background:${bgOf(opt('wall', 'neon'))}` }, el('i'), el('i'), el('i'), el('i'), el('small', {}, '🏠 Accueil')));
    body.dataset.target = target;
    body.replaceChildren(el('div', { class: 'ios' }, preview,
      el('div', { class: 'ph-seg' }, ...[['wall', '🏠 Écran d\'accueil'], ['lockwall', '🔒 Écran verrouillé']].map(([v, l]) => el('button', { class: target === v ? 'on' : '', onclick: () => { body.dataset.target = v; wallPage(body); } }, l))),
      el('h4', { class: 'ios-head' }, 'MES PHOTOS'),
      el('div', { class: 'ph-walls' }, el('button', { class: 'ph-wall wp-add', onclick: () => file.click() }, '＋', el('small', {}, 'Ajouter')),
        ...mine.map((u, i) => el('div', { class: 'wp-mine' }, el('button', { class: 'ph-wall' + (cur === 'photo:' + i ? ' on' : ''), style: `background:url(${u}) center/cover`, onclick: () => pick('photo:' + i) }),
          el('button', { class: 'wp-x', title: 'Supprimer', onclick: () => { const l = myWalls(); l.splice(i, 1); saveWalls(l); for (const t of ['wall', 'lockwall']) if (opt(t, '').startsWith('photo:')) setOpt(t, t === 'wall' ? 'neon' : 'same'); wallPage(body); } }, '✕')))),
      el('h4', { class: 'ios-head' }, 'MODÈLES'),
      el('div', { class: 'ph-walls' }, target === 'lockwall' ? el('button', { class: 'ph-wall wp-add' + (cur === 'same' ? ' on' : ''), onclick: () => pick('same') }, '=', el('small', {}, 'Comme l\'accueil')) : null,
        ...Object.entries(WALLS).map(([k, v]) => el('button', { class: 'ph-wall' + (cur === k ? ' on' : ''), style: `background:${v}`, title: k, onclick: () => pick(k) }))),
      file, el('button', { class: 'ph-pill go', style: 'margin-top:12px;width:100%', onclick: () => file.click() }, '📷 Mettre une de mes photos')));
  }
  function widgetPage(body) {
    body.replaceChildren(el('div', { class: 'ios' }, el('h4', { class: 'ios-head' }, 'WIDGETS SUR L\'ÉCRAN D\'ACCUEIL'),
      group(row('⛅', '#2f9bff', 'Météo', sw('w_weather', '1')), row('📅', '#ff3b30', 'Calendrier', sw('w_cal', '0')), row('🔋', '#34c759', 'Batterie', sw('w_bat', '0')), row('💰', '#ffcc00', 'Mes pièces', sw('w_coins', '1'))),
      el('h4', { class: 'ios-head' }, 'APPLIS'), group(row('🔲', '#8e8e93', 'Forme des icônes', null, () => go(iconsPage, 'Icônes')), row('↺', '#ff9500', 'Remettre les applis de départ', null, () => { if (confirm('Remettre l\'écran d\'accueil comme au départ ?')) { setInstalled([...STARTER]); toast('↺ Écran d\'accueil remis à zéro'); } }))));
  }
  function iconsPage(body) {
    const seg = (key, def, list) => el('div', { class: 'ph-seg' }, ...list.map(([v, l]) => el('button', { class: opt(key, def) === v ? 'on' : '', onclick: () => { setOpt(key, v); applyLook(); iconsPage(body); } }, l)));
    body.replaceChildren(el('div', { class: 'ios' }, el('h4', { class: 'ios-head' }, 'FORME'), seg('icons', 'arrondi', [['arrondi', 'Arrondies'], ['rond', 'Rondes'], ['carre', 'Carrées']]), el('h4', { class: 'ios-head' }, 'PAR LIGNE'), seg('cols', '4', [['3', '3 (grandes)'], ['4', '4'], ['5', '5 (petites)']])));
  }
  function pinPage(body) {
    const cur = opt('pin', '');
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('span', { class: 'ios-face' }, '🙂'), el('small', {}, 'Protège ton téléphone avec un code à 4 chiffres. Face ID 🙂 le déverrouille aussi.')),
      group(cur ? row('🔓', '#ff3b30', 'Désactiver le code', null, () => { setOpt('pin', ''); unlocked = true; toast('🔓 Code désactivé'); pinPage(body); }) : row('🔒', '#34c759', 'Activer un code', null, () => askPin('Choisis un code à 4 chiffres', p => askPin('Confirme ton code', p2 => { if (p !== p2) return toast('Les codes ne sont pas pareils'); setOpt('pin', p); unlocked = true; toast('🔒 Code activé !'); go(pinPage, 'Face ID et code'); })))),
      cur ? group(row('😊', '#34c759', 'Face ID', sw('faceid', '1'))) : null,
      group(row('📲', '#007aff', 'Écran verrouillé quand on sort le téléphone', sw('lockopen', '1')))));
  }
  function aboutPage(body) {
    const n = installed().length + SYSTEM.length;
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('div', { class: 'ph-about-ico', style: 'font-size:40px' }, ''), el('b', {}, opt('name', 'iPhone 18 Pro de ' + state.me.username)), el('small', {}, 'Paradise OS ' + opt('osv', '18.2'))),
      group(el('div', { class: 'ios-row' }, el('span', { class: 'ios-lbl' }, 'Modèle'), el('span', { class: 'ios-val' }, 'iPhone 18 Pro')), el('div', { class: 'ios-row' }, el('span', { class: 'ios-lbl' }, 'Couleur'), el('span', { class: 'ios-val' }, (FRAME_COLORS[opt('frame', 'titane')] || FRAME_COLORS.titane)[0])), el('div', { class: 'ios-row' }, el('span', { class: 'ios-lbl' }, 'Stockage'), el('span', { class: 'ios-val' }, '1 To')), el('div', { class: 'ios-row' }, el('span', { class: 'ios-lbl' }, 'Applis installées'), el('span', { class: 'ios-val' }, n)), el('div', { class: 'ios-row' }, el('span', { class: 'ios-lbl' }, 'Numéro'), el('span', { class: 'ios-val' }, '06 ' + String(1000000 + state.me.id * 7919 % 9000000).replace(/(\d{2})(?=\d)/g, '$1 ')))),
      el('h4', { class: 'ios-head' }, 'NOM'), el('input', { class: 'ph-input', maxlength: 40, value: opt('name', 'iPhone 18 Pro de ' + state.me.username), onchange: e => setOpt('name', e.target.value.trim() || 'iPhone 18 Pro') }),
      el('h4', { class: 'ios-head' }, 'RÉINITIALISER'),
      el('div', { class: 'ios-group' }, el('button', { class: 'ios-row', onclick: () => { if (!confirm('Effacer ton iPhone et le reconfigurer comme un téléphone neuf ? (tes messages et snaps restent sur le site)')) return; for (const k of Object.keys(localStorage)) if (k.startsWith('ph_')) try { localStorage.removeItem(k); } catch (e) {} unlocked = false; applyLook(); setupWizard(home); } }, el('span', { class: 'ios-ico', style: 'background:#ff3b30' }, '↺'), el('span', { class: 'ios-lbl', style: 'color:#ff3b30' }, 'Effacer et reconfigurer l\'iPhone')))));
  }
  // 🔒 le clavier du code
  function askPin(title, cb) {
    let v = '';
    const dots = el('div', { class: 'pin-dots' }, ...[0, 1, 2, 3].map(() => el('i')));
    const draw = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < v.length));
    const press = k => { if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k; draw(); if (v.length === 4) setTimeout(() => cb(v), 150); };
    go(b => b.replaceChildren(el('div', { class: 'pin' }, el('b', {}, title), dots, el('div', { class: 'pin-keys' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? el('button', { onclick: () => press(k) }, k) : el('span'))))), '');
  }
  // 🔒 l'écran verrouillé
  let unlocked = false;
  function lockScreen(then) {
    stopCam(); clearTimers(); stack = [];
    screen.style.background = lockBg(); dark(true); hideOverlay();
    if (!opt('pin', '')) { // 🔓 pas de code : on glisse vers le haut
      const n = snapsUnread + pmUnread;
      const l = el('div', { class: 'lock lock-free' }, el('div', { class: 'lock-ico' }, '🔒'), el('small', { class: 'lock-date' }, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })), el('b', { class: 'lock-time' }, time()),
        el('div', { class: 'lock-list' }, ...(n ? [el('div', { class: 'lock-notif' }, el('b', {}, '📱 The Paradise'), el('span', {}, `${n} nouvelle${n > 1 ? 's' : ''} notification${n > 1 ? 's' : ''}`))] : [])),
        el('div', { class: 'lock-tools' }, el('button', { onclick: e => { e.stopPropagation(); unlocked = true; APPS.torch.open(); } }, '🔦'), el('button', { onclick: e => { e.stopPropagation(); unlocked = true; APPS.camera.open(); } }, '📷')),
        el('div', { class: 'lock-hint' }, '⌃', el('small', {}, 'Glisse vers le haut pour déverrouiller')));
      let y0 = null;
      l.addEventListener('pointerdown', e => { y0 = e.clientY; });
      l.addEventListener('pointermove', e => { if (y0 != null && y0 - e.clientY > 0) l.style.transform = `translateY(${-(y0 - e.clientY)}px)`; });
      const end = e => { if (y0 == null) return; const d = y0 - e.clientY; y0 = null; if (d > 70 || Math.abs(d) < 6) { l.classList.add('lock-up'); setTimeout(() => { unlocked = true; then(); }, 260); } else l.style.transform = ''; };
      l.addEventListener('pointerup', end); l.addEventListener('pointercancel', end);
      api('/api/notifications').then(d => { const box = l.querySelector('.lock-list'); if (!box?.isConnected) return; box.replaceChildren(...d.notifications.slice(0, 3).map(x => el('div', { class: 'lock-notif' }, el('b', {}, `${x.icon} ${ago(x.createdAt)}`), el('span', {}, x.title)))); }).catch(() => {});
      screen.replaceChildren(l); return;
    }
    let v = '';
    const dots = el('div', { class: 'pin-dots' }, ...[0, 1, 2, 3].map(() => el('i')));
    const ok = () => { unlocked = true; island('🔓 Déverrouillé'); then(); };
    const press = k => { if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k; dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < v.length)); if (v.length === 4) { if (v === opt('pin', '')) ok(); else { dots.classList.add('bad'); try { navigator.vibrate?.([60, 40, 60]); } catch (e) {} setTimeout(() => { v = ''; dots.classList.remove('bad'); dots.querySelectorAll('i').forEach(d => d.classList.remove('on')); }, 500); } } };
    const n = snapsUnread + pmUnread;
    screen.replaceChildren(el('div', { class: 'lock' }, el('div', { class: 'lock-ico' }, '🔒'), el('b', { class: 'lock-time' }, time()), el('small', {}, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })),
      n ? el('div', { class: 'lock-notif' }, `💬 ${n} nouvelle${n > 1 ? 's' : ''} notification${n > 1 ? 's' : ''}`) : null,
      opt('faceid', '1') === '1' ? el('button', { class: 'lock-face', onclick: e => { e.currentTarget.classList.add('scan'); setTimeout(ok, 900); } }, '🙂', el('small', {}, 'Face ID')) : null,
      dots, el('div', { class: 'pin-keys' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? el('button', { onclick: () => press(k) }, k) : el('span')))));
  }
  function bgOf(v) { if (v === 'photo') v = 'photo:0'; if (String(v).startsWith('photo:')) { const u = myWalls()[+v.slice(6)]; if (u) return `url(${u}) center/cover`; } return WALLS[v] || WALLS.neon; }
  const wallBg = () => bgOf(opt('wall', 'neon'));
  const lockBg = () => { const l = opt('lockwall', 'same'); return l === 'same' ? wallBg() : bgOf(l); };
  // 🧩 les widgets de l'écran d'accueil
  function widgets() {
    const out = [];
    if (opt('w_weather', '1') === '1') { const h = new Date().getHours(), d = new Date().getDate(), n = h < 7 || h >= 20; out.push(el('button', { class: 'wdg', onclick: () => APPS.weather.open() }, el('small', {}, '📍 Paradise'), el('b', {}, (18 + d % 9 - (n ? 6 : 0)) + '°'), el('span', {}, n ? '🌙 Nuit claire' : ['☀️ Soleil', '🌤️ Nuageux', '⛅ Éclaircies'][d % 3]))); }
    if (opt('w_coins', '1') === '1') out.push(el('button', { class: 'wdg coins', onclick: () => APPS.shop.open() }, el('small', {}, '💰 Mes pièces'), el('b', {}, String(state.me?.coins ?? 0)), el('span', {}, 'Paradise Coins')));
    if (opt('w_cal', '0') === '1') { const d = new Date(); out.push(el('button', { class: 'wdg cal', onclick: () => APPS.agenda.open() }, el('small', {}, d.toLocaleDateString('fr-FR', { weekday: 'long' })), el('b', {}, d.getDate()), el('span', {}, d.toLocaleDateString('fr-FR', { month: 'long' })))); }
    if (opt('w_bat', '0') === '1') { const w = el('button', { class: 'wdg bat' }, el('small', {}, '🔋 Batterie'), el('b', {}, '87 %'), el('span', {}, 'iPhone')); (navigator.getBattery ? navigator.getBattery() : Promise.reject()).then(b => { w.querySelector('b').textContent = Math.round(b.level * 100) + ' %'; }).catch(() => {}); out.push(w); }
    return out.length ? el('div', { class: 'wdgs' }, ...out.slice(0, 4)) : null;
  }

  // =================== 🎮 Les nouveaux jeux ===================
  // 🐍 Serpent
  function snakeGame(body) {
    const N = 16, cv = el('canvas', { class: 'ph-gcv', width: 320, height: 320 }), g = cv.getContext('2d');
    let s = [[8, 8], [7, 8]], d = [1, 0], nd = [1, 0], food = [12, 8], score = 0, dead = false, best = +opt('bestSnake', '0');
    const info = el('div', { class: 'g48-info' });
    const place = () => { do food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; while (s.some(p => p[0] === food[0] && p[1] === food[1])); };
    const draw = () => { g.fillStyle = '#1b2a1b'; g.fillRect(0, 0, 320, 320); g.font = '18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍎', food[0] * 20 + 10, food[1] * 20 + 11); s.forEach((p, i) => { g.fillStyle = i ? '#3fd16a' : '#9dff7a'; g.fillRect(p[0] * 20 + 1, p[1] * 20 + 1, 18, 18); }); info.replaceChildren(el('span', {}, `🍎 ${score}`), el('span', {}, `🏆 ${best}`)); if (dead) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 320, 320); g.fillStyle = '#fff'; g.font = '900 26px Outfit'; g.fillText('Perdu ! Touche pour rejouer', 160, 160); } };
    const step = () => { if (dead || !body.isConnected) return; d = nd; const h = [s[0][0] + d[0], s[0][1] + d[1]]; if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || s.some(p => p[0] === h[0] && p[1] === h[1])) { dead = true; if (score > best) { best = score; setOpt('bestSnake', String(best)); } try { navigator.vibrate?.(100); } catch (e) {} return draw(); } s.unshift(h); if (h[0] === food[0] && h[1] === food[1]) { score++; place(); } else s.pop(); draw(); timers.push(setTimeout(step, Math.max(70, 150 - score * 4))); };
    const turn = (x, y) => { if (dead) { s = [[8, 8], [7, 8]]; d = nd = [1, 0]; score = 0; dead = false; place(); step(); return; } if (x !== -d[0] || y !== -d[1]) nd = [x, y]; };
    let sx = 0, sy = 0; cv.onpointerdown = e => { sx = e.clientX; sy = e.clientY; }; cv.onpointerup = e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return dead && turn(0, 0); Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); };
    const key = e => { if (!body.isConnected) return document.removeEventListener('keydown', key); const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (m) { e.preventDefault(); turn(...m); } };
    document.addEventListener('keydown', key);
    const pad = el('div', { class: 'gpad' }, el('span'), el('button', { onclick: () => turn(0, -1) }, '▲'), el('span'), el('button', { onclick: () => turn(-1, 0) }, '◀'), el('span'), el('button', { onclick: () => turn(1, 0) }, '▶'), el('span'), el('button', { onclick: () => turn(0, 1) }, '▼'), el('span'));
    body.replaceChildren(el('div', { class: 'g48-app' }, info, cv, pad)); draw(); step();
  }
  // 🔨 Tape-taupe
  function whack(body) {
    let score = 0, left = 30, mole = -1, best = +opt('bestWhack', '0'), run = false;
    const holes = Array.from({ length: 9 }, (_, i) => el('button', { class: 'wh-hole', onclick: () => { if (!run || i !== mole) return; score++; mole = -1; holes[i].classList.add('hit'); setTimeout(() => holes[i].classList.remove('hit'), 200); try { navigator.vibrate?.(25); } catch (e) {} draw(); } }));
    const info = el('div', { class: 'g48-info' });
    const draw = () => { holes.forEach((h, i) => { h.textContent = i === mole ? '🐹' : ''; }); info.replaceChildren(el('span', {}, `🔨 ${score}`), el('span', {}, `⏱️ ${left} s`), el('span', {}, `🏆 ${best}`)); };
    const pop = () => { if (!run || !body.isConnected) return; mole = Math.floor(Math.random() * 9); draw(); timers.push(setTimeout(pop, Math.max(420, 900 - score * 15))); };
    const tick = () => { if (!run || !body.isConnected) return; left--; if (left <= 0) { run = false; mole = -1; if (score > best) { best = score; setOpt('bestWhack', String(best)); } draw(); btn.textContent = `🔁 Rejouer (score : ${score})`; btn.classList.remove('hidden'); return; } draw(); timers.push(setTimeout(tick, 1000)); };
    const btn = el('button', { class: 'ph-pill go', onclick: () => { score = 0; left = 30; run = true; btn.classList.add('hidden'); pop(); timers.push(setTimeout(tick, 1000)); } }, '▶ Commencer');
    body.replaceChildren(el('div', { class: 'g48-app' }, info, el('div', { class: 'wh-grid' }, ...holes), btn, el('small', { class: 'ph-wait' }, 'Tape les hamsters 🐹 avant qu\'ils se cachent ! 30 secondes'))); draw();
  }
  // 🧠 Simon
  function simon(body) {
    const C = ['#ff3b30', '#34c759', '#007aff', '#ffcc00'], F = [330, 392, 494, 587];
    let seq = [], pos = 0, busy = true, best = +opt('bestSimon', '0');
    const info = el('div', { class: 'g48-info' });
    const beep = i => { try { const A = new (window.AudioContext || window.webkitAudioContext)(), o = A.createOscillator(), g = A.createGain(); o.frequency.value = F[i]; g.gain.setValueAtTime(.12, A.currentTime); g.gain.exponentialRampToValueAtTime(.001, A.currentTime + .35); o.connect(g).connect(A.destination); o.start(); o.stop(A.currentTime + .36); } catch (e) {} };
    const flash = i => { pads[i].classList.add('on'); beep(i); setTimeout(() => pads[i].classList.remove('on'), 320); };
    const pads = C.map((c, i) => el('button', { class: 'sm-pad', style: `background:${c}`, onclick: () => { if (busy) return; flash(i); if (i !== seq[pos]) { busy = true; if (seq.length - 1 > best) { best = seq.length - 1; setOpt('bestSimon', String(best)); } info.replaceChildren(el('span', {}, `❌ Perdu ! ${seq.length - 1} couleurs`), el('span', {}, `🏆 ${best}`)); btn.classList.remove('hidden'); return; } if (++pos >= seq.length) { busy = true; timers.push(setTimeout(next, 700)); } } }));
    const next = () => { if (!body.isConnected) return; seq.push(Math.floor(Math.random() * 4)); pos = 0; busy = true; info.replaceChildren(el('span', {}, `🧠 ${seq.length - 1}`), el('span', {}, `🏆 ${best}`)); seq.forEach((v, k) => timers.push(setTimeout(() => flash(v), 500 + k * 550))); timers.push(setTimeout(() => { busy = false; }, 500 + seq.length * 550)); };
    const btn = el('button', { class: 'ph-pill go', onclick: () => { seq = []; btn.classList.add('hidden'); next(); } }, '▶ Commencer');
    body.replaceChildren(el('div', { class: 'g48-app' }, info, el('div', { class: 'sm-grid' }, ...pads), btn, el('small', { class: 'ph-wait' }, 'Retiens l\'ordre des couleurs et répète-le. Chaque tour, une couleur de plus !')));
    info.replaceChildren(el('span', {}, '🧠 0'), el('span', {}, `🏆 ${best}`));
  }
  // ⭕ Morpion contre le téléphone
  function tictac(body) {
    let b = Array(9).fill(''), over = false;
    const W = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const win = (p) => W.some(l => l.every(i => b[i] === p));
    const msg = el('div', { class: 'g48-info' }, el('span', {}, 'Tu es ❌, à toi !'));
    const ai = () => { const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); for (const p of ['⭕', '❌']) for (const i of free) { b[i] = p; const w = win(p); b[i] = ''; if (w) return i; } if (!b[4]) return 4; return free[Math.floor(Math.random() * free.length)]; };
    const end = t => { over = true; msg.replaceChildren(el('span', {}, t)); };
    const cells = Array.from({ length: 9 }, (_, i) => el('button', { class: 'tt-c', onclick: () => {
      if (over || b[i]) return; b[i] = '❌'; draw();
      if (win('❌')) return end('🏆 Bravo, tu as gagné !'); if (!b.includes('')) return end('🤝 Égalité');
      setTimeout(() => { b[ai()] = '⭕'; draw(); if (win('⭕')) end('📱 Le téléphone a gagné !'); else if (!b.includes('')) end('🤝 Égalité'); }, 350);
    } }));
    const draw = () => cells.forEach((c, i) => { c.textContent = b[i]; });
    body.replaceChildren(el('div', { class: 'g48-app' }, msg, el('div', { class: 'tt-grid' }, ...cells), el('button', { class: 'ph-pill go', onclick: () => tictac(body) }, '🔁 Nouvelle partie')));
  }
  // 🃏 Memory
  function memory(body) {
    const E = ['🐱', '🐶', '🦊', '🐼', '🦄', '🐸', '🐙', '🦋'];
    const deck = [...E, ...E].sort(() => Math.random() - .5);
    let open = [], found = 0, moves = 0, lock = false;
    const info = el('div', { class: 'g48-info' });
    const draw = () => info.replaceChildren(el('span', {}, `🔁 ${moves} coups`), el('span', {}, `✅ ${found}/8`));
    const cards = deck.map((e, i) => el('button', { class: 'mm-c', onclick: () => {
      const c = cards[i]; if (lock || c.classList.contains('up')) return;
      c.classList.add('up'); c.textContent = e; open.push(i);
      if (open.length === 2) { moves++; const [a, b2] = open; open = []; if (deck[a] === deck[b2]) { found++; if (found === 8) { LC.confetti(['🃏', '🏆']); info.replaceChildren(el('span', {}, `🏆 Gagné en ${moves} coups !`)); return; } } else { lock = true; setTimeout(() => { [a, b2].forEach(k => { cards[k].classList.remove('up'); cards[k].textContent = ''; }); lock = false; }, 800); } draw(); }
    } }));
    body.replaceChildren(el('div', { class: 'g48-app' }, info, el('div', { class: 'mm-grid' }, ...cards), el('button', { class: 'ph-pill go', onclick: () => memory(body) }, '🔁 Nouvelle partie'))); draw();
  }
  // 🧱 Casse-briques
  function breakout(body) {
    const cv = el('canvas', { class: 'ph-gcv', width: 320, height: 460 }), g = cv.getContext('2d');
    let px = 130, ball, bricks, score = 0, lives = 3, run = false, best = +opt('bestBreak', '0'), last = 0;
    const reset = () => { ball = { x: 160, y: 380, vx: 2.6, vy: -3.4 }; };
    const level = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) bricks.push({ x: 8 + c * 44, y: 40 + r * 20, on: true, col: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff'][r] }); };
    level(); reset();
    const move = e => { const r = cv.getBoundingClientRect(); px = Math.max(0, Math.min(260, (e.clientX - r.left) / r.width * 320 - 30)); };
    cv.onpointermove = move; cv.onpointerdown = e => { move(e); if (!run) { if (lives <= 0) { lives = 3; score = 0; level(); } run = true; reset(); } };
    const loop = ts => {
      if (!body.isConnected) return; requestAnimationFrame(loop); const dt = Math.min(2, (ts - last) / 16.7 || 1); last = ts;
      if (run) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < 6 || ball.x > 314) ball.vx *= -1; if (ball.y < 6) ball.vy = Math.abs(ball.vy);
        if (ball.y > 420 && ball.y < 432 && ball.x > px && ball.x < px + 60) { ball.vy = -Math.abs(ball.vy); ball.vx = (ball.x - px - 30) / 9; }
        for (const b of bricks) if (b.on && ball.x > b.x && ball.x < b.x + 40 && ball.y > b.y && ball.y < b.y + 16) { b.on = false; ball.vy *= -1; score += 10; break; }
        if (!bricks.some(b => b.on)) { level(); reset(); ball.vy *= 1.15; }
        if (ball.y > 470) { lives--; run = false; if (lives <= 0 && score > best) { best = score; setOpt('bestBreak', String(best)); } }
      }
      g.fillStyle = '#10101a'; g.fillRect(0, 0, 320, 460);
      for (const b of bricks) if (b.on) { g.fillStyle = b.col; g.fillRect(b.x, b.y, 40, 16); }
      g.fillStyle = '#fff'; g.fillRect(px, 424, 60, 9); g.beginPath(); g.arc(ball.x, ball.y, 6, 0, 7); g.fill();
      g.font = '800 14px Outfit'; g.textAlign = 'left'; g.fillText(`${score} pts   ${'❤️'.repeat(Math.max(0, lives))}`, 8, 22); g.textAlign = 'right'; g.fillText(`🏆 ${best}`, 312, 22);
      if (!run) { g.textAlign = 'center'; g.font = '900 20px Outfit'; g.fillText(lives <= 0 ? 'Perdu ! Touche pour rejouer' : 'Touche pour lancer la balle', 160, 300); }
    };
    requestAnimationFrame(loop);
    body.replaceChildren(el('div', { class: 'g48-app' }, cv, el('small', { class: 'ph-wait' }, 'Glisse ton doigt pour bouger la raquette')));
  }

  // =================== 🧰 Les nouvelles applis utiles ===================
  // 🎙️ Dictaphone
  function recorder(body) {
    let rec = null, chunks = [], t0 = 0, tv = null;
    const list = el('div', { class: 'ph-map-list' });
    const memos = [];
    const timeEl = el('b', { class: 'cmp-deg' }, '0:00');
    const btn = el('button', { class: 'rec-btn', onclick: async () => {
      if (rec) { rec.stop(); return; }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(st); chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => { st.getTracks().forEach(t => t.stop()); clearInterval(tv); const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); memos.unshift({ url, at: Date.now(), d: Math.round((Date.now() - t0) / 1000) }); rec = null; btn.classList.remove('on'); timeEl.textContent = '0:00'; draw(); };
        rec.start(); t0 = Date.now(); btn.classList.add('on'); tv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timeEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 250);
      } catch (e) { toast('🎙️ Autorise le micro pour enregistrer'); }
    } });
    const draw = () => list.replaceChildren(...(memos.length ? memos.map((m, i) => el('div', { class: 'ph-row' }, el('div', { class: 'ph-row-txt' }, el('b', {}, `Mémo ${memos.length - i}`), el('small', {}, `${new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${m.d} s`)), el('audio', { src: m.url, controls: true, style: 'height:32px;max-width:160px' }))) : [el('div', { class: 'ph-wait' }, 'Appuie sur le bouton rouge pour enregistrer ta voix 🎙️')]));
    body.replaceChildren(el('div', { class: 'rec' }, timeEl, btn, list)); draw();
  }
  // 📐 Convertisseur
  function converter(body) {
    const U = { 'Longueur': [['m', 1], ['km', 1000], ['cm', .01], ['mile', 1609.34], ['pied', .3048], ['pouce', .0254]], 'Poids': [['kg', 1], ['g', .001], ['livre', .4536], ['once', .02835]], 'Température': [['°C'], ['°F'], ['K']], 'Monnaie': [['€', 1], ['$', .92], ['£', 1.17], ['Paradise Coins 💰', .01]] };
    let cat = 'Longueur';
    const draw = () => {
      const u = U[cat], val = el('input', { class: 'ph-input', type: 'number', value: '1' }), from = el('select', { class: 'ph-input' }, ...u.map(([n], i) => el('option', { value: i }, n))), to = el('select', { class: 'ph-input' }, ...u.map(([n], i) => el('option', { value: i, selected: i === 1 }, n))), out = el('div', { class: 'ph-tr-out', style: 'font-size:26px;text-align:center' });
      const calc = () => { const v = parseFloat(val.value) || 0, a = +from.value, b = +to.value; let r; if (cat === 'Température') { const c = a === 0 ? v : a === 1 ? (v - 32) * 5 / 9 : v - 273.15; r = b === 0 ? c : b === 1 ? c * 9 / 5 + 32 : c + 273.15; } else r = v * u[a][1] / u[b][1]; out.textContent = `${(Math.round(r * 1000) / 1000).toLocaleString('fr-FR')} ${u[b][0]}`; };
      [val, from, to].forEach(x => x.oninput = calc);
      body.replaceChildren(el('div', { class: 'ph-tr' }, el('div', { class: 'ph-seg' }, ...Object.keys(U).map(k => el('button', { class: k === cat ? 'on' : '', onclick: () => { cat = k; draw(); } }, k))), val, from, el('div', { style: 'text-align:center' }, '⬇️'), to, out)); calc();
    };
    draw();
  }
  // 📻 Radio (les radios du site)
  async function radioApp(body) {
    if (!window.Media) return;
    if (!Media.stations.length) await Media.load?.();
    const draw = () => body.replaceChildren(el('div', { class: 'ph-map-list' }, el('div', { class: 'ios-card' }, el('small', {}, Media.playing ? '▶️ En écoute' : '⏸️ En pause'), el('b', {}, Media.current?.name || 'Choisis une radio'), Media.current ? el('button', { class: 'ph-pill go', onclick: () => { Media.toggle(); setTimeout(draw, 400); } }, Media.playing ? '⏸️ Pause' : '▶️ Écouter') : null),
      Media.stations.length ? null : el('div', { class: 'ph-wait' }, '📻 Aucune radio pour le moment : un admin peut en ajouter dans l\'administration'),
      ...Media.stations.map(st => el('button', { class: 'ph-row' + (Media.current?.url === st.url ? ' on' : ''), onclick: () => { Media.play(st); setTimeout(draw, 600); } }, el('span', {}, '📻'), el('div', { class: 'ph-row-txt' }, el('b', {}, st.name), el('small', {}, st.genre || st.country || 'Radio')), Media.current?.url === st.url && Media.playing ? el('span', {}, '🔊') : null))));
    draw();
  }
  // 💡 Citations
  function quotes(body) {
    const Q = ['« Le bonheur est la seule chose qui se double si on le partage. » — Albert Schweitzer', '« Sois toi-même, les autres sont déjà pris. » — Oscar Wilde', '« La vie, c\'est comme une bicyclette, il faut avancer pour ne pas perdre l\'équilibre. » — Albert Einstein', '« On ne voit bien qu\'avec le cœur. » — Saint-Exupéry', '« Le meilleur moyen de prédire l\'avenir, c\'est de le créer. » — Peter Drucker', '« Un sourire coûte moins cher que l\'électricité, mais donne autant de lumière. » — Abbé Pierre', '« Il n\'y a pas de chemin vers le bonheur, le bonheur est le chemin. » — Bouddha', '« Tout ce que tu peux imaginer est réel. » — Picasso', '« Le succès, c\'est tomber sept fois et se relever huit. » — Proverbe japonais', '« La gentillesse est la langue que les sourds entendent et que les aveugles voient. » — Mark Twain'];
    let i = new Date().getDate() % Q.length;
    const card = el('div', { class: 'horo-card', style: 'font-size:18px;line-height:1.5;min-height:180px;justify-content:center' });
    const draw = () => { card.textContent = Q[i]; };
    body.replaceChildren(el('div', { class: 'ph-tr' }, el('small', {}, '💡 La citation du jour'), card, el('div', { class: 'ph-row-btns' }, el('button', { class: 'ph-pill go', onclick: () => { i = (i + 1) % Q.length; draw(); } }, '➡️ Une autre'), el('button', { class: 'ph-pill', onclick: () => { const st = window.state?.convs; navigator.clipboard?.writeText(Q[i]); toast('📋 Copiée !'); } }, '📋 Copier'))));
    draw();
  }

  // =================== 📲 L'assistant de configuration (comme quand on allume un iPhone neuf) ===================
  function setupWizard(done) {
    stopCam(); clearTimers(); stack = []; hideOverlay();
    const draft = { lang: window.Translator?.lang || 'fr', frame: opt('frame', 'titane'), theme: opt('theme', 'clair'), wall: opt('wall', 'neon'), apps: [...installed()], name: 'iPhone 18 Pro de ' + state.me.username, pin: '' };
    const page = (cls, ...kids) => { screen.style.background = cls === 'hello' ? '#000' : '#fff'; dark(cls === 'hello'); screen.replaceChildren(el('div', { class: 'sw ' + cls }, ...kids)); };
    const next = (label, fn, extra) => el('div', { class: 'sw-foot' }, el('button', { class: 'sw-btn', onclick: fn }, label || 'Continuer'), extra || null);
    const skip = (label, fn) => el('button', { class: 'sw-skip', onclick: fn }, label);
    const steps = [];
    let i = 0; const go3 = () => steps[i++]();
    // 1. Bonjour dans toutes les langues
    steps.push(() => {
      const words = ['Bonjour', 'Hello', 'Hola', 'Ciao', 'Hallo', 'Olá', 'مرحبا', 'こんにちは', '안녕하세요', 'Привет', '你好', 'Merhaba'];
      const w = el('b', { class: 'sw-hello' }, words[0]); let k = 0;
      const iv = setInterval(() => { if (!w.isConnected) return clearInterval(iv); k = (k + 1) % words.length; w.classList.remove('in'); void w.offsetWidth; w.textContent = words[k]; w.classList.add('in'); }, 1300);
      timers.push(iv);
      page('hello', el('div', { class: 'sw-logo' }, ''), w, el('button', { class: 'sw-up', onclick: () => { clearInterval(iv); go3(); } }, el('span', {}, '⌃'), el('small', {}, 'Touche pour commencer')));
    });
    // 2. La langue
    steps.push(() => {
      const L = (window.Translator?.LANGS || [['fr', '🇫🇷 Français'], ['en', '🇬🇧 English']]).slice(0, 12);
      const list = el('div', { class: 'sw-list' }, ...L.map(([v, l]) => el('button', { class: 'sw-opt' + (draft.lang === v ? ' on' : ''), onclick: e => { draft.lang = v; list.querySelectorAll('.sw-opt').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l)));
      page('', el('div', { class: 'sw-ico' }, '🌐'), el('h2', {}, 'Choisis ta langue'), el('p', {}, 'Les messages des autres pourront être traduits dans cette langue.'), list, next('Continuer', go3));
    });
    // 3. La couleur du téléphone
    steps.push(() => {
      const prev = el('div', { class: 'sw-phone', style: `--fc:${FRAME_COLORS[draft.frame][1]}` }, el('i'));
      const lab = el('b', {}, FRAME_COLORS[draft.frame][0]);
      page('', el('h2', {}, 'Ton iPhone 18 Pro'), el('p', {}, 'Choisis sa couleur.'), prev, lab,
        el('div', { class: 'ph-frames sw-frames' }, ...Object.entries(FRAME_COLORS).map(([k, [n, c]]) => el('button', { class: 'ph-frame' + (draft.frame === k ? ' on' : ''), style: `--fc:${c}`, title: n, onclick: e => { draft.frame = k; prev.style.setProperty('--fc', c); lab.textContent = n; e.currentTarget.parentNode.querySelectorAll('.ph-frame').forEach(b => b.classList.toggle('on', b === e.currentTarget)); setOpt('frame', k); applyLook(); } }))),
        next('Continuer', go3));
    });
    // 4. Face ID
    steps.push(() => {
      const ring = el('div', { class: 'sw-face' }, el('span', {}, '🙂'), ...Array.from({ length: 24 }, (_, k) => el('i', { style: `--a:${k * 15}deg` })));
      const txt = el('p', {}, 'Bouge doucement la tête pour compléter le cercle.');
      const btn = el('button', { class: 'sw-btn', onclick: () => {
        btn.disabled = true; let k = 0; ring.classList.add('scan');
        const iv = setInterval(() => { const t = ring.querySelectorAll('i')[k++]; if (t) t.classList.add('ok'); if (k >= 24) { clearInterval(iv); ring.classList.add('done'); ring.querySelector('span').textContent = '✅'; txt.textContent = 'Face ID est configuré !'; try { navigator.vibrate?.([30, 40, 30]); } catch (e) {} draft.face = true; btn.textContent = 'Continuer'; btn.disabled = false; btn.onclick = go3; } }, 70);
        timers.push(iv);
      } }, 'Commencer');
      page('', el('h2', {}, 'Face ID'), txt, ring, el('div', { class: 'sw-foot' }, btn, skip('Configurer plus tard', go3)));
    });
    // 5. Le code
    steps.push(() => {
      let v = '', first = '';
      const t = el('h2', {}, 'Crée un code'), sub = el('p', {}, 'Un code à 4 chiffres protège ton téléphone.');
      const dots = el('div', { class: 'pin-dots sw-dots' }, ...[0, 1, 2, 3].map(() => el('i')));
      const press = k => {
        if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k;
        dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j < v.length));
        if (v.length < 4) return;
        setTimeout(() => {
          if (!first) { first = v; v = ''; t.textContent = 'Confirme ton code'; sub.textContent = 'Tape-le une deuxième fois.'; }
          else if (first === v) { draft.pin = v; go3(); return; }
          else { first = ''; v = ''; t.textContent = 'Les codes ne sont pas pareils'; sub.textContent = 'Recommence.'; dots.classList.add('bad'); setTimeout(() => dots.classList.remove('bad'), 500); }
          dots.querySelectorAll('i').forEach(d => d.classList.remove('on'));
        }, 150);
      };
      page('sw-pin', el('div', { class: 'sw-ico' }, '🔒'), t, sub, dots, el('div', { class: 'pin-keys sw-keys' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? el('button', { onclick: () => press(k) }, k) : el('span'))), skip('Ne pas mettre de code', go3));
    });
    // 6. Clair ou sombre
    steps.push(() => {
      const card = (v, l, bg, fg) => el('button', { class: 'sw-look' + (draft.theme === v ? ' on' : ''), onclick: e => { draft.theme = v; e.currentTarget.parentNode.querySelectorAll('.sw-look').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, el('div', { style: `background:${bg};color:${fg}` }, el('b', {}, '9:41'), el('i'), el('i')), el('small', {}, l));
      page('', el('h2', {}, 'Apparence'), el('p', {}, 'Choisis l\'apparence de tes applis.'), el('div', { class: 'sw-looks' }, card('clair', '☀️ Claire', '#f2f2f7', '#111'), card('sombre', '🌙 Sombre', '#1c1c1e', '#fff')), next('Continuer', go3));
    });
    // 7. Le fond d'écran
    steps.push(() => {
      page('', el('h2', {}, 'Fond d\'écran'), el('p', {}, 'Tu pourras mettre tes photos plus tard dans les Réglages.'),
        el('div', { class: 'ph-walls sw-walls' }, ...Object.entries(WALLS).slice(0, 12).map(([k, v]) => el('button', { class: 'ph-wall' + (draft.wall === k ? ' on' : ''), style: `background:${v}`, onclick: e => { draft.wall = k; e.currentTarget.parentNode.querySelectorAll('.ph-wall').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }))),
        next('Continuer', go3));
    });
    // 8. Les applis à installer
    steps.push(() => {
      const keys = Object.keys(STORE);
      const grid = el('div', { class: 'sw-apps' }, ...keys.map(k => el('button', { class: 'sw-app' + (draft.apps.includes(k) ? ' on' : ''), onclick: e => { draft.apps = draft.apps.includes(k) ? draft.apps.filter(x => x !== k) : [...draft.apps, k]; e.currentTarget.classList.toggle('on'); } }, icoEl(k), el('small', {}, APPS[k].name))));
      page('', el('h2', {}, 'Tes applis'), el('p', {}, 'Choisis les applis à mettre sur ton écran d\'accueil. Les autres restent dans l\'App Store.'), grid,
        next('Continuer', go3, skip('Tout prendre', () => { draft.apps = [...keys]; go3(); })));
    });
    // 9. Le nom
    steps.push(() => {
      const inp = el('input', { class: 'sw-input', maxlength: 40, value: draft.name });
      page('', el('div', { class: 'sw-ico' }, '✏️'), el('h2', {}, 'Le nom de ton iPhone'), el('p', {}, 'Tu pourras le changer quand tu veux.'), inp, next('Continuer', () => { draft.name = inp.value.trim() || draft.name; go3(); }));
    });
    // 10. Bienvenue !
    steps.push(() => {
      if (window.Translator && draft.lang && window.Translator.lang !== draft.lang) { window.Translator.lang = draft.lang; window.Translator.save?.(); }
      setOpt('frame', draft.frame); setOpt('theme', draft.theme); setOpt('wall', draft.wall); setOpt('name', draft.name); setOpt('faceid', draft.face ? '1' : '0');
      if (draft.pin) setOpt('pin', draft.pin);
      setInstalled(draft.apps); setOpt('setup', String(Date.now())); applyLook();
      page('hello sw-end', el('div', { class: 'sw-logo' }, ''), el('b', { class: 'sw-hello in' }, 'Bienvenue sur ton iPhone'), el('p', {}, `${draft.name} est prêt ✨`),
        el('button', { class: 'sw-up', onclick: () => { LC.confetti(['📱', '✨', '🎉']); done(); } }, el('span', {}, '⌃'), el('small', {}, 'Touche pour commencer')));
    });
    go3();
  }

  // =================== 🗂️ Multitâche (les applis récentes) ===================
  let recent = [];
  const markRecent = k => { if (SYSTEM.includes(k) && k === 'settings') {} recent = [k, ...recent.filter(x => x !== k)].slice(0, 8); };
  function switcher() {
    if (!recent.length) { home(); return toast('Aucune appli ouverte récemment'); }
    const cards = el('div', { class: 'sws-cards' }, ...recent.map(k => {
      const a = APPS[k]; let y0 = null;
      const c = el('div', { class: 'sws-card' }, el('div', { class: 'sws-top' }, icoEl(k, 'sws-ico'), el('b', {}, a.name)), el('button', { class: 'sws-shot', style: `--c:${a.c}`, onclick: () => { hideOverlay(); a.open(); } }, el('span', {}, a.icon), el('small', {}, 'Touche pour ouvrir')));
      c.addEventListener('pointerdown', e => { y0 = e.clientY; });
      c.addEventListener('pointerup', e => { if (y0 != null && y0 - e.clientY > 60) { c.classList.add('gone'); recent = recent.filter(x => x !== k); setTimeout(() => { c.remove(); if (!recent.length) hideOverlay(); }, 250); } y0 = null; });
      return c;
    }));
    showOverlay('sws', el('div', { class: 'sws-panel' }, cards, el('small', { class: 'cc-hint' }, 'Glisse une appli vers le haut pour la fermer')));
  }
  // =================== 🔍 Spotlight (la recherche) ===================
  function spotlight() {
    const res = el('div', { class: 'sp-res' });
    const SETTINGS = [['Fond d\'écran', wallPage], ['Sons et vibrations', soundPage], ['Luminosité et affichage', displayPage], ['Face ID et code', pinPage], ['Batterie', batteryPage], ['Notifications', notifPage], ['Date et heure', datePage], ['Stockage', storagePage], ['Mise à jour logicielle', updatePage], ['Confidentialité', privacyPage], ['Accessibilité', a11yPage]];
    const inp = el('input', { class: 'sp-in', placeholder: '🔍 Rechercher', autocomplete: 'off', oninput: () => draw() });
    const draw = () => {
      const q = inp.value.trim().toLowerCase(), out = [];
      if (/^[\d\s+\-*/().,]+$/.test(q) && /[+\-*/]/.test(q)) { try { const v = Function('"use strict";return (' + q.replace(/,/g, '.') + ')')(); if (Number.isFinite(v)) out.push(el('div', { class: 'sp-calc' }, el('small', {}, '🧮 Calculette'), el('b', {}, '= ' + String(Math.round(v * 1e6) / 1e6).replace('.', ',')))); } catch (e) {} }
      const apps = Object.keys(APPS).filter(k => APPS[k].name.toLowerCase().includes(q) || (STORE[k]?.[2] || '').toLowerCase().includes(q));
      if (apps.length) out.push(el('small', { class: 'sp-h' }, 'Applis'), el('div', { class: 'sp-apps' }, ...apps.slice(0, 8).map(k => el('button', { class: 'ph-appicon', onclick: () => { hideOverlay(); if (isInst(k)) { markRecent(k); APPS[k].open(); } else go(b => appPage(b, k), ''); } }, icoEl(k), el('small', {}, APPS[k].name)))));
      const fr = q ? friends().filter(u => u.username.toLowerCase().includes(q)).slice(0, 5) : [];
      if (fr.length) out.push(el('small', { class: 'sp-h' }, 'Contacts'), ...fr.map(u => el('button', { class: 'lock-notif', onclick: () => { hideOverlay(); go(b => conversation(b, u), u.username); } }, el('b', {}, '💬 Message'), el('span', {}, u.username))));
      const st = q ? SETTINGS.filter(([n]) => n.toLowerCase().includes(q)) : [];
      if (st.length) out.push(el('small', { class: 'sp-h' }, 'Réglages'), ...st.map(([n, fn]) => el('button', { class: 'lock-notif', onclick: () => { hideOverlay(); go(fn, n); } }, el('b', {}, '⚙️ Réglages'), el('span', {}, n))));
      if (!q) out.unshift(el('small', { class: 'sp-h' }, 'Suggestions Siri'));
      res.replaceChildren(...(out.length ? out : [el('div', { class: 'ph-wait', style: 'color:#fff' }, 'Aucun résultat')]));
    };
    showOverlay('nc', el('div', { class: 'sp-panel', onclick: e => e.stopPropagation() }, el('div', { class: 'sp-bar' }, inp, el('button', { class: 'sp-cancel', onclick: hideOverlay }, 'Annuler')), res));
    draw(); setTimeout(() => inp.focus(), 80);
  }
  // =================== 🔮 Siri ===================
  function siri() {
    hideOverlay();
    const say = el('div', { class: 'siri-say' }, 'Que puis-je faire pour toi ?');
    const you = el('div', { class: 'siri-you' });
    const answer = t => { say.textContent = t; if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[^\p{L}\p{N}\s,.'?!:%-]/gu, '')); u.lang = 'fr-FR'; u.rate = 1.05; speechSynthesis.speak(u); } };
    const run = q0 => {
      const q = q0.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); you.textContent = '« ' + q0 + ' »';
      const find = () => Object.keys(APPS).find(k => q.includes(APPS[k].name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')));
      let m;
      if (/heure/.test(q)) return answer(`Il est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
      if (/date|jour sommes|on est quel/.test(q)) return answer(`Nous sommes le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`);
      if (/meteo|temps qu|fait-il|fait il/.test(q)) { const d = new Date().getDate(); return answer(`Il fait ${18 + d % 9} degrés au Paradise, avec ${['du soleil', 'quelques nuages', 'des éclaircies'][d % 3]}.`); }
      if ((m = q.match(/minuteur (?:de )?(\d+)/))) { const n = +m[1]; setTimeout(() => { island(`⏰ Minuteur de ${n} min terminé !`); ringTone(); toast(`⏰ Minuteur de ${n} min terminé !`); }, n * 60000); return answer(`C'est parti, minuteur de ${n} minute${n > 1 ? 's' : ''}.`); }
      if (/blague/.test(q)) { const B = ['Pourquoi les plongeurs plongent-ils en arrière ? Parce que sinon ils tombent dans le bateau !', 'Que fait une fraise sur un cheval ? Tagada tagada !', 'Quel est le comble pour un électricien ? Ne pas être au courant.']; return answer(B[Math.floor(Math.random() * B.length)]); }
      if (/qui es|t'es qui|tu es qui/.test(q)) return answer('Je suis Siri, ton assistante sur The Paradise 💜');
      if (/merci/.test(q)) return answer('Avec plaisir !');
      if (/mode avion/.test(q)) { const on = !/desactive|enleve|coupe le/.test(q); setOpt('plane', on ? '1' : '0'); applyLook(); return answer(on ? 'Mode avion activé.' : 'Mode avion désactivé.'); }
      if (/lampe|torche/.test(q)) { setTimeout(() => APPS.torch.open(), 800); return answer('J\'allume la lampe.'); }
      if ((m = q.match(/(?:message|ecris|ecrire) (?:a |pour )?(\w+)/)) || (m = q.match(/appelle (\w+)/))) { const u = friends().find(f => f.username.toLowerCase().startsWith(m[1])); if (!u) return answer(`Je ne trouve pas ${m[1]} dans tes contacts.`); if (/appelle/.test(q)) { setTimeout(() => window.Call?.start(u, false), 900); return answer(`J'appelle ${u.username}.`); } setTimeout(() => { hideOverlay(); go(b => conversation(b, u), u.username); }, 900); return answer(`J'ouvre ta conversation avec ${u.username}.`); }
      const k = /ouvre|lance|va dans|montre/.test(q) || true ? find() : null;
      if (k) { if (!isInst(k)) return answer(`${APPS[k].name} n'est pas installée. Elle est dans l'App Store.`); setTimeout(() => { hideOverlay(); markRecent(k); APPS[k].open(); }, 700); return answer(`J'ouvre ${APPS[k].name}.`); }
      answer('Je n\'ai pas bien compris. Essaie : « quelle heure est-il », « ouvre la calculette », « minuteur de 5 minutes », « raconte une blague »…');
    };
    const inp = el('input', { class: 'siri-in', placeholder: 'Écris à Siri…', onkeydown: e => { if (e.key === 'Enter' && inp.value.trim()) { run(inp.value.trim()); inp.value = ''; } } });
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = R ? el('button', { class: 'siri-mic', onclick: () => { const r = new R(); r.lang = 'fr-FR'; orb.classList.add('listen'); r.onresult = e => run(e.results[0][0].transcript); r.onend = () => orb.classList.remove('listen'); try { r.start(); } catch (e) {} } }, '🎙️') : null;
    const orb = el('div', { class: 'siri-orb' });
    showOverlay('siri', el('div', { class: 'siri-panel', onclick: e => e.stopPropagation() }, say, you, el('div', { class: 'siri-sug' }, ...['Quelle heure est-il ?', 'Ouvre la calculette', 'Raconte une blague', 'Minuteur de 3 minutes'].map(t => el('button', { onclick: () => run(t) }, t))), el('div', { class: 'siri-row' }, inp, mic), orb));
    try { navigator.vibrate?.(20); } catch (e) {}
    setTimeout(() => inp.focus(), 100);
  }
  // =================== 📚 La bibliothèque d'apps (la dernière page) ===================
  function appLibrary() {
    const inst = [...SYSTEM, ...installed()].filter(k => APPS[k]);
    const cats = {};
    for (const k of inst) { const c = STORE[k]?.[1] || (['messages', 'phone', 'snap', 'contacts'].includes(k) ? 'Réseaux sociaux' : 'Utilitaires'); (cats[c] = cats[c] || []).push(k); }
    return el('div', { class: 'ph-grid al' }, el('div', { class: 'al-search', onclick: spotlight }, '🔍 Bibliothèque d\'apps'),
      ...Object.entries(cats).map(([c, ks]) => el('div', { class: 'al-box' }, el('div', { class: 'al-icons' }, ...ks.slice(0, 4).map(k => el('button', { onclick: () => { markRecent(k); APPS[k].open(); } }, icoEl(k)))), el('small', {}, c))));
  }

  // =================== ⚙️ Les nouveaux réglages ===================
  function notifPage(body) {
    body.replaceChildren(el('div', { class: 'ios' }, el('h4', { class: 'ios-head' }, 'AFFICHER LES ALERTES DE'),
      group(...['messages', 'snap', 'phone', 'shop', 'games', 'city', 'quests', 'pet', 'clock'].filter(k => isInst(k)).map(k => el('div', { class: 'ios-row' }, icoEl(k, 'ios-appico'), el('span', { class: 'ios-lbl' }, APPS[k].name), sw('notif_' + k, '1')))),
      group(row('🔔', '#ff3b30', 'Aperçus des messages', sw('preview', '1')), row('📳', '#ff9500', 'Vibrer pour les alertes', sw('vibe', '1')))));
  }
  function datePage(body) {
    body.replaceChildren(el('div', { class: 'ios' }, group(row('🕐', '#8e8e93', 'Format 24 heures', sw('h24', '1', () => { const t = root.querySelector('.ph-time'); if (t) t.textContent = time(); })), row('🌍', '#007aff', 'Réglage automatique', sw('autotime', '1'))),
      el('div', { class: 'ios-card' }, el('small', {}, 'Fuseau horaire : Paris'), el('b', { class: 'ios-big' }, time()), el('small', {}, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))));
  }
  function storagePage(body) {
    const inst = [...SYSTEM, ...installed()].filter(k => APPS[k]), size = k => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 997; return 0.15 + h / 997 * 2.4; };
    const used = inst.reduce((s, k) => s + size(k), 0) + 23.4, tot = 1024;
    const C = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('small', {}, 'iPhone'), el('b', {}, `${used.toFixed(1)} Go utilisés sur ${tot} Go`),
      el('div', { class: 'st-bar' }, el('i', { style: 'width:2.3%;background:#8e8e93' }), ...inst.slice(0, 6).map((k, i) => el('i', { style: `width:${size(k) / tot * 100 * 6}%;background:${C[i]}` })))),
      el('h4', { class: 'ios-head' }, 'APPLIS'), group(...inst.sort((a, b) => size(b) - size(a)).map(k => el('div', { class: 'ios-row' }, icoEl(k, 'ios-appico'), el('span', { class: 'ios-lbl' }, APPS[k].name), el('span', { class: 'ios-val' }, size(k).toFixed(1) + ' Go'))))));
  }
  function privacyPage(body) {
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('span', { class: 'ios-face' }, '✋'), el('small', {}, 'Ton iPhone Paradise ne vend jamais tes données. Choisis ce que les applis peuvent utiliser.')),
      group(row('📍', '#007aff', 'Localisation', sw('p_loc', '0')), row('📷', '#8e8e93', 'Appareil photo', sw('p_cam', '1')), row('🎙️', '#ff9500', 'Micro', sw('p_mic', '1')), row('🖼️', '#ff2d55', 'Photos', sw('p_photos', '1')), row('🚫', '#5856d6', 'Demander aux applis de ne pas me suivre', sw('p_track', '1')))));
  }
  function a11yPage(body) {
    body.replaceChildren(el('div', { class: 'ios' }, group(row('🔠', '#007aff', 'Texte en gras', sw('bold', '0')), row('🔍', '#34c759', 'Loupe (zoom)', sw('zoom', '0')), row('🧘', '#5856d6', 'Réduire les animations', sw('eco', '0')), row('◐', '#111', 'Contraste augmenté', sw('hc', '0'))),
      group(row('♿', '#007aff', 'Accessibilité du site', null, () => { close(); window.A11y?.open(); }))));
  }
  function updatePage(body) {
    const cur = opt('osv', '18.2'), nextV = (+cur.split('.')[1] + 1);
    const card = el('div', { class: 'ios-card' });
    const idle = () => card.replaceChildren(el('div', { class: 'ph-about-ico', style: 'font-size:40px' }, '⚙️'), el('b', {}, `Paradise OS 18.${nextV}`), el('small', {}, 'Nouveautés : des icônes encore plus belles, des corrections et plein de petites surprises ✨'), el('button', { class: 'sw-btn', onclick: dl }, 'Télécharger et installer'));
    const dl = () => {
      let p = 0; const bar = el('div', { class: 'st-bar' }, el('i', { style: 'width:0%;background:#007aff' })), lab = el('small', {}, 'Téléchargement…');
      card.replaceChildren(el('b', {}, `Paradise OS 18.${nextV}`), bar, lab);
      const iv = setInterval(() => { p += 4 + Math.random() * 7; bar.firstChild.style.width = Math.min(100, p) + '%'; lab.textContent = p < 100 ? `Téléchargement… ${Math.min(99, Math.round(p))} %` : 'Préparation…'; if (p >= 100) { clearInterval(iv); setTimeout(reboot, 900); } }, 160);
      timers.push(iv);
    };
    const reboot = () => {
      setOpt('osv', '18.' + nextV);
      screen.style.background = '#000'; dark(true);
      const b = el('div', { class: 'st-bar boot' }, el('i', { style: 'width:0%;background:#fff' }));
      screen.replaceChildren(el('div', { class: 'boot-scr' }, el('div', { class: 'boot-logo' }, ''), b));
      let p = 0; const iv = setInterval(() => { p += 3 + Math.random() * 5; b.firstChild.style.width = Math.min(100, p) + '%'; if (p >= 100) { clearInterval(iv); setTimeout(() => { unlocked = false; lockScreen(() => { home(); island(`✅ Paradise OS 18.${nextV} installé`); }); }, 600); } }, 140);
    };
    body.replaceChildren(el('div', { class: 'ios' }, el('div', { class: 'ios-card' }, el('small', {}, 'Version actuelle'), el('b', {}, 'Paradise OS ' + cur)), card, group(row('🔄', '#34c759', 'Mises à jour automatiques', sw('autoupd', '1')))));
    idle();
  }
  // =================== 🖐️ Gestes, Centre de contrôle, Centre de notifications, boutons ===================
  let closedAt = 0, screenOff = false, homePage = 0, sideT = 0, sideLong = false;
  function swipeDown(elm, fn) { let y0 = null; elm.addEventListener('pointerdown', e => { y0 = e.clientY; elm.setPointerCapture?.(e.pointerId); }); elm.addEventListener('pointerup', e => { if (y0 == null) return; const d = e.clientY - y0; y0 = null; if (d > 25 || Math.abs(d) < 6) fn(); }); }
  // 🏝️ la Dynamic Island « vivante » : quand la radio joue, elle montre la musique en cours
  setInterval(() => {
    const i = root?.querySelector('.ph-island'); if (!i || !isOpen()) return;
    const on = !!(window.Media?.playing && opt('island', '1') === '1');
    i.classList.toggle('live', on);
    let lv = i.querySelector('.ph-live'); if (on && !lv) { lv = el('span', { class: 'ph-live' }, el('span', { class: 'ph-live-ico' }, '📻'), el('span', { class: 'ph-live-eq' }, el('i'), el('i'), el('i'), el('i'))); i.append(lv); } else if (!on && lv) lv.remove();
  }, 1500);
  function setupGestures() {
    swipeDown(root.querySelector('.ph-edge-l'), () => !screenOff && !screen.querySelector('.lock') && notifCenter());
    swipeDown(root.querySelector('.ph-edge-r'), () => !screenOff && controlCenter());
    // la barre du bas
    const hb = root.querySelector('.ph-homebar'); let y0 = null;
    hb.addEventListener('pointerdown', e => { y0 = e.clientY; hb.setPointerCapture?.(e.pointerId); });
    hb.addEventListener('pointerup', e => { if (y0 == null) return; const d = y0 - e.clientY; y0 = null; if (d < -10) return; if (d > 110 && !screen.querySelector('.lock') && !screen.querySelector('.sw')) return switcher(); /* grand glissé vers le haut = multitâche */ if (!root.querySelector('.ph-overlay').classList.contains('hidden')) return hideOverlay(); if (screen.querySelector('.lock')) return; if (jiggle) { jiggle = false; return home(); } if (screen.querySelector('.ph-home')) { close(); showReturn(); return; } home(); });
    // glisser vers le bas au milieu de l'accueil = Spotlight
    let sy = null; screen.addEventListener('pointerdown', e => { sy = screen.querySelector('.ph-home') && !jiggle && !e.target.closest('.ph-appicon, .wdg, .ph-dock') ? e.clientY : null; }); screen.addEventListener('pointerup', e => { if (sy != null && e.clientY - sy > 70) spotlight(); sy = null; });
    // depuis le bord gauche d'une appli : glisser vers la droite = retour
    let x0 = null, ya = 0;
    screen.addEventListener('pointerdown', e => { const r = screen.getBoundingClientRect(); x0 = e.clientX - r.left < 24 ? e.clientX : null; ya = e.clientY; });
    screen.addEventListener('pointerup', e => { if (x0 != null && e.clientX - x0 > 70 && Math.abs(e.clientY - ya) < 60 && stack.length) back(); x0 = null; });
  }
  const overlay = () => root.querySelector('.ph-overlay');
  function hideOverlay() { const o = root?.querySelector('.ph-overlay'); if (o && !o.classList.contains('hidden')) { o.classList.add('hidden'); o.replaceChildren(); } }
  function showOverlay(cls, ...kids) { const o = overlay(); o.className = 'ph-overlay ' + cls; o.replaceChildren(...kids); o.onclick = e => { if (e.target === o) hideOverlay(); }; }
  function controlCenter() {
    const tile = (ico, label, on, fn, c = '#007aff') => el('button', { class: 'cc-t' + (on ? ' on' : ''), style: `--c:${c}`, onclick: e => { e.stopPropagation(); fn(e.currentTarget); } }, el('span', {}, ico), el('small', {}, label));
    const toggle = (key, def, b) => { const v = opt(key, def) === '1' ? '0' : '1'; setOpt(key, v); b.classList.toggle('on', v === '1'); applyLook(); };
    const slider = (ico, key, def, min, oninput) => { const max = key === 'vol' ? 10 : 100, pc = v => `${(v - min) / (max - min) * 100}%`; const box = el('div', { class: 'cc-slider', style: `--v:${pc(+opt(key, def))}` }, el('input', { type: 'range', min, max, value: opt(key, def), oninput: e => { setOpt(key, e.target.value); box.style.setProperty('--v', pc(+e.target.value)); oninput && oninput(); applyLook(); } }), el('span', {}, ico)); return box; };
    const media = window.Media;
    showOverlay('cc',
      el('div', { class: 'cc-panel', onclick: e => e.stopPropagation() },
        el('div', { class: 'cc-grid' },
          el('div', { class: 'cc-box' }, tile('✈️', 'Avion', opt('plane', '0') === '1', b => toggle('plane', '0', b), '#ff9500'), tile('📶', 'Données', opt('data', '1') === '1', b => toggle('data', '1', b), '#34c759'), tile('🛜', 'Wi‑Fi', opt('wifi', '1') === '1', b => toggle('wifi', '1', b)), tile('🔵', 'Bluetooth', opt('bt', '1') === '1', b => toggle('bt', '1', b))),
          el('div', { class: 'cc-box cc-music' }, el('small', {}, media?.playing ? '🔊 En écoute' : '📻 Radio'), el('b', {}, media?.current?.name || 'Aucune radio'), el('div', {}, el('button', { onclick: e => { e.stopPropagation(); if (media) { media.toggle(); setTimeout(controlCenter, 500); } } }, media?.playing ? '⏸' : '▶️'))),
          tile('🌙', 'Concentration', state.me.presence === 'dnd', b => { const on = state.me.presence !== 'dnd'; window.setPresence?.(on ? 'dnd' : 'auto'); b.classList.toggle('on', on); }, '#5856d6'),
          tile('🔒', 'Verrouiller', false, () => power(), '#8e8e93'),
          slider('🔆', 'bright', '100', 35), slider('🔊', 'vol', '7', 0, () => ringTone()),
          tile('🗂️', 'Multitâche', false, () => switcher(), '#8e8e93'), tile('🔮', 'Siri', false, () => siri(), '#af52de'), tile('🔦', 'Lampe', false, () => APPS.torch.open()), tile('⏰', 'Minuteur', false, () => APPS.clock.open()), tile('🧮', 'Calculs', false, () => APPS.calc.open()), tile('📷', 'Photo', false, () => APPS.camera.open())),
        el('small', { class: 'cc-hint' }, 'Touche en dehors pour fermer')));
  }
  async function notifCenter() {
    const list = el('div', { class: 'nc-list' }, el('div', { class: 'ph-wait' }, 'Chargement…'));
    showOverlay('nc', el('div', { class: 'nc-panel', onclick: e => e.stopPropagation() }, el('b', { class: 'lock-time' }, time()), el('small', { class: 'lock-date' }, new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })), list,
      el('button', { class: 'nc-clear', onclick: () => { api('/api/notifications/read', { method: 'POST' }).catch(() => {}); list.replaceChildren(el('div', { class: 'ph-wait' }, 'Aucune notification 🎉')); } }, 'Tout effacer')));
    try {
      const d = await api('/api/notifications');
      list.replaceChildren(...(d.notifications.length ? d.notifications.slice(0, 20).map(x => el('button', { class: 'lock-notif' + (x.read ? '' : ' new'), onclick: () => { hideOverlay(); if (x.data?.userId) go(b => conversation(b, { id: x.data.userId, username: x.title.split(' ')[0] }), x.title.split(' ')[0]); else if (x.data?.slug) { close(); joinRoom(x.data.slug); } } }, el('b', {}, `${x.icon} The Paradise · ${ago(x.createdAt)}`), el('span', {}, x.title), x.text ? el('small', {}, x.text) : null)) : [el('div', { class: 'ph-wait' }, 'Aucune notification 🎉')]));
    } catch (e) { list.replaceChildren(el('div', { class: 'ph-wait' }, e.message)); }
  }
  // 🔊 les boutons de volume (avec la petite barre qui apparaît)
  function volume(dir) {
    const v = Math.max(0, Math.min(10, +opt('vol', '7') + dir)); setOpt('vol', String(v));
    if (window.Media?.audio) { Media.volume = v / 10; Media.audio.volume = v / 10; }
    const h = root.querySelector('.ph-hud'); h.classList.remove('hidden'); h.replaceChildren(el('span', {}, v ? '🔊' : '🔇'), el('i', {}, el('b', { style: `height:${v * 10}%` })));
    clearTimeout(h._t); h._t = setTimeout(() => h.classList.add('hidden'), 1300);
    if (dir > 0) ringTone();
  }
  // ⏻ le bouton latéral : l'écran s'éteint (et se reverrouille) ; on rappuie pour le rallumer
  function power() {
    const d = root.querySelector('.ph-device');
    if (screenOff) { screenOff = false; d.classList.remove('off'); unlocked = false; closedAt = 0; lockScreen(home); return; }
    screenOff = true; unlocked = false; hideOverlay(); stopCam(); clearTimers(); d.classList.add('off'); try { navigator.vibrate?.(15); } catch (e) {}
  }

  // ---------- ↩️ Le bouton pour revenir au téléphone après avoir ouvert une appli ----------
  let retBtn = null;
  function showReturn() {
    if (!retBtn) { retBtn = el('button', { class: 'ph-return', onclick: () => {
      hideReturn();
      document.querySelectorAll('.modal-back').forEach(m => m.remove());
      if (document.body.classList.contains('hub-open')) Hub.close();
      $('notifPanel')?.classList.add('hidden');
      open();
    } }, el('span', {}, '📱'), el('em', {}, 'Retour au téléphone')); document.body.append(retBtn); dragRet(retBtn); }
    // petite bulle ronde : le texte s'affiche 2 secondes puis disparaît (et on peut la déplacer avec le doigt)
    retBtn.classList.remove('hidden'); retBtn.classList.add('wide');
    clearTimeout(retBtn._t); retBtn._t = setTimeout(() => retBtn.classList.remove('wide'), 2200);
  }
  function dragRet(b) {
    try { const p = JSON.parse(localStorage.getItem('ph_ret_pos') || 'null'); if (p) { b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; } } catch (e) {}
    let d = null;
    b.addEventListener('pointerdown', e => { const r = b.getBoundingClientRect(); d = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false, id: e.pointerId }; });
    window.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 8) return;
      if (!d.moved) { d.moved = true; try { b.setPointerCapture(e.pointerId); } catch (err) {} b.classList.remove('wide'); }
      const x = Math.max(4, Math.min(innerWidth - b.offsetWidth - 4, d.ox + dx)), y = Math.max(4, Math.min(innerHeight - b.offsetHeight - 4, d.oy + dy));
      Object.assign(b.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    });
    window.addEventListener('pointerup', () => { if (d?.moved) { try { localStorage.setItem('ph_ret_pos', JSON.stringify({ x: parseInt(b.style.left, 10), y: parseInt(b.style.top, 10) })); } catch (e) {} b._drag = Date.now(); } d = null; });
    b.addEventListener('click', e => { if (b._drag && Date.now() - b._drag < 300) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  function hideReturn() { retBtn?.classList.add('hidden'); }
  // ---------- Petits outils ----------
  function avatarOn(u, online) { const a = LC.avatar(u); if (online) a.append(el('span', { class: 'on' })); return a; }
  function ping(text, onclick) { if (opt('plane', '0') === '1') return; if (/^💬/.test(text) && opt('notif_messages', '1') === '0') return; if (/^👻|👀/.test(text) && opt('notif_snap', '1') === '0') return; if (opt('preview', '1') === '0') text = text.split(':')[0]; ringTone(); island(text); const n = el('div', { class: 'ph-ping', onclick: () => { n.remove(); onclick && onclick(); } }, el('b', {}, '📱 The Paradise'), el('span', {}, text)); screen.append(n); setTimeout(() => n.remove(), 4500); }
  // 🏝️ La Dynamic Island : elle s'agrandit pour afficher une alerte
  function island(text) { const i = root?.querySelector('.ph-island'); if (!i || opt('island', '1') !== '1') return; i.querySelector('.ph-island-txt').textContent = text; i.classList.add('big'); clearTimeout(i._t); i._t = setTimeout(() => i.classList.remove('big'), 3200); }
  function pickFriend(title, cb) { go(body => body.replaceChildren(...(friends().length ? friends().map(u => el('button', { class: 'ph-row', onclick: () => cb(u) }, avatarOn(u, u.online), el('div', { class: 'ph-row-txt' }, el('b', {}, u.username)))) : [el('div', { class: 'ph-wait' }, 'Ajoute des amis d\'abord 🤝')])), title); }
  setTimeout(refreshBadges, 3000);
  return { open, close, isOpen, refreshBadges };
})();
window.Phone = Phone;
$('phoneBtn').onclick = () => (Phone.isOpen() ? Phone.close() : Phone.open());
