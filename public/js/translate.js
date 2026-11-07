// The Paradise — traducteur des salons et des messages privés
// On choisit sa langue : les messages des autres peuvent être traduits automatiquement (ou un par un avec 🌐),
// et on peut traduire son propre message avant de l'envoyer.
const Translator = {
  LANGS: [['fr', '🇫🇷 Français'], ['en', '🇬🇧 English'], ['es', '🇪🇸 Español'], ['de', '🇩🇪 Deutsch'], ['it', '🇮🇹 Italiano'], ['pt', '🇵🇹 Português'],
    ['nl', '🇳🇱 Nederlands'], ['pl', '🇵🇱 Polski'], ['ro', '🇷🇴 Română'], ['tr', '🇹🇷 Türkçe'], ['ar', '🇸🇦 العربية'], ['ru', '🇷🇺 Русский'],
    ['uk', '🇺🇦 Українська'], ['zh-CN', '🇨🇳 中文'], ['ja', '🇯🇵 日本語'], ['ko', '🇰🇷 한국어'], ['hi', '🇮🇳 हिन्दी'], ['vi', '🇻🇳 Tiếng Việt'],
    ['id', '🇮🇩 Bahasa Indonesia'], ['el', '🇬🇷 Ελληνικά'], ['sv', '🇸🇪 Svenska']],
  lang: 'fr', auto: false, writeLang: 'en', cache: new Map(),

  init() {
    try {
      const s = JSON.parse(localStorage.getItem('lc_translate') || '{}');
      this.lang = s.lang || 'fr';
      if (!this.LANGS.some(l => l[0] === this.lang)) this.lang = 'fr';
      this.auto = !!s.auto; this.writeLang = s.writeLang || 'en';
    } catch (e) {}
    this.updateBtn();
  },
  save() { try { localStorage.setItem('lc_translate', JSON.stringify({ lang: this.lang, auto: this.auto, writeLang: this.writeLang })); } catch (e) {} this.updateBtn(); },
  name(code) { return (this.LANGS.find(l => l[0] === code) || [code, code])[1]; },
  updateBtn() { const b = $('headTranslate'); if (b) b.classList.toggle('on', this.auto); },

  async get(text, to) {
    const key = to + '|' + text;
    if (this.cache.has(key)) return this.cache.get(key);
    const r = await api('/api/translate', { method: 'POST', body: { text, to } });
    this.cache.set(key, r);
    return r;
  },
  // Traduit un message affiché (ligne du salon ou bulle de message privé)
  async translateRow(row, quiet) {
    const m = row?._msg;
    if (!m || !m.content || m.kind === 'audio' || row.querySelector('.tr-box')) return;
    const holder = row.querySelector('.body') || row.querySelector('.bubble');
    const box = el('div', { class: 'tr-box' }, '🌐 Traduction…');
    holder.append(box);
    try {
      const r = await this.get(m.content, this.lang);
      if (!r.text || (r.from && r.from.slice(0, 2) === this.lang.slice(0, 2)) || r.text.trim().toLowerCase() === m.content.trim().toLowerCase()) {
        if (quiet) return box.remove();
        box.textContent = '🌐 Ce message est déjà dans ta langue';
        return setTimeout(() => box.remove(), 2500);
      }
      box.replaceChildren(el('small', {}, `🌐 ${r.from ? this.name(r.from).replace(/^\S+\s/, '') + ' → ' : ''}${this.name(this.lang).replace(/^\S+\s/, '')}`), el('div', {}, r.text));
    } catch (e) { if (quiet) box.remove(); else box.textContent = '🌐 ' + e.message; }
  },
  // Nouveau message reçu : traduction automatique si elle est activée
  onNewRow(row) {
    if (!this.auto || !row?._msg) return;
    const m = row._msg;
    if (m.userId === state.me?.id || m.from === state.me?.id) return;
    this.translateRow(row, true);
  },
  async translateInput() {
    const inp = $('input');
    const text = inp.value.trim();
    if (!text) return toast('Écris d\'abord ton message, puis traduis-le');
    try {
      const r = await this.get(text, this.writeLang);
      inp.value = r.text; inp.dispatchEvent(new Event('input')); inp.focus();
      toast(`🌐 Message traduit en ${this.name(this.writeLang).replace(/^\S+\s/, '')} : tu peux l'envoyer`);
    } catch (e) { toast(e.message); }
  },

  open() {
    const opts = sel => this.LANGS.map(([c, n]) => el('option', { value: c, selected: c === sel }, n));
    const read = el('select', { class: 'input' }, ...opts(this.lang));
    const write = el('select', { class: 'input' }, ...opts(this.writeLang));
    const auto = el('input', { type: 'checkbox', checked: this.auto });
    const close = modal(
      el('h3', {}, '🌐 Traducteur'),
      el('p', { class: 'help', style: 'margin-top:-6px' }, 'Discute avec des personnes du monde entier : chacun lit dans sa langue.'),
      field('📖 Ma langue (les messages des autres sont traduits dans cette langue)', read),
      toggleRow('⚡ Traduire automatiquement', 'Les nouveaux messages écrits dans une autre langue sont traduits tout seuls, sous le message.', auto),
      el('p', { class: 'help' }, 'Astuce : clic droit (ou appui long) sur un message, ou le bouton 🌐 à côté du message, pour traduire un seul message.'),
      field('✍️ Traduire mon message en…', el('div', { class: 'row', style: 'gap:8px' }, write,
        el('button', { class: 'btn', style: 'flex:none', onclick: () => { this.writeLang = write.value; this.save(); close(); this.translateInput(); } }, 'Traduire mon message'))),
      el('button', { class: 'btn btn-primary', style: 'width:100%;margin-top:8px', onclick: () => {
        this.lang = read.value; this.auto = auto.checked; this.writeLang = write.value; this.save(); close();
        toast(this.auto ? `🌐 Traduction automatique en ${this.name(this.lang).replace(/^\S+\s/, '')} activée` : '🌐 Réglages du traducteur enregistrés');
        if (this.auto) document.querySelectorAll('#messages .msg, #messages .bubble-row').forEach(r => this.onNewRow(r));
      } }, 'Enregistrer'));
  },
};
Translator.init();
$('headTranslate').onclick = () => Translator.open();
// Les nouveaux messages qui arrivent dans la zone de discussion
new MutationObserver(list => {
  if (!Translator.auto) return;
  for (const mu of list) for (const n of mu.addedNodes) if (n.nodeType === 1 && (n.classList.contains('msg') || n.classList.contains('bubble-row'))) setTimeout(() => Translator.onNewRow(n), 0);
}).observe($('messages'), { childList: true });
