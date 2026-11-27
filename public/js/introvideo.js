// The Paradise — 🎬 L'intro de l'accueil : une vraie vidéo filmée d'îles paradisiaques (drone, lagon turquoise, plages),
// en plein écran avec « Bienvenue au Paradise ». On touche « Entrer au Paradise » : le site se dévoile par-dessus la vidéo,
// qui reste en fond, et le formulaire d'inscription / connexion apparaît en verre.
// Vidéos : Mixkit (licence gratuite Mixkit, utilisation libre).
(() => {
  const q = new URLSearchParams(location.search);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, save = !!navigator.connection?.saveData;
  const small = innerWidth < 760 || (navigator.connection?.effectiveType || '').match(/2g|3g/);
  // 🎥 la vidéo en fond de toute la page d'accueil
  const bg = document.createElement('div'); bg.className = 'hv-bg'; bg.setAttribute('aria-hidden', 'true');
  const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.poster = '/video/paradise-poster.jpg';
  if (!calm && !save) { v.autoplay = true; v.src = small ? '/video/paradise-480.mp4' : '/video/paradise-720.mp4'; }
  bg.append(v, Object.assign(document.createElement('div'), { className: 'hv-dim' }));
  document.body.prepend(bg); document.body.classList.add('hv-on');
  const play = () => v.play?.().catch(() => {}); play();
  document.addEventListener('visibilitychange', () => { if (document.hidden) v.pause(); else play(); });
  // 🌴 l'écran d'accueil (pas quand on revient d'un lien « mot de passe oublié » ou de Google)
  if (q.get('reset') || q.get('google') || calm) { document.body.classList.add('hv-in'); document.documentElement.classList.remove('hv-pre'); return; }
  const intro = document.createElement('div'); intro.className = 'hv-intro';
  intro.innerHTML = `<div class="hv-center">
      <img class="hv-logo" src="/img/logo.webp?v=3" alt="The Paradise">
      <h1 class="hv-title">Bienvenue au <em>Paradise</em></h1>
      <p class="hv-sub">Le chat où l'on se retrouve, au bout du monde 🌴</p>
      <button type="button" class="hv-enter"><span>Entrer au Paradise</span><b>→</b></button>
    </div>
    <div class="hv-memory"><img src="/img/jerome.jpg" alt=""><span>🕯️ En mémoire de <b>Jérôme</b>, qui a rêvé ce Paradise</span></div>
    <div class="hv-scroll">Touche pour entrer</div>`;
  document.body.append(intro); document.body.classList.add('hv-locked');
  let gone = false;
  const enter = () => { if (gone) return; gone = true; document.documentElement.classList.remove('hv-pre'); intro.classList.add('hv-leave'); document.body.classList.remove('hv-locked'); document.body.classList.add('hv-in');
    setTimeout(() => intro.remove(), 1400); setTimeout(() => document.getElementById('authCard')?.scrollIntoView({ behavior: 'smooth', block: innerWidth < 760 ? 'start' : 'center' }), innerWidth < 760 ? 900 : 0); };
  intro.querySelector('.hv-enter').addEventListener('click', e => { e.stopPropagation(); enter(); });
  intro.addEventListener('click', enter);
  let y0 = null; intro.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true }); intro.addEventListener('touchend', e => { if (y0 != null && y0 - (e.changedTouches[0]?.clientY ?? y0) > 40) enter(); y0 = null; });
  addEventListener('keydown', e => { if (!gone && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) enter(); });
})();
