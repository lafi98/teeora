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

  /* ---- Delegated actions ---- */
  document.addEventListener('click', function (e) {
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
