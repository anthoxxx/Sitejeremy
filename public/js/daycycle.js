// The Paradise — 🌅 Le site vit avec l'heure : une légère teinte de couleur qui suit l'heure de Paris
// (aube rose, journée lumineuse, coucher de soleil orange et violet, nuit bleue étoilée),
// et un petit feu d'artifice à minuit le week-end. On peut le couper dans la fenêtre des thèmes 🎨.
(() => {
  const root = document.documentElement;
  const on = () => { try { return localStorage.getItem('lc_daycycle') !== '0'; } catch (e) { return true; } };
  const paris = () => { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()); const g = t => p.find(x => x.type === t)?.value; return { h: +g('hour') + (+g('minute')) / 60, day: g('weekday') }; };
  function phase(h) { return h >= 6 && h < 8.5 ? 'aube' : h >= 8.5 && h < 17.5 ? 'jour' : h >= 17.5 && h < 21 ? 'soir' : 'nuit'; }
  function apply() {
    if (!on()) { delete root.dataset.sky; return; }
    root.dataset.sky = phase(paris().h);
  }
  // 🎆 minuit pile la nuit de vendredi à samedi et de samedi à dimanche
  let lastFw = '';
  function midnight() {
    const { h, day } = paris();
    if (!on() || h >= .05 || !/^(sam|dim)/i.test(day)) return;
    const key = new Date().toDateString(); if (key === lastFw) return; lastFw = key;
    try { window.LC?.confetti?.(['🎆', '🎇', '✨', '🎉']); setTimeout(() => window.LC?.confetti?.(['🎆', '🎇', '💫']), 2500); } catch (e) {}
    try { (window.toast || (() => {}))('🎆 Il est minuit : bon week-end sur le Paradise !'); } catch (e) {}
  }
  window.LC_dayCycle = { set: v => { try { localStorage.setItem('lc_daycycle', v ? '1' : '0'); } catch (e) {} apply(); }, on, phase: () => root.dataset.sky || '' };
  apply();
  setInterval(() => { apply(); midnight(); }, 60000);
})();
