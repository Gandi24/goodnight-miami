(() => {
  const STATION = 92.3, MIN = 88, MAX = 108, IDLE = 99.1;
  // Real Miami-area FM stations; Lighthouse sits in the empty 92.1–92.5 gap
  const MIAMI = [88.9, 89.7, 91.3, 93.1, 93.9, 94.9, 95.7, 96.5, 97.3, 98.3, 99.1, 99.9, 100.7, 101.5, 102.7, 103.5, 104.3, 105.1, 105.9, 106.7, 107.5];
  const body = document.body;
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const cur = document.getElementById('cur');
  const dur = document.getElementById('dur');
  const scale = document.getElementById('scale');
  const canvas = document.getElementById('scope');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- tuner scale ---- */
  const pos = f => ((f - MIN) / (MAX - MIN)) * 100;
  for (let f = MIN; f <= MAX + 0.001; f += 1) {
    const major = f % 4 === 0;
    const t = document.createElement('div');
    t.className = 'dial__tick' + (major ? ' dial__tick--major' : '');
    t.style.left = pos(f) + '%';
    scale.appendChild(t);
    if (major) {
      const n = document.createElement('div');
      n.className = 'dial__num' + ([88, 96, 108].includes(f) ? '' : ' dial__num--minor');
      n.style.left = pos(f) + '%';
      n.textContent = f;
      scale.appendChild(n);
    }
  }
  MIAMI.forEach(f => {
    const d = document.createElement('div');
    d.className = 'dial__station';
    d.style.left = pos(f) + '%';
    scale.appendChild(d);
  });
  const home = document.createElement('div');
  home.className = 'dial__station dial__station--home';
  home.style.left = pos(STATION) + '%';
  scale.appendChild(home);

  const needle = document.createElement('div');
  needle.className = 'dial__needle';
  scale.appendChild(needle);
  const setNeedle = f => { needle.style.left = pos(f) + '%'; };
  setNeedle(IDLE);

  /* ---- transcript toggle ---- */
  const tToggle = document.getElementById('tToggle');
  const transcript = document.getElementById('transcript');
  tToggle.addEventListener('click', () => {
    const open = tToggle.getAttribute('aria-expanded') !== 'true';
    tToggle.setAttribute('aria-expanded', open);
    tToggle.querySelector('span').textContent = open ? 'Zwiń zapis' : 'Pokaż pełny zapis';
    transcript.classList.toggle('is-collapsed', !open);
  });

  /* ---- time ---- */
  const fmt = s => {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });

  /* ---- transcript follow (approximate, by text length) ---- */
  const paras = [...document.querySelectorAll('#transcript p:not(.letter)')];
  const bounds = [];
  const total = paras.reduce((acc, p) => (bounds.push(acc + p.textContent.length), acc + p.textContent.length), 0);
  let current = -1;
  const follow = frac => {
    const i = Math.max(0, bounds.findIndex(b => frac * total < b));
    if (i === current) return;
    if (current >= 0) paras[current].classList.remove('is-now');
    paras[i].classList.add('is-now');
    current = i;
  };

  let seeking = false;
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 0;
    const frac = d ? audio.currentTime / d : 0;
    cur.textContent = fmt(audio.currentTime);
    if (!seeking) seek.value = Math.round(frac * 1000);
    seek.style.setProperty('--pct', (frac * 100) + '%');
    follow(frac);
  });
  seek.addEventListener('input', () => {
    seeking = true;
    const d = audio.duration || 0;
    if (d) audio.currentTime = (seek.value / 1000) * d;
    seek.style.setProperty('--pct', (seek.value / 10) + '%');
  });
  seek.addEventListener('change', () => { seeking = false; });

  /* ---- audio graph ---- */
  let actx, analyser, data, silentFrames = 0, heardSignal = false, useSynthetic = false;
  const setupGraph = () => {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(actx.destination);
    } catch (e) { useSynthetic = true; }
  };
  const play = () => {
    setupGraph();
    if (actx && actx.state === 'suspended') actx.resume();
    audio.play();
  };
  playBtn.addEventListener('click', () => audio.paused ? play() : audio.pause());

  audio.addEventListener('play', () => {
    body.classList.add('is-live');
    playBtn.setAttribute('aria-label', 'Zatrzymaj audycję');
    setNeedle(STATION);
    loop();
  });
  audio.addEventListener('pause', () => {
    body.classList.remove('is-live');
    playBtn.setAttribute('aria-label', 'Słuchaj audycji');
  });
  audio.addEventListener('ended', () => setNeedle(IDLE));

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !/INPUT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      audio.paused ? play() : audio.pause();
    }
  });

  /* ---- wave behind the speaker grille ---- */
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    if (audio.paused) drawIdle();
  };

  const stroke = (pts, color, alpha, width, blur) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    ctx.restore();
  };

  const drawIdle = () => {
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    stroke([[0, h / 2], [w, h / 2]], '#B8367E', 0.35, 2 * (devicePixelRatio || 1), 8);
  };

  const t0 = performance.now();
  const synthetic = (w, h) => {
    const t = (performance.now() - t0) / 1000;
    const env = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1));
    const pts = [];
    for (let x = 0; x <= w; x += 3) {
      const u = x / w;
      const y = Math.sin(u * 30 + t * 9) * 0.5 + Math.sin(u * 77 - t * 13) * 0.3 + (Math.random() - 0.5) * 0.3;
      pts.push([x, h / 2 + y * env * h * 0.36 * Math.sin(Math.PI * u)]);
    }
    return pts;
  };

  let raf;
  const loop = () => {
    cancelAnimationFrame(raf);
    const frame = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      let pts;
      if (!useSynthetic && analyser) {
        analyser.getByteTimeDomainData(data);
        let flat = true;
        for (let i = 0; i < data.length; i += 16) if (data[i] !== 128) { flat = false; break; }
        if (!flat) heardSignal = true;
        silentFrames = flat ? silentFrames + 1 : 0;
        // Opened from file:// the analyser only ever returns silence; fall back to a synthetic trace.
        // Once real signal has been seen, pauses in speech are left alone.
        if (!heardSignal && silentFrames > 90 && audio.currentTime > 2) useSynthetic = true;
        const step = data.length / w;
        pts = [];
        for (let x = 0; x < w; x += 2) {
          const v = (data[Math.floor(x * step)] - 128) / 128;
          pts.push([x, h / 2 + Math.max(-0.46, Math.min(0.46, v * 2.6)) * h]);
        }
      } else {
        pts = synthetic(w, h);
      }
      const dpr = devicePixelRatio || 1;
      stroke(pts, '#2A8A88', 0.35, 10 * dpr, 24);
      stroke(pts, '#D9559F', 1, 2.2 * dpr, 10);
      if (!audio.paused && !reduced) raf = requestAnimationFrame(frame);
      else if (audio.paused) drawIdle();
    };
    frame();
  };

  addEventListener('resize', resize);
  resize();
})();
