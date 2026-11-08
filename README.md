# 🎰 Casino DnD — loot animé pour Foundry, importable dans Roll20

Le MJ lance un tirage dans **Foundry VTT** : chez tous les joueurs connectés, une roulette façon casino s'emballe, ralentit (le cœur bat si c'est très rare), s'arrête, et la carte de l'objet se retourne avec un effet adapté à la rareté : rayons, confettis et fanfare pour un légendaire. Le MJ copie ensuite une commande et la colle dans **Roll20** : l'objet arrive dans l'inventaire de la fiche, avec un handout et une carte dans le chat.

```
Foundry (tirage + animations)  ──📋 !loot CDND1.xxxx──▶  Roll20 (fiche, handout, chat)
```

## Contenu

| Dossier | Rôle |
|---|---|
| `module.json`, `scripts/`, `styles/`, `templates/`, `data/` | Le module Foundry (v12 et v13) |
| `roll20/CasinoLootImport.js` | Le script Mod (API) Roll20 pour l'import |
| `demo/` | Une page pour voir les animations sans Foundry |

---

## 1. Installer le module Foundry

**Option A, par manifeste (le plus simple).** Après avoir créé une release (voir plus bas), dans Foundry : *Modules complémentaires → Installer un module*, puis colle ce lien :

```
https://github.com/Leguevin-cocker/Casino-DnD/releases/latest/download/module.json
```

**Option B, à la main.** Copie (ou `git clone`) le dépôt dans `Data/modules/casino-dnd` de ton serveur Foundry. Le nom du dossier doit être exactement `casino-dnd`.

Ensuite, dans ton monde : *Gérer les modules → Casino DnD → activer*.

> **Créer une release** : `git tag v1.0.0 && git push origin v1.0.0`. L'Action GitHub construit `casino-dnd.zip` et `module.json`, et Foundry pourra ensuite proposer les mises à jour.

### Réglages (Paramètres du jeu → Casino DnD)

- **Personnages (noms Roll20)** : `Thorin, Elara, Grub`, etc. Ils remplissent la liste « Destinataire », et le script Roll20 s'en sert pour trouver la bonne fiche. Mets les noms exacts de Roll20.
- **Poids des raretés** : `60,25,10,4,1,0` pour commun, peu commun, rare, très rare, légendaire et artefact.
- **Durée de la roulette**, **Titre**, **Annonce dans le chat Foundry**.
- **Volume** : réglage propre à chaque joueur.

## 2. Faire un tirage

Clique sur le bouton 🎲 **Casino** dans la barre d'outils des jetons, à gauche (visible seulement par le MJ).

- **Source** : un pool fourni (🎰 *Trésor de donjon*, *Coffre du boss*, *Échoppe de l'apothicaire*), un pool que tu as importé (📦), ou **n'importe quelle table aléatoire de ton monde** (🎲). Les objets dnd5e liés dans une table sont convertis automatiquement (rareté, dégâts, CA, prix, description).
- **Destinataire** : un perso, ou « Le groupe ».
- **Nombre d'objets** : de 1 à 10.
- **Animation** :
  - 🎡 *Roulette* : un tirage après l'autre.
  - 🃏 *Cartes* : toutes les cartes sont distribuées face cachée puis retournées une à une. Elles brillent de la couleur de leur rareté juste avant de se retourner.
- **Chance** : de -3 à +5. Fait pencher la balance vers les raretés hautes (ou basses).
- **Rareté minimale** : pour un coffre de boss garanti.
- **Truquer 😈** : impose le premier objet. Les joueurs voient une roulette parfaitement normale.

À la fin, l'écran récapitulatif affiche le butin. Seul le MJ voit les boutons **📋 Roll20** (par objet, ou « Tout copier »). L'onglet **Historique** garde les 50 derniers tirages : tu peux y recopier une commande ou rejouer l'animation.

Pour une macro :

```js
game.modules.get("casino-dnd").api.open();                // ouvre le panneau
game.modules.get("casino-dnd").api.spin({                 // tirage direct
  sourceId: "builtin:coffre-boss", count: 3, recipient: "Thorin", mode: "cards", luck: 2
});
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

## 4. Voir la démo sans Foundry

```bash
python3 -m http.server   # à la racine du dépôt
# puis ouvre http://localhost:8000/demo/
```

## Notes

- Les sons sont générés à la volée (WebAudio) : aucun fichier audio à fournir.
- Si ton Foundry tourne en `http://` sur une IP, le navigateur bloque parfois la copie automatique. Une fenêtre s'ouvre alors avec la commande sélectionnée : il suffit de faire Ctrl+C.
- Les descriptions des objets fournis sont des textes maison inspirés du SRD 5.1 (CC-BY-4.0).
