/**
 * Casino DnD — le présentateur (Hugoblin) et ses répliques.
 * L'image est optionnelle : si elle ne charge pas, le présentateur reste simplement absent.
 */

export const LINES = {
  intro: [
    "Mesdames et messieurs, aventuriers et aventurières… bienvenue au Casino !",
    "Approchez, approchez ! La maison est généreuse… ce soir.",
    "Faites vos jeux ! Rien ne va plus ! Enfin… presque."
  ],
  start: ["Que le spectacle commence !", "Un coffre ! Voyons ce qu'il a dans le ventre…", "Roulement de tambour, s'il vous plaît !"],
  bronze: ["Oh oh ! Du bronze !", "Ça brille un peu… du bronze !", "Bronze ! On se réveille !"],
  silver: ["De l'ARGENT ! Ça devient sérieux…", "Argent ! Mes dents en or tremblent déjà.", "Oh ! De l'argent massif !"],
  gold: ["DE L'OR ! Arrêtez tout !", "De l'or ! La maison commence à transpirer…", "OR ! Quelqu'un a payé le croupier ?!"],
  gem: ["IMPOSSIBLE ! UNE GEMME ! JACKPOT !", "LA GEMME ! Je vais devoir hypothéquer le casino !", "JACKPOT ! Personne ne bouge, c'est un braquage ?!"],
  fizzle: ["Aïe… La maison gagne toujours.", "Presque ! Presque…", "Pfff… pas cette fois, mon mignon."],
  open: {
    common: ["C'est… mieux que rien !", "Un classique indémodable.", "Ne faites pas cette tête, c'est très utile !"],
    uncommon: ["Joli coup !", "Pas mal du tout, pas mal du tout.", "Voilà qui vaut le détour !"],
    rare: ["Superbe ! Un objet rare !", "Ah, la chance vous sourit !", "Rare ! Je l'aurais bien gardé pour moi…"],
    veryRare: ["Extraordinaire !", "Très rare ! Mes actionnaires vont pleurer.", "Quelle merveille… vous trichez ?"],
    legendary: ["LÉGENDAIRE ! On en parlera dans les tavernes !", "Une légende ! Le casino est ruiné !", "Légendaire… je vais m'asseoir un instant."],
    artifact: ["Un ARTEFACT ?! Qui a mis ça dans mes coffres ?!"]
  },
  outro: ["Merci, merci ! Au suivant !", "Le rideau tombe… mais le casino reste ouvert !", "Revenez vite, la maison vous attend !"],
  board: ["Faites vos jeux ! Choisissez un coffre…", "Lequel cache le trésor ? Moi je sais. Hé hé.", "Un clic, un coffre, une fortune !", "Prenez votre temps… le casino ne ferme jamais."],
  done: ["Tous les coffres sont ouverts ! Repassez à la caisse !", "Fin de la partie ! La maison vous remercie."]
};

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Presenter {
  constructor(src, cls = "cdnd-presenter") {
    this.src = src;
    this.cls = cls;
    this.el = null;
    this._timer = null;
  }

  mount(parent) {
    if (!this.src) return null;
    const el = document.createElement("div");
    el.className = this.cls;
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = "";
    img.draggable = false;
    img.onerror = () => { el.remove(); this.el = null; };
    const bubble = document.createElement("div");
    bubble.className = "cdnd-bubble";
    el.append(bubble, img);
    parent.append(el);
    this.el = el;
    this.bubble = bubble;
    requestAnimationFrame(() => el.classList.add("is-in"));
    return el;
  }

  /** Affiche une réplique. mood : "talk" | "excited" | "sad". */
  say(text, mood = "talk", ms = 3200) {
    if (!this.el || !text) return;
    clearTimeout(this._timer);
    this.bubble.textContent = text;
    this.el.classList.remove("m-talk", "m-excited", "m-sad", "is-saying");
    void this.el.offsetWidth;
    this.el.classList.add(`m-${mood}`, "is-saying");
    if (ms) this._timer = setTimeout(() => this.el?.classList.remove("is-saying"), ms);
  }

  unmount() { clearTimeout(this._timer); this.el?.remove(); this.el = null; }
}
