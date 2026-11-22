// The Paradise — profils personnalisables : carte de profil + éditeur avec aperçu en direct
const SOCIAL_DEFS = {
  discord: { label: 'Discord', color: '#5865f2', ph: 'pseudo' },
  twitch: { label: 'Twitch', color: '#9146ff', ph: 'chaîne', url: h => 'https://www.twitch.tv/' + h },
  youtube: { label: 'YouTube', color: '#ff0033', ph: 'chaîne', url: h => 'https://www.youtube.com/@' + h },
  tiktok: { label: 'TikTok', color: '#111111', ph: 'pseudo', url: h => 'https://www.tiktok.com/@' + h },
  instagram: { label: 'Instagram', color: '#e1306c', ph: 'pseudo', url: h => 'https://www.instagram.com/' + h },
  steam: { label: 'Steam', color: '#1b2838', ph: 'identifiant', url: h => 'https://steamcommunity.com/' + (/^\d{17}$/.test(h) ? 'profiles/' : 'id/') + h },
  psn: { label: 'PSN', color: '#0070d1', ph: 'ID en ligne' },
  xbox: { label: 'Xbox', color: '#107c10', ph: 'gamertag' },
};
const NAME_FX = [['none', 'Normal'], ['gradient', 'Dégradé'], ['glow', 'Néon'], ['rainbow', 'Arc-en-ciel'], ['gold', 'Or']];
// ✨ Les animations de la photo de profil (marchent sur toutes les photos, même une photo normale)
const AVATAR_FX_UI = [['none', 'Aucune'], ['bounce', '🏀 Rebond'], ['pulse', '💓 Battement'], ['float', '🎈 Flotte'], ['wiggle', '👋 Coucou'], ['spin', '🌀 Tourne'], ['zoom', '🔍 Zoom'], ['rainbow', '🌈 Arc-en-ciel'], ['neon', '💡 Néon'], ['glitter', '✨ Paillettes'], ['hearts', '💖 Cœurs'], ['flames', '🔥 Flammes']];
const FRAMES_UI = [['none', 'Aucun'], ['neon', 'Néon'], ['gold', 'Or'], ['rainbow', 'Arc-en-ciel'], ['fire', 'Feu'], ['ice', 'Glace']];
// Les effets et cadres exclusifs achetés dans la boutique 💰
const PREMIUM_FX = { galaxy: '🌌 Galaxie', fire: '🔥 En feu', ice: '❄️ Glacé', glitter: '✨ Paillettes', pulse: '💡 Néon pulsé', matrix: '💻 Hacker', gold: '🏆 Or', rainbow: '🌈 Arc-en-ciel', ocean: '🌊 Océan', candy: '🍬 Bonbon', lava: '🌋 Lave', aurora: '🌌 Aurore boréale', toxic: '☢️ Toxique', love: '💗 Love', chrome: '🪙 Chrome', sunset: '🌅 Coucher de soleil' };
const PREMIUM_FRAMES = { diamond: '💎 Diamant', galaxy: '🌌 Galaxie', hearts: '💖 Cœurs', crown: '👑 Royal', electric: '⚡ Électrique', sakura: '🌸 Sakura', fire: '🔥 Flammes', ocean: '🌊 Océan', rainbow: '🌈 Arc-en-ciel', gold: '🏆 Or massif', butterfly: '🦋 Papillon', stars: '⭐ Étoilé', frost: '❄️ Givré', cupid: '💘 Cupidon', neon: '💜 Néon violet', spooky: '👻 Hanté', money: '💸 Billets', planet: '🪐 Planète' };
const ownedOf = (prefix, names) => (state.me?.owned || []).filter(id => id.startsWith(prefix)).map(id => id.slice(prefix.length)).filter(v => names[v]).map(v => [v, names[v]]);
const STATUS_EMOJIS = ['', '🎮', '🎧', '😴', '🔥', '💜', '😎', '🍕', '📚', '💼', '🏆', '🤔', '😂', '🌙', '✈️', '🎬'];
const COLOR_SWATCHES = ['#8b6cff', '#ff5fa2', '#ffb547', '#33d6a6', '#4fb3ff', '#ff7a59', '#c86bff', '#f2e94e', '#ffffff', '#ff4d4d'];

// ---------- Carte de profil (utilisée pour les autres et pour l'aperçu) ----------
function profileCard(u, opts = {}) {
  const socials = Object.entries(u.socials || {}).filter(([k, h]) => SOCIAL_DEFS[k] && h);
  const info = [LC.genderLabel(u.gender), u.age ? u.age + ' ans' : '', u.city].filter(Boolean).join(' · ');
  return el('div', { class: 'pcard' + (u.profileFx ? ' pfx pfx-' + u.profileFx : ''), style: `--accent:${u.accent || '#ff5fa2'}` },
    u.profileFx ? profileFxLayer(u.profileFx) : null,
    el('i', { class: 'pshine' }),
    el('div', { class: 'pbanner', style: `background:${LC.bannerCss(u)}` }),
    el('div', { class: 'pbody' },
      el('div', { class: 'pavatar' }, LC.avatar(u, true)),
      el('div', { class: 'pname' }, LC.name(u), ' ', LC.badge(u), (typeof state !== 'undefined' && (state.customs?.enabled || state.customs?.media) && !['admin', 'superadmin', 'moderator'].includes(u.role)) ? LC.douaneBadges(u) : u.avatar ? LC.photoBadge(u) : null),
      u.isBirthday ? el('div', { class: 'pbday' }, '🎉 C\'est son anniversaire aujourd\'hui ! 🎂') : null,
      u.statusEmoji || u.statusText ? el('div', { class: 'pstatus' }, `${u.statusEmoji || ''} ${u.statusText || ''}`.trim()) : null,
      u.level ? el('div', { class: 'plevel' }, `⭐ Niveau ${u.level}`) : null,
      el('div', { class: 'pinfo' }, info, opts.online !== undefined ? el('span', {}, opts.online ? ' · 🟢 En ligne' : ' · ⚪ Hors ligne') : null),
      u.birthday ? el('div', { class: 'pinfo' }, `🎂 Anniversaire : ${u.birthday.day} ${LC.MONTHS[u.birthday.month - 1]}`) : null,
      el('div', { class: 'psection' }, el('h5', {}, 'À propos'), el('div', { class: 'pbio' }, u.bio || 'Aucune description pour l\'instant.')),
      u.profileMusic ? el('div', { class: 'psection' }, el('h5', {}, '🎵 Ma musique'), profileMusic(u.profileMusic)) : null,
      opts.gallery?.length ? el('div', { class: 'psection' }, el('h5', {}, `🖼️ Mes photos (${opts.gallery.length})`), el('div', { class: 'pgallery' }, ...opts.gallery.map(g => el('button', { type: 'button', class: 'pgal' + (g.ok ? '' : ' wait'), title: g.ok ? 'Agrandir' : 'En attente de vérification', onclick: () => photoZoom(g.url) }, el('img', { src: g.url, alt: '', loading: 'lazy' }), g.ok ? null : el('span', {}, '⏳'))))) : null,
      u.identity ? el('div', { class: 'pinfo' }, `${LC.identityHeart(u.identity)} ${LC.identityLabel(u.identity)}`) : null,
      u.likes?.length ? el('div', { class: 'psection' }, el('h5', {}, '💬 Ce que j\'aime'), el('div', { class: 'ptags' }, ...u.likes.map(t => el('span', { class: 'ptag like' }, t)))) : null,
      u.interests?.length ? el('div', { class: 'psection' }, el('h5', {}, '✨ Centres d\'intérêt'),
        el('div', { class: 'ptags' }, ...u.interests.map(t => el('span', { class: 'ptag' }, t)))) : null,
      u.games?.length ? el('div', { class: 'psection' }, el('h5', {}, '🎮 Jeux du moment'),
        el('div', { class: 'ptags' }, ...u.games.map(t => el('span', { class: 'ptag game' }, t)))) : null,
      socials.length ? el('div', { class: 'psection' }, el('h5', {}, '🔗 Réseaux'),
        el('div', { class: 'psocials' }, ...socials.map(([k, h]) => {
          const d = SOCIAL_DEFS[k];
          const label = `${d.label} · ${h}`;
          return d.url
            ? el('a', { class: 'psocial', href: d.url(encodeURIComponent(h)), target: '_blank', rel: 'noopener noreferrer nofollow', style: `--s:${d.color}` }, label)
            : el('button', { class: 'psocial', style: `--s:${d.color}`, title: 'Copier', onclick: () => { navigator.clipboard?.writeText(h); toast(`📋 ${d.label} copié : ${h}`); } }, label);
        }))) : null,
      opts.pet ? el('div', { class: 'psection' }, el('h5', {}, '🐾 Son animal'), el('div', { class: 'ppet' }, el('span', { class: 'ppet-ico stage-' + opts.pet.stage }, opts.pet.icon, opts.pet.accIcon ? el('i', {}, opts.pet.accIcon) : null), el('div', {}, el('b', {}, opts.pet.name), el('small', {}, `${opts.pet.speciesName} · ${opts.pet.stageName} · ${opts.pet.moodIcon} ${opts.pet.moodText}`)))) : null,
      opts.progress?.achievements?.length ? el('div', { class: 'psection' }, el('h5', {}, `🏆 Succès (${opts.progress.achievements.length})`), el('div', { class: 'pach' }, ...opts.progress.achievements.map(a => el('span', { class: 'pach-i', title: `${a.name} : ${a.desc}` }, a.icon)))) : null,
      u.createdAt ? el('div', { class: 'psince' }, (u.isGuest ? 'Invité depuis le ' : 'Membre depuis le ') + new Date(u.createdAt).toLocaleDateString('fr-FR')) : null));
}

// ✨ le fond animé du profil
const PROFILE_FX_UI = [['', '🚫 Aucun'], ['stars', '⭐ Étoiles'], ['hearts', '💖 Cœurs'], ['aurora', '🌌 Aurore'], ['bubbles', '🫧 Bulles'], ['fire', '🔥 Flammes'], ['snow', '❄️ Neige'], ['matrix', '💻 Matrix'], ['confetti', '🎉 Confettis']];
function profileFxLayer(fx) {
  const G = { stars: ['✦', '✧', '⋆'], hearts: ['💖', '💕', '💗'], bubbles: ['', '', ''], fire: ['🔥', '✨', '🔥'], snow: ['❄', '❅', '❆'], matrix: ['0', '1', 'ア', 'カ', '1'], confetti: ['🎉', '🎊', '✨'], aurora: [] }[fx] || [];
  return el('div', { class: 'pfx-layer', 'aria-hidden': 'true' }, ...(fx === 'aurora' ? [el('i', { class: 'pfx-aur' }), el('i', { class: 'pfx-aur two' })] : Array.from({ length: 12 }, (_, i) => el('span', { style: `left:${(i * 37 + 5) % 95}%;animation-delay:${-(i * 1.3) % 9}s;animation-duration:${6 + (i % 4) * 1.6}s;font-size:${16 + (i % 3) * 7}px` }, G[i % G.length] || ''))));
}
// 🎵 la musique du profil : un bouton pour écouter (le son ne se lance jamais tout seul)
function profileMusic(id) {
  const box = el('div', { class: 'pmusic' });
  const play = el('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => { box.replaceChildren(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, allow: 'autoplay; encrypted-media', allowfullscreen: true, title: 'Musique du profil' })); } }, '▶️ Écouter');
  box.append(el('img', { src: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt: '', loading: 'lazy' }), play);
  return box;
}
function photoZoom(url) { const c = modal(el('img', { src: url, alt: '', class: 'pzoom', onclick: () => c() })); }
// Ouvre une fenêtre avec un style "profil" (plus large, sans marge intérieure)
function profileModal(...content) {
  const close = modal(...content);
  const all = document.querySelectorAll('.modal-back .modal');
  all[all.length - 1].classList.add('profile-modal');
  // 🃏 la carte s'incline et suit la souris, avec un reflet de lumière
  const card = all[all.length - 1].querySelector('.pcard');
  if (card && matchMedia('(pointer: fine)').matches && !document.documentElement.classList.contains('lite')) {
    card.classList.add('tilt');
    card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; card.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`; card.style.setProperty('--sx', (x + .5) * 100 + '%'); card.style.setProperty('--sy', (y + .5) * 100 + '%'); });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
  return close;
}

// ---------- Profil d'un autre utilisateur ----------
async function openProfile(id) {
  if (id === state.me.id) return openMyProfile();
  let data;
  try { data = await api('/api/users/' + id); } catch (e) { return toast(e.message); }
  const u = data.user;
  const blocked = state.blocked.has(u.id);
  const staff = isStaff() && (state.me.role === 'superadmin' || LC.rank(state.me) > LC.rank(u));
  const close = profileModal(
    profileCard(u, { online: data.online, pet: data.pet, progress: data.progress, gallery: data.gallery }),
    el('div', { class: 'pactions' },
      el('div', { class: 'actions' },
        u.isBirthday ? el('button', { class: 'btn btn-primary', style: 'flex-basis:100%', onclick: () => { close(); wishBirthday(u); } }, '🎂 Lui souhaiter un joyeux anniversaire') : null,
        el('button', { class: 'btn btn-primary', onclick: () => { close(); openPm(u); } }, '💌 Message privé'),
        u.isGuest || state.me.isGuest ? null : friendButton(u, data.friend, () => close()),
        el('button', { class: 'btn', disabled: !data.online, title: data.online ? '' : 'Hors ligne', onclick: () => { close(); Call.start(u, false); } }, '📞 Appeler'),
        el('button', { class: 'btn', disabled: !data.online, title: data.online ? '' : 'Hors ligne', onclick: () => { close(); Call.start(u, true); } }, '📹 Visio'),
        el('button', { class: 'btn', onclick: () => { close(); mention(u.username); } }, '@ Mentionner'),
        el('button', { class: 'btn', onclick: async () => {
          try {
            await api('/api/blocks/' + u.id, { method: blocked ? 'DELETE' : 'POST' });
            blocked ? state.blocked.delete(u.id) : state.blocked.add(u.id);
            toast(blocked ? `${u.username} débloqué` : `${u.username} bloqué`);
            close(); renderUsers(); renderConvs();
          } catch (e) { toast(e.message); }
        } }, blocked ? '✅ Débloquer' : '🚫 Bloquer'),
        el('button', { class: 'btn', onclick: () => { close(); openReport(u); } }, '⚠️ Signaler'),
        isUserMuted(u.id)
          ? el('button', { class: 'btn', onclick: () => { close(); unmuteUser(u); } }, '🔊 Fin de sourdine ', el('small', { 'data-mute-left': u.id }, '🔇 ' + muteLeftText(u.id)))
          : el('button', { class: 'btn', title: 'Ne plus voir ses messages pendant un moment', onclick: () => { close(); openMutePicker(u); } }, '🔇 Sourdine'),
        el('button', { class: 'btn', disabled: !data.online, onclick: () => { close(); challengeUser(u); } }, '🎮 Défier'),
        state.me.dev || (staff && !u.dev) ? el('button', { class: 'btn dev-edit', style: 'flex-basis:100%', onclick: async () => { try { const r = await api('/api/dev/users/' + u.id); close(); openMyProfile(r.user); } catch (e) { toast(e.message); } } }, state.me.dev ? '💻 Modifier son profil (Développeur)' : '🛡️ Modifier son profil (staff)') : null),
      (state.customs?.enabled ? isSuperMe() : state.customs?.media && isStaff()) && !['admin', 'superadmin', 'moderator'].includes(u.role) ? el('div', { class: 'staff-actions' }, el('h4', {}, state.customs?.enabled ? '🛂 Douane : il faut les deux badges' : '🛂 Validation de la voix et de la caméra'),
        el('div', { class: 'actions' },
          el('button', { class: 'btn ' + (u.voiceOk ? 'btn-ok' : 'btn-primary'), onclick: () => { close(); setBadge(u, 'voice', !u.voiceOk); } }, u.voiceOk ? '🎙️ Voix validée ✓ (retirer)' : '🎙️ Valider la voix'),
          el('button', { class: 'btn ' + (u.camOk ? 'btn-ok' : 'btn-primary'), onclick: () => { close(); setBadge(u, 'cam', !u.camOk); } }, u.camOk ? '📷 Caméra validée ✓ (retirer)' : '📷 Valider la caméra'),
          u.verified || !state.customs?.enabled ? null : el('button', { class: 'btn btn-danger', disabled: !!u.refused, onclick: () => { close(); verifyUser(u, false, true); } }, u.refused ? '❌ Déjà refusé' : '❌ Refuser'))) : null,
      roomActions(u, () => close()),
      staff ? el('div', { class: 'staff-actions' },
        el('h4', {}, 'Modération'),
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-sm btn-danger', onclick: () => LC.sanctionModal(u, { toast, onDone: t => { if (t === 'kick' || t === 'ban') close(); } }) }, '🛡️ Sanctionner'),
          el('button', { class: 'btn btn-sm', onclick: () => modAction(`/api/admin/users/${u.id}/mute`, { minutes: 0 }, `${u.username} peut reparler (notifié)`) }, '🔊 Rendre la parole'),
          LC.isAdminRole(state.me) ? el('button', { class: 'btn btn-sm', title: 'Pour un membre de confiance qui utilise un VPN : il ne sera plus signalé', onclick: () => modAction(`/api/admin/users/${u.id}/vpn-ok`, { ok: true }, `🕵️ ${u.username} peut utiliser un VPN`) }, '🕵️ Autoriser son VPN') : null,
          el('button', { class: 'btn btn-sm', onclick: () => { if (confirm(`Effacer la photo, la bannière, la bio et les infos de ${u.username} ?`)) modAction(`/api/admin/users/${u.id}/reset-profile`, {}, 'Profil réinitialisé (notifié)', close); } }, '🧹 Réinitialiser le profil'))) : null,
      el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:14px', onclick: () => close() }, 'Fermer')));
}

// ---------- Redimensionnement des images dans le navigateur ----------
function readImage(file, w, h) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') && !LC.isHeic(file)) return reject(new Error('Choisis une image (JPG, PNG, GIF, WEBP ou une photo d\'iPhone)'));
    // Les photos animées (GIF et WEBP animés) sont gardées telles quelles jusqu'à 4 Mo
    if ((file.type === 'image/gif' || file.type === 'image/webp') && file.size <= 4 * 1024 * 1024) {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('Lecture impossible'));
      return fr.readAsDataURL(file);
    }
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Image trop lourde (15 Mo maximum)'));
    LC.loadImage(file).then(img => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale, sh = h / scale;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.88));
    }).catch(reject);
  });
}

// Champ de "tags" (Entrée pour ajouter)
function tagInput(values, max, placeholder, onChange) {
  const list = [...values];
  const box = el('div', { class: 'tag-input' });
  const input = el('input', { placeholder, maxlength: 40 });
  const draw = () => {
    box.replaceChildren(...list.map((t, i) => el('span', { class: 'ptag' }, t, el('button', { type: 'button', onclick: () => { list.splice(i, 1); draw(); onChange(list); } }, '✕'))), input);
    input.disabled = list.length >= max;
    input.placeholder = list.length >= max ? `${max} maximum` : placeholder;
  };
  const add = () => {
    const v = input.value.trim().replace(/,$/, '');
    if (v && !list.includes(v) && list.length < max) { list.push(v); onChange(list); }
    input.value = ''; draw(); input.focus();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } });
  input.addEventListener('blur', () => { if (input.value.trim()) add(); });
  draw();
  return box;
}

// ---------- Éditeur de mon profil ----------
function openMyProfile(target) {
  const T = target && target.id !== state.me.id ? target : null; // 💻 le Développeur modifie le profil d'un autre membre
  const base = T ? '/api/dev/users/' + T.id : '/api/me';
  const meUpd = user => { if (!T) { Object.assign(state.me, user); renderMe(); } };
  const d = JSON.parse(JSON.stringify(T || state.me)); // brouillon
  d.socials = d.socials || {};
  const preview = el('div', { class: 'editor-preview' });
  const refresh = () => preview.replaceChildren(el('div', { class: 'preview-label' }, '👀 Aperçu en direct'), profileCard({ ...d, profileMusic: (String(d.profileMusicLink ?? '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1] || (d.profileMusicLink === undefined ? d.profileMusic : '') }, { gallery: d.gallery }));
  const err = el('div', { class: 'error' });
  const f = (label, input, help) => el('div', { class: 'field' }, el('label', {}, label), input, help ? el('small', { class: 'help' }, help) : null);
  const bind = (input, key, transform = v => v) => {
    input.addEventListener('input', () => { d[key] = transform(input.type === 'checkbox' ? input.checked : input.value); refresh(); });
    return input;
  };
  const choice = (options, key, render) => {
    const box = el('div', { class: 'choice-row' });
    const draw = () => box.replaceChildren(...options.map(([v, label]) =>
      el('button', { type: 'button', class: 'choice' + (d[key] === v ? ' active' : ''), onclick: () => { d[key] = v; draw(); refresh(); } }, render ? render(v, label) : label)));
    draw();
    return box;
  };
  const likesPick = () => {
    const box = el('div', { class: 'likes-pick' });
    const draw = () => box.replaceChildren(...(window.LIKES || []).map(t => { const on = (d.likes || []).includes(t); return el('button', { type: 'button', class: 'like-chip' + (on ? ' on' : ''), onclick: () => { const cur = d.likes || []; if (on) d.likes = cur.filter(x => x !== t); else { if (cur.length >= 12) return toast('12 phrases au maximum'); d.likes = [...cur, t]; } draw(); refresh(); } }, t); }));
    draw(); return box;
  };
  const colorPick = key => {
    const input = el('input', { type: 'color', value: d[key] || '#8b6cff', class: 'color-input' });
    const box = el('div', { class: 'swatches' });
    const draw = () => box.replaceChildren(...COLOR_SWATCHES.map(c => el('button', { type: 'button', class: 'swatch' + (d[key] === c ? ' active' : ''), style: `background:${c}`, title: c, onclick: () => { d[key] = c; input.value = c; draw(); refresh(); } })), input);
    input.addEventListener('input', () => { d[key] = input.value; draw(); refresh(); });
    draw();
    return box;
  };

  // Envoi d'image (photo ou bannière), enregistré tout de suite
  const imageButtons = (kind, w, h) => {
    const file = el('input', { type: 'file', accept: LC.IMG_ACCEPT, class: 'hidden' });
    const status = el('small', { class: 'help' });
    file.onchange = async () => {
      if (!file.files[0]) return;
      status.textContent = '⏳ Envoi…';
      try {
        const data = await readImage(file.files[0], w, h);
        const { user, pending } = await api(base + '/image/' + kind, { method: 'POST', body: { data } });
        d[kind] = user[kind]; if (!T) { state.me[kind] = user[kind]; renderMe(); } refresh();
        status.textContent = pending ? '⏳ Photo envoyée : elle sera visible dès que le staff l\'aura vérifiée (badge V)' : '✅ Enregistré';
      } catch (e) { status.textContent = '❌ ' + e.message; }
      file.value = '';
    };
    return el('div', {},
      el('div', { class: 'row', style: 'gap:8px' },
        el('button', { type: 'button', class: 'btn btn-sm btn-primary', style: 'flex:none', onclick: () => file.click() }, kind === 'avatar' ? '📷 Choisir une photo' : '🖼️ Choisir une image'),
        el('button', { type: 'button', class: 'btn btn-sm', style: 'flex:none', onclick: async () => {
          try { const { user } = await api(base + '/image/' + kind, { method: 'DELETE' }); d[kind] = ''; if (!T) { state.me[kind] = user[kind]; renderMe(); } refresh(); status.textContent = 'Retiré'; } catch (e) { toast(e.message); }
        } }, 'Retirer')),
      file, status);
  };

  const namePick = colorPick('color');
  // 🖼️ la galerie : ajouter / retirer des photos (vérifiées par le staff)
  const galleryEditor = () => {
    const box = el('div', { class: 'gal-edit' }), file = el('input', { type: 'file', accept: LC.IMG_ACCEPT, class: 'hidden' }), status = el('small', { class: 'help' });
    const draw = g => { d.gallery = g; refresh(); box.replaceChildren(...g.map(p => el('div', { class: 'gal-item' + (p.ok ? '' : ' wait') }, el('img', { src: p.url, alt: '' }), p.ok ? null : el('span', { class: 'gal-wait' }, '⏳'),
        el('button', { type: 'button', class: 'gal-del', title: 'Retirer', onclick: async () => { try { draw((await api('/api/me/gallery/' + p.id, { method: 'DELETE' })).gallery); } catch (e) { toast(e.message); } } }, '✕'))),
      g.length < 6 ? el('button', { type: 'button', class: 'gal-add', onclick: () => file.click() }, '➕') : null, file, status); };
    file.onchange = async () => { if (!file.files[0]) return; status.textContent = '⏳ Envoi…'; try { const r = await api('/api/me/gallery', { method: 'POST', body: { data: await readImage(file.files[0], 1200, 1200) } }); draw(r.gallery); toast(r.pending ? '🖼️ Photo envoyée : elle sera visible après la vérification du staff' : '🖼️ Photo ajoutée'); } catch (e) { toast(e.message); } status.textContent = ''; file.value = ''; };
    api('/api/me/gallery').then(r => draw(r.gallery)).catch(() => {});
    return box;
  };
  // --- Onglet Apparence ---
  const tabLook = el('div', {},
    f('📷 Photo de profil', imageButtons('avatar', 256, 256), (!T && state.me.avatarPending ? '⏳ Ta nouvelle photo attend la vérification du staff. ' : '') + 'Chaque nouvelle photo est vérifiée par le staff avant d\'être visible (badge V). JPG, PNG, ou une photo animée 🎞️ (GIF ou WEBP animé, 4 Mo maximum). Et en dessous, choisis une animation ✨ pour faire bouger n\'importe quelle photo !'),
    f('🖼️ Bannière', el('div', {}, imageButtons('banner', 1200, 400),
      el('small', { class: 'help', style: 'display:block;margin:10px 0 6px' }, 'Ou un dégradé (utilisé quand il n\'y a pas d\'image) :'),
      choice(Object.keys(LC.BANNERS).map(k => [k, k]), 'bannerStyle', v => el('span', { class: 'banner-swatch', style: `background:${LC.BANNERS[v]}` })))),
    f('🎨 Couleur du pseudo', el('div', {}, namePick,
      el('button', { type: 'button', class: 'btn btn-sm', style: 'margin-top:8px', onclick: () => {
        const inp = namePick.querySelector('input[type=color]');
        inp.value = LC.GENDER_COLORS[d.gender] || LC.GENDER_COLORS.x;
        inp.dispatchEvent(new Event('input'));
      } }, '↺ Couleur par défaut (selon ton genre)'),
      state.me.canBlack || T ? el('button', { type: 'button', class: 'btn btn-sm black-pick', style: 'margin-top:8px;margin-left:6px', onclick: () => { const inp = namePick.querySelector('input[type=color]'); inp.value = '#000000'; inp.dispatchEvent(new Event('input')); } }, '🖤 Noir (réservé au staff)') : null),
      state.me.canBlack || T ? null : 'Le noir est réservé au staff 🛡️'),
    state.me.perks || T ? f(T ? '✏️ Changer son pseudo' : '✏️ Changer de pseudo (👑 privilège)', (() => {
      const inp = el('input', { class: 'input', maxlength: 20, value: d.username });
      return el('div', { class: 'row', style: 'gap:8px' }, inp, el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: async () => {
        try { const r = await api(base + '/username', { method: 'POST', body: { username: inp.value.trim() } }); meUpd(r.user); d.username = r.user.username; refresh(); toast(T ? `✏️ Son pseudo est maintenant ${r.user.username}` : `✏️ Tu t'appelles maintenant ${r.user.username} !`); if (!T) LC.confetti(['✏️', '👑', '✨']); } catch (e) { toast(e.message); }
      } }, 'Changer'));
    })(), 'Tu peux changer de pseudo quand tu veux, autant de fois que tu veux.') : null,
    f('✨ Effet du pseudo', choice([...NAME_FX, ...(T ? Object.entries(PREMIUM_FX) : ownedOf('name_', PREMIUM_FX))], 'nameEffect', (v, label) => LC.name({ username: label, color: d.color, nameEffect: v }))),
    f('⭕ Couleur autour du pseudo', (() => {
      const RING = [['', '🚫 Rien'], ['contour', '⭕ Contour'], ['halo', '✨ Halo'], ['bulle', '💬 Bulle'], ['neon', '💡 Néon'], ['double', '◎ Double'], ['degrade', '🌅 Dégradé'], ['arcenciel', '🌈 Arc-en-ciel']];
      const COLS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#32ade6', '#007aff', '#5856d6', '#af52de', '#ff2d55', '#ff5fa2', '#ffffff', '#c0c0c0', '#d4af37', '#8b4513', '#000000'];
      const box = el('div', { class: 'nr-pick' });
      const draw = () => {
        const [st, col = '#ff5fa2', col2 = ''] = String(d.nameRing || '').split(':');
        const set = (s, c, c2 = col2) => { d.nameRing = !s ? '' : s === 'arcenciel' ? 'arcenciel' : s + ':' + c + (c2 ? ':' + c2 : ''); draw(); refresh(); };
        const inp2 = el('input', { type: 'color', class: 'color-input', value: col2 || '#ffcc00', onchange: e => set(st || 'contour', col, e.target.value) });
        const inp = el('input', { type: 'color', class: 'color-input', value: col, onchange: e => set(st || 'contour', e.target.value) });
        box.replaceChildren(
          el('div', { class: 'nr-prev' }, el('small', {}, 'Dans la liste des connectés :'), el('div', { class: 'list-item' + LC.ringRow(d).cls, style: LC.ringRow(d).style || null }, LC.avatar(d), el('div', { class: 'meta' }, el('div', { class: 'name' }, LC.name({ ...d, nameRing: '' })), el('div', { class: 'sub' }, '🟢 En ligne'))), el('small', {}, 'Dans les messages :'), el('div', {}, LC.name({ username: d.username, color: d.color, nameEffect: d.nameEffect, nameRing: d.nameRing }))),
          el('div', { class: 'nr-styles' }, ...RING.map(([v, l]) => el('button', { type: 'button', class: 'btn btn-sm' + ((st || '') === v ? ' btn-primary' : ''), onclick: () => set(v, col) }, l))),
          st && st !== 'arcenciel' ? el('small', { class: 'nr-lbl' }, '🎨 1ʳᵉ couleur') : null,
          st && st !== 'arcenciel' ? el('div', { class: 'swatches' }, ...COLS.map(c => el('button', { type: 'button', class: 'swatch' + (col === c ? ' active' : ''), style: `background:${c}`, title: c, onclick: () => set(st, c) })), inp) : null,
          st && st !== 'arcenciel' ? el('small', { class: 'nr-lbl' }, '🎨 2ᵉ couleur (pour faire un mélange de 2 couleurs)') : null,
          st && st !== 'arcenciel' ? el('div', { class: 'swatches' }, el('button', { type: 'button', class: 'btn btn-sm' + (!col2 ? ' btn-primary' : ''), onclick: () => set(st, col, '') }, '🚫 Une seule couleur'), ...COLS.map(c => el('button', { type: 'button', class: 'swatch' + (col2 === c ? ' active' : ''), style: `background:${c}`, title: c, onclick: () => set(st, col, c) })), inp2) : null);
      };
      draw(); return box;
    })(), 'Une couleur autour de ton pseudo, visible par tout le monde (messages, liste des membres, profil…).'),
    f('🖌️ Couleur du profil', colorPick('accent'), 'Couleur des contours et des étiquettes de ta carte.'),
    f('✍️ Style d\'écriture de mes messages', choice(LC.MSG_FONTS, 'msgFont', (v, label) => el('span', { class: v ? 'mf-' + v : '' }, label))),
    f('🎨 Couleur d\'écriture', el('div', {}, colorPick('msgColor'), el('button', { type: 'button', class: 'btn btn-sm', style: 'margin-top:6px', onclick: e => { d.msgColor = ''; refresh(); e.target.textContent = '✅ Couleur normale'; } }, '↺ Couleur normale')), 'Tes messages s\'afficheront avec ce style et cette couleur, pour tout le monde.'),
    f('✨ Photo animée', choice(AVATAR_FX_UI, 'avatarFx', (v, label) => el('span', { class: 'frame-choice' }, LC.avatar({ ...d, avatarFx: v }), label))),
    f('✨ Fond animé de mon profil', choice(PROFILE_FX_UI, 'profileFx'), 'Une animation derrière ta carte de profil, que tout le monde voit quand il ouvre ton profil.'),
    f('🎵 Musique de mon profil', bind(el('input', { class: 'input', maxlength: 200, placeholder: 'Colle le lien d\'une vidéo YouTube', value: d.profileMusic ? 'https://youtu.be/' + d.profileMusic : '' }), 'profileMusicLink'), 'Les visiteurs de ton profil pourront l\'écouter avec un bouton « ▶️ Écouter ». Laisse vide pour ne pas en mettre.'),
    T ? null : f('🖼️ Ma galerie photos', galleryEditor(), 'Jusqu\'à 6 photos sur ton profil. Chaque photo est vérifiée par le staff avant d\'être visible (⏳ en attendant).'),
    f('⭕ Cadre de la photo', choice([...FRAMES_UI, ...(T ? Object.entries(PREMIUM_FRAMES) : ownedOf('frame_', PREMIUM_FRAMES))], 'frame', (v, label) => el('span', { class: 'frame-choice' }, LC.avatar({ ...d, frame: v }), label))));

  // --- Onglet Infos ---
  const age = bind(el('input', { class: 'input', type: 'number', min: 13, max: 99, value: d.age || '' }), 'age', v => parseInt(v, 10) || '');
  const gender = el('select', { class: 'input' }, ...LC.GENDERS.map(([v, l]) => el('option', { value: v, selected: d.gender === v }, l)));
  gender.addEventListener('input', () => {
    // La couleur par défaut suit le genre
    const followDefault = (d.color || '').toLowerCase() === (LC.GENDER_COLORS[d.gender] || '');
    d.gender = gender.value;
    if (followDefault) {
      const inp = namePick.querySelector('input[type=color]');
      inp.value = LC.GENDER_COLORS[d.gender];
      inp.dispatchEvent(new Event('input'));
    }
    refresh();
  });
  const city = bind(el('input', { class: 'input', maxlength: 40, value: d.city || '' }), 'city');
  const email = bind(el('input', { class: 'input', type: 'email', maxlength: 120, value: d.email || '', placeholder: 'prenom@gmail.com' }), 'email');
  const bioCount = el('small', { class: 'help' }, `${(d.bio || '').length}/500`);
  const bio = bind(el('textarea', { class: 'input', rows: 4, maxlength: 500, placeholder: 'Parle un peu de toi…' }, d.bio || ''), 'bio', v => { bioCount.textContent = `${v.length}/500`; return v; });
  const statusText = bind(el('input', { class: 'input', maxlength: 60, placeholder: 'Ex : En game sur Valorant', value: d.statusText || '' }), 'statusText');
  const tabInfo = el('div', {},
    f('💭 Statut', el('div', {}, choice(STATUS_EMOJIS.map(e => [e, e || '∅']), 'statusEmoji'), el('div', { style: 'margin-top:8px' }, statusText))),
    el('div', {}, f('📝 À propos de moi', bio), bioCount),
    el('div', { class: 'row', style: 'margin-top:14px' }, f('Âge', age), f('Je suis', gender)),
    f('🏳️‍🌈 Mon cœur à côté du pseudo', choice(LC.IDENTITIES.map(([v, l, h]) => [v, (h ? h + ' ' : '') + l]), 'identity'), 'Choisis ton identité : son cœur s\'affiche à côté de ton pseudo partout sur le site.'),
    f('💬 Mes phrases (jusqu\'à 12)', likesPick(), 'Elles s\'affichent sur ton profil : les autres voient tout de suite ce que tu aimes.'),
    f('Ville', city),
    T && T.email === undefined ? null : f('E-mail (privé : visible seulement par l\'administration du site)', email),
    el('label', { class: 'switch' }, el('span', {}, 'Afficher mon âge aux autres'), bind(el('input', { type: 'checkbox', checked: d.showAge !== false }), 'showAge')),
    el('label', { class: 'switch' }, el('span', {}, 'Afficher ma ville aux autres'), bind(el('input', { type: 'checkbox', checked: d.showCity !== false }), 'showCity')),
    f('🎂 Mon anniversaire', el('div', { class: 'row', style: 'gap:8px' },
      bind(el('select', { class: 'input' }, el('option', { value: 0 }, 'Jour'), ...Array.from({ length: 31 }, (_, i) => el('option', { value: i + 1, selected: d.birthDay === i + 1 }, i + 1))), 'birthDay', v => parseInt(v, 10) || 0),
      bind(el('select', { class: 'input' }, el('option', { value: 0 }, 'Mois'), ...LC.MONTHS.map((m, i) => el('option', { value: i + 1, selected: d.birthMonth === i + 1 }, m))), 'birthMonth', v => parseInt(v, 10) || 0)),
      'Le jour J, un 🎂 s\'affiche à côté de ton pseudo et tout le monde est prévenu pour te le souhaiter !'),
    el('label', { class: 'switch' }, el('span', {}, 'Fêter mon anniversaire sur le site'), bind(el('input', { type: 'checkbox', checked: d.showBirthday !== false }), 'showBirthday')),
    f('✨ Centres d\'intérêt', tagInput(d.interests || [], 10, 'Ex : Manga, Foot, Rap… puis Entrée', v => { d.interests = [...v]; refresh(); })),
    f('🎮 Jeux du moment', tagInput(d.games || [], 8, 'Ex : Fortnite, GTA V… puis Entrée', v => { d.games = [...v]; refresh(); })));

  // --- Onglet Réseaux ---
  const tabSocial = el('div', {},
    el('p', { class: 'help', style: 'margin-top:0' }, 'Indique seulement ton pseudo (sans le lien). Laisse vide pour ne pas l\'afficher.'),
    ...Object.entries(SOCIAL_DEFS).map(([k, def]) => f(def.label,
      bind(el('input', { class: 'input', maxlength: 40, placeholder: def.ph, value: d.socials[k] || '' }), '_s', v => { d.socials[k] = v.trim().replace(/^@/, ''); return v; }))));

  // --- Onglet Compte ---
  const pwCur = el('input', { class: 'input', type: 'password', placeholder: 'Mot de passe actuel', autocomplete: 'current-password' });
  const pwNew = el('input', { class: 'input', type: 'password', placeholder: 'Nouveau mot de passe (6 caractères min.)', autocomplete: 'new-password', style: 'margin-top:8px' });
  const tabAccount = T ? el('div', {},
    el('div', { class: 'dev-zone' }, el('div', { class: 'dev-title' }, `${state.me.dev ? '💻' : '🛡️'} Le profil de ${T.username}`),
      el('p', { class: 'help', style: 'margin:4px 0 10px' }, `Tu modifies ce profil en tant que ${state.me.dev ? 'Développeur' : 'membre du staff'} : tout ce que tu enregistres s'applique tout de suite pour ce membre.`)),
    el('label', { class: 'switch' }, el('span', {}, '🩶 Cœur gris à côté du cœur rouge'), bind(el('input', { type: 'checkbox', checked: !!d.grey }), 'grey')),
    state.me.dev ? f('⭐ Son niveau', bind(el('input', { class: 'input', type: 'number', min: 1, max: 999, value: d.level || 1, style: 'max-width:120px' }), 'level', v => parseInt(v, 10) || 1), 'Tu choisis son niveau directement (de 1 à 999). Il continue ensuite à monter normalement.') : null) : el('div', {},
    d.isGuest
      ? el('p', { class: 'help' }, '💡 Tu es invité : ton profil disparaît 24 h après ton départ. Déconnecte-toi puis inscris-toi pour garder ton pseudo et ton profil.')
      : el('div', {}, f('🔐 Changer de mot de passe', el('div', {}, pwCur, pwNew)),
        el('button', { class: 'btn btn-sm', onclick: async () => {
          try { await api('/api/me/password', { method: 'PUT', body: { current: pwCur.value, next: pwNew.value } }); pwCur.value = pwNew.value = ''; toast('🔐 Mot de passe changé'); } catch (e) { toast(e.message); }
        } }, 'Changer le mot de passe')),
    state.me.canDev ? el('div', { class: 'dev-zone' },
      el('div', { class: 'dev-title' }, '💻 Rôle Développeur'),
      el('p', { class: 'help', style: 'margin:4px 0 10px' }, 'Un badge « 💻 Développeur » animé à côté de ton pseudo, partout sur le site. 🔒 Verrouillé rien que pour toi : aucun autre admin ne peut le prendre.'),
      el('button', { class: 'btn btn-sm ' + (state.me.dev ? '' : 'btn-primary'), type: 'button', onclick: async e => {
        try { const r = await api('/api/me/dev', { method: 'POST', body: { on: !state.me.dev } }); Object.assign(state.me, r.user); renderMe?.(); toast(r.user.dev ? '💻 Tu es maintenant le Développeur du site !' : 'Rôle Développeur retiré'); if (r.user.dev) LC.confetti(['💻', '⚡', '✨']); e.target.textContent = r.user.dev ? 'Retirer le rôle' : 'Activer mon rôle Développeur'; e.target.classList.toggle('btn-primary', !r.user.dev); } catch (err) { toast(err.message); }
      } }, state.me.dev ? 'Retirer le rôle' : 'Activer mon rôle Développeur')) : null,
    el('div', { class: 'staff-actions' }, el('button', { class: 'btn btn-danger', style: 'width:100%', onclick: logout }, '🚪 Se déconnecter')),
    d.isGuest || state.me.role === 'superadmin' ? null : el('div', { class: 'delete-zone' },
      el('div', { class: 'delete-title' }, '🗑️ Se désinscrire'),
      el('p', { class: 'help', style: 'margin:4px 0 10px' }, 'Tu veux quitter le site ? Tu peux supprimer ton compte ici. C\'est définitif : ton profil, tes messages, tes amis, tes coins, ta maison et ton animal seront effacés.'),
      el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button', onclick: askDeleteAccount }, 'Supprimer mon compte')));

  const tabs = [['🎨 Apparence', tabLook], ['📝 Infos', tabInfo], ['🔗 Réseaux', tabSocial], [T ? '💻 Plus' : '🔐 Compte', tabAccount]];
  const body = el('div', { class: 'editor-body' });
  const tabBar = el('div', { class: 'tabs' });
  const show = i => {
    tabBar.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', i === j));
    body.replaceChildren(tabs[i][1]);
  };
  tabs.forEach(([label], i) => tabBar.append(el('button', { type: 'button', onclick: () => show(i) }, label)));
  show(0);
  refresh();

  const close = modal(
    el('div', { class: 'editor' },
      preview,
      el('div', { class: 'editor-form' },
        el('h3', { style: 'margin:0 0 14px' }, T ? `${state.me.dev ? '💻' : '🛡️'} Modifier le profil de ${T.username}` : '✏️ Personnaliser mon profil'),
        tabBar, body, err,
        el('div', { class: 'actions editor-save' },
          el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
          el('button', { class: 'btn btn-primary', onclick: async () => {
            err.textContent = '';
            try {
              const { user } = await api(base, { method: 'PUT', body: { ...(T ? { grey: !!d.grey, ...(state.me.dev ? { level: d.level } : {}) } : {}),
                age: d.age, gender: d.gender, city: d.city, email: d.email || '', bio: d.bio, color: d.color, accent: d.accent,
                profileFx: d.profileFx || '', profileMusic: d.profileMusicLink !== undefined ? d.profileMusicLink : (d.profileMusic || ''),
                nameEffect: d.nameEffect, frame: d.frame, avatarFx: d.avatarFx || 'none', identity: d.identity || '', likes: d.likes || [], msgFont: d.msgFont || '', msgColor: d.msgColor || '', nameRing: d.nameRing || '', bannerStyle: d.bannerStyle, statusEmoji: d.statusEmoji, statusText: d.statusText,
                interests: d.interests || [], games: d.games || [], socials: d.socials, showAge: d.showAge !== false, showCity: d.showCity !== false,
                birthDay: d.birthDay || 0, birthMonth: d.birthMonth || 0, showBirthday: d.showBirthday !== false,
              } });
              if (T) { close(); toast(`💻 Profil de ${user.username} enregistré !`); } else { state.me = user; renderMe(); close(); toast('✨ Profil enregistré !'); }
            } catch (e) { err.textContent = e.message; }
          } }, '💾 Enregistrer')))));
  document.querySelectorAll('.modal-back .modal')[document.querySelectorAll('.modal-back .modal').length - 1].classList.add('editor-modal');
}

// 🗑️ Se désinscrire : double confirmation (pseudo + mot de passe)
function askDeleteAccount() {
  const me = state.me;
  const google = !!me.googleLinked;
  const name = el('input', { class: 'input', placeholder: 'Écris ton pseudo : ' + me.username, autocomplete: 'off' });
  const pass = google ? null : el('input', { class: 'input', type: 'password', placeholder: 'Ton mot de passe', autocomplete: 'current-password', style: 'margin-top:8px' });
  const err = el('p', { class: 'help', style: 'color:#ff6b6b;min-height:1em' });
  const go = el('button', { class: 'btn btn-danger', style: 'width:100%', disabled: true }, '🗑️ Supprimer définitivement mon compte');
  const check = () => { go.disabled = name.value.trim().toLowerCase() !== me.username.toLowerCase() || (pass && !pass.value); };
  name.oninput = check; if (pass) pass.oninput = check;
  const close = modal(el('div', { class: 'center delete-confirm' },
    el('div', { style: 'font-size:2.6rem' }, '😢'),
    el('h3', {}, 'Supprimer ton compte ?'),
    el('p', {}, 'Tout sera effacé pour toujours : profil, photos, messages, amis, Paradise Coins, maison, animal, badges… On ne pourra pas le récupérer.'),
    el('p', { class: 'help' }, google ? 'Pour confirmer, écris ton pseudo ci-dessous.' : 'Pour confirmer, écris ton pseudo et ton mot de passe.'),
    name, pass, err,
    el('div', { style: 'display:flex;gap:8px;margin-top:6px;flex-wrap:wrap' },
      el('button', { class: 'btn', style: 'flex:1', onclick: () => close() }, 'Non, je reste 💜'), go)));
  go.onclick = async () => {
    go.disabled = true; err.textContent = '';
    try {
      await api('/api/me', { method: 'DELETE', body: { confirm: name.value, password: pass ? pass.value : '' } });
      try { if (Voice.slug) Voice.leave(); } catch (e) {}
      try { sessionStorage.setItem('lc_exit', JSON.stringify({ kind: 'deleted', at: Date.now() })); } catch (e) {}
      location.href = '/';
    } catch (e) { err.textContent = e.message; check(); }
  };
  name.focus();
}
