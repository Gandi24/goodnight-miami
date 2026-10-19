(() => {
  // adres wdrożenia tools/soundtrack.gs (Web app, kończy się na /exec)
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyiywC9gAzC_o_auVeTOrub_HnLEdQu2gL8gZ9U1qPcunZP_7Ql1s0nT7RYnvF4WC0z/exec';

  // krótka cisza: odtworzona w momencie kliknięcia odblokowuje <audio> w Safari,
  // zanim właściwy utwór zdąży się pobrać
  const SILENCE = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
  const KEY = 'gm-soundtrack-password';

  const gate = document.getElementById('gate');
  const form = document.getElementById('unlock');
  const input = document.getElementById('password');
  const error = document.getElementById('error');
  const sheet = document.getElementById('sheet');
  const tpl = document.getElementById('cartTpl');
  const now = document.getElementById('now');
  const nowTitle = document.getElementById('nowTitle');

  // utwory zapętlają się: to muzyka w tle do czytania
  const audio = new Audio();
  audio.loop = true;

  let password = '';
  let order = [];      // utwory w kolejności na stronie
  let current = null;  // { track, cart }
  const loaded = new Map(); // id → Promise<blob URL>

  async function call(body) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ password, ...body }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  function load(track) {
    if (!loaded.has(track.id)) {
      const p = call({ track: track.id }).then(({ mime, data }) => {
        const bin = atob(data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
      });
      p.catch(() => loaded.delete(track.id));
      loaded.set(track.id, p);
    }
    return loaded.get(track.id);
  }

  /* ---------- odtwarzanie ---------- */

  const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  function paint() {
    if (!current) return;
    const { cart } = current;
    const seek = cart.querySelector('.seek');
    const d = audio.duration;
    if (!isFinite(d) || audio.src === SILENCE) return;
    const pct = audio.currentTime / d;
    seek.value = Math.round(pct * 1000);
    seek.style.setProperty('--pct', pct * 100 + '%');
    cart.querySelector('.cart__time').textContent = clock(audio.currentTime) + ' / ' + clock(d);
  }

  function setLive(live) {
    document.body.classList.toggle('is-live', live);
    if (current) current.cart.classList.toggle('is-live', live);
  }

  async function select(track, cart) {
    if (current) {
      current.cart.classList.remove('is-live', 'is-loading');
      current.cart.querySelector('.seek').disabled = true;
    }
    current = { track, cart };
    const time = cart.querySelector('.cart__time');
    now.hidden = false;
    nowTitle.textContent = track.song;

    if (!loaded.has(track.id)) {
      audio.src = SILENCE;
      audio.play().catch(() => {});
    }
    cart.classList.add('is-loading');
    time.textContent = 'Stroję…';
    try {
      const url = await load(track);
      if (current.track !== track) return;
      cart.classList.remove('is-loading');
      cart.querySelector('.seek').disabled = false;
      audio.src = url;
      await audio.play();
      prefetchAfter(track);
    } catch (err) {
      if (current.track !== track) return;
      cart.classList.remove('is-loading');
      time.textContent = err.name === 'NotAllowedError' ? 'Kliknij, żeby puścić' : 'Brak sygnału, kliknij ponownie';
    }
  }

  function toggle(track, cart) {
    if (current && current.track === track && !cart.classList.contains('is-loading') && audio.src !== SILENCE) {
      audio.paused ? audio.play().catch(() => {}) : audio.pause();
    } else {
      select(track, cart);
    }
  }

  function prefetchAfter(track) {
    const next = order[order.indexOf(track) + 1];
    if (next) load(next).catch(() => {});
  }

  audio.addEventListener('play', () => setLive(audio.src !== SILENCE));
  audio.addEventListener('playing', () => setLive(audio.src !== SILENCE));
  audio.addEventListener('pause', () => setLive(false));
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('loadedmetadata', paint);

  now.addEventListener('click', () => {
    if (current) toggle(current.track, current.cart);
  });

  /* ---------- karta postaci ---------- */

  // # imię, akapity, [[utwór]] w osobnej linii, „> ” cytat (pod utworem: tekst piosenki)
  function parse(md) {
    const blocks = [];
    let para = null;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      let m;
      if (!line) {
        para = null;
      } else if ((m = line.match(/^#\s+(.+)/))) {
        blocks.push({ type: 'name', text: m[1] });
        para = null;
      } else if ((m = line.match(/^\[\[(.+)\]\]$/))) {
        blocks.push({ type: 'song', name: m[1].trim(), lines: [] });
        para = null;
      } else if (line[0] === '>') {
        const text = line.replace(/^>\s?/, '');
        const prev = blocks[blocks.length - 1];
        if (prev && (prev.type === 'song' || prev.type === 'quote') && !para) {
          if (text) prev.lines.push(text);
        } else {
          blocks.push({ type: 'quote', lines: text ? [text] : [] });
        }
        para = null;
      } else if (para) {
        para.text += ' ' + line;
      } else {
        para = { type: 'p', text: line };
        blocks.push(para);
      }
    }
    return blocks;
  }

  const norm = s => s.toLowerCase().replace(/[’'"“”„]/g, '').replace(/\s+/g, ' ').trim();

  function splitTitle(title) {
    const m = title.match(/^(.+?)\s+[–—-]\s+(.+)$/);
    return m ? { artist: m[1], song: m[2] } : { artist: '', song: title };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function cart(track, fallbackName) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const knob = node.querySelector('.knob');
    const seek = node.querySelector('.seek');
    node.querySelector('.cart__title').textContent = track ? track.song : fallbackName;
    node.querySelector('.cart__artist').textContent = track ? track.artist : '';
    if (!track) {
      node.classList.add('is-missing');
      knob.disabled = true;
      knob.setAttribute('aria-label', 'Utwór jeszcze niedostępny: ' + fallbackName);
      node.querySelector('.cart__time').textContent = 'Wkrótce';
      return node;
    }
    knob.setAttribute('aria-label', 'Odtwórz albo zatrzymaj: ' + track.title);
    seek.setAttribute('aria-label', 'Przewiń: ' + track.title);
    knob.addEventListener('click', () => toggle(track, node));
    seek.addEventListener('input', () => {
      if (current && current.cart === node && isFinite(audio.duration)) {
        audio.currentTime = seek.value / 1000 * audio.duration;
      }
    });
    order.push(track);
    return node;
  }

  function render(data) {
    const tracks = [];
    for (const group of data.groups) {
      for (const t of group.tracks) tracks.push({ ...t, ...splitTitle(t.title), group: group.title });
    }
    const find = name => {
      const n = norm(name);
      return tracks.find(t => norm(t.title) === n || norm(t.song) === n);
    };

    sheet.textContent = '';
    order = [];
    const placed = new Set();
    const blocks = parse(data.sheet || '');
    if (!blocks.some(b => b.type === 'name')) blocks.unshift({ type: 'name', text: data.character });

    let lead = true;
    for (const b of blocks) {
      if (b.type === 'name') {
        sheet.append(el('h1', 'sheet__name', b.text));
      } else if (b.type === 'p') {
        sheet.append(el('p', lead ? 'sheet__lead' : '', b.text));
        lead = false;
      } else if (b.type === 'quote') {
        sheet.append(el('blockquote', 'sheet__quote', b.lines.join('\n')));
      } else if (b.type === 'song') {
        const track = find(b.name);
        if (track) placed.add(track);
        const node = cart(track, b.name);
        if (b.lines.length) node.append(el('blockquote', 'cart__lyrics', b.lines.join('\n')));
        sheet.append(node);
        lead = false;
      }
    }

    // utwory, których karta nie umieszcza w tekście
    for (const group of data.groups) {
      const rest = tracks.filter(t => t.group === group.title && !placed.has(t));
      if (!rest.length) continue;
      const section = el('section', 'sheet__more');
      section.append(el('h2', '', group.title === data.character ? 'Twoja muzyka' : group.title));
      for (const t of rest) section.append(cart(t));
      sheet.append(section);
    }

    gate.hidden = true;
    sheet.hidden = false;
    if (order[0]) load(order[0]).catch(() => {});
  }

  /* ---------- hasło ---------- */

  async function unlock(pw) {
    password = pw;
    error.textContent = '';
    form.querySelector('button').disabled = true;
    try {
      render(await call({}));
      try { sessionStorage.setItem(KEY, pw); } catch (e) {}
    } catch (err) {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      error.textContent = err.message === 'wrong_password'
        ? 'Złe hasło. Ta częstotliwość jest zakodowana.'
        : 'Nie udało się połączyć ze stacją. Spróbuj za chwilę.';
    } finally {
      form.querySelector('button').disabled = false;
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value) unlock(input.value);
  });

  let saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) unlock(saved);
})();
