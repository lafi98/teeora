/* ============================================================
   PB — minimal interactions
   Only what genuinely needs JS: countdown timers, optional
   quick-add (AJAX) and wishlist (localStorage). FAQ uses native
   <details>; sliders/reveal are CSS. Guarded to init once.
   ============================================================ */
(function () {
  'use strict';
  if (window.__pbInit) return;
  window.__pbInit = true;

  /* ---- Countdown ---- */
  function initCountdown(el) {
    if (el.__pb) return; el.__pb = true;
    var target = new Date(el.dataset.pbCountdown).getTime();
    if (isNaN(target)) return;
    var out = {
      d: el.querySelector('[data-pb-d]'), h: el.querySelector('[data-pb-h]'),
      m: el.querySelector('[data-pb-m]'), s: el.querySelector('[data-pb-s]')
    };
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { diff = 0; clearInterval(timer); }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if (out.d) out.d.textContent = pad(d);
      if (out.h) out.h.textContent = pad(h);
      if (out.m) out.m.textContent = pad(m);
      if (out.s) out.s.textContent = pad(s);
    }
    tick();
    var timer = setInterval(tick, 1000);
  }

  /* ---- Wishlist (localStorage) ---- */
  var KEY = 'pb_wishlist';
  function wl() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function saveWl(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function syncWl() {
    var list = wl();
    document.querySelectorAll('[data-pb-wishlist]').forEach(function (b) {
      var on = list.indexOf(b.getAttribute('data-pb-wishlist')) !== -1;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---- Toast ---- */
  var toast;
  function showToast(msg) {
    if (!toast) { toast = document.createElement('div'); toast.setAttribute('role','status'); toast.style.cssText='position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1b1b1b;color:#fff;padding:.8rem 1.4rem;border-radius:100px;z-index:9999;font-size:.85rem;transition:opacity .3s;font-family:inherit'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.style.opacity = '1';
    clearTimeout(toast.__t); toast.__t = setTimeout(function () { toast.style.opacity = '0'; }, 2000);
  }

  /* ---- Quick view (modal from /products/handle.js) ---- */
  var modal;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'pb-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Product quick view');
    modal.innerHTML =
      '<div class="pb-modal__backdrop" data-pb-close></div>' +
      '<div class="pb-modal__dialog">' +
        '<button class="pb-modal__close" data-pb-close aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="pb-modal__media"></div><div class="pb-modal__body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target.hasAttribute('data-pb-close')) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    return modal;
  }
  function closeModal() { if (modal) { modal.classList.remove('is-open'); document.body.style.overflow = ''; } }
  function openQuickView(url) {
    if (!window.fetch) { window.location.href = url; return; }
    var m = ensureModal();
    var media = m.querySelector('.pb-modal__media'), body = m.querySelector('.pb-modal__body');
    media.innerHTML = ''; body.innerHTML = '<p class="pb-modal__price">Loading…</p>';
    m.classList.add('is-open'); document.body.style.overflow = 'hidden';
    fetch(url + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var img = p.featured_image || (p.images && p.images[0]);
        media.innerHTML = img ? '<img src="' + img + '" alt="' + (p.title || '') + '">' : '';
        var price = (p.price / 100).toLocaleString(undefined, { style: 'currency', currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD' });
        var desc = (p.description || '').replace(/<[^>]*>/g, '').slice(0, 220);
        var vId = p.variants && p.variants.length ? p.variants[0].id : null;
        body.innerHTML =
          '<h3 class="pb-modal__title">' + p.title + '</h3>' +
          '<div class="pb-modal__price">' + price + '</div>' +
          '<p class="pb-modal__desc">' + desc + '…</p>' +
          '<button class="pb-btn" data-pb-add="' + vId + '">Add to cart</button>' +
          '<a class="pb-btn pb-btn--outline" href="' + p.url + '">View full details</a>';
      })
      .catch(function () { body.innerHTML = '<p class="pb-modal__price">Unable to load product.</p>'; });
  }

  /* ---- Delegated actions ---- */
  document.addEventListener('click', function (e) {
    var qv = e.target.closest('[data-pb-quickview]');
    if (qv) { e.preventDefault(); openQuickView(qv.getAttribute('data-pb-quickview')); return; }

    var wish = e.target.closest('[data-pb-wishlist]');
    if (wish) {
      e.preventDefault();
      var id = wish.getAttribute('data-pb-wishlist'), list = wl(), i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      saveWl(list); syncWl();
      showToast(i === -1 ? 'Saved to wishlist' : 'Removed from wishlist');
      return;
    }
    var add = e.target.closest('[data-pb-add]');
    if (add) {
      e.preventDefault();
      if (!window.fetch) return;
      var id2 = add.getAttribute('data-pb-add'); if (!id2) return;
      var label = add.textContent; add.textContent = 'Adding…';
      fetch('/cart/add.js', { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify({ id: id2, quantity: 1 }) })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function () { showToast('Added to cart'); document.dispatchEvent(new CustomEvent('cart:refresh',{bubbles:true})); })
        .catch(function () { showToast('Could not add to cart'); })
        .finally(function () { add.textContent = label; });
    }
  });

  function boot(scope) {
    (scope || document).querySelectorAll('[data-pb-countdown]').forEach(initCountdown);
    syncWl();
  }
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', function(){ boot(); });
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
})();
