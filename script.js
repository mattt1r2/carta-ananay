/* Carta visual Ananay: mejoras progresivas, sin datos externos ni lógica de compra. */
(() => {
  'use strict';
  const scrollArea = document.querySelector('.app-scroll');
  const search = document.querySelector('#menu-search');
  const clearButton = document.querySelector('.search-clear');
  const status = document.querySelector('.search-status');
  const emptyState = document.querySelector('.search-empty');
  const categoryMenu = document.querySelector('.category-menu');
  const families = [...document.querySelectorAll('.catalog-family')];
  const sections = [...document.querySelectorAll('.menu-section')].map(section => ({
    element: section,
    details: section.querySelector('.category-section'),
    content: section.querySelector('.section-content'),
    cards: [...section.querySelectorAll('.product-card')],
    expanded: false,
    more: null,
  }));
  let isSearching = false;
  let previousOpen = [];
  let previousScroll = 0;
  let searchTimer;
  const normalize = value => value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/waffles?/g, 'wafle')
    .replace(/wafles/g, 'wafle').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cardNames = new Map(sections.flatMap(section => section.cards.map(card => [card, normalize(card.querySelector('h3').textContent)])));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Preserva nodos, fotos, precios y descripciones. Solo controla su visibilidad. */
  function updateGroups(section) {
    for (const grid of section.content.querySelectorAll('.product-grid')) {
      grid.hidden = ![...grid.querySelectorAll('.product-card')].some(card => !card.hidden);
    }
    for (const heading of section.content.querySelectorAll('.catalog-subheading')) {
      const next = heading.nextElementSibling;
      heading.hidden = next?.classList.contains('product-grid') ? next.hidden : false;
    }
    for (const extras of section.content.querySelectorAll('.extras')) {
      extras.hidden = isSearching || (section.cards.length > 4 && !section.expanded);
    }
  }
  function renderPreview(section) {
    section.cards.forEach((card, index) => { card.hidden = !section.expanded && index >= 4; });
    if (section.more) {
      section.more.hidden = false;
      section.more.textContent = section.expanded ? 'Ver menos' : `Ver todos · ${section.cards.length} opciones`;
      section.more.setAttribute('aria-expanded', String(section.expanded));
    }
    updateGroups(section);
  }
  for (const section of sections) {
    if (section.cards.length > 4) {
      const button = document.createElement('button');
      button.className = 'show-all';
      button.type = 'button';
      button.setAttribute('aria-controls', section.content.id);
      button.addEventListener('click', () => {
        section.expanded = !section.expanded;
        renderPreview(section);
        if (!section.expanded) {
          section.details.querySelector('summary').focus({ preventScroll: true });
          section.element.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
        }
      });
      section.content.append(button);
      section.more = button;
    }
    section.cards.forEach(card => {
      if (card.querySelector('h3').textContent.length > 72) card.classList.add('wide-card');
      const description = card.querySelector('.product-description');
      if (!description) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'description-toggle';
      button.textContent = 'Leer más';
      button.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      description.id = `description-${card.dataset.fudoIds.replaceAll(',', '-')}`;
      button.setAttribute('aria-controls', description.id);
      description.after(button);
      button.addEventListener('click', () => {
        const expanded = description.classList.toggle('is-expanded');
        button.textContent = expanded ? 'Leer menos' : 'Leer más';
        button.setAttribute('aria-expanded', String(expanded));
      });
      // Solo ofrece Leer más cuando el párrafo realmente excede dos líneas.
      new ResizeObserver(() => {
        if (description.getBoundingClientRect().width === 0) return;
        button.hidden = !description.classList.contains('is-expanded') && description.scrollHeight <= description.clientHeight + 1;
      }).observe(description);
    });
    renderPreview(section);
  }
  document.documentElement.classList.add('js-ready');

  /* Búsqueda por nombre, sin tildes ni diferencias entre waffle / wafle. */
  function filterProducts() {
    const query = normalize(search.value);
    const words = query.split(' ').filter(Boolean);
    const wasSearching = isSearching;
    if (query && !isSearching) {
      previousOpen = sections.map(section => section.details.open);
      previousScroll = scrollArea.scrollTop;
    }
    isSearching = Boolean(query);
    document.body.classList.toggle('is-searching', isSearching);
    clearButton.hidden = !search.value;
    status.hidden = !isSearching;
    categoryMenu.open = false;
    if (!isSearching) {
      emptyState.hidden = true;
      sections.forEach((section, index) => {
        section.element.hidden = false;
        if (wasSearching) section.details.open = previousOpen[index];
        renderPreview(section);
      });
      families.forEach(family => { family.hidden = false; });
      if (wasSearching) scrollArea.scrollTo({ top: previousScroll, behavior: 'instant' });
      return;
    }
    let count = 0;
    sections.forEach(section => {
      let matches = 0;
      section.cards.forEach(card => {
        const match = words.every(word => cardNames.get(card).includes(word));
        card.hidden = !match;
        if (match) matches++;
      });
      section.element.hidden = matches === 0;
      section.details.open = matches > 0;
      if (section.more) section.more.hidden = true;
      updateGroups(section);
      count += matches;
    });
    families.forEach(family => {
      family.hidden = ![...family.querySelectorAll('.menu-section')].some(section => !section.hidden);
    });
    status.textContent = `${count} ${count === 1 ? 'producto encontrado' : 'productos encontrados'} para “${search.value.trim()}”`;
    emptyState.hidden = count > 0;
    scrollArea.scrollTo({ top: 0, behavior: 'instant' });
  }
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterProducts, 120);
  });
  function clearSearch() {
    clearTimeout(searchTimer);
    search.value = '';
    filterProducts();
  }
  clearButton.addEventListener('click', () => { clearSearch(); search.focus(); });
  document.querySelector('.reset-search').addEventListener('click', () => { clearSearch(); search.focus(); });
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') { clearSearch(); search.blur(); }
    if (event.key === 'Enter') search.blur();
  });

  /* Los enlaces originales siguen funcionando y abren la sección de destino. */
  function navigateTo(hash, changeHistory = false, focus = false, instant = false) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    if (search.value || isSearching) clearSearch();
    categoryMenu.open = false;
    let section = target.matches('.menu-section') ? target : null;
    if (target.matches('.catalog-family')) {
      // Comida rápida comienza en Completos; Desayunos conserva su acceso propio.
      section = target.id === 'familia-comida' ? document.getElementById('completos') : target.querySelector('.menu-section');
    }
    if (section) section.querySelector('.category-section').open = true;
    if (changeHistory && location.hash !== hash) history.pushState(null, '', hash);
    requestAnimationFrame(() => {
      if (focus && section) section.querySelector('summary').focus({ preventScroll: true });
      else if (focus) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      const top = id === 'inicio' ? 0 : scrollArea.scrollTop + target.getBoundingClientRect().top
        - scrollArea.getBoundingClientRect().top - document.querySelector('.browse-bar').offsetHeight - 8;
      const distant = Math.abs(top - scrollArea.scrollTop) > scrollArea.clientHeight * 2;
      scrollArea.scrollTo({ top, behavior: instant || distant || reducedMotion.matches ? 'instant' : 'smooth' });
    });
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!document.getElementById(anchor.hash.slice(1))) return;
    event.preventDefault();
    navigateTo(anchor.hash, true, true);
  });
  window.addEventListener('hashchange', () => navigateTo(location.hash));
  window.addEventListener('popstate', () => navigateTo(location.hash || '#inicio'));
  document.addEventListener('click', event => {
    if (categoryMenu.open && !categoryMenu.contains(event.target)) categoryMenu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && categoryMenu.open) {
      categoryMenu.open = false;
      categoryMenu.querySelector('summary').focus();
    }
  });
  // Evita que la restauración automática del navegador anule un ancla al recargar.
  history.scrollRestoration = 'manual';
  if (location.hash) navigateTo(location.hash, false, false, true);
  window.addEventListener('load', () => navigateTo(location.hash || '#inicio', false, false, true), { once: true });

  /* Firma flotante: desaparece al acercarse el footer; WhatsApp no invade el contenido. */
  const signature = document.querySelector('.servimat-floating');
  const footerObserver = new IntersectionObserver(entries => {
    const nearFooter = entries[0].isIntersecting;
    signature.classList.toggle('is-hidden', nearFooter);
    signature.setAttribute('aria-hidden', String(nearFooter));
    signature.tabIndex = nearFooter ? -1 : 0;
  }, { root: scrollArea, rootMargin: '0px 0px 30px 0px', threshold: 0 });
  footerObserver.observe(document.querySelector('.site-footer'));

  // La impresión muestra el catálogo entero sin alterar el estado de navegación al volver.
  let printState;
  window.addEventListener('beforeprint', () => {
    printState = { open: sections.map(section => section.details.open), hidden: [...document.querySelectorAll('.catalog-family[hidden], .menu-section[hidden], .section-content [hidden]')] };
    printState.hidden.forEach(element => { element.hidden = false; });
    sections.forEach(section => { section.details.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    printState.hidden.forEach(element => { element.hidden = true; });
    sections.forEach((section, index) => { section.details.open = printState.open[index]; });
  });
})();
