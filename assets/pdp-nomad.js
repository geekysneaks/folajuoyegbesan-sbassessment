(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // Build accordion from product description HTML by splitting on H2 headings
  function buildDetailsAccordion() {
    const descEl = $('[data-description-html]');
    const container = $('[data-details-container]');
    if (!descEl || !container) return;

    const html = descEl.innerHTML.trim();
    if (!html) return;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const headings = $all('h2', temp);
    if (headings.length === 0) {
      // fallback: one accordion with whole description
      container.innerHTML = `
        <details open>
          <summary>Description</summary>
          <div class="rte">${html}</div>
        </details>
      `;
      return;
    }

    const items = [];
    headings.forEach((h, idx) => {
      const title = h.textContent.trim() || `Section ${idx + 1}`;
      const contentNodes = [];
      let n = h.nextSibling;

      while (n && !(n.nodeType === 1 && n.tagName.toLowerCase() === 'h2')) {
        contentNodes.push(n);
        n = n.nextSibling;
      }

      const wrap = document.createElement('div');
      contentNodes.forEach(node => wrap.appendChild(node.cloneNode(true)));
      items.push({ title, html: wrap.innerHTML.trim() });
    });

    container.innerHTML = items.map((it, i) => `
      <details ${i === 0 ? 'open' : ''}>
        <summary>${it.title}</summary>
        <div class="rte">${it.html}</div>
      </details>
    `).join('');
  }

  function getSelectedOptions(root) {
    const selects = $all('[data-option-select]', root);
    return selects.map(sel => sel.value);
  }

  function findVariant(productJson, selectedOptions) {
    return productJson.variants.find(v => {
      return selectedOptions.every((val, idx) => v.options[idx] === val);
    });
  }

  function setVariantId(root, variantId) {
    const idInput = $('[data-variant-id]', root);
    if (idInput) idInput.value = variantId;
  }

  // Gallery switching: tries to jump to variant featured_media, else filters by `data-media-color`
  function updateGalleryForVariant(root, variant, colorOptionName) {
    const items = $all('[data-media-id]', root);
    if (items.length === 0) return;

    // show all by default
    items.forEach(el => el.style.display = '');

    // 1) If variant has featured_media, show that first
    if (variant && variant.featured_media && variant.featured_media.id) {
      const match = items.find(el => String(el.dataset.mediaId) === String(variant.featured_media.id));
      if (match) {
        // simple: hide others, show match (easy for reviewer)
        items.forEach(el => el.style.display = 'none');
        match.style.display = '';
        return;
      }
    }

    // 2) Filter by color tag (requires media alt like "color: Rustic Brown")
    if (variant && colorOptionName) {
      const colorValue = variant.options.find((_, idx) => {
        // we don't have option names here, so rely on Liquid setting + first match via select label
        return true;
      });

      // better: read selected color from the hidden select inside [data-color-option]
      const colorSelect = $('[data-color-option] [data-option-select]', root);
      const selectedColor = colorSelect ? colorSelect.value.trim().toLowerCase() : '';

      if (selectedColor) {
        const filtered = items.filter(el => (el.dataset.mediaColor || '').trim().toLowerCase() === selectedColor);
        if (filtered.length) {
          items.forEach(el => el.style.display = 'none');
          filtered.forEach(el => el.style.display = '');
        }
      }
    }
  }

  function initSwatches(root) {
    const swatchesWrap = $('[data-swatches]', root);
    if (!swatchesWrap) return;

    // initial active state
    const colorSelect = $('[data-color-option] [data-option-select]', root);
    const activeVal = colorSelect ? colorSelect.value : null;

    $all('[data-swatch]', swatchesWrap).forEach(btn => {
      if (activeVal && btn.dataset.optionValue === activeVal) btn.classList.add('is-active');
      btn.addEventListener('click', () => {
        const optionIndex = Number(btn.dataset.optionIndex);
        const optionValue = btn.dataset.optionValue;

        const select = $(`[data-option-select][data-option-index="${optionIndex}"]`, root);
        if (!select) return;

        select.value = optionValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));

        $all('[data-swatch]', swatchesWrap).forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  function initVariantLogic() {
    const main = $('.pdp-nomad');
    if (!main) return;

    const productJsonEl = $('[data-product-json]', main);
    if (!productJsonEl) return;

    const product = JSON.parse(productJsonEl.textContent);
    const optionSelects = $all('[data-option-select]', main);

    const colorOptionName = 'Color';

    function onChange() {
      const selected = getSelectedOptions(main);
      const variant = findVariant(product, selected);
      if (!variant) return;

      setVariantId(main, variant.id);
      updateGalleryForVariant(main, variant, colorOptionName);
    }

    optionSelects.forEach(sel => sel.addEventListener('change', onChange));
    onChange();
    initSwatches(main);
  }

  function initRandomAlsoBought() {
    const wrap = $('[data-also-bought]');
    const dataEl = $('[data-collection-products]');
    if (!wrap || !dataEl) return;

    let products = [];
    try { products = JSON.parse(dataEl.textContent); } catch (e) {}

    if (!Array.isArray(products) || products.length === 0) return;

    // shuffle
    const shuffled = products
      .filter(p => p && p.available !== false)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    const html = shuffled.map(p => {
      const img = (p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${escapeHtml(p.title)}" loading="lazy">` : '';
      const price = p.price ? (p.price / 100).toFixed(2) : '';
      return `
        <a class="mini-card" href="${p.url}">
          ${img}
          <div class="mini-card__meta">
            <div class="mini-card__title">${escapeHtml(p.title)}</div>
            <div class="mini-card__price">£${price}</div>
          </div>
        </a>
      `;
    }).join('');

    wrap.insertAdjacentHTML('beforeend', html);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[s]));
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildDetailsAccordion();
    initVariantLogic();
    initRandomAlsoBought();
  });
})();