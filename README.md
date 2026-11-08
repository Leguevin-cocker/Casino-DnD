# 🎰 Casino DnD — loot animé pour Foundry, importable dans Roll20

Le MJ crée une **session de coffres** dans **Foundry VTT**. Chez tous les joueurs connectés s'affiche un tableau de coffres fermés. Quand le groupe est prêt, quelqu'un clique sur un coffre et l'animation passe au premier plan chez tout le monde :

- le coffre en bois tombe sur la table ;
- il monte en gamme, palier par palier, jusqu'à la rareté de l'objet : bois (commun) → bronze (peu commun) → argent (rare) → or (très rare) → gemme (légendaire). Parfois une tentative de plus échoue dans un « pfff » ;
- il s'ouvre et la carte de l'objet se retourne.

Le coffre reprend ensuite sa place sur le tableau, ouvert, avec l'objet. En dessous, un menu permet de choisir le PJ, et la commande à coller dans **Roll20** apparaît. L'objet arrive alors dans l'inventaire de la fiche, avec un handout et une carte dans le chat.

```
Foundry (tirage + animations)  ──📋 !loot CDND1.xxxx──▶  Roll20 (fiche, handout, chat)
```

## Contenu

| Dossier | Rôle |
|---|---|
| `module.json`, `scripts/`, `styles/`, `templates/`, `data/` | Le module Foundry (v12 et v13) |
| `roll20/CasinoLootImport.js` | Le script Mod (API) Roll20 pour l'import |
| `assets/join-background.jpg` | L'image de l'écran de connexion (« Le Casino interplanaire de Hugoblin ») |
| `demo/` | Une page pour voir les animations sans Foundry |

---

## 1. Installer dans Foundry

Il y a deux façons, avec le même code :

- **Le système « Casino »** (recommandé pour un monde dédié au loot). Copie le dépôt dans `Data/systems/casino` (c'est `system.json` qui est utilisé), puis crée un monde avec le système *Casino*. Au premier lancement, le MJ obtient automatiquement une scène « Le Casino » sur le marbre. Il suffit aussi d'indiquer `systems/casino/assets/join-background.jpg` comme image de fond du monde.
- **Le module « Casino DnD »**, pour l'ajouter à un monde existant (dnd5e ou autre). Voir ci-dessous.

### Le module

**Option A, par manifeste (le plus simple).** Après avoir créé une release (voir plus bas), dans Foundry : *Modules complémentaires → Installer un module*, puis colle ce lien :

```
https://github.com/Leguevin-cocker/Casino-DnD/releases/latest/download/module.json
```

**Option B, à la main.** Copie (ou `git clone`) le dépôt dans `Data/modules/casino-dnd` de ton serveur Foundry. Le nom du dossier doit être exactement `casino-dnd`.

Ensuite, dans ton monde : *Gérer les modules → Casino DnD → activer*.

> **Créer une release** : `git tag v1.0.0 && git push origin v1.0.0`. L'Action GitHub construit `casino-dnd.zip` et `module.json`, et Foundry pourra ensuite proposer les mises à jour.

### Réglages (Paramètres du jeu → Casino DnD)

- **Titre du Casino** : par défaut « Le Casino interplanaire de Hugoblin ».
- **Poids des raretés** : `60,25,10,4,1,0` pour commun, peu commun, rare, très rare, légendaire et artefact.
- **Les joueurs voient la commande Roll20** : désactivé par défaut, seul le MJ la voit.
- **Annonce dans le chat Foundry**.
- **Volume** : réglage propre à chaque joueur.

## 2. Le panneau du MJ

Clique sur le bouton 🎲 **Casino** dans la barre d'outils des jetons, à gauche. Chez les joueurs, ce même bouton réaffiche le tableau des coffres s'ils l'ont réduit.

### 👥 PJ
Ajoute tes personnages un par un, avec leur nom **exact sur Roll20**. Ce sont eux qui apparaissent dans le menu sous chaque coffre ouvert.

### 🎁 Session
- **Source** : un pool fourni (🎰 *Trésor de donjon*, *Coffre du boss*, *Échoppe de l'apothicaire*), un pool que tu as importé (📦), ou **n'importe quelle table aléatoire de ton monde** (🎲). Les objets dnd5e liés dans une table sont convertis automatiquement (rareté, dégâts, CA, prix, description).
- **Nombre de coffres** : de 1 à 12.
- **Chance** : de -3 à +5. Fait pencher la balance vers les raretés hautes (ou basses).
- **Rareté minimale** : pour un coffre de boss garanti.
- **Truquer 😈** : cache l'objet choisi dans un des coffres, au hasard.
- **Créer la session** : le tableau s'ouvre chez tout le monde.

Le contenu des coffres est tiré dès la création, mais il reste **dans le navigateur du MJ** : un joueur ne peut pas le lire en avance. Il faut donc que le MJ soit connecté, et sur le même navigateur, pendant la session.

Pendant la session :
- **Ouverture** : n'importe qui (joueur ou MJ) clique sur un coffre fermé. Un seul coffre s'ouvre à la fois : les autres sont verrouillés pendant l'animation.
- **Attribution** : sous un coffre ouvert, le menu **« Pour quel PJ ? »** choisit le destinataire. La commande Roll20 juste en dessous se met à jour, avec le bouton 📋 pour la copier.
- **Tout copier** : *📋 Copier toutes les commandes Roll20* donne **une seule commande** pour tous les coffres ouverts, chaque objet partant vers son PJ.
- **Fin** : *Terminer la session* ferme le tableau chez tout le monde.
- **Historique** : l'onglet 📜 garde les sessions (objet → PJ) et permet de recopier une commande ou de rejouer l'animation.

Pour une macro :

```js
const casino = game.modules.get("casino-dnd").api;
casino.open();                                                       // ouvre le panneau
casino.createSession({ sourceId: "builtin:coffre-boss", count: 4, luck: 2 });
// tirage direct sans tableau ; mode "chest" (défaut), "roulette" ou "cards"
casino.spin({ sourceId: "builtin:tresor-donjon", count: 2, recipient: "Thorin", mode: "roulette" });
```

### Tes propres pools

*Exporter ce pool* te donne un modèle JSON. Tu le modifies, puis tu le recharges avec *Importer un pool JSON*. Exemple :

```json
{
  "name": "Mon pool",
  "rarityWeights": { "common": 50, "uncommon": 30, "rare": 15, "veryRare": 4, "legendary": 1 },
  "items": [
    { "name": "{q} pièces d'or", "rarity": "common", "type": "treasure", "quantity": "2d6*10", "currency": "gp", "value": "{q} po" },
    { "name": "Épée de braise", "rarity": "rare", "type": "weapon", "subtype": "Épée longue",
      "damage": "1d8", "damageType": "Slashing", "properties": "Versatile (1d10)", "bonus": 1,
      "attunement": true, "weight": 3, "value": "2 000 po", "description": "La lame fume sous la pluie." },
    { "name": "Cape de l'ombre", "rarity": "uncommon", "type": "wondrous", "img": "icons/equipment/back/cloak-hooded-black.webp",
      "r20mods": "AC +1", "chance": 2, "description": "…" }
  ]
}
```

- **Raretés** : `common`, `uncommon`, `rare`, `veryRare`, `legendary`, `artifact`. Les noms français sont aussi acceptés.
- **Types** : `weapon`, `armor`, `potion`, `scroll`, `ring`, `wand`, `staff`, `wondrous`, `treasure`, `gem`, `gear`, `tool`, `ammo`, `food`, `book`, `trinket`.
- `quantity` accepte une formule de dés. `{q}` dans le nom ou la valeur est remplacé par le résultat.
- `chance` : poids de l'objet dans sa rareté (1 par défaut).
- `currency` (`gp`, `sp`, `cp`, `pp`, `ep`) : sur Roll20, les pièces vont directement dans la bourse de la fiche.
- `r20mods` : force le champ *Modifiers* de la fiche Roll20 (ex. `AC +1, Saving Throws +1`).
- **Types de dégâts** : à écrire en anglais (`Slashing`, `Fire`…) parce que la fiche Roll20 les lit. L'affichage, lui, est en français.

## 3. Installer le script Roll20

Il faut un compte **Pro** côté MJ pour les Mods (API).

1. Dans ta partie Roll20 : *Paramètres → Mod (API) Scripts → New Script*.
2. Colle le contenu de [`roll20/CasinoLootImport.js`](roll20/CasinoLootImport.js), nomme-le `CasinoLootImport.js` et clique sur *Save Script*.
3. Dans le chat de la partie, tape `!loot --help`.

### Utilisation

Colle simplement ce que Foundry a copié :

```
!loot CDND1.eyJ2IjoxLCJpdGVtcyI6W3sibmFtZSI6...
```

Le script :
- trouve le personnage. Le nom inclus dans le code est comparé sans tenir compte des accents ni des majuscules, et un début de nom suffit (« thorin » trouve « Thorin Écu-de-Chêne »). À défaut, il prend le perso du jeton sélectionné, sinon c'est pour le groupe ;
- ajoute l'objet dans l'**inventaire** de la fiche *D&D 5E by Roll20*, avec le champ *Modifiers* rempli (arme → attaque, armure → CA) ; les pièces vont dans la bourse ;
- crée un **handout** illustré, visible par le joueur qui contrôle le perso ;
- poste une **carte** dans le chat, colorée selon la rareté.

| Option | Effet |
|---|---|
| `--to "Nom"` | force le destinataire |
| `--groupe` | pour le groupe : pas de fiche, handout visible par tous |
| `--nosheet` / `--nohandout` | n'ajoute pas à la fiche / ne crée pas de handout |
| `--quiet` | pas de carte publique (juste un message au MJ) |
| `!loot --inbox` | importe tous les codes collés dans le handout « Casino Inbox ». Utile pour les gros butins, si le chat coupe le texte |
| `!loot --config` | réglages cliquables : fiche, handout, joueurs autorisés |

Le script accepte aussi du **JSON brut**, pratique pour un objet généré ailleurs (ChatGPT, un site, une feuille de calcul) :

```
!loot {"name":"Bague qui chuchote","rarity":"rare","type":"ring","description":"Elle connaît ton nom."} --to Elara
```

> **Fiche 2024** : la fiche « D&D 2024 by Roll20 » ne se remplit pas par attributs. Dans ce cas, lance `!loot --config sheet off`. La carte de chat et le handout fonctionnent quand même, et le joueur ajoute l'objet à la main.

## 4. L'écran de connexion

Le fichier `assets/join-background.jpg` (1920×1080) contient le marbre, le titre « Le Casino interplanaire de Hugoblin » en or gravé, les deux personnages de part et d'autre de la zone de connexion, et la bannière en bas.

Dans Foundry, sur l'écran d'accueil (setup) : *Game Worlds* → ton monde → **Edit World** → **Background Image**. Indique :

```
modules/casino-dnd/assets/join-background.jpg
```

Foundry ne permet pas de modifier le HTML ou le CSS de l'écran de connexion. C'est donc une image de fond, et Foundry place son formulaire par-dessus. Sur un écran qui n'est pas en 16:9, les bords sont un peu rognés.

## 5. Voir la démo sans Foundry

```bash
python3 -m http.server   # à la racine du dépôt
# puis ouvre http://localhost:8000/demo/
```

## Notes

- Les sons sont générés à la volée (WebAudio) : aucun fichier audio à fournir.
- Si ton Foundry tourne en `http://` sur une IP, le navigateur bloque parfois la copie automatique. Une fenêtre s'ouvre alors avec la commande sélectionnée : il suffit de faire Ctrl+C.
- Les descriptions des objets fournis sont des textes maison inspirés du SRD 5.1 (CC-BY-4.0).
