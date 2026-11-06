# Casino DnD — les coffres du MJ

Site protégé par mot de passe où les joueurs de JDR se placent chacun sur un coffre puis l'ouvrent avec une animation façon *Vampire Survivors* : le coffre tremble, s'ouvre, des pièces jaillissent, un rouleau d'objets défile puis s'arrête sur le butin. On survole l'objet pour voir ses caractéristiques.

- **PHP 8 + SQLite**, aucune dépendance, aucune compilation : on dépose les fichiers et ça tourne.
- Les joueurs voient les choix des autres en direct (actualisation toutes les 1,5 s).
- Le tirage se fait **côté serveur** : un joueur ne peut pas tricher depuis son navigateur.
- 341 objets magiques du **SRD 5.1** (licence libre CC-BY 4.0, en anglais) sont chargés au premier lancement. Tu peux les modifier ou les traduire, et en ajouter avec tes propres images.

## Comment ça marche

1. **Admin MJ → Coffres & tables** : crée tes types de coffres. Chacun a une apparence (8 skins pixel-art, ou ta propre image) et une table de loot. Chaque objet de la table a un poids : un objet de poids 20 sort deux fois plus souvent qu'un objet de poids 10. Le pourcentage de chance s'affiche à côté.
2. **Admin MJ → Sessions de loot** : choisis les coffres posés sur la table (ex. 4 coffres en bois + 1 coffre doré), puis « Lancer la session ».
3. Les joueurs se connectent et prennent chacun un coffre (un seul par joueur). Les coffres libres restent libres.
4. Tu cliques sur **« Autoriser l'ouverture »** : les places sont figées et chaque joueur ouvre son coffre. Tu peux aussi ouvrir les coffres libres toi-même, éjecter un joueur ou refermer un coffre pour le relancer.
5. **« Clôturer »** quand c'est fini. L'historique reste dans l'admin.

## Mise en ligne

Tu as besoin d'un hébergement **PHP 8 avec Apache** (c'est le cas des hébergements mutualisés OVH). Ton compte OVH actuel n'a que le domaine, la zone DNS et les mails, donc il faut ajouter un hébergement web.

### Option recommandée : hébergement mutualisé OVH (la plus petite offre suffit)

1. Commande l'hébergement dans ton espace client OVH.
2. **Hébergements → ton hébergement → Multisite → Ajouter un domaine** : choisis `glanddelaidcordonbleu.ovh` et mets le sous-domaine `loot` (ça donne `loot.glanddelaidcordonbleu.ovh`). Dossier racine : `loot`. Coche la modification automatique de la zone DNS et le certificat SSL.
   ⚠️ N'ajoute **que** le sous-domaine, pas le domaine principal, sinon ton site actuel serait redirigé.
3. Vérifie la version de PHP : **Hébergements → Informations générales → Version PHP globale** doit être 8.1 ou plus.
4. Envoie les fichiers du repo dans le dossier `loot` par FTP (FileZilla, avec les identifiants FTP de l'onglet FTP-SSH).
5. Sur le serveur, copie `config.sample.php` en **`config.php`** et change les deux mots de passe.
6. Ouvre `https://loot.glanddelaidcordonbleu.ovh` et connecte-toi avec le mot de passe MJ.

Le dossier `data/` doit être accessible en écriture (c'est le cas par défaut chez OVH) : la base `loot.sqlite` y est créée automatiquement.

### Autre hébergeur ou VPS

N'importe quel serveur avec PHP ≥ 8.1, PDO SQLite fera l'affaire. Ensuite, dans la zone DNS OVH, ajoute une entrée `A` (ou `CNAME`) `loot` qui pointe vers ce serveur.

Si le serveur utilise **nginx** au lieu d'Apache, les fichiers `.htaccess` sont ignorés. Il faut alors bloquer toi-même l'accès à `/data/`, `/lib/` et `config.php`, et interdire l'exécution de PHP dans `/uploads/`.

### Tester en local

```bash
cp config.sample.php config.php
php -S localhost:8000
```

## Structure

| Fichier | Rôle |
|---|---|
| `index.php` | Connexion (pseudo + mot de passe joueurs ou MJ) |
| `table.php` + `assets/table.js` | La table : choix des coffres, ouverture |
| `assets/loot.js` | L'animation d'ouverture |
| `assets/chest.js` | Dessins pixel-art des coffres et icônes d'objets |
| `admin.php` + `assets/admin.js` | Admin MJ |
| `api.php` | API JSON (tirage pondéré, placement, CRUD) |
| `lib/bootstrap.php` | Base SQLite, authentification, données de départ |
| `data/srd-items.json` | Objets SRD importés au premier lancement |

Pour repartir de zéro, supprime `data/loot.sqlite`.

## Crédits

Les objets magiques viennent du *System Reference Document 5.1* de Wizards of the Coast, sous licence [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode), extraits via [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT). Les objets de D&D Beyond hors SRD ne sont pas inclus, car leurs conditions d'utilisation interdisent l'extraction automatique de leur contenu.
