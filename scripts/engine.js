/**
 * Casino DnD — moteur de tirage.
 * Aucune dépendance à Foundry : ce fichier tourne aussi dans la démo navigateur.
 */

export const RARITIES = [
  { key: "common",    label: "Commun",     color: "#a7b0bb" },
  { key: "uncommon",  label: "Peu commun", color: "#3ccf6e" },
  { key: "rare",      label: "Rare",       color: "#3d8bff" },
  { key: "veryRare",  label: "Très rare",  color: "#b25cff" },
  { key: "legendary", label: "Légendaire", color: "#ffb31a" },
  { key: "artifact",  label: "Artefact",   color: "#ff3b3b" }
];
export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.key, i]));
export const DEFAULT_WEIGHTS = { common: 60, uncommon: 25, rare: 10, veryRare: 4, legendary: 1, artifact: 0 };

export const TYPE_INFO = {
  weapon:   { label: "Arme",           icon: "⚔️" },
  armor:    { label: "Armure",         icon: "🛡️" },
  potion:   { label: "Potion",         icon: "🧪" },
  scroll:   { label: "Parchemin",      icon: "📜" },
  ring:     { label: "Anneau",         icon: "💍" },
  wand:     { label: "Baguette",       icon: "🪄" },
  staff:    { label: "Bâton",          icon: "🦯" },
  wondrous: { label: "Objet merveilleux", icon: "✨" },
  treasure: { label: "Trésor",         icon: "💰" },
  gem:      { label: "Gemme",          icon: "💎" },
  gear:     { label: "Équipement",     icon: "🎒" },
  tool:     { label: "Outil",          icon: "🔧" },
  ammo:     { label: "Munitions",      icon: "🏹" },
  food:     { label: "Nourriture",     icon: "🍖" },
  book:     { label: "Livre",          icon: "📖" },
  trinket:  { label: "Babiole",        icon: "🧿" }
};

const RARITY_ALIASES = {
  common: "common", commun: "common", commune: "common",
  uncommon: "uncommon", "peu commun": "uncommon", "peucommun": "uncommon", "peu commune": "uncommon",
  rare: "rare",
  veryrare: "veryRare", "very rare": "veryRare", "very-rare": "veryRare", "tres rare": "veryRare", "très rare": "veryRare", "tresrare": "veryRare",
  legendary: "legendary", legendaire: "legendary", "légendaire": "legendary",
  artifact: "artifact", artefact: "artifact", artifacts: "artifact"
};

export function normRarity(r) {
  if (!r) return "common";
  if (RARITY_INDEX[r] !== undefined) return r;
  const k = String(r).trim().toLowerCase().replace(/_/g, " ");
  return RARITY_ALIASES[k] ?? RARITY_ALIASES[k.normalize("NFD").replace(/[̀-ͯ]/g, "")] ?? "common";
}
export const rarityInfo = (r) => RARITIES[RARITY_INDEX[normRarity(r)]];
export const typeInfo = (t) => TYPE_INFO[t] ?? TYPE_INFO.gear;
export const itemIcon = (item) => item.icon || typeInfo(item.type).icon;

/** "60,25,10,4,1,0" -> { common: 60, ... } */
export function parseWeights(str) {
  const out = { ...DEFAULT_WEIGHTS };
  if (!str) return out;
  const parts = String(str).split(/[,;\s]+/).filter(Boolean).map(Number);
  RARITIES.forEach((r, i) => { if (Number.isFinite(parts[i]) && parts[i] >= 0) out[r.key] = parts[i]; });
  return out;
}

/* ------------------------------------------------------------------ */
/* Aléatoire & dés                                                     */
/* ------------------------------------------------------------------ */

export const defaultRng = () => {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }
  return Math.random();
};

/** Lance une formule simple : "2d6*10+5", "1d4", "3". Renvoie un entier ≥ 0. */
export function rollFormula(formula, rng = defaultRng) {
  if (formula === undefined || formula === null || formula === "") return 1;
  if (typeof formula === "number") return Math.max(0, Math.floor(formula));
  let expr = String(formula).toLowerCase().replace(/\s+/g, "").replace(/×/g, "*");
  expr = expr.replace(/(\d*)d(\d+)/g, (_, n, f) => {
    const count = Math.min(Number(n || 1), 100), faces = Number(f);
    let s = 0;
    for (let i = 0; i < count; i++) s += 1 + Math.floor(rng() * faces);
    return String(s);
  });
  if (!/^[\d+\-*/().]+$/.test(expr)) return 1;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${expr});`)();
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 1;
  } catch { return 1; }
}

export function weightedPick(arr, weightOf, rng = defaultRng) {
  const weights = arr.map((x) => Math.max(0, Number(weightOf(x)) || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!arr.length) return null;
  if (total <= 0) return arr[Math.floor(rng() * arr.length)];
  let roll = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    roll -= weights[i];
    if (roll < 0) return arr[i];
  }
  return arr[arr.length - 1];
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ------------------------------------------------------------------ */
/* Tirage                                                              */
/* ------------------------------------------------------------------ */

/**
 * Poids par rareté, ajustés par la chance (-3..+5) et la rareté minimale,
 * limités aux raretés réellement présentes dans le pool.
 */
export function effectiveRarityWeights(pool, { weights = DEFAULT_WEIGHTS, luck = 0, minRarity = "common" } = {}) {
  const present = new Set(pool.items.map((i) => normRarity(i.rarity)));
  const min = RARITY_INDEX[normRarity(minRarity)];
  const base = { ...DEFAULT_WEIGHTS, ...(pool.rarityWeights || {}), ...weights };
  const out = {};
  for (const r of RARITIES) {
    const idx = RARITY_INDEX[r.key];
    if (!present.has(r.key) || idx < min) { out[r.key] = 0; continue; }
    // chaque point de chance multiplie le poids des raretés hautes
    out[r.key] = (base[r.key] ?? 0) * Math.pow(1.45, luck * (idx - 1.5));
  }
  // si tout est à zéro (ex: rareté minimale absente), on prend la plus basse dispo ≥ min
  if (Object.values(out).every((v) => v <= 0)) {
    const fallback = [...present].sort((a, b) => RARITY_INDEX[a] - RARITY_INDEX[b]).find((k) => RARITY_INDEX[k] >= min)
      ?? [...present].sort((a, b) => RARITY_INDEX[b] - RARITY_INDEX[a])[0];
    if (fallback) out[fallback] = 1;
  }
  return out;
}

/** Résout un objet du pool : quantité lancée, placeholder {q}, id unique. */
export function resolveItem(def, rng = defaultRng) {
  const quantity = rollFormula(def.quantity ?? 1, rng) || 1;
  const item = {
    ...def,
    uid: uid(),
    rarity: normRarity(def.rarity),
    type: def.type || "gear",
    quantity
  };
  for (const k of ["name", "description", "value"]) {
    if (typeof item[k] === "string") item[k] = item[k].replace(/\{q\}/g, String(quantity));
  }
  if (typeof def.value === "string" && /\{roll:([^}]+)\}/.test(def.value)) {
    item.value = def.value.replace(/\{roll:([^}]+)\}/g, (_, f) => String(rollFormula(f, rng)));
  }
  return item;
}

function pickOne(pool, rw, rng, exclude, ctx = {}) {
  // Pools « à plat » (ex: tables Foundry) : on respecte le poids de chaque ligne,
  // seulement modulé par la chance / rareté minimale.
  if (pool.flat) {
    const items = pool.items.filter((it) => !exclude?.has(it));
    if (!items.length) return null;
    const min = RARITY_INDEX[normRarity(ctx.minRarity)] ?? 0;
    const luck = ctx.luck ?? 0;
    const share = (it) => {
      const idx = RARITY_INDEX[normRarity(it.rarity)];
      return idx < min ? 0 : (it.chance ?? 1) * Math.pow(1.45, luck * (idx - 1.5));
    };
    if (items.every((it) => share(it) <= 0)) return weightedPick(items, (it) => it.chance ?? 1, rng);
    return weightedPick(items, share, rng);
  }
  const byRarity = {};
  for (const it of pool.items) {
    if (exclude?.has(it)) continue;
    (byRarity[normRarity(it.rarity)] ??= []).push(it);
  }
  const rarities = Object.keys(byRarity);
  if (!rarities.length) return null;
  const rarity = weightedPick(rarities, (r) => rw[r] ?? 0, rng);
  return weightedPick(byRarity[rarity], (i) => i.chance ?? 1, rng);
}

/**
 * Tire `count` objets. `forced` = liste d'index d'objets du pool imposés par le MJ
 * (le casino est truqué, c'est un casino).
 */
export function drawLoot(pool, { count = 1, luck = 0, minRarity = "common", unique = false, forced = [], weights, rng = defaultRng } = {}) {
  const rw = effectiveRarityWeights(pool, { weights, luck, minRarity });
  const used = new Set();
  const results = [];
  for (let n = 0; n < count; n++) {
    let def = null;
    const f = forced[n];
    if (f !== undefined && f !== null && f !== "" && pool.items[Number(f)]) def = pool.items[Number(f)];
    const ctx = { luck, minRarity };
    if (!def) def = pickOne(pool, rw, rng, unique ? used : null, ctx) ?? pickOne(pool, rw, rng, null, ctx);
    if (!def) break;
    used.add(def);
    results.push(resolveItem(def, rng));
  }
  return results;
}

const stripCard = (it) => ({ name: it.name, rarity: normRarity(it.rarity), type: it.type, icon: it.icon, img: it.img });

/**
 * Construit la bande de la roulette : des objets du pool tirés au hasard,
 * avec le gagnant à `winIndex` et parfois un « presque ! » juste à côté.
 */
export function buildStrip(pool, winner, { length = 64, winIndex = 54, rng = defaultRng, weights } = {}) {
  const rw = effectiveRarityWeights(pool, { weights, luck: 0.6 });
  const strip = [];
  for (let i = 0; i < length; i++) {
    const it = pickOne(pool, rw, rng, null, { luck: 0.6 }) ?? winner;
    strip.push(stripCard(it));
  }
  strip[winIndex] = stripCard(winner);
  // Le fameux « oh nooon, c'était à une case ! »
  const better = pool.items.filter((i) => RARITY_INDEX[normRarity(i.rarity)] > RARITY_INDEX[winner.rarity]);
  if (better.length && rng() < 0.55) {
    const side = rng() < 0.5 ? -1 : 1;
    strip[winIndex + side] = stripCard(weightedPick(better, (i) => 1 + RARITY_INDEX[normRarity(i.rarity)], rng));
  }
  return strip;
}

/* ------------------------------------------------------------------ */
/* Export Roll20                                                       */
/* ------------------------------------------------------------------ */

export const EXPORT_PREFIX = "CDND1.";
const EXPORT_FIELDS = ["name", "rarity", "type", "subtype", "description", "quantity", "weight", "value",
  "attunement", "damage", "damageType", "properties", "ac", "bonus", "range", "r20mods", "currency", "icon"];

/** Ne garde que les champs utiles (et non vides) pour l'export. */
export function exportableItem(item) {
  const out = {};
  for (const k of EXPORT_FIELDS) {
    const v = item[k];
    if (v === undefined || v === null || v === "" || v === false) continue;
    out[k] = v;
  }
  return out;
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** items: objet ou tableau. to: nom du personnage Roll20 (null = le groupe). */
export function encodeExport(items, to = null) {
  const list = (Array.isArray(items) ? items : [items]).map(exportableItem);
  const payload = { v: 1, items: list };
  if (to) payload.to = to;
  return EXPORT_PREFIX + b64urlEncode(JSON.stringify(payload));
}
export function decodeExport(code) {
  const raw = String(code).trim();
  if (!raw.startsWith(EXPORT_PREFIX)) throw new Error("Code Casino invalide");
  return JSON.parse(b64urlDecode(raw.slice(EXPORT_PREFIX.length)));
}
export const roll20Command = (items, to = null) => `!loot ${encodeExport(items, to)}`;

/* ------------------------------------------------------------------ */
/* Validation des pools importés                                       */
/* ------------------------------------------------------------------ */

export function validatePool(p) {
  if (!p || typeof p !== "object") throw new Error("Le pool doit être un objet JSON");
  if (!p.name) throw new Error("Le pool doit avoir un « name »");
  if (!Array.isArray(p.items) || !p.items.length) throw new Error("Le pool doit avoir une liste « items » non vide");
  p.items.forEach((it, i) => { if (!it?.name) throw new Error(`L'objet n°${i + 1} n'a pas de « name »`); });
  return {
    id: p.id || p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-"),
    name: p.name,
    description: p.description || "",
    rarityWeights: p.rarityWeights,
    flat: !!p.flat,
    items: p.items.map((it) => ({ ...it, rarity: normRarity(it.rarity), type: it.type || "gear" }))
  };
}
