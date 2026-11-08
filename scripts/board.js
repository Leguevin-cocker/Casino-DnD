/**
 * Casino DnD — tableau de session : les coffres proposés, visibles par tous.
 * Pur DOM (aucune dépendance Foundry) : la logique réseau est fournie par callbacks.
 */
import { rarityInfo, roll20Command, roll20CommandMulti, RARITY_INDEX, itemIcon } from "./engine.js";
import { chestBaseSVG, chestLidSVG, chestInsideSVG, CHEST_TIERS } from "./chest.js";
import { displayName, typeLine, statLine } from "./overlay.js";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

const matOf = (item) => CHEST_TIERS[Math.min(RARITY_INDEX[item.rarity] ?? 0, CHEST_TIERS.length - 1)];

export class SessionBoard {
  /**
   * @param {object} o
   * @param {boolean} o.isGM
   * @param {(i:number)=>void} o.onOpen          clic sur un coffre fermé
   * @param {(i:number,to:string)=>void} o.onAssign  choix du PJ d'un coffre ouvert
   * @param {(text:string)=>void} o.onCopy
   * @param {()=>void} [o.onEnd]                 MJ : terminer la session
   * @param {()=>string[]} o.getCharacters
   * @param {()=>boolean} [o.showCode]           les joueurs voient-ils le code ?
   */
  constructor(o) {
    this.o = o;
    this.root = null;
    this.minimized = false;
    this.state = null;
  }

  destroy() { this.root?.remove(); this.root = null; }
  show() { this.minimized = false; if (this.state) this.render(this.state); }
  minimize() { this.minimized = true; if (this.state) this.render(this.state); }

  render(state) {
    this.state = state;
    if (!state?.active) return this.destroy();
    if (!this.root) {
      this.root = el("div", "cdnd-board");
      document.body.append(this.root);
    }
    const root = this.root;
    root.classList.toggle("is-min", this.minimized);
    root.replaceChildren();

    const opened = state.chests.filter((c) => c.opened).length;
    const total = state.chests.length;
    const busy = state.opening !== null && state.opening !== undefined;

    // pastille quand le tableau est réduit
    const pill = el("button", "cdnd-board-pill", `🎰 Coffres ${opened}/${total}`);
    pill.addEventListener("click", () => { this.minimized = false; this.render(this.state); });
    root.append(pill);

    root.append(el("div", "cdnd-board-bg"));
    const panel = el("div", "cdnd-board-panel");
    const head = el("header", "cdnd-board-head");
    const title = el("div", "cdnd-board-title");
    title.append(el("span", "cdnd-title-emoji", "🎰"), el("span", "cdnd-title-txt", state.title || "Le Casino"));
    head.append(title);
    head.append(el("div", "cdnd-board-sub", `${state.source ? state.source + " · " : ""}${opened}/${total} coffre${total > 1 ? "s" : ""} ouvert${opened > 1 ? "s" : ""}`));
    const min = el("button", "cdnd-board-min", "—");
    min.title = "Réduire";
    min.addEventListener("click", () => { this.minimized = true; this.render(this.state); });
    head.append(min);
    panel.append(head);

    const hint = busy ? "Un coffre est en train de s'ouvrir…"
      : opened === total ? "Tous les coffres sont ouverts !" : "Quand vous êtes prêts : un clic sur un coffre pour l'ouvrir.";
    panel.append(el("div", "cdnd-board-hint", hint));

    const grid = el("div", "cdnd-board-grid");
    grid.style.setProperty("--n", String(Math.min(total, 6)));
    state.chests.forEach((c, i) => grid.append(c.opened ? this._openSlot(c, i) : this._closedSlot(i, busy, state.opening === i)));
    panel.append(grid);

    if (this.o.isGM) {
      const foot = el("footer", "cdnd-board-foot");
      const assigned = state.chests.filter((c) => c.opened);
      if (assigned.length) {
        const all = el("button", "cdnd-btn cdnd-gold", "📋 Copier toutes les commandes Roll20");
        all.addEventListener("click", () => this.o.onCopy(roll20CommandMulti(assigned.map((c) => ({ item: c.item, to: c.to })))));
        foot.append(all);
      }
      if (this.o.onEnd) {
        const end = el("button", "cdnd-btn cdnd-ghost", "Terminer la session");
        end.addEventListener("click", () => this.o.onEnd());
        foot.append(end);
      }
      panel.append(foot);
    }
    root.append(panel);
  }

  _chestNode(mat, open, item) {
    const box = el("div", `cdnd-slot-chest${open ? " is-open" : ""}`);
    box.dataset.mat = mat;
    const lid = el("div", "cdnd-slot-lid");
    if (open) {
      const front = el("div", "cdnd-lid-face cdnd-lid-front");
      front.innerHTML = chestLidSVG(mat);
      const back = el("div", "cdnd-lid-face cdnd-lid-back");
      back.innerHTML = chestInsideSVG(mat);
      lid.append(front, back);
    } else lid.innerHTML = chestLidSVG(mat);
    const base = el("div", "cdnd-slot-base");
    base.innerHTML = chestBaseSVG(mat);
    box.append(lid, base);
    if (open && item) {
      const prize = el("div", "cdnd-slot-prize");
      if (item.img) { const img = el("img"); img.src = item.img; img.alt = ""; prize.append(img); }
      else prize.textContent = itemIcon(item);
      box.append(prize);
    }
    return box;
  }

  _closedSlot(i, busy, opening) {
    const slot = el("div", `cdnd-slot is-closed${busy ? " is-locked" : ""}${opening ? " is-opening" : ""}`);
    slot.append(this._chestNode("wood", false));
    slot.append(el("div", "cdnd-slot-num", `Coffre n°${i + 1}`));
    if (!busy) {
      slot.title = "Ouvrir ce coffre";
      slot.addEventListener("click", () => {
        if (slot.classList.contains("is-clicked")) return;
        slot.classList.add("is-clicked");
        this.o.onOpen(i);
      });
    }
    return slot;
  }

  _openSlot(c, i) {
    const { item } = c;
    const r = rarityInfo(item.rarity);
    const slot = el("div", `cdnd-slot is-open r-${item.rarity}`);
    slot.append(this._chestNode(matOf(item), true, item));
    const name = el("div", "cdnd-slot-name", displayName(item));
    name.title = [statLine(item), item.description].filter(Boolean).join("\n\n");
    slot.append(name);
    slot.append(el("div", "cdnd-slot-rarity", `${r.label} · ${typeLine(item)}`));
    if (c.openedBy) slot.append(el("div", "cdnd-slot-by", `Coffre n°${i + 1} · ouvert par ${c.openedBy}`));

    const sel = el("select", "cdnd-slot-select");
    sel.append(new Option("— Pour quel PJ ? —", ""));
    const chars = this.o.getCharacters();
    for (const n of chars) sel.append(new Option(n, n));
    if (c.to && !chars.includes(c.to)) sel.append(new Option(c.to, c.to));
    sel.value = c.to || "";
    sel.addEventListener("change", () => this.o.onAssign(i, sel.value));
    slot.append(sel);

    if (this.o.isGM || this.o.showCode?.()) {
      const cmd = roll20Command([item], c.to || null);
      const code = el("div", "cdnd-slot-code");
      const input = el("input");
      input.readOnly = true;
      input.value = cmd;
      input.addEventListener("focus", () => input.select());
      const btn = el("button", "cdnd-btn cdnd-small", "📋");
      btn.title = c.to ? `Copier la commande pour ${c.to}` : "Copier la commande (choisis d'abord un PJ pour remplir sa fiche)";
      btn.addEventListener("click", () => this.o.onCopy(cmd));
      code.append(input, btn);
      slot.append(code);
      if (!c.to) slot.append(el("div", "cdnd-slot-warn", "Choisis un PJ pour que l'objet arrive sur sa fiche Roll20."));
    }
    return slot;
  }
}
