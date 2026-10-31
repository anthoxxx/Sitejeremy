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
const FRAMES_UI = [['none', 'Aucun'], ['neon', 'Néon'], ['gold', 'Or'], ['rainbow', 'Arc-en-ciel'], ['fire', 'Feu'], ['ice', 'Glace']];
const STATUS_EMOJIS = ['', '🎮', '🎧', '😴', '🔥', '💜', '😎', '🍕', '📚', '💼', '🏆', '🤔', '😂', '🌙', '✈️', '🎬'];
const COLOR_SWATCHES = ['#8b6cff', '#ff5fa2', '#ffb547', '#33d6a6', '#4fb3ff', '#ff7a59', '#c86bff', '#f2e94e', '#ffffff', '#ff4d4d'];

// ---------- Carte de profil (utilisée pour les autres et pour l'aperçu) ----------
function profileCard(u, opts = {}) {
  const socials = Object.entries(u.socials || {}).filter(([k, h]) => SOCIAL_DEFS[k] && h);
  const info = [LC.genderLabel(u.gender), u.age ? u.age + ' ans' : '', u.city].filter(Boolean).join(' · ');
  return el('div', { class: 'pcard', style: `--accent:${u.accent || '#ff5fa2'}` },
    el('div', { class: 'pbanner', style: `background:${LC.bannerCss(u)}` }),
    el('div', { class: 'pbody' },
      el('div', { class: 'pavatar' }, LC.avatar(u, true)),
      el('div', { class: 'pname' }, LC.name(u), ' ', LC.badge(u)),
      u.isBirthday ? el('div', { class: 'pbday' }, '🎉 C\'est son anniversaire aujourd\'hui ! 🎂') : null,
      u.statusEmoji || u.statusText ? el('div', { class: 'pstatus' }, `${u.statusEmoji || ''} ${u.statusText || ''}`.trim()) : null,
      el('div', { class: 'pinfo' }, info, opts.online !== undefined ? el('span', {}, opts.online ? ' · 🟢 En ligne' : ' · ⚪ Hors ligne') : null),
      u.birthday ? el('div', { class: 'pinfo' }, `🎂 Anniversaire : ${u.birthday.day} ${LC.MONTHS[u.birthday.month - 1]}`) : null,
      el('div', { class: 'psection' }, el('h5', {}, 'À propos'), el('div', { class: 'pbio' }, u.bio || 'Aucune description pour l\'instant.')),
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
      u.createdAt ? el('div', { class: 'psince' }, (u.isGuest ? 'Invité depuis le ' : 'Membre depuis le ') + new Date(u.createdAt).toLocaleDateString('fr-FR')) : null));
}

// Ouvre une fenêtre avec un style "profil" (plus large, sans marge intérieure)
function profileModal(...content) {
  const close = modal(...content);
  const all = document.querySelectorAll('.modal-back .modal');
  all[all.length - 1].classList.add('profile-modal');
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
    profileCard(u, { online: data.online }),
    el('div', { class: 'pactions' },
      el('div', { class: 'actions' },
        u.isBirthday ? el('button', { class: 'btn btn-primary', style: 'flex-basis:100%', onclick: () => { close(); wishBirthday(u); } }, '🎂 Lui souhaiter un joyeux anniversaire') : null,
        el('button', { class: 'btn btn-primary', onclick: () => { close(); openPm(u); } }, '💌 Message privé'),
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
        el('button', { class: 'btn', disabled: !data.online, onclick: () => { close(); challengeUser(u); } }, '🎮 Défier')),
      roomActions(u, () => close()),
      staff ? el('div', { class: 'staff-actions' },
        el('h4', {}, 'Modération'),
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-sm btn-danger', onclick: () => LC.sanctionModal(u, { toast, onDone: t => { if (t === 'kick' || t === 'ban') close(); } }) }, '🛡️ Sanctionner'),
          el('button', { class: 'btn btn-sm', onclick: () => modAction(`/api/admin/users/${u.id}/mute`, { minutes: 0 }, `${u.username} peut reparler (notifié)`) }, '🔊 Rendre la parole'),
          el('button', { class: 'btn btn-sm', onclick: () => { if (confirm(`Effacer la photo, la bannière, la bio et les infos de ${u.username} ?`)) modAction(`/api/admin/users/${u.id}/reset-profile`, {}, 'Profil réinitialisé (notifié)', close); } }, '🧹 Réinitialiser le profil'))) : null,
      el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:14px', onclick: () => close() }, 'Fermer')));
}

// ---------- Redimensionnement des images dans le navigateur ----------
function readImage(file, w, h) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choisis une image (JPG, PNG, GIF ou WEBP)'));
    // Les GIF animés sont gardés tels quels s'ils sont légers
    if (file.type === 'image/gif' && file.size <= 1.5 * 1024 * 1024) {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('Lecture impossible'));
      return fr.readAsDataURL(file);
    }
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Image trop lourde (15 Mo maximum)'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale, sh = h / scale;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
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
function openMyProfile() {
  const d = JSON.parse(JSON.stringify(state.me)); // brouillon
  d.socials = d.socials || {};
  const preview = el('div', { class: 'editor-preview' });
  const refresh = () => preview.replaceChildren(el('div', { class: 'preview-label' }, '👀 Aperçu en direct'), profileCard(d));
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
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', class: 'hidden' });
    const status = el('small', { class: 'help' });
    file.onchange = async () => {
      if (!file.files[0]) return;
      status.textContent = '⏳ Envoi…';
      try {
        const data = await readImage(file.files[0], w, h);
        const { user } = await api('/api/me/image/' + kind, { method: 'POST', body: { data } });
        d[kind] = user[kind]; state.me[kind] = user[kind];
        renderMe(); refresh(); status.textContent = '✅ Enregistré';
      } catch (e) { status.textContent = '❌ ' + e.message; }
      file.value = '';
    };
    return el('div', {},
      el('div', { class: 'row', style: 'gap:8px' },
        el('button', { type: 'button', class: 'btn btn-sm btn-primary', style: 'flex:none', onclick: () => file.click() }, kind === 'avatar' ? '📷 Choisir une photo' : '🖼️ Choisir une image'),
        el('button', { type: 'button', class: 'btn btn-sm', style: 'flex:none', onclick: async () => {
          try { const { user } = await api('/api/me/image/' + kind, { method: 'DELETE' }); d[kind] = ''; state.me[kind] = user[kind]; renderMe(); refresh(); status.textContent = 'Retiré'; } catch (e) { toast(e.message); }
        } }, 'Retirer')),
      file, status);
  };

  const namePick = colorPick('color');
  // --- Onglet Apparence ---
  const tabLook = el('div', {},
    f('📷 Photo de profil', imageButtons('avatar', 256, 256), 'JPG, PNG, WEBP ou GIF animé (1,5 Mo max pour les GIF).'),
    f('🖼️ Bannière', el('div', {}, imageButtons('banner', 1200, 400),
      el('small', { class: 'help', style: 'display:block;margin:10px 0 6px' }, 'Ou un dégradé (utilisé quand il n\'y a pas d\'image) :'),
      choice(Object.keys(LC.BANNERS).map(k => [k, k]), 'bannerStyle', v => el('span', { class: 'banner-swatch', style: `background:${LC.BANNERS[v]}` })))),
    f('🎨 Couleur du pseudo', el('div', {}, namePick,
      el('button', { type: 'button', class: 'btn btn-sm', style: 'margin-top:8px', onclick: () => {
        const inp = namePick.querySelector('input[type=color]');
        inp.value = LC.GENDER_COLORS[d.gender] || LC.GENDER_COLORS.x;
        inp.dispatchEvent(new Event('input'));
      } }, '↺ Couleur par défaut (💙 homme · 🩷 femme · 💜 autre)'))),
    f('✨ Effet du pseudo', choice(NAME_FX, 'nameEffect', (v, label) => LC.name({ username: label, color: d.color, nameEffect: v }))),
    f('🖌️ Couleur du profil', colorPick('accent'), 'Couleur des contours et des étiquettes de ta carte.'),
    f('⭕ Cadre de la photo', choice(FRAMES_UI, 'frame', (v, label) => el('span', { class: 'frame-choice' }, LC.avatar({ ...d, frame: v }), label))));

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
  const bioCount = el('small', { class: 'help' }, `${(d.bio || '').length}/500`);
  const bio = bind(el('textarea', { class: 'input', rows: 4, maxlength: 500, placeholder: 'Parle un peu de toi…' }, d.bio || ''), 'bio', v => { bioCount.textContent = `${v.length}/500`; return v; });
  const statusText = bind(el('input', { class: 'input', maxlength: 60, placeholder: 'Ex : En game sur Valorant', value: d.statusText || '' }), 'statusText');
  const tabInfo = el('div', {},
    f('💭 Statut', el('div', {}, choice(STATUS_EMOJIS.map(e => [e, e || '∅']), 'statusEmoji'), el('div', { style: 'margin-top:8px' }, statusText))),
    el('div', {}, f('📝 À propos de moi', bio), bioCount),
    el('div', { class: 'row', style: 'margin-top:14px' }, f('Âge', age), f('Je suis', gender)),
    f('Ville', city),
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
  const tabAccount = el('div', {},
    d.isGuest
      ? el('p', { class: 'help' }, '💡 Tu es invité : ton profil disparaît 24 h après ton départ. Déconnecte-toi puis inscris-toi pour garder ton pseudo et ton profil.')
      : el('div', {}, f('🔐 Changer de mot de passe', el('div', {}, pwCur, pwNew)),
        el('button', { class: 'btn btn-sm', onclick: async () => {
          try { await api('/api/me/password', { method: 'PUT', body: { current: pwCur.value, next: pwNew.value } }); pwCur.value = pwNew.value = ''; toast('🔐 Mot de passe changé'); } catch (e) { toast(e.message); }
        } }, 'Changer le mot de passe')),
    el('div', { class: 'staff-actions' }, el('button', { class: 'btn btn-danger', style: 'width:100%', onclick: logout }, '🚪 Se déconnecter')));

  const tabs = [['🎨 Apparence', tabLook], ['📝 Infos', tabInfo], ['🔗 Réseaux', tabSocial], ['🔐 Compte', tabAccount]];
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
        el('h3', { style: 'margin:0 0 14px' }, '✏️ Personnaliser mon profil'),
        tabBar, body, err,
        el('div', { class: 'actions editor-save' },
          el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Annuler'),
          el('button', { class: 'btn btn-primary', onclick: async () => {
            err.textContent = '';
            try {
              const { user } = await api('/api/me', { method: 'PUT', body: {
                age: d.age, gender: d.gender, city: d.city, bio: d.bio, color: d.color, accent: d.accent,
                nameEffect: d.nameEffect, frame: d.frame, bannerStyle: d.bannerStyle, statusEmoji: d.statusEmoji, statusText: d.statusText,
                interests: d.interests || [], games: d.games || [], socials: d.socials, showAge: d.showAge !== false, showCity: d.showCity !== false,
                birthDay: d.birthDay || 0, birthMonth: d.birthMonth || 0, showBirthday: d.showBirthday !== false,
              } });
              state.me = user; renderMe(); close(); toast('✨ Profil enregistré !');
            } catch (e) { err.textContent = e.message; }
          } }, '💾 Enregistrer')))));
  document.querySelectorAll('.modal-back .modal')[document.querySelectorAll('.modal-back .modal').length - 1].classList.add('editor-modal');
}
