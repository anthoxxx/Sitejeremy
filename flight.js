// The Paradise — ✈️ « Le vol pour The Paradise » : à la connexion, on part de l'aéroport le plus proche de chez soi
// (trouvé à partir de l'adresse IP, juste la ville, montrée seulement à la personne elle-même, rien n'est enregistré)
// jusqu'à l'aéroport international de The Paradise 🏝️ (aux Maldives, comme sur la vidéo de l'accueil).
const AIRPORTS = [
  ['CDG', 'Paris-Charles-de-Gaulle', 'Paris', 49.0097, 2.5479], ['ORY', 'Paris-Orly', 'Paris', 48.7262, 2.3652], ['BVA', 'Paris-Beauvais', 'Beauvais', 49.4544, 2.1128],
  ['URO', 'Rouen Vallée de Seine', 'Rouen', 49.3842, 1.1748], ['LEH', 'Le Havre-Octeville', 'Le Havre', 49.534, .088], ['CFR', 'Caen-Carpiquet', 'Caen', 49.1733, -.45], ['DOL', 'Deauville-Normandie', 'Deauville', 49.365, .154],
  ['LIL', 'Lille-Lesquin', 'Lille', 50.5619, 3.0894], ['NTE', 'Nantes-Atlantique', 'Nantes', 47.1532, -1.6107], ['RNS', 'Rennes-Bretagne', 'Rennes', 48.0695, -1.7348], ['BES', 'Brest-Bretagne', 'Brest', 48.4479, -4.4185],
  ['LRT', 'Lorient-Bretagne Sud', 'Lorient', 47.7606, -3.44], ['UIP', 'Quimper-Bretagne', 'Quimper', 47.975, -4.1678], ['BOD', 'Bordeaux-Mérignac', 'Bordeaux', 44.8283, -.7156], ['TLS', 'Toulouse-Blagnac', 'Toulouse', 43.6291, 1.3638],
  ['MRS', 'Marseille-Provence', 'Marseille', 43.4393, 5.2214], ['NCE', 'Nice-Côte d\'Azur', 'Nice', 43.6584, 7.2159], ['LYS', 'Lyon-Saint-Exupéry', 'Lyon', 45.7256, 5.0811], ['SXB', 'Strasbourg-Entzheim', 'Strasbourg', 48.5383, 7.6282],
  ['BSL', 'Bâle-Mulhouse', 'Mulhouse', 47.59, 7.5291], ['MPL', 'Montpellier-Méditerranée', 'Montpellier', 43.5762, 3.963], ['BIQ', 'Biarritz-Pays Basque', 'Biarritz', 43.4684, -1.5311], ['PUF', 'Pau-Pyrénées', 'Pau', 43.38, -.4186],
  ['CFE', 'Clermont-Ferrand-Auvergne', 'Clermont-Ferrand', 45.7867, 3.1692], ['LIG', 'Limoges-Bellegarde', 'Limoges', 45.8628, 1.1794], ['PIS', 'Poitiers-Biard', 'Poitiers', 46.5877, .3066], ['TUF', 'Tours-Val de Loire', 'Tours', 47.4322, .7276],
  ['ETZ', 'Metz-Nancy-Lorraine', 'Metz', 48.9821, 6.2513], ['GNB', 'Grenoble-Alpes-Isère', 'Grenoble', 45.3629, 5.3294], ['AJA', 'Ajaccio-Napoléon-Bonaparte', 'Ajaccio', 41.9236, 8.8029], ['BIA', 'Bastia-Poretta', 'Bastia', 42.5527, 9.4837],
  ['PGF', 'Perpignan-Rivesaltes', 'Perpignan', 42.7404, 2.8707], ['BVE', 'Brive-Vallée de la Dordogne', 'Brive', 45.0397, 1.4856], ['LRH', 'La Rochelle-Île de Ré', 'La Rochelle', 46.1792, -1.1953], ['DIJ', 'Dijon-Bourgogne', 'Dijon', 47.27, 5.09],
  ['BZR', 'Béziers-Cap d\'Agde', 'Béziers', 43.3235, 3.3539], ['TLN', 'Toulon-Hyères', 'Toulon', 43.0973, 6.146], ['AVN', 'Avignon-Provence', 'Avignon', 43.9073, 4.9018], ['CCF', 'Carcassonne', 'Carcassonne', 43.216, 2.3063],
  ['CMF', 'Chambéry-Savoie', 'Chambéry', 45.6381, 5.8802], ['RDZ', 'Rodez-Aveyron', 'Rodez', 44.4079, 2.4827], ['NIT', 'Niort-Souché', 'Niort', 46.3113, -.4015], ['EGC', 'Bergerac-Dordogne', 'Bergerac', 44.8253, .5186],
  ['BRU', 'Bruxelles-National', 'Bruxelles', 50.9014, 4.4844], ['CRL', 'Bruxelles-Charleroi', 'Charleroi', 50.4592, 4.4538], ['LGG', 'Liège', 'Liège', 50.6374, 5.4432], ['GVA', 'Genève', 'Genève', 46.2381, 6.109], ['ZRH', 'Zurich', 'Zurich', 47.4582, 8.5555],
  ['LUX', 'Luxembourg-Findel', 'Luxembourg', 49.6233, 6.2044], ['LHR', 'Londres-Heathrow', 'Londres', 51.47, -.4543], ['MAD', 'Madrid-Barajas', 'Madrid', 40.4983, -3.5676], ['BCN', 'Barcelone-El Prat', 'Barcelone', 41.2974, 2.0833],
  ['FCO', 'Rome-Fiumicino', 'Rome', 41.8003, 12.2389], ['BER', 'Berlin-Brandebourg', 'Berlin', 52.3667, 13.5033], ['AMS', 'Amsterdam-Schiphol', 'Amsterdam', 52.3105, 4.7683], ['LIS', 'Lisbonne', 'Lisbonne', 38.7742, -9.1342],
  ['OPO', 'Porto', 'Porto', 41.2481, -8.6814], ['IST', 'Istanbul', 'Istanbul', 41.2753, 28.7519], ['DXB', 'Dubaï', 'Dubaï', 25.2532, 55.3657], ['JFK', 'New York-JFK', 'New York', 40.6413, -73.7781],
  ['YUL', 'Montréal-Trudeau', 'Montréal', 45.4706, -73.7408], ['YQB', 'Québec-Jean-Lesage', 'Québec', 46.7911, -71.3933], ['ALG', 'Alger-Houari-Boumédiène', 'Alger', 36.691, 3.2154], ['ORN', 'Oran-Ahmed Ben Bella', 'Oran', 35.6239, -.6212],
  ['CMN', 'Casablanca-Mohammed V', 'Casablanca', 33.3675, -7.5899], ['RAK', 'Marrakech-Ménara', 'Marrakech', 31.6069, -8.0363], ['TUN', 'Tunis-Carthage', 'Tunis', 36.851, 10.2272], ['DSS', 'Dakar-Blaise-Diagne', 'Dakar', 14.67, -17.073],
  ['ABJ', 'Abidjan-Félix-Houphouët-Boigny', 'Abidjan', 5.2614, -3.9263], ['RUN', 'La Réunion-Roland-Garros', 'Saint-Denis', -20.8871, 55.5103], ['PTP', 'Pointe-à-Pitre-Guadeloupe', 'Pointe-à-Pitre', 16.2653, -61.5318],
  ['FDF', 'Martinique-Aimé-Césaire', 'Fort-de-France', 14.591, -61.0032], ['CAY', 'Cayenne-Félix-Éboué', 'Cayenne', 4.8198, -52.3604], ['NOU', 'Nouméa-La Tontouta', 'Nouméa', -22.0146, 166.213], ['PPT', 'Tahiti-Faa\'a', 'Papeete', -17.5537, -149.607],
];
const DEST = { code: 'TPR', name: 'Aéroport international The Paradise', city: 'The Paradise 🏝️', lat: 4.19, lon: 73.53 };
const km = (a, b, c, d) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(c - a), dn = r(d - b); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
module.exports = function setupFlight({ ipOf, isLocalIp }) {
  const cache = new Map(); // ip -> { at, geo } (en mémoire seulement, pas dans la base)
  // 📍 la ville du profil, retrouvée sur la carte avec le service gratuit de l'État (toutes les communes de France)
  const towns = new Map();
  async function town(name) {
    const k = String(name || '').trim().toLowerCase(); if (k.length < 2) return null;
    const c = towns.get(k); if (c !== undefined) return c;
    let g = null;
    try { const r = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(name)}&fields=nom,centre,population&boost=population&limit=1`, { signal: AbortSignal.timeout(4000) });
      const d = await r.json(); const t = Array.isArray(d) && d[0]; if (t && t.centre?.coordinates) g = { city: t.nom, lat: t.centre.coordinates[1], lon: t.centre.coordinates[0], country: 'France', from: 'profil' }; } catch (e) {}
    // pas en France (ou service en panne) : on regarde si c'est la ville d'un des aéroports de la liste
    if (!g) { const a = AIRPORTS.find(x => x[2].toLowerCase() === k); if (a) g = { city: a[2], lat: a[3], lon: a[4], country: '', from: 'profil' }; }
    towns.set(k, g); if (towns.size > 3000) towns.delete(towns.keys().next().value);
    return g;
  }
  async function geo(ip) {
    if (isLocalIp(ip)) return { city: 'Rouen', lat: 49.4431, lon: 1.0993, country: 'France' };
    const c = cache.get(ip); if (c && Date.now() - c.at < 6 * 3600000) return c.geo;
    let g = null;
    try { const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,lat,lon,country&lang=fr`, { signal: AbortSignal.timeout(4000) }); const d = await r.json(); if (d.status === 'success') g = { city: d.city || '', lat: d.lat, lon: d.lon, country: d.country || '' }; } catch (e) {}
    if (g) { cache.set(ip, { at: Date.now(), geo: g }); if (cache.size > 5000) cache.delete(cache.keys().next().value); }
    return g;
  }
  return {
    routes(app, auth) {
      app.get('/api/flight', auth, async (req, res) => {
        // d'abord la ville du profil (précise), sinon l'adresse IP (approximative : souvent la grande ville voisine)
        const g = (req.user.city && await town(req.user.city)) || await geo(ipOf(req)) || { city: 'Paris', lat: 48.8566, lon: 2.3522, country: 'France' };
        let best = null, bd = Infinity; for (const a of AIRPORTS) { const d = km(g.lat, g.lon, a[3], a[4]); if (d < bd) { bd = d; best = a; } }
        const from = bd < 350 ? { code: best[0], name: ('Aéroport de ' + best[1]).replace(/^Aéroport de Le /, 'Aéroport du '), city: best[2], lat: best[3], lon: best[4] } : { code: (g.city || 'XXX').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX', name: 'Aéroport de ' + (g.city || 'ta ville'), city: g.city || 'Ta ville', lat: g.lat, lon: g.lon };
        res.json({ home: g.city || from.city, source: g.from || 'ip', from, to: DEST, km: Math.round(km(from.lat, from.lon, DEST.lat, DEST.lon)), flight: 'TP' + String(1000 + (req.user.id * 37) % 9000) });
      });
    },
  };
};
