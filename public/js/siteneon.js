// The Paradise — 💡 Le néon tout autour du site : chacun choisit le sien (style, couleurs, force, vitesse).
// Le choix est gardé sur l'appareil de la personne : c'est SON affichage, les autres ne le voient pas.
const SiteNeon = (() => {
  const STYLES = [['off', '🚫 Aucun'], ['fixe', '💡 Fixe'], ['pulse', '💓 Qui respire'], ['clignote', '⚡ Clignote'], ['tourne', '🔄 Qui tourne'], ['arcenciel', '🌈 Arc-en-ciel'], ['deux', '🎨 Deux couleurs']];
  const COLS = ['#ff2d55', '#ff5fa2', '#af52de', '#5856d6', '#007aff', '#32ade6', '#00c7be', '#34c759', '#ffcc00', '#ff9500', '#ff3b30', '#ffffff', '#d4af37'];
  // deux néons : autour du site, et autour de la zone où on écrit « Message »
  const KEYS = { site: 'lc_neon', input: 'lc_neon_in' };
  const DEF = { style: 'off', c1: '#ff5fa2', c2: '#32ade6', power: 60, speed: 50, width: 3 };
  const load = (t = 'site') => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEYS[t]) || '{}') }; } catch (e) { return { ...DEF }; } };
  const save = (c, t = 'site') => { try { localStorage.setItem(KEYS[t], JSON.stringify(c)); } catch (e) {} };
  let box = null;
  const vars = c => { const p = c.power / 100, sp = 0.6 + (100 - c.speed) / 100 * 5.4; return `--n1:${c.c1};--n2:${c.style === 'deux' ? c.c2 : c.c1};--nw:${c.width}px;--np:${p};--nglow:${Math.round(6 + p * 26)}px;--nsp:${sp.toFixed(2)}s`; };
  function applyInput(c = load('input')) {
    const i = document.getElementById('input'); if (!i) return;
    for (const [k] of STYLES) i.classList.remove('inn-' + k);
    i.classList.toggle('in-neon', c.style !== 'off');
    if (c.style === 'off') { i.style.removeProperty('--n1'); return; }
    i.classList.add('inn-' + c.style);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-2').trim() || '#1a1428';
    for (const part of (vars(c) + `;--inbg:${bg}`).split(';')) { const [k, v] = part.split(':'); i.style.setProperty(k, v); }
  }
  function apply(c = load()) {
    if (!box) { box = document.createElement('div'); box.className = 'site-neon'; box.setAttribute('aria-hidden', 'true'); document.body.append(box); }
    box.dataset.style = c.style;
    box.classList.toggle('hidden', c.style === 'off');
    box.style.cssText = vars(c); // vitesse : un tour de 0,6 s (très vite) à 6 s (lent)
  }
  function open(target = 'site') {
    let t = target, c = load(t), close = null;
    const ap = () => (t === 'site' ? apply(c) : applyInput(c));
    const m = el('div', { class: 'sn' });
    const draw = () => {
      const colorRow = (k, lbl) => el('div', {}, el('small', { class: 'sn-lbl' }, lbl), el('div', { class: 'swatches' }, ...COLS.map(x => el('button', { type: 'button', class: 'swatch' + (c[k] === x ? ' active' : ''), style: `background:${x}`, title: x, onclick: () => set({ [k]: x }) })),
        el('input', { type: 'color', class: 'color-input', value: c[k], onchange: e => set({ [k]: e.target.value }) })));
      const slider = (k, lbl, min, max, l, r) => el('label', { class: 'sn-sl' }, el('small', { class: 'sn-lbl' }, lbl), el('div', {}, el('span', {}, l), el('input', { type: 'range', min, max, value: c[k], oninput: e => { c[k] = +e.target.value; save(c, t); ap(); } }), el('span', {}, r)));
      m.replaceChildren(
        el('h3', {}, '💡 Mes néons'),
        el('div', { class: 'ph-seg sn-tabs' }, ...[['site', '🖥️ Autour du site'], ['input', '💬 Autour de « Message »']].map(([v, l]) => el('button', { type: 'button', class: t === v ? 'on' : '', onclick: () => { t = v; c = load(t); draw(); } }, l))),
        el('p', { class: 'help' }, t === 'site' ? 'Choisis le néon que TU veux voir tout autour du site.' : 'Choisis le néon autour de la zone où tu écris tes messages.', ' Il est rien que pour toi : chacun choisit le sien 😉'),
        el('div', { class: 'sn-styles' }, ...STYLES.map(([v, l]) => el('button', { type: 'button', class: 'btn btn-sm' + (c.style === v ? ' btn-primary' : ''), onclick: () => set({ style: v }) }, l))),
        c.style !== 'off' && c.style !== 'arcenciel' ? colorRow('c1', c.style === 'deux' ? '🎨 1ʳᵉ couleur' : '🎨 Couleur') : null,
        c.style === 'deux' ? colorRow('c2', '🎨 2ᵉ couleur') : null,
        c.style !== 'off' ? slider('power', '✨ Force de la lumière', 10, 100, '🔅', '🔆') : null,
        c.style !== 'off' ? slider('width', '📏 Épaisseur', 1, 8, 'fin', 'épais') : null,
        ['pulse', 'clignote', 'tourne', 'arcenciel', 'deux'].includes(c.style) ? slider('speed', '⏱️ Vitesse', 0, 100, '🐢', '🐇') : null,
        el('div', { style: 'text-align:right;margin-top:12px' }, el('button', { class: 'btn btn-primary', onclick: () => close && close() }, 'OK')));
    };
    const set = o => { c = { ...c, ...o }; save(c, t); ap(); draw(); };
    draw(); close = modal(m);
  }
  const start = () => { apply(); applyInput(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // si on change de thème (clair / sombre), le fond de la zone « Message » change aussi
  new MutationObserver(() => applyInput()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return { open, apply, applyInput };
})();
window.SiteNeon = SiteNeon;
