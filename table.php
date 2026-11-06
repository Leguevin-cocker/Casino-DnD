<?php
require __DIR__ . '/lib/bootstrap.php';
require_login();
page_head('Table');
topbar('table');
?>
<main class="table-page">
  <div id="session-picker" class="session-picker" hidden></div>
  <section class="session-head">
    <div>
      <h1 id="session-name">Chargement…</h1>
      <p id="session-status" class="status-banner"></p>
    </div>
    <div class="head-tools">
      <?php if (is_gm()): ?>
      <div id="gm-controls" class="gm-controls" hidden>
        <button class="btn" data-status="lobby">Placement</button>
        <button class="btn btn-gold" data-status="open">Autoriser l'ouverture</button>
        <button class="btn btn-ghost" data-status="closed">Clôturer</button>
      </div>
      <?php endif; ?>
      <button id="mute" class="btn btn-ghost btn-icon" title="Son">🔊</button>
    </div>
  </section>
  <section id="grid" class="chest-grid"></section>
  <section id="empty" class="empty panel" hidden>
    <div class="empty-chest"></div>
    <p>Aucune session de loot en cours.</p>
    <?php if (is_gm()): ?>
      <a class="btn btn-gold" href="admin.php#sessions">Créer une session</a>
    <?php else: ?>
      <p class="muted">Garde cette page ouverte : les coffres apparaîtront dès que le MJ lancera une session.</p>
    <?php endif; ?>
  </section>
</main>

<!-- Ouverture de coffre plein écran -->
<div id="loot" class="loot" hidden>
  <canvas id="loot-fx"></canvas>
  <div class="loot-rays"></div>
  <div class="loot-stage">
    <div class="loot-reel"><div class="loot-strip"></div><div class="loot-reel-frame"></div></div>
    <div class="loot-chest"></div>
    <div class="loot-result" hidden>
      <div class="loot-item" data-tt></div>
      <div class="loot-rarity"></div>
      <div class="loot-name"></div>
      <div class="loot-hint">Survole l'objet pour voir ses caractéristiques</div>
      <button class="btn btn-gold loot-close">Récupérer</button>
    </div>
  </div>
  <div class="loot-flash"></div>
</div>

<div id="tooltip" class="tooltip" hidden></div>
<div id="toast" class="toast" hidden></div>

<script>
window.APP = <?= json_encode(['csrf' => csrf(), 'poll' => (int)$CONFIG['poll_ms'], 'gm' => is_gm()]) ?>;
</script>
<script src="assets/chest.js?v=1"></script>
<script src="assets/common.js?v=1"></script>
<script src="assets/loot.js?v=1"></script>
<script src="assets/table.js?v=1"></script>
</body>
</html>
