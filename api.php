<?php
require __DIR__ . '/lib/bootstrap.php';

if (!role()) json_out(['error' => 'Non connecté.'], 401);

$action = (string)($_GET['action'] ?? '');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($isPost && !hash_equals(csrf(), (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) {
    json_out(['error' => 'Session expirée, recharge la page.'], 403);
}
// Les POST arrivent en JSON (ou multipart pour les images)
$in = $_POST;
if ($isPost && str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
    $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
}
$int = fn(string $k) => (int)($in[$k] ?? $_GET[$k] ?? 0);
$str = fn(string $k, int $max = 200) => trim(mb_substr((string)($in[$k] ?? ''), 0, $max));

$gmOnly = ['session_create', 'session_status', 'session_delete', 'chest_kick', 'chest_reset',
    'admin_data', 'item_save', 'item_delete', 'chest_save', 'chest_delete', 'loot_set', 'loot_bulk', 'loot_clear'];
if (in_array($action, $gmOnly, true) && !is_gm()) json_out(['error' => 'Réservé au MJ.'], 403);

$pdo = db();

function session_row(int $id): array
{
    $st = db()->prepare('SELECT * FROM sessions WHERE id = ?');
    $st->execute([$id]);
    $s = $st->fetch();
    if (!$s) json_out(['error' => 'Session introuvable.'], 404);
    return $s;
}
function chest_row(int $id): array
{
    $st = db()->prepare('SELECT * FROM session_chests WHERE id = ?');
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) json_out(['error' => 'Coffre introuvable.'], 404);
    return $c;
}
function pool_for(?int $chestTypeId, int $n = 40): array
{
    if (!$chestTypeId) return [];
    $st = db()->prepare('SELECT i.* FROM chest_loot l JOIN items i ON i.id = l.item_id WHERE l.chest_type_id = ? AND l.weight > 0 ORDER BY RANDOM() LIMIT ' . $n);
    $st->execute([$chestTypeId]);
    return array_map(fn($r) => ['name' => $r['name'], 'type' => $r['type'], 'rarity' => $r['rarity'], 'image' => $r['image'] ?: null], $st->fetchAll());
}

try {
switch ($action) {

/* ================= Joueurs ================= */

case 'state': {
    $active = $pdo->query("SELECT id, name, status FROM sessions WHERE status != 'closed' ORDER BY id DESC")->fetchAll();
    $sid = $int('sid');
    if (!$sid && $active) $sid = (int)$active[0]['id'];
    $me = ['name' => player_name(), 'gm' => is_gm()];
    if (!$sid) json_out(['me' => $me, 'active' => $active, 'session' => null, 'version' => 0]);
    $s = session_row($sid);
    $ver = (int)$s['version'];
    $sig = $ver . ':' . count($active);
    if (($_GET['v'] ?? '') === $sig) json_out(['same' => true]);
    $st = $pdo->prepare('SELECT * FROM session_chests WHERE session_id = ? ORDER BY position, id');
    $st->execute([$sid]);
    $chests = [];
    foreach ($st->fetchAll() as $c) {
        $chests[] = [
            'id' => (int)$c['id'],
            'name' => $c['chest_name'],
            'skin' => $c['chest_skin'],
            'image' => $c['chest_image'],
            'player' => $c['player_name'],
            'mine' => $c['player_id'] !== null && $c['player_id'] === player_id(),
            'opened' => $c['opened_at'] !== null,
            'item' => $c['item_snapshot'] ? json_decode($c['item_snapshot'], true) : null,
        ];
    }
    json_out([
        'me' => $me, 'active' => $active, 'version' => $sig,
        'session' => ['id' => (int)$s['id'], 'name' => $s['name'], 'status' => $s['status']],
        'chests' => $chests,
    ]);
}

case 'claim': {
    $c = chest_row($int('chest_id'));
    $s = session_row((int)$c['session_id']);
    if ($s['status'] !== 'lobby') json_out(['error' => 'Les places sont figées : le MJ a déjà lancé l\'ouverture.'], 409);
    $pdo->beginTransaction();
    // Un seul coffre par joueur : on libère l'ancien
    $pdo->prepare('UPDATE session_chests SET player_id = NULL, player_name = NULL WHERE session_id = ? AND player_id = ?')
        ->execute([$c['session_id'], player_id()]);
    $up = $pdo->prepare('UPDATE session_chests SET player_id = ?, player_name = ? WHERE id = ? AND player_id IS NULL');
    $up->execute([player_id(), player_name(), $c['id']]);
    if ($up->rowCount() === 0) { $pdo->rollBack(); json_out(['error' => 'Ce coffre est déjà pris.'], 409); }
    bump((int)$c['session_id']);
    $pdo->commit();
    json_out(['ok' => true]);
}

case 'unclaim': {
    $c = chest_row($int('chest_id'));
    $s = session_row((int)$c['session_id']);
    if ($s['status'] !== 'lobby') json_out(['error' => 'Trop tard pour changer de coffre.'], 409);
    $pdo->prepare('UPDATE session_chests SET player_id = NULL, player_name = NULL WHERE id = ? AND player_id = ?')
        ->execute([$c['id'], player_id()]);
    bump((int)$c['session_id']);
    json_out(['ok' => true]);
}

case 'open': {
    $c = chest_row($int('chest_id'));
    $s = session_row((int)$c['session_id']);
    if ($s['status'] !== 'open') json_out(['error' => 'Le MJ n\'a pas encore autorisé l\'ouverture.'], 409);
    if (!is_gm() && $c['player_id'] !== player_id()) json_out(['error' => 'Ce n\'est pas ton coffre.'], 403);
    if ($c['opened_at']) json_out(['error' => 'Ce coffre est déjà ouvert.'], 409);
    if (!$c['chest_type_id']) json_out(['error' => 'Le type de ce coffre a été supprimé.'], 409);
    $item = roll_item((int)$c['chest_type_id']);
    if (!$item) json_out(['error' => 'La table de loot de ce coffre est vide. Le MJ doit y ajouter des objets.'], 409);
    $snap = item_public($item);
    $up = $pdo->prepare("UPDATE session_chests SET item_id = ?, item_snapshot = ?, opened_at = datetime('now') WHERE id = ? AND opened_at IS NULL");
    $up->execute([$item['id'], json_encode($snap, JSON_UNESCAPED_UNICODE), $c['id']]);
    if ($up->rowCount() === 0) json_out(['error' => 'Ce coffre vient d\'être ouvert.'], 409);
    bump((int)$c['session_id']);
    json_out(['item' => $snap, 'pool' => pool_for((int)$c['chest_type_id'])]);
}

/* ================= MJ : sessions ================= */

case 'session_create': {
    $name = $str('name', 80) ?: 'Session de loot';
    $list = is_array($in['chests'] ?? null) ? $in['chests'] : [];
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO sessions(name) VALUES (?)')->execute([$name]);
    $sid = (int)$pdo->lastInsertId();
    $get = $pdo->prepare('SELECT * FROM chest_types WHERE id = ?');
    $ins = $pdo->prepare('INSERT INTO session_chests(session_id, chest_type_id, chest_name, chest_skin, chest_image, position) VALUES (?,?,?,?,?,?)');
    $pos = 0;
    foreach ($list as $row) {
        $get->execute([(int)($row['type_id'] ?? 0)]);
        $t = $get->fetch();
        if (!$t) continue;
        $n = max(0, min(20, (int)($row['count'] ?? 0)));
        for ($i = 0; $i < $n; $i++) $ins->execute([$sid, $t['id'], $t['name'], $t['skin'], $t['image'], $pos++]);
    }
    if ($pos === 0) { $pdo->rollBack(); json_out(['error' => 'Ajoute au moins un coffre.'], 400); }
    $pdo->commit();
    json_out(['ok' => true, 'sid' => $sid]);
}

case 'session_status': {
    $s = session_row($int('sid'));
    $status = (string)($in['status'] ?? '');
    if (!in_array($status, ['lobby', 'open', 'closed'], true)) json_out(['error' => 'Statut invalide.'], 400);
    $pdo->prepare('UPDATE sessions SET status = ?, version = version + 1 WHERE id = ?')->execute([$status, $s['id']]);
    json_out(['ok' => true]);
}

case 'session_delete': {
    $pdo->prepare('DELETE FROM sessions WHERE id = ?')->execute([$int('sid')]);
    json_out(['ok' => true]);
}

case 'chest_kick': {
    $c = chest_row($int('chest_id'));
    $pdo->prepare('UPDATE session_chests SET player_id = NULL, player_name = NULL WHERE id = ?')->execute([$c['id']]);
    bump((int)$c['session_id']);
    json_out(['ok' => true]);
}

case 'chest_reset': {
    $c = chest_row($int('chest_id'));
    $pdo->prepare('UPDATE session_chests SET item_id = NULL, item_snapshot = NULL, opened_at = NULL WHERE id = ?')->execute([$c['id']]);
    bump((int)$c['session_id']);
    json_out(['ok' => true]);
}

/* ================= MJ : admin ================= */

case 'admin_data': {
    $items = $pdo->query('SELECT * FROM items ORDER BY name COLLATE NOCASE')->fetchAll();
    $chests = $pdo->query('SELECT * FROM chest_types ORDER BY id')->fetchAll();
    $loot = $pdo->query('SELECT chest_type_id, item_id, weight FROM chest_loot')->fetchAll();
    $sessions = $pdo->query('SELECT s.*, (SELECT COUNT(*) FROM session_chests c WHERE c.session_id = s.id) AS n,
        (SELECT COUNT(*) FROM session_chests c WHERE c.session_id = s.id AND c.opened_at IS NOT NULL) AS opened
        FROM sessions s ORDER BY id DESC LIMIT 50')->fetchAll();
    $byChest = [];
    foreach ($loot as $l) $byChest[$l['chest_type_id']][] = ['item_id' => (int)$l['item_id'], 'weight' => (int)$l['weight']];
    foreach ($chests as &$c) { $c['id'] = (int)$c['id']; $c['loot'] = $byChest[$c['id']] ?? []; }
    unset($c);
    foreach ($items as &$i) { $i['id'] = (int)$i['id']; $i['attunement'] = (int)$i['attunement']; }
    unset($i);
    json_out([
        'items' => $items, 'chests' => $chests, 'sessions' => $sessions,
        'rarities' => RARITIES, 'types' => ITEM_TYPES, 'skins' => CHEST_SKINS,
    ]);
}

case 'item_save': {
    $id = $int('id');
    $name = $str('name', 120);
    if ($name === '') json_out(['error' => 'Le nom est obligatoire.'], 400);
    $type = array_key_exists($in['type'] ?? '', ITEM_TYPES) ? $in['type'] : 'other';
    $rarity = array_key_exists($in['rarity'] ?? '', RARITIES) ? $in['rarity'] : 'common';
    $vals = [$name, $type, $rarity, !empty($in['attunement']) ? 1 : 0, $str('stats', 4000), $str('description', 20000)];
    $img = save_upload('image');
    if ($id) {
        $pdo->prepare('UPDATE items SET name=?, type=?, rarity=?, attunement=?, stats=?, description=? WHERE id=?')->execute([...$vals, $id]);
    } else {
        $pdo->prepare("INSERT INTO items(name,type,rarity,attunement,stats,description,source) VALUES (?,?,?,?,?,?,'Perso')")->execute($vals);
        $id = (int)$pdo->lastInsertId();
    }
    if ($img) $pdo->prepare('UPDATE items SET image = ? WHERE id = ?')->execute([$img, $id]);
    elseif (!empty($in['remove_image'])) $pdo->prepare('UPDATE items SET image = NULL WHERE id = ?')->execute([$id]);
    json_out(['ok' => true, 'id' => $id]);
}

case 'item_delete': {
    $pdo->prepare('DELETE FROM items WHERE id = ?')->execute([$int('id')]);
    json_out(['ok' => true]);
}

case 'chest_save': {
    $id = $int('id');
    $name = $str('name', 80);
    if ($name === '') json_out(['error' => 'Le nom est obligatoire.'], 400);
    $skin = array_key_exists($in['skin'] ?? '', CHEST_SKINS) ? $in['skin'] : 'wood';
    $img = save_upload('image');
    if ($id) {
        $pdo->prepare('UPDATE chest_types SET name=?, skin=?, description=? WHERE id=?')->execute([$name, $skin, $str('description', 500), $id]);
    } else {
        $pdo->prepare('INSERT INTO chest_types(name, skin, description) VALUES (?,?,?)')->execute([$name, $skin, $str('description', 500)]);
        $id = (int)$pdo->lastInsertId();
    }
    if ($img) $pdo->prepare('UPDATE chest_types SET image = ? WHERE id = ?')->execute([$img, $id]);
    elseif (!empty($in['remove_image'])) $pdo->prepare('UPDATE chest_types SET image = NULL WHERE id = ?')->execute([$id]);
    json_out(['ok' => true, 'id' => $id]);
}

case 'chest_delete': {
    $pdo->prepare('DELETE FROM chest_types WHERE id = ?')->execute([$int('id')]);
    json_out(['ok' => true]);
}

case 'loot_set': {
    $cid = $int('chest_type_id'); $iid = $int('item_id'); $w = max(0, min(100000, $int('weight')));
    if ($w === 0) {
        $pdo->prepare('DELETE FROM chest_loot WHERE chest_type_id = ? AND item_id = ?')->execute([$cid, $iid]);
    } else {
        $pdo->prepare('INSERT INTO chest_loot(chest_type_id, item_id, weight) VALUES (?,?,?)
            ON CONFLICT(chest_type_id, item_id) DO UPDATE SET weight = excluded.weight')->execute([$cid, $iid, $w]);
    }
    json_out(['ok' => true]);
}

case 'loot_bulk': {
    $cid = $int('chest_type_id');
    $w = max(1, min(100000, $int('weight') ?: 10));
    $rarity = (string)($in['rarity'] ?? '');
    $type = (string)($in['type'] ?? '');
    $sql = 'INSERT INTO chest_loot(chest_type_id, item_id, weight) SELECT ?, id, ? FROM items WHERE 1=1';
    $args = [$cid, $w];
    if (array_key_exists($rarity, RARITIES)) { $sql .= ' AND rarity = ?'; $args[] = $rarity; }
    if (array_key_exists($type, ITEM_TYPES)) { $sql .= ' AND type = ?'; $args[] = $type; }
    $sql .= ' ON CONFLICT(chest_type_id, item_id) DO UPDATE SET weight = excluded.weight';
    $st = $pdo->prepare($sql);
    $st->execute($args);
    json_out(['ok' => true, 'count' => $st->rowCount()]);
}

case 'loot_clear': {
    $pdo->prepare('DELETE FROM chest_loot WHERE chest_type_id = ?')->execute([$int('chest_type_id')]);
    json_out(['ok' => true]);
}

default:
    json_out(['error' => 'Action inconnue.'], 400);
}
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 400);
}
