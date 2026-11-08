/**
 * Casino DnD — coffres en SVG, style « cartoon » (gros contour, ferrures, plaque hexagonale).
 *   commun = bois · peu commun = bronze · rare = argent · très rare = or · légendaire = gemme
 * Géométrie fixe : base 200×120, couvercle 200×80 (charnière en bas du couvercle).
 */

export const CHEST_TIERS = ["wood", "bronze", "silver", "gold", "gem"];
export const CHEST_LABELS = { wood: "Coffre en bois", bronze: "Coffre en bronze", silver: "Coffre en argent", gold: "Coffre en or", gem: "Coffre de gemme" };

// body = [clair, moyen, sombre] · metal = [clair, moyen, sombre] · ink = contour
const MATS = {
  wood:   { body: ["#c98a4b", "#9b5a2a", "#6e3b17"], metal: ["#d3d8dd", "#8e969e", "#5b6168"], ink: "#2e1a0d", planks: true, inside: "#2a1606" },
  bronze: { body: ["#f0ad6a", "#c47a3a", "#8a4b1c"], metal: ["#b5743d", "#7c4a22", "#523014"], ink: "#3a200c", panels: true, inside: "#3a1d06" },
  silver: { body: ["#ffffff", "#dde4ea", "#9eabb7"], metal: ["#c9d1d9", "#8b96a1", "#5f6a75"], ink: "#2c333b", panels: true, inside: "#1f2833" },
  gold:   { body: ["#ffe58a", "#f4b827", "#c6860d"], metal: ["#e8a93d", "#b3740c", "#7d4f06"], ink: "#4a2d05", panels: true, inside: "#4a0d1c", jewel: "#e0115f" },
  gem:    { body: ["#b8fbff", "#9b6bff", "#ff6fd8"], metal: ["#ffe58a", "#f4b827", "#b3740c"], ink: "#2a1450", crystal: true, inside: "#1b0b3a", jewel: "#ff2e63" }
};

let uid = 0;

function defs(m, id) {
  const [b0, b1, b2] = m.body;
  const [m0, m1, m2] = m.metal;
  return `<defs>
    <linearGradient id="b${id}" x1="0" y1="0" x2="${m.crystal ? 1 : 0}" y2="1">
      <stop offset="0" stop-color="${b0}"/><stop offset=".5" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/>
    </linearGradient>
    <linearGradient id="m${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${m0}"/><stop offset=".55" stop-color="${m1}"/><stop offset="1" stop-color="${m2}"/>
    </linearGradient>
    <radialGradient id="j${id}" cx=".35" cy=".3" r=".75">
      <stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${m.jewel ?? "#fff"}"/><stop offset="1" stop-color="#3a0010"/>
    </radialGradient>
  </defs>`;
}

const hexagon = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
};

function facets(x0, y0, w, h, seed) {
  let out = "";
  const cols = 5;
  for (let c = 0; c < cols; c++) {
    const x = x0 + (c * w) / cols, cw = w / cols;
    const o1 = (0.12 + ((c * 7 + seed) % 4) * 0.08).toFixed(2);
    const o2 = (0.08 + ((c * 3 + seed) % 3) * 0.07).toFixed(2);
    out += `<polygon points="${x},${y0} ${x + cw},${y0} ${x + cw * 0.5},${y0 + h * 0.6}" fill="#fff" opacity="${o1}"/>`;
    out += `<polygon points="${x + cw * 0.5},${y0 + h * 0.6} ${x + cw},${y0 + h} ${x},${y0 + h}" fill="#2a0a5a" opacity="${o2}"/>`;
  }
  return out;
}

/** Partie basse du coffre (viewBox 200×120). */
export function chestBaseSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  const id = `B${++uid}`;
  const k = m.ink;
  const deco = m.planks
    ? `<path d="M60 8 V104 M100 8 V104 M140 8 V104" stroke="${m.body[2]}" stroke-width="3"/>
       <path d="M44 30 h8 M76 62 h12 M112 40 h10 M150 78 h8" stroke="${m.body[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`
    : m.panels
      ? `<path d="M40 40 H160 M40 74 H160" stroke="${m.body[2]}" stroke-width="2.5" opacity=".6"/>
         <path d="M46 14 H154" stroke="${m.body[0]}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`
      : facets(14, 6, 172, 100, 1);
  const corner = (x, flip) => `
    <path d="M${x} 6 h${flip ? -26 : 26} v18 h${flip ? 12 : -12} v62 h${flip ? -12 : 12} v18 h${flip ? 26 : -26} z"
      fill="url(#m${id})" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="${x + (flip ? -9 : 9)}" cy="15" r="2.6" fill="${m.metal[0]}" stroke="${k}" stroke-width="1.2"/>
    <circle cx="${x + (flip ? -9 : 9)}" cy="95" r="2.6" fill="${m.metal[0]}" stroke="${k}" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">${defs(m, id)}
    <rect x="14" y="4" width="172" height="104" rx="7" fill="url(#b${id})" stroke="${k}" stroke-width="5"/>
    ${deco}
    <rect x="18" y="8" width="164" height="10" rx="4" fill="#fff" opacity=".18"/>
    ${corner(12, false)}${corner(188, true)}
    <polygon points="${hexagon(100, 26, 19)}" fill="url(#m${id})" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="${hexagon(100, 26, 11)}" fill="none" stroke="${m.metal[2]}" stroke-width="2"/>
    <circle cx="100" cy="23" r="3.6" fill="${k}"/><rect x="98.2" y="23" width="3.6" height="9" rx="1.5" fill="${k}"/>
    ${m.jewel ? `<circle cx="100" cy="70" r="10" fill="url(#j${id})" stroke="${k}" stroke-width="3"/>
      <circle cx="96" cy="66" r="2.6" fill="#fff" opacity=".9"/>` : ""}
    ${m.crystal ? `<path d="M152 50 l4 -9 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 z" fill="#fff" opacity=".9"/>
      <path d="M50 82 l3 -6 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 z" fill="#fff" opacity=".8"/>` : ""}
  </svg>`;
}

/** Couvercle bombé (viewBox 200×80), charnière en bas. */
export function chestLidSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  const id = `L${++uid}`;
  const k = m.ink;
  const dome = "M14 78 L14 40 Q14 6 100 6 Q186 6 186 40 L186 78 Z";
  const deco = m.planks
    ? `<path d="M60 9 Q58 40 60 76 M100 6 V76 M140 9 Q142 40 140 76" stroke="${m.body[2]}" stroke-width="3" fill="none"/>`
    : m.panels
      ? `<path d="M40 44 Q100 30 160 44" stroke="${m.body[2]}" stroke-width="2.5" fill="none" opacity=".6"/>`
      : facets(14, 6, 172, 72, 3);
  const band = (x, flip) => `
    <path d="M${x} 78 L${x} 40 Q${x} ${flip ? 12 : 12} ${x + (flip ? -26 : 26)} 8 L${x + (flip ? -26 : 26)} 78 Z"
      fill="url(#m${id})" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="${x + (flip ? -13 : 13)}" cy="50" r="2.6" fill="${m.metal[0]}" stroke="${k}" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">${defs(m, id)}
    <clipPath id="c${id}"><path d="${dome}"/></clipPath>
    <path d="${dome}" fill="url(#b${id})"/>
    <g clip-path="url(#c${id})">${deco}</g>
    <path d="${dome}" fill="none" stroke="${k}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M26 30 Q100 2 174 30" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".35"/>
    ${band(12, false)}${band(188, true)}
    <rect x="10" y="68" width="180" height="12" rx="4" fill="url(#m${id})" stroke="${k}" stroke-width="4"/>
    <path d="M88 78 v-14 q0 -6 6 -6 h12 q6 0 6 6 v14 z" fill="url(#m${id})" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>
    ${m.jewel ? `<circle cx="100" cy="34" r="9" fill="url(#j${id})" stroke="${k}" stroke-width="3"/><circle cx="97" cy="31" r="2.4" fill="#fff"/>` : ""}
  </svg>`;
}

/** Intérieur du couvercle, visible une fois ouvert. */
export function chestInsideSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  return `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">
    <path d="M14 78 L14 40 Q14 6 100 6 Q186 6 186 40 L186 78 Z" fill="${m.inside}" stroke="${m.ink}" stroke-width="5"/>
    <path d="M24 72 L24 42 Q24 16 100 16 Q176 16 176 42 L176 72" fill="none" stroke="${m.metal[1]}" stroke-width="6" opacity=".8"/>
  </svg>`;
}
