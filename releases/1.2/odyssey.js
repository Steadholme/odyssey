/*! ============================================================================
 * Odyssey UI JS · v1.2.0-canary.1
 * ----------------------------------------------------------------------------
 * Framework-agnostic public release of the Steadholme "Odyssey" design language.
 * Zero-dependency vanilla JavaScript interaction layer (IIFE → window.Odyssey).
 *
 *   USAGE
 *     <link rel="stylesheet" href=".../dist/odyssey.css">
 *     <script src=".../dist/odyssey.js"></script>
 *   Auto-initialises on DOMContentLoaded over the whole document. For content
 *   injected later, call Odyssey.init(rootEl) — though every behaviour here is
 *   delegated from `document`, so dynamic markup works without re-init too.
 *
 *   DATA-ATTRIBUTE API (progressive enhancement)
 *     data-ody-theme-toggle          toggle light/dark on <html>, persisted
 *     data-ody-open="#id"            open a .ody-modal / .ody-drawer
 *     data-ody-dismiss               close the nearest overlay
 *     data-ody-toggle                toggle a .ody-menu inside .ody-dropdown
 *     data-ody-tabs / data-ody-panel="#id"   tabs → panels
 *     data-ody-accordion / data-ody-collapse="#id"   accordion regions
 *     data-ody-tooltip="text"        hover/focus tooltip (+ data-ody-placement)
 *     data-ody-popover="#id"         click popover
 *     data-ody-copy="#sel" | data-ody-copy-text="literal"   copy to clipboard
 *
 *   JS API
 *     Odyssey.init(root?)                        (re)wire a subtree
 *     Odyssey.toast({title,message,tone,timeout})  imperative toast
 *     Odyssey.openModal(el) / closeModal(el)
 *     Odyssey.setTheme('dark'|'light') / toggleTheme()
 *     Odyssey.version
 *
 *   State classes switched: .is-open .is-active .is-copied .is-loading
 *   Theme switched via [data-theme] on <html>.
 *
 *   No third-party dependencies · no fetch · no external links · no CDN.
 *   License: <PLACEHOLDER>
 * ========================================================================== */
(function (window, document) {
  'use strict';

  var VERSION = '1.2.0-canary.1';
  var THEME_KEY = 'ody-theme';
  var htmlEl = document.documentElement;

  /* ---------------------------------------------------------------- utils */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function closest(el, sel) {
    if (!el) return null;
    if (el.closest) return el.closest(sel);
    while (el && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentElement; }
    return null;
  }
  function on(el, type, fn, opts) { el.addEventListener(type, fn, opts || false); }
  function attr(el, name) { return el ? el.getAttribute(name) : null; }
  function byRef(ref, ctx) {
    if (!ref) return null;
    // accept "#id", ".class", or bare id
    if (/^[#.\[]/.test(ref)) { try { return $(ref, ctx); } catch (e) { return null; } }
    return document.getElementById(ref);
  }
  var generatedId = 0;
  function ensureId(el, prefix) {
    if (el.id) return el.id;
    var id;
    do { generatedId += 1; id = prefix + generatedId; } while (document.getElementById(id));
    el.id = id;
    return id;
  }
  var FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(el) {
    return $all(FOCUSABLE, el).filter(function (n) {
      return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement;
    });
  }

  /* ============================================================ 1. THEME */
  function setTheme(mode) {
    if (mode === 'dark') htmlEl.setAttribute('data-theme', 'dark');
    else htmlEl.setAttribute('data-theme', 'light');
    try { window.localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    $all('[data-ody-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
    });
  }
  function currentTheme() {
    var explicit = htmlEl.getAttribute('data-theme');
    if (explicit) return explicit;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  function toggleTheme() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }
  function initTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved === 'dark' || saved === 'light') setTheme(saved);
    else {
      $all('[data-ody-theme-toggle]').forEach(function (b) {
        b.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
      });
    }
  }

  /* ==================================================== 2/3. OVERLAYS */
  /* Shared engine for .ody-modal and .ody-drawer */
  var scrollLocks = 0;
  var lastFocused = null;

  function lockScroll() {
    if (scrollLocks === 0) document.body.classList.add('ody-scroll-lock');
    scrollLocks++;
  }
  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.classList.remove('ody-scroll-lock');
  }
  function openOverlays() {
    return $all('.ody-modal.is-open, .ody-drawer.is-open');
  }
  function panelOf(overlay) {
    return $('.ody-modal__panel', overlay) || $('.ody-drawer__panel', overlay) || overlay;
  }
  function openModal(overlay, trigger) {
    if (!overlay || overlay.classList.contains('is-open')) return;
    lastFocused = trigger || document.activeElement;
    overlay.hidden = false;
    overlay.removeAttribute('hidden');
    // reflow so a CSS transition off [hidden]→.is-open can play
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    var panel = panelOf(overlay);
    if (panel) {
      panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
      panel.setAttribute('aria-modal', 'true');
    }
    lockScroll();
    var f = focusables(panel);
    (f[0] || panel).focus && (f[0] || panel).focus();
    overlay.dispatchEvent(new CustomEvent('ody:open', { bubbles: true }));
  }
  function closeModal(overlay) {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('hidden', '');
    overlay.hidden = true;
    unlockScroll();
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
    lastFocused = null;
    overlay.dispatchEvent(new CustomEvent('ody:close', { bubbles: true }));
  }
  function topOverlay() {
    var o = openOverlays();
    return o.length ? o[o.length - 1] : null;
  }
  function trapFocus(e, overlay) {
    if (e.key !== 'Tab') return;
    var panel = panelOf(overlay);
    var f = focusables(panel);
    if (!f.length) { e.preventDefault(); panel.focus && panel.focus(); return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }

  /* ==================================================== 4. DROPDOWN/MENU */
  function closeAllMenus(except) {
    $all('.ody-dropdown .ody-menu.is-open').forEach(function (menu) {
      if (menu === except) return;
      menu.classList.remove('is-open');
      var dd = closest(menu, '.ody-dropdown');
      var btn = dd && $('[data-ody-toggle]', dd);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  function toggleMenu(btn) {
    var dd = closest(btn, '.ody-dropdown');
    if (!dd) return;
    var menu = $('.ody-menu', dd);
    if (!menu) return;
    var willOpen = !menu.classList.contains('is-open');
    closeAllMenus(willOpen ? menu : null);
    menu.classList.toggle('is-open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) {
      var items = $all('.ody-menu__item:not([disabled])', menu);
      if (items[0] && items[0].focus) items[0].focus();
    }
  }
  function menuItems(menu) { return $all('.ody-menu__item:not([disabled])', menu); }
  function moveMenuFocus(menu, dir) {
    var items = menuItems(menu);
    if (!items.length) return;
    var idx = items.indexOf(document.activeElement);
    idx = (idx + dir + items.length) % items.length;
    if (idx < 0) idx = 0;
    items[idx].focus();
  }

  /* ============================================================ 5. TABS */
  function initTabs(container) {
    var tabs = $all('[role="tab"][data-ody-panel]', container);
    if (!tabs.length) return;
    container.setAttribute('data-ody-tabs-ready', '1');
    var tablist = closest(tabs[0], '[role="tablist"]') || container;
    tablist.setAttribute('role', 'tablist');
    var anyActive = tabs.some(function (t) { return t.classList.contains('is-active'); });
    tabs.forEach(function (tab, i) {
      var active = anyActive ? tab.classList.contains('is-active') : i === 0;
      selectTab(tab, false, active);
    });
  }
  function tabGroup(tab) {
    var container = closest(tab, '[data-ody-tabs]');
    return $all('[role="tab"][data-ody-panel]', container || document).filter(function (t) {
      return closest(t, '[data-ody-tabs]') === container;
    });
  }
  function selectTab(tab, focus, forceActive) {
    var active = forceActive === undefined ? true : forceActive;
    var group = tabGroup(tab);
    var panel = byRef(attr(tab, 'data-ody-panel'));
    if (active) {
      group.forEach(function (t) {
        var isThis = t === tab;
        t.classList.toggle('is-active', isThis);
        t.setAttribute('aria-selected', isThis ? 'true' : 'false');
        t.setAttribute('tabindex', isThis ? '0' : '-1');
        var p = byRef(attr(t, 'data-ody-panel'));
        if (p) {
          p.classList.add('ody-tabpanel');
          p.classList.toggle('is-active', isThis);
          if (isThis) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
          p.setAttribute('role', 'tabpanel');
          if (t.id) p.setAttribute('aria-labelledby', t.id);
        }
      });
      if (focus && tab.focus) tab.focus();
    } else {
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
      if (panel) {
        panel.classList.add('ody-tabpanel');
        panel.classList.remove('is-active');
        panel.setAttribute('hidden', '');
        panel.setAttribute('role', 'tabpanel');
      }
    }
  }
  function moveTab(tab, dir) {
    var group = tabGroup(tab);
    var idx = group.indexOf(tab);
    idx = (idx + dir + group.length) % group.length;
    selectTab(group[idx], true);
  }

  /* ======================================================= 6. ACCORDION */
  function toggleCollapse(head) {
    var region = byRef(attr(head, 'data-ody-collapse'));
    if (!region) return;
    var container = closest(head, '[data-ody-accordion]');
    var single = container && /\bsingle\b/.test(attr(container, 'data-ody-accordion') || '');
    var willOpen = !region.classList.contains('is-open');
    if (willOpen && single && container) {
      $all('[data-ody-collapse]', container).forEach(function (h) {
        if (h === head) return;
        var r = byRef(attr(h, 'data-ody-collapse'));
        if (r) { r.classList.remove('is-open'); r.setAttribute('hidden', ''); }
        h.setAttribute('aria-expanded', 'false');
      });
    }
    region.classList.toggle('is-open', willOpen);
    if (willOpen) region.removeAttribute('hidden'); else region.setAttribute('hidden', '');
    head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
  function initAccordion(container) {
    $all('[data-ody-collapse]', container).forEach(function (head) {
      var region = byRef(attr(head, 'data-ody-collapse'));
      var open = region && region.classList.contains('is-open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (region) {
        if (head.id) region.setAttribute('aria-labelledby', head.id);
        if (!open) region.setAttribute('hidden', '');
      }
    });
  }

  /* =========================================================== 7. TOAST */
  function toastRegion() {
    var region = $('.ody-toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'ody-toast-region';
      region.setAttribute('role', 'region');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(region);
    }
    return region;
  }
  function toast(opts) {
    opts = opts || {};
    var tone = opts.tone || 'info';
    var timeout = opts.timeout === undefined ? 4200 : opts.timeout;
    var region = toastRegion();
    var el = document.createElement('div');
    el.className = 'ody-toast ody-toast--' + tone;
    el.setAttribute('role', tone === 'down' || tone === 'err' || tone === 'error' ? 'alert' : 'status');

    var body = document.createElement('div');
    body.className = 'ody-toast__body';
    if (opts.title) {
      var t = document.createElement('div');
      t.className = 'ody-toast__title';
      t.textContent = opts.title;
      body.appendChild(t);
    }
    if (opts.message) {
      var m = document.createElement('div');
      m.className = 'ody-toast__msg';
      m.textContent = opts.message;
      body.appendChild(m);
    }
    el.appendChild(body);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ody-toast__close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M6 6l12 12M18 6L6 18"/></svg>';
    el.appendChild(close);

    var timer;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.classList.remove('is-open');
      el.classList.add('is-leaving');
      var done = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      var to = setTimeout(done, 260);
      on(el, 'transitionend', function () { clearTimeout(to); done(); });
    }
    on(close, 'click', dismiss);
    region.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-open');
    if (timeout > 0) timer = setTimeout(dismiss, timeout);
    return { el: el, dismiss: dismiss };
  }

  /* ========================================================= 8. TOOLTIP */
  var activeTooltip = null;
  function placeFloating(node, trigger, placement) {
    var r = trigger.getBoundingClientRect();
    var nr = node.getBoundingClientRect();
    var gap = 8, top, left;
    switch (placement) {
      case 'bottom': top = r.bottom + gap; left = r.left + (r.width - nr.width) / 2; break;
      case 'left':   top = r.top + (r.height - nr.height) / 2; left = r.left - nr.width - gap; break;
      case 'right':  top = r.top + (r.height - nr.height) / 2; left = r.right + gap; break;
      default:       top = r.top - nr.height - gap; left = r.left + (r.width - nr.width) / 2; // top
    }
    left = Math.max(8, Math.min(left, window.innerWidth - nr.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - nr.height - 8));
    node.style.top = (top + window.pageYOffset) + 'px';
    node.style.left = (left + window.pageXOffset) + 'px';
  }
  function showTooltip(trigger) {
    hideTooltip();
    var text = attr(trigger, 'data-ody-tooltip');
    if (!text) return;
    var placement = attr(trigger, 'data-ody-placement') || 'top';
    var node = document.createElement('div');
    node.className = 'ody-tooltip ody-tooltip--' + placement;
    node.setAttribute('role', 'tooltip');
    node.textContent = text;
    var id = trigger.id ? trigger.id + '-tt' : 'ody-tt-' + Date.now();
    node.id = id;
    trigger.setAttribute('aria-describedby', id);
    document.body.appendChild(node);
    placeFloating(node, trigger, placement);
    void node.offsetWidth;
    node.classList.add('is-open');
    activeTooltip = { node: node, trigger: trigger };
  }
  function hideTooltip() {
    if (!activeTooltip) return;
    if (activeTooltip.trigger) activeTooltip.trigger.removeAttribute('aria-describedby');
    if (activeTooltip.node && activeTooltip.node.parentNode) {
      activeTooltip.node.parentNode.removeChild(activeTooltip.node);
    }
    activeTooltip = null;
  }

  /* ========================================================= 9. POPOVER */
  var activePopover = null;
  function closePopover() {
    if (!activePopover) return;
    activePopover.content.classList.remove('is-open');
    activePopover.content.setAttribute('hidden', '');
    if (activePopover.trigger) activePopover.trigger.setAttribute('aria-expanded', 'false');
    activePopover = null;
  }
  function togglePopover(trigger) {
    var content = byRef(attr(trigger, 'data-ody-popover'));
    if (!content) return;
    if (activePopover && activePopover.content === content) { closePopover(); return; }
    closePopover();
    content.classList.add('ody-popover');
    content.removeAttribute('hidden');
    var placement = attr(trigger, 'data-ody-placement') || 'bottom';
    // only absolutely position when detached / body-level; otherwise leave to CSS
    if (content.parentElement === document.body) placeFloating(content, trigger, placement);
    void content.offsetWidth;
    content.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    activePopover = { content: content, trigger: trigger };
  }

  /* ========================================================= 10. COPY */
  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }
  function doCopy(btn) {
    var text = attr(btn, 'data-ody-copy-text');
    if (text === null) {
      var target = byRef(attr(btn, 'data-ody-copy'));
      if (target) text = (target.value !== undefined && target.value !== '') ? target.value
        : (target.textContent || '');
    }
    if (text === null || text === undefined) return;
    writeClipboard(text).then(function () {
      btn.classList.add('is-copied');
      var prevLabel = btn.getAttribute('aria-label');
      setTimeout(function () {
        btn.classList.remove('is-copied');
        if (prevLabel) btn.setAttribute('aria-label', prevLabel);
      }, 1400);
    }).catch(function () {});
  }

  /* ==================================================== GLOBAL LISTENERS */
  function onClick(e) {
    var t = e.target;

    // theme toggle
    var themeBtn = closest(t, '[data-ody-theme-toggle]');
    if (themeBtn) { e.preventDefault(); toggleTheme(); return; }

    // overlay open (modal / drawer)
    var opener = closest(t, '[data-ody-open]');
    if (opener) {
      var overlay = byRef(attr(opener, 'data-ody-open'));
      if (overlay) { e.preventDefault(); openModal(overlay, opener); return; }
    }

    // overlay dismiss button
    var dismiss = closest(t, '[data-ody-dismiss]');
    if (dismiss) {
      var ov = closest(dismiss, '.ody-modal, .ody-drawer');
      if (ov) { e.preventDefault(); closeModal(ov); return; }
    }

    // backdrop click
    if (t.classList && (t.classList.contains('ody-modal__backdrop') ||
        t.classList.contains('ody-drawer__backdrop'))) {
      var ovb = closest(t, '.ody-modal, .ody-drawer');
      if (ovb) { closeModal(ovb); return; }
    }
    // click directly on overlay surface (outside panel) also closes
    if (t.classList && (t.classList.contains('ody-modal') || t.classList.contains('ody-drawer'))
        && t.classList.contains('is-open')) {
      closeModal(t); return;
    }

    // copy
    var copyBtn = closest(t, '[data-ody-copy],[data-ody-copy-text]');
    if (copyBtn) { e.preventDefault(); doCopy(copyBtn); return; }

    // dropdown toggle
    var ddToggle = closest(t, '[data-ody-toggle]');
    if (ddToggle && closest(ddToggle, '.ody-dropdown')) { e.preventDefault(); toggleMenu(ddToggle); return; }

    // menu item selection closes the menu
    var mItem = closest(t, '.ody-menu__item');
    if (mItem) {
      var m = closest(mItem, '.ody-menu');
      setTimeout(function () { closeAllMenus(null); }, 0);
      // fall through — allow the item's own handler/link to run
    }

    // popover
    var popTrigger = closest(t, '[data-ody-popover]');
    if (popTrigger) { e.preventDefault(); togglePopover(popTrigger); return; }

    // tab
    var tab = closest(t, '[role="tab"][data-ody-panel]');
    if (tab) { e.preventDefault(); selectTab(tab, false); return; }

    // accordion head
    var head = closest(t, '[data-ody-collapse]');
    if (head) { e.preventDefault(); toggleCollapse(head); return; }

    // outside-click cleanup
    if (!closest(t, '.ody-dropdown')) closeAllMenus(null);
    if (activePopover && !closest(t, '[data-ody-popover]') && !activePopover.content.contains(t)) {
      closePopover();
    }
  }

  function onKeydown(e) {
    var t = e.target;

    // Esc closes top overlay / menu / popover / tooltip
    if (e.key === 'Escape' || e.key === 'Esc') {
      var ov = topOverlay();
      if (ov) { e.preventDefault(); closeModal(ov); return; }
      if ($('.ody-dropdown .ody-menu.is-open')) {
        var openBtn = $('.ody-dropdown [data-ody-toggle][aria-expanded="true"]');
        closeAllMenus(null);
        if (openBtn) openBtn.focus();
        return;
      }
      if (activePopover) { var pt = activePopover.trigger; closePopover(); pt && pt.focus(); return; }
      if (activeTooltip) { hideTooltip(); return; }
    }

    // focus trap inside modal/drawer
    var ovTop = topOverlay();
    if (ovTop && ovTop.contains(t)) trapFocus(e, ovTop);

    // menu keyboard nav
    var menu = closest(t, '.ody-menu.is-open');
    if (menu) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveMenuFocus(menu, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveMenuFocus(menu, -1); }
      else if (e.key === 'Home') { e.preventDefault(); var mi = menuItems(menu); mi[0] && mi[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); var me = menuItems(menu); me[me.length - 1] && me[me.length - 1].focus(); }
      return;
    }
    // open menu from toggle with arrow/enter/space
    var ddToggle = closest(t, '[data-ody-toggle]');
    if (ddToggle && closest(ddToggle, '.ody-dropdown')) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (attr(ddToggle, 'aria-expanded') !== 'true') toggleMenu(ddToggle);
        else moveMenuFocus($('.ody-menu', closest(ddToggle, '.ody-dropdown')), 1);
      }
      return;
    }

    // tab keyboard nav
    var tab = closest(t, '[role="tab"][data-ody-panel]');
    if (tab) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveTab(tab, 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveTab(tab, -1); }
      else if (e.key === 'Home') { e.preventDefault(); var g = tabGroup(tab); selectTab(g[0], true); }
      else if (e.key === 'End') { e.preventDefault(); var ge = tabGroup(tab); selectTab(ge[ge.length - 1], true); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(tab, true); }
      return;
    }

    // accordion head with Enter/Space (if not a native button)
    var head = closest(t, '[data-ody-collapse]');
    if (head && (e.key === 'Enter' || e.key === ' ') && head.tagName !== 'BUTTON') {
      e.preventDefault(); toggleCollapse(head); return;
    }
  }

  function onOver(e) {
    var trig = closest(e.target, '[data-ody-tooltip]');
    if (trig) showTooltip(trig);
  }
  function onOut(e) {
    var trig = closest(e.target, '[data-ody-tooltip]');
    if (trig && activeTooltip && activeTooltip.trigger === trig) {
      var to = e.relatedTarget;
      if (!trig.contains(to)) hideTooltip();
    }
  }
  function onFocusIn(e) {
    var trig = closest(e.target, '[data-ody-tooltip]');
    if (trig) showTooltip(trig);
  }
  function onFocusOut(e) {
    var trig = closest(e.target, '[data-ody-tooltip]');
    if (trig && activeTooltip && activeTooltip.trigger === trig) hideTooltip();
  }

  var globalsBound = false;
  function bindGlobals() {
    if (globalsBound) return;
    globalsBound = true;
    on(document, 'click', onClick, true);
    on(document, 'keydown', onKeydown, false);
    on(document, 'mouseover', onOver, false);
    on(document, 'mouseout', onOut, false);
    on(document, 'focusin', onFocusIn, false);
    on(document, 'focusout', onFocusOut, false);
    on(window, 'resize', function () {
      if (activeTooltip) placeFloating(activeTooltip.node, activeTooltip.trigger,
        attr(activeTooltip.trigger, 'data-ody-placement') || 'top');
      if (activePopover && activePopover.content.parentElement === document.body) {
        placeFloating(activePopover.content, activePopover.trigger,
          attr(activePopover.trigger, 'data-ody-placement') || 'bottom');
      }
    });
  }

  /* ================================================================ INIT */
  function init(root) {
    root = root || document;
    bindGlobals();
    initTheme();
    $all('[data-ody-tabs]', root).forEach(initTabs);
    if (root.matches && root.matches('[data-ody-tabs]')) initTabs(root);
    $all('[data-ody-accordion]', root).forEach(initAccordion);
    if (root.matches && root.matches('[data-ody-accordion]')) initAccordion(root);
    // ensure overlays start hidden unless flagged open
    $all('.ody-modal, .ody-drawer', root).forEach(function (ov) {
      if (!ov.classList.contains('is-open') && !ov.hasAttribute('hidden')) ov.setAttribute('hidden', '');
    });
    // wire toggle buttons' aria default
    $all('.ody-dropdown [data-ody-toggle]', root).forEach(function (b) {
      if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false');
      if (!b.hasAttribute('aria-haspopup')) b.setAttribute('aria-haspopup', 'true');
    });
    $all('[data-ody-popover]', root).forEach(function (b) {
      if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false');
      if (!b.hasAttribute('aria-haspopup')) b.setAttribute('aria-haspopup', 'dialog');
      var content = byRef(attr(b, 'data-ody-popover'));
      if (content) b.setAttribute('aria-controls', ensureId(content, 'ody-popover-'));
    });
    return Odyssey;
  }

  /* ============================================================== EXPORT */
  var Odyssey = {
    version: VERSION,
    init: init,
    toast: toast,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    currentTheme: currentTheme,
    openModal: openModal,
    closeModal: closeModal,
    openDrawer: openModal,
    closeDrawer: closeModal,
    toggleMenu: toggleMenu,
    closeMenus: function () { closeAllMenus(null); },
    selectTab: selectTab,
    toggleCollapse: toggleCollapse,
    togglePopover: togglePopover,
    closePopover: closePopover,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    copy: doCopy
  };

  window.Odyssey = Odyssey;

  if (document.readyState === 'loading') {
    on(document, 'DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

})(window, document);


/* ============================================================================
 * === v1.1 forms-ext ===
 * ========================================================================== */
/* ============================================================================
 * Odyssey UI JS · BATCH forms-ext (additive)
 * Self-contained IIFE. Extends window.Odyssey with advanced form controls.
 * Zero deps · delegated from document · data-ody-* driven · keyboard + ARIA.
 * Exposed on window.Odyssey: initExtForms(root), comboboxClose(el),
 *   multiselectValue(el)->[], tagValues(el)->[], otpValue(el)->str,
 *   ratingValue(el)->n, dualrangeValue(el)->{low,high}, segmentValue(el).
 * Events emitted: native 'change' (combobox/datepicker/timepicker/otp cell),
 *   'ody:change' (multiselect/taginput/dualrange/rating/segment/swatch/otp).
 * ========================================================================== */
(function (window, document) {
  'use strict';

  var API = (window.Odyssey = window.Odyssey || {});

  /* ---------------------------------------------------------------- utils */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function on(el, t, fn, o) { el.addEventListener(t, fn, o || false); }
  function closest(el, sel) {
    if (!el) return null;
    if (el.closest) return el.closest(sel);
    while (el && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentElement; }
    return null;
  }
  function attr(el, n) { return el ? el.getAttribute(n) : null; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  var CX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.26 6.85.72-5.1 4.62 1.44 6.7L12 17.6 5.91 20.3l1.44-6.7-5.1-4.62 6.85-.72z"/></svg>';

  /* ============================================================ COMBOBOX */
  function cbxOpts(cb) { return $$('.ody-combobox__opt', cb); }
  function cbxLabel(opt) {
    if (opt.dataset.odyLabel == null) opt.dataset.odyLabel = (opt.textContent || '').trim();
    return opt.dataset.odyLabel;
  }
  function cbxFilter(cb) {
    var input = $('.ody-combobox__input', cb);
    var q = (input.value || '').trim().toLowerCase();
    var list = $('.ody-combobox__list', cb), shown = 0;
    cbxOpts(cb).forEach(function (opt) {
      var label = cbxLabel(opt), i = label.toLowerCase().indexOf(q);
      var hit = q === '' || i >= 0;
      opt.hidden = !hit;
      opt.classList.remove('is-active');
      if (hit) {
        shown++;
        opt.innerHTML = (q && i >= 0)
          ? label.slice(0, i) + '<mark>' + label.slice(i, i + q.length) + '</mark>' + label.slice(i + q.length)
          : label;
      }
    });
    var empty = $('.ody-combobox__empty', list);
    if (!empty) { empty = document.createElement('div'); empty.className = 'ody-combobox__empty'; empty.textContent = 'No matches'; list.appendChild(empty); }
    empty.hidden = shown > 0;
  }
  function cbxOpen(cb) { cbxFilter(cb); cb.classList.add('is-open'); var inp = $('.ody-combobox__input', cb); inp && inp.setAttribute('aria-expanded', 'true'); }
  function cbxClose(cb) { cb.classList.remove('is-open'); var inp = $('.ody-combobox__input', cb); inp && inp.setAttribute('aria-expanded', 'false'); cbxOpts(cb).forEach(function (o) { o.classList.remove('is-active'); }); }
  function cbxActive(cb) { return $('.ody-combobox__opt.is-active', cb); }
  function cbxVisible(cb) { return cbxOpts(cb).filter(function (o) { return !o.hidden; }); }
  function cbxMove(cb, dir) {
    var vis = cbxVisible(cb); if (!vis.length) return;
    var cur = cbxActive(cb), i = cur ? vis.indexOf(cur) : -1;
    if (cur) cur.classList.remove('is-active');
    i = (i + dir + vis.length) % vis.length;
    vis[i].classList.add('is-active');
    vis[i].scrollIntoView({ block: 'nearest' });
  }
  function cbxPick(cb, opt) {
    var input = $('.ody-combobox__input', cb);
    input.value = opt.dataset.value != null ? opt.dataset.value : cbxLabel(opt);
    cbxClose(cb);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ========================================================= MULTISELECT */
  function msOpts(ms) { return $$('.ody-multiselect__opt', ms); }
  function msRender(ms) {
    var box = $('.ody-multiselect__values', ms);
    var sel = msOpts(ms).filter(function (o) { return o.classList.contains('is-selected'); });
    box.innerHTML = '';
    if (!sel.length) {
      var ph = document.createElement('span'); ph.className = 'ody-multiselect__ph';
      ph.textContent = attr(ms, 'data-placeholder') || 'Select…';
      box.appendChild(ph); return;
    }
    sel.forEach(function (o) {
      var chip = document.createElement('span'); chip.className = 'ody-multiselect__chip';
      chip.appendChild(document.createTextNode((o.textContent || '').trim()));
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'ody-multiselect__chip-x'; x.innerHTML = CX;
      x.setAttribute('aria-label', 'Remove'); x.dataset.odyMsRemove = o.dataset.value != null ? o.dataset.value : (o.textContent || '').trim();
      chip.appendChild(x); box.appendChild(chip);
    });
  }
  function msValue(ms) {
    return msOpts(ms).filter(function (o) { return o.classList.contains('is-selected'); })
      .map(function (o) { return o.dataset.value != null ? o.dataset.value : (o.textContent || '').trim(); });
  }
  function msToggle(ms, opt) { opt.classList.toggle('is-selected'); opt.setAttribute('aria-selected', opt.classList.contains('is-selected') ? 'true' : 'false'); msRender(ms); ms.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: msValue(ms) } })); }
  function msClose(ms) { ms.classList.remove('is-open'); }

  /* ============================================================ TAGINPUT */
  function tiValues(ti) { return $$('.ody-taginput__chip', ti).map(function (c) { return (c.dataset.value || '').trim(); }); }
  function tiAdd(ti, raw) {
    var val = (raw || '').trim(); if (!val) return;
    var dup = attr(ti, 'data-allow-dupes') != null ? false : tiValues(ti).indexOf(val) >= 0;
    if (dup) return;
    var chip = document.createElement('span'); chip.className = 'ody-taginput__chip'; chip.dataset.value = val;
    chip.appendChild(document.createTextNode(val));
    var x = document.createElement('button'); x.type = 'button'; x.className = 'ody-taginput__chip-x'; x.innerHTML = CX; x.setAttribute('aria-label', 'Remove');
    chip.appendChild(x);
    ti.insertBefore(chip, $('.ody-taginput__field', ti));
    ti.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: tiValues(ti) } }));
  }
  function tiRemove(ti, chip) { if (chip) { chip.parentNode.removeChild(chip); ti.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: tiValues(ti) } })); } }

  /* =========================================================== DATEPICKER */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  function dpState(dp) {
    if (dp._ody) return dp._ody;
    var input = $('.ody-datepicker__input', dp), sel = null, base = new Date();
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
      var p = input.value.split('-'); sel = new Date(+p[0], +p[1] - 1, +p[2]); base = new Date(sel);
    }
    return (dp._ody = { y: base.getFullYear(), m: base.getMonth(), sel: sel });
  }
  function dpRender(dp) {
    var st = dpState(dp), panel = $('.ody-datepicker__panel', dp);
    var first = new Date(st.y, st.m, 1), start = (first.getDay() + 6) % 7;
    var days = new Date(st.y, st.m + 1, 0).getDate();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var cells = '';
    for (var i = 0; i < 7; i++) cells += '<div class="ody-datepicker__dow">' + DOW[i] + '</div>';
    for (var b = 0; b < start; b++) cells += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(st.y, st.m, d), cls = 'ody-datepicker__day';
      if (dt.getTime() === today.getTime()) cls += ' is-today';
      if (st.sel && dt.getTime() === new Date(st.sel).setHours(0, 0, 0, 0)) cls += ' is-selected';
      cells += '<button type="button" class="' + cls + '" data-ody-dp-day="' + d + '">' + d + '</button>';
    }
    panel.innerHTML =
      '<div class="ody-datepicker__head">' +
      '<button type="button" class="ody-datepicker__nav" data-ody-dp-nav="-1" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<span class="ody-datepicker__title">' + MONTHS[st.m] + ' ' + st.y + '</span>' +
      '<button type="button" class="ody-datepicker__nav" data-ody-dp-nav="1" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
      '</div><div class="ody-datepicker__grid">' + cells + '</div>';
  }
  function dpOpen(dp) { dpRender(dp); dp.classList.add('is-open'); }
  function dpClose(dp) { dp.classList.remove('is-open'); }
  function dpPick(dp, day) {
    var st = dpState(dp); st.sel = new Date(st.y, st.m, day);
    var input = $('.ody-datepicker__input', dp);
    if (input) { input.value = st.y + '-' + pad2(st.m + 1) + '-' + pad2(day); input.dispatchEvent(new Event('change', { bubbles: true })); }
    dpClose(dp);
  }

  /* =========================================================== TIMEPICKER */
  function tpBuild(tp) {
    if (tp._ody) return;
    tp._ody = true;
    var panel = $('.ody-timepicker__panel', tp);
    var step = parseInt(attr(tp, 'data-minute-step'), 10) || 5, h = '', mm = '';
    for (var i = 0; i < 24; i++) h += '<button type="button" class="ody-timepicker__opt" data-ody-tp-h="' + i + '">' + pad2(i) + '</button>';
    for (var m = 0; m < 60; m += step) mm += '<button type="button" class="ody-timepicker__opt" data-ody-tp-m="' + m + '">' + pad2(m) + '</button>';
    panel.innerHTML = '<div class="ody-timepicker__col" data-col="h">' + h + '</div><div class="ody-timepicker__col" data-col="m">' + mm + '</div>';
  }
  function tpSync(tp) {
    var input = $('.ody-timepicker__input', tp), parts = /^(\d{1,2}):(\d{1,2})$/.exec(input && input.value || '');
    $$('.ody-timepicker__opt', tp).forEach(function (o) { o.classList.remove('is-active'); });
    if (!parts) return;
    var hb = $('[data-ody-tp-h="' + +parts[1] + '"]', tp), mb = $('[data-ody-tp-m="' + +parts[2] + '"]', tp);
    if (hb) { hb.classList.add('is-active'); hb.scrollIntoView({ block: 'nearest' }); }
    if (mb) { mb.classList.add('is-active'); mb.scrollIntoView({ block: 'nearest' }); }
  }
  function tpOpen(tp) { tpBuild(tp); tpSync(tp); tp.classList.add('is-open'); }
  function tpClose(tp) { tp.classList.remove('is-open'); }
  function tpSet(tp) {
    var input = $('.ody-timepicker__input', tp);
    var hb = $('.ody-timepicker__opt.is-active[data-ody-tp-h]', tp), mb = $('.ody-timepicker__opt.is-active[data-ody-tp-m]', tp);
    var hh = hb ? +hb.dataset.odyTpH : 0, min = mb ? +mb.dataset.odyTpM : 0;
    if (input) { input.value = pad2(hh) + ':' + pad2(min); input.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  /* ============================================================ DUALRANGE */
  function drInit(dr) {
    if (dr._ody) return;
    var min = +attr(dr, 'data-min') || 0, max = attr(dr, 'data-max') != null ? +attr(dr, 'data-max') : 100;
    var step = +attr(dr, 'data-step') || 1;
    var lo = attr(dr, 'data-low') != null ? +attr(dr, 'data-low') : min;
    var hi = attr(dr, 'data-high') != null ? +attr(dr, 'data-high') : max;
    dr._ody = { min: min, max: max, step: step, lo: lo, hi: hi };
    dr.innerHTML =
      '<div class="ody-dualrange__track"><div class="ody-dualrange__fill"></div>' +
      '<button type="button" class="ody-dualrange__thumb" data-ody-dr-thumb="lo" role="slider" aria-label="Minimum"></button>' +
      '<button type="button" class="ody-dualrange__thumb" data-ody-dr-thumb="hi" role="slider" aria-label="Maximum"></button></div>';
    drPaint(dr);
  }
  function drPct(dr, v) { var s = dr._ody; return (v - s.min) / (s.max - s.min) * 100; }
  function drPaint(dr) {
    var s = dr._ody, a = drPct(dr, s.lo), b = drPct(dr, s.hi);
    var fill = $('.ody-dualrange__fill', dr), tlo = $('[data-ody-dr-thumb="lo"]', dr), thi = $('[data-ody-dr-thumb="hi"]', dr);
    fill.style.left = a + '%'; fill.style.width = (b - a) + '%';
    tlo.style.left = a + '%'; thi.style.left = b + '%';
    tlo.setAttribute('aria-valuenow', s.lo); tlo.setAttribute('aria-valuemin', s.min); tlo.setAttribute('aria-valuemax', s.hi);
    thi.setAttribute('aria-valuenow', s.hi); thi.setAttribute('aria-valuemin', s.lo); thi.setAttribute('aria-valuemax', s.max);
    var parent = dr.parentElement || document, lo = $('[data-ody-dr-low]', parent), hi = $('[data-ody-dr-high]', parent);
    if (lo) lo.textContent = s.lo; if (hi) hi.textContent = s.hi;
  }
  function drSet(dr, which, val) {
    var s = dr._ody;
    val = Math.round((val - s.min) / s.step) * s.step + s.min;
    val = Math.max(s.min, Math.min(s.max, val));
    if (which === 'lo') s.lo = Math.min(val, s.hi); else s.hi = Math.max(val, s.lo);
    drPaint(dr);
    dr.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { low: s.lo, high: s.hi } }));
  }
  function drFromX(dr, clientX) {
    var s = dr._ody, r = $('.ody-dualrange__track', dr).getBoundingClientRect();
    var ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return s.min + ratio * (s.max - s.min);
  }

  /* ============================================================= DROPZONE */
  function dzStore(dz) { if (!dz._dt) dz._dt = (typeof DataTransfer !== 'undefined') ? new DataTransfer() : null; return dz._dt; }
  function dzFmt(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  function dzList(dz) {
    var target = $('[data-ody-dropzone-files]', dz.parentElement || document) || $('.ody-dropzone__files', dz.parentElement || document);
    if (!target) return;
    var input = $('input[type="file"]', dz), files = input ? input.files : [];
    target.innerHTML = '';
    Array.prototype.forEach.call(files, function (f, i) {
      var row = document.createElement('div'); row.className = 'ody-dropzone__file';
      row.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>' +
        '<span class="ody-dropzone__file-name"></span><span class="ody-dropzone__file-size">' + dzFmt(f.size) + '</span>' +
        '<button type="button" class="ody-dropzone__file-x" data-ody-dz-remove="' + i + '" aria-label="Remove">' + CX + '</button>';
      row.querySelector('.ody-dropzone__file-name').textContent = f.name;
      target.appendChild(row);
    });
  }
  function dzSetFiles(dz, fileList) {
    var input = $('input[type="file"]', dz), dt = dzStore(dz);
    if (dt) {
      if (!(input && input.multiple)) { try { dt.items.clear(); } catch (e) {} }
      Array.prototype.forEach.call(fileList, function (f) { dt.items.add(f); });
      if (input) input.files = dt.files;
    }
    dzList(dz);
    if (input) input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function dzRemove(dz, idx) {
    var input = $('input[type="file"]', dz), dt = dzStore(dz);
    if (dt && input) {
      var keep = Array.prototype.filter.call(input.files, function (f, i) { return i !== idx; });
      try { dt.items.clear(); } catch (e) {}
      keep.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
    }
    dzList(dz);
  }

  /* =============================================================== RATING */
  function rtInit(rt) {
    if (rt._ody) return; rt._ody = true;
    var max = +attr(rt, 'data-max') || 5, val = +attr(rt, 'data-value') || 0;
    var ro = attr(rt, 'data-readonly') != null;
    rt.setAttribute('role', 'radiogroup');
    if (ro) rt.classList.add('is-readonly');
    var html = '';
    for (var i = 1; i <= max; i++) {
      html += '<button type="button" class="ody-rating__star" data-ody-rt-val="' + i + '" role="radio" aria-label="' + i + '"' + (ro ? ' tabindex="-1"' : '') + '>' + STAR + '</button>';
    }
    rt.innerHTML = html;
    rtPaint(rt, val);
  }
  function rtPaint(rt, n) {
    $$('.ody-rating__star', rt).forEach(function (s) {
      var v = +s.dataset.odyRtVal, on = v <= n;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-checked', v === (+attr(rt, 'data-value') || 0) ? 'true' : 'false');
    });
  }
  function rtSet(rt, n) { rt.setAttribute('data-value', n); rtPaint(rt, n); rt.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: n } })); }

  /* =================================================================== OTP */
  function otpInit(otp) {
    if (otp._ody) return; otp._ody = true;
    var len = +attr(otp, 'data-len') || 6;
    var mode = attr(otp, 'data-mode') === 'text' ? 'text' : 'numeric';
    var html = '';
    for (var i = 0; i < len; i++) {
      html += '<input class="ody-otp__cell" type="text" inputmode="' + (mode === 'text' ? 'text' : 'numeric') + '" maxlength="1" autocomplete="one-time-code" aria-label="Digit ' + (i + 1) + '">';
    }
    otp.innerHTML = html;
    otp._mode = mode;
  }
  function otpCells(otp) { return $$('.ody-otp__cell', otp); }
  function otpValue(otp) { return otpCells(otp).map(function (c) { return c.value; }).join(''); }

  /* =============================================================== SWATCH */
  function swSet(sw) {
    var wrap = closest(sw, '.ody-swatches');
    $$('.ody-swatch', wrap).forEach(function (s) { s.classList.toggle('is-active', s === sw); s.setAttribute('aria-checked', s === sw ? 'true' : 'false'); });
    wrap.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: sw.dataset.value || sw.getAttribute('aria-label') || '' } }));
  }

  /* ========================================================= INIT (build) */
  function initExt(root) {
    root = root || document;
    $$('[data-ody-dualrange]', root).forEach(drInit);
    $$('[data-ody-rating]', root).forEach(rtInit);
    $$('[data-ody-otp]', root).forEach(otpInit);
    $$('.ody-combobox__input', root).forEach(function (i) { i.setAttribute('role', 'combobox'); i.setAttribute('aria-autocomplete', 'list'); i.setAttribute('aria-expanded', 'false'); });
    $$('[data-ody-multiselect]', root).forEach(msRender);
    return API;
  }

  /* ==================================================== GLOBAL LISTENERS */
  function onInput(e) {
    var t = e.target;
    var cbxIn = closest(t, '.ody-combobox__input');
    if (cbxIn) { cbxOpen(closest(cbxIn, '.ody-combobox')); return; }
    var otpCell = closest(t, '.ody-otp__cell');
    if (otpCell) {
      var otp = closest(otpCell, '.ody-otp');
      var v = otpCell.value;
      if (otp._mode !== 'text') v = v.replace(/[^0-9]/g, '');
      otpCell.value = v.slice(-1);
      otpCell.classList.toggle('is-filled', !!otpCell.value);
      if (otpCell.value) { var nx = otpCell.nextElementSibling; while (nx && !nx.classList.contains('ody-otp__cell')) nx = nx.nextElementSibling; if (nx) nx.focus(); }
      otp.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: otpValue(otp) } }));
    }
  }

  function onClick(e) {
    var t = e.target;

    /* combobox */
    var cbxIn = closest(t, '.ody-combobox__input');
    if (cbxIn) { cbxOpen(closest(cbxIn, '.ody-combobox')); return; }
    var cbxOpt = closest(t, '.ody-combobox__opt');
    if (cbxOpt) { cbxPick(closest(cbxOpt, '.ody-combobox'), cbxOpt); return; }

    /* multiselect */
    var msX = closest(t, '[data-ody-ms-remove]');
    if (msX) {
      var msW = closest(msX, '.ody-multiselect'), val = msX.dataset.odyMsRemove;
      msOpts(msW).forEach(function (o) { var ov = o.dataset.value != null ? o.dataset.value : (o.textContent || '').trim(); if (ov === val) { o.classList.remove('is-selected'); o.setAttribute('aria-selected', 'false'); } });
      msRender(msW); e.stopPropagation(); return;
    }
    var msOpt = closest(t, '.ody-multiselect__opt');
    if (msOpt) { msToggle(closest(msOpt, '.ody-multiselect'), msOpt); return; }
    var msCtl = closest(t, '.ody-multiselect__control');
    if (msCtl) { var ms = closest(msCtl, '.ody-multiselect'); ms.classList.toggle('is-open'); return; }

    /* taginput */
    var tiX = closest(t, '.ody-taginput__chip-x');
    if (tiX) { tiRemove(closest(tiX, '.ody-taginput'), closest(tiX, '.ody-taginput__chip')); return; }
    var ti = closest(t, '.ody-taginput');
    if (ti && !closest(t, '.ody-taginput__chip')) { var fld = $('.ody-taginput__field', ti); fld && fld.focus(); }

    /* datepicker */
    var dpIn = closest(t, '.ody-datepicker__input');
    if (dpIn) { var dp = closest(dpIn, '.ody-datepicker'); dp.classList.contains('is-open') ? dpClose(dp) : dpOpen(dp); return; }
    var dpNav = closest(t, '[data-ody-dp-nav]');
    if (dpNav) { var dpn = closest(dpNav, '.ody-datepicker'), st = dpState(dpn); st.m += +dpNav.dataset.odyDpNav; if (st.m < 0) { st.m = 11; st.y--; } else if (st.m > 11) { st.m = 0; st.y++; } dpRender(dpn); return; }
    var dpDay = closest(t, '[data-ody-dp-day]');
    if (dpDay) { dpPick(closest(dpDay, '.ody-datepicker'), +dpDay.dataset.odyDpDay); return; }

    /* timepicker */
    var tpIn = closest(t, '.ody-timepicker__input');
    if (tpIn) { var tp = closest(tpIn, '.ody-timepicker'); tp.classList.contains('is-open') ? tpClose(tp) : tpOpen(tp); return; }
    var tpOpt = closest(t, '.ody-timepicker__opt');
    if (tpOpt) {
      var tpw = closest(tpOpt, '.ody-timepicker'), col = closest(tpOpt, '.ody-timepicker__col');
      $$('.ody-timepicker__opt', col).forEach(function (o) { o.classList.remove('is-active'); });
      tpOpt.classList.add('is-active'); tpSet(tpw); return;
    }

    /* dropzone remove */
    var dzX = closest(t, '[data-ody-dz-remove]');
    if (dzX) { e.preventDefault(); dzRemove(closest(dzX, '.ody-dropzone'), +dzX.dataset.odyDzRemove); return; }

    /* rating */
    var star = closest(t, '.ody-rating__star');
    if (star) { var rt = closest(star, '.ody-rating'); if (!rt.classList.contains('is-readonly')) rtSet(rt, +star.dataset.odyRtVal); return; }

    /* segment */
    var seg = closest(t, '.ody-segment__item');
    if (seg && !seg.disabled) {
      var grp = closest(seg, '.ody-segment');
      $$('.ody-segment__item', grp).forEach(function (b) { b.classList.toggle('is-active', b === seg); b.setAttribute('aria-checked', b === seg ? 'true' : 'false'); });
      grp.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: seg.dataset.value || (seg.textContent || '').trim() } }));
      return;
    }

    /* swatch */
    var sw = closest(t, '.ody-swatch');
    if (sw) { swSet(sw); return; }

    /* outside-click close of open panels */
    $$('.ody-combobox.is-open', document).forEach(function (cb) { if (!cb.contains(t)) cbxClose(cb); });
    $$('.ody-multiselect.is-open', document).forEach(function (ms2) { if (!ms2.contains(t)) msClose(ms2); });
    $$('.ody-datepicker.is-open', document).forEach(function (dp2) { if (!dp2.contains(t)) dpClose(dp2); });
    $$('.ody-timepicker.is-open', document).forEach(function (tp2) { if (!tp2.contains(t)) tpClose(tp2); });
  }

  function onKeydown(e) {
    var t = e.target, k = e.key;

    /* combobox */
    var cbxIn = closest(t, '.ody-combobox__input');
    if (cbxIn) {
      var cb = closest(cbxIn, '.ody-combobox');
      if (k === 'ArrowDown') { e.preventDefault(); if (!cb.classList.contains('is-open')) cbxOpen(cb); else cbxMove(cb, 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); cbxMove(cb, -1); }
      else if (k === 'Enter') { var a = cbxActive(cb); if (a) { e.preventDefault(); cbxPick(cb, a); } }
      else if (k === 'Escape') { if (cb.classList.contains('is-open')) { e.preventDefault(); cbxClose(cb); } }
      return;
    }

    /* taginput */
    var tiFld = closest(t, '.ody-taginput__field');
    if (tiFld) {
      var ti = closest(tiFld, '.ody-taginput');
      if (k === 'Enter' || k === ',') { e.preventDefault(); tiAdd(ti, tiFld.value); tiFld.value = ''; }
      else if (k === 'Backspace' && tiFld.value === '') { var chips = $$('.ody-taginput__chip', ti); if (chips.length) tiRemove(ti, chips[chips.length - 1]); }
      return;
    }

    /* otp */
    var otpCell = closest(t, '.ody-otp__cell');
    if (otpCell) {
      var cells = otpCells(closest(otpCell, '.ody-otp')), idx = cells.indexOf(otpCell);
      if (k === 'Backspace' && otpCell.value === '' && idx > 0) { e.preventDefault(); cells[idx - 1].focus(); cells[idx - 1].value = ''; cells[idx - 1].classList.remove('is-filled'); }
      else if (k === 'ArrowLeft' && idx > 0) { e.preventDefault(); cells[idx - 1].focus(); }
      else if (k === 'ArrowRight' && idx < cells.length - 1) { e.preventDefault(); cells[idx + 1].focus(); }
      return;
    }

    /* rating */
    var star = closest(t, '.ody-rating__star');
    if (star) {
      var rt = closest(star, '.ody-rating'); if (rt.classList.contains('is-readonly')) return;
      var rv = +star.dataset.odyRtVal, mx = $$('.ody-rating__star', rt).length;
      if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); var n = Math.min(mx, rv + 1); rtSet(rt, n); $('[data-ody-rt-val="' + n + '"]', rt).focus(); }
      else if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); var p = Math.max(1, rv - 1); rtSet(rt, p); $('[data-ody-rt-val="' + p + '"]', rt).focus(); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); rtSet(rt, rv); }
      return;
    }

    /* segment arrow nav */
    var seg = closest(t, '.ody-segment__item');
    if (seg && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      var items = $$('.ody-segment__item', closest(seg, '.ody-segment')).filter(function (b) { return !b.disabled; });
      var ci = items.indexOf(seg), ni = (ci + (k === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      items[ni].focus(); items[ni].click();
      return;
    }

    /* dualrange keyboard */
    var thumb = closest(t, '.ody-dualrange__thumb');
    if (thumb) {
      var dr = closest(thumb, '.ody-dualrange'), which = thumb.dataset.odyDrThumb, s = dr._ody;
      var cur = which === 'lo' ? s.lo : s.hi, d = 0;
      if (k === 'ArrowRight' || k === 'ArrowUp') d = s.step;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') d = -s.step;
      else if (k === 'Home') { drSet(dr, which, s.min); e.preventDefault(); return; }
      else if (k === 'End') { drSet(dr, which, s.max); e.preventDefault(); return; }
      if (d) { e.preventDefault(); drSet(dr, which, cur + d); }
      return;
    }

    /* esc closes open panels */
    if (k === 'Escape') {
      var openDp = $('.ody-datepicker.is-open'); if (openDp) { dpClose(openDp); return; }
      var openTp = $('.ody-timepicker.is-open'); if (openTp) { tpClose(openTp); return; }
      var openMs = $('.ody-multiselect.is-open'); if (openMs) { msClose(openMs); return; }
    }
  }

  function onPaste(e) {
    var otpCell = closest(e.target, '.ody-otp__cell');
    if (!otpCell) return;
    var otp = closest(otpCell, '.ody-otp');
    var data = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (otp._mode !== 'text') data = data.replace(/[^0-9]/g, '');
    if (!data) return;
    e.preventDefault();
    var cells = otpCells(otp), start = cells.indexOf(otpCell);
    for (var i = 0; i < data.length && start + i < cells.length; i++) {
      cells[start + i].value = data[i]; cells[start + i].classList.add('is-filled');
    }
    var last = Math.min(cells.length - 1, start + data.length - 1); cells[last].focus();
    otp.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: otpValue(otp) } }));
  }

  /* dualrange pointer drag */
  var drag = null;
  function onPointerDown(e) {
    var thumb = closest(e.target, '.ody-dualrange__thumb');
    if (!thumb) return;
    var dr = closest(thumb, '.ody-dualrange');
    if (dr.classList.contains('is-disabled')) return;
    drag = { dr: dr, which: thumb.dataset.odyDrThumb };
    thumb.classList.add('is-drag'); thumb.focus();
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!drag) return;
    drSet(drag.dr, drag.which, drFromX(drag.dr, e.clientX));
  }
  function onPointerUp() {
    if (!drag) return;
    var th = $('.ody-dualrange__thumb.is-drag', drag.dr); if (th) th.classList.remove('is-drag');
    drag = null;
  }

  /* taginput focus ring */
  function onFocusIn(e) { var ti = closest(e.target, '.ody-taginput'); if (ti && closest(e.target, '.ody-taginput__field')) ti.classList.add('is-focus'); }
  function onFocusOut(e) { var ti = closest(e.target, '.ody-taginput'); if (ti && closest(e.target, '.ody-taginput__field')) ti.classList.remove('is-focus'); }

  /* dropzone drag + change */
  function onDragOver(e) { var dz = closest(e.target, '.ody-dropzone'); if (dz) { e.preventDefault(); dz.classList.add('is-dragover'); } }
  function onDragLeave(e) { var dz = closest(e.target, '.ody-dropzone'); if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('is-dragover'); }
  function onDrop(e) { var dz = closest(e.target, '.ody-dropzone'); if (dz) { e.preventDefault(); dz.classList.remove('is-dragover'); if (e.dataTransfer && e.dataTransfer.files.length) dzSetFiles(dz, e.dataTransfer.files); } }
  function onChange(e) { var dz = closest(e.target, '.ody-dropzone'); if (dz && e.target.matches('input[type="file"]')) dzList(dz); }

  var bound = false;
  function bindExt() {
    if (bound) return; bound = true;
    on(document, 'input', onInput, false);
    on(document, 'click', onClick, false);
    on(document, 'keydown', onKeydown, false);
    on(document, 'paste', onPaste, false);
    on(document, 'focusin', onFocusIn, false);
    on(document, 'focusout', onFocusOut, false);
    on(document, 'pointerdown', onPointerDown, false);
    on(document, 'pointermove', onPointerMove, false);
    on(document, 'pointerup', onPointerUp, false);
    on(document, 'dragover', onDragOver, false);
    on(document, 'dragenter', onDragOver, false);
    on(document, 'dragleave', onDragLeave, false);
    on(document, 'drop', onDrop, false);
    on(document, 'change', onChange, false);
  }

  /* expose */
  API.initExtForms = function (root) { bindExt(); return initExt(root); };
  var formsInit = API.init;
  API.init = function (root) {
    var out = typeof formsInit === 'function' ? formsInit.call(API, root) : API;
    API.initExtForms(root || document);
    return out || API;
  };
  API.comboboxClose = cbxClose;
  API.multiselectValue = msValue;
  API.tagValues = tiValues;
  API.otpValue = otpValue;
  API.ratingValue = function (rt) { return +attr(rt, 'data-value') || 0; };
  API.dualrangeValue = function (dr) { return dr._ody ? { low: dr._ody.lo, high: dr._ody.hi } : null; };
  API.segmentValue = function (grp) { var a = $('.ody-segment__item.is-active', grp); return a ? (a.dataset.value || (a.textContent || '').trim()) : null; };

  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', function () { API.initExtForms(document); });
  else API.initExtForms(document);

})(window, document);


/* ============================================================================
 * === v1.1 data-ext ===
 * ========================================================================== */
/* ============================================================ EXT: data-ext
 * Advanced data components — charts, tree, sortable/selectable table, kanban.
 * Self-contained; delegates from document; augments window.Odyssey.
 * ========================================================================== */
(function (window, document) {
  'use strict';
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function closestEl(el, sel) {
    if (!el) return null;
    if (el.closest) return el.closest(sel);
    while (el && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentElement; }
    return null;
  }
  function numbers(str) {
    return (str || '').split(',').map(function (s) { return parseFloat(s.trim()); })
      .filter(function (n) { return !isNaN(n); });
  }
  function words(str) { return (str || '').split(',').map(function (s) { return s.trim(); }); }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ------------------------------------------------------------- CHARTS */
  function renderChart(el) {
    if (!el || el.getAttribute('data-ody-chart-ready') === '1') return;
    var type = (el.getAttribute('data-ody-chart') || 'bar').trim();
    var vals = numbers(el.getAttribute('data-values'));
    if (!vals.length) return;
    var labels = words(el.getAttribute('data-labels'));
    var max = parseFloat(el.getAttribute('data-max'));
    if (isNaN(max)) max = Math.max.apply(null, vals);
    var min = Math.min(0, Math.min.apply(null, vals));
    var svg;
    if (type === 'bar') svg = barChart(vals, labels, max, min);
    else if (type === 'line') svg = lineChart(vals, labels, max, min);
    else if (type === 'donut') svg = donutChart(el, vals);
    else if (type === 'spark') svg = sparkChart(el, vals);
    else svg = barChart(vals, labels, max, min);
    el.innerHTML = '';
    el.appendChild(svg);
    el.setAttribute('data-ody-chart-ready', '1');
  }
  function barChart(vals, labels, max, min) {
    var W = 320, H = 160, padB = labels.length ? 22 : 6, padT = 14, padX = 4;
    var span = (max - min) || 1;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var n = vals.length, gap = 10, bw = (W - padX * 2 - gap * (n - 1)) / n, base = H - padB;
    var zeroY = padT + (max / span) * (base - padT);
    vals.forEach(function (v, i) {
      var x = padX + i * (bw + gap);
      var h = Math.abs(v / span) * (base - padT);
      var y = v >= 0 ? zeroY - h : zeroY;
      svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(1, h).toFixed(1), 'class': 'ody-chart__bar' }));
      if (labels[i]) {
        var t = svgEl('text', { x: (x + bw / 2).toFixed(1), y: (H - 6).toFixed(1), 'text-anchor': 'middle', 'class': 'ody-chart__lbl' });
        t.textContent = labels[i]; svg.appendChild(t);
      }
    });
    return svg;
  }
  function lineChart(vals, labels, max, min) {
    var W = 320, H = 160, padB = labels.length ? 22 : 8, padT = 12, padX = 6;
    var span = (max - min) || 1, base = H - padB, n = vals.length;
    var stepX = n > 1 ? (W - padX * 2) / (n - 1) : 0;
    function px(i) { return padX + i * stepX; }
    function py(v) { return padT + (1 - (v - min) / span) * (base - padT); }
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    // baseline grid
    svg.appendChild(svgEl('line', { x1: padX, y1: base, x2: W - padX, y2: base, 'class': 'ody-chart__grid' }));
    var d = '', area = '';
    vals.forEach(function (v, i) { var c = px(i).toFixed(1) + ' ' + py(v).toFixed(1); d += (i ? 'L' : 'M') + c + ' '; });
    area = d + 'L' + px(n - 1).toFixed(1) + ' ' + base + ' L' + px(0).toFixed(1) + ' ' + base + ' Z';
    svg.appendChild(svgEl('path', { d: area, 'class': 'ody-chart__area' }));
    svg.appendChild(svgEl('path', { d: d.trim(), 'class': 'ody-chart__line' }));
    vals.forEach(function (v, i) {
      svg.appendChild(svgEl('circle', { cx: px(i).toFixed(1), cy: py(v).toFixed(1), r: 3, 'class': 'ody-chart__dot' }));
      if (labels[i]) {
        var t = svgEl('text', { x: px(i).toFixed(1), y: (H - 6).toFixed(1), 'text-anchor': 'middle', 'class': 'ody-chart__lbl' });
        t.textContent = labels[i]; svg.appendChild(t);
      }
    });
    return svg;
  }
  function donutChart(el, vals) {
    var W = 140, cx = 70, cy = 70, r = 54, sw = 18, C = 2 * Math.PI * r;
    var total = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
    var tones = words(el.getAttribute('data-tones'));
    var toneClass = ['', '--ok', '--warn', '--down', '--info'];
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + W, role: 'img' });
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, 'stroke-width': sw, 'class': 'ody-chart__track' }));
    var offset = 0;
    vals.forEach(function (v, i) {
      var frac = v / total, len = frac * C;
      var cls = 'ody-chart__seg';
      var tone = tones[i];
      if (tone && ['ok', 'warn', 'down', 'info'].indexOf(tone) >= 0) cls += ' ody-chart__seg--' + tone;
      else if (!tones.length && toneClass[i % 5]) cls += ' ody-chart__seg' + toneClass[i % 5];
      var seg = svgEl('circle', {
        cx: cx, cy: cy, r: r, 'stroke-width': sw, 'class': cls,
        'stroke-dasharray': len.toFixed(2) + ' ' + (C - len).toFixed(2),
        'stroke-dashoffset': (-offset).toFixed(2),
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
      });
      svg.appendChild(seg);
      offset += len;
    });
    var center = el.getAttribute('data-center');
    if (center) {
      var big = svgEl('text', { x: cx, y: cy - 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'class': 'ody-chart__center', 'font-size': '22' });
      big.textContent = center; svg.appendChild(big);
      var sub = el.getAttribute('data-center-sub');
      if (sub) {
        var s = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'class': 'ody-chart__center--sub', 'font-size': '10' });
        s.textContent = sub; svg.appendChild(s);
      }
    }
    return svg;
  }
  function sparkChart(el, vals) {
    var W = 96, H = 28, padY = 3, padX = 2;
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals), span = (max - min) || 1;
    var n = vals.length, stepX = n > 1 ? (W - padX * 2) / (n - 1) : 0;
    function px(i) { return padX + i * stepX; }
    function py(v) { return padY + (1 - (v - min) / span) * (H - padY * 2); }
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', preserveAspectRatio: 'none', width: W, height: H });
    var d = '';
    vals.forEach(function (v, i) { d += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1) + ' '; });
    var area = d + 'L' + px(n - 1).toFixed(1) + ' ' + (H - padY) + ' L' + px(0).toFixed(1) + ' ' + (H - padY) + ' Z';
    svg.appendChild(svgEl('path', { d: area, 'class': 'ody-chart__spark-area' }));
    svg.appendChild(svgEl('path', { d: d.trim(), 'class': 'ody-chart__spark-line' }));
    svg.appendChild(svgEl('circle', { cx: px(n - 1).toFixed(1), cy: py(vals[n - 1]).toFixed(1), r: 2, 'class': 'ody-chart__spark-end' }));
    return svg;
  }

  /* --------------------------------------------------------------- TREE */
  function toggleTreeNode(row) {
    var item = closestEl(row, '.ody-tree__item');
    if (!item || item.classList.contains('is-leaf')) return;
    var open = item.classList.toggle('is-open');
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function initTree(root) {
    $all('.ody-tree__item', root).forEach(function (item) {
      var row = item.querySelector('.ody-tree__row');
      if (!row) return;
      var kids = item.querySelector('.ody-tree__children');
      var leaf = item.classList.contains('is-leaf') || !kids || !kids.querySelector('.ody-tree__item, .ody-tree__row');
      if (leaf) { item.classList.add('is-leaf'); }
      else {
        if (!row.hasAttribute('aria-expanded')) row.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
      }
      if (!row.hasAttribute('tabindex')) row.setAttribute('tabindex', '0');
    });
  }

  /* -------------------------------------------------------- TABLE SORT */
  function sortTable(th) {
    var table = closestEl(th, 'table');
    if (!table) return;
    var head = closestEl(th, 'tr');
    var heads = Array.prototype.slice.call(head.children);
    var col = heads.indexOf(th);
    if (col < 0) return;
    var asc = !th.classList.contains('is-asc');
    heads.forEach(function (h) { h.classList.remove('is-asc', 'is-desc', 'is-sorted'); h.setAttribute('aria-sort', 'none'); });
    th.classList.add('is-sorted', asc ? 'is-asc' : 'is-desc');
    th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
    var tbody = table.tBodies[0]; if (!tbody) return;
    var rows = Array.prototype.slice.call(tbody.rows).filter(function (r) { return !r.classList.contains('ody-table__empty'); });
    var numeric = (th.getAttribute('data-sort-type') || '') === 'num' || th.classList.contains('ody-num');
    rows.sort(function (a, b) {
      var av = cellSortVal(a.cells[col]), bv = cellSortVal(b.cells[col]);
      if (numeric) { av = parseFloat(av.replace(/[^0-9.\-]/g, '')) || 0; bv = parseFloat(bv.replace(/[^0-9.\-]/g, '')) || 0; return asc ? av - bv : bv - av; }
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
  }
  function cellSortVal(cell) {
    if (!cell) return '';
    var v = cell.getAttribute('data-sort-value');
    return (v != null ? v : cell.textContent).trim();
  }

  /* ----------------------------------------------------- TABLE SELECT */
  function toggleRowSelect(cb) {
    var tr = closestEl(cb, 'tr');
    if (tr) tr.classList.toggle('is-selected', cb.checked);
    syncSelectAll(closestEl(cb, 'table'));
  }
  function toggleSelectAll(master) {
    var table = closestEl(master, 'table'); if (!table) return;
    var tbody = table.tBodies[0]; if (!tbody) return;
    $all('.ody-td--check input[type="checkbox"]', tbody).forEach(function (cb) {
      cb.checked = master.checked;
      var tr = closestEl(cb, 'tr'); if (tr) tr.classList.toggle('is-selected', master.checked);
    });
    master.indeterminate = false;
  }
  function syncSelectAll(table) {
    if (!table) return;
    var master = table.querySelector('.ody-th--check input[type="checkbox"]');
    if (!master) return;
    var boxes = $all('.ody-td--check input[type="checkbox"]', table.tBodies[0] || table);
    var checked = boxes.filter(function (b) { return b.checked; }).length;
    master.checked = checked > 0 && checked === boxes.length;
    master.indeterminate = checked > 0 && checked < boxes.length;
  }

  /* --------------------------------------------------------- KANBAN DND */
  var dragCard = null;
  function initKanban(root) {
    $all('.ody-kanban__card', root).forEach(function (c) { if (!c.hasAttribute('draggable')) c.setAttribute('draggable', 'true'); });
  }
  function onDragStart(e) {
    var card = closestEl(e.target, '.ody-kanban__card'); if (!card) return;
    dragCard = card; card.classList.add('is-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} }
  }
  function onDragEnd() {
    if (dragCard) dragCard.classList.remove('is-dragging');
    $all('.ody-kanban__list.is-over').forEach(function (l) { l.classList.remove('is-over'); });
    dragCard = null;
  }
  function afterElement(list, y) {
    var items = $all('.ody-kanban__card:not(.is-dragging)', list);
    var closestItem = null, closestOff = -Infinity;
    items.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var off = y - box.top - box.height / 2;
      if (off < 0 && off > closestOff) { closestOff = off; closestItem = child; }
    });
    return closestItem;
  }
  function onDragOver(e) {
    var list = closestEl(e.target, '.ody-kanban__list'); if (!list || !dragCard) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    list.classList.add('is-over');
    var after = afterElement(list, e.clientY);
    if (after == null) list.appendChild(dragCard);
    else list.insertBefore(dragCard, after);
  }
  function onDragLeave(e) {
    var list = closestEl(e.target, '.ody-kanban__list');
    if (list && !list.contains(e.relatedTarget)) list.classList.remove('is-over');
  }
  function onDrop(e) {
    var list = closestEl(e.target, '.ody-kanban__list'); if (!list) return;
    e.preventDefault(); list.classList.remove('is-over');
    updateKanbanCounts(closestEl(list, '.ody-kanban'));
  }
  function updateKanbanCounts(board) {
    if (!board) return;
    $all('.ody-kanban__col', board).forEach(function (col) {
      var count = col.querySelector('.ody-kanban__count');
      var list = col.querySelector('.ody-kanban__list');
      if (count && list) count.textContent = $all('.ody-kanban__card', list).length;
    });
  }

  /* ---------------------------------------------------------- DELEGATION */
  function onClick(e) {
    var t = e.target;
    var caretRow = closestEl(t, '.ody-tree__caret') ? closestEl(t, '.ody-tree__row') : null;
    var treeRow = caretRow || closestEl(t, '.ody-tree__row');
    if (treeRow) {
      var item = closestEl(treeRow, '.ody-tree__item');
      if (item && !item.classList.contains('is-leaf')) { e.preventDefault(); toggleTreeNode(treeRow); }
      $all('.ody-tree__row.is-active', closestEl(treeRow, '.ody-tree')).forEach(function (r) { r.classList.remove('is-active'); });
      treeRow.classList.add('is-active');
      return;
    }
    var sortTh = closestEl(t, 'th.ody-th--sort');
    if (sortTh && closestEl(sortTh, '[data-ody-sort]')) { e.preventDefault(); sortTable(sortTh); return; }
    var master = t.matches && t.matches('.ody-th--check input[type="checkbox"]') ? t : null;
    if (master) { toggleSelectAll(master); return; }
    var rowBox = t.matches && t.matches('.ody-td--check input[type="checkbox"]') ? t : null;
    if (rowBox) { toggleRowSelect(rowBox); return; }
    var step = closestEl(t, '.ody-step.is-clickable');
    if (step && closestEl(step, '[data-ody-stepper]')) {
      var stepper = closestEl(step, '.ody-stepper');
      $all('.ody-step', stepper).forEach(function (s, i) {
        s.classList.remove('is-active');
      });
      step.classList.add('is-active');
    }
  }
  function onKeydown(e) {
    var t = e.target;
    var row = closestEl(t, '.ody-tree__row');
    if (row) {
      var item = closestEl(row, '.ody-tree__item');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (item && !item.classList.contains('is-leaf')) toggleTreeNode(row); row.click(); }
      else if (e.key === 'ArrowRight') { if (item && !item.classList.contains('is-leaf') && !item.classList.contains('is-open')) { e.preventDefault(); toggleTreeNode(row); } }
      else if (e.key === 'ArrowLeft') { if (item && item.classList.contains('is-open')) { e.preventDefault(); toggleTreeNode(row); } }
    }
  }

  function initExt(root) {
    root = root || document;
    $all('[data-ody-chart]', root).forEach(renderChart);
    initTree(root);
    initKanban(root);
    $all('table[data-ody-select]', root).forEach(syncSelectAll);
  }

  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', onClick, false);
    document.addEventListener('keydown', onKeydown, false);
    document.addEventListener('dragstart', onDragStart, false);
    document.addEventListener('dragend', onDragEnd, false);
    document.addEventListener('dragover', onDragOver, false);
    document.addEventListener('dragleave', onDragLeave, false);
    document.addEventListener('drop', onDrop, false);
  }

  function boot() { bind(); initExt(document); }
  var O = window.Odyssey = window.Odyssey || {};
  O.renderChart = renderChart;
  O.sortTable = sortTable;
  O.initExt = initExt;
  var _origInit = O.init;
  if (typeof _origInit === 'function') {
    O.init = function (r) { var out = _origInit.call(O, r); initExt(r || document); return out; };
  } else {
    O.init = initExt;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window, document);


/* ============================================================================
 * === v1.1 overlay-ext ===
 * ========================================================================== */
/* ============================================================================
 * Odyssey UI JS · overlay-ext batch (additive; merges into window.Odyssey)
 * Zero-dependency vanilla. Delegated from document; dynamic markup works.
 * Adds: cmdk · notify · context menu · bottom sheet · split pane · carousel
 *       loading · confirm (promise) · inline editable
 * New API: Odyssey.openCmdk/closeCmdk · notify · clearNotifications
 *          openSheet/closeSheet · confirm · loading
 * ==========================================================================*/
(function (window, document) {
  'use strict';
  var O = window.Odyssey || (window.Odyssey = {});
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function closest(el, s) { if (!el) return null; if (el.closest) return el.closest(s); while (el && el.nodeType === 1) { if (el.matches(s)) return el; el = el.parentElement; } return null; }
  function on(el, t, fn, o) { el.addEventListener(t, fn, o || false); }
  function attr(el, n) { return el ? el.getAttribute(n) : null; }
  function ref(r) { if (!r) return null; if (/^[#.\[]/.test(r)) { try { return $(r); } catch (e) { return null; } } return document.getElementById(r); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /* --- shared scroll lock (mirrors core .ody-scroll-lock body class) --- */
  var locks = 0;
  function lock() { if (locks === 0) document.body.classList.add('ody-scroll-lock'); locks++; }
  function unlock() { locks = Math.max(0, locks - 1); if (locks === 0) document.body.classList.remove('ody-scroll-lock'); }

  /* --- generic ext-overlay stack (cmdk / sheet / confirm) --- */
  var extStack = [];
  function extOpen(node, onClose) {
    if (!node || node.classList.contains('is-open')) return;
    node.__extLast = document.activeElement;
    node.__extClose = onClose || null;
    node.hidden = false; node.removeAttribute('hidden');
    void node.offsetWidth;
    node.classList.add('is-open');
    extStack.push(node);
    lock();
  }
  function extClose(node) {
    if (!node || !node.classList.contains('is-open')) return;
    node.classList.remove('is-open');
    node.setAttribute('hidden', ''); node.hidden = true;
    extStack = extStack.filter(function (n) { return n !== node; });
    unlock();
    var last = node.__extLast; node.__extLast = null;
    if (last && last.focus) { try { last.focus(); } catch (e) {} }
    if (node.__extClose) { var f = node.__extClose; node.__extClose = null; f(); }
  }
  function extTop() { return extStack.length ? extStack[extStack.length - 1] : null; }
  function extTrap(e, node) {
    if (e.key !== 'Tab') return;
    var f = $all(FOCUSABLE, node).filter(function (n) { return n.offsetWidth > 0 || n.offsetHeight > 0; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!node.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }

  /* ==================================================== 1. COMMAND PALETTE */
  function cmdkItems(pal) { return $all('.ody-cmdk__item', pal).filter(function (n) { return !n.hidden; }); }
  function cmdkActive(pal) { return $('.ody-cmdk__item.is-active', pal); }
  function cmdkSetActive(pal, item) {
    var cur = cmdkActive(pal); if (cur) cur.classList.remove('is-active');
    if (item) { item.classList.add('is-active'); item.scrollIntoView({ block: 'nearest' }); }
  }
  function cmdkMove(pal, dir) {
    var items = cmdkItems(pal); if (!items.length) return;
    var i = items.indexOf(cmdkActive(pal));
    i = (i + dir + items.length) % items.length;
    cmdkSetActive(pal, items[i]);
  }
  function cmdkFilter(pal) {
    var input = $('.ody-cmdk__input', pal);
    var q = (input ? input.value : '').trim().toLowerCase();
    var any = false;
    $all('.ody-cmdk__item', pal).forEach(function (it) {
      var hay = (it.getAttribute('data-ody-keywords') || it.textContent || '').toLowerCase();
      var hit = !q || hay.indexOf(q) !== -1;
      it.hidden = !hit; if (hit) any = true;
    });
    $all('.ody-cmdk__group', pal).forEach(function (g) {
      g.hidden = !$all('.ody-cmdk__item', g).some(function (it) { return !it.hidden; });
    });
    var empty = $('.ody-cmdk__empty', pal); if (empty) empty.hidden = any;
    var items = cmdkItems(pal);
    if (!cmdkActive(pal) || cmdkActive(pal).hidden) cmdkSetActive(pal, items[0] || null);
  }
  function openCmdk(pal) {
    pal = typeof pal === 'string' ? ref(pal) : (pal || $('.ody-cmdk'));
    if (!pal) return;
    extOpen(pal);
    var input = $('.ody-cmdk__input', pal);
    if (input) { input.value = ''; }
    cmdkFilter(pal);
    if (input) setTimeout(function () { input.focus(); }, 0);
  }
  function closeCmdk(pal) { extClose(pal || $('.ody-cmdk.is-open')); }

  /* ==================================================== 2. NOTIFICATION CENTER */
  var NOTIF_ICONS = {
    ok: '<path d="M20 6 9 17l-5-5"/>',
    warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    down: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'
  };
  function notifPanel(target) {
    if (target) return typeof target === 'string' ? ref(target) : target;
    return $('.ody-notif');
  }
  function notifSync(panel) {
    if (!panel) return;
    var list = $('.ody-notif__list', panel);
    var count = list ? $all('.ody-notif__item', list).length : 0;
    var empty = $('.ody-notif__empty', panel); if (empty) empty.hidden = count > 0;
    var id = panel.id;
    $all('[data-ody-notif-count]').forEach(function (b) {
      var wants = attr(b, 'data-ody-notif-count');
      if (wants && id && wants !== '#' + id && wants !== id) return;
      var badge = $('.ody-notif-badge', b) || b;
      badge.textContent = count;
      badge.classList.toggle('is-empty', count === 0);
    });
  }
  function notify(opts) {
    opts = opts || {};
    var panel = notifPanel(opts.target); if (!panel) return null;
    var list = $('.ody-notif__list', panel); if (!list) return null;
    var tone = opts.tone || 'info';
    var item = el('div', 'ody-notif__item ody-notif__item--' + tone + (opts.unread ? ' is-unread' : ''));
    var ico = NOTIF_ICONS[tone] || NOTIF_ICONS.info;
    var html = '<span class="ody-notif__item-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ico + '</svg></span>' +
      '<div class="ody-notif__item-main"></div>' +
      '<button class="ody-notif__item-close" type="button" aria-label="Dismiss">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    item.innerHTML = html;
    var main = $('.ody-notif__item-main', item);
    if (opts.title) { var t = el('div', 'ody-notif__item-title'); t.textContent = opts.title; main.appendChild(t); }
    if (opts.message) { var m = el('div', 'ody-notif__item-msg'); m.textContent = opts.message; main.appendChild(m); }
    if (opts.time) { var tm = el('div', 'ody-notif__item-time'); tm.textContent = opts.time; main.appendChild(tm); }
    if (opts.actions && opts.actions.length) {
      var wrap = el('div', 'ody-notif__actions');
      opts.actions.forEach(function (a) {
        var btn = el('button', 'ody-notif__action'); btn.type = 'button'; btn.textContent = a.label || 'Action';
        on(btn, 'click', function () { if (a.onClick) a.onClick(item); if (a.dismiss !== false) removeNotif(item, panel); });
        wrap.appendChild(btn);
      });
      main.appendChild(wrap);
    }
    on($('.ody-notif__item-close', item), 'click', function () { removeNotif(item, panel); });
    if (opts.prepend !== false) list.insertBefore(item, list.firstChild); else list.appendChild(item);
    notifSync(panel);
    if (opts.timeout && opts.timeout > 0) setTimeout(function () { removeNotif(item, panel); }, opts.timeout);
    return { el: item, dismiss: function () { removeNotif(item, panel); } };
  }
  function removeNotif(item, panel) {
    if (!item || !item.parentNode) return;
    item.classList.add('is-leaving');
    var done = function () { if (item.parentNode) item.parentNode.removeChild(item); notifSync(panel); };
    var to = setTimeout(done, 240);
    on(item, 'transitionend', function () { clearTimeout(to); done(); });
  }
  function clearNotifications(target) {
    var panel = notifPanel(target); if (!panel) return;
    var list = $('.ody-notif__list', panel); if (!list) return;
    $all('.ody-notif__item', list).forEach(function (it) { removeNotif(it, panel); });
  }

  /* ==================================================== 3. CONTEXT MENU */
  var activeCtx = null;
  function openCtx(menu, x, y) {
    closeCtx();
    menu.classList.add('is-open');
    menu.removeAttribute('hidden');
    var r = menu.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - r.width - 8);
    var top = Math.min(y, window.innerHeight - r.height - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
    activeCtx = menu;
    var first = $('.ody-ctx__item:not([disabled])', menu); if (first) first.focus();
  }
  function closeCtx() { if (activeCtx) { activeCtx.classList.remove('is-open'); activeCtx = null; } }

  /* ==================================================== 4. BOTTOM SHEET */
  function openSheet(sheet) {
    sheet = typeof sheet === 'string' ? ref(sheet) : sheet; if (!sheet) return;
    extOpen(sheet);
    var f = $(FOCUSABLE, sheet); if (f) setTimeout(function () { f.focus(); }, 0);
  }
  function closeSheet(sheet) { extClose(sheet || $('.ody-sheet.is-open')); }
  function initSheetDrag(sheet) {
    var panel = $('.ody-sheet__panel', sheet); if (!panel || panel.__odyDrag) return; panel.__odyDrag = true;
    var handle = $('.ody-sheet__handle', sheet) || panel;
    var startY = 0, dy = 0, active = false;
    function down(e) {
      active = true; startY = (e.touches ? e.touches[0] : e).clientY; dy = 0;
      panel.style.transition = 'none';
      on(document, 'pointermove', move); on(document, 'pointerup', up);
    }
    function move(e) {
      if (!active) return; dy = Math.max(0, (e.touches ? e.touches[0] : e).clientY - startY);
      panel.style.transform = 'translateY(' + dy + 'px)';
    }
    function up() {
      active = false; panel.style.transition = ''; panel.style.transform = '';
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      if (dy > 90) closeSheet(sheet);
    }
    on(handle, 'pointerdown', down);
  }

  /* ==================================================== 5. SPLIT PANE */
  function initSplit(pane) {
    if (pane.__odySplit) return; pane.__odySplit = true;
    var gutter = $('.ody-split-pane__gutter', pane);
    var first = $('.ody-split-pane__panel', pane);
    if (!gutter || !first) return;
    var vert = pane.classList.contains('ody-split-pane--vert');
    var min = parseInt(attr(pane, 'data-ody-min') || '80', 10);
    function down(e) {
      e.preventDefault();
      pane.classList.add('is-dragging'); gutter.classList.add('is-dragging');
      on(document, 'pointermove', move); on(document, 'pointerup', up);
    }
    function move(e) {
      var r = pane.getBoundingClientRect();
      var pos = vert ? (e.clientY - r.top) : (e.clientX - r.left);
      var total = vert ? r.height : r.width;
      pos = Math.max(min, Math.min(pos, total - min - gutter.offsetWidth));
      first.style.flex = '0 0 ' + pos + 'px';
    }
    function up() {
      pane.classList.remove('is-dragging'); gutter.classList.remove('is-dragging');
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
    }
    on(gutter, 'pointerdown', down);
    gutter.setAttribute('role', 'separator');
    gutter.setAttribute('tabindex', gutter.getAttribute('tabindex') || '0');
    on(gutter, 'keydown', function (e) {
      var step = e.shiftKey ? 40 : 16;
      var r = pane.getBoundingClientRect(); var total = vert ? r.height : r.width;
      var cur = (vert ? first.offsetHeight : first.offsetWidth);
      if (e.key === (vert ? 'ArrowUp' : 'ArrowLeft')) { e.preventDefault(); first.style.flex = '0 0 ' + Math.max(min, cur - step) + 'px'; }
      else if (e.key === (vert ? 'ArrowDown' : 'ArrowRight')) { e.preventDefault(); first.style.flex = '0 0 ' + Math.min(total - min - gutter.offsetWidth, cur + step) + 'px'; }
    });
  }

  /* ==================================================== 6. CAROUSEL */
  function initCarousel(car) {
    if (car.__odyCar) return; car.__odyCar = true;
    var track = $('.ody-carousel__track', car);
    var slides = $all('.ody-carousel__slide', car);
    if (!track || !slides.length) return;
    var loop = car.hasAttribute('data-ody-carousel-loop');
    var idx = 0;
    var dotsWrap = $('.ody-carousel__dots', car);
    if (dotsWrap && !dotsWrap.children.length) {
      slides.forEach(function (s, i) {
        var d = el('button', 'ody-carousel__dot'); d.type = 'button';
        d.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        on(d, 'click', function () { go(i); });
        dotsWrap.appendChild(d);
      });
    }
    var dots = dotsWrap ? $all('.ody-carousel__dot', dotsWrap) : [];
    var prev = $('.ody-carousel__btn--prev', car), next = $('.ody-carousel__btn--next', car);
    function render() {
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
      if (!loop) {
        if (prev) prev.classList.toggle('is-disabled', idx === 0);
        if (next) next.classList.toggle('is-disabled', idx === slides.length - 1);
      }
    }
    function go(i) { idx = loop ? (i + slides.length) % slides.length : Math.max(0, Math.min(i, slides.length - 1)); render(); }
    if (prev) on(prev, 'click', function () { go(idx - 1); });
    if (next) on(next, 'click', function () { go(idx + 1); });
    on(car, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    });
    var auto = parseInt(attr(car, 'data-ody-carousel-autoplay') || '0', 10);
    if (auto > 0) {
      var timer = setInterval(function () { go(idx + 1 >= slides.length && !loop ? 0 : idx + 1); }, auto);
      on(car, 'mouseenter', function () { clearInterval(timer); });
    }
    car.__carGo = go;
    render();
  }

  /* ==================================================== 7. LOADING OVERLAY */
  function loading(target, on_, opts) {
    var host = typeof target === 'string' ? ref(target) : target;
    if (!host) return;
    opts = opts || {};
    var overlay = $('.ody-loading', host);
    if (on_ === false) { if (overlay) overlay.classList.remove('is-active'); return; }
    host.classList.add('ody-loading-host');
    if (!overlay || overlay.parentElement !== host) {
      overlay = el('div', 'ody-loading' + (opts.fixed ? ' ody-loading--fixed' : ''));
      overlay.setAttribute('role', 'status'); overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = '<span class="ody-spinner ody-spinner--lg" aria-hidden="true"></span>';
      if (opts.label) { var l = el('div', 'ody-loading__label'); l.textContent = opts.label; overlay.appendChild(l); }
      host.appendChild(overlay);
    }
    void overlay.offsetWidth;
    overlay.classList.add('is-active');
    return overlay;
  }

  /* ==================================================== 8. CONFIRM (promise) */
  var CONFIRM_ICONS = {
    danger: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'
  };
  function confirm(opts) {
    opts = opts || {};
    var tone = opts.tone || 'info';
    return new Promise(function (resolve) {
      var overlay = el('div', 'ody-confirm' + (tone === 'danger' ? ' ody-confirm--danger' : tone === 'warn' ? ' ody-confirm--warn' : ''));
      var okClass = tone === 'danger' ? 'ody-btn--danger' : 'ody-btn--primary';
      overlay.innerHTML =
        '<div class="ody-confirm__backdrop"></div>' +
        '<div class="ody-confirm__panel" role="alertdialog" aria-modal="true">' +
          '<div class="ody-confirm__body">' +
            '<div class="ody-confirm__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (CONFIRM_ICONS[tone] || CONFIRM_ICONS.info) + '</svg></div>' +
            '<div class="ody-confirm__main"><div class="ody-confirm__title"></div><p class="ody-confirm__msg"></p></div>' +
          '</div>' +
          '<div class="ody-confirm__foot">' +
            '<button class="ody-btn ody-btn--subtle" type="button" data-act="cancel"></button>' +
            '<button class="ody-btn ' + okClass + '" type="button" data-act="ok"></button>' +
          '</div>' +
        '</div>';
      $('.ody-confirm__title', overlay).textContent = opts.title || 'Are you sure?';
      $('.ody-confirm__msg', overlay).textContent = opts.message || '';
      if (!opts.message) $('.ody-confirm__msg', overlay).style.display = 'none';
      var cancelBtn = $('[data-act="cancel"]', overlay); cancelBtn.textContent = opts.cancelText || 'Cancel';
      var okBtn = $('[data-act="ok"]', overlay); okBtn.textContent = opts.confirmText || 'Confirm';
      document.body.appendChild(overlay);
      function settle(val) { extClose(overlay); resolve(val); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 260); }
      on(cancelBtn, 'click', function () { settle(false); });
      on(okBtn, 'click', function () { settle(true); });
      on($('.ody-confirm__backdrop', overlay), 'click', function () { settle(false); });
      overlay.__confirmSettle = function () { resolve(false); };
      extOpen(overlay, function () { if (overlay.__confirmSettle) { overlay.__confirmSettle(); overlay.__confirmSettle = null; } });
      setTimeout(function () { okBtn.focus(); }, 0);
    });
  }

  /* ==================================================== 9. INLINE EDITABLE */
  function editStart(ed) {
    if (ed.classList.contains('is-editing')) return;
    var textEl = $('.ody-editable__text', ed);
    var cur = textEl ? textEl.textContent : ed.textContent;
    if (ed.classList.contains('is-empty')) cur = '';
    var input = el('input', 'ody-editable__input');
    input.type = attr(ed, 'data-ody-editable-type') || 'text';
    input.value = cur;
    ed.classList.add('is-editing');
    ed.__prev = cur;
    if (textEl) { textEl.style.display = 'none'; ed.insertBefore(input, textEl); }
    else { ed.textContent = ''; ed.appendChild(input); }
    input.focus(); input.select();
    function commit(save) {
      if (ed.__committed) return; ed.__committed = true;
      var val = save ? input.value : ed.__prev;
      if (input.parentNode) input.parentNode.removeChild(input);
      if (textEl) { textEl.style.display = ''; textEl.textContent = val || (attr(ed, 'data-ody-editable-placeholder') || ''); }
      else { ed.textContent = val || (attr(ed, 'data-ody-editable-placeholder') || ''); }
      ed.classList.toggle('is-empty', !val);
      ed.classList.remove('is-editing');
      ed.__committed = false;
      if (save && val !== ed.__prev) ed.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: val } }));
    }
    on(input, 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
    });
    on(input, 'blur', function () { commit(true); });
  }

  /* ==================================================== GLOBAL LISTENERS */
  on(document, 'click', function (e) {
    var t = e.target;
    var cOpen = closest(t, '[data-ody-cmdk-open]');
    if (cOpen) { e.preventDefault(); openCmdk(attr(cOpen, 'data-ody-cmdk-open')); return; }
    var cItem = closest(t, '.ody-cmdk__item');
    if (cItem) { var pal = closest(cItem, '.ody-cmdk'); if (cItem.tagName !== 'A') e.preventDefault(); setTimeout(function () { closeCmdk(pal); }, 0); return; }
    if (t.classList && (t.classList.contains('ody-cmdk__backdrop') || t.classList.contains('ody-sheet__backdrop'))) {
      extClose(closest(t, '.ody-cmdk, .ody-sheet')); return;
    }
    var xDismiss = closest(t, '[data-ody-ext-dismiss]');
    if (xDismiss) { e.preventDefault(); extClose(closest(xDismiss, '.ody-cmdk, .ody-sheet, .ody-confirm')); return; }
    var sOpen = closest(t, '[data-ody-sheet-open]');
    if (sOpen) { e.preventDefault(); openSheet(attr(sOpen, 'data-ody-sheet-open')); return; }
    var nTog = closest(t, '[data-ody-notif-toggle]');
    if (nTog) { e.preventDefault(); var np = ref(attr(nTog, 'data-ody-notif-toggle')); if (np) np.classList.toggle('is-open'); return; }
    var nDismiss = closest(t, '[data-ody-notif-close]');
    if (nDismiss) { e.preventDefault(); var pn = closest(nDismiss, '.ody-notif') || ref(attr(nDismiss, 'data-ody-notif-close')); if (pn) pn.classList.remove('is-open'); return; }
    var nClear = closest(t, '[data-ody-notif-clear]');
    if (nClear) { e.preventDefault(); clearNotifications(attr(nClear, 'data-ody-notif-clear') || closest(nClear, '.ody-notif')); return; }
    var ctxItem = closest(t, '.ody-ctx__item');
    if (ctxItem) { if (ctxItem.tagName !== 'A') e.preventDefault(); setTimeout(closeCtx, 0); return; }
    if (activeCtx && !closest(t, '.ody-ctx')) closeCtx();
    var ed = closest(t, '[data-ody-editable]');
    if (ed && !closest(t, '.ody-editable__input')) { editStart(ed); return; }
  }, true);

  on(document, 'contextmenu', function (e) {
    var host = closest(e.target, '[data-ody-ctx]');
    if (!host) { if (activeCtx) closeCtx(); return; }
    var menu = ref(attr(host, 'data-ody-ctx'));
    if (!menu) return;
    e.preventDefault();
    openCtx(menu, e.clientX, e.clientY);
  });

  on(document, 'keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      var pal = $('[data-ody-cmdk-default]') || $('.ody-cmdk');
      if (pal) { e.preventDefault(); pal.classList.contains('is-open') ? closeCmdk(pal) : openCmdk(pal); return; }
    }
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (activeCtx) { closeCtx(); return; }
      var top = extTop();
      if (top) { e.preventDefault(); extClose(top); return; }
    }
    var top2 = extTop();
    if (top2 && top2.classList.contains('ody-cmdk') && top2.contains(e.target)) {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkMove(top2, 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); cmdkMove(top2, -1); return; }
      if (e.key === 'Enter') { var a = cmdkActive(top2); if (a) { e.preventDefault(); a.click(); } return; }
    }
    if (top2 && top2.contains(e.target)) extTrap(e, top2);
  });

  on(document, 'input', function (e) {
    var pal = closest(e.target, '.ody-cmdk');
    if (pal && e.target.classList.contains('ody-cmdk__input')) cmdkFilter(pal);
  });

  /* ==================================================== INIT */
  function initExt(root) {
    root = root || document;
    $all('.ody-sheet', root).forEach(function (s) { if (!s.classList.contains('is-open') && !s.hasAttribute('hidden')) s.setAttribute('hidden', ''); initSheetDrag(s); });
    $all('.ody-cmdk', root).forEach(function (c) { if (!c.classList.contains('is-open') && !c.hasAttribute('hidden')) c.setAttribute('hidden', ''); });
    $all('.ody-split-pane', root).forEach(initSplit);
    $all('[data-ody-carousel]', root).forEach(initCarousel);
    $all('.ody-notif', root).forEach(notifSync);
    $all('[data-ody-editable]', root).forEach(function (ed) {
      if (!$('.ody-editable__text', ed) && !ed.querySelector('.ody-editable__input')) {
        var txt = ed.textContent.trim(); ed.textContent = '';
        var span = el('span', 'ody-editable__text'); span.textContent = txt || (attr(ed, 'data-ody-editable-placeholder') || '');
        ed.appendChild(span);
        ed.appendChild(el('span', 'ody-editable__ico', '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'));
        if (!txt) ed.classList.add('is-empty');
      }
      if (!ed.hasAttribute('tabindex')) ed.setAttribute('tabindex', '0');
      ed.setAttribute('role', ed.getAttribute('role') || 'button');
    });
  }

  /* extend public API (preserve existing Odyssey.init to also wire ext) */
  var coreInit = O.init;
  O.init = function (root) { if (coreInit) coreInit(root); initExt(root); return O; };
  O.openCmdk = openCmdk; O.closeCmdk = closeCmdk;
  O.notify = notify; O.clearNotifications = clearNotifications;
  O.openSheet = openSheet; O.closeSheet = closeSheet;
  O.confirm = confirm; O.loading = loading;
  O.closeContextMenu = closeCtx;

  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', function () { initExt(document); });
  else initExt(document);

})(window, document);

/*! odyssey-canary v1.2.0-canary.1 · public shell/profile enhancement */
(function (window, document) {
  'use strict';
  var Odyssey = window.Odyssey;
  if (!Odyssey || Odyssey.canary) return;

  var RELEASE = '1.2.0-canary.1';
  var PROFILES = [
    'ai', 'communication', 'content', 'control', 'data', 'developer', 'identity',
    'knowledge', 'networking', 'observability', 'portal', 'productivity', 'public',
    'security'
  ];
  var STATUSES = {
    ok: 'operational', healthy: 'operational', operational: 'operational',
    warn: 'degraded', degraded: 'degraded',
    down: 'outage', outage: 'outage',
    maintenance: 'maintenance', unknown: 'unknown'
  };

  function includes(list, value) { return list.indexOf(value) !== -1; }
  function select(root, selector) {
    root = root || document;
    var found = Array.prototype.slice.call(root.querySelectorAll(selector));
    if (root.matches && root.matches(selector)) found.unshift(root);
    return found;
  }
  function samePage(link) {
    try {
      var target = new window.URL(link.href, window.location.href);
      return target.origin === window.location.origin &&
        target.pathname.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, '') &&
        (!target.search || target.search === window.location.search);
    } catch (error) { return false; }
  }
  function markCurrent(nav) {
    if (nav.querySelector('[aria-current="page"]')) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href]'));
    var current = links.filter(samePage)[0];
    if (!current) return;
    current.classList.add('is-active');
    current.setAttribute('aria-current', 'page');
  }
  function initShell(root) {
    select(root, '[data-ody-profile]').forEach(function (profileRoot) {
      var profile = profileRoot.getAttribute('data-ody-profile');
      if (!includes(PROFILES, profile)) return;
      profileRoot.setAttribute('data-ody-profile-ready', '');
      profileRoot.setAttribute('data-ody-release', RELEASE);
    });
    select(root, '[data-ody-shell-nav]').forEach(markCurrent);
    select(root, '[data-ody-status]').forEach(function (signal) {
      var raw = signal.getAttribute('data-ody-status');
      var status = STATUSES[raw] || 'unknown';
      signal.setAttribute('data-ody-status', status);
      signal.setAttribute('data-ody-status-ready', '');
    });
  }

  var previousInit = Odyssey.init;
  Odyssey.init = function (root) {
    if (previousInit) previousInit.call(Odyssey, root);
    initShell(root);
    return Odyssey;
  };
  Odyssey.version = RELEASE;
  Odyssey.canary = Object.freeze({
    release: RELEASE,
    profiles: Object.freeze(PROFILES.slice()),
    initShell: initShell
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initShell(document); });
  } else {
    initShell(document);
  }
})(window, document);
