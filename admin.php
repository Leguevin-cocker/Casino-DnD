<?php
require __DIR__ . '/lib/bootstrap.php';
require_gm();
page_head('Admin MJ');
topbar('admin');
?>
<main class="admin">
  <div class="tabs" id="tabs">
    <button data-tab="sessions">Sessions de loot</button>
    <button data-tab="chests">Coffres &amp; tables</button>
    <button data-tab="items">Objets</button>
  </div>
  <div id="view" class="panel">Chargement…</div>
</main>
<div id="tooltip" class="tooltip" hidden></div>
<div id="toast" class="toast" hidden></div>
<script>
window.APP = <?= json_encode(['csrf' => csrf(), 'gm' => true]) ?>;
</script>
<script src="assets/chest.js?v=1"></script>
<script src="assets/common.js?v=1"></script>
<script src="assets/admin.js?v=1"></script>
</body>
</html>
