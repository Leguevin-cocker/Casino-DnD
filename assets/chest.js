/* Dessins pixel-art des coffres et des icônes d'objets (SVG générés). */
(function () {
  const SKINS = {
    wood:     { dark: '#4a2a12', mid: '#8a5a2b', light: '#b9803f', band: '#6d6f78', bandL: '#a9adb8', lock: '#ffd34d', glow: '#ffe9a0' },
    iron:     { dark: '#2b2f38', mid: '#555c6b', light: '#848c9c', band: '#2a2a2a', bandL: '#6a6a6a', lock: '#d9dee8', glow: '#cfe3ff' },
    gold:     { dark: '#7a4b06', mid: '#d79a17', light: '#ffd34d', band: '#8a1d1d', bandL: '#d24a4a', lock: '#fff2b0', glow: '#fff2a0' },
    crimson:  { dark: '#4a0c16', mid: '#8f1c2c', light: '#c8384a', band: '#c99a2e', bandL: '#ffd76a', lock: '#ffd76a', glow: '#ffb0b8' },
    arcane:   { dark: '#24124a', mid: '#4b2a8f', light: '#7b55d6', band: '#2fd6d0', bandL: '#a6fff9', lock: '#a6fff9', glow: '#d9b8ff' },
    emerald:  { dark: '#0d3b24', mid: '#1c7a45', light: '#3dbb6c', band: '#c9a227', bandL: '#ffe07a', lock: '#ffe07a', glow: '#b8ffd0' },
    ice:      { dark: '#1e4a6b', mid: '#4f97c4', light: '#a9dcf5', band: '#e8f6ff', bandL: '#ffffff', lock: '#ffffff', glow: '#e6f7ff' },
    obsidian: { dark: '#08070c', mid: '#1d1a26', light: '#3a3448', band: '#ff4a1c', bandL: '#ffb36b', lock: '#ff7a3a', glow: '#ff9a5a' },
  };
  const O = '#140b14';

  function rect(x, y, w, h, c) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`; }

  function chestSvg(skin, opts = {}) {
    const p = SKINS[skin] || SKINS.wood;
    const lid = [
      rect(2, 3, 28, 1, O), rect(1, 4, 1, 9, O), rect(30, 4, 1, 9, O),
      rect(2, 4, 28, 9, p.mid), rect(3, 4, 26, 2, p.light), rect(2, 11, 28, 2, p.dark),
      rect(5, 3, 3, 10, p.band), rect(5, 4, 1, 8, p.bandL),
      rect(24, 3, 3, 10, p.band), rect(24, 4, 1, 8, p.bandL),
      rect(13, 9, 6, 4, O), rect(14, 9, 4, 4, p.lock),
    ].join('');
    const body = [
      rect(1, 13, 1, 15, O), rect(30, 13, 1, 15, O), rect(2, 28, 28, 1, O),
      rect(2, 13, 28, 15, p.mid), rect(2, 13, 28, 1, p.light),
      rect(2, 18, 28, 1, p.dark), rect(2, 23, 28, 1, p.dark), rect(2, 26, 28, 2, p.dark),
      rect(5, 13, 3, 15, p.band), rect(5, 13, 1, 15, p.bandL),
      rect(24, 13, 3, 15, p.band), rect(24, 13, 1, 15, p.bandL),
      rect(13, 13, 6, 6, O), rect(14, 13, 4, 5, p.lock), rect(15, 15, 2, 2, O),
      rect(2, 28, 3, 2, O), rect(27, 28, 3, 2, O),
    ].join('');
    const inside = rect(3, 11, 26, 3, p.glow);
    return `<svg class="chest-svg${opts.open ? ' is-open' : ''}" viewBox="0 -14 32 44" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <g class="chest-inside">${inside}</g>
      <g class="chest-body">${body}</g>
      <g class="chest-lid">${lid}</g>
    </svg>`;
  }

  /* --- Icônes 12x12 --- */
  const ICONS = {
    weapon: [
      '..........oo', '.........owo', '........owgo', '.......owgo.', '......owgo..', '.o...owgo...',
      '.ro.owgo....', '..ryogo.....', '...yro......', '..obory.....', '.obo..ro....', 'oo..........'],
    armor: [
      '.oooooooooo.', 'oggggrrggggo', 'ogwggrrggggo', 'ogwggrrggggo', 'orrrrrrrrrro', 'orrrrrrrrrro',
      '.oggggrrggo.', '.oggggrrggo.', '..oggrrggo..', '...ogrrgo...', '....orro....', '.....oo.....'],
    potion: [
      '....oooo....', '....obbo....', '.....oo.....', '....owwo....', '...orrrro...', '..orwrrrro..',
      '..orwrrrro..', '..orrrrrro..', '..orrrrrro..', '...orrrro...', '....oooo....', '............'],
    ring: [
      '....orro....', '...orwwro...', '....oooo....', '..oyyyyyyo..', '.oyo....oyo.', '.oy......yo.',
      '.oy......yo.', '.oyo....oyo.', '..oyyyyyyo..', '...oooooo...', '............', '............'],
    wand: [
      '.........rw.', '........orrw', '.......obor.', '......obo...', '.....obo....', '....obo.....',
      '...obo......', '..obo.......', '.obo........', '.oo.........', '............', '............'],
    staff: [
      '........ooo.', '.......orwro', '.......orrro', '........obo.', '.......obo..', '......obo...',
      '.....obo....', '....obo.....', '...obo......', '..obo.......', '.obo........', '.oo.........'],
    rod: [
      '.........oo.', '........oyyo', '........oyro', '........oyyo', '.......obo..', '......obo...',
      '.....oyo....', '....obo.....', '...obo......', '..obo.......', '.oyo........', '.oo.........'],
    scroll: [
      '............', '.oooooooooo.', 'oyyyyyyyyyyo', '.owwwwwwwwo.', '.owgggggwwo.', '.owwwwwwwwo.',
      '.owggggggwo.', '.owwwwwwwwo.', '.owgggwwwwo.', 'oyyyyyyyyyyo', '.oooooooooo.', '....orro....'],
    ammunition: [
      '........oooo', '.........owo', '........obwo', '.......obo.o', '......obo...', '.....obo....',
      '....obo.....', '.r.obo......', '.rrbo.......', '..rr........', '.r.r........', '............'],
    wondrous: [
      '...oooooo...', '..o......o..', '.o........o.', '..o......o..', '...oooooo...', '...oyyyyo...',
      '..oyrrrryo..', '.oyrwrrrryo.', '.oyrrrrrryo.', '..oyrrrryo..', '...oyyyyo...', '....oooo....'],
    gold: [
      '............', '............', '...oooo.....', '..oywyyo....', '..oyyyyooo..', '..oyyyoywyo.',
      '...ooooyyyo.', '..oooooyyyo.', '.oyyyyoooo..', '.oywyyyyo...', '.oyyyyyyo...', '..oooooo....'],
  };
  ICONS.other = ICONS.wondrous;
  const RARITY_COLORS = {
    common: '#c9c9c9', uncommon: '#3fd16b', rare: '#3fa1ff', very_rare: '#b660ff', legendary: '#ff9a1f', artifact: '#ff3b3b',
  };
  const RARITY_LABELS = {
    common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', very_rare: 'Très rare', legendary: 'Légendaire', artifact: 'Artefact',
  };
  const TYPE_LABELS = {
    weapon: 'Arme', armor: 'Armure', potion: 'Potion', ring: 'Anneau', wand: 'Baguette', staff: 'Bâton', rod: 'Sceptre',
    scroll: 'Parchemin', ammunition: 'Munitions', wondrous: 'Objet merveilleux', gold: 'Trésor', other: 'Divers',
  };

  function iconSvg(type, rarity) {
    const map = ICONS[type] || ICONS.wondrous;
    const pal = { o: O, w: '#f4f1e8', g: '#9aa3ad', b: '#8a5228', y: '#ffcc33', r: RARITY_COLORS[rarity] || '#c9c9c9' };
    let out = '';
    map.forEach((row, y) => {
      for (let x = 0; x < 12; x++) {
        const c = pal[row[x]];
        if (c) out += rect(x, y, 1, 1, c);
      }
    });
    return `<svg class="item-svg" viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function itemVisual(item) {
    if (item && item.image) return `<img class="item-img" src="${esc(item.image)}" alt="">`;
    return iconSvg(item?.type, item?.rarity);
  }

  function chestVisual(chest, open) {
    if (chest.image) return `<img class="chest-img${open ? ' is-open' : ''}" src="${esc(chest.image)}" alt="">`;
    return chestSvg(chest.skin, { open });
  }

  /* Fiche d'objet (survol) */
  function tooltipHtml(item) {
    const col = RARITY_COLORS[item.rarity] || '#ccc';
    const desc = esc(item.description || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    const stats = (item.stats || '').split('\n').filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join('');
    return `<div class="tt-head" style="--rc:${col}">
        <div class="tt-icon">${itemVisual(item)}</div>
        <div><div class="tt-name">${esc(item.name)}</div>
        <div class="tt-sub">${esc(TYPE_LABELS[item.type] || '')} · <span style="color:${col}">${esc(RARITY_LABELS[item.rarity] || '')}</span>${item.attunement ? ' · <em>harmonisation</em>' : ''}</div></div>
      </div>
      ${stats ? `<ul class="tt-stats">${stats}</ul>` : ''}
      ${desc ? `<div class="tt-desc"><p>${desc}</p></div>` : ''}`;
  }

  window.ChestArt = { svg: chestSvg, visual: chestVisual, skins: SKINS };
  window.ItemArt = { svg: iconSvg, visual: itemVisual, tooltip: tooltipHtml, colors: RARITY_COLORS, labels: RARITY_LABELS, types: TYPE_LABELS, esc };
})();
