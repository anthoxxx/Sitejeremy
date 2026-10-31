// The Paradise — partage de médias : photos, YouTube, Spotify, liens d'images / vidéos, aperçus de liens, galerie

// ---------- Reconnaître les liens intégrables ----------
function embedInfo(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  // YouTube (vidéos, Shorts, youtu.be)
  let yt = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1).split('/')[0];
  else if (host.endsWith('youtube.com')) yt = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1];
  if (yt && /^[\w-]{11}$/.test(yt)) {
    const t = parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '0', 10) || 0;
    return { type: 'youtube', id: yt, src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0${t ? '&start=' + t : ''}`, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, short: u.pathname.startsWith('/shorts') };
  }
  // Spotify
  const sp = host === 'open.spotify.com' && u.pathname.match(/^\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/);
  if (sp) return { type: 'spotify', src: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`, tall: sp[1] !== 'track' && sp[1] !== 'episode' };
  // Dailymotion / Vimeo
  const dm = (host === 'dailymotion.com' && u.pathname.match(/^\/video\/(\w+)/)) || (host === 'dai.ly' && u.pathname.match(/^\/(\w+)/));
  if (dm) return { type: 'frame', src: `https://www.dailymotion.com/embed/video/${dm[1]}?autoplay=1`, label: 'Dailymotion' };
  const vm = host === 'vimeo.com' && u.pathname.match(/^\/(\d+)/);
  if (vm) return { type: 'frame', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1`, label: 'Vimeo' };
  // Images, GIF et vidéos directes
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(u.pathname)) return { type: 'image', src: url };
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { type: 'video', src: url };
  if (u.protocol === 'https:') return { type: 'link', src: url };
  return null;
}

// ---------- Affichage ----------
function photoEl(src, caption) {
  const img = el('img', { src, alt: caption || 'Photo', loading: 'lazy', class: 'chat-photo' });
  img.onclick = () => openLightbox(src, caption);
  img.onload = () => scrollDown && typeof nearBottom === 'function' && scrollDown();
  return img;
}
function embedEl(info) {
  if (info.type === 'image') return photoEl(info.src);
  if (info.type === 'video') return el('video', { src: info.src, controls: true, preload: 'metadata', playsinline: true, class: 'chat-video' });
  if (info.type === 'spotify') return el('iframe', { src: info.src, class: 'chat-spotify' + (info.tall ? ' tall' : ''), loading: 'lazy', allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', title: 'Spotify' });
  if (info.type === 'youtube' || info.type === 'frame') {
    // Le lecteur ne se charge qu'au clic (plus léger et plus respectueux de la vie privée)
    const box = el('div', { class: 'chat-embed' + (info.short ? ' short' : ''), role: 'button', title: 'Lire la vidéo' },
      info.thumb ? el('img', { src: info.thumb, alt: '', loading: 'lazy', onerror: e => { e.target.style.visibility = 'hidden'; } }) : el('div', { class: 'embed-label' }, info.label),
      el('span', { class: 'embed-play' }, '▶'), el('span', { class: 'embed-src' }, info.type === 'youtube' ? '▶ YouTube' : info.label));
    box.onclick = () => box.replaceChildren(el('iframe', { src: info.src, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, title: 'Vidéo' }));
    return box;
  }
  if (info.type === 'link') {
    const card = el('a', { class: 'link-card loading', href: info.src, target: '_blank', rel: 'noopener noreferrer nofollow' });
    api('/api/preview?url=' + encodeURIComponent(info.src)).then(p => {
      if (!p.title && !p.image) return card.remove();
      card.classList.remove('loading');
      card.replaceChildren(
        p.image ? el('img', { src: p.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.remove() }) : '',
        el('div', { class: 'lc-body' }, el('small', {}, p.site || ''), el('b', {}, p.title || info.src), p.description ? el('span', {}, p.description) : ''));
    }).catch(() => card.remove());
    return card;
  }
  return null;
}
// Corps d'un message : texte + photo / vidéo / aperçu du premier lien
function messageBody(m) {
  const frag = [];
  if (m.kind === 'audio' && m.media) return [audioPlayer(m.media, m.duration)];
  if (m.kind === 'image' && m.media) {
    frag.push(photoEl(m.media, m.content !== '🖼️ Photo' ? m.content : ''));
    if (m.content && m.content !== '🖼️ Photo') frag.push(el('div', { class: 'text' }, linkify(m.content)));
    return frag;
  }
  frag.push(el('div', { class: 'text' }, linkify(m.content)));
  const links = (m.content.match(/https?:\/\/[^\s<]+/g) || []).slice(0, 2);
  for (const l of links) {
    const info = embedInfo(l.replace(/[.,!?)]+$/, ''));
    if (!info) continue;
    if (info.type === 'link' && links.length > 1) continue;
    const e2 = embedEl(info);
    if (e2) frag.push(e2);
    if (info.type === 'link') break;
  }
  return frag;
}

// ---------- Plein écran ----------
function openLightbox(src, caption) {
  const box = el('div', { class: 'lightbox', onclick: e => { if (e.target === box) box.remove(); } },
    el('img', { src, alt: caption || '' }),
    caption ? el('div', { class: 'lb-cap' }, caption) : null,
    el('div', { class: 'lb-actions' },
      el('a', { class: 'btn btn-sm', href: src, download: '', target: '_blank' }, '⬇️ Télécharger'),
      el('button', { class: 'btn btn-sm', onclick: () => box.remove() }, '✕ Fermer')));
  document.body.append(box);
  const esc = e => { if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

// ---------- Envoyer une photo ----------
const photoInput = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
document.body.append(photoInput);
$('attachBtn').onclick = () => {
  if (isMuted()) return toast('🔇 Tu es rendu muet pour le moment');
  photoInput.click();
};
photoInput.onchange = () => { const f = photoInput.files[0]; photoInput.value = ''; if (f) preparePhoto(f); };
// Coller une image (Ctrl+V) ou la glisser-déposer
input.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); preparePhoto(f); }
});
const mainEl = document.querySelector('.main');
mainEl.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => i.type.startsWith('image/'))) { e.preventDefault(); mainEl.classList.add('dropping'); } });
mainEl.addEventListener('dragleave', e => { if (e.target === mainEl) mainEl.classList.remove('dropping'); });
mainEl.addEventListener('drop', e => {
  mainEl.classList.remove('dropping');
  const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); preparePhoto(f); }
});

async function shrinkPhoto(file) {
  // Les GIF restent animés (s'ils ne sont pas trop lourds) ; les autres photos sont réduites à 1600 px
  if (file.type === 'image/gif' && file.size <= 6 * 1024 * 1024) return file;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible')); i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = el('canvas', { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.86));
}
function preparePhoto(file) {
  if (!state.view) return;
  if (!file.type.startsWith('image/')) return toast('Choisis une image');
  if (file.size > 25 * 1024 * 1024) return toast('Image trop lourde');
  const url = URL.createObjectURL(file);
  const caption = el('input', { class: 'input', maxlength: 500, placeholder: 'Ajouter une légende (facultatif)…', value: input.value.trim() });
  const target = state.view.type === 'room' ? { room: state.view.slug } : { pm: state.view.userId };
  const err = el('div', { class: 'error' });
  const close = modal(
    el('h3', {}, '📷 Envoyer une photo'),
    el('img', { src: url, class: 'photo-preview', alt: '' }),
    el('div', { class: 'field', style: 'margin-top:12px' }, caption), err,
    el('div', { class: 'actions' },
      el('button', { class: 'btn btn-ghost', onclick: () => { URL.revokeObjectURL(url); close(); } }, 'Annuler'),
      el('button', { class: 'btn btn-primary', onclick: async e => {
        e.target.disabled = true; e.target.textContent = '⏳ Envoi…';
        try {
          const blob = await shrinkPhoto(file);
          const r = await fetch('/api/media', { method: 'POST', body: blob, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Envoi impossible');
          const payload = { image: { url: d.url }, text: caption.value.trim() };
          const ack = res => { if (res?.error) toast(res.error); };
          if (target.room) socket.emit('message', payload, ack); else socket.emit('pm', { to: target.pm, ...payload }, ack);
          if (caption.value.trim() === input.value.trim()) { input.value = ''; input.dispatchEvent(new Event('input')); }
          URL.revokeObjectURL(url); close();
        } catch (ex) { err.textContent = ex.message; e.target.disabled = false; e.target.textContent = 'Envoyer'; }
      } }, 'Envoyer')));
  caption.focus();
}

// ---------- Galerie du salon ----------
$('headMedia').onclick = async () => {
  const r = state.currentRoom;
  if (!r) return;
  let items = [];
  try { items = (await api(`/api/rooms/${encodeURIComponent(r.slug)}/media`)).items; } catch (e) { return toast(e.message); }
  const photos = items.filter(i => i.kind === 'image');
  const links = items.filter(i => i.kind !== 'image').flatMap(i => (i.content.match(/https?:\/\/[^\s<]+/g) || []).map(l => ({ ...i, link: l.replace(/[.,!?)]+$/, '') })));
  const videos = links.filter(l => ['youtube', 'frame', 'video', 'spotify'].includes(embedInfo(l.link)?.type));
  const others = links.filter(l => !videos.includes(l));
  let tab = 'photos';
  const body = el('div', {});
  const tabs = el('div', { class: 'tabs' });
  const draw = () => {
    tabs.replaceChildren(...[['photos', `📷 Photos (${photos.length})`], ['videos', `▶️ Vidéos & musique (${videos.length})`], ['links', `🔗 Liens (${others.length})`]]
      .map(([k, l]) => el('button', { class: tab === k ? 'active' : '', onclick: () => { tab = k; draw(); } }, l)));
    if (tab === 'photos') body.replaceChildren(photos.length ? el('div', { class: 'gallery-grid' }, ...photos.map(p => {
      const img = el('img', { src: p.media, alt: '', loading: 'lazy', title: `${p.username} · ${LC.date(p.createdAt)}` });
      img.onclick = () => openLightbox(p.media, `${p.username} · ${LC.date(p.createdAt)}${p.content !== '🖼️ Photo' ? ' — ' + p.content : ''}`);
      return img;
    })) : el('p', { class: 'empty' }, 'Aucune photo partagée ici pour le moment'));
    else {
      const list = tab === 'videos' ? videos : others;
      body.replaceChildren(list.length ? el('div', { class: 'gallery-list' }, ...list.map(l => el('div', { class: 'gallery-item' },
        el('div', { class: 'help' }, `${l.username} · ${LC.date(l.createdAt)}`), embedEl(embedInfo(l.link)) || el('a', { href: l.link, target: '_blank', rel: 'noopener noreferrer' }, l.link))))
        : el('p', { class: 'empty' }, tab === 'videos' ? 'Aucune vidéo ni musique partagée ici' : 'Aucun lien partagé ici'));
    }
  };
  draw();
  const close = modal(el('h3', {}, `🖼️ Médias de « ${r.name} »`), tabs, body, el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Fermer'));
  document.querySelectorAll('.modal-back .modal')[document.querySelectorAll('.modal-back .modal').length - 1].classList.add('gallery-modal');
};
