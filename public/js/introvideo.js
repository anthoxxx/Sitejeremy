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
  // 🌊 le bruit de la mer et des mouettes (vrais enregistrements Mixkit, libres de droits) : il démarre quand on entre
  let AC = null, gain = null, src = null, loading = null, muted = false;
  try { muted = localStorage.getItem('lc_home_sound') === '0'; } catch (e) {}
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hv-sound'; btn.title = 'Bruit de la mer';
  const paint = () => { const on = !!src && !muted; btn.textContent = on ? '🔊' : '🔇'; btn.classList.toggle('on', on); btn.setAttribute('aria-label', on ? 'Couper le bruit de la mer' : 'Mettre le bruit de la mer'); };
  async function music() {
    if (muted) return paint();
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') await AC.resume();
      if (!src) { if (!loading) loading = fetch('/video/paradise-mer.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, ko) => AC.decodeAudioData(b, ok, ko)));
        const buf = await loading; if (src || muted) return paint();
        gain = AC.createGain(); gain.gain.value = 0; gain.connect(AC.destination);
        src = AC.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(); }
      gain.gain.cancelScheduledValues(AC.currentTime); gain.gain.setValueAtTime(gain.gain.value, AC.currentTime); gain.gain.linearRampToValueAtTime(.7, AC.currentTime + 3);
    } catch (e) { console.warn('musique', e); }
    paint();
  }
  function hush() { if (!gain || !AC) return; gain.gain.cancelScheduledValues(AC.currentTime); gain.gain.setValueAtTime(gain.gain.value, AC.currentTime); gain.gain.linearRampToValueAtTime(0, AC.currentTime + .6); setTimeout(() => { try { src?.stop(); } catch (e) {} src = null; paint(); }, 700); }
  btn.addEventListener('click', e => { e.stopPropagation(); muted = !!src && !muted ? true : false; try { localStorage.setItem('lc_home_sound', muted ? '0' : '1'); } catch (x) {} if (muted) hush(); else music(); paint(); });
  document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else if (src) AC.resume(); });
  addEventListener('pagehide', () => { try { AC?.close(); } catch (e) {} });
  document.body.append(btn); paint();
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
  const enter = () => { if (gone) return; gone = true; music(); document.documentElement.classList.remove('hv-pre'); intro.classList.add('hv-leave'); document.body.classList.remove('hv-locked'); document.body.classList.add('hv-in');
    setTimeout(() => intro.remove(), 1400); setTimeout(() => document.getElementById('authCard')?.scrollIntoView({ behavior: 'smooth', block: innerWidth < 760 ? 'start' : 'center' }), innerWidth < 760 ? 900 : 0); };
  intro.querySelector('.hv-enter').addEventListener('click', e => { e.stopPropagation(); enter(); });
  intro.addEventListener('click', enter);
  let y0 = null; intro.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true }); intro.addEventListener('touchend', e => { if (y0 != null && y0 - (e.changedTouches[0]?.clientY ?? y0) > 40) enter(); y0 = null; });
  addEventListener('keydown', e => { if (!gone && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) enter(); });
})();
