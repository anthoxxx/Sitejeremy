// The Paradise — Les personnages de l'Île 🧍 : le dessin et l'atelier de création
// Chaque membre crée son personnage : peau, coiffure, visage, haut, bas, chaussures, accessoires et extras.
// Le personnage marche (bras et jambes), cligne des yeux, danse… Certaines pièces rares s'achètent avec les pièces 💰.
const Look = (() => {
  const SKINS = ['#ffe0bd', '#f5c79a', '#e8b07f', '#c68642', '#8d5524', '#5c3a21'];
  const HAIR_COLORS = ['#1c1410', '#4a2c17', '#8a5a2b', '#d9a441', '#f4e08a', '#b5341f', '#ff6fb5', '#4fb3ff', '#8b5cf6', '#f2f2f2', '#2bd07a', '#ff8a1f'];
  const COLORS = ['#ffffff', '#1c1c24', '#ff2d55', '#ff8a1f', '#ffd34d', '#2bd07a', '#2fa8ff', '#3b4cca', '#8b5cf6', '#ff5fa2', '#8a5a2b', '#9aa3b2'];
  // Le catalogue : [id, nom, prix (0 = gratuit)]
  const CAT = {
    hair: [['court', 'Court', 0], ['pique', 'En pique', 0], ['meche', 'Mèche', 0], ['long', 'Long', 0], ['queue', 'Queue de cheval', 0], ['chignon', 'Chignon', 0], ['carre', 'Carré', 0], ['boucles', 'Bouclés', 0], ['afro', 'Afro', 0], ['tresses', 'Couettes', 0], ['iroquoise', 'Iroquoise', 0], ['chauve', 'Rasé', 0]],
    eyes: [['normal', 'Normaux', 0], ['grands', 'Grands yeux', 0], ['rieurs', 'Rieurs', 0], ['clin', 'Clin d\'œil', 0], ['cils', 'Avec des cils', 0], ['etoiles', 'Étoiles', 80]],
    mouth: [['sourire', 'Sourire', 0], ['grand', 'Grand sourire', 0], ['neutre', 'Neutre', 0], ['langue', 'Langue', 0], ['bisou', 'Bisou', 0]],
    extra_face: [['', 'Rien', 0], ['joues', 'Joues roses', 0], ['taches', 'Taches de rousseur', 0], ['barbe', 'Barbe', 0], ['moustache', 'Moustache', 0], ['maquillage', 'Maquillage', 0]],
    top: [['tshirt', 'T-shirt', 0], ['debardeur', 'Débardeur', 0], ['chemise', 'Chemise', 0], ['hoodie', 'Sweat à capuche', 0], ['veste', 'Veste ouverte', 0], ['maillot', 'Maillot de foot', 0], ['crop', 'Crop top', 0], ['pull', 'Pull rayé', 0], ['robe', 'Robe', 0], ['costume', 'Costume chic', 150], ['robe_soiree', 'Robe de soirée', 200], ['cuir', 'Blouson en cuir', 180]],
    bottom: [['jean', 'Jean', 0], ['pantalon', 'Pantalon', 0], ['short', 'Short', 0], ['jupe', 'Jupe', 0], ['jogging', 'Jogging', 0]],
    shoes: [['baskets', 'Baskets', 0], ['bottes', 'Bottes', 0], ['talons', 'Talons', 0], ['sandales', 'Sandales', 0], ['dorees', 'Baskets dorées', 120]],
    acc: [['', 'Rien', 0], ['casquette', 'Casquette', 0], ['bonnet', 'Bonnet', 0], ['chapeau', 'Chapeau', 0], ['lunettes', 'Lunettes', 0], ['soleil', 'Lunettes de soleil', 0], ['casque', 'Casque audio', 0], ['noeud', 'Nœud', 0], ['fleur', 'Fleur', 0], ['couronne', 'Couronne', 300], ['aureole', 'Auréole', 250], ['cornes', 'Cornes de diable', 200], ['chat', 'Oreilles de chat', 150], ['lapin', 'Oreilles de lapin', 150]],
    extra: [['', 'Rien', 0], ['sac', 'Sac à dos', 0], ['ailes', 'Ailes d\'ange', 500], ['ailes_demon', 'Ailes de démon', 500], ['cape', 'Cape de héros', 300], ['papillon', 'Ailes de papillon', 450]],
  };
  const priceOf = (slot, id) => (CAT[slot]?.find(x => x[0] === id) || [])[2] || 0;
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  // Un personnage par défaut pour ceux qui n'ont pas encore créé le leur
  function defaults(p) {
    const h = hash('look' + (p.id || p.username || 1)), f = p.gender === 'f';
    const pickC = (arr, k) => arr[(h >> k) % arr.length];
    return {
      skin: pickC(SKINS, 1), hair: f ? ['long', 'queue', 'carre', 'chignon', 'boucles'][(h >> 3) % 5] : ['court', 'pique', 'meche', 'boucles'][(h >> 3) % 4], hairColor: pickC(HAIR_COLORS.slice(0, 6), 5),
      eyes: 'normal', mouth: 'sourire', face: f ? 'joues' : '', top: f ? ['tshirt', 'crop', 'robe'][(h >> 7) % 3] : ['tshirt', 'hoodie', 'chemise'][(h >> 7) % 3], topColor: pickC(COLORS.slice(2), 9),
      bottom: f ? ['jean', 'jupe', 'short'][(h >> 11) % 3] : ['jean', 'pantalon', 'jogging'][(h >> 11) % 3], bottomColor: ['#2f4f8f', '#1c1c24', '#8a5a2b', '#9aa3b2'][(h >> 13) % 4],
      shoes: f ? 'baskets' : 'baskets', shoesColor: ['#ffffff', '#1c1c24', '#ff2d55'][(h >> 15) % 3], acc: '', extra: '',
    };
  }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  // ---------- Le dessin ----------
  // Le personnage est dessiné les pieds en (0, 22) et la tête vers (0, -30) : renvoie le centre de la tête
  function draw(g, L, o = {}) {
    L = { ...defaults(o), ...(L || {}) };
    const t = o.t || 0, walk = !!o.walking, act = o.act || '', seed = o.seed || 0;
    const ph = walk ? Math.sin(t * 11 + seed) : 0;
    const dancing = act === 'dance' || act === 'dj', sitting = act === 'sit' || act === 'tan' || act === 'popcorn' || act === 'marshmallow' || act === 'guitar' || act === 'piano' || act === 'read' || act === 'work';
    const bounce = walk ? Math.abs(ph) * 2 : dancing ? Math.abs(Math.sin(t * 9 + seed)) * 4 : Math.sin(t * 2 + seed) * .6;
    const skin = L.skin, top = L.topColor || '#ff2d55', bot = L.bottomColor || '#2f4f8f', hairC = L.hairColor;
    const skinD = shade(skin, .82);
    g.save(); g.translate(0, -bounce);
    if (o.dir < 0) g.scale(-1, 1);
    const HY = -30; // centre de la tête
    // 1) extras derrière le corps
    if (L.extra === 'ailes' || L.extra === 'ailes_demon' || L.extra === 'papillon') {
      const fl = Math.sin(t * (walk ? 10 : 3) + seed) * .18;
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 4, -6); g.rotate(s * (.35 + fl)); g.scale(s, 1);
        if (L.extra === 'papillon') { const gr = g.createLinearGradient(0, -20, 22, 10); gr.addColorStop(0, '#ff5fa2'); gr.addColorStop(1, '#8b5cf6'); g.fillStyle = gr; g.beginPath(); g.ellipse(14, -10, 13, 11, -.5, 0, 7); g.ellipse(11, 6, 8, 7, .4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(14, -11, 3, 0, 7); g.fill(); }
        else if (L.extra === 'ailes') { g.fillStyle = '#ffffff'; g.strokeStyle = '#d8e6ff'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(8 + k * 4, -8 + k * 4, 12 - k * 1.5, 5, -.7, 0, 7); g.fill(); g.stroke(); } }
        else { g.fillStyle = '#5a0f2e'; g.beginPath(); g.moveTo(0, -4); g.lineTo(26, -18); g.lineTo(22, -6); g.lineTo(26, 2); g.lineTo(18, 4); g.lineTo(20, 12); g.closePath(); g.fill(); g.strokeStyle = '#2a0614'; g.lineWidth = 1.5; g.stroke(); }
        g.restore();
      }
    }
    if (L.extra === 'cape') { const w = Math.sin(t * 6 + seed) * (walk ? 4 : 1.5); g.fillStyle = '#c21e3a'; g.beginPath(); g.moveTo(-9, -14); g.lineTo(9, -14); g.lineTo(13 + w, 16); g.quadraticCurveTo(0, 19, -13 + w, 16); g.closePath(); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(-7, -13, 2, 0, 7); g.arc(7, -13, 2, 0, 7); g.fill(); }
    if (L.extra === 'sac') { g.fillStyle = '#ff8a1f'; rr(g, -13, -13, 9, 15, 3); g.fill(); g.fillStyle = shade('#ff8a1f', .75); g.fillRect(-12, -6, 7, 2); }
    // 2) cheveux de derrière
    g.fillStyle = hairC;
    if (L.hair === 'long') { rr(g, -14, HY - 6, 28, 30, 9); g.fill(); }
    if (L.hair === 'queue') { g.beginPath(); g.ellipse(-12, HY + 6 + Math.sin(t * 6 + seed) * (walk ? 2 : .5), 5, 12, .35, 0, 7); g.fill(); }
    if (L.hair === 'tresses') for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 15, HY + 6, 4.5, 8, s * .3, 0, 7); g.fill(); }
    if (L.hair === 'carre') { rr(g, -15, HY - 8, 30, 22, 8); g.fill(); }
    // 3) jambes
    const legSwing = sitting ? 0 : ph * .5;
    const dress = L.top === 'robe' || L.top === 'robe_soiree';
    const legColor = (L.bottom === 'short' || L.bottom === 'jupe' || dress) ? skin : bot;
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 4, 4); g.rotate(sitting ? -1.35 * (s > 0 ? 1 : .9) : s * legSwing);
      g.fillStyle = legColor; rr(g, -3.2, 0, 6.4, 16, 3); g.fill();
      if (L.bottom === 'short' && !dress) { g.fillStyle = bot; rr(g, -3.6, 0, 7.2, 7, 2); g.fill(); }
      if (L.bottom === 'jogging' && !dress) { g.fillStyle = '#ffffff'; g.fillRect(2, 1, 1.2, 14); g.fillStyle = shade(bot, .8); g.fillRect(-3.2, 13, 6.4, 3); }
      // chaussures
      const shoeC = L.shoes === 'dorees' ? '#ffd34d' : (L.shoesColor || '#ffffff');
      g.fillStyle = shoeC;
      if (L.shoes === 'bottes') { rr(g, -3.8, 9, 7.6, 9, 2); g.fill(); g.beginPath(); g.ellipse(1.5, 17.5, 5.5, 2.8, 0, 0, 7); g.fill(); }
      else if (L.shoes === 'talons') { g.beginPath(); g.ellipse(1.5, 16.5, 4.8, 2.4, 0, 0, 7); g.fill(); g.fillRect(-3, 16, 1.6, 4); }
      else if (L.shoes === 'sandales') { g.fillStyle = skin; g.beginPath(); g.ellipse(1.5, 17, 4.5, 2.2, 0, 0, 7); g.fill(); g.strokeStyle = shoeC; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-2, 16); g.lineTo(4, 16); g.stroke(); }
      else { g.beginPath(); g.ellipse(1.5, 17, 5.5, 3, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-2.5, 18.2, 8, 1.3); if (L.shoes === 'dorees') { g.fillStyle = '#fff6c0'; g.fillRect(0, 15.5, 2, 1.5); } }
      g.restore();
    }
    // jupe / bas de robe
    if (L.bottom === 'jupe' && !dress) { g.fillStyle = bot; g.beginPath(); g.moveTo(-8, 2); g.lineTo(8, 2); g.lineTo(11, 12); g.lineTo(-11, 12); g.closePath(); g.fill(); }
    // 4) bras de derrière
    const armSwing = dancing ? 0 : -ph * .6;
    const sleeve = L.top === 'debardeur' || L.top === 'crop' || L.top === 'robe_soiree' ? skin : L.top === 'costume' ? '#1c1c24' : L.top === 'cuir' ? '#2a2a32' : top;
    const arm = (s, ang) => {
      g.save(); g.translate(s * 8.5, -11); g.rotate(ang);
      g.fillStyle = sleeve; rr(g, -2.8, -1, 5.6, 9, 2.5); g.fill();
      g.fillStyle = skin; rr(g, -2.6, 6, 5.2, 7, 2.5); g.fill(); g.beginPath(); g.arc(0, 13.5, 2.9, 0, 7); g.fill();
      g.restore();
    };
    const danceA = dancing ? Math.sin(t * 9 + seed) : 0;
    arm(-1, dancing ? -2.6 + danceA * .5 : act === 'dj' ? -2.2 : sitting ? -.5 : -armSwing + .12);
    // 5) le haut
    const topDark = shade(top, .78);
    if (dress) {
      g.fillStyle = L.top === 'robe_soiree' ? '#c2185b' : top;
      g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(9, 0); g.lineTo(13, 13); g.lineTo(-13, 13); g.lineTo(-9, 0); g.closePath(); g.fill();
      if (L.top === 'robe_soiree') { g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(-8 + k * 3.2, 9 - (k % 2) * 6, .9, 0, 7); g.fill(); } g.fillStyle = skin; g.fillRect(-7, -14, 14, 3); }
      else { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-9, -1, 18, 2); }
    } else {
      // bassin (couleur du bas)
      if (L.bottom !== 'jupe') { g.fillStyle = bot; rr(g, -8, 0, 16, 7, 2); g.fill(); }
      const tx = -9, tw = 18, ty = -15, th = L.top === 'crop' ? 11 : 16;
      g.fillStyle = L.top === 'costume' ? '#1c1c24' : L.top === 'cuir' ? '#2a2a32' : top;
      rr(g, tx, ty, tw, th, 5); g.fill();
      if (L.top === 'crop') { g.fillStyle = skin; g.fillRect(-7, -4, 14, 5); }
      if (L.top === 'debardeur') { g.fillStyle = skin; g.beginPath(); g.moveTo(-9, -15); g.lineTo(-5, -15); g.lineTo(-6, -9); g.lineTo(-9, -9); g.fill(); g.beginPath(); g.moveTo(9, -15); g.lineTo(5, -15); g.lineTo(6, -9); g.lineTo(9, -9); g.fill(); }
      if (L.top === 'chemise') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-4, -15); g.lineTo(0, -10); g.lineTo(4, -15); g.fill(); g.fillStyle = topDark; for (let k = 0; k < 3; k++) g.fillRect(-.6, -9 + k * 3.5, 1.2, 1.2); }
      if (L.top === 'hoodie') { g.fillStyle = topDark; g.beginPath(); g.ellipse(0, -15, 7, 3, 0, 0, 7); g.fill(); rr(g, -5, -6, 10, 5, 2); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -14); g.lineTo(-2.5, -9); g.moveTo(2, -14); g.lineTo(2.5, -9); g.stroke(); }
      if (L.top === 'veste') { g.fillStyle = '#ffffff'; g.fillRect(-3, -14, 6, 14); g.fillStyle = topDark; g.fillRect(-9, -15, 2, 16); g.fillRect(7, -15, 2, 16); }
      if (L.top === 'maillot') { g.fillStyle = '#ffffff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); if (o.dir < 0) g.scale(-1, 1); g.fillText(String(1 + (hash(String(seed)) % 23)), 0, -7); g.restore(); g.fillRect(-9, -15, 18, 1.5); }
      if (L.top === 'pull') { g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 3; k++) g.fillRect(-9, -12 + k * 4.5, 18, 1.6); }
      if (L.top === 'costume') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-4, -15); g.lineTo(0, -6); g.lineTo(4, -15); g.fill(); g.fillStyle = top; g.beginPath(); g.moveTo(0, -12); g.lineTo(-1.6, -9); g.lineTo(0, -3); g.lineTo(1.6, -9); g.closePath(); g.fill(); }
      if (L.top === 'cuir') { g.strokeStyle = '#9aa3b2'; g.lineWidth = 1; g.beginPath(); g.moveTo(1, -15); g.lineTo(1, 1); g.stroke(); g.fillStyle = '#4a4a56'; g.beginPath(); g.moveTo(-9, -15); g.lineTo(-3, -15); g.lineTo(-6, -9); g.fill(); g.beginPath(); g.moveTo(9, -15); g.lineTo(3, -15); g.lineTo(6, -9); g.fill(); }
    }
    // 6) cou et tête
    g.fillStyle = skinD; g.fillRect(-2.5, -18, 5, 4);
    arm(1, dancing ? -2.6 - danceA * .5 : act === 'dj' ? -.9 : act === 'drink' || act === 'cheers' ? -1.9 : sitting ? -.6 : armSwing - .12);
    g.fillStyle = skin; g.beginPath(); g.arc(0, HY, 13, 0, 7); g.fill();
    g.beginPath(); g.ellipse(12.5, HY + 1, 2.5, 3.5, 0, 0, 7); g.fill(); // oreille
    // 7) le visage (regarde vers la droite)
    const blink = (t + seed * .7) % 4.2 < .12 || act === 'sleep';
    const ex = 3.5, ey = HY + 1;
    g.fillStyle = '#1c1410';
    const eye = (x, wink) => {
      if (blink || wink || L.eyes === 'rieurs') { g.strokeStyle = '#1c1410'; g.lineWidth = 1.6; g.beginPath(); if (L.eyes === 'rieurs' && !blink) g.arc(x, ey + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9); else g.moveTo(x - 2.2, ey), g.lineTo(x + 2.2, ey); g.stroke(); return; }
      if (L.eyes === 'etoiles') { g.fillStyle = '#ffd34d'; g.font = '8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', x, ey); g.fillStyle = '#1c1410'; return; }
      const big = L.eyes === 'grands';
      g.fillStyle = '#1c1410'; g.beginPath(); g.ellipse(x, ey, big ? 2.6 : 1.9, big ? 3.4 : 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + .8, ey - 1, big ? 1.1 : .7, 0, 7); g.fill();
      if (L.eyes === 'cils') { g.strokeStyle = '#1c1410'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.5, ey - 2.4); g.lineTo(x + 3.2, ey - 3.8); g.moveTo(x, ey - 2.8); g.lineTo(x + .6, ey - 4.5); g.stroke(); }
    };
    eye(ex - 5.5, false); eye(ex + 3.5, L.eyes === 'clin');
    // bouche
    g.strokeStyle = '#7a2a1a'; g.fillStyle = '#7a2a1a'; g.lineWidth = 1.4;
    const my = HY + 7, mx = ex;
    if (act === 'sleep') { g.beginPath(); g.arc(mx, my, 1.4, 0, 7); g.stroke(); }
    else if (L.mouth === 'grand' || dancing) { g.beginPath(); g.arc(mx, my - 1, 3.4, .1, Math.PI - .1); g.fill(); g.fillStyle = '#ff8fa3'; g.beginPath(); g.arc(mx, my + 1.2, 1.6, 0, Math.PI); g.fill(); }
    else if (L.mouth === 'neutre') { g.beginPath(); g.moveTo(mx - 2.4, my); g.lineTo(mx + 2.4, my); g.stroke(); }
    else if (L.mouth === 'langue') { g.beginPath(); g.arc(mx, my - 1, 3, .1, Math.PI - .1); g.stroke(); g.fillStyle = '#ff6f8a'; g.beginPath(); g.ellipse(mx + .6, my + 2, 1.8, 2, 0, 0, 7); g.fill(); }
    else if (L.mouth === 'bisou') { g.fillStyle = '#d6336c'; g.beginPath(); g.arc(mx, my, 1.8, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(mx, my - 1.5, 3, .25, Math.PI - .25); g.stroke(); }
    // détails du visage
    if (L.face === 'joues' || L.face === 'maquillage') { g.fillStyle = 'rgba(255,105,140,.45)'; g.beginPath(); g.arc(ex - 8, HY + 5, 2.6, 0, 7); g.arc(ex + 7, HY + 5, 2.6, 0, 7); g.fill(); }
    if (L.face === 'maquillage') { g.fillStyle = '#c2185b'; g.beginPath(); g.ellipse(mx, my, 2.6, 1.3, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(139,92,246,.6)'; g.fillRect(ex - 7.5, ey - 4, 4, 1.4); g.fillRect(ex + 1.5, ey - 4, 4, 1.4); }
    if (L.face === 'taches') { g.fillStyle = 'rgba(140,70,30,.55)'; for (const [x, y] of [[-6, 4], [-4, 5.5], [-7.5, 5.5], [7, 4], [9, 5.5], [5.5, 5.5]]) { g.beginPath(); g.arc(ex + x - 1, HY + y, .8, 0, 7); g.fill(); } }
    if (L.face === 'barbe') { g.fillStyle = hairC; g.beginPath(); g.arc(1, HY + 5, 11.5, .15, Math.PI - .15); g.lineTo(-9, HY + 4); g.quadraticCurveTo(mx, HY + 11, 11, HY + 4); g.closePath(); g.fill(); g.fillStyle = '#7a2a1a'; g.beginPath(); g.arc(mx, my - 1.3, 2.4, .2, Math.PI - .2); g.fill(); }
    if (L.face === 'moustache') { g.fillStyle = hairC; g.beginPath(); g.ellipse(mx - 2.2, my - 2.5, 3, 1.4, -.25, 0, 7); g.ellipse(mx + 2.2, my - 2.5, 3, 1.4, .25, 0, 7); g.fill(); }
    // 8) cheveux de devant
    g.fillStyle = hairC;
    const H = L.hair;
    if (H === 'court' || H === 'boucles' || H === 'meche' || H === 'pique' || H === 'long' || H === 'queue' || H === 'carre' || H === 'chignon' || H === 'tresses') {
      g.beginPath(); g.arc(0, HY - 1, 13.6, Math.PI * .95, Math.PI * 2.05); g.lineTo(13, HY - 3); g.quadraticCurveTo(2, HY - 9, -13, HY - 1); g.closePath(); g.fill();
    }
    if (H === 'meche') { g.beginPath(); g.moveTo(-6, HY - 12); g.quadraticCurveTo(10, HY - 14, 12, HY - 2); g.quadraticCurveTo(6, HY - 8, -2, HY - 6); g.closePath(); g.fill(); }
    if (H === 'pique') for (let k = 0; k < 6; k++) { const a = Math.PI * (1.05 + k * .17); g.beginPath(); g.moveTo(Math.cos(a - .15) * 12, HY - 1 + Math.sin(a - .15) * 12); g.lineTo(Math.cos(a) * 19, HY - 1 + Math.sin(a) * 19); g.lineTo(Math.cos(a + .15) * 12, HY - 1 + Math.sin(a + .15) * 12); g.fill(); }
    if (H === 'boucles') for (let k = 0; k < 8; k++) { const a = Math.PI * (1 + k * .14); g.beginPath(); g.arc(Math.cos(a) * 12.5, HY - 1 + Math.sin(a) * 12.5, 4.2, 0, 7); g.fill(); }
    if (H === 'afro') { g.beginPath(); g.arc(0, HY - 4, 19, 0, 7); g.fill(); g.fillStyle = skin; g.beginPath(); g.arc(0, HY + 2, 11.5, -.2, Math.PI + .2); g.fill(); g.fillStyle = hairC; }
    if (H === 'chignon') { g.beginPath(); g.arc(-2, HY - 15, 6, 0, 7); g.fill(); }
    if (H === 'tresses') { g.beginPath(); g.arc(-12, HY - 6, 4, 0, 7); g.arc(12, HY - 6, 4, 0, 7); g.fill(); }
    if (H === 'iroquoise') { g.beginPath(); g.moveTo(-6, HY - 10); g.quadraticCurveTo(0, HY - 30, 8, HY - 10); g.closePath(); g.fill(); g.fillStyle = shade(skin, .9); g.beginPath(); g.arc(0, HY - 1, 13, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = hairC; g.beginPath(); g.moveTo(-4, HY - 11); g.quadraticCurveTo(1, HY - 28, 7, HY - 11); g.fill(); }
    if (H === 'long' || H === 'carre') { g.fillRect(-14, HY - 4, 4, H === 'long' ? 20 : 12); }
    if (H === 'chauve') { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(-4, HY - 7, 3, 0, 7); g.fill(); }
    // 9) accessoires sur la tête
    const A = L.acc;
    if (A === 'lunettes' || A === 'soleil') { g.strokeStyle = '#1c1c24'; g.lineWidth = 1.4; g.fillStyle = A === 'soleil' ? '#1c1c24' : 'rgba(180,220,255,.35)'; for (const x of [ex - 5.5, ex + 3.5]) { g.beginPath(); g.arc(x, ey, 3.4, 0, 7); g.fill(); g.stroke(); } g.beginPath(); g.moveTo(ex - 2.1, ey); g.lineTo(ex + .1, ey); g.moveTo(ex - 8.9, ey); g.lineTo(-12, ey - 1); g.stroke(); }
    if (A === 'casquette') { g.fillStyle = top; g.beginPath(); g.arc(0, HY - 4, 13.5, Math.PI, 0); g.fill(); g.fillStyle = shade(top, .7); g.beginPath(); g.ellipse(10, HY - 4, 10, 2.6, 0, 0, 7); g.fill(); }
    if (A === 'bonnet') { g.fillStyle = '#ff2d55'; g.beginPath(); g.arc(0, HY - 3, 14, Math.PI, 0); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(-14, HY - 5, 28, 4); g.beginPath(); g.arc(0, HY - 18, 4, 0, 7); g.fill(); }
    if (A === 'chapeau') { g.fillStyle = '#1c1c24'; g.beginPath(); g.ellipse(0, HY - 9, 18, 4, 0, 0, 7); g.fill(); rr(g, -10, HY - 25, 20, 16, 3); g.fill(); g.fillStyle = '#ff2d55'; g.fillRect(-10, HY - 13, 20, 3); }
    if (A === 'casque') { g.strokeStyle = '#2a2a32'; g.lineWidth = 3; g.beginPath(); g.arc(0, HY - 2, 15, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = '#ff2d55'; g.beginPath(); g.ellipse(12.5, HY + 1, 4, 5, 0, 0, 7); g.fill(); }
    if (A === 'noeud') { g.fillStyle = '#ff5fa2'; g.beginPath(); g.moveTo(4, HY - 13); g.lineTo(-4, HY - 18); g.lineTo(-4, HY - 8); g.closePath(); g.moveTo(4, HY - 13); g.lineTo(12, HY - 18); g.lineTo(12, HY - 8); g.closePath(); g.fill(); g.beginPath(); g.arc(4, HY - 13, 2.4, 0, 7); g.fill(); }
    if (A === 'fleur') { for (let k = 0; k < 5; k++) { g.fillStyle = '#ffd1e8'; g.beginPath(); g.arc(-8 + Math.cos(k * 1.26) * 3.2, HY - 10 + Math.sin(k * 1.26) * 3.2, 2.6, 0, 7); g.fill(); } g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(-8, HY - 10, 1.8, 0, 7); g.fill(); }
    if (A === 'couronne') { g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(-9, HY - 11); g.lineTo(-9, HY - 20); g.lineTo(-4.5, HY - 15); g.lineTo(0, HY - 22); g.lineTo(4.5, HY - 15); g.lineTo(9, HY - 20); g.lineTo(9, HY - 11); g.closePath(); g.fill(); g.fillStyle = '#ff2d55'; g.beginPath(); g.arc(0, HY - 14, 1.6, 0, 7); g.fill(); }
    if (A === 'aureole') { g.strokeStyle = '#ffd34d'; g.lineWidth = 2.4; g.shadowColor = '#ffd34d'; g.shadowBlur = 8; g.beginPath(); g.ellipse(0, HY - 19 + Math.sin(t * 3) * 1.2, 9, 3, 0, 0, 7); g.stroke(); g.shadowBlur = 0; }
    if (A === 'cornes') { g.fillStyle = '#d61f3a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5, HY - 11); g.quadraticCurveTo(s * 12, HY - 16, s * 10, HY - 23); g.quadraticCurveTo(s * 9, HY - 15, s * 1, HY - 12); g.closePath(); g.fill(); } }
    if (A === 'chat' || A === 'lapin') { for (const s of [-1, 1]) { g.fillStyle = hairC === '#f2f2f2' ? '#dddddd' : hairC; g.beginPath(); if (A === 'chat') { g.moveTo(s * 4, HY - 11); g.lineTo(s * 10, HY - 22); g.lineTo(s * 12, HY - 9); } else g.ellipse(s * 5, HY - 20, 3.5, 10, s * .15, 0, 7); g.fill(); g.fillStyle = '#ffb6c8'; g.beginPath(); if (A === 'chat') { g.moveTo(s * 6, HY - 12); g.lineTo(s * 9.5, HY - 18); g.lineTo(s * 10.5, HY - 11); } else g.ellipse(s * 5, HY - 20, 1.6, 7, s * .15, 0, 7); g.fill(); } }
    g.restore();
    return { headY: HY - bounce, headR: 13 };
  }

  // ---------- L'atelier de création ----------
  let close = null, draft = null, tab = 'skin', owned = new Set(), saving = false;
  const TABS = [['skin', '🎨 Peau'], ['hair', '💇 Cheveux'], ['face', '😊 Visage'], ['top', '👕 Haut'], ['bottom', '👖 Bas'], ['shoes', '👟 Chaussures'], ['acc', '🎩 Accessoires'], ['extra', '🪽 Extras']];
  async function open() {
    if (state.me?.isGuest) return toast('Inscris-toi pour créer ton personnage 🧍');
    if (close) close();
    let d; try { d = await api('/api/look'); } catch (e) { return toast(e.message); }
    draft = { ...defaults(state.me), ...(d.look || {}) }; owned = new Set(d.owned || []);
    const box = el('div', { class: 'look' });
    close = modal(box);
    const back = box.closest('.modal-back'); back.classList.add('shop-back');
    let raf = 0;
    new MutationObserver((m, o) => { if (!document.body.contains(back)) { close = null; cancelAnimationFrame(raf); o.disconnect(); } }).observe(document.body, { childList: true });
    render(d.mode || 'look');
    const cv = () => box.querySelector('.look-cv');
    const loop = ts => {
      raf = requestAnimationFrame(loop);
      const c = cv(); if (!c) return;
      const g = c.getContext('2d'), t = ts / 1000, dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== c.clientWidth * dpr) { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; }
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
      const k = c.height / 120 * 1.0;
      g.setTransform(k, 0, 0, k, c.width / 2, c.height * .74);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 22, 18, 5, 0, 0, 7); g.fill();
      const walking = Math.floor(t / 3) % 3 === 1, dir = Math.floor(t / 9) % 2 ? -1 : 1;
      draw(g, draft, { t, walking, dir, act: Math.floor(t / 3) % 3 === 2 ? 'dance' : '', id: state.me.id, gender: state.me.gender });
    };
    raf = requestAnimationFrame(loop);
  }
  function render(mode) {
    const box = document.querySelector('.look');
    if (!box) return;
    const curMode = mode || box.dataset.mode || 'look'; box.dataset.mode = curMode;
    const total = Object.entries({ top: draft.top, shoes: draft.shoes, acc: draft.acc, extra: draft.extra, eyes: draft.eyes }).reduce((s, [slot, id]) => s + (owned.has(slot + ':' + id) ? 0 : priceOf(slot, id)), 0);
    box.replaceChildren(
      el('div', { class: 'shop-head' }, el('div', {}, el('b', { class: 'pet-title' }, '🧍 Mon personnage'), el('small', {}, 'Crée le personnage qui te représente sur l\'Île du Paradise 🏝️')), el('button', { class: 'btn btn-sm', onclick: () => close && close() }, '✕')),
      el('div', { class: 'look-main' },
        el('div', { class: 'look-stage' }, el('canvas', { class: 'look-cv' }),
          el('button', { class: 'btn btn-sm', onclick: () => { draft = random(); render(); } }, '🎲 Au hasard')),
        el('div', { class: 'look-side' },
          el('div', { class: 'shop-tabs look-tabs' }, ...TABS.map(([k, l]) => el('button', { class: 'shop-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; render(); } }, l))),
          el('div', { class: 'look-opts' }, ...options()))),
      el('div', { class: 'look-foot' },
        el('div', { class: 'look-mode' }, el('small', {}, 'Sur l\'Île, je suis :'),
          ...[['look', '🧍 Mon personnage'], ['photo', '📷 Ma photo']].map(([m, l]) => el('button', { class: 'isl-chip' + (curMode === m ? ' on' : ''), onclick: () => { box.dataset.mode = m; render(m); } }, l))),
        el('button', { class: 'btn btn-primary', disabled: saving, onclick: save }, total ? `💾 Enregistrer (${total} 💰)` : '💾 Enregistrer')));
  }
  function swatches(key, list) {
    return el('div', { class: 'look-sw' }, ...list.map(c => el('button', { class: 'look-c' + (draft[key] === c ? ' on' : ''), style: `background:${c}`, title: c, onclick: () => { draft[key] = c; render(); } })));
  }
  function choice(slot, key, list) {
    return el('div', { class: 'look-grid' }, ...list.map(([id, name, price]) => {
      const locked = price && !owned.has(slot + ':' + id);
      const c = el('canvas', { class: 'look-thumb', width: 96, height: 104 });
      const g = c.getContext('2d'); g.setTransform(1.15, 0, 0, 1.15, 48, slot === 'shoes' || slot === 'bottom' ? 40 : slot === 'top' || slot === 'extra' ? 66 : 82);
      draw(g, { ...draft, [key]: id }, { t: 1, id: state.me.id, gender: state.me.gender });
      return el('button', { class: 'look-opt' + (draft[key] === id ? ' on' : '') + (locked ? ' locked' : ''), onclick: () => { draft[key] = id; render(); } }, c, el('small', {}, name), price ? el('em', {}, locked ? `${price} 💰` : '✅ À toi') : null);
    }));
  }
  function options() {
    const lab = t => el('h4', { class: 'look-h' }, t);
    if (tab === 'skin') return [lab('Couleur de peau'), swatches('skin', SKINS)];
    if (tab === 'hair') return [lab('Couleur des cheveux'), swatches('hairColor', HAIR_COLORS), lab('Coiffure'), choice('hair', 'hair', CAT.hair)];
    if (tab === 'face') return [lab('Les yeux'), choice('eyes', 'eyes', CAT.eyes), lab('La bouche'), choice('mouth', 'mouth', CAT.mouth), lab('Les détails'), choice('face', 'face', CAT.extra_face)];
    if (tab === 'top') return [lab('Couleur'), swatches('topColor', COLORS), lab('Le haut'), choice('top', 'top', CAT.top)];
    if (tab === 'bottom') return [lab('Couleur'), swatches('bottomColor', COLORS), lab('Le bas'), choice('bottom', 'bottom', CAT.bottom)];
    if (tab === 'shoes') return [lab('Couleur'), swatches('shoesColor', COLORS), lab('Les chaussures'), choice('shoes', 'shoes', CAT.shoes)];
    if (tab === 'acc') return [lab('Sur la tête'), choice('acc', 'acc', CAT.acc)];
    return [lab('Dans le dos'), choice('extra', 'extra', CAT.extra)];
  }
  function random() {
    const r = a => a[Math.floor(Math.random() * a.length)], free = s => CAT[s].filter(x => !x[2] || owned.has(s + ':' + x[0])).map(x => x[0]);
    return { skin: r(SKINS), hair: r(free('hair')), hairColor: r(HAIR_COLORS), eyes: r(free('eyes')), mouth: r(free('mouth')), face: r(free('extra_face')), top: r(free('top')), topColor: r(COLORS), bottom: r(free('bottom')), bottomColor: r(COLORS), shoes: r(free('shoes')), shoesColor: r(COLORS), acc: Math.random() < .5 ? '' : r(free('acc')), extra: Math.random() < .7 ? '' : r(free('extra')) };
  }
  async function save() {
    const box = document.querySelector('.look'), mode = box?.dataset.mode || 'look';
    const need = ['top', 'shoes', 'acc', 'extra', 'eyes'].filter(s => priceOf(s, draft[s]) && !owned.has(s + ':' + draft[s]));
    const total = need.reduce((s, k) => s + priceOf(k, draft[k]), 0);
    if (total && !confirm(`Acheter ${need.length > 1 ? 'ces pièces rares' : 'cette pièce rare'} pour ${total} pièces 💰 ?`)) return;
    saving = true;
    try {
      const r = await api('/api/look', { method: 'POST', body: { look: draft, mode } });
      owned = new Set(r.owned || []); if (r.coins != null) { state.me.coins = r.coins; window.Shop?.counter(); }
      toast('✨ Ton personnage est prêt ! Va le voir sur l\'Île 🏝️'); LC.confetti(['🧍', '✨', '👕']);
      close && close();
    } catch (e) { toast(e.message); }
    saving = false;
  }
  return { draw, defaults, open, CAT };
})();
window.Look = Look;
