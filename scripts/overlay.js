/**
 * Casino DnD — l'écran d'animation (roulette, cartes, révélation, récap).
 * DOM + canvas pur : fonctionne dans Foundry comme dans la démo.
 */
import { RARITY_INDEX, rarityInfo, typeInfo, itemIcon, normRarity } from "./engine.js";
import { Sfx } from "./sfx.js";
import { CHEST_TIERS, CHEST_LABELS, chestBaseSVG, chestLidSVG, chestInsideSVG } from "./chest.js";
import { curtainDataURL, sideDrapeDataURL, valanceDataURL, floorDataURL } from "./curtain.js";
import { Presenter, LINES, pick } from "./presenter.js";

const MAT_COLORS = { wood: "#c08a4a", bronze: "#e8995a", silver: "#e6eef6", gold: "#ffcf4a", gem: "#c58bff" };

const DAMAGE_FR = {
  slashing: "tranchant", piercing: "perforant", bludgeoning: "contondant", fire: "feu", cold: "froid",
  lightning: "foudre", thunder: "tonnerre", acid: "acide", poison: "poison", necrotic: "nécrotique",
  radiant: "radiant", force: "force", psychic: "psychique"
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

function iconNode(item, cls = "cdnd-icon") {
  const wrap = el("div", cls);
  if (item.img) {
    const img = el("img");
    img.src = item.img;
    img.alt = "";
    img.onerror = () => { img.remove(); wrap.textContent = typeInfo(item.type).icon; };
    wrap.append(img);
  } else wrap.textContent = itemIcon(item);
  return wrap;
}

export function displayName(item) {
  const q = Number(item.quantity) || 1;
  if (q > 1 && !String(item.name).includes(String(q))) return `${item.name} ×${q}`;
  return item.name;
}

export function typeLine(item) {
  const parts = [typeInfo(item.type).label];
  if (item.subtype) parts.push(item.subtype);
  if (item.attunement) parts.push(item.attunement === true ? "Harmonisation requise" : `Harmonisation (${item.attunement})`);
  return parts.join(" · ");
}

export function statLine(item) {
  const parts = [];
  if (item.damage) {
    const b = Number(item.bonus) || 0;
    const dt = item.damageType ? " " + (DAMAGE_FR[String(item.damageType).toLowerCase()] ?? item.damageType) : "";
    parts.push(`🗡️ ${item.damage}${b ? ` + ${b}` : ""}${dt}`);
  }
  if (item.ac) parts.push(`🛡️ CA ${item.ac}${Number(item.bonus) ? ` + ${item.bonus}` : ""}`);
  if (item.range) parts.push(`🎯 ${item.range}`);
  if (item.properties) parts.push(item.properties);
  return parts.join("   ");
}

/* ------------------------------------------------------------------ */
/* Particules                                                           */
/* ------------------------------------------------------------------ */
class Fx {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.p = [];
    this.running = false;
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.c.width = window.innerWidth * dpr;
    this.c.height = window.innerHeight * dpr;
  }
  _add(p) {
    if (this.p.length > 900) return;
    this.p.push(p);
    if (!this.running) { this.running = true; requestAnimationFrame((t) => this._loop(t)); }
  }
  burst(x, y, colors, { count = 50, speed = 7, life = 1.1, gravity = 0.12, size = 3, shape = "spark" } = {}) {
    colors = [].concat(colors);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this._add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity, life: life * (0.6 + Math.random() * 0.6),
        age: 0, color: colors[i % colors.length], size: size * (0.5 + Math.random()), shape, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
  }
  confetti(colors, count = 160) {
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      this._add({ x: Math.random() * w, y: -20 - Math.random() * window.innerHeight * 0.5, vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3, g: 0.03, life: 4 + Math.random() * 2, age: 0, color: colors[i % colors.length],
        size: 5 + Math.random() * 5, shape: "confetti", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, drag: 0.995 });
    }
  }
  fountain(x, y, colors, count = 80) {
    for (let i = 0; i < count; i++) {
      this._add({ x, y, vx: (Math.random() - 0.5) * 7, vy: -6 - Math.random() * 9, g: 0.22, life: 2 + Math.random(),
        age: 0, color: colors[i % colors.length], size: 4 + Math.random() * 4, shape: i % 3 ? "confetti" : "spark",
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
  }
  _loop(t) {
    const dt = this._last ? Math.min(0.05, (t - this._last) / 1000) : 1 / 60;
    this._last = t;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    const k = dt * 60;
    this.p = this.p.filter((p) => (p.age += dt) < p.life);
    for (const p of this.p) {
      p.vy += p.g * k;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.5));
      ctx.fillStyle = p.color;
      if (p.shape === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(p.rot * 2))));
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade + 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
    if (this.p.length) requestAnimationFrame((tt) => this._loop(tt));
    else { this.running = false; this._last = 0; ctx.clearRect(0, 0, this.c.width, this.c.height); }
  }
  destroy() {
    window.removeEventListener("resize", this._onResize);
    this.p = [];
  }
}

const GOLD = ["#ffd75e", "#ffb31a", "#fff3c4", "#ff8a00"];

/* ------------------------------------------------------------------ */
/* Overlay                                                              */
/* ------------------------------------------------------------------ */
export class LootOverlay {
  /**
   * @param {object} opts
   * @param {number} [opts.volume]
   * @param {boolean} [opts.isGM]       affiche les boutons d'export
   * @param {Function} [opts.onExport]  (items) => void
   * @param {Function} [opts.onCloseAll] () => void (MJ : fermer chez tout le monde)
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.sfx = new Sfx(opts.volume ?? 0.6);
    this._waiters = new Set();
    this.root = null;
  }

  get isOpen() { return !!this.root; }

  setVolume(v) { this.sfx.volume = v; }

  _wait(ms) {
    if (this._skip || this._closed) return Promise.resolve();
    return new Promise((res) => {
      const done = () => { clearTimeout(t); this._waiters.delete(done); res(); };
      const t = setTimeout(done, ms);
      this._waiters.add(done);
    });
  }
  _advance() { for (const w of [...this._waiters]) w(); }
  skip() { this._skip = true; this._advance(); }

  close() {
    this._closed = true;
    this._advance();
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    this.fx?.destroy();
    root.classList.add("cdnd-closing");
    document.body.classList.remove("cdnd-playing");
    setTimeout(() => root.remove(), 400);
  }

  _build(payload) {
    const root = el("div", "cdnd-overlay");
    root.innerHTML = `
      <div class="cdnd-bg"><div class="cdnd-bg-glow"></div><div class="cdnd-bg-felt"></div></div>
      <div class="cdnd-stageframe">
        <div class="cdnd-spot"></div><div class="cdnd-floor"></div>
        <div class="cdnd-drape cdnd-left"></div><div class="cdnd-drape cdnd-right"></div><div class="cdnd-valance"></div>
      </div>
      <canvas class="cdnd-fx"></canvas>
      <div class="cdnd-curtain"><div class="cdnd-curtain-title"></div></div>
      <div class="cdnd-stage">
        <header class="cdnd-head">
          <div class="cdnd-title"></div>
          <div class="cdnd-sub"></div>
        </header>
        <main class="cdnd-content"></main>
        <footer class="cdnd-foot"></footer>
      </div>`;
    const title = root.querySelector(".cdnd-title");
    title.append(el("span", "cdnd-title-emoji", "🎰"),
      el("span", "cdnd-title-txt", String(payload.title || "Le Casino").replace(/^[\p{Extended_Pictographic}️\s]+/u, "")));
    this.$sub = root.querySelector(".cdnd-sub");
    this.$content = root.querySelector(".cdnd-content");
    this.$foot = root.querySelector(".cdnd-foot");
    this.$stage = root.querySelector(".cdnd-stage");
    const skip = el("button", "cdnd-btn cdnd-ghost", "Passer ⏩");
    skip.addEventListener("click", () => this.skip());
    this.$foot.append(skip);
    const bg = (sel, url) => { const n = root.querySelector(sel); if (n) n.style.backgroundImage = `url(${url})`; };
    bg(".cdnd-valance", valanceDataURL());
    bg(".cdnd-floor", floorDataURL());
    root.querySelectorAll(".cdnd-drape").forEach((d) => { d.style.backgroundImage = `url(${sideDrapeDataURL()})`; });
    bg(".cdnd-curtain", curtainDataURL());
    root.querySelector(".cdnd-curtain-title").textContent = String(payload.title || "Le Casino").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
    this.$curtain = root.querySelector(".cdnd-curtain");
    document.body.append(root);
    document.body.classList.add("cdnd-playing");
    this.presenter = new Presenter(this.opts.presenterSrc);
    this.presenter.mount(root);
    this.root = root;
    this.fx = new Fx(root.querySelector(".cdnd-fx"));
  }

  _setSub(recipient, i, n) {
    if (this.payload?.subtitle) { this.$sub.textContent = this.payload.subtitle; return; }
    const who = recipient ? `Pour ${recipient}` : "Pour le groupe";
    this.$sub.textContent = n > 1 && i ? `${who} · Tirage ${i}/${n}` : who;
  }

  _shake(strength = 1) {
    this.$stage.style.setProperty("--shake", strength);
    this.$stage.classList.remove("cdnd-shake");
    void this.$stage.offsetWidth;
    this.$stage.classList.add("cdnd-shake");
  }
  _flash(color) {
    const f = el("div", "cdnd-flash");
    f.style.setProperty("--fc", color);
    this.root.append(f);
    setTimeout(() => f.remove(), 900);
  }

  _celebrate(item, x, y) {
    const r = RARITY_INDEX[item.rarity];
    const c = rarityInfo(item.rarity).color;
    if (this._skip) return;
    this.fx.burst(x, y, [c, "#ffffff"], { count: 30 + r * 30, speed: 5 + r * 2 });
    if (r >= 2) this.fx.fountain(x, y, [c, "#ffffff", c]);
    if (r >= 3) { this._flash(c); this._shake(r - 2); }
    if (r >= 4) { this.fx.confetti([...GOLD, c]); setTimeout(() => this.fx?.confetti(GOLD, 100), 900); }
  }

  async _curtainDown() {
    if (this._skip || this._closed || !this.$curtain) return;
    this.$curtain.classList.add("is-down");
    this.sfx.whoosh();
    await this._wait(620);
    if (!this._skip) { this.sfx.thud(); this._shake(0.4); }
    await this._wait(200);
  }
  async _curtainUp() {
    if (!this.$curtain) return;
    this.$curtain.classList.remove("is-down");
    if (this._skip || this._closed) return;
    this.sfx.whoosh();
    await this._wait(850);
  }
  _say(text, mood) { this.presenter?.say(text, mood); }

  /** Lance l'animation complète. Résout quand le récap est affiché. */
  async play(payload) {
    if (this.root) { this.root.remove(); this.root = null; this.fx?.destroy(); document.body.classList.remove("cdnd-playing"); }
    this._skip = false;
    this._closed = false;
    this.payload = payload;
    this._build(payload);
    const results = payload.results || [];
    this._setSub(payload.recipient, 0, results.length);
    this.root.classList.add("cdnd-intro");
    await this._curtainDown();
    this._say(pick(LINES.intro), "excited");
    await this._wait(1900);
    await this._curtainUp();
    this._say(pick(LINES.start));
    if (payload.mode === "cards") {
      await this._cards(results, payload);
    } else {
      const step = payload.mode === "roulette" ? (r) => this._roulette(r, payload) : (r) => this._chest(r);
      for (let i = 0; i < results.length; i++) {
        if (this._closed) return;
        this._setSub(payload.recipient, i + 1, results.length);
        await step(results[i]);
      }
    }
    if (this._closed) return;
    if (payload.noSummary) {
      this._say(pick(LINES.outro));
      await this._curtainDown();
      await this._wait(700);
      this.close();
      return;
    }
    this._summary(results.map((r) => r.item), payload);
  }

  /* ---------------------------- Roulette ---------------------------- */

  _miniCard(c) {
    const card = el("div", `cdnd-mini r-${normRarity(c.rarity)}`);
    card.append(iconNode(c));
    card.append(el("div", "cdnd-mini-name", c.name.replace(/\{q\}\s*/g, "")));
    return card;
  }

  async _roulette(result, payload) {
    const { item, strip } = result;
    const winIndex = result.winIndex ?? strip.findIndex((s) => s.name === item.name);
    const r = RARITY_INDEX[item.rarity];
    this.$content.replaceChildren();
    const reel = el("div", "cdnd-reel");
    const track = el("div", "cdnd-track");
    const needle = el("div", "cdnd-needle");
    reel.append(track, needle, el("div", "cdnd-reel-shade"));
    const cards = strip.map((c) => this._miniCard(c));
    track.append(...cards);
    this.$content.append(reel);
    await frame();

    const reelW = reel.clientWidth;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    const cardW = cards[0].offsetWidth;
    const center = (i) => cards[i].offsetLeft + cardW / 2 - reelW / 2;
    const jitter = (Math.random() - 0.5) * cardW * 0.8;
    const target = center(winIndex) + jitter;
    const duration = (payload.duration ?? 6) * 1000 + (r >= 4 ? 1800 : r >= 3 ? 900 : 0);

    this.sfx.whoosh();
    let last = -1, lastBeat = 0;
    await new Promise((resolve) => {
      const start = performance.now();
      const tickFrame = (now) => {
        if (this._closed) return resolve();
        let t = Math.min(1, (now - start) / duration);
        if (this._skip) t = 1;
        // ease-out quintique : démarre vite, finit en suspense
        const e = 1 - Math.pow(1 - t, 5);
        const x = target * e;
        track.style.transform = `translate3d(${-x}px,0,0)`;
        const idx = Math.max(0, Math.min(cards.length - 1, Math.round((x + reelW / 2 - cards[0].offsetLeft - cardW / 2) / step)));
        if (idx !== last) {
          last = idx;
          const ri = RARITY_INDEX[strip[idx].rarity] ?? 0;
          if (!this._skip) this.sfx.tick(ri);
          needle.style.setProperty("--nc", rarityInfo(strip[idx].rarity).color);
        }
        if (r >= 3 && t > 0.72 && t < 1 && now - lastBeat > 650) { lastBeat = now; this.sfx.heartbeat(); }
        if (t < 1) requestAnimationFrame(tickFrame);
        else resolve();
      };
      requestAnimationFrame(tickFrame);
    });
    if (this._closed) return;

    // petit recentrage façon « clac »
    track.style.transition = "transform 420ms cubic-bezier(.3,1.6,.5,1)";
    track.style.transform = `translate3d(${-center(winIndex)}px,0,0)`;
    reel.classList.add("is-landed");
    cards[winIndex].classList.add("is-win");
    needle.style.setProperty("--nc", rarityInfo(item.rarity).color);
    this.sfx.land(r);
    await this._wait(160);
    const rect = cards[winIndex].getBoundingClientRect();
    this._celebrate({ ...item, rarity: r >= 3 ? "rare" : item.rarity }, rect.left + rect.width / 2, rect.top + rect.height / 2);
    await this._wait(r >= 3 ? 1100 : 750);
    await this._reveal(item);
  }

  /* ---------------------------- Coffres ----------------------------- */

  /**
   * Un coffre en bois tombe, puis monte en gamme (bronze, argent, or, gemme)
   * jusqu'à la rareté de l'objet, parfois avec une tentative ratée, et s'ouvre.
   */
  async _chest(result) {
    const { item } = result;
    const r = RARITY_INDEX[item.rarity];
    const target = Math.min(r, CHEST_TIERS.length - 1);

    const scene = el("div", `cdnd-chest-scene r-${item.rarity}`);
    const chest = el("div", "cdnd-chest");
    const aura = el("div", "cdnd-chest-aura");
    const light = el("div", "cdnd-chest-light");
    const prize = iconNode(item, "cdnd-chest-prize");
    const base = el("div", "cdnd-chest-base");
    const lid = el("div", "cdnd-chest-lid");
    const lidFront = el("div", "cdnd-lid-face cdnd-lid-front");
    const lidBack = el("div", "cdnd-lid-face cdnd-lid-back");
    lid.append(lidFront, lidBack);
    chest.append(aura, light, prize, base, lid);
    const label = el("div", "cdnd-chest-label");
    const dropper = el("div", "cdnd-chest-dropper");
    dropper.append(chest);
    scene.append(dropper, label);

    const setMat = (mat) => {
      chest.dataset.mat = mat;
      chest.style.setProperty("--mc", MAT_COLORS[mat]);
      base.innerHTML = chestBaseSVG(mat);
      lidFront.innerHTML = chestLidSVG(mat);
      lidBack.innerHTML = chestInsideSVG(mat);
      label.textContent = CHEST_LABELS[mat];
      label.style.setProperty("--mc", MAT_COLORS[mat]);
    };
    const center = () => {
      const b = chest.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height * 0.55];
    };
    const pop = () => { chest.classList.remove("is-pop"); void chest.offsetWidth; chest.classList.add("is-pop"); };

    setMat(this._skip ? CHEST_TIERS[target] : "wood");
    this.$content.replaceChildren(scene);
    await frame();
    dropper.classList.add("is-dropped");
    await this._wait(420);
    if (!this._skip) { this.sfx.thud(); this._shake(0.5); }
    await this._wait(650);

    for (let lvl = 1; lvl <= target && !this._skip && !this._closed; lvl++) {
      const mat = CHEST_TIERS[lvl];
      chest.style.setProperty("--next", MAT_COLORS[mat]);
      chest.style.setProperty("--charge", String(lvl));
      chest.classList.add("is-charging");
      this.sfx.charge(lvl);
      if (lvl >= 3) { this.sfx.heartbeat(); setTimeout(() => !this._skip && this.sfx.heartbeat(), 700); }
      await this._wait(lvl >= 4 ? 1500 : lvl >= 3 ? 1150 : 900);
      chest.classList.remove("is-charging");
      if (this._skip) break;
      this._flash(MAT_COLORS[mat]);
      setMat(mat);
      pop();
      this.sfx.upgrade(lvl);
      this._say(pick(LINES[mat] ?? LINES.bronze), lvl >= 3 ? "excited" : "talk");
      const [x, y] = center();
      this.fx.burst(x, y, [MAT_COLORS[mat], "#ffffff"], { count: 40 + lvl * 25, speed: 5 + lvl * 1.5 });
      if (lvl >= 3) this._shake(lvl - 2);
      if (lvl >= 4) this.fx.confetti([...GOLD, "#c9fbff", "#ff5fd2", "#8a6bff"]);
      await this._wait(lvl >= 4 ? 1100 : 700);
    }

    // « Allez… encore un… » : fausse montée en gamme
    if (!this._skip && !this._closed && target < CHEST_TIERS.length - 1 && Math.random() < 0.45) {
      chest.style.setProperty("--next", MAT_COLORS[CHEST_TIERS[target + 1]]);
      chest.style.setProperty("--charge", String(target + 1));
      chest.classList.add("is-charging");
      this.sfx.charge(target + 1);
      await this._wait(950);
      chest.classList.remove("is-charging");
      chest.classList.add("is-fizzle");
      this.sfx.fizzle();
      this._say(pick(LINES.fizzle), "sad");
      const [x, y] = center();
      this.fx.burst(x, y - 40, ["#777", "#999", "#555"], { count: 30, speed: 2.5, gravity: -0.05, size: 6, life: 1.4 });
      await this._wait(800);
      chest.classList.remove("is-fizzle");
    }
    if (this._skip) setMat(CHEST_TIERS[target]);
    if (this._closed) return;

    // ouverture
    chest.classList.add("is-rattle");
    await this._wait(520);
    chest.classList.remove("is-rattle");
    chest.style.setProperty("--rc-open", rarityInfo(item.rarity).color);
    chest.classList.add("is-open");
    this._say(pick(LINES.open[item.rarity] ?? LINES.open.common), r >= 3 ? "excited" : r === 0 ? "sad" : "talk");
    if (!this._skip) {
      this.sfx.creak();
      this.sfx.land(r);
      await sleep(280);
      const [x, y] = center();
      this._celebrate(r >= 3 ? { ...item, rarity: "rare" } : item, x, y - 30);
    }
    await this._wait(r >= 3 ? 1400 : 1100);
    await this._reveal(item);
  }

  /* ---------------------------- Révélation -------------------------- */

  _bigCard(item, small = false) {
    const ri = rarityInfo(item.rarity);
    const card = el("div", `cdnd-card3d r-${item.rarity}${small ? " is-small" : ""}`);
    const inner = el("div", "cdnd-card-inner");
    const back = el("div", "cdnd-face cdnd-back");
    back.innerHTML = `<div class="cdnd-back-art"><span>🎲</span></div>`;
    const front = el("div", "cdnd-face cdnd-front");
    front.append(el("div", "cdnd-card-rarity", ri.label));
    front.append(iconNode(item, "cdnd-card-icon"));
    front.append(el("div", "cdnd-card-name", displayName(item)));
    front.append(el("div", "cdnd-card-type", typeLine(item)));
    if (!small) {
      const stats = statLine(item);
      if (stats) front.append(el("div", "cdnd-card-stats", stats));
      if (item.description) front.append(el("div", "cdnd-card-desc", item.description));
      const meta = [];
      if (item.value) meta.push(`💰 ${item.value}`);
      if (item.weight) meta.push(`⚖️ ${item.weight} lb`);
      if (meta.length) front.append(el("div", "cdnd-card-meta", meta.join("    ")));
    }
    inner.append(back, front);
    card.append(inner);
    return card;
  }

  async _reveal(item) {
    if (this._skip || this._closed) return;
    const r = RARITY_INDEX[item.rarity];
    const wrap = el("div", `cdnd-reveal r-${item.rarity}`);
    if (r >= 3) wrap.append(el("div", "cdnd-rays"));
    wrap.append(el("div", "cdnd-halo"));
    const card = this._bigCard(item);
    wrap.append(card);
    wrap.append(el("div", "cdnd-hint", "clic pour continuer"));
    wrap.addEventListener("click", () => this._advance());
    this.root.append(wrap);
    await frame();
    wrap.classList.add("is-in");
    this.sfx.deal();
    await this._wait(r >= 3 ? 900 : 500);
    card.classList.add("is-flipped");
    this.sfx.flip();
    this.sfx.reveal(r);
    await sleep(250);
    const rect = card.getBoundingClientRect();
    if (!this._skip) this._celebrate(item, rect.left + rect.width / 2, rect.top + rect.height / 2);
    await this._wait(3000 + r * 900);
    wrap.classList.add("is-out");
    await sleep(350);
    wrap.remove();
  }

  /* ---------------------------- Cartes ------------------------------ */

  async _cards(results, payload) {
    this._setSub(payload.recipient, 0, results.length);
    const hand = el("div", "cdnd-hand");
    hand.style.setProperty("--n", results.length);
    const cards = results.map(({ item }, i) => {
      const c = this._bigCard(item, true);
      c.style.setProperty("--i", i);
      c.style.setProperty("--rc", rarityInfo(item.rarity).color);
      hand.append(c);
      return c;
    });
    this.$content.replaceChildren(hand);
    await frame();
    hand.classList.add("is-dealt");
    for (let i = 0; i < cards.length; i++) setTimeout(() => !this._skip && this.sfx.deal(), i * 140);
    await this._wait(700 + cards.length * 140);

    for (let i = 0; i < cards.length; i++) {
      if (this._closed) return;
      const { item } = results[i];
      const r = RARITY_INDEX[item.rarity];
      const c = cards[i];
      this._setSub(payload.recipient, i + 1, results.length);
      if (this._skip) { c.classList.add("is-flipped"); continue; }
      c.classList.add("is-tease");
      c.style.setProperty("--tease", String(0.25 + r * 0.25));
      if (r >= 3) { this.sfx.heartbeat(); setTimeout(() => !this._skip && this.sfx.heartbeat(), 700); }
      await this._wait(r >= 3 ? 1500 : r >= 2 ? 1000 : 650);
      c.classList.remove("is-tease");
      c.classList.add("is-flipped");
      this.sfx.flip();
      this.sfx.reveal(r);
      const rect = c.getBoundingClientRect();
      this._celebrate(r >= 3 ? { ...item, rarity: "rare" } : item, rect.left + rect.width / 2, rect.top + rect.height / 2);
      await this._wait(r >= 3 ? 900 : 550);
      if (r >= 3) await this._reveal(item);
    }
    await this._wait(1300);
  }

  /* ---------------------------- Récap ------------------------------- */

  _summary(items, payload) {
    this.$sub.textContent = payload.recipient ? `Butin de ${payload.recipient}` : "Butin du groupe";
    const box = el("div", "cdnd-summary");
    box.append(el("div", "cdnd-summary-title", "✨ Butin ✨"));
    const list = el("div", "cdnd-loot-list");
    const best = Math.max(...items.map((i) => RARITY_INDEX[i.rarity] ?? 0));
    items.forEach((item, i) => {
      const row = el("div", `cdnd-loot r-${item.rarity}`);
      row.style.setProperty("--i", i);
      row.append(iconNode(item, "cdnd-loot-icon"));
      const txt = el("div", "cdnd-loot-txt");
      txt.append(el("div", "cdnd-loot-name", displayName(item)));
      txt.append(el("div", "cdnd-loot-type", `${rarityInfo(item.rarity).label} · ${typeLine(item)}`));
      const desc = el("div", "cdnd-loot-desc");
      const stats = statLine(item);
      if (stats) desc.append(el("div", "cdnd-loot-stats", stats));
      if (item.description) desc.append(el("div", null, item.description));
      const meta = [item.value && `💰 ${item.value}`, item.weight && `⚖️ ${item.weight} lb`].filter(Boolean).join("   ");
      if (meta) desc.append(el("div", "cdnd-loot-meta", meta));
      txt.append(desc);
      row.append(txt);
      row.addEventListener("click", (ev) => { if (!ev.target.closest("button")) row.classList.toggle("is-open"); });
      if (this.opts.isGM && this.opts.onExport) {
        const b = el("button", "cdnd-btn cdnd-small", "📋 Roll20");
        b.title = "Copier la commande d'import Roll20 pour cet objet";
        b.addEventListener("click", () => this.opts.onExport([item], payload));
        row.append(b);
      }
      list.append(row);
    });
    box.append(list);
    this.$content.replaceChildren(box);

    this.$foot.replaceChildren();
    if (this.opts.isGM && this.opts.onExport && items.length) {
      const all = el("button", "cdnd-btn cdnd-gold", "📋 Tout copier pour Roll20");
      all.addEventListener("click", () => this.opts.onExport(items, payload));
      this.$foot.append(all);
    }
    if (this.opts.isGM && this.opts.onCloseAll) {
      const ca = el("button", "cdnd-btn", "Fermer pour tous");
      ca.addEventListener("click", () => { this.opts.onCloseAll(); this.close(); });
      this.$foot.append(ca);
    }
    const close = el("button", "cdnd-btn cdnd-ghost", "Fermer");
    close.addEventListener("click", () => this.close());
    this.$foot.append(close);
    if (!this._skip && best >= 1) this.sfx.reveal(Math.min(best, 2));
  }
}

/* ------------------------------------------------------------------ */
/* Copie presse-papier (marche aussi en http:// sur un serveur maison)  */
/* ------------------------------------------------------------------ */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* on tente la méthode à l'ancienne */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Fenêtre de secours : le texte, sélectionné, prêt à Ctrl+C. */
export function showCopyBox(text, title = "Commande Roll20") {
  const back = el("div", "cdnd-copybox");
  const box = el("div", "cdnd-copybox-inner");
  box.append(el("div", "cdnd-copybox-title", title));
  box.append(el("p", null, "Copie ce texte (Ctrl+C) et colle-le dans le chat Roll20 :"));
  const ta = el("textarea");
  ta.value = text;
  ta.readOnly = true;
  box.append(ta);
  const btns = el("div", "cdnd-copybox-btns");
  const copy = el("button", "cdnd-btn cdnd-gold", "Copier");
  copy.addEventListener("click", async () => { copy.textContent = (await copyText(text)) ? "Copié ✔" : "Ctrl+C !"; ta.select(); });
  const close = el("button", "cdnd-btn cdnd-ghost", "Fermer");
  close.addEventListener("click", () => back.remove());
  btns.append(copy, close);
  box.append(btns);
  back.append(box);
  back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
  document.body.append(back);
  setTimeout(() => { ta.focus(); ta.select(); }, 30);
}
