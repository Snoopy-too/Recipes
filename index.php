<?php
declare(strict_types=1);

require_once __DIR__ . '/src/Domain/RecipeRepositoryInterface.php';
require_once __DIR__ . '/src/Infrastructure/JsonRecipeRepository.php';
require_once __DIR__ . '/src/Application/RecipeService.php';

use App\Application\RecipeService;
use App\Infrastructure\JsonRecipeRepository;

$repository = new JsonRecipeRepository(__DIR__ . '/recipes_master.json');
$service = new RecipeService($repository);

$errorMessage = null;
$catalog = [
    'recipes' => [],
    'categories' => [],
    'total' => 0,
];

try {
    $catalog = $service->getCatalog();
} catch (Throwable $e) {
    $errorMessage = 'Unable to load recipes right now.';
}

$safeJson = json_encode(
    $catalog['recipes'],
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR
);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Montoya Family Recipes</title>
  <link rel="stylesheet" href="assets/app.css">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <div class="brand">
        <span class="brand-icon" aria-hidden="true">📖</span>
        <div>
          <h1>Montoya Family Recipes</h1>
          <p><?= $service->escape((string) $catalog['total']) ?> tested recipes with live scaling</p>
        </div>
      </div>

      <div class="search-wrap">
        <input
          id="search-input"
          class="search-input"
          type="search"
          placeholder="Search recipes or ingredients..."
          aria-label="Search recipes or ingredients"
        >
        <button id="search-clear" class="search-clear" type="button" aria-label="Clear search">&times;</button>
      </div>
    </div>
  </header>

  <main class="container">
    <?php if ($errorMessage !== null): ?>
      <div class="chef-notes" role="alert">
        <h4>Error</h4>
        <p><?= $service->escape($errorMessage) ?></p>
      </div>
    <?php else: ?>
      <nav class="category-bar" aria-label="Recipe categories">
        <button class="cat-pill active" type="button" data-category="all">
          <span>All</span>
          <span class="cat-count"><?= $service->escape((string) $catalog['total']) ?></span>
        </button>
        <?php foreach ($catalog['categories'] as $cat): ?>
          <button
            class="cat-pill"
            type="button"
            data-category="<?= $service->escape($cat['id']) ?>"
          >
            <span><?= $service->escape($cat['label']) ?></span>
            <span class="cat-count"><?= $service->escape((string) $cat['count']) ?></span>
          </button>
        <?php endforeach; ?>
      </nav>

      <div id="results-meta" class="results-meta"></div>
      <div id="recipe-grid" class="recipe-grid"></div>
      <div id="empty-state" class="empty-state">
        <p>No recipes matched your search. Try another ingredient or clear the filter.</p>
      </div>
    <?php endif; ?>
  </main>

  <div id="modal-backdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <span id="modal-icon" class="modal-icon" aria-hidden="true"></span>
          <div>
            <h2 id="modal-title" class="modal-title"></h2>
            <p id="modal-subtitle" class="modal-subtitle"></p>
          </div>
        </div>
        <button id="modal-close" class="modal-close" type="button" aria-label="Close recipe">&times;</button>
      </div>

      <div class="modal-body">
        <div id="modal-meta-strip" class="meta-strip"></div>
        <div id="scaler-box" class="scaler-box"></div>

        <div class="two-col">
          <section>
            <h3 class="section-title">Ingredients</h3>
            <div id="ingredients-container"></div>
          </section>
          <section>
            <h3 class="section-title">Instructions</h3>
            <div id="instructions-container"></div>
          </section>
        </div>

        <div id="chef-notes-container"></div>
        <div id="source-footer" class="source-footer"></div>
      </div>
    </div>
  </div>

  <script id="recipes-data" type="application/json"><?= $safeJson ?></script>
  <script src="assets/app.js"></script>
</body>
</html>
