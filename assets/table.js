/* Vue de la table : choix des coffres, synchronisation, ouverture. */
(function () {
  const { api, toast, Sound } = App;
  const esc = ItemArt.esc;
  const grid = document.getElementById('grid');
  const state = { sid: 0, version: '', data: null, opened: new Set(), first: true, busy: false, revealing: new Set() };
  let chosenSid = 0;
  try { chosenSid = +sessionStorage.getItem('loot-sid') || 0; } catch (e) {}
  const urlSid = +new URLSearchParams(location.search).get('sid');
  if (urlSid) { chosenSid = urlSid; try { sessionStorage.setItem('loot-sid', urlSid); } catch (e) {} }

  const STATUS_TEXT = {
    lobby: (me) => me.gm ? 'Les joueurs choisissent leur coffre. Clique sur « Autoriser l\'ouverture » quand tout le monde est placé.'
      : 'Choisis ton coffre ! Un seul coffre par joueur.',
    open: (me) => me.gm ? 'Les joueurs peuvent ouvrir leur coffre. Tu peux ouvrir toi-même les coffres libres.'
      : 'Le MJ a donné le signal : ouvre ton coffre !',
    closed: () => 'Session terminée.',
  };

  /* ---------- Synchronisation ---------- */
  async function poll() {
    try {
      const q = `&sid=${chosenSid || ''}&v=${encodeURIComponent(state.version)}`;
      const d = await api('state', undefined, { query: q });
      if (!d.same) apply(d);
    } catch (e) {
      if (/introuvable/.test(e.message)) { chosenSid = 0; state.version = ''; try { sessionStorage.removeItem('loot-sid'); } catch (err) {} }
      console.warn(e);
    }
    setTimeout(poll, document.hidden ? 5000 : window.APP.poll);
  }
  async function refresh() {
    state.version = '';
    try { apply(await api('state', undefined, { query: `&sid=${chosenSid || ''}` })); } catch (e) { toast(e.message, 'err'); }
  }

  function apply(d) {
    // La session choisie n'est plus active : on revient à la plus récente
    if (chosenSid && !d.session) { chosenSid = 0; state.version = ''; return; }
    state.data = d;
    state.version = d.version;
    renderPicker(d);
    const empty = document.getElementById('empty');
    const gmc = document.getElementById('gm-controls');
    if (!d.session || d.session.status === 'closed' && !d.me.gm) {
      document.getElementById('session-name').textContent = 'En attente du MJ…';
      document.getElementById('session-status').textContent = '';
      grid.innerHTML = '';
      empty.hidden = false;
      if (!empty.dataset.drawn) { empty.querySelector('.empty-chest').innerHTML = ChestArt.svg('wood'); empty.dataset.drawn = 1; }
      if (gmc) gmc.hidden = true;
      return;
    }
    empty.hidden = true;
    const s = d.session;
    if (state.sid !== s.id) { state.sid = s.id; state.opened.clear(); state.first = true; }
    document.getElementById('session-name').textContent = s.name;
    const banner = document.getElementById('session-status');
    banner.textContent = STATUS_TEXT[s.status](d.me);
    banner.dataset.status = s.status;
    if (gmc) {
      gmc.hidden = false;
      gmc.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('active', b.dataset.status === s.status));
    }
    // Coffres ouverts par d'autres depuis le dernier passage : petite animation de suspense
    for (const c of d.chests) {
      if (c.opened && !state.opened.has(c.id)) {
        state.opened.add(c.id);
        if (!state.first && !state.selfOpening?.has(c.id)) {
          state.revealing.add(c.id);
          setTimeout(() => { state.revealing.delete(c.id); render(); }, 2200);
        }
      }
      if (!c.opened) state.opened.delete(c.id);
    }
    state.first = false;
    render();
  }

  function renderPicker(d) {
    const el = document.getElementById('session-picker');
    if (!d.active || d.active.length < 2) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<span>Sessions :</span>' + d.active.map((s) =>
      `<button class="chip ${d.session && d.session.id == s.id ? 'on' : ''}" data-sid="${s.id}">${esc(s.name)}</button>`).join('');
  }

  /* ---------- Rendu ---------- */
  function render() {
    const d = state.data;
    if (!d || !d.session) return;
    const s = d.session, me = d.me;
    const hasMine = d.chests.some((c) => c.mine);
    grid.innerHTML = '';
    for (const c of d.chests) {
      const revealing = state.revealing.has(c.id);
      const showItem = c.opened && c.item && !revealing;
      const el = document.createElement('article');
      el.className = 'slot' + (c.mine ? ' mine' : '') + (c.player ? ' taken' : '') + (showItem ? ' opened' : '') + (revealing ? ' revealing' : '');
      if (showItem) el.style.setProperty('--rc', ItemArt.colors[c.item.rarity]);
      let actions = '';
      if (s.status === 'lobby') {
        if (c.mine) actions += `<button class="btn btn-ghost" data-act="unclaim">Libérer</button>`;
        else if (!c.player && !me.gm) actions += `<button class="btn ${hasMine ? '' : 'btn-gold'}" data-act="claim">${hasMine ? 'Changer pour celui-ci' : 'Prendre ce coffre'}</button>`;
      }
      if (s.status === 'open' && !c.opened && (c.mine || me.gm)) {
        actions += `<button class="btn btn-gold pulse" data-act="open">${c.mine ? 'Ouvrir !' : 'Ouvrir (MJ)'}</button>`;
      }
      if (me.gm && c.player && !c.opened) actions += `<button class="btn btn-ghost btn-sm" data-act="kick" title="Libérer la place">Éjecter</button>`;
      if (me.gm && c.opened) actions += `<button class="btn btn-ghost btn-sm" data-act="reset" title="Remettre le coffre fermé">Refermer</button>`;
      el.innerHTML = `
        ${showItem ? `<div class="slot-item" data-tt>${ItemArt.visual(c.item)}</div>` : ''}
        <div class="slot-art ${revealing ? 'shake' : ''}">${ChestArt.visual(c, showItem)}</div>
        <div class="slot-name">${esc(c.name)}</div>
        ${showItem ? `<div class="slot-loot" data-tt>${esc(c.item.name)}</div>` : ''}
        <div class="slot-player">${c.player ? esc(c.player) + (c.mine ? ' <em>(toi)</em>' : '') : '<span class="muted">Libre</span>'}</div>
        <div class="slot-actions">${actions}</div>`;
      el.querySelectorAll('[data-tt]').forEach((n) => { n._item = c.item; });
      el.dataset.id = c.id;
      grid.appendChild(el);
    }
  }

  /* ---------- Actions ---------- */
  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || state.busy) return;
    const id = +btn.closest('.slot').dataset.id;
    const act = btn.dataset.act;
    Sound.unlock();
    try {
      state.busy = true;
      if (act === 'claim') { await api('claim', { chest_id: id }); Sound.tick(6); }
      if (act === 'unclaim') await api('unclaim', { chest_id: id });
      if (act === 'kick') await api('chest_kick', { chest_id: id });
      if (act === 'reset') { if (!confirm('Refermer ce coffre ? L\'objet tiré sera perdu et il pourra être rouvert.')) return; await api('chest_reset', { chest_id: id }); }
      if (act === 'open') {
        const chest = state.data.chests.find((c) => c.id === id);
        btn.disabled = true;
        state.selfOpening = state.selfOpening || new Set();
        state.selfOpening.add(id);
        const res = await api('open', { chest_id: id });
        state.opened.add(id);
        await Loot.play({ chest, item: res.item, pool: res.pool });
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      state.busy = false;
      refresh();
    }
  });

  const gmc = document.getElementById('gm-controls');
  if (gmc) gmc.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-status]');
    if (!b || !state.data?.session) return;
    if (b.dataset.status === 'closed' && !confirm('Clôturer cette session ? Elle disparaîtra de la table des joueurs.')) return;
    try { await api('session_status', { sid: state.data.session.id, status: b.dataset.status }); refresh(); }
    catch (err) { toast(err.message, 'err'); }
  });

  document.getElementById('session-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sid]');
    if (!b) return;
    chosenSid = +b.dataset.sid;
    try { sessionStorage.setItem('loot-sid', chosenSid); } catch (err) {}
    refresh();
  });

  const mute = document.getElementById('mute');
  const paintMute = () => { mute.textContent = Sound.muted ? '🔇' : '🔊'; };
  mute.addEventListener('click', () => { Sound.toggle(); paintMute(); });
  paintMute();

  App.initTooltip();
  poll();
})();
