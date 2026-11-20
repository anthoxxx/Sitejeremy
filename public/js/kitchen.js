// The Paradise — 👨‍🍳 L'univers du salon « Cuisine » : enseigne néon, ustensiles lumineux qui se balancent au-dessus
// du plan de travail (fouet, spatule, louche, poêle, cuillère en bois, couteau…), mur carrelé, vapeur, et la recette du jour.
const Kitchen = (() => {
  const SLUG = 'cuisine';
  const C = { o: '#ff7a2f', y: '#ffd23f', p: '#ff4fd8', c: '#38e8ff', g: '#2bff88', r: '#ff3b4f' };
  // les dessins des ustensiles (des traits, comme des tubes de néon)
  const U = {
    fouet: { w: 40, h: 120, d: 'M20 0V14 M17 14h6v36h-6z M20 50C6 70 6 100 20 112C34 100 34 70 20 50 M20 50C12 72 12 98 20 112C28 98 28 72 20 50 M20 50V112' },
    spatule: { w: 40, h: 120, d: 'M20 0V14 M20 14V68 M9 68h22v38a6 6 0 0 1-6 6h-10a6 6 0 0 1-6-6z M15 76v28 M20 76v28 M25 76v28' },
    louche: { w: 44, h: 120, d: 'M30 0V14 M30 14V84 M6 84h32c0 16-7 26-16 26s-16-10-16-26z' },
    poele: { w: 70, h: 120, d: 'M35 0V12 M32 12h6v36h-6z M35 48m-28 30a28 28 0 1 0 56 0a28 28 0 1 0-56 0 M35 56m-21 22a21 21 0 1 0 42 0a21 21 0 1 0-42 0' },
    cuillere: { w: 40, h: 120, d: 'M20 0V14 M20 14V78 M20 78c-9 0-12 10-12 17s5 15 12 15 12-8 12-15-3-17-12-17z' },
    couteau: { w: 40, h: 120, d: 'M20 0V12 M15 12h10v34h-10z M15 46h12c2 18 0 44-8 64-3-20-4-44-4-64z' },
    rouleau: { w: 40, h: 120, d: 'M20 0V12 M17 12h6v16h-6z M12 28h16v72h-16z M17 100h6v16h-6z' },
    fourchette: { w: 40, h: 120, d: 'M20 0V12 M20 12V70 M12 70h16 M12 70v16a8 8 0 0 0 16 0V70 M12 70v-6 M20 86v24 M28 70v-6 M16 64v6 M24 64v6' },
  };
  const svg = (k, col, cls = '') => {
    const u = U[k], s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${u.w} ${u.h}`); s.setAttribute('class', 'ki-ut ' + cls); s.style.color = col; s.style.width = `calc(var(--ki-h) * ${u.w / u.h})`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', u.d); s.append(p); return s;
  };
  const hat = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('class', 'ki-hat');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M16 40c-8 0-12-6-12-12s6-12 12-11c2-7 8-11 16-11s14 4 16 11c6-1 12 4 12 11s-4 12-12 12z M16 40v14h32V40 M16 48h32'); s.append(p); return s; };
  // une recette différente chaque jour
  const RECETTES = [
    ['🥞', 'Crêpes', '250 g de farine, 4 œufs, 50 cl de lait, 1 pincée de sel, 2 c. à soupe de sucre et 50 g de beurre fondu. On fouette, on laisse reposer 1 h, et à la poêle !'],
    ['🍝', 'Pâtes carbonara', 'Des spaghettis, des lardons dorés, 2 jaunes d\'œufs battus avec du parmesan et du poivre. On mélange hors du feu pour que ce soit bien crémeux.'],
    ['🍫', 'Mousse au chocolat', '200 g de chocolat noir fondu, 6 œufs : les jaunes dans le chocolat, les blancs montés en neige ferme. On mélange doucement, 3 h au frigo.'],
    ['🥗', 'Salade César', 'Salade romaine, poulet grillé, croûtons, copeaux de parmesan, et une sauce : mayonnaise, ail, citron, parmesan et un peu de moutarde.'],
    ['🍕', 'Pizza maison', 'Pâte : 500 g de farine, 30 cl d\'eau tiède, 1 sachet de levure, sel, huile d\'olive. 1 h de repos, sauce tomate, mozzarella, et 10 min à 250 °C.'],
    ['🍲', 'Soupe de légumes', 'Carottes, pommes de terre, poireaux et oignon, coupés et cuits 30 min dans 1,5 L de bouillon. On mixe, crème fraîche, sel et poivre.'],
    ['🍪', 'Cookies', '125 g de beurre mou, 100 g de sucre, 1 œuf, 200 g de farine, 1/2 sachet de levure, 150 g de pépites de chocolat. 10 min à 180 °C.'],
    ['🍳', 'Omelette baveuse', '3 œufs battus avec sel et poivre, une noisette de beurre dans la poêle bien chaude, on remue doucement et on plie quand c\'est encore coulant.'],
    ['🍰', 'Gâteau au yaourt', '1 pot de yaourt, 2 pots de sucre, 3 pots de farine, 1/2 pot d\'huile, 3 œufs, 1 sachet de levure. 35 min à 180 °C. Le pot sert de mesure !'],
    ['🥘', 'Poulet curry coco', 'Des morceaux de poulet dorés avec un oignon, 2 c. de curry, 40 cl de lait de coco. 20 min à feu doux, avec du riz basmati.'],
    ['🍮', 'Crème brûlée', '50 cl de crème, 5 jaunes d\'œufs, 80 g de sucre, de la vanille. 1 h à 100 °C, une nuit au frigo, puis du sucre caramélisé dessus.'],
    ['🌮', 'Tacos maison', 'Viande hachée cuite avec oignon, cumin et paprika, dans des tortillas avec salade, tomates, fromage râpé et une sauce yaourt-citron.'],
  ];
  let small = innerWidth < 760; try { const v = localStorage.getItem('lc_kitchen_small'); if (v) small = v === '1'; } catch (e) {} // sur téléphone : en petit au départ (le bouton ↕ l'agrandit)
  function banner() {
    const day = Math.floor((Date.now() + 3600e3) / 86400e3), [ic, name, txt] = RECETTES[day % RECETTES.length];
    const left = [['fouet', C.c], ['spatule', C.o], ['louche', C.y], ['poele', C.p]], right = [['cuillere', C.y], ['couteau', C.c], ['rouleau', C.o], ['fourchette', C.g]];
    const hang = list => el('div', { class: 'ki-hang' }, ...list.map(([k, col], i) => { const s = svg(k, col); s.style.animationDuration = `${3.2 + (i * 1.3) % 2.4}s, ${5 + i * 1.7}s`; s.style.animationDelay = `${-i * .9}s, ${-i * 2.1}s`; return s; }));
    const b = el('div', { id: 'kitchenBanner', class: 'ki-banner' + (small ? ' small' : '') },
      el('div', { class: 'ki-rail' }),
      hang(left),
      el('div', { class: 'ki-sign' }, hat(), el('b', { class: 'ki-neon' }, 'CUISINE'), el('small', { class: 'ki-sub' }, 'du Paradise · recettes, astuces et gourmandises'),
        el('div', { class: 'ki-recipe' }, el('span', { class: 'ki-rtitle' }, `${ic} La recette du jour : ${name}`), el('span', { class: 'ki-rtext' }, txt))),
      hang(right),
      el('button', { type: 'button', class: 'ki-toggle', title: small ? 'Agrandir le décor' : 'Réduire le décor', onclick: () => { small = !small; try { localStorage.setItem('lc_kitchen_small', small ? '1' : '0'); } catch (e) {} b.classList.toggle('small', small); } }, '↕'));
    return b;
  }
  function set(on) {
    const main = document.querySelector('.main'); if (!main) return;
    main.classList.toggle('kitchen-universe', on);
    let fx = $('kitchenFx'), b = $('kitchenBanner');
    if (!on) { fx?.remove(); b?.remove(); return; }
    if (!fx) { // de la vapeur qui monte doucement, et quelques étincelles de cuisson
      fx = el('div', { id: 'kitchenFx', class: 'ki-fx' }, ...Array.from({ length: 10 }, (_, i) => el('span', { class: 'ki-steam', style: `left:${(i * 37 + 8) % 96}%;animation-delay:${-(i * 1.7) % 12}s;animation-duration:${9 + (i % 4) * 2}s;--s:${.7 + (i % 3) * .3}` })),
        ...Array.from({ length: 8 }, (_, i) => el('span', { class: 'ki-spark', style: `left:${(i * 53 + 20) % 94}%;animation-delay:${-(i * 2.3) % 9}s;animation-duration:${6 + (i % 3) * 2}s;color:${Object.values(C)[i % 6]}` })));
      main.prepend(fx);
    }
    if (!b) $('messages').before(banner());
  }
  return { set, SLUG };
})();
window.Kitchen = Kitchen;
