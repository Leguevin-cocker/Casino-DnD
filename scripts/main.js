/**
 * Casino DnD — point d'entrée Foundry VTT (v12 / v13).
 *
 * Déroulé d'une session :
 *  1. Le MJ crée une session : les objets sont tirés tout de suite, mais gardés
 *     dans le navigateur du MJ (les joueurs ne peuvent pas les lire en avance).
 *  2. Tout le monde voit le tableau des coffres fermés.
 *  3. Un clic sur un coffre -> le MJ (qui fait autorité) lance l'animation chez tous.
 *  4. Le coffre revient ouvert sur le tableau : objet, choix du PJ, commande Roll20.
 */
import { drawLoot, drawByRarity, CHEST_RARITIES, buildStrip, roll20Command, exportableItem, parseWeights, rarityInfo, typeInfo } from "./engine.js";
import { LootOverlay, copyText, showCopyBox, displayName } from "./overlay.js";
import { SessionBoard } from "./board.js";
import { MODULE_ID, PKG_TYPE, PKG_PATH, SOCKET, loadPool, listSources } from "./sources.js";
import { CasinoApp } from "./casino-app.js";
import { CasinoActorSheet, isPJ, moveHistoryEntry } from "./actor-sheet.js";

const HISTORY_MAX = 50;
let overlay = null;
let board = null;
let gmOpening = false;

const setting = (k) => game.settings.get(MODULE_ID, k);
const clone = (o) => foundry.utils.deepClone(o);
/** Ce navigateur détient-il le contenu (secret) de cette session ? */
const holdsSession = (sessionId) => game.user.isGM && setting("sessionSecret")?.id === sessionId;
const isLeadGM = () => game.user.isGM && (game.users.activeGM ? game.users.activeGM.id === game.user.id : true);

/** Noms des PJ : fiches cochées « PJ du Casino » + anciens noms saisis à la main. */
export function legacyCharacters() {
  return String(setting("characters") || "").split(",").map((x) => x.trim()).filter(Boolean);
}
export function pjActors() {
  return (game.actors?.contents ?? []).filter((a) => isPJ(a)).sort((a, b) => a.name.localeCompare(b.name));
}
export function getCharacters() {
  return [...new Set([...pjActors().map((a) => a.name), ...legacyCharacters()])];
}
/** Crée une fiche de PJ (système Casino) ou, à défaut, l'ajoute à la liste manuelle. */
export async function createPJ(name) {
  name = String(name ?? "").trim();
  if (!name) return null;
  const existing = game.actors.getName(name);
  if (existing) { await existing.setFlag(MODULE_ID, "isPJ", true); return existing; }
  if (PKG_TYPE === "system") {
    return Actor.create({ name, type: "pj", flags: { [MODULE_ID]: { isPJ: true } } });
  }
  await setCharacters([...legacyCharacters(), name]);
  return null;
}
export async function setCharacters(list) {
  const clean = [...new Set(list.map((x) => String(x).replace(/,/g, " ").trim()).filter(Boolean))];
  await game.settings.set(MODULE_ID, "characters", clean.join(", "));
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */
Hooks.once("init", () => {
  if (PKG_TYPE === "system") {
    const Actors = foundry.documents?.collections?.Actors ?? globalThis.Actors;
    Actors.registerSheet(MODULE_ID, CasinoActorSheet, { types: ["pj"], makeDefault: true, label: "Fiche PJ du Casino" });
  }
  const reg = (key, data) => game.settings.register(MODULE_ID, key, data);
  reg("characters", {
    name: "Personnages (noms Roll20)",
    hint: "Se gère plus simplement dans le panneau du Casino, onglet « PJ ». Noms exacts des personnages sur Roll20, séparés par des virgules.",
    scope: "world", config: true, type: String, default: "",
    onChange: () => { board?.render(setting("session")); CasinoApp.instance?.rendered && CasinoApp.instance.render(); }
  });
  reg("title", {
    name: "Titre du Casino", scope: "world", config: true, type: String, default: "Le Casino interplanaire de Hugoblin"
  });
  reg("weights", {
    name: "Poids des raretés",
    hint: "Commun, Peu commun, Rare, Très rare, Légendaire, Artefact. Ex : 60,25,10,4,1,0. Un pool peut avoir ses propres poids.",
    scope: "world", config: true, type: String, default: "60,25,10,4,1,0"
  });
  reg("playersSeeCode", {
    name: "Les joueurs voient la commande Roll20",
    hint: "Par défaut, seul le MJ voit et copie la commande d'import sous chaque coffre ouvert.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => board?.render(setting("session"))
  });
  reg("presenter", {
    name: "Afficher le présentateur",
    hint: "Le présentateur du casino (image assets/presenter.png du paquet). Rechargez la page après changement.",
    scope: "world", config: true, type: Boolean, default: true
  });
  reg("postToChat", {
    name: "Annoncer le butin dans le chat Foundry", scope: "world", config: true, type: Boolean, default: true
  });
  reg("spinDuration", {
    name: "Durée de la roulette (mode roulette, via macro)", scope: "world", config: false, type: Number, default: 6
  });
  reg("volume", {
    name: "Volume des effets du Casino", hint: "Réglage propre à chaque joueur.",
    scope: "client", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6,
    onChange: (v) => overlay?.setVolume(v)
  });
  reg("session", {
    scope: "world", config: false, type: Object, default: { active: false },
    onChange: (v) => { board?.render(v); CasinoApp.instance?.rendered && CasinoApp.instance.render(); }
  });
  // Contenu des coffres pas encore ouverts : uniquement dans le navigateur du MJ.
  reg("sessionSecret", { scope: "client", config: false, type: Object, default: {} });
  reg("history", { scope: "world", config: false, type: Object, default: { entries: [] } });
  reg("customPools", { scope: "world", config: false, type: Object, default: { pools: [] } });
  reg("panelState", { scope: "client", config: false, type: Object, default: {} });
});

// libellés des types de documents (sinon Foundry affiche « TYPES.Actor.pj »)
Hooks.once("i18nInit", () => {
  if (PKG_TYPE !== "system") return;
  foundry.utils.mergeObject(game.i18n.translations, { TYPES: { Actor: { pj: "PJ" }, Item: { objet: "Objet" } } });
});

/* ------------------------------------------------------------------ */
/* Bouton « Casino » dans l'onglet Acteurs, sous Créer un acteur / dossier */
/* ------------------------------------------------------------------ */
function addDirectoryButton(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? app?.element;
  if (!root || root.querySelector(".cdnd-dir-btn")) return;
  const gm = game.user.isGM;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cdnd-dir-btn";
  btn.innerHTML = `<i class="fa-solid fa-dice"></i> ${gm ? "Casino — coffres de loot" : "Afficher les coffres du Casino"}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (gm) CasinoApp.open();
    else board?.show();
  });
  const actions = root.querySelector(".header-actions");
  if (actions) actions.insertAdjacentElement("afterend", btn);
  else (root.querySelector(".directory-header") ?? root).prepend(btn);
}
Hooks.on("renderActorDirectory", addDirectoryButton);

// la liste des PJ suit les fiches
for (const h of ["createActor", "updateActor", "deleteActor"]) {
  Hooks.on(h, () => {
    board?.render(setting("session"));
    if (CasinoApp.instance?.rendered) CasinoApp.instance.render();
  });
}

/* ------------------------------------------------------------------ */
/* Prêt : overlay, tableau, socket, API                                 */
/* ------------------------------------------------------------------ */
Hooks.once("ready", () => {
  const presenterSrc = setting("presenter") ? `${PKG_PATH}/assets/presenter.png` : null;
  overlay = new LootOverlay({
    presenterSrc,
    volume: setting("volume"),
    isGM: game.user.isGM,
    onExport: (items, payload) => exportToRoll20(items, payload?.recipient),
    onCloseAll: () => game.socket.emit(SOCKET, { action: "close" })
  });

  board = new SessionBoard({
    presenterSrc,
    isGM: game.user.isGM,
    getCharacters,
    showCode: () => setting("playersSeeCode"),
    onOpen: (i) => requestOpen(i),
    onAssign: (i, to) => requestAssign(i, to),
    onCopy: async (text) => {
      if (await copyText(text)) ui.notifications.info("Commande Roll20 copiée. Colle-la dans le chat Roll20 !");
      else showCopyBox(text);
    },
    onEnd: game.user.isGM ? () => endSession() : null
  });
  board.render(setting("session"));

  game.socket.on(SOCKET, (msg) => {
    switch (msg?.action) {
      case "play": overlay.play(msg.payload); break;
      case "close": overlay.close(); break;
      case "show-board": board.show(); break;
      case "open-request": if (holdsSession(msg.sessionId)) gmOpen(msg.sessionId, msg.index, msg.userId); break;
      case "assign": if (holdsSession(msg.sessionId)) gmAssign(msg.sessionId, msg.index, msg.to); break;
      case "denied": if (msg.userId === game.user.id) ui.notifications.warn(msg.reason); break;
    }
  });

  const api = {
    open: () => CasinoApp.open(), createSession, endSession, showBoard: () => { board.show(); game.socket.emit(SOCKET, { action: "show-board" }); },
    spin, replay, exportToRoll20, listSources, roll20Command, getCharacters, setCharacters, createPJ, pjActors, overlay, board
  };
  if (PKG_TYPE === "system") game.system.api = api;
  else game.modules.get(MODULE_ID).api = api;
  globalThis.CasinoDnD = api;
  if (PKG_TYPE === "system" && isLeadGM()) { ensureCasinoScene(); migrateLegacyCharacters(); }
  console.log("Casino DnD | prêt 🎰");
});

/** Les noms saisis à la main avant les fiches deviennent des fiches PJ. */
async function migrateLegacyCharacters() {
  const names = legacyCharacters();
  if (!names.length) return;
  for (const n of names) await createPJ(n);
  await game.settings.set(MODULE_ID, "characters", "");
  ui.notifications.info(`Casino : ${names.length} PJ convertis en fiches de personnage (${names.join(", ")}).`);
}

/** Monde dédié (système Casino) : une scène « Le Casino » sur le marbre, si le monde n'en a aucune. */
async function ensureCasinoScene() {
  if (game.scenes.size) return;
  try {
    const scene = await Scene.create({
      name: "Le Casino",
      width: 1920, height: 1080, padding: 0,
      background: { src: `${PKG_PATH}/assets/join-background.jpg` },
      backgroundColor: "#0b1a12",
      grid: { type: 0 },
      tokenVision: false,
      navigation: true
    });
    await scene.activate();
  } catch (e) { console.warn("Casino | scène non créée", e); }
}

/* ------------------------------------------------------------------ */
/* Session de coffres                                                   */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {string} o.sourceId
 * @param {number} [o.count=3]   nombre de coffres (1..12)
 * @param {number} [o.luck=0]
 * @param {string} [o.minRarity]
 * @param {boolean} [o.unique]
 * @param {number|string} [o.forced]  index d'un objet du pool, caché dans un coffre au hasard
 */
export async function createSession(o = {}) {
  if (!game.user.isGM) return;
  const pool = await loadPool(o.sourceId ?? "builtin:tresor-donjon");
  const mystery = !!o.mystery;
  let items;
  if (o.counts) {
    // un objet par coffre, de la rareté du coffre
    items = drawByRarity(pool, o.counts, { unique: o.unique !== false, forced: o.forced });
  } else {
    const count = Math.max(1, Math.min(12, Number(o.count) || 3));
    items = drawLoot(pool, {
      count, luck: Number(o.luck) || 0, minRarity: o.minRarity || "common", unique: !!o.unique,
      forced: o.forced !== undefined && o.forced !== "" ? [o.forced] : [],
      weights: pool.rarityWeights ? undefined : parseWeights(setting("weights"))
    });
    items.forEach((i) => { i.chestRarity = i.rarity === "artifact" ? "legendary" : i.rarity; });
  }
  if (!items.length) return ui.notifications.warn("Aucun coffre : mets au moins un curseur au-dessus de 0.");
  // coffres mystère : ordre mélangé (sinon, du bois à la gemme)
  if (mystery) {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  }
  const id = foundry.utils.randomID();
  await game.settings.set(MODULE_ID, "sessionSecret", { id, items });
  await game.settings.set(MODULE_ID, "session", {
    active: true, id, ownerId: game.user.id, title: setting("title"), source: pool.name, createdAt: Date.now(), opening: null, mystery,
    chests: items.map((i) => ({ opened: false, tier: mystery ? 0 : Math.max(0, CHEST_RARITIES.indexOf(i.chestRarity)) }))
  });
  board.show();
  game.socket.emit(SOCKET, { action: "show-board" });
}

export async function endSession() {
  if (!game.user.isGM) return;
  const st = setting("session");
  if (st?.active) await recordSession(st);
  await game.settings.set(MODULE_ID, "session", { active: false });
  await game.settings.set(MODULE_ID, "sessionSecret", {});
}

function requestOpen(index) {
  const st = setting("session");
  if (!st?.active) return;
  if (holdsSession(st.id)) return gmOpen(st.id, index, game.user.id);
  const owner = st.ownerId ? game.users.get(st.ownerId) : game.users.activeGM;
  if (!owner?.active) {
    ui.notifications.warn(`${owner?.name ?? "Le MJ"} doit être connecté pour ouvrir un coffre (c'est lui qui a créé la session).`);
    return board.render(st);
  }
  game.socket.emit(SOCKET, { action: "open-request", sessionId: st.id, index, userId: game.user.id });
}

function requestAssign(index, to) {
  const st = setting("session");
  if (!st?.active) return;
  if (holdsSession(st.id)) return gmAssign(st.id, index, to);
  game.socket.emit(SOCKET, { action: "assign", sessionId: st.id, index, to });
}

async function gmOpen(sessionId, index, userId) {
  const st = clone(setting("session"));
  const deny = (reason) => {
    if (userId === game.user.id) ui.notifications.warn(reason);
    else game.socket.emit(SOCKET, { action: "denied", userId, reason });
    board.render(setting("session"));
  };
  if (!st?.active || st.id !== sessionId) return deny("Cette session est terminée.");
  if (gmOpening || (st.opening !== null && st.opening !== undefined)) return deny("Un coffre est déjà en train de s'ouvrir, patience !");
  const chest = st.chests[index];
  if (!chest || chest.opened) return deny("Ce coffre est déjà ouvert.");
  const secret = setting("sessionSecret");
  if (secret?.id !== st.id || !secret.items?.[index]) {
    ui.notifications.error("Casino : le contenu de cette session n'est pas dans ce navigateur (créée ailleurs ?). Termine-la et recrée-en une.");
    return deny("Le MJ ne retrouve pas le contenu de ce coffre.");
  }
  const item = secret.items[index];
  const opener = game.users.get(userId)?.name ?? "";

  gmOpening = true;
  try {
    st.opening = index;
    await game.settings.set(MODULE_ID, "session", st);
    const payload = {
      id: foundry.utils.randomID(),
      title: st.title,
      subtitle: `Coffre n°${index + 1}${opener ? ` · ouvert par ${opener}` : ""}`,
      mode: "chest",
      noSummary: true,
      results: [{ item, startTier: st.mystery ? 0 : (st.chests[index]?.tier ?? 0), targetTier: Math.max(0, CHEST_RARITIES.indexOf(item.chestRarity ?? item.rarity)) }]
    };
    game.socket.emit(SOCKET, { action: "play", payload });
    await overlay.play(payload);
  } finally {
    const st2 = clone(setting("session"));
    if (st2?.active && st2.id === sessionId) {
      st2.chests[index] = { opened: true, item, openedBy: opener, to: "" };
      st2.opening = null;
      await game.settings.set(MODULE_ID, "session", st2);
      await recordSession(st2);
      if (setting("postToChat")) postChat([item], opener ? `Coffre ouvert par ${opener}` : "Coffre ouvert");
    }
    gmOpening = false;
  }
}

async function gmAssign(sessionId, index, to) {
  const st = clone(setting("session"));
  const chest = st?.chests?.[index];
  if (!st?.active || st.id !== sessionId || !chest?.opened) return;
  const prev = chest.to || "";
  chest.to = to || "";
  await game.settings.set(MODULE_ID, "session", st);
  await recordSession(st);
  // historique dans la fiche du personnage
  const entry = {
    id: `${st.id}:${index}`, date: Date.now(), source: st.source, chest: index + 1, openedBy: chest.openedBy || "",
    item: { ...exportableItem(chest.item), rarity: chest.item.rarity, ...(chest.item.img ? { img: chest.item.img } : {}) }
  };
  try { await moveHistoryEntry(entry, prev, chest.to); }
  catch (e) { console.warn("Casino | historique de fiche non mis à jour", e); }
}

/** Une entrée d'historique par session, mise à jour à chaque coffre ouvert / attribué. */
async function recordSession(st) {
  const items = st.chests.filter((c) => c.opened).map((c) => ({ ...c.item, to: c.to || "" }));
  if (!items.length) return;
  const h = setting("history");
  const entries = (h.entries ?? []).filter((e) => e.id !== st.id);
  entries.unshift({ id: st.id, date: st.createdAt ?? Date.now(), source: st.source, mode: "chest", items });
  await game.settings.set(MODULE_ID, "history", { entries: entries.slice(0, HISTORY_MAX) });
  CasinoApp.instance?.rendered && CasinoApp.instance.render();
}

/* ------------------------------------------------------------------ */
/* Tirage direct (macro / API) : roulette, cartes ou coffres en série   */
/* ------------------------------------------------------------------ */
export async function spin(o = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut faire tourner le Casino.");
  const pool = await loadPool(o.sourceId ?? "builtin:tresor-donjon");
  const count = Math.max(1, Math.min(10, Number(o.count) || 1));
  const items = drawLoot(pool, {
    count, luck: Number(o.luck) || 0, minRarity: o.minRarity || "common", unique: !!o.unique,
    forced: o.forced ?? [], weights: pool.rarityWeights ? undefined : parseWeights(setting("weights"))
  });
  if (!items.length) return ui.notifications.warn("Rien à tirer dans ce pool.");
  const results = items.map((item) => ({ item, strip: buildStrip(pool, item, { winIndex: 54 }), winIndex: 54 }));
  const payload = {
    id: foundry.utils.randomID(), title: setting("title"), recipient: o.recipient || null,
    mode: ["roulette", "cards"].includes(o.mode) ? o.mode : "chest",
    duration: setting("spinDuration"), source: pool.name, sourceId: o.sourceId, results
  };
  game.socket.emit(SOCKET, { action: "play", payload });
  overlay.play(payload);
  const h = setting("history");
  const entries = [{ id: payload.id, date: Date.now(), source: pool.name, mode: payload.mode, sourceId: o.sourceId,
    items: items.map((it) => ({ ...it, to: o.recipient || "" })) }, ...(h.entries ?? [])].slice(0, HISTORY_MAX);
  await game.settings.set(MODULE_ID, "history", { entries });
  if (setting("postToChat")) postChat(items, o.recipient ? `Butin de ${o.recipient}` : "Butin du groupe");
  return items;
}

/** Rejoue l'animation d'une entrée d'historique (mêmes objets). */
export async function replay(entryId) {
  const e = setting("history").entries.find((x) => x.id === entryId);
  if (!e) return;
  let pool = { items: e.items };
  if (e.sourceId) { try { pool = await loadPool(e.sourceId); } catch { /* garde les objets */ } }
  const results = e.items.map((item) => ({ item, strip: buildStrip(pool, item, { winIndex: 54 }), winIndex: 54 }));
  const payload = { id: foundry.utils.randomID(), title: setting("title"), mode: e.mode || "chest", duration: setting("spinDuration"), results, subtitle: "Rediffusion" };
  game.socket.emit(SOCKET, { action: "play", payload });
  overlay.play(payload);
}

function postChat(items, heading) {
  const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
  const rows = items.map((item) => {
    const r = rarityInfo(item.rarity);
    return `<li style="border-left:4px solid ${r.color};padding:2px 6px;margin:3px 0;list-style:none">
      ${typeInfo(item.type).icon} <b>${esc(displayName(item))}</b>
      <span style="color:${r.color};font-size:11px">${esc(r.label)}</span></li>`;
  }).join("");
  ChatMessage.create({
    speaker: { alias: "🎰 Casino" },
    content: `<div><div style="font-weight:bold">${esc(heading)}</div><ul style="padding:0;margin:4px 0">${rows}</ul></div>`
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
