/* Admin du MJ : sessions, coffres + tables de loot, objets. */
(function () {
  const { api, toast } = App;
  const esc = ItemArt.esc;
  const view = document.getElementById('view');
  let D = null; // données admin
  const ui = { tab: 'sessions', chestId: null, itemId: null, q: '', fr: '', ft: '', sessRows: null };

  const rarOpts = (sel, any) => (any ? `<option value="">${any}</option>` : '') +
    Object.entries(D.rarities).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v[0]}</option>`).join('');
  const typeOpts = (sel, any) => (any ? `<option value="">${any}</option>` : '') +
    Object.entries(D.types).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  const rarTag = (r) => `<span class="rar" style="color:${D.rarities[r]?.[1]}">${D.rarities[r]?.[0] || r}</span>`;
  const itemById = (id) => D.items.find((i) => i.id === id);

  async function load() {
    D = await api('admin_data');
    if (ui.chestId === null && D.chests.length) ui.chestId = D.chests[0].id;
    render();
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    ({ sessions: renderSessions, chests: renderChests, items: renderItems })[ui.tab]();
  }

  /* ================= Sessions ================= */
  function renderSessions() {
    if (!ui.sessRows) ui.sessRows = D.chests.slice(0, 1).map((c) => ({ type_id: c.id, count: 4 }));
    const chestOpts = (sel) => D.chests.map((c) => `<option value="${c.id}" ${c.id == sel ? 'selected' : ''}>${esc(c.name)} (${c.loot.length} objets)</option>`).join('');
    const rows = ui.sessRows.map((r, i) => {
      const c = D.chests.find((x) => x.id == r.type_id) || D.chests[0];
      return `<div class="sess-chest-row" data-i="${i}">
        <div class="ico">${c ? ChestArt.visual(c) : ''}</div>
        <select data-k="type_id">${chestOpts(r.type_id)}</select>
        <input type="number" min="1" max="20" data-k="count" value="${r.count}" title="Nombre">
        <button class="btn btn-ghost btn-sm" data-act="row-del">✕</button></div>`;
    }).join('');
    const status = { lobby: 'Placement', open: 'Ouverture', closed: 'Terminée' };
    const sess = D.sessions.map((s) => `<div class="list-item" data-sid="${s.id}">
        <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${s.opened}/${s.n} coffres ouverts · ${esc(s.created_at)}</div></div>
        <span class="badge ${s.status}">${status[s.status]}</span>
        <a class="btn btn-sm" href="table.php?sid=${s.id}">Voir</a>
        ${s.status === 'closed' ? `<button class="btn btn-sm btn-ghost" data-act="reopen">Rouvrir</button>` : `<button class="btn btn-sm btn-ghost" data-act="close">Clôturer</button>`}
        <button class="btn btn-sm btn-ghost" data-act="sdel" title="Supprimer">🗑</button>
      </div>`).join('') || '<p class="muted">Aucune session pour l\'instant.</p>';
    view.innerHTML = `
      <div class="cols">
        <div>
          <h2>Nouvelle session</h2>
          ${D.chests.length ? `
          <label>Nom<input id="s-name" value="Butin du donjon" maxlength="80"></label>
          <p class="hint">Choisis les coffres posés sur la table. Les joueurs se placeront dessus (un joueur par coffre).</p>
          <div id="s-rows">${rows}</div>
          <div class="row" style="margin-top:10px">
            <button class="btn" data-act="row-add">+ Type de coffre</button>
            <button class="btn btn-gold" data-act="create">Lancer la session</button>
          </div>` : '<p>Crée d\'abord un type de coffre dans l\'onglet « Coffres & tables ».</p>'}
        </div>
        <div><h2>Sessions</h2><div class="list sess-list">${sess}</div></div>
      </div>`;
  }

  /* ================= Coffres ================= */
  function renderChests() {
    const c = D.chests.find((x) => x.id === ui.chestId);
    const list = D.chests.map((x) => `<div class="list-item ${x.id === ui.chestId ? 'on' : ''}" data-cid="${x.id}">
        <div class="ico">${ChestArt.visual(x)}</div>
        <div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${x.loot.length} objets</div></div></div>`).join('');
    view.innerHTML = `<div class="cols">
      <div>
        <div class="toolbar"><button class="btn btn-gold" data-act="chest-new">+ Nouveau coffre</button></div>
        <div class="list">${list || '<p class="muted">Aucun coffre.</p>'}</div>
      </div>
      <div id="chest-edit">${c || ui.chestId === 0 ? chestForm(c) : '<p class="muted">Sélectionne un coffre.</p>'}</div>
    </div>`;
  }

  function chestForm(c) {
    c = c || { id: 0, name: '', skin: 'wood', description: '', image: null, loot: [] };
    const skins = Object.entries(D.skins).map(([k, v]) =>
      `<button type="button" data-skin="${k}" class="${k === c.skin ? 'on' : ''}">${ChestArt.svg(k)}${v}</button>`).join('');
    const total = c.loot.reduce((s, l) => s + l.weight, 0) || 1;
    const loot = c.loot.map((l) => ({ ...l, it: itemById(l.item_id) })).filter((l) => l.it)
      .sort((a, b) => b.weight - a.weight || a.it.name.localeCompare(b.it.name));
    // Résumé des chances par rareté
    const byRar = {};
    loot.forEach((l) => { byRar[l.it.rarity] = (byRar[l.it.rarity] || 0) + l.weight; });
    const summary = Object.keys(D.rarities).filter((r) => byRar[r])
      .map((r) => `${rarTag(r)} <span class="chance">${(100 * byRar[r] / total).toFixed(1)} %</span>`).join(' · ');
    return `
      <form id="chest-form">
        <input type="hidden" name="id" value="${c.id}">
        <input type="hidden" name="skin" value="${c.skin}">
        <div class="row"><label>Nom<input name="name" value="${esc(c.name)}" required maxlength="80"></label></div>
        <label>Description<input name="description" value="${esc(c.description)}" maxlength="500"></label>
        <label>Apparence</label>
        <div class="skin-pick">${skins}</div>
        <label>Ou une image perso (remplace l'apparence) <input type="file" name="image" accept="image/*"></label>
        ${c.image ? `<img class="preview-img" src="${esc(c.image)}"><label><input type="checkbox" name="remove_image" value="1"> Retirer l'image</label>` : ''}
        <div class="row">
          <button class="btn btn-gold" type="submit">${c.id ? 'Enregistrer' : 'Créer le coffre'}</button>
          ${c.id ? '<button class="btn btn-danger" type="button" data-act="chest-del">Supprimer</button>' : ''}
        </div>
      </form>
      ${c.id ? `
      <hr style="border-color:var(--line);margin:22px 0">
      <h2>Table de loot</h2>
      <p class="hint">Le poids détermine la probabilité : un objet de poids 20 sort deux fois plus souvent qu'un objet de poids 10.</p>
      <div class="toolbar">
        <select id="bulk-rar">${rarOpts('', 'Toutes raretés')}</select>
        <select id="bulk-type">${typeOpts('', 'Tous types')}</select>
        <input id="bulk-w" type="number" min="1" value="10" title="Poids" style="max-width:90px">
        <button class="btn" data-act="bulk">Ajouter tout ce filtre</button>
      </div>
      <div class="toolbar">
        <input id="add-item" list="items-dl" placeholder="Ajouter un objet précis…">
        <datalist id="items-dl">${D.items.map((i) => `<option value="${esc(i.name)}">`).join('')}</datalist>
        <input id="add-w" type="number" min="1" value="10" style="max-width:90px">
        <button class="btn" data-act="add-one">Ajouter</button>
        ${loot.length ? '<button class="btn btn-ghost" data-act="clear">Vider la table</button>' : ''}
      </div>
      ${summary ? `<p>${summary}</p>` : ''}
      ${loot.length ? `<table class="loot-table"><thead><tr><th></th><th>Objet</th><th>Rareté</th><th>Poids</th><th>Chance</th><th></th></tr></thead><tbody>
        ${loot.map((l) => `<tr data-iid="${l.it.id}">
          <td class="ico" data-tt>${ItemArt.visual(l.it)}</td><td data-tt>${esc(l.it.name)}</td><td>${rarTag(l.it.rarity)}</td>
          <td><input type="number" min="0" value="${l.weight}" data-act="weight"></td>
          <td class="chance">${(100 * l.weight / total).toFixed(2)} %</td>
          <td><button class="btn btn-ghost btn-sm" data-act="rm">✕</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">Table vide : ce coffre ne peut rien donner pour l\'instant.</p>'}` : ''}`;
  }

  /* ================= Objets ================= */
  function renderItems() {
    const q = ui.q.toLowerCase();
    const items = D.items.filter((i) => (!q || i.name.toLowerCase().includes(q)) && (!ui.fr || i.rarity === ui.fr) && (!ui.ft || i.type === ui.ft));
    const it = ui.itemId === 0 ? null : itemById(ui.itemId);
    view.innerHTML = `<div class="cols">
      <div>
        <div class="toolbar">
          <input id="f-q" placeholder="Rechercher…" value="${esc(ui.q)}">
          <button class="btn btn-gold" data-act="item-new">+ Nouveau</button>
        </div>
        <div class="toolbar">
          <select id="f-r">${rarOpts(ui.fr, 'Toutes raretés')}</select>
          <select id="f-t">${typeOpts(ui.ft, 'Tous types')}</select>
        </div>
        <p class="hint">${items.length} objet(s)</p>
        <div class="list" id="item-list">${items.slice(0, 400).map((i) => `<div class="list-item ${i.id === ui.itemId ? 'on' : ''}" data-iid="${i.id}">
          <div class="ico">${ItemArt.visual(i)}</div>
          <div class="grow"><div class="t">${esc(i.name)}</div><div class="s">${esc(D.types[i.type] || '')} · ${rarTag(i.rarity)}</div></div></div>`).join('')}</div>
      </div>
      <div>${it || ui.itemId === 0 ? itemForm(it) : '<p class="muted">Sélectionne un objet ou crée-en un.</p>'}</div>
    </div>`;
  }

  function itemForm(it) {
    it = it || { id: 0, name: '', type: 'weapon', rarity: 'common', attunement: 0, stats: '', description: '', image: null, source: '' };
    const inChests = D.chests.filter((c) => c.loot.some((l) => l.item_id === it.id)).map((c) => esc(c.name)).join(', ');
    return `<form id="item-form">
      <input type="hidden" name="id" value="${it.id}">
      <div class="row" style="align-items:center">
        <div style="flex:0 0 80px;height:80px" data-tt id="item-preview">${ItemArt.visual(it)}</div>
        <label>Nom<input name="name" value="${esc(it.name)}" required maxlength="120"></label>
      </div>
      <div class="row">
        <label>Type<select name="type">${typeOpts(it.type)}</select></label>
        <label>Rareté<select name="rarity">${rarOpts(it.rarity)}</select></label>
        <label style="flex:0 0 auto"><input type="checkbox" name="attunement" value="1" ${it.attunement ? 'checked' : ''}> Harmonisation</label>
      </div>
      <label>Caractéristiques (une par ligne, ex : « Dégâts : 1d8 + 1 tranchant »)<textarea name="stats" rows="4">${esc(it.stats)}</textarea></label>
      <label>Description<textarea name="description" rows="8">${esc(it.description)}</textarea></label>
      <label>Image (sinon une icône est dessinée selon le type)<input type="file" name="image" accept="image/*"></label>
      ${it.image ? `<label><input type="checkbox" name="remove_image" value="1"> Retirer l'image</label>` : ''}
      <p class="hint">${it.source ? 'Source : ' + esc(it.source) + '. ' : ''}${inChests ? 'Présent dans : ' + inChests : 'Dans aucun coffre.'}</p>
      <div class="row">
        <button class="btn btn-gold" type="submit">${it.id ? 'Enregistrer' : 'Créer l\'objet'}</button>
        ${it.id ? '<button class="btn btn-danger" type="button" data-act="item-del">Supprimer</button>' : ''}
      </div>
    </form>`;
  }

  /* ================= Événements ================= */
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    ui.tab = b.dataset.tab;
    history.replaceState(null, '', '#' + ui.tab);
    render();
  });

  const run = async (fn, msg) => {
    try { await fn(); if (msg) toast(msg); await load(); } catch (err) { toast(err.message, 'err'); }
  };

  view.addEventListener('click', async (e) => {
    const t = e.target;
    const skinBtn = t.closest('[data-skin]');
    if (skinBtn) {
      const f = document.getElementById('chest-form');
      f.skin.value = skinBtn.dataset.skin;
      f.querySelectorAll('[data-skin]').forEach((b) => b.classList.toggle('on', b === skinBtn));
      return;
    }
    const cRow = t.closest('[data-cid]');
    if (cRow) { ui.chestId = +cRow.dataset.cid; return render(); }
    const iRow = t.closest('#item-list [data-iid]');
    if (iRow) { ui.itemId = +iRow.dataset.iid; return render(); }

    const act = t.closest('[data-act]')?.dataset.act;
    if (!act || act === 'weight') return;
    const sid = +t.closest('[data-sid]')?.dataset.sid;
    const c = D.chests.find((x) => x.id === ui.chestId);
    switch (act) {
      case 'row-add': ui.sessRows.push({ type_id: D.chests[0].id, count: 1 }); return render();
      case 'row-del': ui.sessRows.splice(+t.closest('[data-i]').dataset.i, 1); return render();
      case 'create': {
        const rows = ui.sessRows.filter((r) => r.count > 0);
        try {
          const r = await api('session_create', { name: document.getElementById('s-name').value, chests: rows });
          location.href = 'table.php?sid=' + r.sid;
        } catch (err) { toast(err.message, 'err'); }
        return;
      }
      case 'close': return run(() => api('session_status', { sid, status: 'closed' }));
      case 'reopen': return run(() => api('session_status', { sid, status: 'lobby' }));
      case 'sdel': if (confirm('Supprimer définitivement cette session et ses résultats ?')) run(() => api('session_delete', { sid })); return;
      case 'chest-new': ui.chestId = 0; return render();
      case 'chest-del':
        if (confirm(`Supprimer le coffre « ${c.name} » et sa table de loot ?`)) { const id = c.id; ui.chestId = null; run(() => api('chest_delete', { id })); }
        return;
      case 'bulk': return run(async () => {
        const r = await api('loot_bulk', { chest_type_id: c.id, rarity: document.getElementById('bulk-rar').value, type: document.getElementById('bulk-type').value, weight: +document.getElementById('bulk-w').value });
        toast(r.count + ' objet(s) ajouté(s)');
      });
      case 'add-one': {
        const name = document.getElementById('add-item').value.trim().toLowerCase();
        const it = D.items.find((i) => i.name.toLowerCase() === name);
        if (!it) return toast('Objet introuvable : choisis-le dans la liste.', 'err');
        return run(() => api('loot_set', { chest_type_id: c.id, item_id: it.id, weight: +document.getElementById('add-w').value || 10 }), 'Ajouté');
      }
      case 'rm': return run(() => api('loot_set', { chest_type_id: c.id, item_id: +t.closest('[data-iid]').dataset.iid, weight: 0 }));
      case 'clear': if (confirm('Vider toute la table de loot de ce coffre ?')) run(() => api('loot_clear', { chest_type_id: c.id })); return;
      case 'item-new': ui.itemId = 0; return render();
      case 'item-del': {
        const it = itemById(ui.itemId);
        if (confirm(`Supprimer « ${it.name} » ? Il sera retiré de toutes les tables.`)) { ui.itemId = null; run(() => api('item_delete', { id: it.id })); }
        return;
      }
    }
  });

  view.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.act === 'weight') {
      const c = D.chests.find((x) => x.id === ui.chestId);
      return run(() => api('loot_set', { chest_type_id: c.id, item_id: +t.closest('[data-iid]').dataset.iid, weight: +t.value }));
    }
    const row = t.closest('.sess-chest-row');
    if (row) { ui.sessRows[+row.dataset.i][t.dataset.k] = +t.value; if (t.dataset.k === 'type_id') render(); return; }
    if (t.id === 'f-r') { ui.fr = t.value; renderItems(); }
    if (t.id === 'f-t') { ui.ft = t.value; renderItems(); }
  });

  view.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') {
      ui.q = e.target.value;
      const pos = e.target.selectionStart;
      renderItems();
      const q = document.getElementById('f-q'); q.focus(); q.setSelectionRange(pos, pos);
    }
  });

  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    const action = f.id === 'chest-form' ? 'chest_save' : 'item_save';
    try {
      const r = await api(action, fd);
      if (action === 'chest_save') ui.chestId = r.id; else ui.itemId = r.id;
      toast('Enregistré');
      await load();
    } catch (err) { toast(err.message, 'err'); }
  });

  // Aperçu au survol dans l'admin
  view.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-tt]');
    if (!el || el._item) return;
    const id = +(el.closest('[data-iid]')?.dataset.iid || ui.itemId);
    el._item = itemById(id);
  }, true);

  const h = location.hash.slice(1);
  if (['sessions', 'chests', 'items'].includes(h)) ui.tab = h;
  App.initTooltip();
  load().catch((err) => { view.textContent = err.message; });
})();
