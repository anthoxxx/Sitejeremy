// The Paradise — ModoBot : détection des grossièretés et insultes
// Résiste aux astuces courantes : majuscules, accents, lettres répétées (« connnnard »),
// chiffres à la place des lettres (« c0nn4rd »), lettres séparées (« c o n n a r d », « p.u.t.e »).

// Grossièretés « légères » : masquées + avertissement
const LIGHT = [
  'merde', 'merdique', 'putain', 'ptn', 'bordel', 'chier', 'chiant', 'chiante', 'chiotte', 'chiottes', 'foutre',
  'fuck', 'fucking', 'shit', 'wtf', 'con', 'conne', 'connerie', 'conneries', 'couille', 'couilles', 'bite', 'teub', 'zob',
  'nichon', 'nichons', 'trouduc', 'emmerde', 'emmerder', 'emmerdeur', 'emmerdeuse', 'bouffon', 'bouffonne',
  'abruti', 'abrutie', 'debile', 'cretin', 'cretine', 'boloss', 'bolos', 'tocard', 'tocarde',
  'tg', 'stfu', 'mongol', 'mongole', 'attarde', 'attardee', 'cassos'
];
// Insultes graves et propos haineux : comptent double
const HEAVY = [
  'connard', 'connasse', 'salope', 'salop', 'salaud', 'pute', 'putes', 'pouffiasse', 'petasse', 'grognasse', 'catin', 'tchoin',
  'encule', 'enculer', 'enculee', 'enculer', 'batard', 'batarde', 'enfoire', 'enfoiree', 'fdp', 'ntm', 'nique', 'niquer', 'niker', 'nik',
  'branleur', 'branleuse', 'suceur', 'suceuse', 'bitch', 'cunt', 'whore', 'slut', 'motherfucker', 'asshole', 'dick',
  'pd', 'pede', 'tapette', 'tafiole', 'gouine', 'fiotte', 'negre', 'negro', 'bougnoule', 'bougnoul', 'youpin', 'bicot', 'chinetoque', 
  'pedo',
];
// Expressions en plusieurs mots
const PHRASES = [
  ['ta gueule', 1], ['ferme ta gueule', 2], ['fils de pute', 2], ['nique ta mere', 2], ['ta mere la pute', 2], ['va te faire foutre', 2],
  ['va te faire enculer', 2], ['sale pute', 2], ['sale chien', 2], ['suce ma', 2], ['je vais te tuer', 2], ['va mourir', 2],
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '€': 'e', '!': 'i' };
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => strip(String(s).toLowerCase()).replace(/[0134578@$€!]/g, c => LEET[c] || c);
const squeeze = s => s.replace(/(.)\1+/g, '$1');

function buildIndex(extra = []) {
  const map = new Map(); // forme -> gravité (1 ou 2)
  const put = (w, g) => {
    const n = norm(w).replace(/[^a-z]/g, '');
    if (!n) return;
    map.set(n, Math.max(map.get(n) || 0, g));
    if (n.length >= 5) map.set('~' + squeeze(n), Math.max(map.get('~' + squeeze(n)) || 0, g));
  };
  LIGHT.forEach(w => put(w, 1)); HEAVY.forEach(w => put(w, 2)); extra.forEach(w => put(w, 1));
  const phrases = PHRASES.map(([p, g]) => [norm(p).split(' '), g]);
  return { map, phrases };
}

// Gravité d'un mot seul (0 = propre)
function wordLevel(idx, w) {
  if (!w) return 0;
  const forms = [w, w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/e$/, '')];
  for (const f of forms) if (idx.map.has(f)) return idx.map.get(f);
  const sq = squeeze(w);
  if (sq.length >= 5) for (const f of [sq, sq.replace(/s$/, ''), sq.replace(/e$/, '')]) if (idx.map.has('~' + f)) return idx.map.get('~' + f);
  if (sq !== w && sq.length < 5 && idx.map.has(sq) && w.length - sq.length >= 2) return idx.map.get(sq); // « connnn »
  return 0;
}

// Analyse un texte : renvoie le texte masqué, le niveau (0, 1 ou 2) et les mots trouvés
function scan(idx, text) {
  const src = String(text || '');
  // Découpage en mots en gardant leur position dans le texte d'origine
  const tokens = [];
  const re = /[\p{L}\p{N}@$€!]+/gu;
  let m;
  while ((m = re.exec(src))) {
    const n = norm(m[0]).replace(/[^a-z]/g, '');
    if (n) tokens.push({ start: m.index, end: m.index + m[0].length, n });
  }
  const hide = new Set(); let level = 0; const found = [];
  const mark = (i, j, g, w) => { for (let k = i; k <= j; k++) hide.add(k); level = Math.max(level, g); found.push(w); };
  // 1) mots seuls
  tokens.forEach((t, i) => { const g = wordLevel(idx, t.n); if (g) mark(i, i, g, t.n); });
  // 2) lettres isolées collées ensemble (« c o n n a r d », « p.u.t.e »)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].n.length !== 1) continue;
    let j = i, joined = '';
    while (j < tokens.length && tokens[j].n.length === 1 && joined.length < 20) { joined += tokens[j].n; j++; }
    if (j - i >= 3) {
      for (let a = i; a < j; a++) for (let b = j; b > a + 1; b--) {
        const w = tokens.slice(a, b).map(t => t.n).join('');
        const g = w.length >= 3 ? wordLevel(idx, w) : 0;
        if (g) { mark(a, b - 1, g, w); a = b - 1; break; }
      }
      i = j - 1;
    }
  }
  // 3) expressions
  const words = tokens.map(t => t.n);
  for (const [p, g] of idx.phrases) {
    for (let i = 0; i + p.length <= words.length; i++) {
      if (p.every((w, k) => words[i + k] === w)) mark(i, i + p.length - 1, g, p.join(' '));
    }
  }
  if (!hide.size) return { text: src, level: 0, found: [] };
  let out = '', pos = 0;
  [...hide].sort((a, b) => a - b).forEach(k => {
    const t = tokens[k];
    out += src.slice(pos, t.start) + (t.end - t.start === 1 ? '*' : src[t.start] + '*'.repeat(t.end - t.start - 1));
    pos = t.end;
  });
  return { text: out + src.slice(pos), level, found: [...new Set(found)] };
}

module.exports = { buildIndex, scan, norm: w => norm(w).replace(/[^a-z]/g, '') };
