/**
 * Casino DnD — tableau de session : les coffres proposés, visibles par tous.
 * Pur DOM (aucune dépendance Foundry) : la logique réseau est fournie par callbacks.
 */
import { rarityInfo, RARITY_INDEX, itemIcon } from "./engine.js";
// ROLL20 : import { roll20Command, roll20CommandMulti } from "./engine.js";
import { chestBaseSVG, chestLidSVG, chestInsideSVG, CHEST_TIERS } from "./chest.js";
import { displayName, typeLine, statLine } from "./overlay.js";
import { Presenter, LINES } from "./presenter.js";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

const CHEST_R = ["common", "uncommon", "rare", "veryRare", "legendary"];
const matOf = (item) => CHEST_TIERS[item.chestRarity ? Math.max(0, CHEST_R.indexOf(item.chestRarity)) : Math.min(RARITY_INDEX[item.rarity] ?? 0, CHEST_TIERS.length - 1)];

export class SessionBoard {
  /**
   * @param {object} o
   * @param {boolean} o.isGM
   * @param {(i:number)=>void} o.onOpen          clic sur un coffre fermé
   * @param {(i:number,actorId:string)=>void} o.onGive  « Donner » (actorId vide = reprendre)
   * @param {()=>void} [o.onEnd]                 MJ : terminer la session
   * @param {()=>{id:string,name:string}[]} o.getPjs
   * @param {()=>boolean} [o.canGive]            ce joueur peut-il distribuer ?
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
    state.chests.forEach((c, i) => grid.append(c.opened ? this._openSlot(c, i) : this._closedSlot(i, busy, state.opening === i, CHEST_TIERS[c.tier ?? 0] ?? "wood")));
    panel.append(grid);

    if (this.o.isGM) {
      const foot = el("footer", "cdnd-board-foot");
      /* ROLL20 (en commentaire)
      const assigned = state.chests.filter((c) => c.opened && c.to);
      if (assigned.length) {
        const all = el("button", "cdnd-btn cdnd-gold", "📋 Copier toutes les commandes Roll20");
        all.addEventListener("click", () => this.o.onCopy(roll20CommandMulti(assigned.map((c) => ({ item: c.item, to: c.to })))));
        foot.append(all);
      }
      */
      const given = state.chests.filter((c) => c.given).length;
      const openedN = state.chests.filter((c) => c.opened).length;
      if (openedN) foot.append(el("span", "cdnd-board-count", `🎁 ${given}/${openedN} objet${openedN > 1 ? "s" : ""} donné${given > 1 ? "s" : ""}`));
      if (this.o.onEnd) {
        const end = el("button", "cdnd-btn cdnd-ghost", "Terminer la session");
        end.addEventListener("click", () => this.o.onEnd());
        foot.append(end);
      }
      panel.append(foot);
    }
    root.append(panel);

    // le présentateur, à côté du tableau
    if (this.o.presenterSrc) {
      const host = new Presenter(this.o.presenterSrc, "cdnd-presenter cdnd-board-host");
      host.mount(root);
      const list = opened === total ? LINES.done : LINES.board;
      host.say(busy ? "Chuuut… ça s'ouvre !" : list[opened % list.length], "talk", 0);
    }
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

  _closedSlot(i, busy, opening, mat = "wood") {
    const slot = el("div", `cdnd-slot is-closed m-${mat}${busy ? " is-locked" : ""}${opening ? " is-opening" : ""}`);
    slot.append(this._chestNode(mat, false));
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

    if (c.given) {
      slot.append(el("div", "cdnd-slot-ok", `🎁 Dans la fiche de ${c.to}`));
      if (this.o.isGM) {
        const back = el("button", "cdnd-btn cdnd-small cdnd-ghost", "↩ Reprendre");
        back.title = `Retirer l'objet de la fiche de ${c.to} pour le donner à quelqu'un d'autre`;
        back.addEventListener("click", () => { back.disabled = true; this.o.onGive(i, ""); });
        slot.append(back);
      }
    } else if (this.o.canGive?.() ?? this.o.isGM) {
      const row = el("div", "cdnd-slot-give");
      const sel = el("select", "cdnd-slot-select");
      sel.append(new Option("— Pour quel PJ ? —", ""));
      for (const p of this.o.getPjs()) sel.append(new Option(p.name, p.id));
      const btn = el("button", "cdnd-btn cdnd-small cdnd-gold", "🎁 Donner");
      btn.disabled = true;
      sel.addEventListener("change", () => { btn.disabled = !sel.value; });
      btn.addEventListener("click", () => {
        if (!sel.value) return;
        btn.disabled = true; sel.disabled = true;
        btn.textContent = "…";
        this.o.onGive(i, sel.value);
      });
      row.append(sel, btn);
      slot.append(row);
      if (!this.o.getPjs().length) slot.append(el("div", "cdnd-slot-warn", "Aucun PJ : coche « PJ » sur les fiches de personnage."));
    } else {
      slot.append(el("div", "cdnd-slot-warn", "En attente du MJ pour la distribution."));
    }

    /* ROLL20 (en commentaire) — commande d'import sous le coffre
    if (this.o.isGM || this.o.showCode?.()) {
      if (c.to) {
        const cmd = roll20Command([item], c.to);
        const code = el("div", "cdnd-slot-code");
        const input = el("input");
        input.readOnly = true;
        input.value = cmd;
        input.addEventListener("focus", () => input.select());
        const btn = el("button", "cdnd-btn cdnd-small", "📋");
        btn.title = `Copier la commande pour ${c.to}`;
        btn.addEventListener("click", () => this.o.onCopy(cmd));
        code.append(input, btn);
        slot.append(code);
        slot.append(el("div", "cdnd-slot-ok", `Commande prête pour ${c.to}`));
      } else {
        slot.append(el("div", "cdnd-slot-warn", "Choisis un PJ pour générer la commande Roll20."));
      }
    }
    */
    return slot;
  }
}
