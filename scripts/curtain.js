/**
 * Casino DnD — rideau de théâtre et décor de scène en pixel art, générés à la volée
 * (petits canvas agrandis en « pixelated », donc nets à toutes les tailles).
 */

const REDS = ["#2a040a", "#4a0912", "#6b0f1b", "#8f1626", "#b51f31", "#d9343f", "#ef5a5c"];
const GOLD = ["#7a4a06", "#c07a10", "#f2b134", "#ffe08a"];

const cache = {};

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Teinte d'un pli : vagues verticales + lumière douce au centre. */
function foldShade(x, y, w, h, period, light = 0.5) {
  const phase = (x % period) / period;
  const fold = Math.sin(phase * Math.PI * 2);
  const center = 1 - Math.min(1, Math.abs(x - w / 2) / (w / 2));
  const v = 2.6 + fold * 2.1 + center * light * 1.6 - (y / h) * 0.6;
  return REDS[Math.max(0, Math.min(REDS.length - 1, Math.round(v)))];
}

/** Grand rideau fermé (plein écran). 160×90 « pixels ». */
export function curtainDataURL() {
  if (cache.curtain) return cache.curtain;
  const W = 160, H = 90, P = 11;
  const [c, ctx] = canvas(W, H);
  for (let x = 0; x < W; x++) {
    const hem = H - 5 - Math.round(2 * Math.abs(Math.sin((Math.PI * x) / P)));
    for (let y = 0; y < hem; y++) {
      ctx.fillStyle = foldShade(x, y, W, H, P, 0.7);
      ctx.fillRect(x, y, 1, 1);
    }
    // ourlet + frange dorée
    ctx.fillStyle = GOLD[1]; ctx.fillRect(x, hem, 1, 1);
    ctx.fillStyle = GOLD[2]; ctx.fillRect(x, hem + 1, 1, 1);
    if (x % 2 === 0) { ctx.fillStyle = GOLD[1]; ctx.fillRect(x, hem + 2, 1, 2); }
  }
  // lambrequin du haut : festons
  const SW = 32;
  for (let x = 0; x < W; x++) {
    const depth = 9 + Math.round(4 * Math.sin((Math.PI * (x % SW)) / SW));
    for (let y = 0; y < depth; y++) {
      const t = y / depth;
      ctx.fillStyle = REDS[Math.max(1, Math.min(6, Math.round(2 + Math.sin((Math.PI * (x % SW)) / SW) * 2.5 + t * 1.2)))];
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = GOLD[2]; ctx.fillRect(x, depth, 1, 1);
    ctx.fillStyle = GOLD[0]; ctx.fillRect(x, depth + 1, 1, 1);
  }
  // pompons dorés entre les festons
  for (let x = SW; x < W; x += SW) {
    ctx.fillStyle = GOLD[0]; ctx.fillRect(x - 1, 9, 3, 4);
    ctx.fillStyle = GOLD[2]; ctx.fillRect(x - 1, 9, 2, 3);
    ctx.fillStyle = GOLD[3]; ctx.fillRect(x - 1, 9, 1, 1);
  }
  return (cache.curtain = c.toDataURL());
}

/** Drapé latéral (gauche ; on retourne en CSS pour la droite). 40×90. */
export function sideDrapeDataURL() {
  if (cache.side) return cache.side;
  const W = 40, H = 90, P = 9;
  const [c, ctx] = canvas(W, H);
  const tieY = 52;
  for (let y = 0; y < H; y++) {
    // largeur : pleine en haut, pincée à l'embrasse, s'évase en bas
    let width;
    if (y < tieY) width = W - Math.round(((W - 13) * y) / tieY);
    else width = 13 + Math.round(((y - tieY) / (H - tieY)) * 14);
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = foldShade(x + 3, y, W, H, P, 0.2);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = REDS[0]; ctx.fillRect(width, y, 1, 1);
  }
  // embrasse dorée
  for (let x = 0; x < 15; x++) {
    ctx.fillStyle = GOLD[x % 3 === 0 ? 3 : 2]; ctx.fillRect(x, tieY - 1, 1, 2);
    ctx.fillStyle = GOLD[0]; ctx.fillRect(x, tieY + 1, 1, 1);
  }
  ctx.fillStyle = GOLD[2]; ctx.fillRect(13, tieY - 2, 3, 5);
  ctx.fillStyle = GOLD[3]; ctx.fillRect(13, tieY - 2, 1, 2);
  return (cache.side = c.toDataURL());
}

/** Lambrequin du haut de scène. 160×14. */
export function valanceDataURL() {
  if (cache.val) return cache.val;
  const W = 160, H = 16, SW = 40;
  const [c, ctx] = canvas(W, H);
  for (let x = 0; x < W; x++) {
    const depth = 8 + Math.round(5 * Math.sin((Math.PI * (x % SW)) / SW));
    for (let y = 0; y < depth; y++) {
      ctx.fillStyle = REDS[Math.max(1, Math.min(6, Math.round(1.5 + Math.sin((Math.PI * (x % SW)) / SW) * 3 + (y / depth))))];
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = GOLD[2]; ctx.fillRect(x, depth, 1, 1);
    if (x % 2 === 0) { ctx.fillStyle = GOLD[1]; ctx.fillRect(x, depth + 1, 1, 1); }
  }
  return (cache.val = c.toDataURL());
}

/** Plancher de scène. 160×20. */
export function floorDataURL() {
  if (cache.floor) return cache.floor;
  const W = 160, H = 20;
  const [c, ctx] = canvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const center = 1 - Math.min(1, Math.abs(x - W / 2) / (W / 2));
      const v = 2.2 + center * 2.2 - (y / H) * 1.6 + (y === 0 ? 1.5 : 0);
      ctx.fillStyle = REDS[Math.max(0, Math.min(6, Math.round(v)))];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = REDS[0];
  for (let x = 0; x < W; x++) ctx.fillRect(x, 4, 1, 1);
  return (cache.floor = c.toDataURL());
}
