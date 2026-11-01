// The Paradise — salon Karaoké et son KaraoBot
// File d'attente des chanteurs, recherche de versions karaoké sur YouTube, catalogue de chansons,
// annonces du bot dans le salon et passage automatique à la chanson suivante.
const SLUG = 'karaoke';
const BOT = { userId: 0, username: 'KaraoBot', color: '#ffb547', gender: 'x', role: 'bot', avatar: '', bot: true };
const MAX_QUEUE = 30, MAX_PER_USER = 2;

const CATALOG = [
  { cat: '🇫🇷 Variété française', songs: [
    ['Aya Nakamura', 'Djadja'], ['Indila', 'Dernière danse'], ['Stromae', 'Alors on danse'], ['Stromae', 'Papaoutai'],
    ['Angèle', 'Balance ton quoi'], ['Céline Dion', 'Pour que tu m\'aimes encore'], ['Jean-Jacques Goldman', 'Je te donne'],
    ['Johnny Hallyday', 'Allumer le feu'], ['Zaz', 'Je veux'], ['Kendji Girac', 'Andalouse'], ['Louane', 'Avenir'],
    ['Vianney', 'Je m\'en vais'], ['Christophe Maé', 'Il est où le bonheur'], ['Patrick Bruel', 'Place des grands hommes'],
    ['Michel Sardou', 'Les lacs du Connemara'], ['Joe Dassin', 'Les Champs-Élysées'], ['Édith Piaf', 'La vie en rose'],
    ['Jul', 'Tchikita'], ['Slimane', 'Viens on s\'aime'], ['Amir', 'J\'ai cherché'],
  ] },
  { cat: '🌍 Hits internationaux', songs: [
    ['Queen', 'Bohemian Rhapsody'], ['ABBA', 'Dancing Queen'], ['Adele', 'Someone Like You'], ['Whitney Houston', 'I Will Always Love You'],
    ['Bon Jovi', 'Livin\' on a Prayer'], ['Gloria Gaynor', 'I Will Survive'], ['Ed Sheeran', 'Perfect'], ['Bruno Mars', 'Just the Way You Are'],
    ['Lady Gaga & Bradley Cooper', 'Shallow'], ['Dua Lipa', 'Levitating'], ['The Weeknd', 'Blinding Lights'], ['Journey', 'Don\'t Stop Believin\''],
    ['Beyoncé', 'Halo'], ['Michael Jackson', 'Billie Jean'], ['Toto', 'Africa'], ['Miley Cyrus', 'Flowers'],
  ] },
  { cat: '🕺 Années 80 – 90', songs: [
    ['Début de Soirée', 'Nuit de folie'], ['Images', 'Les démons de minuit'], ['Cookie Dingler', 'Femme libérée'],
    ['Gilbert Montagné', 'On va s\'aimer'], ['Desireless', 'Voyage voyage'], ['Mylène Farmer', 'Désenchantée'],
    ['Patrick Hernandez', 'Born to Be Alive'], ['Gold', 'Capitaine abandonné'], ['Cyndi Lauper', 'Girls Just Want to Have Fun'],
    ['Spice Girls', 'Wannabe'], ['Backstreet Boys', 'I Want It That Way'], ['Las Ketchup', 'The Ketchup Song'],
  ] },
  { cat: '✨ Disney & dessins animés', songs: [
    ['La Reine des neiges', 'Libérée, délivrée'], ['Le Roi lion', 'Hakuna Matata'], ['Aladdin', 'Ce rêve bleu'],
    ['La Petite Sirène', 'Sous l\'océan'], ['Vaiana', 'Le bleu lumière'], ['Encanto', 'Ne parlons pas de Bruno'],
    ['Le Livre de la jungle', 'Il en faut peu pour être heureux'], ['La Belle et la Bête', 'Histoire éternelle'],
  ] },
  { cat: '🎤 Rap & RnB', songs: [
    ['PNL', 'Au DD'], ['Ninho', 'Jefe'], ['Soprano', 'En feu'], ['Gims', 'Sapés comme jamais'], ['Gims', 'Bella'],
    ['Diam\'s', 'La Boulette'], ['Sexion d\'Assaut', 'Désolé'], ['Tayc', 'N\'y pense plus'], ['Eminem', 'Lose Yourself'],
  ] },
  { cat: '💞 Slows & ballades', songs: [
    ['Francis Cabrel', 'Je l\'aime à mourir'], ['Lara Fabian', 'Je t\'aime'], ['Céline Dion', 'My Heart Will Go On'],
    ['Charles Aznavour', 'La Bohème'], ['Calogero', 'En apesanteur'], ['Florent Pagny', 'Savoir aimer'],
    ['Elton John', 'Can You Feel the Love Tonight'], ['Lewis Capaldi', 'Someone You Loved'],
  ] },
];

module.exports = function setupKaraoke({ app, io, auth, isStaff, tooMany, log, getOnline }) {
  const now = () => Date.now();
  let queue = [];        // { id, userId, username, title, videoId, duration, addedAt }
  let current = null;    // idem + startedAt
  let timer = null, seq = 1, msgSeq = 1;

  // ---------- Le bot parle dans le salon ----------
  function say(content) {
    io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'kb' + (msgSeq++), ...BOT, content, createdAt: now(), kind: 'text' });
  }
  const stateOut = () => ({ current, queue, serverNow: now() });
  const broadcast = () => io.to('room:' + SLUG).emit('karaoke', stateOut());
  const inRoom = userId => getOnline().get(userId)?.room === SLUG;

  // ---------- Passer à la chanson suivante ----------
  function next(reason) {
    clearTimeout(timer); timer = null;
    // On saute les personnes parties du salon
    let skipped = [];
    let item = queue.shift();
    while (item && !inRoom(item.userId)) { skipped.push(item.username); item = queue.shift(); }
    if (skipped.length) say(`⏭️ ${skipped.join(', ')} n'${skipped.length > 1 ? 'étaient' : 'était'} plus là, on passe.`);
    current = item ? { ...item, startedAt: now() } : null;
    if (current) {
      say(`🎤 À toi @${current.username} ! Tu chantes « ${current.title} ». Rejoins le vocal 🎙️ et lance la vidéo en haut du salon. Bonne chance ! 🌟`);
      const limit = (current.duration ? current.duration + 20 : 8 * 60) * 1000;
      timer = setTimeout(() => { say(`👏 Bravo ${current.username} ! Merci pour « ${current.title} » 🎉`); next('fin'); }, limit);
      if (queue[0]) say(`⏳ Prépare-toi @${queue[0].username}, c'est toi juste après !`);
    } else if (reason !== 'silence') {
      say('🎶 La file est vide ! Choisis une chanson avec le bouton « 🎤 Choisir une chanson » ou tape !chanson suivi du titre.');
    }
    broadcast();
  }

  function add(user, { title, videoId, duration }) {
    title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    videoId = String(videoId || '');
    if (!/^[\w-]{11}$/.test(videoId) || !title) return { error: 'Chanson invalide' };
    const mine = queue.filter(q => q.userId === user.id).length + (current?.userId === user.id ? 1 : 0);
    if (mine >= MAX_PER_USER && !isStaff(user)) return { error: `${MAX_PER_USER} chansons maximum par personne dans la file` };
    if (queue.length >= MAX_QUEUE) return { error: 'La file est pleine, attends un peu' };
    const item = { id: seq++, userId: user.id, username: user.username, title, videoId, duration: Math.max(0, Math.min(15 * 60, parseInt(duration, 10) || 0)), addedAt: now() };
    queue.push(item);
    log(user, 'karaoke', `🎤 Karaoké : « ${title} » ajoutée à la file`);
    if (!current) next('silence');
    else { say(`📝 ${user.username} a choisi « ${title} » (n°${queue.length} dans la file)`); broadcast(); }
    return { ok: true };
  }

  // ---------- Recherche YouTube (sans clé d'API) ----------
  const cache = new Map();
  const toSec = t => String(t || '').split(':').reduce((a, x) => a * 60 + (parseInt(x, 10) || 0), 0);
  function collect(node, out) {
    if (!node || typeof node !== 'object' || out.length >= 12) return;
    if (Array.isArray(node)) { for (const x of node) collect(x, out); return; }
    if (node.videoRenderer && node.videoRenderer.videoId) {
      const v = node.videoRenderer;
      const length = v.lengthText?.simpleText || '';
      if (length) out.push({ videoId: v.videoId, title: (v.title?.runs || []).map(r => r.text).join('') || v.title?.simpleText || '', channel: v.ownerText?.runs?.[0]?.text || '', length, duration: toSec(length) });
      return;
    }
    for (const k in node) collect(node[k], out);
  }
  async function ytSearch(q) {
    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && now() - hit.at < 6 * 3600 * 1000) return hit.results;
    const res = await fetch('https://www.youtube.com/results?hl=fr&gl=FR&search_query=' + encodeURIComponent(q), {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'fr-FR,fr;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('YouTube ne répond pas');
    const html = await res.text();
    const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s) || html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
    if (!m) throw new Error('Résultats illisibles');
    const out = [];
    collect(JSON.parse(m[1]), out);
    const results = out.filter(r => r.duration > 0 && r.duration <= 15 * 60);
    cache.set(key, { at: now(), results });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return results;
  }

  // ---------- API ----------
  app.get('/api/karaoke/catalog', auth, (req, res) => res.json({ catalog: CATALOG }));
  app.get('/api/karaoke/search', auth, async (req, res) => {
    const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (q.length < 2) return res.status(400).json({ error: 'Tape au moins 2 lettres' });
    if (tooMany('ksearch:' + req.user.id, 20, 60 * 1000)) return res.status(429).json({ error: 'Trop de recherches, attends une minute' });
    const query = /karaok|lyrics|paroles/i.test(q) ? q : q + ' karaoké';
    try { res.json({ results: await ytSearch(query) }); }
    catch (e) { res.json({ results: [], error: 'La recherche YouTube ne marche pas pour le moment : colle directement le lien YouTube d\'une version karaoké.', searchUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) }); }
  });

  // ---------- Temps réel ----------
  function onConnection(socket, uid, currentUser) {
    socket.on('karaoke_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('karaoke_add', (song, ack) => {
      const u = currentUser();
      if (!u || !inRoom(uid)) return ack && ack({ error: 'Entre dans le salon Karaoké d\'abord' });
      if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
      ack && ack(add(u, song || {}));
    });
    socket.on('karaoke_next', ack => {
      const u = currentUser();
      if (!current) return ack && ack({ error: 'Personne ne chante en ce moment' });
      if (current.userId !== uid && !isStaff(u)) return ack && ack({ error: 'Seul le chanteur ou l\'équipe peut passer à la suite' });
      say(current.userId === uid ? `👏 Merci ${current.username} pour « ${current.title} » !` : `⏭️ ${u.username} passe à la chanson suivante.`);
      next();
      ack && ack({ ok: true });
    });
    socket.on('karaoke_remove', (id, ack) => {
      const u = currentUser();
      const item = queue.find(q => q.id === parseInt(id, 10));
      if (!item) return ack && ack({ error: 'Chanson introuvable' });
      if (item.userId !== uid && !isStaff(u)) return ack && ack({ error: 'Tu ne peux retirer que tes chansons' });
      queue = queue.filter(q => q !== item);
      broadcast();
      ack && ack({ ok: true });
    });
  }

  // ---------- Commandes tapées dans le salon ----------
  async function command(user, text) {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case '!aide': case '!help': case '!karaoke': case '!karaoké':
        return say('🤖 Je suis KaraoBot ! Commandes : !chanson <titre> pour t\'inscrire, !liste pour voir la file, !suivant quand tu as fini, !retirer pour enlever ta chanson. Tu peux aussi utiliser le bouton « 🎤 Choisir une chanson ».');
      case '!liste': case '!file': {
        if (!current && !queue.length) return say('🎶 Personne n\'est inscrit. Lance-toi avec !chanson <titre> !');
        const lines = [current ? `🎤 En ce moment : ${current.username} – « ${current.title} »` : null, ...queue.slice(0, 8).map((q, i) => `${i + 1}. ${q.username} – « ${q.title} »`)].filter(Boolean);
        if (queue.length > 8) lines.push(`… et ${queue.length - 8} autre(s)`);
        return say(lines.join('\n'));
      }
      case '!chanson': case '!chante': case '!song': {
        if (arg.length < 2) return say(`@${user.username} dis-moi quelle chanson : !chanson Libérée délivrée`);
        if (tooMany('ksearch:' + user.id, 20, 60 * 1000)) return say(`@${user.username} doucement, attends une minute 😉`);
        try {
          const [first] = await ytSearch(/karaok/i.test(arg) ? arg : arg + ' karaoké');
          if (!first) return say(`😕 Je n'ai rien trouvé pour « ${arg} ». Essaie avec le nom de l'artiste.`);
          const r = add(user, { title: first.title, videoId: first.videoId, duration: first.duration });
          if (r.error) say(`@${user.username} ${r.error}`);
        } catch (e) { say(`😕 La recherche ne marche pas pour le moment. Utilise le bouton « 🎤 Choisir une chanson » et colle un lien YouTube.`); }
        return;
      }
      case '!suivant': case '!passer': case '!skip':
        if (!current) return say('Personne ne chante en ce moment.');
        if (current.userId !== user.id && !isStaff(user)) return say(`@${user.username} seul ${current.username} ou l'équipe peut passer à la suite.`);
        say(`👏 Merci ${current.username} pour « ${current.title} » !`);
        return next();
      case '!retirer': {
        const mine = queue.filter(q => q.userId === user.id);
        if (!mine.length) return say(`@${user.username} tu n'as aucune chanson dans la file.`);
        queue = queue.filter(q => q.userId !== user.id);
        say(`🗑️ ${user.username} a retiré sa chanson de la file.`);
        return broadcast();
      }
    }
  }

  // Quand le chanteur quitte le salon ou se déconnecte, on passe à la suite après 30 s
  setInterval(() => {
    if (current && !inRoom(current.userId) && now() - current.startedAt > 30 * 1000) {
      say(`🚪 ${current.username} est parti, on passe à la suite.`);
      next();
    }
  }, 10 * 1000);

  return { onConnection, command, SLUG };
};
