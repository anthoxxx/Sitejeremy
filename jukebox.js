// The Paradise — bots musicaux des salons
//  • KaraoBot (salon Karaoké) : file des chanteurs, versions karaoké, tour de chacun
//  • DJ Bot (salon Musique) : chacun met la musique qu'il veut, tout le salon l'écoute en même temps
// Recherche YouTube sans clé d'API, file d'attente, annonces du bot, passage automatique.

const KARAOKE_CATALOG = [
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

const MUSIC_CATALOG = [
  { cat: '🔥 Hits du moment', songs: [
    ['Aya Nakamura', 'Djadja'], ['Gims', 'Ciel'], ['Tiakola', 'Meuda'], ['Werenoi', 'Solitaire'], ['SDM', 'Bolide allemand'],
    ['Theodora', 'Kongolese sous BBL'], ['Dua Lipa', 'Houdini'], ['Sabrina Carpenter', 'Espresso'], ['Billie Eilish', 'Birds of a Feather'],
    ['Teddy Swims', 'Lose Control'], ['Benson Boone', 'Beautiful Things'], ['Shakira', 'Soltera'],
  ] },
  { cat: '🎤 Rap FR', songs: [
    ['Jul', 'Tchikita'], ['Ninho', 'Lettre à une femme'], ['PNL', 'Au DD'], ['Damso', 'Θ. Macarena'], ['Booba', 'DKR'],
    ['SCH', 'Champs-Élysées'], ['Niska', 'Réseaux'], ['Gazo', 'Die'], ['Naps', 'La kiffance'], ['Heuss L\'enfoiré', 'Moulaga'],
  ] },
  { cat: '💃 Pour danser', songs: [
    ['Bob Sinclar', 'Love Generation'], ['David Guetta & Sia', 'Titanium'], ['Calvin Harris', 'Summer'], ['Avicii', 'Wake Me Up'],
    ['Daft Punk', 'Get Lucky'], ['Mark Ronson', 'Uptown Funk'], ['Pharrell Williams', 'Happy'], ['Luis Fonsi', 'Despacito'],
    ['Black Eyed Peas', 'I Gotta Feeling'], ['Magic System', 'Magic in the Air'],
  ] },
  { cat: '🌙 Chill & love', songs: [
    ['Tayc', 'Le temps'], ['Dadju', 'Reine'], ['Slimane', 'Mon amour'], ['Ed Sheeran', 'Perfect'], ['Adele', 'Easy on Me'],
    ['Lana Del Rey', 'Summertime Sadness'], ['Juliette Armanet', 'Le dernier jour du disco'], ['Angèle', 'Ta reine'],
  ] },
  { cat: '🕺 Années 80 – 2000', songs: [
    ['Michael Jackson', 'Thriller'], ['Madonna', 'Like a Prayer'], ['Indochine', 'L\'aventurier'], ['Téléphone', 'Ça c\'est vraiment toi'],
    ['Britney Spears', 'Toxic'], ['Eminem', 'Without Me'], ['Shy\'m', 'Femme de couleur'], ['Diam\'s', 'DJ'],
    ['Alizée', 'Moi… Lolita'], ['Lorie', 'Je serai (ta meilleure amie)'],
  ] },
];

const MODES = {
  karaoke: {
    slug: 'karaoke', event: 'karaoke', bot: { username: 'KaraoBot', color: '#ffb547', icon: '🎤' },
    catalog: KARAOKE_CATALOG, suffix: ' karaoké', keep: /karaok|lyrics|paroles/i,
    perUser: 2, requirePresence: true, skipVote: false,
    nowText: c => `🎤 À toi @${c.username} ! Tu chantes « ${c.title} ». Rejoins le vocal 🎙️ et lance la vidéo en haut du salon. Bonne chance ! 🌟`,
    soonText: q => `⏳ Prépare-toi @${q.username}, c'est toi juste après !`,
    endText: c => `👏 Bravo ${c.username} ! Merci pour « ${c.title} » 🎉`,
    addText: (u, t, n) => `📝 ${u} a choisi « ${t} » (n°${n} dans la file)`,
    emptyText: '🎶 La file est vide ! Choisis une chanson avec le bouton « 🎤 Choisir une chanson » ou tape !chanson suivi du titre.',
    help: '🤖 Je suis KaraoBot ! Commandes : !chanson <titre> pour t\'inscrire, !liste pour voir la file, !suivant quand tu as fini, !retirer pour enlever ta chanson. Tu peux aussi utiliser le bouton « 🎤 Choisir une chanson ».',
  },
  music: {
    slug: 'musique', event: 'music', bot: { username: 'DJ Bot', color: '#4fb3ff', icon: '🎧' },
    catalog: MUSIC_CATALOG, suffix: '', keep: null,
    perUser: 3, requirePresence: false, skipVote: true,
    nowText: c => `🎶 Maintenant : « ${c.title} », demandé par ${c.username}. Clique sur « 🔊 Écouter » en haut du salon pour l'entendre !`,
    soonText: null,
    endText: null,
    addText: (u, t, n) => `➕ ${u} a ajouté « ${t} » (n°${n} dans la file)`,
    emptyText: '🎧 Plus rien dans la file ! Mets ce que tu veux avec « 🎵 Mettre une musique » ou tape !play suivi du titre.',
    help: '🎧 Je suis DJ Bot ! Mets la musique que tu veux : bouton « 🎵 Mettre une musique » ou !play <titre>. Aussi : !liste pour la file, !skip pour passer (vote du salon), !retirer pour enlever tes musiques.',
  },
};

module.exports = function setupJukebox({ app, io, auth, isStaff, tooMany, log, getOnline }) {
  const now = () => Date.now();
  let msgSeq = 1, seq = 1;

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
  const searchQuery = (cfg, q) => (cfg.suffix && !cfg.keep.test(q) ? q + cfg.suffix : q);

  // ---------- Une file d'attente par salon ----------
  function createBox(cfg) {
    const SLUG = cfg.slug;
    let queue = [], current = null, timer = null;
    const votes = new Set();
    const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'bot' + (msgSeq++), userId: 0, username: cfg.bot.username, color: cfg.bot.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: cfg.bot.icon, content, createdAt: now(), kind: 'text' });
    const stateOut = () => ({ slug: SLUG, mode: cfg.event, current, queue, votes: votes.size, votesNeeded: votesNeeded(), serverNow: now() });
    const broadcast = () => io.to('room:' + SLUG).emit('jukebox', stateOut());
    const inRoom = userId => getOnline().get(userId)?.room === SLUG;
    const listeners = () => [...getOnline().values()].filter(e => e.room === SLUG && !e.ghost).length;
    const votesNeeded = () => Math.max(1, Math.ceil(listeners() / 2));

    function next(reason) {
      clearTimeout(timer); timer = null; votes.clear();
      const skipped = [];
      let item = queue.shift();
      if (cfg.requirePresence) while (item && !inRoom(item.userId)) { skipped.push(item.username); item = queue.shift(); }
      if (skipped.length) say(`⏭️ ${skipped.join(', ')} n'${skipped.length > 1 ? 'étaient' : 'était'} plus là, on passe.`);
      current = item ? { ...item, startedAt: now() } : null;
      if (current) {
        say(cfg.nowText(current));
        const limit = (current.duration ? current.duration + (cfg.requirePresence ? 20 : 3) : 8 * 60) * 1000;
        timer = setTimeout(() => { if (cfg.endText) say(cfg.endText(current)); next('fin'); }, limit);
        if (cfg.soonText && queue[0]) say(cfg.soonText(queue[0]));
      } else if (reason !== 'silence') say(cfg.emptyText);
      broadcast();
    }

    function add(user, { title, videoId, duration }) {
      title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      videoId = String(videoId || '');
      if (!/^[\w-]{11}$/.test(videoId) || !title) return { error: 'Musique invalide' };
      const mine = queue.filter(q => q.userId === user.id).length + (current?.userId === user.id ? 1 : 0);
      if (mine >= cfg.perUser && !isStaff(user)) return { error: `${cfg.perUser} ${cfg.event === 'karaoke' ? 'chansons' : 'musiques'} maximum par personne dans la file` };
      if (queue.length >= 40) return { error: 'La file est pleine, attends un peu' };
      const item = { id: seq++, userId: user.id, username: user.username, title, videoId, duration: Math.max(0, Math.min(15 * 60, parseInt(duration, 10) || 0)), addedAt: now() };
      queue.push(item);
      log(user, cfg.event, `${cfg.bot.icon} ${cfg.bot.username} : « ${title} » ajoutée à la file`);
      if (!current) next('silence');
      else { say(cfg.addText(user.username, title, queue.length)); broadcast(); }
      return { ok: true };
    }

    function skip(user) {
      if (!current) return { error: 'Rien ne passe en ce moment' };
      if (current.userId === user.id || isStaff(user)) {
        say(cfg.event === 'karaoke' && current.userId === user.id ? `👏 Merci ${current.username} pour « ${current.title} » !` : `⏭️ ${user.username} passe à la suite.`);
        next();
        return { ok: true };
      }
      if (!cfg.skipVote) return { error: `Seul ${current.username} ou l'équipe peut passer à la suite` };
      votes.add(user.id);
      if (votes.size >= votesNeeded()) { say(`⏭️ Le salon a voté : on passe « ${current.title} » !`); next(); }
      else { say(`🗳️ ${user.username} veut passer (${votes.size}/${votesNeeded()} votes).`); broadcast(); }
      return { ok: true };
    }

    function remove(user, id) {
      const item = queue.find(q => q.id === parseInt(id, 10));
      if (!item) return { error: 'Introuvable dans la file' };
      if (item.userId !== user.id && !isStaff(user)) return { error: 'Tu ne peux retirer que tes demandes' };
      queue = queue.filter(q => q !== item);
      broadcast();
      return { ok: true };
    }

    async function command(user, text) {
      const [cmd, ...rest] = text.trim().split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd.toLowerCase()) {
        case '!aide': case '!help': case '!karaoke': case '!karaoké': case '!dj':
          return say(cfg.help);
        case '!liste': case '!file': case '!queue': {
          if (!current && !queue.length) return say(cfg.emptyText);
          const lines = [current ? `${cfg.bot.icon} En ce moment : ${current.username} – « ${current.title} »` : null, ...queue.slice(0, 8).map((q, i) => `${i + 1}. ${q.username} – « ${q.title} »`)].filter(Boolean);
          if (queue.length > 8) lines.push(`… et ${queue.length - 8} autre(s)`);
          return say(lines.join('\n'));
        }
        case '!chanson': case '!chante': case '!song': case '!play': case '!musique': case '!mets': {
          if (arg.length < 2) return say(`@${user.username} dis-moi quoi mettre : ${cmd} ${cfg.event === 'karaoke' ? 'Libérée délivrée' : 'Djadja Aya Nakamura'}`);
          if (/^https?:\/\//.test(arg)) {
            const id = (arg.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || [])[1];
            if (!id) return say(`@${user.username} ce lien n'est pas une vidéo YouTube.`);
            const r = add(user, { title: 'Musique YouTube', videoId: id });
            if (r.error) say(`@${user.username} ${r.error}`);
            return;
          }
          if (tooMany('ksearch:' + user.id, 20, 60 * 1000)) return say(`@${user.username} doucement, attends une minute 😉`);
          try {
            const [first] = await ytSearch(searchQuery(cfg, arg));
            if (!first) return say(`😕 Je n'ai rien trouvé pour « ${arg} ». Essaie avec le nom de l'artiste.`);
            const r = add(user, { title: first.title, videoId: first.videoId, duration: first.duration });
            if (r.error) say(`@${user.username} ${r.error}`);
          } catch (e) { say('😕 La recherche ne marche pas pour le moment. Colle plutôt un lien YouTube.'); }
          return;
        }
        case '!suivant': case '!passer': case '!skip': {
          const r = skip(user);
          if (r.error) say(`@${user.username} ${r.error}`);
          return;
        }
        case '!retirer': {
          if (!queue.some(q => q.userId === user.id)) return say(`@${user.username} tu n'as rien dans la file.`);
          queue = queue.filter(q => q.userId !== user.id);
          say(`🗑️ ${user.username} a retiré ses demandes de la file.`);
          return broadcast();
        }
      }
    }

    // Karaoké : si le chanteur quitte le salon, on passe à la suite après 30 s
    if (cfg.requirePresence) setInterval(() => {
      if (current && !inRoom(current.userId) && now() - current.startedAt > 30 * 1000) {
        say(`🚪 ${current.username} est parti, on passe à la suite.`);
        next();
      }
    }, 10 * 1000);

    return { cfg, stateOut, add, skip, remove, command };
  }

  const boxes = new Map(Object.values(MODES).map(cfg => [cfg.slug, createBox(cfg)]));

  // ---------- API ----------
  const boxOf = slug => boxes.get(String(slug || ''));
  app.get('/api/jukebox/:slug/catalog', auth, (req, res) => {
    const box = boxOf(req.params.slug);
    if (!box) return res.status(404).json({ error: 'Salon sans bot' });
    res.json({ catalog: box.cfg.catalog });
  });
  app.get('/api/jukebox/:slug/search', auth, async (req, res) => {
    const box = boxOf(req.params.slug);
    if (!box) return res.status(404).json({ error: 'Salon sans bot' });
    const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (q.length < 2) return res.status(400).json({ error: 'Tape au moins 2 lettres' });
    if (tooMany('ksearch:' + req.user.id, 20, 60 * 1000)) return res.status(429).json({ error: 'Trop de recherches, attends une minute' });
    const query = searchQuery(box.cfg, q);
    try { res.json({ results: await ytSearch(query) }); }
    catch (e) { res.json({ results: [], error: 'La recherche YouTube ne marche pas pour le moment : colle directement un lien YouTube.', searchUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) }); }
  });

  // ---------- Temps réel ----------
  function onConnection(socket, uid, currentUser) {
    const inRoomOf = slug => getOnline().get(uid)?.room === slug;
    const guard = (slug, ack) => {
      const box = boxOf(slug);
      const u = currentUser();
      if (!box || !u) { ack && ack({ error: 'Salon sans bot' }); return null; }
      if (!inRoomOf(box.cfg.slug)) { ack && ack({ error: 'Entre dans le salon d\'abord' }); return null; }
      return { box, u };
    };
    socket.on('jb_state', (slug, ack) => { const box = boxOf(slug); typeof ack === 'function' && ack(box ? box.stateOut() : null); });
    socket.on('jb_add', (song, ack) => {
      const g = guard(song?.slug, ack); if (!g) return;
      if (g.u.muted_until && g.u.muted_until > Date.now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
      ack && ack(g.box.add(g.u, song || {}));
    });
    socket.on('jb_next', (slug, ack) => { const g = guard(slug, ack); if (g) ack && ack(g.box.skip(g.u)); });
    socket.on('jb_remove', (slug, id, ack) => { const g = guard(slug, ack); if (g) ack && ack(g.box.remove(g.u, id)); });
  }

  return {
    onConnection,
    ytSearch, catalogs: [...KARAOKE_CATALOG, ...MUSIC_CATALOG], // aussi utilisés par le Grand Blind Test
    has: slug => boxes.has(slug),
    command: (slug, user, text) => boxes.get(slug)?.command(user, text) || Promise.resolve(),
  };
};
