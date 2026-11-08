/**
 * Casino DnD — panneau du MJ (ApplicationV2, Foundry v12+).
 * Onglets : Session (créer / suivre) · PJ (liste des personnages) · Historique.
 */
import { RARITIES, rarityInfo, validatePool, normRarity, roll20CommandMulti } from "./engine.js";
import { displayName, copyText, showCopyBox } from "./overlay.js";
import { MODULE_ID, PKG_PATH, listSources, loadPool, saveCustomPool, deleteCustomPool } from "./sources.js";
import { createSession, endSession, replay, getCharacters, setCharacters } from "./main.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CHEST_ROWS = [
  { key: "common", label: "Bois", rarity: "commun", mat: "wood" },
  { key: "uncommon", label: "Bronze", rarity: "peu commun", mat: "bronze" },
  { key: "rare", label: "Argent", rarity: "rare", mat: "silver" },
  { key: "veryRare", label: "Or", rarity: "très rare", mat: "gold" },
  { key: "legendary", label: "Gemme", rarity: "légendaire", mat: "gem" }
];

const LUCK_LABELS = { "-3": "😭", "-2": "😟", "-1": "😕", "0": "🙂", "1": "😊", "2": "😄", "3": "🤩", "4": "🍀", "5": "👑" };

async function copy(text) {
  if (await copyText(text)) ui.notifications.info("Commande Roll20 copiée. Colle-la dans le chat Roll20 !");
  else showCopyBox(text);
}

export class CasinoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static open() {
    if (!game.user.isGM) return ui.notifications.warn("Le Casino est réservé au MJ.");
    globalThis.CasinoDnD?.board?.minimize();
    (this.instance ??= new CasinoApp()).render({ force: true });
  }

  static DEFAULT_OPTIONS = {
    id: "casino-dnd-app",
    classes: ["casino-dnd-app"],
    tag: "div",
    window: { title: "Casino DnD", icon: "fa-solid fa-dice", resizable: true },
    position: { width: 520, height: 760 },
    actions: {
      casinoTab: CasinoApp._onTab,
      createSession: CasinoApp._onCreateSession,
      endSession: CasinoApp._onEndSession,
      showBoard: CasinoApp._onShowBoard,
      addPj: CasinoApp._onAddPj,
      removePj: CasinoApp._onRemovePj,
      importPool: CasinoApp._onImportPool,
      exportPool: CasinoApp._onExportPool,
      deletePool: CasinoApp._onDeletePool,
      copyEntry: CasinoApp._onCopyEntry,
      copyItem: CasinoApp._onCopyItem,
      replay: CasinoApp._onReplay,
      clearHistory: CasinoApp._onClearHistory
    }
  };

  static PARTS = { main: { template: `${PKG_PATH}/templates/casino.hbs` } };

  constructor(options = {}) {
    super(options);
    const saved = game.settings.get(MODULE_ID, "panelState") ?? {};
    this.casino = {
      sourceId: "", counts: { common: 2, uncommon: 2, rare: 1, veryRare: 0, legendary: 0 },
      mystery: false, unique: true, ...saved, forced: ""
    };
    this.casino.counts = { common: 0, uncommon: 0, rare: 0, veryRare: 0, legendary: 0, ...(this.casino.counts ?? {}) };
    this.tab = getCharacters().length ? "session" : "pj";
  }

  _saveState() {
    const { forced, ...rest } = this.casino;
    game.settings.set(MODULE_ID, "panelState", rest);
  }

  async _prepareContext() {
    const s = this.casino;
    const sources = await listSources();
    if (!sources.some((x) => x.id === s.sourceId)) {
      // par défaut : les objets du PDF s'ils sont installés
      s.sourceId = (sources.find((x) => x.id === "builtin:mythical-ink") ?? sources[0])?.id;
    }
    let pool = null, poolError = null;
    try { pool = await loadPool(s.sourceId); } catch (e) { poolError = e.message; }

    const counts = {};
    for (const it of pool?.items ?? []) counts[normRarity(it.rarity)] = (counts[normRarity(it.rarity)] ?? 0) + 1;
    const poolInfo = poolError ?? [pool?.description, `${pool?.items.length ?? 0} objets — ` +
      RARITIES.filter((r) => counts[r.key]).map((r) => `${counts[r.key]} ${r.label.toLowerCase()}`).join(", ")]
      .filter(Boolean).join(" · ");

    const forcedOptions = (pool?.items ?? [])
      .map((it, i) => ({ value: String(i), label: `[${rarityInfo(it.rarity).label}] ${it.name.replace(/\{q\}\s*/g, "")}`, rank: RARITIES.findIndex((r) => r.key === normRarity(it.rarity)) }))
      .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

    const session = game.settings.get(MODULE_ID, "session") ?? {};
    const opened = (session.chests ?? []).filter((c) => c.opened);

    const history = (game.settings.get(MODULE_ID, "history")?.entries ?? []).map((e) => ({
      id: e.id,
      date: new Date(e.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
      source: e.source,
      items: e.items.map((it, idx) => ({ idx, name: displayName(it), to: it.to || "—", rarity: normRarity(it.rarity), rarityLabel: rarityInfo(it.rarity).label }))
    }));

    const sel = (list, cur) => list.map((o) => ({ ...o, selected: String(o.value) === String(cur) }));
    const pjs = getCharacters();
    return {
      state: s,
      tabSession: this.tab === "session",
      tabPj: this.tab === "pj",
      tabHistory: this.tab === "history",
      pjs: pjs.map((name, i) => ({ name, i })),
      pjCount: pjs.length,
      noPj: !pjs.length,
      sessionActive: !!session.active,
      sessionInfo: session.active ? `${session.source} · ${opened.length}/${session.chests.length} coffres ouverts` : "",
      sessionItems: opened.map((c) => ({ name: displayName(c.item), rarity: normRarity(c.item.rarity), to: c.to || "pas encore attribué" })),
      sources: sources.map((x) => ({ value: x.id, label: x.name, selected: x.id === s.sourceId })),
      isCustom: s.sourceId?.startsWith("custom:"),
      poolInfo,
      rarities: sel(RARITIES.map((r) => ({ value: r.key, label: r.key === "common" ? "Aucune" : `${r.label} ou mieux` })), s.minRarity),
      forcedOptions: sel(forcedOptions, s.forced),
      chestRows: CHEST_ROWS.map((r) => ({ ...r, value: s.counts[r.key] ?? 0, available: counts[r.key] ?? (r.key === "legendary" ? counts.artifact ?? 0 : 0) })),
      chestTotal: Object.values(s.counts).reduce((a, b) => a + (Number(b) || 0), 0),
      history,
      historyCount: history.length,
      hasHistory: history.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", (ev) => this._onField(ev.currentTarget));
      if (input.dataset.field === "luck") {
        input.addEventListener("input", (ev) => {
          const v = Number(ev.currentTarget.value);
          const lbl = root.querySelector(".cdnd-luck-val");
          if (lbl) lbl.textContent = `${v > 0 ? "+" : ""}${v} ${LUCK_LABELS[String(v)] ?? ""}`;
        });
      }
    });
    root.querySelectorAll("[data-field^='count.']").forEach((input) => {
      input.addEventListener("input", (ev) => {
        const key = ev.currentTarget.dataset.field.slice(6);
        const v = Number(ev.currentTarget.value) || 0;
        const lbl = root.querySelector(`[data-count-val="${key}"]`);
        if (lbl) lbl.textContent = String(v);
        const counts = { ...this.casino.counts, [key]: v };
        const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
        root.querySelectorAll("[data-chest-total]").forEach((n) => { n.textContent = String(total); });
      });
    });
    const pjInput = root.querySelector("[data-pj-input]");
    pjInput?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); CasinoApp._onAddPj.call(this); }
    });
  }

  _onField(input) {
    const name = input.dataset.field;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (name.startsWith("count.")) {
      this.casino.counts[name.slice(6)] = Math.max(0, Math.min(10, Number(value) || 0));
      this._saveState();
      return;
    }
    this.casino[name] = value;
    this._saveState();
    if (name === "sourceId") { this.casino.forced = ""; this.render(); }
  }

  /* ----------------------------- Actions ----------------------------- */

  static _onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static async _onCreateSession() {
    const s = this.casino;
    try {
      await createSession({ sourceId: s.sourceId, counts: s.counts, mystery: s.mystery, unique: s.unique, forced: s.forced });
      s.forced = "";
    } catch (e) {
      console.error(e);
      ui.notifications.error(`Casino : ${e.message}`);
    }
  }

  static async _onEndSession() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Terminer la session" },
      content: "<p>Fermer le tableau des coffres pour tout le monde ? Les coffres encore fermés sont perdus. Les objets ouverts restent dans l'historique.</p>"
    });
    if (ok) await endSession();
  }

  static _onShowBoard() { globalThis.CasinoDnD?.showBoard(); }

  static async _onAddPj() {
    const input = this.element.querySelector("[data-pj-input]");
    const name = input?.value.trim();
    if (!name) return;
    await setCharacters([...getCharacters(), name]);
    this.render();
  }

  static async _onRemovePj(event, target) {
    const list = getCharacters();
    list.splice(Number(target.dataset.i), 1);
    await setCharacters(list);
    this.render();
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
        this.casino.sourceId = `custom:${pools[0].id}`;
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
      const pool = await loadPool(this.casino.sourceId);
      const { id, name, description, rarityWeights, flat, items } = pool;
      const clean = { id, name, description, rarityWeights, flat: flat || undefined, items: items.map(({ uid, quantity, ...it }) => it) };
      const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
      save(JSON.stringify(clean, null, 2), "application/json", `casino-${id}.json`);
    } catch (e) {
      ui.notifications.error(e.message);
    }
  }

  static async _onDeletePool() {
    const id = this.casino.sourceId?.replace(/^custom:/, "");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Supprimer le pool" },
      content: "<p>Supprimer ce pool importé ? (les pools du module et les tables ne sont pas touchés)</p>"
    });
    if (!ok) return;
    await deleteCustomPool(id);
    this.casino.sourceId = "builtin:tresor-donjon";
    this.render();
  }

  static _entry(target) {
    const id = target.closest("[data-entry]")?.dataset.entry;
    return (game.settings.get(MODULE_ID, "history")?.entries ?? []).find((e) => e.id === id);
  }

  static _onCopyEntry(event, target) {
    const e = CasinoApp._entry(target);
    if (e) copy(roll20CommandMulti(e.items.map((it) => ({ item: it, to: it.to }))));
  }

  static _onCopyItem(event, target) {
    const e = CasinoApp._entry(target);
    const it = e?.items[Number(target.dataset.idx)];
    if (it) copy(roll20CommandMulti([{ item: it, to: it.to }]));
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
