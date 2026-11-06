<?php
declare(strict_types=1);

const ROOT = __DIR__ . '/..';
const RARITIES = [
    'common'    => ['Commun',      '#c9c9c9', 40],
    'uncommon'  => ['Peu commun',  '#3fd16b', 25],
    'rare'      => ['Rare',        '#3fa1ff', 15],
    'very_rare' => ['Très rare',   '#b660ff', 7],
    'legendary' => ['Légendaire',  '#ff9a1f', 2],
    'artifact'  => ['Artefact',    '#ff3b3b', 1],
];
const ITEM_TYPES = [
    'weapon' => 'Arme', 'armor' => 'Armure', 'potion' => 'Potion', 'ring' => 'Anneau',
    'wand' => 'Baguette', 'staff' => 'Bâton', 'rod' => 'Sceptre', 'scroll' => 'Parchemin',
    'ammunition' => 'Munitions', 'wondrous' => 'Objet merveilleux', 'gold' => 'Trésor', 'other' => 'Divers',
];
const CHEST_SKINS = [
    'wood' => 'Bois', 'iron' => 'Fer', 'gold' => 'Or', 'crimson' => 'Pourpre',
    'arcane' => 'Arcanique', 'emerald' => 'Émeraude', 'ice' => 'Glace', 'obsidian' => 'Obsidienne',
];

if (!is_file(ROOT . '/config.php')) {
    http_response_code(500);
    exit('Il manque config.php : copie config.sample.php en config.php et change les mots de passe.');
}
$CONFIG = require ROOT . '/config.php';

ini_set('session.use_strict_mode', '1');
session_name('lootsess');
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = ROOT . '/data';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $file = $dir . '/loot.sqlite';
    $fresh = !is_file($file);
    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    try { $pdo->exec('PRAGMA journal_mode = WAL;'); } catch (Throwable $e) {}
    migrate($pdo);
    if ($fresh) seed($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<SQL
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'wondrous',
        rarity TEXT NOT NULL DEFAULT 'common',
        attunement INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        stats TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS chest_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        skin TEXT NOT NULL DEFAULT 'wood',
        image TEXT,
        description TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS chest_loot (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chest_type_id INTEGER NOT NULL REFERENCES chest_types(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        weight INTEGER NOT NULL DEFAULT 10,
        UNIQUE(chest_type_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'lobby',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS session_chests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        chest_type_id INTEGER REFERENCES chest_types(id) ON DELETE SET NULL,
        chest_name TEXT NOT NULL,
        chest_skin TEXT NOT NULL,
        chest_image TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        player_id TEXT,
        player_name TEXT,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        item_snapshot TEXT,
        opened_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sc_session ON session_chests(session_id);
    SQL);
}

function seed(PDO $pdo): void
{
    $json = ROOT . '/data/srd-items.json';
    if (!is_file($json)) return;
    $items = json_decode((string)file_get_contents($json), true) ?: [];
    $pdo->beginTransaction();
    $st = $pdo->prepare('INSERT INTO items(name,type,rarity,attunement,stats,description,source) VALUES (?,?,?,?,?,?,?)');
    foreach ($items as $it) {
        $st->execute([$it['name'], $it['type'], $it['rarity'], $it['attunement'], $it['stats'], $it['description'], $it['source']]);
    }
    // Coffres d'exemple : chaque coffre pioche dans une rareté avec un poids par rareté
    $chests = [
        ['Coffre en bois', 'wood', 'Butin modeste.', ['common' => 100, 'uncommon' => 4]],
        ['Coffre de fer', 'iron', 'Butin d\'aventurier.', ['uncommon' => 12, 'rare' => 4]],
        ['Coffre doré', 'gold', 'Un trésor digne d\'un dragon.', ['rare' => 10, 'very_rare' => 4, 'legendary' => 1]],
        ['Coffre arcanique', 'arcane', 'Pour les grands moments.', ['very_rare' => 3, 'legendary' => 6, 'artifact' => 20]],
    ];
    $ins = $pdo->prepare('INSERT INTO chest_types(name,skin,description) VALUES (?,?,?)');
    $loot = $pdo->prepare('INSERT OR IGNORE INTO chest_loot(chest_type_id,item_id,weight) SELECT ?, id, ? FROM items WHERE rarity = ?');
    foreach ($chests as [$n, $s, $d, $w]) {
        $ins->execute([$n, $s, $d]);
        $cid = (int)$pdo->lastInsertId();
        foreach ($w as $rar => $weight) $loot->execute([$cid, $weight, $rar]);
    }
    $pdo->commit();
}

/* ---------- Auth ---------- */

function role(): ?string { return $_SESSION['role'] ?? null; }
function is_gm(): bool { return role() === 'gm'; }
function player_id(): ?string { return $_SESSION['pid'] ?? null; }
function player_name(): ?string { return $_SESSION['pname'] ?? null; }

function require_login(): void
{
    if (!role()) { header('Location: index.php'); exit; }
}
function require_gm(): void
{
    if (!is_gm()) { header('Location: index.php'); exit; }
}

function login(string $name, string $password): ?string
{
    global $CONFIG;
    $name = trim(mb_substr($name, 0, 24));
    if (hash_equals((string)$CONFIG['gm_password'], $password)) {
        $role = 'gm';
        $name = $name !== '' ? $name : 'MJ';
    } elseif (hash_equals((string)$CONFIG['player_password'], $password)) {
        if ($name === '') return 'Choisis un pseudo.';
        $role = 'player';
    } else {
        usleep(800000); // freine le brute-force
        return 'Mot de passe incorrect.';
    }
    session_regenerate_id(true);
    $_SESSION['role'] = $role;
    $_SESSION['pname'] = $name;
    $_SESSION['pid'] = $_SESSION['pid'] ?? bin2hex(random_bytes(12));
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return null;
}

function csrf(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

/* ---------- Helpers ---------- */

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function json_out($data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function bump(int $sessionId): void
{
    db()->prepare('UPDATE sessions SET version = version + 1 WHERE id = ?')->execute([$sessionId]);
}

function item_public(array $it): array
{
    return [
        'id' => (int)$it['id'],
        'name' => $it['name'],
        'type' => $it['type'],
        'rarity' => $it['rarity'],
        'attunement' => (int)$it['attunement'],
        'image' => $it['image'] ?: null,
        'stats' => $it['stats'],
        'description' => $it['description'],
    ];
}

/** Tirage pondéré dans la table d'un type de coffre. */
function roll_item(int $chestTypeId): ?array
{
    $rows = db()->prepare('SELECT i.*, l.weight FROM chest_loot l JOIN items i ON i.id = l.item_id WHERE l.chest_type_id = ? AND l.weight > 0');
    $rows->execute([$chestTypeId]);
    $rows = $rows->fetchAll();
    if (!$rows) return null;
    $total = array_sum(array_column($rows, 'weight'));
    $r = random_int(1, $total);
    foreach ($rows as $row) {
        $r -= (int)$row['weight'];
        if ($r <= 0) return $row;
    }
    return end($rows);
}

function save_upload(string $field): ?string
{
    if (empty($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) return null;
    $f = $_FILES[$field];
    if ($f['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Échec de l\'envoi de l\'image.');
    if ($f['size'] > 5 * 1024 * 1024) throw new RuntimeException('Image trop lourde (5 Mo max).');
    $info = @getimagesize($f['tmp_name']);
    $ext = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
    if (!$ext) throw new RuntimeException('Format d\'image non supporté (png, jpg, gif, webp).');
    $dir = ROOT . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $name = bin2hex(random_bytes(10)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) throw new RuntimeException('Impossible d\'enregistrer l\'image.');
    return 'uploads/' . $name;
}

function page_head(string $title, array $extraCss = []): void
{
    global $CONFIG;
    ?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($title) ?> · <?= h($CONFIG['site_name']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/app.css?v=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='1' y='6' width='14' height='9' fill='%238a5a2b'/><rect x='1' y='3' width='14' height='4' fill='%23a8743a'/><rect x='7' y='7' width='2' height='3' fill='%23ffd34d'/></svg>">
</head>
<body>
<?php
}

function topbar(string $active = ''): void
{
    global $CONFIG;
    ?>
<header class="topbar">
  <a class="brand" href="table.php"><span class="brand-chest"></span><?= h($CONFIG['site_name']) ?></a>
  <nav>
    <a href="table.php" class="<?= $active === 'table' ? 'on' : '' ?>">Table</a>
    <?php if (is_gm()): ?><a href="admin.php" class="<?= $active === 'admin' ? 'on' : '' ?>">Admin MJ</a><?php endif; ?>
    <span class="who"><?= h(player_name()) ?><?= is_gm() ? ' <em>MJ</em>' : '' ?></span>
    <a href="index.php?logout=1" class="logout">Quitter</a>
  </nav>
</header>
<?php
}
