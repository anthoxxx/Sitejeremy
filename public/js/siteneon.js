// The Paradise — 💡 Le néon tout autour du site : chacun choisit le sien (style, couleurs, force, vitesse).
// Le choix est gardé sur l'appareil de la personne : c'est SON affichage, les autres ne le voient pas.
const SiteNeon = (() => {
  const STYLES = [['off', '🚫 Aucun'], ['fixe', '💡 Fixe'], ['pulse', '💓 Qui respire'], ['clignote', '⚡ Clignote'], ['tourne', '🔄 Qui tourne'], ['arcenciel', '🌈 Arc-en-ciel'], ['deux', '🎨 Deux couleurs']];
  const COLS = ['#ff2d55', '#ff5fa2', '#af52de', '#5856d6', '#007aff', '#32ade6', '#00c7be', '#34c759', '#ffcc00', '#ff9500', '#ff3b30', '#ffffff', '#d4af37'];
  const KEY = 'lc_neon';
  const DEF = { style: 'off', c1: '#ff5fa2', c2: '#32ade6', power: 60, speed: 50, width: 3 };
  const load = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEF }; } };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  let box = null;
  function apply(c = load()) {
    if (!box) { box = document.createElement('div'); box.className = 'site-neon'; box.setAttribute('aria-hidden', 'true'); document.body.append(box); }
    box.dataset.style = c.style;
    box.classList.toggle('hidden', c.style === 'off');
    const p = c.power / 100, sp = 0.6 + (100 - c.speed) / 100 * 5.4; // durée d'un tour : de 0,6 s (très vite) à 6 s (lent)
    box.style.cssText = `--n1:${c.c1};--n2:${c.style === 'deux' ? c.c2 : c.c1};--nw:${c.width}px;--np:${p};--nglow:${Math.round(6 + p * 26)}px;--nsp:${sp.toFixed(2)}s`;
  }
  function open() {
    let c = load(), close = null;
    const m = el('div', { class: 'sn' });
    const draw = () => {
      const colorRow = (k, lbl) => el('div', {}, el('small', { class: 'sn-lbl' }, lbl), el('div', { class: 'swatches' }, ...COLS.map(x => el('button', { type: 'button', class: 'swatch' + (c[k] === x ? ' active' : ''), style: `background:${x}`, title: x, onclick: () => set({ [k]: x }) })),
        el('input', { type: 'color', class: 'color-input', value: c[k], onchange: e => set({ [k]: e.target.value }) })));
      const slider = (k, lbl, min, max, l, r) => el('label', { class: 'sn-sl' }, el('small', { class: 'sn-lbl' }, lbl), el('div', {}, el('span', {}, l), el('input', { type: 'range', min, max, value: c[k], oninput: e => { c[k] = +e.target.value; save(c); apply(c); } }), el('span', {}, r)));
      m.replaceChildren(
        el('h3', {}, '💡 Le néon autour du site'),
        el('p', { class: 'help' }, 'Choisis le néon que TU veux voir tout autour du site. Il est rien que pour toi : chacun choisit le sien 😉'),
        el('div', { class: 'sn-styles' }, ...STYLES.map(([v, l]) => el('button', { type: 'button', class: 'btn btn-sm' + (c.style === v ? ' btn-primary' : ''), onclick: () => set({ style: v }) }, l))),
        c.style !== 'off' && c.style !== 'arcenciel' ? colorRow('c1', c.style === 'deux' ? '🎨 1ʳᵉ couleur' : '🎨 Couleur') : null,
        c.style === 'deux' ? colorRow('c2', '🎨 2ᵉ couleur') : null,
        c.style !== 'off' ? slider('power', '✨ Force de la lumière', 10, 100, '🔅', '🔆') : null,
        c.style !== 'off' ? slider('width', '📏 Épaisseur', 1, 8, 'fin', 'épais') : null,
        ['pulse', 'clignote', 'tourne', 'arcenciel', 'deux'].includes(c.style) ? slider('speed', '⏱️ Vitesse', 0, 100, '🐢', '🐇') : null,
        el('div', { style: 'text-align:right;margin-top:12px' }, el('button', { class: 'btn btn-primary', onclick: () => close && close() }, 'OK')));
    };
    const set = o => { c = { ...c, ...o }; save(c); apply(c); draw(); };
    draw(); close = modal(m);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply()); else apply();
  return { open, apply };
})();
window.SiteNeon = SiteNeon;
