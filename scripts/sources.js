/**
 * Casino DnD — d'où viennent les objets :
 *  - les pools fournis avec le module (data/pools.json)
 *  - les pools JSON importés par le MJ
 *  - les tables aléatoires (RollTable) du monde Foundry
 */
import { validatePool, normRarity } from "./engine.js";

// Le même code tourne comme module (modules/casino-dnd) ou comme système (systems/casino) :
// on déduit le type de paquet et son id de l'URL de ce fichier.
const PKG_MATCH = new URL(import.meta.url).pathname.match(/\/(modules|systems)\/([^/]+)\/scripts\//);
export const PKG_TYPE = PKG_MATCH?.[1] === "systems" ? "system" : "module";
export const MODULE_ID = PKG_MATCH?.[2] ?? "casino-dnd";
export const PKG_PATH = `${PKG_MATCH?.[1] ?? "modules"}/${MODULE_ID}`;
export const SOCKET = `${PKG_TYPE}.${MODULE_ID}`;
let builtinCache = null;

async function builtinPools() {
  if (!builtinCache) {
    const res = await fetch(`${PKG_PATH}/data/pools.json`);
    builtinCache = (await res.json()).map(validatePool);
    // pools supplémentaires installés à la main (ex : objets d'un PDF), facultatifs
    try {
      const extra = await fetch(`${PKG_PATH}/data/extra-pools.json`);
      if (extra.ok) builtinCache.push(...(await extra.json()).map(validatePool));
    } catch { /* pas de pools en plus */ }
  }
  return builtinCache;
}

export function customPools() {
  return (game.settings.get(MODULE_ID, "customPools")?.pools ?? []).map(validatePool);
}

export async function saveCustomPool(pool) {
  const pools = (game.settings.get(MODULE_ID, "customPools")?.pools ?? []).filter((p) => p.id !== pool.id);
  pools.push(pool);
  await game.settings.set(MODULE_ID, "customPools", { pools });
}
export async function deleteCustomPool(id) {
  const pools = (game.settings.get(MODULE_ID, "customPools")?.pools ?? []).filter((p) => p.id !== id);
  await game.settings.set(MODULE_ID, "customPools", { pools });
}

/** Liste toutes les sources disponibles (sans charger les tables). */
export async function listSources() {
  const out = [];
  for (const p of await builtinPools()) out.push({ id: `builtin:${p.id}`, name: `🎰 ${p.name}`, kind: "builtin", pool: p });
  for (const p of customPools()) out.push({ id: `custom:${p.id}`, name: `📦 ${p.name}`, kind: "custom", pool: p });
  for (const t of game.tables?.contents ?? []) out.push({ id: `table:${t.id}`, name: `🎲 ${t.name}`, kind: "table", table: t });
  return out;
}

export async function loadPool(sourceId) {
  const src = (await listSources()).find((s) => s.id === sourceId);
  if (!src) throw new Error("Source introuvable");
  if (src.pool) return src.pool;
  return tableToPool(src.table);
}

/* ------------------------------------------------------------------ */
/* Conversion RollTable / Item dnd5e -> objet Casino                   */
/* ------------------------------------------------------------------ */

export function stripHtml(html) {
  if (!html) return "";
  let s = String(html)
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")      // @UUID[...]{Nom} -> Nom
    .replace(/@\w+\[([^\]]*)\]/g, "$1")
    .replace(/\[\[\/?\w*\s*([^\]]*)\]\]/g, "$1")        // [[/r 1d6]] -> 1d6
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent.replace(/\n{3,}/g, "\n\n").trim();
}

const PROP_NAMES = {
  amm: "Ammunition", fin: "Finesse", hvy: "Heavy", lgt: "Light", lod: "Loading", rch: "Reach",
  thr: "Thrown", two: "Two-Handed", ver: "Versatile", spc: "Special", ret: "Returning", mgc: "Magical"
};
const DENOM = { pp: "pp", gp: "po", ep: "pe", sp: "pa", cp: "pc" };
const DEFAULT_IMGS = ["icons/svg/item-bag.svg", "icons/svg/d20-black.svg", "icons/svg/d20.svg", "icons/svg/mystery-man.svg"];

function lootType(doc) {
  const s = doc.system ?? {};
  const sub = s.type?.value ?? s.consumableType ?? s.armor?.type;
  switch (doc.type) {
    case "weapon": return "weapon";
    case "equipment":
      if (["light", "medium", "heavy", "shield", "natural"].includes(sub)) return "armor";
      if (sub === "ring") return "ring";
      return "wondrous";
    case "consumable":
      return { potion: "potion", poison: "potion", scroll: "scroll", wand: "wand", rod: "wand", ammo: "ammo", food: "food" }[sub] ?? "gear";
    case "tool": return "tool";
    case "loot": return sub === "gem" ? "gem" : "treasure";
    case "container": case "backpack": return "gear";
    default: return "gear";
  }
}

function itemDocToLoot(doc, chance = 1) {
  const s = doc.system ?? {};
  const item = {
    name: doc.name,
    rarity: normRarity(s.rarity),
    type: lootType(doc),
    description: stripHtml(s.description?.value),
    chance
  };
  if (doc.img && !DEFAULT_IMGS.includes(doc.img)) item.img = doc.img;
  const w = typeof s.weight === "object" ? s.weight?.value : s.weight;
  if (w) item.weight = w;
  if (s.price?.value) item.value = `${s.price.value} ${DENOM[s.price.denomination] ?? s.price.denomination ?? "po"}`;
  else if (typeof s.price === "number" && s.price) item.value = `${s.price} po`;
  if (s.attunement === "required" || s.attunement === 1 || s.attunement === true) item.attunement = true;
  if (s.type?.baseItem) item.subtype = s.type.baseItem.charAt(0).toUpperCase() + s.type.baseItem.slice(1);

  if (doc.type === "weapon") {
    const base = s.damage?.base;
    if (base?.number && base?.denomination) item.damage = `${base.number}d${base.denomination}`;
    else if (base?.formula) item.damage = base.formula;
    else if (s.damage?.parts?.[0]?.[0]) item.damage = String(s.damage.parts[0][0]).replace(/\s*\+\s*@mod/g, "");
    const types = base?.types ? [...base.types] : (s.damage?.parts?.[0]?.[1] ? [s.damage.parts[0][1]] : []);
    if (types[0]) item.damageType = types[0].charAt(0).toUpperCase() + types[0].slice(1);
    const props = s.properties instanceof Set ? [...s.properties] : Array.isArray(s.properties) ? s.properties
      : Object.entries(s.properties ?? {}).filter(([, v]) => v).map(([k]) => k);
    const names = props.map((p) => PROP_NAMES[p]).filter((p) => p && p !== "Magical");
    if (names.length) item.properties = names.join(", ");
    if (s.range?.value) item.range = `${s.range.value}${s.range.long ? "/" + s.range.long : ""} ${s.range.units ?? ""}`.trim();
  }
  if (item.type === "armor" && s.armor?.value) item.ac = s.armor.value;
  const bonus = s.magicalBonus ?? s.armor?.magicalBonus;
  if (bonus) item.bonus = Number(bonus);
  return item;
}

async function resultToItem(r) {
  let doc = null;
  let uuid = r.documentUuid;
  if (!uuid && r.documentId && r.documentCollection) {
    uuid = r.documentCollection.includes(".")
      ? `Compendium.${r.documentCollection}.Item.${r.documentId}`
      : `${r.documentCollection}.${r.documentId}`;
  }
  if (uuid) { try { doc = await fromUuid(uuid); } catch { doc = null; } }
  const chance = Number(r.weight) || 1;
  if (doc?.documentName === "Item") return itemDocToLoot(doc, chance);

  const flags = r.flags?.[MODULE_ID] ?? {};
  const name = stripHtml(r.name || r.text || r.description || doc?.name || "???");
  const item = {
    name,
    rarity: normRarity(flags.rarity),
    type: flags.type || "gear",
    chance
  };
  if (r.name && r.description) item.description = stripHtml(r.description);
  if (r.img && !DEFAULT_IMGS.includes(r.img)) item.img = r.img;
  return item;
}

export async function tableToPool(table) {
  const items = [];
  for (const r of table.results?.contents ?? []) {
    try { items.push(await resultToItem(r)); } catch (e) { console.warn("Casino DnD | résultat ignoré", r, e); }
  }
  if (!items.length) throw new Error(`La table « ${table.name} » est vide`);
  return validatePool({ id: `table-${table.id}`, name: table.name, description: stripHtml(table.description), flat: true, items });
}
