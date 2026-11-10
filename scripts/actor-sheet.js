/**
 * Casino — fiche de personnage (système Casino) : case « PJ » + historique du butin reçu.
 * Le nom de l'acteur = le nom du personnage sur Roll20.
 */
import { rarityInfo, normRarity, roll20Command } from "./engine.js";
import { displayName, typeLine, copyText, showCopyBox } from "./overlay.js";
import { MODULE_ID, PKG_PATH } from "./sources.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

/** Un acteur est un PJ du Casino si sa case est cochée (cochée par défaut pour les fiches « pj »). */
export function isPJ(actor) {
  const f = actor?.getFlag?.(MODULE_ID, "isPJ");
  return f === undefined ? actor?.type === "pj" : !!f;
}
export const pjHistory = (actor) => [...(actor?.getFlag?.(MODULE_ID, "history") ?? [])];

async function copy(text) {
  if (await copyText(text)) ui.notifications.info("Commande Roll20 copiée. Colle-la dans le chat Roll20 !");
  else showCopyBox(text);
}

export class CasinoActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["casino-actor-sheet"],
    position: { width: 520, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      copyEntry: CasinoActorSheet._onCopyEntry,
      copyAll: CasinoActorSheet._onCopyAll,
      removeEntry: CasinoActorSheet._onRemoveEntry
    }
  };

  static PARTS = { sheet: { template: `${PKG_PATH}/templates/actor-sheet.hbs` } };

  async _prepareContext(options) {
    const actor = this.document;
    const history = pjHistory(actor)
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
      .map((e) => {
        const r = rarityInfo(e.item?.rarity);
        return {
          id: e.id,
          name: displayName(e.item ?? { name: "?" }),
          img: e.item?.img,
          rarity: normRarity(e.item?.rarity),
          rarityLabel: r.label,
          type: e.item ? typeLine(e.item) : "",
          date: new Date(e.date ?? Date.now()).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
          source: e.source ?? "",
          chest: e.chest ? `Coffre n°${e.chest}` : "",
          openedBy: e.openedBy ? `ouvert par ${e.openedBy}` : ""
        };
      });
    return {
      actor,
      name: actor.name,
      img: actor.img,
      isPJ: isPJ(actor),
      pjField: `flags.${MODULE_ID}.isPJ`,
      editable: this.isEditable,
      isGM: game.user.isGM,
      history,
      hasHistory: history.length > 0,
      count: history.length
    };
  }

  _entry(target) {
    const id = target.closest("[data-entry]")?.dataset.entry;
    return pjHistory(this.document).find((e) => e.id === id);
  }

  static _onCopyEntry(event, target) {
    const e = this._entry(target);
    if (e?.item) copy(roll20Command([e.item], this.document.name));
  }

  static _onCopyAll() {
    const items = pjHistory(this.document).map((e) => e.item).filter(Boolean);
    if (items.length) copy(roll20Command(items, this.document.name));
  }

  static async _onRemoveEntry(event, target) {
    const id = target.closest("[data-entry]")?.dataset.entry;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Retirer de l'historique" },
      content: "<p>Retirer cet objet de l'historique de ce personnage ?</p>"
    });
    if (!ok) return;
    await this.document.setFlag(MODULE_ID, "history", pjHistory(this.document).filter((e) => e.id !== id));
  }
}

/** Ajoute / retire une attribution dans l'historique des fiches (appelé par le MJ). */
export async function moveHistoryEntry(entry, fromName, toName) {
  const find = (name) => name ? (game.actors.find((a) => a.name === name && isPJ(a)) ?? game.actors.getName(name)) : null;
  const from = find(fromName);
  if (from) await from.setFlag(MODULE_ID, "history", pjHistory(from).filter((e) => e.id !== entry.id));
  const to = find(toName);
  if (to) await to.setFlag(MODULE_ID, "history", [...pjHistory(to).filter((e) => e.id !== entry.id), entry]);
  return { from, to };
}
