/* =====================================================================
 * Casino DnD — Import de loot pour Roll20 (Mod / API script)
 * https://github.com/Leguevin-cocker/Casino-DnD
 *
 * Colle dans le chat Roll20 la commande copiée depuis Foundry :
 *   !loot CDND1.eyJ2IjoxLC...
 *
 * Commandes :
 *   !loot <code> [<code>...]   importe un ou plusieurs objets (code Casino ou JSON brut)
 *        --to Nom              force le destinataire (sinon : celui du code, puis le jeton sélectionné)
 *        --groupe              pour le groupe (pas de fiche, handout visible par tous)
 *        --nosheet             n'ajoute pas à l'inventaire de la fiche
 *        --nohandout           ne crée pas de handout
 *        --quiet               pas de carte dans le chat (juste un message au MJ)
 *   !loot --inbox              importe tous les codes collés dans le handout « Casino Inbox »
 *   !loot --config             affiche / modifie les réglages (sheet, handout, players)
 *   !loot --help
 *
 * Fiche visée pour l'inventaire : « D&D 5E by Roll20 » (2014). Pour les autres
 * fiches, utilise --nosheet ou « !loot --config sheet off » : le handout et la
 * carte de chat fonctionnent partout.
 * ===================================================================== */
/* global on, sendChat, findObjs, getObj, createObj, playerIsGM, state, log, _ */

var CasinoLoot = CasinoLoot || (function () {
  "use strict";

  var VERSION = "1.1.0";
  var PREFIX = "CDND1.";
  var INBOX = "Casino Inbox";

  var RARITY = {
    common:    { label: "Commun",     color: "#8a939e" },
    uncommon:  { label: "Peu commun", color: "#2fae5a" },
    rare:      { label: "Rare",       color: "#2f74e0" },
    veryRare:  { label: "Très rare",  color: "#9b45f0" },
    legendary: { label: "Légendaire", color: "#e09b00" },
    artifact:  { label: "Artefact",   color: "#e02a2a" }
  };
  var RARITY_ALIASES = {
    "common": "common", "commun": "common", "uncommon": "uncommon", "peu commun": "uncommon", "rare": "rare",
    "veryrare": "veryRare", "very rare": "veryRare", "tres rare": "veryRare", "très rare": "veryRare",
    "legendary": "legendary", "legendaire": "legendary", "légendaire": "legendary", "artifact": "artifact", "artefact": "artifact"
  };
  var TYPES = {
    weapon: ["Arme", "⚔️"], armor: ["Armure", "🛡️"], potion: ["Potion", "🧪"], scroll: ["Parchemin", "📜"],
    ring: ["Anneau", "💍"], wand: ["Baguette", "🪄"], staff: ["Bâton", "🦯"], wondrous: ["Objet merveilleux", "✨"],
    treasure: ["Trésor", "💰"], gem: ["Gemme", "💎"], gear: ["Équipement", "🎒"], tool: ["Outil", "🔧"],
    ammo: ["Munitions", "🏹"], food: ["Nourriture", "🍖"], book: ["Livre", "📖"], trinket: ["Babiole", "🧿"]
  };

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */

  function cfg() {
    state.CasinoLoot = state.CasinoLoot || {};
    var s = state.CasinoLoot;
    if (s.sheet === undefined) s.sheet = true;
    if (s.handout === undefined) s.handout = true;
    if (s.players === undefined) s.players = false;
    return s;
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[àáâãä]/g, "a").replace(/[çc]/g, "c").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o").replace(/[ùúûü]/g, "u").replace(/[ÿý]/g, "y").replace(/œ/g, "oe").replace(/æ/g, "ae")
      .replace(/\s+/g, " ").trim();
  }

  function rarityKey(r) {
    if (RARITY[r]) return r;
    return RARITY_ALIASES[norm(r)] || RARITY_ALIASES[String(r || "").toLowerCase()] || "common";
  }

  function whisperGM(html) { sendChat("Casino", "/w gm " + html, null, { noarchive: true }); }
  function whisperTo(who, html) {
    sendChat("Casino", '/w "' + String(who).replace(/"/g, "").replace(/\s*\(GM\)$/, "") + '" ' + html, null, { noarchive: true });
  }

  /* ---------- Base64url + UTF-8 (sans dépendre de atob/TextDecoder) ---------- */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64ToBytes(str) {
    var s = str.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
    var bytes = [], buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      buf = (buf << 6) | B64.indexOf(s.charAt(i));
      bits += 6;
      if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
    }
    return bytes;
  }
  function utf8Decode(bytes) {
    var out = "", i = 0;
    while (i < bytes.length) {
      var c = bytes[i++], cp;
      if (c < 0x80) cp = c;
      else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (bytes[i++] & 0x3f);
      else if (c < 0xf0) cp = ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      else cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      out += String.fromCodePoint(cp);
    }
    return out;
  }

  /** Code Casino ou JSON -> { items: [...], to } */
  function decode(raw) {
    var txt = String(raw).trim();
    var data;
    if (txt.indexOf(PREFIX) === 0) data = JSON.parse(utf8Decode(b64ToBytes(txt.slice(PREFIX.length))));
    else data = JSON.parse(txt.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    if (Array.isArray(data)) data = { items: data };
    else if (!data.items) data = { items: [data] };
    data.items = data.items.filter(function (it) { return it && it.name; });
    if (!data.items.length) throw new Error("aucun objet avec un « name »");
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* Fiche D&D 5E by Roll20 (2014)                                       */
  /* ------------------------------------------------------------------ */

  // Identifiant de ligne répétée : "-" + horodatage + aléa (sans "_", interdit dans les noms d'attributs).
  var ROWCHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var BASE = ROWCHARS.length;
  var lastTime = 0, lastRand = [];
  function rowId() {
    var now = Date.now(), same = now === lastTime, t = now, head = "", i;
    lastTime = now;
    for (i = 0; i < 8; i++) { head = ROWCHARS.charAt(t % BASE) + head; t = Math.floor(t / BASE); }
    if (same) {
      for (i = 11; i >= 0 && lastRand[i] === BASE - 1; i--) lastRand[i] = 0;
      lastRand[i]++;
    } else {
      for (i = 0; i < 12; i++) lastRand[i] = Math.floor(Math.random() * BASE);
    }
    for (i = 0; i < 12; i++) head += ROWCHARS.charAt(lastRand[i]);
    return head;
  }

  /** Pièces : on les ajoute à la bourse de la fiche (attributs pp/gp/ep/sp/cp). */
  function addCoins(character, it) {
    var cur = String(it.currency || "").toLowerCase();
    var map = { po: "gp", gp: "gp", pa: "sp", sp: "sp", pc: "cp", cp: "cp", pp: "pp", pe: "ep", ep: "ep" };
    var attrName = map[cur];
    if (!attrName) return false;
    var amount = Number(it.quantity) || 0;
    var a = findObjs({ _type: "attribute", characterid: character.id, name: attrName })[0];
    if (!a) a = createObj("attribute", { characterid: character.id, name: attrName, current: "0" });
    a.set("current", String((parseInt(a.get("current"), 10) || 0) + amount));
    return true;
  }

  function isRanged(it) {
    var p = norm(it.properties) + " " + norm(it.subtype);
    return /ammunition|munition|\barc\b|bow|arbalete|crossbow|fronde|sling|sarbacane|blowgun|flechette|dart/.test(p);
  }

  /** Construit le champ « Modifiers » compris par la fiche (en anglais). */
  function itemModifiers(it) {
    if (it.r20mods) return String(it.r20mods);
    var mods = [], b = Number(it.bonus) || 0;
    if (it.type === "weapon") {
      var ranged = isRanged(it);
      mods.push("Item Type: " + (ranged ? "Ranged Weapon" : "Melee Weapon"));
      if (it.damage) mods.push("Damage: " + it.damage);
      if (it.damageType) mods.push("Damage Type: " + String(it.damageType).toLowerCase());
      var vers = /versatile\s*\(([^)]+)\)/i.exec(it.properties || "");
      if (vers) { mods.push("Alternate Damage: " + vers[1]); if (it.damageType) mods.push("Alternate Damage Type: " + String(it.damageType).toLowerCase()); }
      if (it.range) mods.push("Range: " + it.range);
      if (it.properties) mods.push("Properties: " + String(it.properties).replace(/\s*\([^)]*\)/g, ""));
      if (b) mods.push((ranged ? "Ranged" : "Melee") + " Attacks +" + b, (ranged ? "Ranged" : "Melee") + " Damage +" + b);
    } else if (it.type === "armor") {
      var ac = (Number(it.ac) || 0) + b;
      var shield = /bouclier|shield|ecu/.test(norm(it.subtype) + " " + norm(it.name));
      var kind = shield ? "Shield" : (Number(it.ac) >= 16 ? "Heavy Armor" : Number(it.ac) >= 13 ? "Medium Armor" : "Light Armor");
      mods.push("Item Type: " + kind);
      if (ac) mods.push("AC: " + ac);
    }
    return mods.join(", ");
  }

  function setAttr(charId, name, value, withWorker) {
    var a = createObj("attribute", { characterid: charId, name: name, current: "" });
    if (!a) return;
    if (withWorker && typeof a.setWithWorker === "function") a.setWithWorker({ current: String(value) });
    else a.set("current", String(value));
  }

  function addToSheet(character, it) {
    var id = character.id, pre = "repeating_inventory_" + rowId() + "_";
    var mods = itemModifiers(it);
    var weapon = it.type === "weapon";
    setAttr(id, pre + "itemcount", Number(it.quantity) || 1);
    setAttr(id, pre + "itemweight", Number(it.weight) || 0);
    setAttr(id, pre + "equipped", weapon || it.type === "armor" ? "1" : "0");
    setAttr(id, pre + "useasresource", "0");
    setAttr(id, pre + "hasattack", weapon ? "1" : "0");
    setAttr(id, pre + "itemproperties", it.properties || "");
    setAttr(id, pre + "itemcontent", describe(it));
    setAttr(id, pre + "itemname", it.name, true);
    if (mods) setAttr(id, pre + "itemmodifiers", mods, true);
  }

  /* ------------------------------------------------------------------ */
  /* Texte, handout, carte de chat                                       */
  /* ------------------------------------------------------------------ */

  function typeLine(it) {
    var t = TYPES[it.type] || TYPES.gear, parts = [t[0]];
    if (it.subtype) parts.push(it.subtype);
    if (it.attunement) parts.push(it.attunement === true ? "harmonisation requise" : "harmonisation (" + it.attunement + ")");
    return parts.join(" · ");
  }
  var DAMAGE_FR = {
    slashing: "tranchants", piercing: "perforants", bludgeoning: "contondants", fire: "de feu", cold: "de froid",
    lightning: "de foudre", thunder: "de tonnerre", acid: "d'acide", poison: "de poison", necrotic: "nécrotiques",
    radiant: "radiants", force: "de force", psychic: "psychiques"
  };
  function statLine(it) {
    var p = [], b = Number(it.bonus) || 0;
    var dt = it.damageType ? String(it.damageType).toLowerCase() : "";
    if (it.damage) p.push("Dégâts " + it.damage + (b ? " + " + b : "") + (dt ? " " + (DAMAGE_FR[dt] || dt) : ""));
    if (it.ac) p.push("CA " + it.ac + (b ? " + " + b : ""));
    if (it.range) p.push("Portée " + it.range);
    if (it.properties) p.push(it.properties);
    return p.join(" · ");
  }
  function describe(it) {
    var lines = [RARITY[rarityKey(it.rarity)].label + " — " + typeLine(it)];
    var st = statLine(it); if (st) lines.push(st);
    if (it.description) lines.push("", it.description);
    var meta = [];
    if (it.value) meta.push("Valeur : " + it.value);
    if (it.weight) meta.push("Poids : " + it.weight + " lb");
    if (meta.length) lines.push("", meta.join(" · "));
    return lines.join("\n");
  }
  function displayName(it) {
    var q = Number(it.quantity) || 1;
    return q > 1 && String(it.name).indexOf(String(q)) === -1 ? it.name + " ×" + q : it.name;
  }

  function handoutHtml(it, who) {
    var r = RARITY[rarityKey(it.rarity)], st = statLine(it), meta = [];
    if (it.value) meta.push("💰 " + esc(it.value));
    if (it.weight) meta.push("⚖️ " + esc(it.weight) + " lb");
    return '<div style="border:3px solid ' + r.color + ';border-radius:10px;padding:12px;background:#fbf8f0">' +
      '<div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:' + r.color + '">' + esc(r.label.toUpperCase()) + "</div>" +
      '<h2 style="margin:4px 0">' + ((TYPES[it.type] || TYPES.gear)[1]) + " " + esc(displayName(it)) + "</h2>" +
      "<p><i>" + esc(typeLine(it)) + "</i></p>" +
      (st ? "<p><b>" + esc(st) + "</b></p>" : "") +
      (it.description ? "<p>" + nl2br(it.description) + "</p>" : "") +
      (meta.length ? "<p>" + meta.join(" &nbsp; ") + "</p>" : "") +
      '<p style="font-size:11px;color:#777">🎰 Casino — ' + esc(who) + " · " + new Date().toLocaleDateString("fr-FR") + "</p></div>";
  }

  function createHandout(it, character) {
    var journals = "all";
    if (character) {
      var ctl = character.get("controlledby") || "";
      journals = ctl || "";
    }
    var h = createObj("handout", {
      name: "🎁 " + displayName(it) + (character ? " (" + character.get("name") + ")" : ""),
      inplayerjournals: journals,
      archived: false
    });
    if (h) h.set("notes", handoutHtml(it, character ? character.get("name") : "le groupe"));
    return h;
  }

  function chatCard(items, whoLabel) {
    var best = "common";
    var order = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];
    items.forEach(function (it) { if (order.indexOf(rarityKey(it.rarity)) > order.indexOf(best)) best = rarityKey(it.rarity); });
    var rows = items.map(function (it) {
      var r = RARITY[rarityKey(it.rarity)], t = TYPES[it.type] || TYPES.gear, st = statLine(it);
      var desc = it.description ? String(it.description) : "";
      if (desc.length > 220) desc = desc.slice(0, 217) + "…";
      return '<div style="border-left:5px solid ' + r.color + ';background:#fff;margin:5px 0;padding:4px 7px;border-radius:4px">' +
        '<div style="font-weight:bold;font-size:14px">' + t[1] + " " + esc(displayName(it)) + "</div>" +
        '<div style="font-size:10px;color:' + r.color + ';font-weight:bold">' + esc(r.label) + ' <span style="color:#777;font-weight:normal">· ' + esc(typeLine(it)) + "</span></div>" +
        (st ? '<div style="font-size:11px;color:#333">' + esc(st) + "</div>" : "") +
        (desc ? '<div style="font-size:11px;color:#444;margin-top:2px">' + nl2br(desc) + "</div>" : "") +
        "</div>";
    }).join("");
    var top = RARITY[best].color;
    return '<div style="border:2px solid ' + top + ';border-radius:10px;background:linear-gradient(#1d2a23,#0f1713);padding:6px 8px;color:#f3ead3">' +
      '<div style="text-align:center;font-size:16px;font-weight:bold;color:#ffcf4a">🎰 Le Casino a parlé !</div>' +
      '<div style="text-align:center;font-size:12px;margin-bottom:4px">Pour <b>' + esc(whoLabel) + "</b></div>" +
      '<div style="color:#222">' + rows + "</div></div>";
  }

  /* ------------------------------------------------------------------ */
  /* Destinataire                                                        */
  /* ------------------------------------------------------------------ */

  function findCharacter(name) {
    if (!name) return null;
    var all = findObjs({ _type: "character" });
    // « Aristeus Vesperos (Rémi) » -> on essaie aussi « Aristeus Vesperos »
    var tries = [norm(name), norm(String(name).replace(/\s*\([^)]*\)\s*/g, " "))];
    for (var t = 0; t < tries.length; t++) {
      var n = tries[t];
      if (!n) continue;
      var exact = all.filter(function (c) { return norm(c.get("name")) === n; });
      if (exact.length) return exact[0];
      var starts = all.filter(function (c) { return norm(c.get("name")).indexOf(n) === 0; });
      if (starts.length === 1) return starts[0];
      var inc = all.filter(function (c) { return norm(c.get("name")).indexOf(n) !== -1; });
      if (inc.length === 1) return inc[0];
      // le nom Roll20 est contenu dans le nom Foundry (ex : « Marek » dans « Marek "Le Baldurien" »)
      var rev = all.filter(function (c) { var cn = norm(c.get("name")); return cn.length > 2 && n.indexOf(cn) === 0; });
      if (rev.length === 1) return rev[0];
    }
    return null;
  }

  function selectedCharacter(msg) {
    var sel = (msg.selected || [])[0];
    if (!sel) return null;
    var tok = getObj("graphic", sel._id);
    var cid = tok && tok.get("represents");
    return cid ? getObj("character", cid) : null;
  }

  /* ------------------------------------------------------------------ */
  /* Import                                                              */
  /* ------------------------------------------------------------------ */

  function importItems(items, opts, msg) {
    var c = cfg();
    var character = null, whoLabel = "le groupe";
    if (!opts.party) {
      var wanted = opts.to || opts.payloadTo;
      character = wanted ? findCharacter(wanted) : selectedCharacter(msg);
      if (!character && wanted) {
        whisperGM('<b>Casino :</b> personnage « ' + esc(wanted) + ' » introuvable. Objets donnés au groupe. ' +
          '(Astuce : <code>--to "Nom exact"</code> ou sélectionne le jeton du perso.)');
      }
    }
    if (character) whoLabel = character.get("name");

    var sheet = c.sheet && !opts.nosheet && character;
    var handouts = c.handout && !opts.nohandout;
    items.forEach(function (it) {
      it.rarity = rarityKey(it.rarity);
      if (!TYPES[it.type]) it.type = "gear";
      var coins = false;
      if (sheet) {
        try { coins = addCoins(character, it); if (!coins) addToSheet(character, it); }
        catch (e) { log("CasinoLoot sheet error: " + e); }
      }
      if (handouts && !coins && !it.currency) createHandout(it, character);
    });

    if (opts.quiet) {
      whisperGM("<b>Casino :</b> " + items.length + " objet(s) importé(s) pour " + esc(whoLabel) + ".");
    } else {
      sendChat("Casino", "/direct " + chatCard(items, whoLabel));
    }
    if (sheet || handouts) {
      whisperGM('<div style="font-size:11px">✔ ' + items.length + " objet(s) pour <b>" + esc(whoLabel) + "</b>" +
        (sheet ? " — ajouté(s) à l'inventaire" : "") + (handouts ? " — handout(s) créé(s)" : "") + "</div>");
    }
  }

  function parseArgs(content) {
    var opts = { codes: [] };
    var body = content.replace(/^!loot\b/i, "").trim();
    // JSON brut collé directement
    if (body.indexOf(PREFIX) === -1) {
      var s = body.search(/[[{]/);
      if (s !== -1) {
        var e = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
        opts.codes.push(body.slice(s, e + 1));
        body = body.slice(0, s) + " " + body.slice(e + 1);
      }
    }
    // codes Casino
    body = body.replace(/CDND1\.[A-Za-z0-9_\-]+/g, function (code) { opts.codes.push(code); return " "; });
    // options --clé [valeur]
    body.split(/(?:^|\s)--/).slice(1).forEach(function (part) {
      var m = /^(\w+)\s*([\s\S]*)$/.exec(part.trim());
      if (!m) return;
      var key = m[1].toLowerCase(), val = m[2].trim().replace(/^["']|["']$/g, "");
      if (key === "to" || key === "pour") opts.to = val;
      else if (key === "config") {
        opts.config = true;
        var cm = /^(\w+)\s+(on|off)$/i.exec(val);
        if (cm) { opts.configKey = cm[1].toLowerCase(); opts.configVal = cm[2].toLowerCase() === "on"; }
      } else opts[key] = true;
    });
    if (opts.groupe || opts.group) opts.party = true;
    return opts;
  }

  function showHelp(who) {
    whisperTo(who, '<div style="border:1px solid #c9a227;border-radius:8px;padding:6px;background:#fffaf0">' +
      "<b>🎰 Casino Loot " + VERSION + "</b><br>" +
      "<code>!loot CDND1.xxxx</code> importe le loot copié depuis Foundry.<br>" +
      "<code>!loot {\"name\":\"…\",\"rarity\":\"rare\"}</code> marche aussi avec du JSON.<br>" +
      "Options : <code>--to \"Nom\"</code>, <code>--groupe</code>, <code>--nosheet</code>, <code>--nohandout</code>, <code>--quiet</code><br>" +
      "<code>!loot --inbox</code> lit les codes collés dans le handout « " + INBOX + " » (pour les gros butins).<br>" +
      "<code>!loot --config sheet on|off</code> · <code>handout on|off</code> · <code>players on|off</code></div>");
  }

  function showConfig(who) {
    var c = cfg();
    var b = function (k, v) { return "<a href=\"!loot --config " + k + " " + (v ? "off" : "on") + "\">" + (v ? "✅ oui" : "❌ non") + "</a>"; };
    whisperTo(who, '<div style="border:1px solid #c9a227;border-radius:8px;padding:6px;background:#fffaf0">' +
      "<b>🎰 Réglages Casino</b><br>" +
      "Ajouter à la fiche 5e : " + b("sheet", c.sheet) + "<br>" +
      "Créer un handout : " + b("handout", c.handout) + "<br>" +
      "Les joueurs peuvent importer : " + b("players", c.players) + "</div>");
  }

  function readInbox(cb) {
    var h = findObjs({ _type: "handout", name: INBOX })[0];
    if (!h) {
      h = createObj("handout", { name: INBOX, inplayerjournals: "", archived: false });
      h.set("notes", "<p>Colle ici un ou plusieurs codes CDND1.… (un par ligne), puis tape <code>!loot --inbox</code> dans le chat.</p>");
      return cb(null, "Handout « " + INBOX + " » créé : colles-y tes codes puis relance <code>!loot --inbox</code>.");
    }
    h.get("notes", function (notes) {
      h.get("gmnotes", function (gm) {
        var txt = String(notes || "") + " " + String(gm || "");
        var codes = txt.replace(/<[^>]+>/g, " ").match(/CDND1\.[A-Za-z0-9_\-]+/g) || [];
        cb(h, codes);
      });
    });
  }

  function run(codes, opts, msg) {
    var batches = [];
    codes.forEach(function (code) {
      try { batches.push(decode(code)); }
      catch (e) { whisperGM("<b>Casino :</b> code illisible ou tronqué. Recopie-le depuis Foundry (ou passe par <code>!loot --inbox</code> si c'est un gros butin)."); }
    });
    if (!batches.length) return;
    // on regroupe par destinataire
    var groups = {};
    batches.forEach(function (b) {
      var k = opts.to || b.to || "";
      (groups[k] = groups[k] || []).push.apply(groups[k], b.items);
    });
    Object.keys(groups).forEach(function (k) {
      var o = {}; for (var key in opts) o[key] = opts[key];
      o.payloadTo = k || null;
      if (!k && !opts.to && !selectedCharacter(msg)) o.party = true;
      importItems(groups[k], o, msg);
    });
  }

  function handle(msg) {
    if (msg.type !== "api" || !/^!loot\b/i.test(msg.content)) return;
    var c = cfg();
    var gm = playerIsGM(msg.playerid);
    if (!gm && !c.players) return whisperTo(msg.who, "Seul le MJ peut utiliser <code>!loot</code>.");
    var opts = parseArgs(msg.content);

    if (opts.help) return showHelp(msg.who);
    if (opts.config) {
      if (!gm) return;
      if (opts.configKey && c[opts.configKey] !== undefined) c[opts.configKey] = opts.configVal;
      return showConfig(msg.who);
    }
    if (opts.inbox) {
      return readInbox(function (h, codes) {
        if (!h) return whisperGM(codes);
        if (!codes.length) return whisperGM("<b>Casino :</b> aucun code CDND1 dans « " + INBOX + " ».");
        run(codes, opts, msg);
        h.set("notes", "<p>(vidé après import — " + codes.length + " code(s))</p>");
        h.set("gmnotes", "");
      });
    }
    if (!opts.codes.length) return showHelp(msg.who);
    run(opts.codes, opts, msg);
  }

  on("ready", function () {
    cfg();
    log("-=> CasinoLoot v" + VERSION + " prêt — tape !loot --help <=-");
  });
  on("chat:message", handle);

  return { decode: decode, itemModifiers: itemModifiers, parseArgs: parseArgs, rowId: rowId, VERSION: VERSION };
}());
