/**
 * Casino — remise d'un objet dans la fiche d'un personnage Foundry.
 *
 *  - Monde D&D 5e (dnd5e) : on cherche l'objet officiel dans les compendiums (par son nom anglais),
 *    on le copie (dégâts, CA, propriétés, activités…) puis on applique le nom / la description
 *    en français et la rareté du Casino. À défaut, l'objet est construit au format dnd5e.
 *  - Monde Casino : l'objet devient un document « objet » rangé dans l'inventaire de la fiche PJ.
 */
import { MODULE_ID } from "./sources.js";

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
const isDnd5e = () => game.system?.id === "dnd5e";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHTML = (txt) => !String(txt ?? "").trim() ? "" : String(txt).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

/* ------------------------------------------------------------------ */
/* Recherche dans les compendiums                                       */
/* ------------------------------------------------------------------ */
// règles 2024 d'abord, puis SRD 2014, puis compendiums du monde, puis le reste
const PACK_ORDER = ["dnd5e.equipment24", "dnd5e.items"];
const SKIP_TYPES = new Set(["spell", "feat", "class", "subclass", "background", "race", "species", "facility"]);
let indexPromise = null;

function packRank(p) {
  const i = PACK_ORDER.indexOf(p.collection);
  if (i >= 0) return i;
  return p.metadata?.packageType === "world" ? 10 : 20;
}

async function compendiumIndex() {
  indexPromise ??= (async () => {
    const map = new Map();
    const packs = game.packs.filter((p) => p.documentName === "Item").sort((a, b) => packRank(a) - packRank(b));
    for (const pack of packs) {
      let index;
      try { index = await pack.getIndex({ fields: ["type"] }); } catch { continue; }
      for (const e of index) {
        if (SKIP_TYPES.has(e.type)) continue;
        const key = norm(e.name);
        if (!map.has(key)) map.set(key, e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`);
      }
    }
    return map;
  })();
  return indexPromise;
}

/** Variantes de nom : « Longsword +1 » ↔ « +1 Longsword », sans parenthèses, etc. */
function nameVariants(en) {
  const out = new Set([en]);
  const noPar = en.replace(/\s*\([^)]*\)\s*$/, "").trim();
  out.add(noPar);
  let m = /^(.*?),?\s*\+(\d)$/.exec(noPar);
  if (m) { out.add(`+${m[2]} ${m[1]}`); out.add(`${m[1]}, +${m[2]}`); out.add(`${m[1]} +${m[2]}`); }
  m = /^\+(\d)\s+(.*)$/.exec(noPar);
  if (m) { out.add(`${m[2]} +${m[1]}`); out.add(`${m[2]}, +${m[1]}`); }
  return [...out].filter(Boolean);
}

export async function findCompendiumItem(item) {
  const en = item.compendium || item.name;
  if (!en) return null;
  const idx = await compendiumIndex();
  for (const v of nameVariants(en)) {
    const uuid = idx.get(norm(v));
    if (uuid) {
      try { const doc = await fromUuid(uuid); if (doc) return doc; } catch { /* suivant */ }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Construction au format dnd5e (quand l'objet n'est dans aucun compendium) */
/* ------------------------------------------------------------------ */
const DENOM = { po: "gp", pa: "sp", pc: "cp", pe: "ep", pp: "pp", gp: "gp", sp: "sp", cp: "cp", ep: "ep" };
function parsePrice(v) {
  const m = /([\d\s  .,]+)\s*(po|pa|pc|pe|pp|gp|sp|cp|ep)\b/i.exec(String(v ?? ""));
  if (!m) return null;
  const value = Number(m[1].replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(value) ? { value, denomination: DENOM[m[2].toLowerCase()] } : null;
}
function parseDice(s) {
  const m = /^(\d+)d(\d+)(?:\s*([+-]\s*\d+))?$/i.exec(String(s ?? "").trim());
  if (m) return { number: Number(m[1]), denomination: Number(m[2]), bonus: m[3] ? m[3].replace(/\s/g, "") : "" };
  if (/^\d+$/.test(String(s ?? "").trim())) return { number: null, denomination: null, bonus: String(s).trim() };
  return null;
}
const PROP = { ammunition: "amm", finesse: "fin", heavy: "hvy", light: "lgt", loading: "lod", reach: "rch",
  special: "spc", thrown: "thr", "two-handed": "two", "two-": "two", versatile: "ver" };
const WEAPON_SUB = { "Arme de guerre de corps à corps": "martialM", "Arme de guerre à distance": "martialR",
  "Arme courante de corps à corps": "simpleM", "Arme courante à distance": "simpleR" };
const ARMOR_SUB = { "Armure lourde": "heavy", "Armure intermédiaire": "medium", "Armure légère": "light", "Bouclier": "shield" };

function plusBonus(item) {
  const b = Number(item.bonus);
  if (Number.isFinite(b) && b) return b;
  const m = /\+(\d)\b/.exec(`${item.name} ${item.compendium ?? ""}`);
  return m ? Number(m[1]) : null;
}

/** Choisit une valeur qui existe dans la config dnd5e (sinon la valeur de repli). */
function cfg(group, value, fallback) {
  const c = CONFIG.DND5E?.[group];
  return c && !(value in c) ? fallback : value;
}

function buildDnd5e(item) {
  const magic = item.rarity && item.rarity !== "common";
  const system = {
    description: { value: toHTML(item.description) },
    quantity: Number(item.quantity) || 1,
    rarity: item.rarity === "artifact" ? "artifact" : (item.rarity || ""),
    identified: true
  };
  if (item.attunement) system.attunement = "required";
  const price = parsePrice(item.value);
  if (price) system.price = price;
  const w = Number(item.weight);
  if (Number.isFinite(w) && w > 0) system.weight = { value: w, units: "lb" };

  let type = "loot";
  const t = item.type;
  const bonus = plusBonus(item);
  if (t === "weapon" || t === "staff") {
    type = "weapon";
    const props = new Set();
    let range = null;
    let versatile = null;
    for (const part of String(item.propertiesEn ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      const word = part.split(/[\s(]/)[0].toLowerCase();
      if (PROP[word]) props.add(PROP[word]);
      const r = /range\s+(\d+)\/(\d+)/i.exec(part);
      if (r) range = { value: Number(r[1]), long: Number(r[2]), units: "ft" };
      const v = /versatile\s*\(([^)]+)\)/i.exec(part);
      if (v) versatile = parseDice(v[1]);
    }
    if (magic || bonus) props.add("mgc");
    const sub = t === "staff" ? "simpleM" : (WEAPON_SUB[item.subtype] ?? "simpleM");
    const ranged = sub.endsWith("R");
    system.type = { value: cfg("weaponTypes", sub, "simpleM"), baseItem: t === "staff" ? "quarterstaff" : "" };
    const dmg = parseDice(t === "staff" && !item.damage ? "1d6" : item.damage);
    if (dmg) {
      system.damage = { base: { ...dmg, types: t === "staff" && !item.damageType ? ["bludgeoning"] : (item.damageType ? [String(item.damageType).toLowerCase()] : []) } };
      if (versatile) system.damage.versatile = { ...versatile, types: [] };
    }
    if (range) system.range = range;
    else system.range = { reach: props.has("rch") ? 10 : 5, units: "ft" };
    if (bonus) system.magicalBonus = bonus;
    system.properties = [...props];
    const id = foundry.utils.randomID();
    system.activities = {
      [id]: {
        _id: id, type: "attack", activation: { type: "action", value: 1 },
        attack: { type: { value: ranged ? "ranged" : "melee", classification: "weapon" } },
        damage: { includeBase: true, parts: [] }
      }
    };
  } else if (t === "armor") {
    type = "equipment";
    const sub = ARMOR_SUB[item.subtype] ?? (/shield|bouclier/i.test(`${item.name} ${item.compendium}`) ? "shield" : "medium");
    system.type = { value: cfg("equipmentTypes", sub, "trinket"), baseItem: "" };
    const ac = Number(item.ac) || (sub === "shield" ? 2 : null);
    system.armor = { value: ac, dex: sub === "heavy" ? 0 : sub === "medium" ? 2 : null };
    if (bonus) system.armor.magicalBonus = bonus;
    if (magic || bonus) system.properties = ["mgc"];
  } else if (["ring", "wondrous", "trinket"].includes(t)) {
    type = "equipment";
    system.type = { value: cfg("equipmentTypes", t, "trinket"), baseItem: "" };
    if (magic) system.properties = ["mgc"];
  } else if (["potion", "scroll", "ammo", "food", "wand", "poison"].includes(t)) {
    type = "consumable";
    system.type = { value: cfg("consumableTypes", t, "trinket") };
    if (magic) system.properties = ["mgc"];
  } else if (t === "tool") {
    type = "tool";
  } else if (t === "gem") {
    system.type = { value: "gem" };
  } else {
    system.type = { value: "gear" };
  }
  return { name: item.name, type, img: item.img || undefined, system };
}

/* ------------------------------------------------------------------ */
/* Remise                                                               */
/* ------------------------------------------------------------------ */
async function prepareDnd5e(item) {
  const doc = await findCompendiumItem(item);
  if (!doc) return { data: buildDnd5e(item), fromCompendium: null };
  const data = doc.toObject();
  delete data._id;
  delete data.folder;
  delete data.sort;
  data.name = item.name || data.name;
  if (item.description) {
    // la description française, puis l'originale repliée pour garder les détails du compendium
    const orig = data.system?.description?.value;
    data.system.description.value = toHTML(item.description)
      + (orig ? `<details><summary>Texte original (${esc(doc.name)})</summary>${orig}</details>` : "");
  }
  if (item.rarity && data.system && "rarity" in data.system) data.system.rarity = item.rarity;
  data._stats = { ...(data._stats ?? {}), compendiumSource: doc.uuid };
  return { data, fromCompendium: doc.uuid };
}

/**
 * Crée l'objet dans la fiche de l'acteur. Retourne { item, fromCompendium }.
 * Les pièces (item.currency) sont ajoutées à la bourse dnd5e.
 */
export async function giveItem(actor, item, meta = {}) {
  if (!actor) throw new Error("Personnage introuvable");
  const flags = { [MODULE_ID]: { casino: true, rarity: item.rarity, ...meta } };

  if (isDnd5e()) {
    if (item.currency && typeof item.currency === "object" && actor.system?.currency) {
      const cur = foundry.utils.deepClone(actor.system.currency);
      for (const [k, v] of Object.entries(item.currency)) {
        const key = DENOM[k] ?? k;
        if (key in cur) cur[key] = (Number(cur[key]) || 0) + (Number(v) || 0);
      }
      await actor.update({ "system.currency": cur });
    }
    let { data, fromCompendium } = await prepareDnd5e(item);
    data.flags = foundry.utils.mergeObject(data.flags ?? {}, flags);
    let created;
    try {
      [created] = await actor.createEmbeddedDocuments("Item", [data]);
    } catch (e) {
      // repli : sans activités (au cas où le format diffère selon la version de dnd5e)
      console.warn("Casino | création dnd5e en échec, nouvel essai simplifié", e);
      if (data.system) delete data.system.activities;
      [created] = await actor.createEmbeddedDocuments("Item", [data]);
    }
    return { item: created, fromCompendium };
  }

  // Monde Casino (ou autre système) : document « objet » libre
  const types = game.documentTypes?.Item ?? Object.keys(CONFIG.Item.dataModels ?? {});
  const type = types.includes("objet") ? "objet" : types.find((x) => x !== "base") ?? "base";
  const { img, ...rest } = item;
  const [created] = await actor.createEmbeddedDocuments("Item", [{
    name: item.name, type, img: img || undefined, system: rest, flags
  }]);
  return { item: created, fromCompendium: null };
}

/** Retire un objet donné par le Casino (annulation). */
export async function takeBackItem(uuid) {
  if (!uuid) return false;
  try {
    const doc = await fromUuid(uuid);
    if (doc) { await doc.delete(); return true; }
  } catch (e) { console.warn("Casino | objet non retiré", e); }
  return false;
}
