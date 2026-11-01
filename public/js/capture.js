// The Paradise — alertes « capture d'écran » et « caméra allumée » (comme Snapchat)
// Un site web ne peut repérer que les raccourcis clavier de capture sur ordinateur :
// Impr. écran, Windows + Maj + S, Cmd + Maj + 3 / 4 / 5 sur Mac.
const Capture = {
  last: 0,
  report(how) {
    if (Date.now() - this.last < 3000) return;
    this.last = Date.now();
    const ctx = {};
    if (!(typeof Call !== 'undefined' && Call.id) && state.view?.type === 'pm') ctx.pm = state.view.userId;
    socket.emit('screenshot', { ...ctx, how });
    toast('📸 Capture d\'écran : les personnes concernées ont été prévenues');
  },
};
document.addEventListener('keyup', e => { if (e.key === 'PrintScreen' || e.code === 'PrintScreen') Capture.report('impr'); });
document.addEventListener('keydown', e => {
  if (e.key === 'PrintScreen' || e.code === 'PrintScreen') return Capture.report('impr');
  // Mac : Cmd + Maj + 3 / 4 / 5 · Windows : Win + Maj + S
  if (e.metaKey && e.shiftKey && ['Digit3', 'Digit4', 'Digit5', 'KeyS'].includes(e.code)) Capture.report('raccourci');
});

// Quelqu'un a fait une capture de notre conversation privée
socket.on('screenshot_alert', ({ from, username }) => {
  // La notification (cloche + message) arrive déjà ; on ajoute juste une ligne dans la conversation ouverte
  if (state.view?.type === 'pm' && state.view.userId === from) addSys(`📸 ${username} a fait une capture d'écran`);
});
// Pendant un appel : capture d'écran ou caméra allumée par l'autre personne
socket.on('call_notice', ({ callId, text }) => {
  if (typeof Call === 'undefined' || callId !== Call.id) return;
  ding();
  toast(text);
  const ui = Call.ui;
  if (ui) {
    const n = el('div', { class: 'call-notice' }, text);
    ui.append(n);
    setTimeout(() => n.remove(), 5000);
  }
});
// Caméra allumée dans le vocal du salon où l'on se trouve
socket.on('cam_alert', ({ room, userId, username }) => {
  if (userId === state.me?.id) return;
  if (state.view?.type === 'room' && state.view.slug === room) toast(`📷 ${username} a allumé sa caméra`);
});
