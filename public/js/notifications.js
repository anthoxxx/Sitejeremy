// The Paradise — notifications (sanctions, invitations, rôle…) + bandeau "muet"
const Notifs = { list: [], unread: 0, open: false };

async function loadNotifications() {
  try {
    const d = await api('/api/notifications');
    Notifs.list = d.notifications;
    Notifs.unread = d.unread;
    renderNotifCount();
    if (Notifs.open) renderNotifPanel();
    // Sanctions reçues pendant qu'on était hors ligne : on les montre en grand une fois
    const shown = shownSet();
    const missed = d.notifications.filter(n => !n.read && IMPORTANT.includes(n.type) && !shown.has(n.id));
    if (missed.length) showSanction(missed[0], missed.length - 1);
  } catch (e) {}
}
const IMPORTANT = ['mute', 'warn', 'ban', 'kick', 'room_kick', 'profile_reset'];
function shownSet() {
  try { return new Set(JSON.parse(sessionStorage.getItem('lc_shown') || '[]')); } catch (e) { return new Set(); }
}
function markShown(id) {
  const s = shownSet(); s.add(id);
  try { sessionStorage.setItem('lc_shown', JSON.stringify([...s].slice(-50))); } catch (e) {}
}

function renderNotifCount() {
  const c = $('notifCount');
  c.textContent = Notifs.unread > 9 ? '9+' : Notifs.unread;
  c.classList.toggle('hidden', !Notifs.unread);
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return LC.date(ts);
}

function notifAction(n) {
  if (n.type === 'room_invite' && n.data?.slug) return () => joinRoom(n.data.slug);
  if (n.type === 'role' && isStaff()) return () => { location.href = '/admin'; };
  return () => showSanction(n);
}

function renderNotifPanel() {
  const panel = $('notifPanel');
  const canDesktop = 'Notification' in window && Notification.permission === 'default';
  panel.replaceChildren(...[
    el('div', { class: 'notif-head' }, el('b', {}, 'Notifications'),
      Notifs.list.length ? el('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
        await api('/api/notifications', { method: 'DELETE' }).catch(() => {});
        Notifs.list = []; Notifs.unread = 0; renderNotifCount(); renderNotifPanel();
      } }, 'Tout effacer') : null),
    canDesktop ? el('button', { class: 'notif-desktop', onclick: async () => { await Notification.requestPermission(); renderNotifPanel(); } },
      '🖥️ Activer les notifications du navigateur (même quand l\'onglet est caché)') : null,
    Notifs.list.length
      ? el('div', { class: 'notif-list' }, ...Notifs.list.map(n => el('div', {
        class: 'notif-item' + (n.read ? '' : ' unread') + (IMPORTANT.includes(n.type) ? ' important' : ''),
        onclick: () => { closeNotifPanel(); notifAction(n)(); },
      }, el('div', { class: 'notif-ico' }, n.icon), el('div', { class: 'meta' },
        el('div', { class: 'notif-title' }, n.title), n.text ? el('div', { class: 'notif-text' }, n.text) : null,
        el('div', { class: 'notif-time' }, timeAgo(n.createdAt))))))
      : el('div', { class: 'empty' }, '🔕 Aucune notification')].filter(Boolean));
}
function openNotifPanel() {
  Notifs.open = true;
  renderNotifPanel();
  $('notifPanel').classList.remove('hidden');
  if (Notifs.unread) {
    api('/api/notifications/read', { method: 'POST' }).catch(() => {});
    Notifs.unread = 0;
    renderNotifCount();
    setTimeout(() => Notifs.list.forEach(n => { n.read = true; }), 1500);
  }
}
function closeNotifPanel() { Notifs.open = false; $('notifPanel').classList.add('hidden'); }
$('notifBtn').onclick = e => { e.stopPropagation(); Notifs.open ? closeNotifPanel() : openNotifPanel(); };
document.addEventListener('click', e => { if (Notifs.open && !e.target.closest('.notif-wrap')) closeNotifPanel(); });

// Grande fenêtre pour les sanctions (impossible à rater)
function showSanction(n, more = 0) {
  markShown(n.id);
  const colors = { ban: 'var(--red)', mute: 'var(--gold)', warn: 'var(--gold)', kick: 'var(--red)', room_kick: 'var(--rose)', profile_reset: 'var(--violet)' };
  const extra = n.type === 'mute' && n.data?.until > Date.now() ? el('div', { class: 'sanction-timer', 'data-until': n.data.until }, muteLeft(n.data.until)) : null;
  const close = modal(el('div', { class: 'sanction', style: `--sc:${colors[n.type] || 'var(--rose)'}` },
    el('div', { class: 'sanction-ico' }, n.icon),
    el('h3', {}, n.title),
    n.text ? el('p', {}, n.text) : null,
    extra,
    el('p', { class: 'sanction-time' }, LC.date(n.createdAt)),
    el('a', { href: '/#regles', target: '_blank', class: 'sanction-rules' }, '📜 Relire les règles du chat'),
    el('button', { class: 'btn btn-primary', style: 'width:100%;margin-top:16px', onclick: () => {
      close();
      if (more > 0) loadNotifications();
    } }, more > 0 ? `J'ai compris (encore ${more})` : 'J\'ai compris')));
}

// Réception en direct
socket.on('notification', n => {
  Notifs.list.unshift(n);
  Notifs.list = Notifs.list.slice(0, 40);
  if (n.type === 'mute') { state.me.mutedUntil = n.data.until; Voice.leave(false); renderMuteBanner(); }
  if (n.type === 'unmute') { state.me.mutedUntil = 0; renderMuteBanner(); }
  ding();
  if (Notifs.open) {
    renderNotifPanel();
    api('/api/notifications/read', { method: 'POST' }).catch(() => {});
  } else {
    Notifs.unread++;
    renderNotifCount();
  }
  if (n.type === 'birthday') { showBirthday(n); desktopNotify(n); return; }
  if (IMPORTANT.includes(n.type)) showSanction(n);
  else toast(`${n.icon} ${n.title}`, notifAction(n));
  desktopNotify(n);
});

function desktopNotify(n) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const dn = new Notification(n.title, { body: n.text || '', icon: '/favicon.svg', tag: 'lc-' + n.id });
    dn.onclick = () => { window.focus(); dn.close(); };
  } catch (e) {}
}
// Les messages privés déclenchent aussi une notification du navigateur si l'onglet est caché
socket.on('pm', m => {
  if (m.from !== state.me?.id && !state.blocked.has(m.from))
    desktopNotify({ id: 'pm' + m.id, title: `💌 ${m.fromUser.username}`, text: m.content.slice(0, 120) });
});

// ---------- Bandeau "tu es muet" avec compte à rebours ----------
function isMuted() { return !!(state.me && state.me.mutedUntil > Date.now()); }
function muteLeft(until) {
  const s = Math.max(0, Math.round((until - Date.now()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return 'Encore ' + (h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`);
}
function renderMuteBanner() {
  const muted = isMuted();
  const customsClosed = state.customs?.enabled && !state.customs.open && typeof needsCustoms === 'function' && needsCustoms();
  const locked = muted || customsClosed;
  const b = $('muteBanner');
  b.classList.toggle('hidden', !muted);
  $('input').disabled = locked;
  $('composer').querySelectorAll('.send-btn, #recBtn, #dictateBtn').forEach(x => { x.disabled = locked; });
  if ($('input').placeholder.startsWith('👻')) $('input').placeholder = 'Écris ton message…';
  if (customsClosed) $('input').placeholder = '🛂 La douane est fermée, attends le staff…';
  else if ($('input').placeholder.startsWith('🛂')) $('input').placeholder = 'Écris ton message…';
  if (muted) {
    b.replaceChildren(el('span', {}, '🔇'), el('div', {},
      el('b', {}, 'Tu es rendu muet par la modération'),
      el('div', { class: 'help' }, `Fin le ${new Date(state.me.mutedUntil).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${muteLeft(state.me.mutedUntil)}`)));
    $('input').placeholder = 'Tu ne peux pas écrire pour le moment…';
  } else if ($('input').placeholder.startsWith('Tu ne peux pas')) {
    $('input').placeholder = 'Écris ton message…';
  }
}
setInterval(() => {
  if (state.me?.mutedUntil) {
    if (!isMuted()) {
      state.me.mutedUntil = 0;
      toast('🔊 Ta sanction est terminée, tu peux de nouveau écrire');
    }
    renderMuteBanner();
  }
  document.querySelectorAll('.sanction-timer').forEach(t => { t.textContent = muteLeft(+t.dataset.until); });
}, 1000);

// Fenêtre de fête pour la personne dont c'est l'anniversaire
function showBirthday(n) {
  LC.confetti(['🎂', '🎉', '🎈', '🎁']);
  setTimeout(() => LC.confetti(['🎂', '🥳']), 1500);
  const close = modal(el('div', { class: 'sanction bday-modal' },
    el('div', { class: 'bday-big' }, '🎂'),
    el('h3', {}, n.title),
    el('p', {}, n.text),
    el('button', { class: 'btn btn-primary', style: 'width:100%;margin-top:16px', onclick: () => close() }, 'Merci ! 🥳')));
}
