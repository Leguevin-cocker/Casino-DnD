/**
 * Casino DnD — coffres dessinés en SVG, un matériau par rareté.
 *   commun = bois · peu commun = bronze · rare = argent · très rare = or · légendaire = gemme
 */

export const CHEST_TIERS = ["wood", "bronze", "silver", "gold", "gem"];
export const CHEST_LABELS = { wood: "Coffre en bois", bronze: "Coffre en bronze", silver: "Coffre en argent", gold: "Coffre en or", gem: "Coffre de gemme" };

const MATS = {
  wood: {
    body: ["#9a6332", "#6b4019", "#4a2a0e"], plank: "#3e2309", band: ["#80868d", "#4b4f55", "#2c2f33"],
    rivet: "#b8bec4", lock: ["#8d9298", "#45484d"], inside: "#2a1606", grain: true
  },
  bronze: {
    body: ["#d58b45", "#9a5a22", "#5f3410"], plank: "#5a300c", band: ["#f2b878", "#b06c2a", "#6b3a10"],
    rivet: "#ffe0b0", lock: ["#ffc98a", "#8a4c18"], inside: "#3a1d06"
  },
  silver: {
    body: ["#f4f7fa", "#b9c3cd", "#7d8895"], plank: "#8a96a3", band: ["#ffffff", "#c7d0d9", "#7a8591"],
    rivet: "#ffffff", lock: ["#ffffff", "#8995a1"], inside: "#2a3340"
  },
  gold: {
    body: ["#fff0a8", "#e3b02a", "#9a6a00"], plank: "#a87400", band: ["#fffbe0", "#f0c443", "#a37000"],
    rivet: "#fffdf0", lock: ["#fff6c8", "#b07c00"], inside: "#4a0d1c", jewel: "#e0115f"
  },
  gem: {
    body: ["#c9fbff", "#8a6bff", "#ff5fd2"], plank: "#ffffff", band: ["#ffffff", "#d7c9ff", "#8f6bff"],
    rivet: "#ffffff", lock: ["#ffffff", "#a98bff"], inside: "#1b0b3a", jewel: "#5ff9ff", crystal: true
  }
};

let uidCounter = 0;

function defs(m, id) {
  const [b0, b1, b2] = m.body;
  const [a0, a1, a2] = m.band;
  return `<defs>
    <linearGradient id="body${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${b0}"/><stop offset=".55" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/>
    </linearGradient>
    <linearGradient id="bodyH${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".18" stop-color="#000" stop-opacity="0"/>
      <stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/>
    </linearGradient>
    <linearGradient id="band${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${a2}"/><stop offset=".35" stop-color="${a0}"/><stop offset=".6" stop-color="${a1}"/><stop offset="1" stop-color="${a2}"/>
    </linearGradient>
    <linearGradient id="lock${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${m.lock[0]}"/><stop offset="1" stop-color="${m.lock[1]}"/>
    </linearGradient>
    <radialGradient id="jewel${id}" cx=".35" cy=".35" r=".7">
      <stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${m.jewel ?? "#fff"}"/><stop offset="1" stop-color="#000" stop-opacity=".6"/>
    </radialGradient>
  </defs>`;
}

function crystalFacets(w, h, y0, seed) {
  // facettes triangulaires semi-transparentes : effet cristal
  let out = "";
  const cols = 6, rows = 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 10 + (c * (w - 20)) / cols, y = y0 + (r * h) / rows;
      const cw = (w - 20) / cols, ch = h / rows;
      const o1 = (0.08 + ((c * 7 + r * 3 + seed) % 5) * 0.06).toFixed(2);
      const o2 = (0.05 + ((c * 3 + r * 5 + seed) % 4) * 0.07).toFixed(2);
      out += `<polygon points="${x},${y} ${x + cw},${y} ${x + cw / 2},${y + ch}" fill="#fff" opacity="${o1}"/>`;
      out += `<polygon points="${x + cw / 2},${y + ch} ${x + cw},${y} ${x + cw},${y + ch}" fill="#3a0a6a" opacity="${o2}"/>`;
    }
  }
  return out;
}

/** Partie basse du coffre (viewBox 200×120). */
export function chestBaseSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  const id = `cb${++uidCounter}`;
  const rivets = [20, 50, 80].map((y) => `<circle cx="39" cy="${y}" r="3.2" fill="${m.rivet}"/><circle cx="161" cy="${y}" r="3.2" fill="${m.rivet}"/>`).join("");
  const grain = m.grain ? [12, 26, 52, 64, 90, 104].map((y, i) =>
    `<path d="M14 ${y} q 40 ${i % 2 ? 3 : -3} 86 0 t 86 0" stroke="#000" stroke-opacity=".18" stroke-width="1.2" fill="none"/>`).join("") : "";
  return `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">${defs(m, id)}
    <rect x="8" y="0" width="184" height="118" rx="6" fill="url(#body${id})"/>
    ${m.crystal ? crystalFacets(200, 116, 2, 1) : ""}
    ${grain}
    <rect x="8" y="0" width="184" height="118" rx="6" fill="url(#bodyH${id})"/>
    <path d="M10 40 H190 M10 80 H190" stroke="${m.plank}" stroke-width="2.5" stroke-opacity=".7"/>
    <rect x="28" y="0" width="22" height="118" fill="url(#band${id})"/>
    <rect x="150" y="0" width="22" height="118" fill="url(#band${id})"/>
    ${rivets}
    <rect x="6" y="104" width="188" height="14" rx="3" fill="url(#band${id})"/>
    <rect x="6" y="0" width="188" height="8" rx="2" fill="url(#band${id})"/>
    <rect x="82" y="2" width="36" height="42" rx="5" fill="url(#lock${id})" stroke="#000" stroke-opacity=".35"/>
    <circle cx="100" cy="18" r="5" fill="#111"/><rect x="97.5" y="18" width="5" height="14" rx="2" fill="#111"/>
    ${m.jewel ? `<circle cx="100" cy="72" r="9" fill="url(#jewel${id})" stroke="#fff" stroke-opacity=".6"/>
      <circle cx="39" cy="96" r="5" fill="url(#jewel${id})"/><circle cx="161" cy="96" r="5" fill="url(#jewel${id})"/>` : ""}
    <rect x="8" y="0" width="184" height="118" rx="6" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2"/>
  </svg>`;
}

/** Couvercle bombé (viewBox 200×80), charnière en bas. */
export function chestLidSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  const id = `cl${++uidCounter}`;
  const dome = "M8 80 L8 42 Q8 4 100 4 Q192 4 192 42 L192 80 Z";
  return `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">${defs(m, id)}
    <clipPath id="clip${id}"><path d="${dome}"/></clipPath>
    <path d="${dome}" fill="url(#body${id})"/>
    <g clip-path="url(#clip${id})">
      ${m.crystal ? crystalFacets(200, 76, 4, 3) : ""}
      ${m.grain ? `<path d="M10 30 q 45 -6 90 0 t 90 0 M10 52 q 45 4 90 0 t 90 0" stroke="#000" stroke-opacity=".18" stroke-width="1.2" fill="none"/>` : ""}
      <rect x="0" y="0" width="200" height="80" fill="url(#bodyH${id})"/>
      <rect x="28" y="0" width="22" height="80" fill="url(#band${id})"/>
      <rect x="150" y="0" width="22" height="80" fill="url(#band${id})"/>
      <circle cx="39" cy="34" r="3.2" fill="${m.rivet}"/><circle cx="161" cy="34" r="3.2" fill="${m.rivet}"/>
      <circle cx="39" cy="60" r="3.2" fill="${m.rivet}"/><circle cx="161" cy="60" r="3.2" fill="${m.rivet}"/>
      <path d="M8 18 Q100 -14 192 18" stroke="#fff" stroke-opacity=".35" stroke-width="5" fill="none"/>
    </g>
    <rect x="4" y="70" width="192" height="10" rx="3" fill="url(#band${id})"/>
    <path d="M88 60 h24 v20 h-24 z" fill="url(#lock${id})" stroke="#000" stroke-opacity=".35"/>
    ${m.jewel ? `<circle cx="100" cy="34" r="8" fill="url(#jewel${id})" stroke="#fff" stroke-opacity=".6"/>` : ""}
    <path d="${dome}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2"/>
  </svg>`;
}

/** Intérieur du couvercle, visible une fois ouvert. */
export function chestInsideSVG(material) {
  const m = MATS[material] ?? MATS.wood;
  return `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" class="cdnd-chest-svg">
    <path d="M8 80 L8 42 Q8 4 100 4 Q192 4 192 42 L192 80 Z" fill="${m.inside}" stroke="${m.band[1]}" stroke-width="6"/>
  </svg>`;
}
