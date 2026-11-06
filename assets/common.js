/* Outils partagés : appels API, toasts, infobulles, sons. */
(function () {
  async function api(action, data, opts = {}) {
    const url = 'api.php?action=' + encodeURIComponent(action) + (opts.query || '');
    const init = { credentials: 'same-origin', headers: { 'X-CSRF': window.APP.csrf } };
    if (data instanceof FormData) {
      init.method = 'POST';
      init.body = data;
    } else if (data !== undefined) {
      init.method = 'POST';
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(data);
    }
    const res = await fetch(url, init);
    if (res.status === 401) { location.href = 'index.php'; throw new Error('Non connecté'); }
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('Réponse invalide du serveur.'); }
    if (!res.ok || json.error) throw new Error(json.error || 'Erreur ' + res.status);
    return json;
  }

  let toastTimer;
  function toast(msg, kind = '') {
    const el = document.getElementById('toast');
    if (!el) return alert(msg);
    el.textContent = msg;
    el.className = 'toast ' + kind;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  /* Infobulle : tout élément avec data-tt et une propriété ._item */
  function initTooltip() {
    const tt = document.getElementById('tooltip');
    if (!tt) return;
    let current = null;
    const place = (x, y) => {
      const r = tt.getBoundingClientRect();
      let left = x + 18, top = y + 18;
      if (left + r.width > innerWidth - 8) left = x - r.width - 18;
      if (left < 8) left = 8;
      if (top + r.height > innerHeight - 8) top = Math.max(8, innerHeight - r.height - 8);
      tt.style.transform = `translate(${left}px, ${top}px)`;
    };
    const show = (el, x, y) => {
      if (!el._item) return;
      current = el;
      tt.innerHTML = ItemArt.tooltip(el._item);
      tt.style.setProperty('--rc', ItemArt.colors[el._item.rarity] || '#ccc');
      tt.hidden = false;
      place(x, y);
    };
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tt]');
      if (el && el !== current && e.pointerType === 'mouse') show(el, e.clientX, e.clientY);
      if (!el && current) { current = null; tt.hidden = true; }
    });
    document.addEventListener('pointermove', (e) => { if (current && e.pointerType === 'mouse') place(e.clientX, e.clientY); });
    // Mobile : on touche pour afficher / masquer
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-tt]');
      if (el && el._item && current !== el) { show(el, e.clientX, e.clientY); return; }
      if (current && !tt.contains(e.target)) { current = null; tt.hidden = true; }
    });
  }

  /* Sons synthétisés (pas de fichiers audio à héberger) */
  const Sound = (function () {
    let ctx = null;
    let muted = false;
    try { muted = localStorage.getItem('loot-muted') === '1'; } catch (e) {}
    const ac = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function tone(freq, dur = 0.08, type = 'square', vol = 0.06, when = 0) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t = c.currentTime + when;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      get muted() { return muted; },
      toggle() { muted = !muted; try { localStorage.setItem('loot-muted', muted ? '1' : '0'); } catch (e) {} return muted; },
      unlock: ac,
      tick(i) { if (!Number.isFinite(i)) return; tone(330 + (i % 12) * 40, 0.05, 'square', 0.04); },
      rattle() { tone(90 + Math.random() * 40, 0.06, 'triangle', 0.08); },
      coin() { tone(1300 + Math.random() * 500, 0.07, 'square', 0.025); },
      pop() { tone(180, 0.15, 'sawtooth', 0.08); tone(520, 0.2, 'square', 0.05, 0.05); },
      fanfare(tier) {
        const base = [523, 659, 784, 1047, 1319, 1568];
        const n = 3 + tier;
        for (let i = 0; i < n; i++) tone(base[i % base.length] * (i >= 6 ? 2 : 1), 0.18, 'square', 0.05, i * 0.09);
        tone(base[0] / 2, 0.6 + tier * 0.1, 'triangle', 0.08, n * 0.09);
      },
    };
  })();

  window.App = { api, toast, initTooltip, Sound };
})();
