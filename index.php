<?php
require __DIR__ . '/lib/bootstrap.php';

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: index.php');
    exit;
}
if (role()) { header('Location: table.php'); exit; }

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $error = login((string)($_POST['name'] ?? ''), (string)($_POST['password'] ?? ''));
    if (!$error) { header('Location: table.php'); exit; }
}
page_head('Entrée');
?>
<main class="login">
  <div class="login-card panel">
    <div class="login-chest" aria-hidden="true"></div>
    <h1><?= h($CONFIG['site_name']) ?></h1>
    <p class="muted">Seuls les aventuriers munis du mot de passe peuvent approcher des coffres.</p>
    <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
    <form method="post" autocomplete="on">
      <label>Pseudo
        <input name="name" maxlength="24" value="<?= h($_POST['name'] ?? '') ?>" placeholder="Ex : Thorin" autofocus>
      </label>
      <label>Mot de passe
        <input type="password" name="password" required>
      </label>
      <button class="btn btn-gold" type="submit">Entrer</button>
    </form>
  </div>
</main>
<script src="assets/chest.js?v=1"></script>
<script>document.querySelector('.login-chest').innerHTML = ChestArt.svg('gold');</script>
</body>
</html>
