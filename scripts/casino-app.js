/**
 * Casino DnD — panneau du MJ (ApplicationV2, Foundry v12+).
 */
import { RARITIES, rarityInfo, validatePool, normRarity } from "./engine.js";
import { displayName } from "./overlay.js";
import { MODULE_ID, listSources, loadPool, saveCustomPool, deleteCustomPool } from "./sources.js";
import { spin, replay, exportToRoll20 } from "./main.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const LUCK_LABELS = { "-3": "😭", "-2": "😟", "-1": "😕", "0": "🙂", "1": "😊", "2": "😄", "3": "🤩", "4": "🍀", "5": "👑" };

export class CasinoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static open() {
    if (!game.user.isGM) return ui.notifications.warn("Le Casino est réservé au MJ.");
    (this.instance ??= new CasinoApp()).render({ force: true });
  }

  static DEFAULT_OPTIONS = {
    id: "casino-dnd-app",
    classes: ["casino-dnd-app"],
    tag: "div",
    window: { title: "Casino DnD", icon: "fa-solid fa-dice", resizable: true },
    position: { width: 500, height: "auto" },
    actions: {
      tab: CasinoApp._onTab,
      spin: CasinoApp._onSpin,
      importPool: CasinoApp._onImportPool,
      exportPool: CasinoApp._onExportPool,
      deletePool: CasinoApp._onDeletePool,
      copyEntry: CasinoApp._onCopyEntry,
      copyItem: CasinoApp._onCopyItem,
      replay: CasinoApp._onReplay,
      clearHistory: CasinoApp._onClearHistory
    }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/casino.hbs` } };

  constructor(options = {}) {
    super(options);
    const saved = game.settings.get(MODULE_ID, "panelState") ?? {};
    this.state = {
      tab: "draw", sourceId: "builtin:tresor-donjon", count: 1, recipient: "", mode: "roulette",
      luck: 0, minRarity: "common", unique: false, forced: "", ...saved
    };
    this.state.tab = "draw";
    this.state.forced = "";
  }

  _saveState() {
    const { tab, forced, ...rest } = this.state;
    game.settings.set(MODULE_ID, "panelState", rest);
  }

  async _prepareContext() {
    const s = this.state;
    const sources = await listSources();
    if (!sources.some((x) => x.id === s.sourceId)) s.sourceId = sources[0]?.id;
    let pool = null, poolError = null;
    try { pool = await loadPool(s.sourceId); } catch (e) { poolError = e.message; }

    const chars = String(game.settings.get(MODULE_ID, "characters") || "").split(",").map((x) => x.trim()).filter(Boolean);
    const recipients = [{ value: "", label: "👥 Le groupe" }, ...chars.map((c) => ({ value: c, label: c }))];
    if (s.recipient && !chars.includes(s.recipient)) s.recipient = "";

    const counts = {};
    for (const it of pool?.items ?? []) counts[normRarity(it.rarity)] = (counts[normRarity(it.rarity)] ?? 0) + 1;
    const poolInfo = poolError ?? [pool?.description, `${pool?.items.length ?? 0} objets — ` +
      RARITIES.filter((r) => counts[r.key]).map((r) => `${counts[r.key]} ${r.label.toLowerCase()}`).join(", ")]
      .filter(Boolean).join(" · ");

    const forcedOptions = (pool?.items ?? []).map((it, i) => ({ value: String(i), label: `[${rarityInfo(it.rarity).label}] ${it.name.replace(/\{q\}\s*/g, "")}`, rank: RARITIES.findIndex((r) => r.key === normRarity(it.rarity)) }))
      .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

    const history = (game.settings.get(MODULE_ID, "history")?.entries ?? []).map((e) => ({
      id: e.id,
      date: new Date(e.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
      recipient: e.recipient || "Le groupe",
      source: e.source,
      items: e.items.map((it, idx) => ({ idx, name: displayName(it), rarity: normRarity(it.rarity), rarityLabel: rarityInfo(it.rarity).label }))
    }));

    const sel = (list, cur) => list.map((o) => ({ ...o, selected: String(o.value) === String(cur) }));
    return {
      state: s,
      isDraw: s.tab === "draw",
      sources: sources.map((x) => ({ value: x.id, label: x.name, selected: x.id === s.sourceId })),
      isCustom: s.sourceId?.startsWith("custom:"),
      poolInfo,
      recipients: sel(recipients, s.recipient),
      modes: sel([{ value: "roulette", label: "🎡 Roulette (un objet après l'autre)" }, { value: "cards", label: "🃏 Cartes (toutes d'un coup)" }], s.mode),
      rarities: sel(RARITIES.map((r) => ({ value: r.key, label: r.key === "common" ? "Aucune" : `${r.label} ou mieux` })), s.minRarity),
      forcedOptions: sel(forcedOptions, s.forced),
      luckLabel: `${s.luck > 0 ? "+" : ""}${s.luck} ${LUCK_LABELS[String(s.luck)] ?? ""}`,
      history,
      historyCount: history.length,
      hasHistory: history.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    root.querySelectorAll("[name]").forEach((input) => {
      input.addEventListener("change", (ev) => this._onField(ev.currentTarget));
      if (input.name === "luck") {
        input.addEventListener("input", (ev) => {
          const v = Number(ev.currentTarget.value);
          const lbl = root.querySelector(".cdnd-luck-val");
          if (lbl) lbl.textContent = `${v > 0 ? "+" : ""}${v} ${LUCK_LABELS[String(v)] ?? ""}`;
        });
      }
    });
  }

  _onField(input) {
    const { name } = input;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (name === "count") value = Math.max(1, Math.min(10, Number(value) || 1));
    if (name === "luck") value = Number(value) || 0;
    this.state[name] = value;
    this._saveState();
    if (name === "sourceId") { this.state.forced = ""; this.render(); }
  }

  /* ----------------------------- Actions ----------------------------- */

  static _onTab(event, target) {
    this.state.tab = target.dataset.tab;
    this.render();
  }

  static async _onSpin() {
    const s = this.state;
    try {
      await spin({
        sourceId: s.sourceId, count: s.count, recipient: s.recipient || null, mode: s.mode,
        luck: s.luck, minRarity: s.minRarity, unique: s.unique, forced: s.forced !== "" ? [s.forced] : []
      });
      if (s.forced !== "") { s.forced = ""; this.render(); }
    } catch (e) {
      console.error(e);
      ui.notifications.error(`Casino : ${e.message}`);
    }
  }

  static _onImportPool() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const pools = (Array.isArray(data) ? data : [data]).map(validatePool);
        for (const p of pools) await saveCustomPool(p);
        this.state.sourceId = `custom:${pools[0].id}`;
        ui.notifications.info(`Pool importé : ${pools.map((p) => p.name).join(", ")}`);
        this.render();
      } catch (e) {
        ui.notifications.error(`Import impossible : ${e.message}`);
      }
    });
    input.click();
  }

  static async _onExportPool() {
    try {
      const pool = await loadPool(this.state.sourceId);
      const { id, name, description, rarityWeights, flat, items } = pool;
      const clean = { id, name, description, rarityWeights, flat: flat || undefined, items: items.map(({ uid, quantity, ...it }) => it) };
      const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
      save(JSON.stringify(clean, null, 2), "application/json", `casino-${id}.json`);
    } catch (e) {
      ui.notifications.error(e.message);
    }
  }

  static async _onDeletePool() {
    const id = this.state.sourceId?.replace(/^custom:/, "");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Supprimer le pool" },
      content: "<p>Supprimer ce pool importé ? (les pools du module et les tables ne sont pas touchés)</p>"
    });
    if (!ok) return;
    await deleteCustomPool(id);
    this.state.sourceId = "builtin:tresor-donjon";
    this.render();
  }

  static _entry(target) {
    const id = target.closest("[data-entry]")?.dataset.entry;
    return (game.settings.get(MODULE_ID, "history")?.entries ?? []).find((e) => e.id === id);
  }

  static _onCopyEntry(event, target) {
    const e = CasinoApp._entry(target);
    if (e) exportToRoll20(e.items, e.recipient);
  }

  static _onCopyItem(event, target) {
    const e = CasinoApp._entry(target);
    const it = e?.items[Number(target.dataset.idx)];
    if (it) exportToRoll20([it], e.recipient);
  }

  static _onReplay(event, target) {
    const e = CasinoApp._entry(target);
    if (e) replay(e.id);
  }

  static async _onClearHistory() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Vider l'historique" }, content: "<p>Effacer tout l'historique des tirages ?</p>"
    });
    if (!ok) return;
    await game.settings.set(MODULE_ID, "history", { entries: [] });
    this.render();
  }
}
