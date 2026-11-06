/* Animation d'ouverture de coffre, façon Vampire Survivors. */
(function () {
  const TIER = { common: 0, uncommon: 1, rare: 2, very_rare: 3, legendary: 4, artifact: 5 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, root = document) => root.querySelector(s);

  /* ---------- Particules (pièces + étincelles) ---------- */
  function Fx(canvas) {
    const ctx = canvas.getContext('2d');
    let parts = [], running = false, emitRate = 0, origin = { x: 0, y: 0 }, color = '#fff', last = 0, acc = 0;
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(kind) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = kind === 'coin' ? 6 + Math.random() * 9 : 3 + Math.random() * 7;
      parts.push({
        kind, x: origin.x + (Math.random() - 0.5) * 60, y: origin.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: Math.random() * 6, vs: 0.15 + Math.random() * 0.25,
        life: 0, max: kind === 'coin' ? 160 : 70 + Math.random() * 40, size: kind === 'coin' ? 12 + Math.random() * 7 : 2 + Math.random() * 3,
      });
    }
    function burst(n) { for (let i = 0; i < n; i++) spawn(i % 3 ? 'coin' : 'spark'); }
    function frame(t) {
      if (!running) return;
      const dt = Math.min(3, (t - last) / 16.67 || 1); last = t;
      acc += emitRate * dt;
      while (acc >= 1) { spawn(Math.random() < 0.6 ? 'coin' : 'spark'); acc--; if (Math.random() < 0.15) App.Sound.coin(); }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 40);
      for (const p of parts) {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'coin' ? 0.32 : 0.08) * dt; p.spin += p.vs * dt;
        const fade = Math.max(0, 1 - p.life / p.max);
        if (p.kind === 'coin') {
          const w = Math.abs(Math.cos(p.spin)) * p.size + 1;
          ctx.fillStyle = '#7a4b06'; ctx.fillRect(p.x - w / 2 - 1, p.y - p.size / 2 - 1, w + 2, p.size + 2);
          ctx.fillStyle = '#ffcc33'; ctx.fillRect(p.x - w / 2, p.y - p.size / 2, w, p.size);
          ctx.fillStyle = '#fff6c2'; ctx.fillRect(p.x - w / 2, p.y - p.size / 2, Math.max(1, w / 3), p.size / 3);
        } else {
          ctx.globalAlpha = fade; ctx.fillStyle = Math.random() < 0.3 ? '#fff' : color;
          ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1;
        }
      }
      requestAnimationFrame(frame);
    }
    return {
      start(o, c, rate) { origin = o; color = c; emitRate = rate; resize(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
      rate(r) { emitRate = r; }, burst, color(c) { color = c; },
      stop() { running = false; parts = []; ctx.clearRect(0, 0, canvas.width, canvas.height); },
      resize,
    };
  }

  /* ---------- Rouleau d'objets ---------- */
  function buildStrip(strip, pool, item, tier) {
    const n = 26 + tier * 5;
    const list = [];
    const src = pool.length ? pool : [item];
    for (let i = 0; i < n; i++) list.push(src[Math.floor(Math.random() * src.length)]);
    // Un faux "presque" juste avant : un objet de rareté supérieure si possible
    const better = src.filter((p) => TIER[p.rarity] > TIER[item.rarity]);
    if (better.length) list[n - 1] = better[Math.floor(Math.random() * better.length)];
    list.push(item);
    list.push(src[Math.floor(Math.random() * src.length)], src[Math.floor(Math.random() * src.length)]);
    strip.innerHTML = list.map((it) =>
      `<div class="reel-slot" style="--rc:${ItemArt.colors[it.rarity]}">${ItemArt.visual(it)}</div>`).join('');
    return n; // index final
  }

  function runReel(strip, finalIdx, duration, isSkipped) {
    const H = strip.firstElementChild.offsetHeight || 100; // offsetHeight : insensible au scale de l'animation d'apparition
    const target = finalIdx * H - H; // la case du milieu de la fenêtre
    const start = performance.now();
    let lastIdx = -1;
    // easeOutQuint avec un petit rebond à la fin
    const ease = (t) => {
      if (t < 0.92) { const u = t / 0.92; return 1.012 * (1 - Math.pow(1 - u, 5)); }
      const u = (t - 0.92) / 0.08; return 1.012 - 0.012 * (1 - Math.pow(1 - u, 2));
    };
    return new Promise((resolve) => {
      function step(now) {
        let t = Math.min(1, (now - start) / duration);
        if (isSkipped()) t = 1;
        const y = ease(t) * target;
        strip.style.transform = `translateY(${-y}px)`;
        const idx = Math.floor((y + H * 1.5) / H);
        if (idx !== lastIdx) { lastIdx = idx; App.Sound.tick(idx); }
        if (t < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- Séquence complète ---------- */
  let fx = null;
  async function play({ chest, item, pool }) {
    const root = $('#loot');
    fx = fx || Fx($('#loot-fx'));
    const tier = TIER[item.rarity] ?? 0;
    const color = ItemArt.colors[item.rarity] || '#fff';
    const chestEl = $('.loot-chest', root), reel = $('.loot-reel', root), strip = $('.loot-strip', root);
    const result = $('.loot-result', root), flash = $('.loot-flash', root);
    let skipped = false;
    const onSkip = () => { skipped = true; };

    root.className = 'loot';
    // Rayons dorés pendant le suspense : la couleur de rareté n'apparaît qu'à la révélation
    root.style.setProperty('--rc', '#ffcc33');
    chestEl.innerHTML = ChestArt.visual(chest, false);
    reel.hidden = true; result.hidden = true; strip.style.transform = '';
    root.hidden = false;
    App.Sound.unlock();
    await sleep(30);
    root.classList.add('on');
    await sleep(450);

    // 1. Le coffre tremble de plus en plus
    chestEl.classList.add('shake');
    const shakeMs = 1100 + tier * 180;
    const rattle = setInterval(() => App.Sound.rattle(), 110);
    await sleep(shakeMs);
    clearInterval(rattle);
    chestEl.classList.remove('shake');

    // 2. Il s'ouvre : flash, rayons, pièces
    const svg = chestEl.querySelector('.chest-svg, .chest-img');
    if (svg) svg.classList.add('is-open');
    chestEl.classList.add('opened');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    root.classList.add('rays-on');
    App.Sound.pop();
    const r = chestEl.getBoundingClientRect();
    fx.start({ x: r.left + r.width / 2, y: r.top + r.height * 0.35 }, '#ffe9a0', 1.2);
    fx.burst(28);
    await sleep(350);

    // 3. Le rouleau défile
    reel.hidden = false;
    const finalIdx = buildStrip(strip, pool || [], item, tier);
    root.addEventListener('click', onSkip);
    await runReel(strip, finalIdx, 3200 + tier * 450, () => skipped);
    root.removeEventListener('click', onSkip);
    await sleep(skipped ? 50 : 250);

    // 4. Révélation
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    reel.hidden = true;
    const itemEl = $('.loot-item', result);
    itemEl.innerHTML = ItemArt.visual(item);
    itemEl._item = item;
    $('.loot-name', result).textContent = item.name;
    $('.loot-rarity', result).textContent = ItemArt.labels[item.rarity] || '';
    result.hidden = false;
    root.style.setProperty('--rc', color);
    root.classList.add('revealed', 'tier-' + tier);
    fx.color(color);
    if (tier >= 4) root.classList.add('epic');
    App.Sound.fanfare(tier);
    fx.burst(30 + tier * 20);
    fx.rate(0.25 + tier * 0.3);

    // 5. Attente de la fermeture
    await new Promise((resolve) => {
      const btn = $('.loot-close', root);
      const done = () => { btn.removeEventListener('click', done); document.removeEventListener('keydown', key); resolve(); };
      const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter') done(); };
      btn.addEventListener('click', done);
      document.addEventListener('keydown', key);
    });
    root.classList.remove('on');
    await sleep(300);
    fx.stop();
    root.hidden = true;
    root.className = 'loot';
    chestEl.className = 'loot-chest';
    document.getElementById('tooltip').hidden = true;
  }

  window.addEventListener('resize', () => fx && fx.resize());
  window.Loot = { play, TIER };
})();
