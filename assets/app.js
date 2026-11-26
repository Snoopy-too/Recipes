(function () {
  'use strict';

  const dataEl = document.getElementById('recipes-data');
  if (!dataEl) return;

  /** @type {Array<Record<string, any>>} */
  const recipes = JSON.parse(dataEl.textContent || '[]');
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  const gridEl = document.getElementById('recipe-grid');
  const emptyEl = document.getElementById('empty-state');
  const metaEl = document.getElementById('results-meta');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const catButtons = Array.from(document.querySelectorAll('.cat-pill'));

  const backdrop = document.getElementById('modal-backdrop');
  const modalDialog = backdrop ? backdrop.querySelector('.modal') : null;
  const modalClose = document.getElementById('modal-close');
  const modalIcon = document.getElementById('modal-icon');
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const modalMetaStrip = document.getElementById('modal-meta-strip');
  const scalerBox = document.getElementById('scaler-box');
  const ingredientsContainer = document.getElementById('ingredients-container');
  const instructionsContainer = document.getElementById('instructions-container');
  const chefNotesContainer = document.getElementById('chef-notes-container');
  const sourceFooter = document.getElementById('source-footer');

  let activeCategory = 'all';
  let searchQuery = '';
  let useFahrenheit = true;
  let showBakersPct = false;
  let currentRecipe = null;
  let currentCount = 1;
  let currentWeight = 1;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function formatNumber(num) {
    if (!Number.isFinite(num)) return '0';
    if (Math.abs(num - Math.round(num)) < 0.05) return String(Math.round(num));
    if (num >= 100) return num.toFixed(0);
    if (num >= 10) return num.toFixed(1).replace(/\.0$/, '');
    return num.toFixed(2).replace(/\.?0+$/, '');
  }

  const QTY_TOKEN =
    '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
  const INSTRUCTION_QTY_RE = new RegExp(
    '(' +
      QTY_TOKEN +
      ')(?:\\s*([–-])\\s*(' +
      QTY_TOKEN +
      '))?(\\s*)(kg|g|ml|l|oz|lbs?|tbsp|tsp|cups?|cloves?|cans?)\\b',
    'gi'
  );

  function parseQuantityToken(token) {
    const cleaned = token.replace(/,/g, '').trim();
    const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const denom = Number(mixedMatch[3]);
      return denom ? Number(mixedMatch[1]) + Number(mixedMatch[2]) / denom : NaN;
    }
    const fracMatch = cleaned.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      const denom = Number(fracMatch[2]);
      return denom ? Number(fracMatch[1]) / denom : NaN;
    }
    return Number(cleaned);
  }

  function scaleInstructionText(text, factor) {
    if (!text || Math.abs(factor - 1) < 0.01) return text;
    return String(text).replace(
      INSTRUCTION_QTY_RE,
      (match, q1, sep, q2, space, unit) => {
        const v1 = parseQuantityToken(q1);
        if (!Number.isFinite(v1)) return match;
        let scaled = formatNumber(v1 * factor);
        if (q2 !== undefined) {
          const v2 = parseQuantityToken(q2);
          if (!Number.isFinite(v2)) return match;
          scaled += sep + formatNumber(v2 * factor);
        }
        return scaled + space + unit;
      }
    );
  }

  function renderGrid() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = recipes.filter((r) => {
      if (activeCategory !== 'all' && r.category !== activeCategory) return false;
      if (!q) return true;
      const haystack = [
        r.title,
        r.subtitle,
        r.categoryLabel,
        ...(r.ingredientGroups || []).flatMap((g) =>
          (g.ingredients || []).map((i) => i.name)
        ),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    gridEl.replaceChildren();

    filtered.forEach((r) => {
      const card = el('button', 'recipe-card');
      card.type = 'button';
      card.addEventListener('click', () => openRecipe(r.id));

      const top = el('div', 'card-top');
      top.appendChild(el('span', 'card-icon', r.icon || '🍽️'));
      top.appendChild(el('span', 'card-cat', r.categoryLabel || 'Recipe'));
      card.appendChild(top);

      card.appendChild(el('h2', 'card-title', r.title));
      if (r.subtitle) {
        card.appendChild(el('p', 'card-subtitle', r.subtitle));
      }

      const meta = el('div', 'card-meta');
      if (r.prepTime) meta.appendChild(el('span', null, 'Prep: ' + r.prepTime));
      if (r.cookTime) meta.appendChild(el('span', null, 'Cook: ' + r.cookTime));
      if (r.yieldText) meta.appendChild(el('span', null, r.yieldText));
      card.appendChild(meta);

      gridEl.appendChild(card);
    });

    metaEl.textContent =
      'Showing ' + filtered.length + ' of ' + recipes.length + ' recipes';
    emptyEl.classList.toggle('visible', filtered.length === 0);
  }

  function getScaleFactor() {
    if (!currentRecipe) return 1;
    const baseTotal =
      (Number(currentRecipe.baseCount) || 1) *
      (Number(currentRecipe.basePieceWeightGrams) || 1);
    if (baseTotal <= 0) return 1;
    return (currentCount * currentWeight) / baseTotal;
  }

  function renderMetaStrip() {
    modalMetaStrip.replaceChildren();
    const r = currentRecipe;
    if (!r) return;

    if (r.categoryLabel) {
      modalMetaStrip.appendChild(el('span', 'meta-chip', r.categoryLabel));
    }
    if (r.prepTime) {
      modalMetaStrip.appendChild(el('span', 'meta-chip', 'Prep: ' + r.prepTime));
    }
    if (r.cookTime) {
      modalMetaStrip.appendChild(el('span', 'meta-chip', 'Cook: ' + r.cookTime));
    }
    if (r.tempC || r.tempF) {
      const tempText = useFahrenheit
        ? (r.tempF ? r.tempF + '°F' : r.tempC + '°C')
        : (r.tempC ? r.tempC + '°C' : r.tempF + '°F');
      modalMetaStrip.appendChild(el('span', 'meta-chip', 'Temp: ' + tempText));
    }
  }

  function renderScaler() {
    scalerBox.replaceChildren();
    const r = currentRecipe;
    if (!r) return;

    const factor = getScaleFactor();
    const totalGrams = currentCount * currentWeight;
    const pieceLabel = r.pieceName || 'Servings';

    const top = el('div', 'scaler-top');
    top.appendChild(
      el(
        'strong',
        null,
        'Batch: ' +
          currentCount +
          ' ' +
          pieceLabel +
          ' × ' +
          formatNumber(currentWeight) +
          'g = ' +
          formatNumber(totalGrams) +
          'g total'
      )
    );
    top.appendChild(el('span', 'scaler-badge', formatNumber(factor) + '×'));
    scalerBox.appendChild(top);

    const controls = el('div', 'scaler-controls');

    // Count control
    const minC = Number(r.minCount) || 1;
    const maxC = Number(r.maxCount) || Math.max(24, Number(r.baseCount) * 4 || 24);
    controls.appendChild(
      buildRangeControl(
        pieceLabel,
        currentCount,
        minC,
        maxC,
        1,
        (val) => {
          currentCount = val;
          refreshModalNumbers();
        }
      )
    );

    // Weight control
    const minW = Number(r.minWeightGrams) || 10;
    const maxW = Number(r.maxWeightGrams) || Math.max(500, (Number(r.basePieceWeightGrams) || 100) * 3);
    const stepW = Number(r.weightStepGrams) || 5;
    controls.appendChild(
      buildRangeControl(
        'Weight per ' + pieceLabel.replace(/s$/i, ''),
        currentWeight,
        minW,
        maxW,
        stepW,
        (val) => {
          currentWeight = val;
          refreshModalNumbers();
        },
        'g'
      )
    );

    scalerBox.appendChild(controls);

    // Size presets
    if (Array.isArray(r.sizePresets) && r.sizePresets.length > 0) {
      const presetRow = el('div', 'preset-row');
      r.sizePresets.forEach((p) => {
        const btn = el('button', 'preset-btn', p.label);
        btn.type = 'button';
        if (Math.abs(currentWeight - Number(p.grams)) < 0.01) {
          btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
          currentWeight = Number(p.grams);
          refreshModalNumbers();
        });
        presetRow.appendChild(btn);
      });
      scalerBox.appendChild(presetRow);
    }

    // Unit & reset row
    const toggles = el('div', 'unit-toggles');
    const leftToggles = el('div', 'preset-row');

    const tempBtn = el(
      'button',
      'toggle-btn' + (useFahrenheit ? ' active' : ''),
      useFahrenheit ? 'Temp: °F' : 'Temp: °C'
    );
    tempBtn.type = 'button';
    tempBtn.addEventListener('click', () => {
      useFahrenheit = !useFahrenheit;
      renderMetaStrip();
      renderScaler();
    });
    leftToggles.appendChild(tempBtn);

    const pctBtn = el(
      'button',
      'toggle-btn' + (showBakersPct ? ' active' : ''),
      "Baker's %"
    );
    pctBtn.type = 'button';
    pctBtn.addEventListener('click', () => {
      showBakersPct = !showBakersPct;
      renderScaler();
      renderIngredients();
    });
    leftToggles.appendChild(pctBtn);

    toggles.appendChild(leftToggles);

    const resetBtn = el('button', 'toggle-btn', 'Reset 1×');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
      currentCount = Number(r.baseCount) || 1;
      currentWeight = Number(r.basePieceWeightGrams) || 100;
      refreshModalNumbers();
    });
    toggles.appendChild(resetBtn);

    scalerBox.appendChild(toggles);
  }

  function buildRangeControl(labelText, value, min, max, step, onChange, suffix = '') {
    const group = el('div', 'control-group');
    const label = el('label');
    label.appendChild(el('span', null, labelText));
    label.appendChild(el('span', null, formatNumber(value) + suffix));
    group.appendChild(label);

    const row = el('div', 'range-row');
    const minus = el('button', 'step-btn', '−');
    minus.type = 'button';
    minus.addEventListener('click', () => {
      onChange(Math.max(min, value - step));
    });

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      onChange(Number(input.value));
    });

    const plus = el('button', 'step-btn', '+');
    plus.type = 'button';
    plus.addEventListener('click', () => {
      onChange(Math.min(max, value + step));
    });

    row.appendChild(minus);
    row.appendChild(input);
    row.appendChild(plus);
    group.appendChild(row);
    return group;
  }

  function renderIngredients() {
    ingredientsContainer.replaceChildren();
    const r = currentRecipe;
    if (!r) return;

    const factor = getScaleFactor();
    const groups = r.ingredientGroups || [];

    let totalFlourGrams = 0;
    groups.forEach((g) => {
      (g.ingredients || []).forEach((ing) => {
        if (ing.isFlour && Number(ing.grams) > 0) {
          totalFlourGrams += Number(ing.grams);
        }
      });
    });

    groups.forEach((g) => {
      if (g.groupName) {
        ingredientsContainer.appendChild(el('h4', 'ing-group-title', g.groupName));
      }
      const ul = el('ul', 'ing-list');
      (g.ingredients || []).forEach((ing) => {
        const li = el('li', 'ing-item');
        li.addEventListener('click', () => li.classList.toggle('checked'));

        const nameWrap = el('div');
        nameWrap.appendChild(el('span', null, ing.name || ''));
        if (ing.notes) {
          nameWrap.appendChild(el('span', 'ing-note', ing.notes));
        }

        const baseGrams = Number(ing.grams) || 0;
        const scaledGrams = baseGrams * factor;
        const scaledAmount = (Number(ing.amount) || baseGrams) * factor;
        const unit = ing.unit || 'g';

        let amtText = formatNumber(scaledAmount) + (unit === 'g' ? 'g' : ' ' + unit);
        if (unit !== 'g' && baseGrams > 0) {
          amtText += ' (' + formatNumber(scaledGrams) + 'g)';
        }
        if (Math.abs(factor - 1) < 0.01 && ing.volumeText && unit === 'g') {
          amtText += ' · ' + ing.volumeText;
        }
        if (showBakersPct && totalFlourGrams > 0 && baseGrams > 0) {
          const pct = (baseGrams / totalFlourGrams) * 100;
          amtText += ' [' + formatNumber(pct) + '%]';
        }

        li.appendChild(nameWrap);
        li.appendChild(el('span', 'ing-amount', amtText));
        ul.appendChild(li);
      });
      ingredientsContainer.appendChild(ul);
    });
  }

  function renderInstructionsAndNotes() {
    const doneIndices = new Set(
      Array.from(instructionsContainer.querySelectorAll('.step-item')).reduce(
        (acc, node, idx) => {
          if (node.classList.contains('done')) acc.push(idx);
          return acc;
        },
        []
      )
    );

    instructionsContainer.replaceChildren();
    chefNotesContainer.replaceChildren();
    sourceFooter.replaceChildren();

    const r = currentRecipe;
    if (!r) return;

    const factor = getScaleFactor();
    const ol = el('ol', 'step-list');
    (r.instructions || []).forEach((step, idx) => {
      const li = el('li', 'step-item', scaleInstructionText(step, factor));
      if (doneIndices.has(idx)) li.classList.add('done');
      li.addEventListener('click', () => li.classList.toggle('done'));
      ol.appendChild(li);
    });
    instructionsContainer.appendChild(ol);

    if (Array.isArray(r.chefNotes) && r.chefNotes.length > 0) {
      const box = el('div', 'chef-notes');
      box.appendChild(el('h4', null, 'Chef Notes'));
      const ul = el('ul');
      r.chefNotes.forEach((n) => ul.appendChild(el('li', null, n)));
      box.appendChild(ul);
      chefNotesContainer.appendChild(box);
    }

    if (r.sourceFile) {
      const left = el('span', null, 'Source: ' + r.sourceFile);
      sourceFooter.appendChild(left);
    }
    if (r.googleDocUrl && /^https?:\/\//i.test(r.googleDocUrl)) {
      const link = el('a', null, 'Open Google Doc ↗');
      link.href = r.googleDocUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sourceFooter.appendChild(link);
    }
  }

  function refreshModalNumbers() {
    renderScaler();
    renderIngredients();
    renderInstructionsAndNotes();
  }

  function openRecipe(id) {
    const r = recipeMap.get(id);
    if (!r) return;
    currentRecipe = r;
    currentCount = Number(r.baseCount) || 1;
    currentWeight = Number(r.basePieceWeightGrams) || 100;

    modalIcon.textContent = r.icon || '🍽️';
    modalTitle.textContent = r.title;
    modalSubtitle.textContent = r.subtitle || '';

    instructionsContainer.replaceChildren();
    renderMetaStrip();
    refreshModalNumbers();

    backdrop.classList.add('open');
    if (modalDialog) {
      modalDialog.scrollTop = 0;
    }
    backdrop.scrollTop = 0;
    requestAnimationFrame(() => {
      if (modalDialog) {
        modalDialog.scrollTop = 0;
      }
      backdrop.scrollTop = 0;
    });
    document.body.style.overflow = 'hidden';
    if (window.location.hash !== '#' + id) {
      history.replaceState(null, '', '#' + encodeURIComponent(id));
    }
  }

  function closeModal() {
    if (modalDialog) {
      modalDialog.scrollTop = 0;
    }
    backdrop.scrollTop = 0;
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    currentRecipe = null;
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  catButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      catButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'all';
      renderGrid();
    });
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    searchClear.classList.toggle('visible', searchQuery.length > 0);
    renderGrid();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    renderGrid();
    searchInput.focus();
  });

  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) {
      closeModal();
    }
  });

  renderGrid();

  if (window.location.hash.length > 1) {
    const initialId = decodeURIComponent(window.location.hash.slice(1));
    if (recipeMap.has(initialId)) {
      openRecipe(initialId);
    }
  }
})();
