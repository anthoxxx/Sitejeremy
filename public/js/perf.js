// The Paradise — ⚡ Fluidité : on garde le site rapide, même sur les petits téléphones.
//  1. Ce qui n'est pas à l'écran (vieux messages, membres plus bas dans la liste…) met ses animations en pause.
//  2. Mode « léger » automatique : si l'appareil n'arrive pas à afficher le site de façon fluide, les effets les plus
//     lourds (néons qui respirent, reflets, flocons…) deviennent fixes. Les beaux appareils gardent tout.
(() => {
  const root = document.documentElement;
  let saved = null; try { saved = localStorage.getItem('lc_lite'); } catch (e) {}
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3 || navigator.connection?.saveData;
  if (saved === '1' || (saved === null && weak)) root.classList.add('lite');
  window.LC_LITE = () => root.classList.contains('lite');
  window.LC_setLite = on => { root.classList.toggle('lite', on); try { localStorage.setItem('lc_lite', on ? '1' : '0'); } catch (e) {} };

  // ---------- 1. pause des animations hors de l'écran ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(list => { for (const e of list) e.target.classList.toggle('offscreen', !e.isIntersecting); }, { rootMargin: '150px 0px' }) : null;
  const watched = new WeakSet();
  const watch = n => { if (io && n.nodeType === 1 && !watched.has(n)) { watched.add(n); io.observe(n); } };
  const LISTS = ['messages']; // seulement les messages : dans les menus (salons, membres), le téléphone se trompait et des salons restaient invisibles
  function hook() {
    for (const id of LISTS) {
      const box = document.getElementById(id); if (!box || box.__perf) continue; box.__perf = true;
      [...box.children].forEach(watch);
      new MutationObserver(ms => { for (const m of ms) { m.addedNodes.forEach(watch); m.removedNodes.forEach(n => { if (n.nodeType === 1 && watched.has(n)) { watched.delete(n); io.unobserve(n); } }); } }).observe(box, { childList: true });
    }
  }
  document.addEventListener('DOMContentLoaded', hook); setTimeout(hook, 1500); setTimeout(hook, 5000);

  // ---------- 2. on mesure la fluidité quelques secondes après l'ouverture ----------
  if (saved !== null) return; // déjà mesuré (ou choisi) avant
  addEventListener('load', () => setTimeout(() => {
    if (document.hidden) return;
    let n = 0, slow = 0, last = performance.now(); const t0 = last;
    const f = t => { n++; if (t - last > 34) slow++; last = t; if (t - t0 < 3000) requestAnimationFrame(f); else done(); };
    const done = () => { const fps = n / 3; const lite = fps < 45 || slow > n * .25; window.LC_setLite(lite || weak); };
    requestAnimationFrame(f);
  }, 3500));
})();
