/* ============================================================
   DIVA — collection-page interactions
   - Hero slider (fade, arrows, dots, autoplay, keyboard, swipe)
   - Product card: quick view (modal), wishlist (localStorage), AJAX add
   - Scroll fade-ins
   Vanilla JS, no dependencies. Loaded with `defer`.
   ============================================================ */
(function () {
  'use strict';

  /* Guard: the asset may be referenced by several sections — init once. */
  if (window.__divaInit) return;
  window.__divaInit = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     HERO SLIDER
     --------------------------------------------------------- */
  function initSlider(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.diva-hero__slide'));
    if (slides.length === 0) return;
    var dots = Array.prototype.slice.call(root.querySelectorAll('.diva-hero__dot'));
    var prev = root.querySelector('.diva-hero__arrow--prev');
    var next = root.querySelector('.diva-hero__arrow--next');
    var autoplay = root.dataset.autoplay === 'true';
    var interval = parseInt(root.dataset.interval, 10) || 5000;
    var index = 0;
    var timer = null;

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
      dots.forEach(function (d, n) {
        d.classList.toggle('is-active', n === index);
        d.setAttribute('aria-selected', n === index ? 'true' : 'false');
      });
    }
    function nextSlide() { go(index + 1); }
    function prevSlide() { go(index - 1); }

    function start() {
      if (!autoplay || reduceMotion || slides.length < 2) return;
      stop();
      timer = window.setInterval(nextSlide, interval);
    }
    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }

    if (next) next.addEventListener('click', function () { nextSlide(); start(); });
    if (prev) prev.addEventListener('click', function () { prevSlide(); start(); });
    dots.forEach(function (d, n) { d.addEventListener('click', function () { go(n); start(); }); });

    /* Pause on hover / when tab hidden */
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    /* Keyboard */
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { prevSlide(); start(); }
      if (e.key === 'ArrowRight') { nextSlide(); start(); }
    });

    /* Touch swipe */
    var startX = null;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { dx < 0 ? nextSlide() : prevSlide(); start(); }
      startX = null;
    }, { passive: true });

    go(0);
    start();
  }

  /* ---------------------------------------------------------
     WISHLIST (localStorage)
     --------------------------------------------------------- */
  var WISH_KEY = 'diva_wishlist';
  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISH_KEY)) || []; } catch (e) { return []; }
  }
  function setWishlist(list) {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function syncWishlistButtons() {
    var list = getWishlist();
    document.querySelectorAll('[data-diva-wishlist]').forEach(function (btn) {
      var id = btn.getAttribute('data-diva-wishlist');
      var active = list.indexOf(id) !== -1;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function toggleWishlist(id, btn) {
    var list = getWishlist();
    var i = list.indexOf(id);
    if (i === -1) { list.push(id); } else { list.splice(i, 1); }
    setWishlist(list);
    syncWishlistButtons();
    showToast(i === -1 ? 'Added to wishlist' : 'Removed from wishlist');
  }

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */
  var toastEl = null, toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'diva-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2200);
  }

  /* ---------------------------------------------------------
     ADD TO CART (AJAX)
     --------------------------------------------------------- */
  function addToCart(variantId, btn) {
    if (!variantId) return;
    if (btn) btn.classList.add('is-loading');
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    })
      .then(function (r) { if (!r.ok) throw new Error('cart'); return r.json(); })
      .then(function () {
        showToast('Added to cart');
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        var drawer = document.querySelector('cart-drawer, #cart-drawer');
        if (drawer && typeof drawer.open === 'function') { try { drawer.open(); } catch (e) {} }
      })
      .catch(function () { showToast('Could not add to cart'); })
      .finally(function () { if (btn) btn.classList.remove('is-loading'); });
  }

  /* ---------------------------------------------------------
     QUICK VIEW (modal built from /products/handle.js)
     --------------------------------------------------------- */
  var modal = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'diva-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Product quick view');
    modal.innerHTML =
      '<div class="diva-modal__backdrop" data-diva-close></div>' +
      '<div class="diva-modal__dialog">' +
        '<button class="diva-modal__close" data-diva-close aria-label="Close quick view">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="diva-modal__media"></div>' +
        '<div class="diva-modal__body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-diva-close')) closeModal();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    return modal;
  }
  function openQuickView(url) {
    var m = ensureModal();
    var media = m.querySelector('.diva-modal__media');
    var body = m.querySelector('.diva-modal__body');
    media.innerHTML = '';
    body.innerHTML = '<p class="diva-modal__price">Loading…</p>';
    m.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    fetch(url + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var img = p.featured_image || (p.images && p.images[0]);
        media.innerHTML = img ? '<img src="' + img + '" alt="' + (p.title || '') + '">' : '';
        var price = (p.price / 100).toLocaleString(undefined, { style: 'currency', currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD' });
        var desc = (p.description || '').replace(/<[^>]*>/g, '').slice(0, 220);
        var vId = p.variants && p.variants.length ? p.variants[0].id : null;
        body.innerHTML =
          '<h3 class="diva-modal__title">' + p.title + '</h3>' +
          '<div class="diva-modal__price">' + price + '</div>' +
          '<p class="diva-modal__desc">' + desc + '…</p>' +
          '<button class="diva-btn diva-btn--solid" data-diva-modal-add="' + vId + '">Add to cart</button>' +
          '<a class="diva-btn diva-btn--ink" href="' + p.url + '">View full details</a>';
        var addBtn = body.querySelector('[data-diva-modal-add]');
        if (addBtn) addBtn.addEventListener('click', function () { addToCart(addBtn.getAttribute('data-diva-modal-add'), addBtn); });
      })
      .catch(function () { body.innerHTML = '<p class="diva-modal__price">Unable to load product.</p>'; });
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------
     DELEGATED CARD ACTIONS
     --------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var qv = e.target.closest('[data-diva-quickview]');
    if (qv) { e.preventDefault(); openQuickView(qv.getAttribute('data-diva-quickview')); return; }

    var add = e.target.closest('[data-diva-add]');
    if (add) { e.preventDefault(); addToCart(add.getAttribute('data-diva-add'), add); return; }

    var wish = e.target.closest('[data-diva-wishlist]');
    if (wish) { e.preventDefault(); toggleWishlist(wish.getAttribute('data-diva-wishlist'), wish); return; }
  });

  /* ---------------------------------------------------------
     SCROLL FADE-INS
     --------------------------------------------------------- */
  function initFades(scope) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      (scope || document).querySelectorAll('.diva-fade').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    (scope || document).querySelectorAll('.diva-fade:not(.is-in)').forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  function boot(scope) {
    (scope || document).querySelectorAll('[data-diva-slider]').forEach(initSlider);
    syncWishlistButtons();
    initFades(scope);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', function () { boot(); });

  /* Re-init inside the Theme Editor when a section is re-rendered */
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
})();
