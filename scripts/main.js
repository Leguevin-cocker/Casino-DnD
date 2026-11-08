/**
 * Casino DnD — point d'entrée Foundry VTT (v12 / v13).
 */
import { drawLoot, buildStrip, roll20Command, parseWeights, rarityInfo, typeInfo } from "./engine.js";
import { LootOverlay, copyText, showCopyBox, displayName } from "./overlay.js";
import { MODULE_ID, loadPool, listSources } from "./sources.js";
import { CasinoApp } from "./casino-app.js";

const SOCKET = `module.${MODULE_ID}`;
const HISTORY_MAX = 50;
let overlay = null;

const setting = (k) => game.settings.get(MODULE_ID, k);

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */
Hooks.once("init", () => {
  const reg = (key, data) => game.settings.register(MODULE_ID, key, data);
  reg("characters", {
    name: "Personnages (noms Roll20)",
    hint: "Noms des personnages séparés par des virgules, exactement comme sur Roll20. Ils apparaissent dans « Destinataire » et le script Roll20 s'en sert pour remplir la bonne fiche.",
    scope: "world", config: true, type: String, default: ""
  });
  reg("title", {
    name: "Titre de l'écran de tirage", scope: "world", config: true, type: String, default: "Le Casino"
  });
  reg("weights", {
    name: "Poids des raretés",
    hint: "Commun, Peu commun, Rare, Très rare, Légendaire, Artefact. Ex : 60,25,10,4,1,0 (= 60 % commun, 1 % légendaire). Un pool peut avoir ses propres poids.",
    scope: "world", config: true, type: String, default: "60,25,10,4,1,0"
  });
  reg("spinDuration", {
    name: "Durée de la roulette (secondes)", scope: "world", config: true, type: Number,
    range: { min: 3, max: 12, step: 0.5 }, default: 6
  });
  reg("postToChat", {
    name: "Annoncer le butin dans le chat Foundry", scope: "world", config: true, type: Boolean, default: true
  });
  reg("volume", {
    name: "Volume des effets du Casino", hint: "Réglage propre à chaque joueur.",
    scope: "client", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6,
    onChange: (v) => overlay?.setVolume(v)
  });
  reg("history", { scope: "world", config: false, type: Object, default: { entries: [] } });
  reg("customPools", { scope: "world", config: false, type: Object, default: { pools: [] } });
  reg("panelState", { scope: "client", config: false, type: Object, default: {} });
});

/* ------------------------------------------------------------------ */
/* Bouton dans la barre d'outils (jetons)                               */
/* ------------------------------------------------------------------ */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const base = { name: MODULE_ID, title: "Casino — tirer du loot", icon: "fa-solid fa-dice", button: true, visible: true };
  if (Array.isArray(controls)) {
    // v12
    controls.find((c) => c.name === "token")?.tools.push({ ...base, onClick: () => CasinoApp.open() });
  } else {
    // v13+
    const tokens = controls.tokens ?? controls.token;
    if (tokens?.tools) tokens.tools[MODULE_ID] = { ...base, order: 99, onChange: () => CasinoApp.open() };
  }
});

/* ------------------------------------------------------------------ */
/* Prêt : overlay, socket, API                                          */
/* ------------------------------------------------------------------ */
Hooks.once("ready", () => {
  overlay = new LootOverlay({
    volume: setting("volume"),
    isGM: game.user.isGM,
    onExport: (items, payload) => exportToRoll20(items, payload?.recipient),
    onCloseAll: () => game.socket.emit(SOCKET, { action: "close" })
  });

  game.socket.on(SOCKET, (msg) => {
    if (msg?.action === "play") overlay.play(msg.payload);
    else if (msg?.action === "close") overlay.close();
  });

  const api = { open: () => CasinoApp.open(), spin, replay, exportToRoll20, listSources, roll20Command, overlay };
  game.modules.get(MODULE_ID).api = api;
  globalThis.CasinoDnD = api;
  console.log("Casino DnD | prêt 🎰");
});

/* ------------------------------------------------------------------ */
/* Tirage                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tire du loot et lance l'animation chez tout le monde.
 * @param {object} o
 * @param {string} o.sourceId  ex: "builtin:tresor-donjon", "table:<id>", "custom:<id>"
 * @param {number} [o.count=1]
 * @param {string|null} [o.recipient]  nom du personnage Roll20 (null = groupe)
 * @param {"roulette"|"cards"} [o.mode]
 * @param {number} [o.luck=0]  -3..+5
 * @param {string} [o.minRarity]
 * @param {boolean} [o.unique]
 * @param {Array<number|string>} [o.forced]  index d'objets du pool imposés
 */
export async function spin(o = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut faire tourner le Casino.");
  const pool = await loadPool(o.sourceId ?? "builtin:tresor-donjon");
  const weights = parseWeights(setting("weights"));
  const count = Math.max(1, Math.min(10, Number(o.count) || 1));
  const items = drawLoot(pool, {
    count, luck: Number(o.luck) || 0, minRarity: o.minRarity || "common", unique: !!o.unique,
    forced: o.forced ?? [], weights: pool.rarityWeights ? undefined : weights
  });
  if (!items.length) return ui.notifications.warn("Rien à tirer dans ce pool.");
  const results = items.map((item) => ({ item, strip: buildStrip(pool, item, { winIndex: 54 }), winIndex: 54 }));
  const payload = {
    id: foundry.utils.randomID(),
    title: setting("title"),
    recipient: o.recipient || null,
    mode: o.mode === "cards" ? "cards" : "roulette",
    duration: setting("spinDuration"),
    source: pool.name,
    sourceId: o.sourceId,
    results
  };
  broadcast(payload);
  await recordHistory(payload);
  if (setting("postToChat")) postChat(payload);
  return items;
}

function broadcast(payload) {
  game.socket.emit(SOCKET, { action: "play", payload });
  overlay.play(payload);
}

/** Rejoue l'animation d'un tirage de l'historique (mêmes objets). */
export async function replay(entryId) {
  const e = setting("history").entries.find((x) => x.id === entryId);
  if (!e) return;
  let pool = null;
  try { pool = await loadPool(e.sourceId); } catch { pool = { items: e.items }; }
  const results = e.items.map((item) => ({ item, strip: buildStrip(pool, item, { winIndex: 54 }), winIndex: 54 }));
  broadcast({ id: foundry.utils.randomID(), title: setting("title"), recipient: e.recipient, mode: e.mode, duration: setting("spinDuration"), results });
}

async function recordHistory(payload) {
  const h = setting("history");
  const entries = [{
    id: payload.id, date: Date.now(), recipient: payload.recipient, source: payload.source, mode: payload.mode,
    sourceId: payload.sourceId, items: payload.results.map((r) => r.item)
  }, ...(h.entries ?? [])].slice(0, HISTORY_MAX);
  await game.settings.set(MODULE_ID, "history", { entries });
  CasinoApp.instance?.rendered && CasinoApp.instance.render();
}

function postChat(payload) {
  const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
  const rows = payload.results.map(({ item }) => {
    const r = rarityInfo(item.rarity);
    return `<li style="border-left:4px solid ${r.color};padding:2px 6px;margin:3px 0;list-style:none">
      ${typeInfo(item.type).icon} <b>${esc(displayName(item))}</b>
      <span style="color:${r.color};font-size:11px">${esc(r.label)}</span></li>`;
  }).join("");
  ChatMessage.create({
    speaker: { alias: "🎰 Casino" },
    content: `<div><div style="font-weight:bold">${payload.recipient ? `Butin de ${esc(payload.recipient)}` : "Butin du groupe"}</div><ul style="padding:0;margin:4px 0">${rows}</ul></div>`
  });
}

/* ------------------------------------------------------------------ */
/* Export Roll20                                                        */
/* ------------------------------------------------------------------ */
export async function exportToRoll20(items, recipient = null) {
  const cmd = roll20Command(items, recipient);
  if (await copyText(cmd)) {
    ui.notifications.info(`Commande Roll20 copiée (${items.length} objet${items.length > 1 ? "s" : ""}). Colle-la dans le chat Roll20 !`);
  } else {
    showCopyBox(cmd);
  }
  return cmd;
}
