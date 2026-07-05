/*! ============================================================================
 * Odyssey UI JS · v1.0.0
 * ----------------------------------------------------------------------------
 * Framework-agnostic public release of the HOLDFAST "Odyssey" design language.
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

  var VERSION = '1.0.0';
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
        closeAllMenus(null);
        var openBtn = $('.ody-dropdown [data-ody-toggle][aria-expanded="true"]');
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
