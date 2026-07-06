/* ============================================================================
   Odyssey UI · docs site behaviour — site.js
   ----------------------------------------------------------------------------
   Vanilla, zero-dependency helpers for the documentation site only (the library
   ships its own interactions in ../dist/odyssey.js). This file owns:
     1. Sidebar current-page highlight  — adds .is-active by matching the URL.
     2. Code-block copy buttons          — injects a copy button into .doc-code.
     3. Heading anchors                  — deep-link # beside h2/h3[id].
     4. Mobile sidebar toggle            — off-canvas drawer under 900px.
   Runs on DOMContentLoaded; independent of window.Odyssey.
   ============================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var ICON_COPY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var ICON_OK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6 9 17l-5-5"/></svg>';

  /* --------------------------------------------------- 1. active nav highlight */
  function currentPage() {
    var p = location.pathname.split('/').pop();
    return (!p || p === '') ? 'index.html' : p;
  }
  function highlightNav() {
    var page = currentPage();
    var links = document.querySelectorAll('.doc-sidebar a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute('href') || '').split('#')[0].split('/').pop();
      if (href === page || (page === 'index.html' && (href === '' || href === 'index.html'))) {
        links[i].classList.add('is-active');
        links[i].setAttribute('aria-current', 'page');
      } else {
        links[i].classList.remove('is-active');
        links[i].removeAttribute('aria-current');
      }
    }
  }

  /* ----------------------------------------------------- 2. code copy buttons */
  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }
  function wireCopyButtons() {
    var blocks = document.querySelectorAll('.doc-code');
    for (var i = 0; i < blocks.length; i++) {
      (function (block) {
        if (block.querySelector('.doc-copy')) return;
        var pre = block.querySelector('pre');
        if (!pre) return;
        var btn = el('button', 'ody-copy-btn doc-copy', ICON_COPY + '<span>Copy</span>');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Copy code');
        btn.addEventListener('click', function () {
          writeClipboard(pre.innerText).then(function () {
            btn.classList.add('is-copied');
            btn.innerHTML = ICON_OK + '<span>Copied</span>';
            setTimeout(function () {
              btn.classList.remove('is-copied');
              btn.innerHTML = ICON_COPY + '<span>Copy</span>';
            }, 1400);
          }).catch(function () {});
        });
        block.appendChild(btn);
      })(blocks[i]);
    }
  }

  /* --------------------------------------------------------- 3. heading anchors */
  function addAnchors() {
    var heads = document.querySelectorAll('.doc-main h2[id], .doc-main h3[id]');
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.querySelector('.doc-anchor')) continue;
      var a = el('a', 'doc-anchor', '#');
      a.href = '#' + h.id;
      a.setAttribute('aria-label', 'Link to this section');
      h.appendChild(a);
    }
  }

  /* ------------------------------------------------------ 4. mobile sidebar */
  function wireSidebar() {
    var sidebar = document.querySelector('.doc-sidebar');
    var toggle = document.querySelector('[data-doc-nav-toggle]');
    if (!sidebar || !toggle) return;
    var backdrop = document.querySelector('.doc-backdrop');
    if (!backdrop) {
      backdrop = el('div', 'doc-backdrop');
      document.body.appendChild(backdrop);
    }
    function set(open) {
      sidebar.classList.toggle('is-open', open);
      backdrop.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () { set(!sidebar.classList.contains('is-open')); });
    backdrop.addEventListener('click', function () { set(false); });
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) set(false);
    });
  }

  /* ------------------------------------------------- 5. appbar scroll shadow */
  function wireAppbarShadow() {
    var bar = document.querySelector('.ody-appbar');
    if (!bar) return;
    function sync() { bar.classList.toggle('is-scrolled', window.scrollY > 4); }
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* -------------------------------------------------- 6. reveal on scroll
     Classes are only ever added here, so the site renders fully visible
     without JS; prefers-reduced-motion is honoured in CSS. */
  function wireReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var targets = document.querySelectorAll(
      '.doc-example, .doc-feature, .doc-entry, .doc-stats, .doc-main h2'
    );
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    var fold = window.innerHeight * 0.92;
    targets.forEach(function (t) {
      // Only animate elements that start below the fold — above-the-fold
      // content must render instantly (no first-paint ghosting).
      if (t.getBoundingClientRect().top <= fold) return;
      t.classList.add('doc-reveal');
      io.observe(t);
    });
  }

  ready(function () {
    highlightNav();
    wireCopyButtons();
    addAnchors();
    wireSidebar();
    wireAppbarShadow();
    wireReveal();
  });
})();
