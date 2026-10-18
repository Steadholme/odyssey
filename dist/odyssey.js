/*! ============================================================================
 * Odyssey UI JS · v1.3.0-canary.1
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
 *   License: MIT — see LICENSE
 * ========================================================================== */
(function (window, document) {
  'use strict';

  var VERSION = '1.3.0-canary.1';
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
  function roots(root, selector) {
    var found = $all(selector, root);
    if (root && root.matches && root.matches(selector)) found.unshift(root);
    return found;
  }
  var composing = new WeakSet();
  on(document, 'compositionstart', function (event) { composing.add(event.target); }, true);
  on(document, 'compositionend', function (event) { composing.delete(event.target); }, true);
  function isComposing(event) { return event.isComposing || event.keyCode === 229 || composing.has(event.target); }
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

  /* Shared runtime strings. Host copy and data are never translated. */
  var catalogs = {
    en: {
      'common.remove':'Remove {name}', 'common.dismiss':'Dismiss', 'common.previous':'Previous', 'common.next':'Next',
      'common.choose':'Choose an option', 'common.chooseMany':'Choose options', 'common.select':'Select…', 'common.noResults':'No matches',
      'common.notifications':'Notifications', 'common.action':'Action', 'date.choose':'Choose a date', 'date.previousMonth':'Previous month', 'date.nextMonth':'Next month',
      'time.choose':'Choose a time', 'time.hours':'Hours', 'time.minutes':'Minutes', 'time.hour':'Hour {value}', 'time.minute':'Minute {value}',
      'range.minimum':'Minimum', 'range.maximum':'Maximum', 'otp.digit':'Digit {index}', 'otp.help':'Enter the {count}-digit code.',
      'tree.files':'Files', 'table.summary':'{count} results · Page {page} of {pages}', 'table.empty':'No matching results.',
      'kanban.move':'Move {name} to column', 'kanban.column':'Column {index}', 'kanban.up':'Move up', 'kanban.down':'Move down',
      'kanban.moved':'{name} moved to column {column}, position {position}.', 'carousel.slide':'Go to slide {index}',
      'confirm.title':'Are you sure?', 'confirm.cancel':'Cancel', 'confirm.confirm':'Confirm',
      'chart.name':'Chart', 'chart.summary':'{count} values, from {min} to {max}.', 'chart.empty':'No data available.',
      'chart.data':'View data', 'chart.label':'Label', 'chart.value':'Value', 'chart.item':'Item {index}', 'chart.table':'{name} — data'
    },
    zh: {
      'common.remove':'移除{name}', 'common.dismiss':'关闭', 'common.previous':'上一页', 'common.next':'下一页',
      'common.choose':'选择一项', 'common.chooseMany':'选择多项', 'common.select':'请选择…', 'common.noResults':'没有匹配项',
      'common.notifications':'通知', 'common.action':'操作', 'date.choose':'选择日期', 'date.previousMonth':'上个月', 'date.nextMonth':'下个月',
      'time.choose':'选择时间', 'time.hours':'小时', 'time.minutes':'分钟', 'time.hour':'{value}时', 'time.minute':'{value}分',
      'range.minimum':'最小值', 'range.maximum':'最大值', 'otp.digit':'第{index}位', 'otp.help':'输入{count}位验证码。',
      'tree.files':'文件', 'table.summary':'{count}条结果 · 第{page}页，共{pages}页', 'table.empty':'没有匹配结果。',
      'kanban.move':'将{name}移动到列', 'kanban.column':'第{index}列', 'kanban.up':'上移', 'kanban.down':'下移',
      'kanban.moved':'{name}已移动到第{column}列，第{position}项。', 'carousel.slide':'前往第{index}张',
      'confirm.title':'确认操作？', 'confirm.cancel':'取消', 'confirm.confirm':'确认',
      'chart.name':'图表', 'chart.summary':'共{count}个数值，最小{min}，最大{max}。', 'chart.empty':'暂无数据。',
      'chart.data':'查看数据', 'chart.label':'标签', 'chart.value':'数值', 'chart.item':'第{index}项', 'chart.table':'{name} — 数据'
    },
    ja: {
      'common.remove':'{name}を削除', 'common.dismiss':'閉じる', 'common.previous':'前へ', 'common.next':'次へ',
      'common.choose':'項目を選択', 'common.chooseMany':'項目を複数選択', 'common.select':'選択…', 'common.noResults':'一致する項目はありません',
      'common.notifications':'通知', 'common.action':'操作', 'date.choose':'日付を選択', 'date.previousMonth':'前の月', 'date.nextMonth':'次の月',
      'time.choose':'時刻を選択', 'time.hours':'時', 'time.minutes':'分', 'time.hour':'{value}時', 'time.minute':'{value}分',
      'range.minimum':'最小値', 'range.maximum':'最大値', 'otp.digit':'{index}桁目', 'otp.help':'{count}桁のコードを入力してください。',
      'tree.files':'ファイル', 'table.summary':'{count}件 · {pages}ページ中{page}ページ', 'table.empty':'一致する結果はありません。',
      'kanban.move':'{name}の移動先', 'kanban.column':'列{index}', 'kanban.up':'上へ移動', 'kanban.down':'下へ移動',
      'kanban.moved':'{name}を列{column}の{position}番目に移動しました。', 'carousel.slide':'スライド{index}へ',
      'confirm.title':'実行しますか？', 'confirm.cancel':'キャンセル', 'confirm.confirm':'確認',
      'chart.name':'グラフ', 'chart.summary':'{count}個の値、最小{min}、最大{max}。', 'chart.empty':'データはありません。',
      'chart.data':'データを表示', 'chart.label':'ラベル', 'chart.value':'値', 'chart.item':'項目{index}', 'chart.table':'{name} — データ'
    }
  };
  function locale(node) {
    var owner = node && node.nodeType === 1 ? closest(node, '[lang]') : null;
    var tag = (owner && owner.getAttribute('lang')) || htmlEl.lang || 'en';
    var language = tag.toLowerCase().split(/[-_]/)[0];
    return Object.prototype.hasOwnProperty.call(catalogs, language) ? language : 'en';
  }
  function translate(key, vars, node) {
    var lang = locale(node), template = catalogs[lang][key];
    if (template == null) template = catalogs.en[key];
    if (template == null) return key;
    return template.replace(/\{([^}]+)\}/g, function (match, name) { return vars && vars[name] != null ? String(vars[name]) : match; });
  }
  var i18n = { locale: locale, t: translate, register: function (language, strings) {
    if (!Object.prototype.hasOwnProperty.call(catalogs, language)) throw new TypeError('Unsupported Odyssey locale: ' + language);
    Object.keys(strings || {}).forEach(function (key) { if (typeof strings[key] === 'string') catalogs[language][key] = strings[key]; });
  } };

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
  var layers = [];
  function topLayer() { return layers.length ? layers[layers.length - 1].node : null; }
  function registerLayer(node, trigger) {
    var z=layers.reduce(function(value,frame){return Math.max(value,parseInt(window.getComputedStyle(frame.node).zIndex,10)||0);},99);
    var originalZ=node.style.zIndex;
    node.style.zIndex=String(Math.max(z+1,parseInt(window.getComputedStyle(node).zIndex,10)||100));
    layers.push({node:node,last:trigger||document.activeElement,z:originalZ});document.body.classList.add('ody-scroll-lock');
  }
  function visible(node) { return node && node.isConnected && !node.disabled && !closest(node, '[hidden],[inert]') && node.getClientRects().length > 0; }
  function restoreFocus(preferred) {
    var top = topLayer(), target = visible(preferred) && (!top || top.contains(preferred)) ? preferred : null;
    if (!target && top) target = focusables(top)[0] || top;
    if (!target) target = document.querySelector('main') || document.body;
    if (!target.hasAttribute('tabindex') && !target.matches(FOCUSABLE)) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll:true});
  }
  function releaseLayer(node, returnFocus) {
    var frame = layers.find(function (item) { return item.node === node; });
    layers = layers.filter(function (item) { return item.node !== node; });
    if(frame){if(frame.z)node.style.zIndex=frame.z;else node.style.removeProperty('z-index');}
    document.body.classList.toggle('ody-scroll-lock',layers.length>0);
    if (returnFocus && frame) restoreFocus(frame.last);
  }

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
    registerLayer(overlay, trigger);
    overlay.hidden = false;
    overlay.removeAttribute('hidden');
    // reflow so a CSS transition off [hidden]→.is-open can play
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    var panel = panelOf(overlay);
    if (panel) {
      var semantic = overlay.hasAttribute('role') ? overlay : panel;
      if (semantic !== panel && panel.getAttribute('role') === 'dialog') { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
      semantic.setAttribute('role', semantic.getAttribute('role') || 'dialog');
      semantic.setAttribute('aria-modal', 'true');
      if (!semantic.hasAttribute('aria-labelledby') && !semantic.hasAttribute('aria-label')) {
        var title = panel.querySelector('h1,h2,h3');
        if (title) semantic.setAttribute('aria-labelledby', ensureId(title, 'ody-dialog-title-'));
      }
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    }
    lockScroll();
    var f = focusables(panel);
    (f[0] || panel).focus && (f[0] || panel).focus();
    overlay.dispatchEvent(new CustomEvent('ody:open', { bubbles: true }));
  }
  function closeModal(overlay) {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    var shouldReturn = overlay.contains(document.activeElement) || document.activeElement === document.body;
    overlay.classList.remove('is-open');
    overlay.setAttribute('hidden', '');
    overlay.hidden = true;
    unlockScroll();
    releaseLayer(overlay, shouldReturn);
    overlay.dispatchEvent(new CustomEvent('ody:close', { bubbles: true }));
  }
  function topOverlay() {
    var top = topLayer();
    return top && top.matches('.ody-modal,.ody-drawer') ? top : null;
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
  function closeAllMenus(except, returnFocus) {
    $all('.ody-dropdown .ody-menu.is-open').forEach(function (menu) {
      if (menu === except) return;
      var hadFocus = menu.contains(document.activeElement);
      menu.classList.remove('is-open');
      var dd = closest(menu, '.ody-dropdown');
      var btn = dd && $('[data-ody-toggle]', dd);
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (returnFocus && hadFocus && !topLayer() && !document.querySelector('dialog:modal')) restoreFocus(btn);
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
      region.setAttribute('aria-label', translate('common.notifications'));
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
    close.setAttribute('aria-label', translate('common.dismiss'));
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
  var tooltipHideTimer;
  function showTooltip(trigger) {
    clearTimeout(tooltipHideTimer);
    if (activeTooltip && activeTooltip.trigger === trigger) return;
    hideTooltip();
    var text = attr(trigger, 'data-ody-tooltip');
    if (!text) return;
    var placement = attr(trigger, 'data-ody-placement') || 'top';
    var node = document.createElement('div');
    node.className = 'ody-tooltip ody-tooltip--' + placement;
    node.setAttribute('role', 'tooltip'); node.textContent = text;
    var id = ensureId(node, 'ody-tt-');
    var descriptions = (attr(trigger, 'aria-describedby') || '').split(/\s+/).filter(Boolean);
    descriptions.push(id); trigger.setAttribute('aria-describedby', descriptions.join(' '));
    document.body.appendChild(node); placeFloating(node, trigger, placement);
    void node.offsetWidth; node.classList.add('is-open');
    activeTooltip = { node: node, trigger: trigger, hovered: false };
  }
  function hideTooltip() {
    clearTimeout(tooltipHideTimer);
    if (!activeTooltip) return;
    var trigger = activeTooltip.trigger;
    if (trigger) {
      var descriptions = (attr(trigger, 'aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== activeTooltip.node.id; });
      if (descriptions.length) trigger.setAttribute('aria-describedby', descriptions.join(' '));
      else trigger.removeAttribute('aria-describedby');
    }
    activeTooltip.node.remove(); activeTooltip = null;
  }
  function leaveTooltip() {
    clearTimeout(tooltipHideTimer);
    // Bridge the positioning gap while the pointer moves into the bubble.
    tooltipHideTimer = setTimeout(function () {
      if (activeTooltip && !activeTooltip.hovered && !activeTooltip.trigger.contains(document.activeElement)) hideTooltip();
    }, 120);
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
      if (overlay) { e.preventDefault(); var fromMenu=closest(opener,'.ody-menu'),drop=fromMenu&&closest(fromMenu,'.ody-dropdown'),returnTarget=drop&&$('[data-ody-toggle]',drop);if(fromMenu)closeAllMenus(null);openModal(overlay,returnTarget||opener);return; }
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
      queueMicrotask(function () { closeAllMenus(null, mItem.tagName !== 'A'); });
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
    if (isComposing(e) || e.defaultPrevented) return;
    var t = e.target;
    if ((e.key==='Escape'||e.key==='Esc') && activeTooltip) { e.preventDefault();hideTooltip();return; }
    if (document.querySelector('dialog:modal')) return;
    if((e.key==='Escape'||e.key==='Esc')&&closest(t,'.ody-datepicker.is-open,.ody-timepicker.is-open,.ody-multiselect.is-open,.ody-combobox.is-open'))return;

    // Esc closes top overlay / menu / popover / tooltip
    if (e.key === 'Escape' || e.key === 'Esc') {
      var focusedMenu=closest(t,'.ody-menu.is-open');
      if(focusedMenu){e.preventDefault();closeAllMenus(null,true);return;}
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
      else if(e.key==='Tab'){e.preventDefault();var dropdown=closest(menu,'.ody-dropdown'),trigger=$('[data-ody-toggle]',dropdown),outside=focusables(document).filter(function(node){return !dropdown.contains(node)||node===trigger;}),index=outside.indexOf(trigger);closeAllMenus(null);var next=e.shiftKey?trigger:outside[index+1];if(next)next.focus();else restoreFocus(trigger);}
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
    if (activeTooltip && activeTooltip.node.contains(e.target)) { activeTooltip.hovered = true; clearTimeout(tooltipHideTimer); return; }
    var trig = closest(e.target, '[data-ody-tooltip]');
    if (trig) { showTooltip(trig); if (activeTooltip) activeTooltip.hovered = true; }
  }
  function onOut(e) {
    if (!activeTooltip) return;
    var to = e.relatedTarget;
    if (to && (activeTooltip.trigger.contains(to) || activeTooltip.node.contains(to))) return;
    if (activeTooltip.trigger.contains(e.target) || activeTooltip.node.contains(e.target)) { activeTooltip.hovered = false; leaveTooltip(); }
  }
  function onFocusIn(e) { var trig = closest(e.target, '[data-ody-tooltip]'); if (trig) showTooltip(trig); }
  function onFocusOut(e) { if (activeTooltip && activeTooltip.trigger.contains(e.target)) leaveTooltip(); }

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
    if (window.OdysseyExtensions) window.OdysseyExtensions.init(root);
    bindGlobals();
    initTheme();
    $all('[data-ody-tabs]', root).forEach(initTabs);
    if (root.matches && root.matches('[data-ody-tabs]')) initTabs(root);
    $all('[data-ody-accordion]', root).forEach(initAccordion);
    if (root.matches && root.matches('[data-ody-accordion]')) initAccordion(root);
    // ensure overlays start hidden unless flagged open
    roots(root, '.ody-modal, .ody-drawer').forEach(function (ov) {
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
    if(window.OdysseyCompositions)window.OdysseyCompositions.init(root);
    return Odyssey;
  }

  /* ============================================================== EXPORT */
  var Odyssey = {
    version: VERSION,
    init: init,
    isComposing: isComposing,
    roots: roots,
    registerLayer: registerLayer,
    releaseLayer: releaseLayer,
    topLayer: topLayer,
    restoreFocus: restoreFocus,
    i18n: i18n,
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
  on(document, 'wire:after', function (event) {
    var targets = event.detail && event.detail.targets;
    if (!targets || !targets.length) { Odyssey.init(event.target); return; }
    targets.forEach(function (selector) { var root = byRef(selector); if (root) Odyssey.init(root); });
  });

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

  var fieldId = 0;
  function stableId(node, prefix) { if (!node.id) { do { fieldId++; node.id = prefix + fieldId; } while (document.getElementById(node.id) && document.getElementById(node.id) !== node); } return node.id; }
  function controlName(input, root, fallback) {
    if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !(input.labels && input.labels.length)) {
      input.setAttribute('aria-label', attr(root, 'aria-label') || attr(root, 'data-label') || fallback);
    }
  }
  function changed(node, value) { node.dispatchEvent(new CustomEvent('ody:change', {bubbles:true, detail:{value:value}})); }

  /* ============================================================ COMBOBOX */
  function cbxOpts(cb) { return $$('.ody-combobox__opt', cb); }
  function cbxLabel(opt) { if (opt.dataset.odyLabel == null) opt.dataset.odyLabel = (opt.textContent || '').trim(); return opt.dataset.odyLabel; }
  function cbxInit(cb) {
    var input = $('.ody-combobox__input', cb), list = $('.ody-combobox__list', cb);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', stableId(list, 'ody-options-'));
    input.setAttribute('aria-expanded', String(cb.classList.contains('is-open')));
    controlName(input, cb, API.i18n.t('common.choose', null, cb)); list.setAttribute('role', 'listbox');
    cbxOpts(cb).forEach(function (opt) { stableId(opt, 'ody-option-'); opt.setAttribute('role','option'); opt.setAttribute('aria-selected', String(opt.classList.contains('is-active') || opt===cb._odySelected)); });
  }
  function cbxSetActive(cb, option) {
    cbxOpts(cb).forEach(function (opt) { var active = opt === option; opt.classList.toggle('is-active', active); opt.setAttribute('aria-selected', String(active || (!cb.classList.contains('is-open') && opt===cb._odySelected))); });
    var input = $('.ody-combobox__input', cb);
    if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({block:'nearest'}); }
    else input.removeAttribute('aria-activedescendant');
  }
  function cbxFilter(cb) {
    var input = $('.ody-combobox__input', cb), q = input.value.trim().toLowerCase();
    var list = $('.ody-combobox__list', cb), shown = 0;
    cbxOpts(cb).forEach(function (opt) {
      var label = cbxLabel(opt), index = label.toLowerCase().indexOf(q);
      opt.hidden = q !== '' && index < 0; opt.textContent = '';
      if (!opt.hidden) {
        shown++;
        if (q) { opt.appendChild(document.createTextNode(label.slice(0,index))); var mark = document.createElement('mark'); mark.textContent = label.slice(index,index+q.length); opt.appendChild(mark); opt.appendChild(document.createTextNode(label.slice(index+q.length))); }
        else opt.textContent = label;
      }
    });
    cbxSetActive(cb, null);
    var empty = $('.ody-combobox__empty', list);
    if (!empty) { empty = document.createElement('div'); empty.className='ody-combobox__empty'; empty.textContent=API.i18n.t('common.noResults',null,cb); empty.setAttribute('role','status'); list.appendChild(empty); }
    empty.hidden = shown > 0;
  }
  function cbxOpen(cb) { cb.classList.add('is-open'); cbxInit(cb); cbxFilter(cb); $('.ody-combobox__input', cb).setAttribute('aria-expanded','true'); }
  function cbxClose(cb) { cb.classList.remove('is-open'); $('.ody-combobox__input', cb).setAttribute('aria-expanded','false'); cbxSetActive(cb,null); }
  function cbxActive(cb) { return $('.ody-combobox__opt.is-active',cb); }
  function cbxVisible(cb) { return cbxOpts(cb).filter(function (opt) { return !opt.hidden && opt.getAttribute('aria-disabled') !== 'true'; }); }
  function cbxMove(cb, direction) {
    var items=cbxVisible(cb); if (!items.length) return;
    var index=items.indexOf(cbxActive(cb));
    if (index < 0) index=direction > 0 ? 0 : items.length-1;
    else index=Math.max(0,Math.min(items.length-1,index+direction));
    cbxSetActive(cb,items[index]);
  }
  function cbxPick(cb,opt) {
    if (!opt || opt.getAttribute('aria-disabled') === 'true') return;
    cb._odySelected=opt;
    var input=$('.ody-combobox__input',cb); input.value=opt.dataset.value != null ? opt.dataset.value : cbxLabel(opt);
    cbxClose(cb); input.focus(); input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  /* ========================================================= MULTISELECT */
  function msOpts(ms) { return $$('.ody-multiselect__opt',ms); }
  function msValue(ms) { return msOpts(ms).filter(function (opt) { return opt.classList.contains('is-selected'); }).map(function (opt) { return opt.dataset.value != null ? opt.dataset.value : opt.textContent.trim(); }); }
  function msRender(ms) {
    var box=$('.ody-multiselect__values',ms), restore=box.contains(document.activeElement), selected=msOpts(ms).filter(function (opt) { return opt.classList.contains('is-selected'); });
    box.textContent='';
    if (!selected.length) { var placeholder=document.createElement('span'); placeholder.className='ody-multiselect__ph'; placeholder.textContent=attr(ms,'data-placeholder') || API.i18n.t('common.select',null,ms); box.appendChild(placeholder); }
    selected.forEach(function (opt) {
      var chip=document.createElement('span'); chip.className='ody-multiselect__chip'; chip.appendChild(document.createTextNode(opt.textContent.trim()));
      var remove=document.createElement('button'); remove.type='button'; remove.className='ody-multiselect__chip-x'; remove.innerHTML=CX;
      remove.setAttribute('aria-label',API.i18n.t('common.remove',{name:opt.textContent.trim()},ms)); remove.dataset.odyMsRemove=opt.dataset.value != null ? opt.dataset.value : opt.textContent.trim(); chip.appendChild(remove); box.appendChild(chip);
    });
    msOpts(ms).forEach(function (opt) { opt.setAttribute('aria-selected',String(opt.classList.contains('is-selected'))); });
    if(restore)$('.ody-multiselect__control',ms).focus();
  }
  function msInit(ms) {
    var control=$('.ody-multiselect__control',ms), list=$('.ody-multiselect__menu',ms);
    control.setAttribute('role','combobox'); control.setAttribute('aria-haspopup','listbox'); control.setAttribute('aria-expanded',String(ms.classList.contains('is-open')));
    control.setAttribute('aria-controls',stableId(list,'ody-multi-list-')); controlName(control,ms,API.i18n.t('common.chooseMany',null,ms));
    list.setAttribute('role','listbox'); list.setAttribute('aria-multiselectable','true');
    msOpts(ms).forEach(function (opt) { stableId(opt,'ody-multi-option-'); opt.setAttribute('role','option'); opt.setAttribute('tabindex','-1'); }); msRender(ms);
  }
  function msActive(ms,opt) {
    msOpts(ms).forEach(function (item) { item.classList.toggle('is-active',item===opt); });
    var control=$('.ody-multiselect__control',ms);
    if (opt) { control.setAttribute('aria-activedescendant',opt.id); opt.scrollIntoView({block:'nearest'}); }
    else control.removeAttribute('aria-activedescendant');
  }
  function msOpen(ms) { ms.classList.add('is-open'); $('.ody-multiselect__control',ms).setAttribute('aria-expanded','true'); msActive(ms,msOpts(ms).find(function (opt) { return opt.classList.contains('is-selected'); }) || msOpts(ms)[0]); }
  function msClose(ms) { ms.classList.remove('is-open'); $('.ody-multiselect__control',ms).setAttribute('aria-expanded','false'); msActive(ms,null); }
  function msToggle(ms,opt) { if (opt.getAttribute('aria-disabled')==='true') return; opt.classList.toggle('is-selected'); msRender(ms); changed(ms,msValue(ms)); }
  function msRemove(ms,value) { msOpts(ms).forEach(function (opt) { if ((opt.dataset.value != null ? opt.dataset.value : opt.textContent.trim())===value) opt.classList.remove('is-selected'); }); msRender(ms); $('.ody-multiselect__control',ms).focus(); changed(ms,msValue(ms)); }

  /* ============================================================ TAGINPUT */
  function tiValues(ti) { return $$('.ody-taginput__chip', ti).map(function (c) { return (c.dataset.value || '').trim(); }); }
  function tiAdd(ti, raw) {
    var val = (raw || '').trim(); if (!val) return;
    var dup = attr(ti, 'data-allow-dupes') != null ? false : tiValues(ti).indexOf(val) >= 0;
    if (dup) return;
    var chip = document.createElement('span'); chip.className = 'ody-taginput__chip'; chip.dataset.value = val;
    chip.appendChild(document.createTextNode(val));
    var x = document.createElement('button'); x.type = 'button'; x.className = 'ody-taginput__chip-x'; x.innerHTML = CX; x.setAttribute('aria-label', API.i18n.t('common.remove',{name:val},ti));
    chip.appendChild(x);
    ti.insertBefore(chip, $('.ody-taginput__field', ti));
    ti.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: tiValues(ti) } }));
  }
  function tiRemove(ti, chip) { if (chip) { chip.parentNode.removeChild(chip); ti.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: tiValues(ti) } })); } }

  /* =========================================================== DATEPICKER */
  function dateValue(date) { return date.getFullYear()+'-'+pad2(date.getMonth()+1)+'-'+pad2(date.getDate()); }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    var parts=value.split('-').map(Number), date=new Date(0); date.setHours(0,0,0,0); date.setFullYear(parts[0],parts[1]-1,parts[2]);
    return dateValue(date)===value ? date : null;
  }
  function dateAllowed(dp,date) {
    var input=$('.ody-datepicker__input',dp), value=dateValue(date), min=parseDate(attr(input,'min')), max=parseDate(attr(input,'max'));
    return (!min||date>=min)&&(!max||date<=max)&&(attr(dp,'data-disabled-dates')||'').split(',').indexOf(value)<0;
  }
  function boundedDate(dp,date) {
    var input=$('.ody-datepicker__input',dp), min=parseDate(attr(input,'min')), max=parseDate(attr(input,'max'));
    return min&&date<min ? min : max&&date>max ? max : date;
  }
  function dpState(dp) {
    var input=$('.ody-datepicker__input',dp);
    if (dp._odyDate && dp._odyDate.raw===input.value) return dp._odyDate;
    var parsed=parseDate(input.value),selected=parsed&&dateAllowed(dp,parsed)?parsed:null,base=boundedDate(dp,parsed||new Date());
    if (input.value) input.setAttribute('aria-invalid',String(!selected));
    return (dp._odyDate={raw:input.value,y:base.getFullYear(),m:base.getMonth(),sel:selected,focus:base});
  }
  function dpInit(dp) {
    var input=$('.ody-datepicker__input',dp), panel=$('.ody-datepicker__panel',dp);
    if (input.type==='date') return;
    input.setAttribute('role','combobox'); input.setAttribute('aria-haspopup','dialog'); input.setAttribute('aria-expanded',String(dp.classList.contains('is-open')));
    input.setAttribute('aria-controls',stableId(panel,'ody-calendar-')); controlName(input,dp,API.i18n.t('date.choose',null,dp));
  }
  function dpRender(dp,focus) {
    var state=dpState(dp), panel=$('.ody-datepicker__panel',dp), locale=API.i18n.locale(dp);
    var first=new Date(state.y,state.m,1), start=(first.getDay()+6)%7, days=new Date(state.y,state.m+1,0).getDate();
    var titleId=stableId(panel,'ody-calendar-')+'-title', today=dateValue(new Date());
    panel.textContent=''; panel.setAttribute('role','dialog'); panel.setAttribute('aria-labelledby',titleId);
    var head=document.createElement('div'); head.className='ody-datepicker__head';
    [-1,1].forEach(function (direction) {
      var button=document.createElement('button'); button.type='button'; button.className='ody-datepicker__nav'; button.dataset.odyDpNav=direction; button.setAttribute('aria-label',API.i18n.t(direction<0?'date.previousMonth':'date.nextMonth',null,dp)); button.textContent=direction<0?'‹':'›';
      if(direction<0)head.appendChild(button); else {
        var title=document.createElement('span'); title.id=titleId; title.className='ody-datepicker__title'; title.setAttribute('aria-live','polite'); title.textContent=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(first); head.appendChild(title); head.appendChild(button);
      }
    }); panel.appendChild(head);
    var grid=document.createElement('div'); grid.className='ody-datepicker__grid'; grid.setAttribute('role','grid'); grid.setAttribute('aria-labelledby',titleId);
    var row=document.createElement('div'); row.setAttribute('role','row'); row.style.display='contents'; grid.appendChild(row);
    for(var dow=0;dow<7;dow++){var dayName=document.createElement('span'); dayName.setAttribute('role','columnheader'); dayName.className='ody-datepicker__dow'; dayName.textContent=new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2024,0,1+dow)); row.appendChild(dayName);}
    var rowCount=Math.ceil((start+days)/7);
    for(var week=0;week<rowCount;week++){
      row=document.createElement('div'); row.setAttribute('role','row'); row.style.display='contents'; grid.appendChild(row);
      for(var column=0;column<7;column++){
        var day=week*7+column-start+1;
        if(day<1||day>days){var blank=document.createElement('span'); blank.setAttribute('role','gridcell'); row.appendChild(blank); continue;}
        var date=new Date(state.y,state.m,day), value=dateValue(date), button=document.createElement('button'); button.type='button'; button.className='ody-datepicker__day'; button.dataset.odyDpDay=day; button.dataset.date=value; button.textContent=day;
        button.setAttribute('role','gridcell'); button.setAttribute('aria-label',new Intl.DateTimeFormat(locale,{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(date)); button.setAttribute('aria-selected',String(!!state.sel&&dateValue(state.sel)===value));
        if(value===today){button.classList.add('is-today');button.setAttribute('aria-current','date');}
        if(state.sel&&dateValue(state.sel)===value)button.classList.add('is-selected');
        button.disabled=!dateAllowed(dp,date); button.tabIndex=!button.disabled&&value===dateValue(state.focus)?0:-1; row.appendChild(button);
      }
    }
    panel.appendChild(grid);
    var active=panel.querySelector('[data-date="'+dateValue(state.focus)+'"]:not(:disabled)')||panel.querySelector('[data-ody-dp-day]:not(:disabled)');
    if(active){active.tabIndex=0;if(focus)active.focus();}
  }
  function dpOpen(dp) { dpInit(dp); var state=dpState(dp); state.focus=boundedDate(dp,state.sel||new Date()); state.y=state.focus.getFullYear();state.m=state.focus.getMonth();dpRender(dp,true);dp.classList.add('is-open');$('.ody-datepicker__input',dp).setAttribute('aria-expanded','true'); var active=$('[data-ody-dp-day][tabindex="0"]',dp);if(active)active.focus(); }
  function dpClose(dp,restore) { dp.classList.remove('is-open');var input=$('.ody-datepicker__input',dp);input.setAttribute('aria-expanded','false');if(restore)input.focus(); }
  function dpFocus(dp,date) {
    var state=dpState(dp),direction=date>=state.focus?1:-1,blocked=(attr(dp,'data-disabled-dates')||'').split(',');
    date=boundedDate(dp,date);
    for(var index=0;!dateAllowed(dp,date)&&index<=blocked.length;index++){
      var next=new Date(date);next.setDate(next.getDate()+direction);next=boundedDate(dp,next);
      if(dateValue(next)===dateValue(date)){date=state.focus;break;}date=next;
    }
    if(!dateAllowed(dp,date))return;
    state.focus=date;state.y=date.getFullYear();state.m=date.getMonth();dpRender(dp,true);
  }
  function dpMonth(dp,direction) { var state=dpState(dp), date=new Date(state.y,state.m+direction,1);date.setDate(Math.min(state.focus.getDate(),new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));dpFocus(dp,date); }
  function dpPick(dp,day) {
    var state=dpState(dp), date=new Date(state.y,state.m,day);if(!dateAllowed(dp,date))return;
    var input=$('.ody-datepicker__input',dp);input.value=dateValue(date);input.setAttribute('aria-invalid','false');state.raw=input.value;state.sel=date;state.focus=date;dpClose(dp,true);input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  /* =========================================================== TIMEPICKER */
  function timeValue(value) { var match=/^(\d{2}):(\d{2})$/.exec(value||'');return match&&+match[1]<24&&+match[2]<60 ? +match[1]*60 + +match[2] : null; }
  function tpInit(tp) { var input=$('.ody-timepicker__input',tp),panel=$('.ody-timepicker__panel',tp);if(input.type==='time')return;input.setAttribute('role','combobox');input.setAttribute('aria-haspopup','dialog');input.setAttribute('aria-expanded',String(tp.classList.contains('is-open')));input.setAttribute('aria-controls',stableId(panel,'ody-time-'));controlName(input,tp,'Choose a time');var value=timeValue(input.value);if(input.value)input.setAttribute('aria-invalid',String(value===null||!timeAllowed(tp,Math.floor(value/60),value%60))); }
  function timeAllowed(tp,hour,minute) { var input=$('.ody-timepicker__input',tp),value=hour*60+minute,min=timeValue(attr(input,'min')),max=timeValue(attr(input,'max'));return(min===null||value>=min)&&(max===null||value<=max); }
  function tpBuild(tp) {
    var panel=$('.ody-timepicker__panel',tp),step=Math.max(1,Math.min(60,parseInt(attr(tp,'data-minute-step'),10)||5));panel.textContent='';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',API.i18n.t('time.choose',null,tp));
    ['h','m'].forEach(function(kind){var col=document.createElement('div');col.className='ody-timepicker__col';col.dataset.col=kind;col.setAttribute('role','group');col.setAttribute('aria-label',API.i18n.t(kind==='h'?'time.hours':'time.minutes',null,tp));for(var value=0;value<(kind==='h'?24:60);value+=kind==='h'?1:step){var button=document.createElement('button');button.type='button';button.className='ody-timepicker__opt';button.setAttribute('data-ody-tp-'+kind,value);button.textContent=pad2(value);button.setAttribute('aria-label',API.i18n.t(kind==='h'?'time.hour':'time.minute',{value:pad2(value)},tp));col.appendChild(button);}panel.appendChild(col);});
  }
  function tpSync(tp) {
    var input=$('.ody-timepicker__input',tp),value=timeValue(input.value),hour=value===null?0:Math.floor(value/60),minute=value===null?0:value%60;
    $$('.ody-timepicker__opt',tp).forEach(function(button){var isHour=button.hasAttribute('data-ody-tp-h'),number=+(isHour?button.dataset.odyTpH:button.dataset.odyTpM),selected=number===(isHour?hour:minute);button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=isHour?!$$('[data-ody-tp-m]',tp).some(function(m){return timeAllowed(tp,number,+m.dataset.odyTpM);}):!timeAllowed(tp,hour,number);});
  }
  function tpOpen(tp) {tpInit(tp);tpBuild(tp);tp.classList.add('is-open');$('.ody-timepicker__input',tp).setAttribute('aria-expanded','true');tpSync(tp);var active=$('.ody-timepicker__opt.is-active:not(:disabled)',tp)||$('.ody-timepicker__opt:not(:disabled)',tp);if(active)active.focus();}
  function tpClose(tp,restore) {tp.classList.remove('is-open');var input=$('.ody-timepicker__input',tp);input.setAttribute('aria-expanded','false');if(restore)input.focus();}
  function tpSet(tp) {
    var input=$('.ody-timepicker__input',tp),h=$('.is-active[data-ody-tp-h]',tp),m=$('.is-active[data-ody-tp-m]',tp),hour=h?+h.dataset.odyTpH:0,minute=m?+m.dataset.odyTpM:0;
    if(!timeAllowed(tp,hour,minute)){
      var available=$$('[data-ody-tp-m]',tp).find(function(button){return timeAllowed(tp,hour,+button.dataset.odyTpM);});
      if(!available)return;minute=+available.dataset.odyTpM;
    }
    input.value=pad2(hour)+':'+pad2(minute);input.setAttribute('aria-invalid','false');input.dispatchEvent(new Event('change',{bubbles:true}));
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
    $('[data-ody-dr-thumb="lo"]',dr).setAttribute('aria-label',API.i18n.t('range.minimum',null,dr));
    $('[data-ody-dr-thumb="hi"]',dr).setAttribute('aria-label',API.i18n.t('range.maximum',null,dr));
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
      row.querySelector('[data-ody-dz-remove]').setAttribute('aria-label',API.i18n.t('common.remove',{name:f.name},dz));
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
    if (otp._ody) { otpSync(otp, false); return; } otp._ody = true;
    var len = +attr(otp, 'data-len') || 6;
    var mode = attr(otp, 'data-mode') === 'text' ? 'text' : 'numeric';
    var html = '';
    for (var i = 0; i < len; i++) html += '<input class="ody-otp__cell" type="text" inputmode="' + (mode === 'text' ? 'text' : 'numeric') + '" maxlength="' + len + '" autocomplete="one-time-code">';
    otp.innerHTML = html; otp._mode = mode;
    var name = attr(otp, 'data-ody-code-name') || attr(otp, 'data-name') || attr(otp, 'name');
    if (name) { var value=document.createElement('input');value.type='hidden';value.name=name;value.setAttribute('data-ody-otp-value','');otp.appendChild(value); }
    var help=document.createElement('span');help.className='ody-sr-only';help.setAttribute('data-ody-code-help','');stableId(help,'ody-otp-help-');otp.appendChild(help);
    otpCells(otp).forEach(function(cell){cell.setAttribute('aria-describedby',help.id);});
    var initial=attr(otp,'data-value') || ''; if(mode!=='text')initial=initial.replace(/[^0-9]/g,'');
    otpCells(otp).forEach(function(cell,index){cell.value=cell.defaultValue=initial[index]||'';cell.addEventListener('focus',function(){cell.select();});});
    var form=otpCells(otp)[0].form;
    if(form)form.addEventListener('reset',function(event){setTimeout(function(){if(!event.defaultPrevented)otpSync(otp,true);},0);});
    otpSync(otp,false);
  }
  function otpCells(otp) { return $$('.ody-otp__cell', otp); }
  function otpValue(otp) { return otpCells(otp).map(function (c) { return c.value; }).join(''); }
  function otpSync(otp, notify) {
    var cells=otpCells(otp), value=otpValue(otp), complete=cells.every(function(cell){return cell.value.length===1;});
    var hidden=$('[data-ody-otp-value]',otp);
    if(hidden){hidden.value=value;hidden.disabled=cells.every(function(cell){return cell.disabled;});}
    var help=$('[data-ody-code-help]',otp);
    if(help)help.textContent=API.i18n.t('otp.help',{count:cells.length},otp);
    cells.forEach(function(cell,index){cell.classList.toggle('is-filled',!!cell.value);cell.setAttribute('aria-label',API.i18n.t('otp.digit',{index:index+1,count:cells.length},otp));if(notify)cell.removeAttribute('aria-invalid');});
    if(notify){otp.removeAttribute('aria-invalid');var error=$('[data-ody-code-error]',otp);if(error){error.textContent='';error.hidden=true;}otp.dispatchEvent(new CustomEvent('ody:change',{bubbles:true,detail:{value:value,complete:complete}}));}
  }

  /* =============================================================== SWATCH */
  function swSet(sw) {
    var wrap = closest(sw, '.ody-swatches');
    $$('.ody-swatch', wrap).forEach(function (s) { s.classList.toggle('is-active', s === sw); s.setAttribute('aria-checked', s === sw ? 'true' : 'false'); });
    wrap.dispatchEvent(new CustomEvent('ody:change', { bubbles: true, detail: { value: sw.dataset.value || sw.getAttribute('aria-label') || '' } }));
  }

  /* ========================================================= INIT (build) */
  function initExt(root) {
    root = root || document;
    API.roots(root, '[data-ody-dualrange]').forEach(drInit);
    API.roots(root, '[data-ody-rating]').forEach(rtInit);
    API.roots(root, '[data-ody-otp]').forEach(otpInit);
    API.roots(root, '.ody-combobox').forEach(cbxInit);
    API.roots(root, '[data-ody-multiselect]').forEach(msInit);
    API.roots(root, '.ody-datepicker').forEach(dpInit);
    API.roots(root, '.ody-timepicker').forEach(tpInit);
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
      var cells=otpCells(otp), start=cells.indexOf(otpCell);
      otpCell.value=v.slice(0,1);
      for(var i=1;i<v.length&&start+i<cells.length;i++)cells[start+i].value=v[i];
      if(v)cells[Math.min(cells.length-1,start+v.length)].focus();
      otpSync(otp,true);
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
      msRemove(closest(msX,'.ody-multiselect'),msX.dataset.odyMsRemove); e.stopPropagation(); return;
    }
    var msClear = closest(t,'[data-ody-ms-clear]');
    if (msClear) { var clearMs=closest(msClear,'.ody-multiselect'); msOpts(clearMs).forEach(function (opt) { opt.classList.remove('is-selected'); }); msRender(clearMs); $('.ody-multiselect__control',clearMs).focus(); changed(clearMs,[]); return; }
    var msOpt = closest(t, '.ody-multiselect__opt');
    if (msOpt) { var optionMs=closest(msOpt,'.ody-multiselect'); msToggle(optionMs,msOpt); $('.ody-multiselect__control',optionMs).focus(); return; }
    var msCtl = closest(t, '.ody-multiselect__control');
    if (msCtl) { var ms=closest(msCtl,'.ody-multiselect'); ms.classList.contains('is-open') ? msClose(ms) : msOpen(ms); return; }

    /* taginput */
    var tiX = closest(t, '.ody-taginput__chip-x');
    if (tiX) { tiRemove(closest(tiX, '.ody-taginput'), closest(tiX, '.ody-taginput__chip')); return; }
    var ti = closest(t, '.ody-taginput');
    if (ti && !closest(t, '.ody-taginput__chip')) { var fld = $('.ody-taginput__field', ti); fld && fld.focus(); }

    /* datepicker */
    var dpIn = closest(t, '.ody-datepicker__input');
    if (dpIn && dpIn.type!=='date') { var dp=closest(dpIn,'.ody-datepicker');dp.classList.contains('is-open')?dpClose(dp):dpOpen(dp);return;}
    var dpNav = closest(t, '[data-ody-dp-nav]');
    if(dpNav){dpMonth(closest(dpNav,'.ody-datepicker'),+dpNav.dataset.odyDpNav);return;}
    var dpDay = closest(t, '[data-ody-dp-day]');
    if (dpDay) { dpPick(closest(dpDay, '.ody-datepicker'), +dpDay.dataset.odyDpDay); return; }

    /* timepicker */
    var tpIn = closest(t, '.ody-timepicker__input');
    if(tpIn&&tpIn.type!=='time'){var tp=closest(tpIn,'.ody-timepicker');tp.classList.contains('is-open')?tpClose(tp):tpOpen(tp);return;}
    var tpOpt = closest(t, '.ody-timepicker__opt');
    if (tpOpt) {
      var tpw = closest(tpOpt, '.ody-timepicker'), col = closest(tpOpt, '.ody-timepicker__col');
      $$('.ody-timepicker__opt', col).forEach(function (o) { o.classList.remove('is-active'); });
      tpOpt.classList.add('is-active'); tpSet(tpw); tpSync(tpw); return;
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
    if (API.isComposing(e)) return;
    var t = e.target, k = e.key;

    /* combobox */
    var cbxIn = closest(t, '.ody-combobox__input');
    if (cbxIn) {
      var cb = closest(cbxIn, '.ody-combobox');
      if (k === 'ArrowDown') { e.preventDefault(); if (!cb.classList.contains('is-open')) cbxOpen(cb); cbxMove(cb, 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); if (!cb.classList.contains('is-open')) cbxOpen(cb); cbxMove(cb, -1); }
      else if (k === 'Enter') { var a = cbxActive(cb); if (a) { e.preventDefault(); cbxPick(cb, a); } }
      else if (k === 'Escape') { if (cb.classList.contains('is-open')) { e.preventDefault(); cbxClose(cb); } }
      return;
    }

    var msControl=closest(t,'.ody-multiselect__control');
    if (msControl && !closest(t,'[data-ody-ms-remove]')) {
      var ms=closest(msControl,'.ody-multiselect'), items=msOpts(ms).filter(function (opt) { return opt.getAttribute('aria-disabled')!=='true'; }), active=$('.ody-multiselect__opt.is-active',ms);
      if (k==='Enter'||k===' ') { e.preventDefault(); if (!ms.classList.contains('is-open')) msOpen(ms); else if (active) msToggle(ms,active); }
      else if (k==='ArrowDown'||k==='ArrowUp'||k==='Home'||k==='End') { e.preventDefault(); if (!ms.classList.contains('is-open')) msOpen(ms); else { var index=items.indexOf(active); index=k==='Home'?0:k==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(k==='ArrowDown'?1:-1))); msActive(ms,items[index]); } }
      else if (k==='Escape') { e.preventDefault(); msClose(ms); msControl.focus(); }
      else if (k==='Tab') msClose(ms);
      return;
    }

    var dateInput=closest(t,'.ody-datepicker__input'), datePicker=closest(t,'.ody-datepicker');
    if(dateInput&&dateInput.type!=='date'&&(k==='Enter'||k===' '||k==='ArrowDown')){e.preventDefault();dpOpen(datePicker);return;}
    if(datePicker&&datePicker.classList.contains('is-open')){
      if(k==='Escape'){e.preventDefault();dpClose(datePicker,true);return;}
      var dayButton=closest(t,'[data-ody-dp-day]');
      if(dayButton){var date=parseDate(dayButton.dataset.date),delta=0;if(k==='ArrowLeft')delta=-1;else if(k==='ArrowRight')delta=1;else if(k==='ArrowUp')delta=-7;else if(k==='ArrowDown')delta=7;else if(k==='Home')delta=-((date.getDay()+6)%7);else if(k==='End')delta=6-((date.getDay()+6)%7);else if(k==='PageUp'||k==='PageDown'){e.preventDefault();dpMonth(datePicker,(k==='PageDown'?1:-1)*(e.shiftKey?12:1));return;}if(delta||k==='Home'||k==='End'){e.preventDefault();date.setDate(date.getDate()+delta);dpFocus(datePicker,date);return;}}
    }
    var timeInput=closest(t,'.ody-timepicker__input'),timePicker=closest(t,'.ody-timepicker');
    if(timeInput&&timeInput.type!=='time'&&(k==='Enter'||k===' '||k==='ArrowDown')){e.preventDefault();tpOpen(timePicker);return;}
    if(timePicker&&timePicker.classList.contains('is-open')){
      if(k==='Escape'){e.preventDefault();tpClose(timePicker,true);return;}
      var timeOption=closest(t,'.ody-timepicker__opt');
      if(timeOption){var column=closest(timeOption,'.ody-timepicker__col'),options=$$('.ody-timepicker__opt:not(:disabled)',column),index=options.indexOf(timeOption);if(k==='ArrowDown'||k==='ArrowUp'||k==='Home'||k==='End'){e.preventDefault();index=k==='Home'?0:k==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+(k==='ArrowDown'?1:-1)));if(options[index])options[index].focus();return;}if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();var other=$('.ody-timepicker__col[data-col="'+(column.dataset.col==='h'?'m':'h')+'"]',timePicker),next=$('.is-active:not(:disabled)',other)||$('.ody-timepicker__opt:not(:disabled)',other);if(next)next.focus();return;}if(k==='Enter'||k===' '){e.preventDefault();timeOption.click();if(timeOption.hasAttribute('data-ody-tp-m'))tpClose(timePicker,true);else{var minute=$('[data-ody-tp-m].is-active:not(:disabled)',timePicker)||$('[data-ody-tp-m]:not(:disabled)',timePicker);if(minute)minute.focus();}return;}}
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
      if (k === 'Backspace' && otpCell.value === '' && idx > 0) { e.preventDefault(); cells[idx - 1].focus(); cells[idx - 1].value = ''; cells[idx - 1].classList.remove('is-filled'); otpSync(closest(otpCell,'.ody-otp'),true); }
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
    otpSync(otp,true);
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
      .filter(function (n) { return isFinite(n); });
  }
  function words(str) { return (str || '').split(',').map(function (s) { return s.trim(); }); }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ------------------------------------------------------------- CHARTS */
  var chartId = 0;
  function chartNode(tag, text) { var node=document.createElement(tag); if(text!=null)node.textContent=String(text); return node; }
  function describeChart(el, config) {
    if (!el) return el;
    config = config || {};
    var previous=el.querySelector('details[data-ody-chart-description]'),wasOpen=previous&&previous.open,hadFocus=previous&&previous.contains(document.activeElement);
    Array.prototype.slice.call(el.children).forEach(function (child) { if (child.hasAttribute('data-ody-chart-description')) child.remove(); });
    var svg = Array.prototype.find.call(el.children, function (child) { return child.tagName.toLowerCase() === 'svg'; });
    var unnamedSpark=el.getAttribute('data-ody-chart')==='spark'&&!config.name&&!config.summary&&!el.getAttribute('aria-label')&&!el.getAttribute('data-label')&&!el.getAttribute('data-summary');
    var decorative = config.decorative === true || el.hasAttribute('data-ody-decorative') || el.getAttribute('aria-hidden') === 'true' || unnamedSpark;
    if (svg) { svg.removeAttribute('aria-labelledby'); svg.removeAttribute('aria-describedby'); }
    if (decorative) { if(svg){svg.setAttribute('aria-hidden','true');svg.removeAttribute('role');svg.removeAttribute('aria-label');} return el; }
    var values=config.values || [], labels=config.labels || [];
    var name=config.name || el.getAttribute('aria-label') || el.getAttribute('data-label') || O.i18n.t('chart.name',null,el);
    var summary=config.summary || el.getAttribute('data-summary') || (values.length ? O.i18n.t('chart.summary',{count:values.length,min:Math.min.apply(null,values),max:Math.max.apply(null,values)},el) : O.i18n.t('chart.empty',null,el));
    var rows=config.rows || values.map(function(value,index){return [labels[index] || O.i18n.t('chart.item',{index:index+1},el),value];});
    var columns=config.columns || [O.i18n.t('chart.label',null,el),O.i18n.t('chart.value',null,el)];
    var description=chartNode('p',summary);description.className='ody-chart__summary';description.setAttribute('data-ody-chart-description','');
    do { chartId++;description.id='ody-chart-summary-'+chartId; } while(document.getElementById(description.id));
    if(svg){svg.setAttribute('role','img');svg.removeAttribute('aria-hidden');svg.setAttribute('aria-label',name);svg.setAttribute('aria-describedby',description.id);}
    el.appendChild(description);
    var details=chartNode('details');details.className='ody-chart__data';details.setAttribute('data-ody-chart-description','');
    details.open=!!wasOpen;details.appendChild(chartNode('summary',O.i18n.t('chart.data',null,el)));
    var table=chartNode('table'), caption=chartNode('caption',O.i18n.t('chart.table',{name:name},el));table.appendChild(caption);
    var head=chartNode('thead'), row=chartNode('tr');
    columns.forEach(function(column){var th=chartNode('th',column);th.scope='col';row.appendChild(th);});head.appendChild(row);table.appendChild(head);
    var body=chartNode('tbody');rows.forEach(function(values){var row=chartNode('tr');values.forEach(function(value,index){var cell=chartNode(index===0?'th':'td',value==null?'—':value);if(index===0)cell.scope='row';row.appendChild(cell);});body.appendChild(row);});table.appendChild(body);details.appendChild(table);el.appendChild(details);if(hadFocus)details.querySelector('summary').focus();
    return el;
  }
  function renderChart(el) {
    if (!el) return el;
    var type = (el.getAttribute('data-ody-chart') || 'bar').trim();
    var vals = numbers(el.getAttribute('data-values'));
    var labels = words(el.getAttribute('data-labels'));
    var saved=el.__odyChartLabels;if(saved&&saved.raw===el.getAttribute('data-labels'))labels=saved.values;
    var max = parseFloat(el.getAttribute('data-max'));
    if (isNaN(max)) max = Math.max(0, Math.max.apply(null, vals));
    var min = Math.min(0, Math.min.apply(null, vals));
    Array.prototype.slice.call(el.children).forEach(function(child){if(child.hasAttribute('data-ody-chart-svg'))child.remove();});
    var svg;
    if(vals.length){
      if (type === 'bar') svg = barChart(vals, labels, max, min);
      else if (type === 'line') svg = lineChart(vals, labels, max, min);
      else if (type === 'donut') svg = donutChart(el, vals);
      else if (type === 'spark') svg = sparkChart(el, vals);
      else svg = barChart(vals, labels, max, min);
      svg.setAttribute('data-ody-chart-svg','');el.insertBefore(svg,el.firstChild);
    }
    describeChart(el,{values:vals,labels:labels});el.setAttribute('data-ody-chart-ready','1');return el;
  }
  function updateChart(el, config) {
    if(typeof el==='string')el=document.querySelector(el);
    if(!el)return el;config=config||{};
    if(config.values!=null)el.setAttribute('data-values',config.values.join(','));
    if(config.labels!=null){el.setAttribute('data-labels',config.labels.join(','));el.__odyChartLabels={raw:el.getAttribute('data-labels'),values:config.labels.slice()};}
    if(config.type!=null)el.setAttribute('data-ody-chart',config.type);
    if(config.name!=null){el.setAttribute('data-label',config.name);if(el.hasAttribute('aria-label'))el.setAttribute('aria-label',config.name);}
    if(config.summary!=null)el.setAttribute('data-summary',config.summary);
    if(config.decorative!=null)el.toggleAttribute('data-ody-decorative',!!config.decorative);
    return renderChart(el);
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
  function treeChildren(item) { return Array.prototype.find.call(item.children,function(child){return child.classList.contains('ody-tree__children');}); }
  function treeRow(item) { return Array.prototype.find.call(item.children,function(child){return child.classList.contains('ody-tree__row');}); }
  function treeRows(tree) { return $all('.ody-tree__row',tree).filter(function(row){return closestEl(row,'.ody-tree')===tree;}); }
  function treeVisible(tree) { return treeRows(tree).filter(function(row){return row.getClientRects().length>0 && row.getAttribute('aria-disabled')!=='true';}); }
  function focusTreeRow(tree,row,focus) {
    treeRows(tree).forEach(function(item){item.tabIndex=item===row?0:-1;});if(focus&&row)row.focus();
  }
  function selectTreeRow(tree,row) {
    treeRows(tree).forEach(function(item){item.classList.toggle('is-active',item===row);item.setAttribute('aria-selected',String(item===row));});
    focusTreeRow(tree,row,true);
    tree.dispatchEvent(new CustomEvent('ody:tree-change',{bubbles:true,detail:{row:row,label:(row.querySelector('.ody-tree__label')||row).textContent.trim()}}));
  }
  function toggleTreeNode(row) {
    var item = closestEl(row, '.ody-tree__item'),kids=item&&treeChildren(item);
    if (!item || !kids || item.classList.contains('is-leaf')) return;
    var open = item.classList.toggle('is-open');row.setAttribute('aria-expanded',String(open));kids.hidden=!open;
    var tree=closestEl(row,'.ody-tree'),current=tree.querySelector('.ody-tree__row[tabindex="0"]');
    if(!open&&current&&kids.contains(current))focusTreeRow(tree,row,true);
  }
  var treeId=0;
  function initTree(root) {
    var trees=O.roots(root,'.ody-tree'),parent=root.nodeType===1?closestEl(root,'.ody-tree'):null;
    if(parent&&trees.indexOf(parent)<0)trees.push(parent);
    trees.forEach(function(tree){
      tree.setAttribute('role','tree');if(!tree.hasAttribute('aria-label')&&!tree.hasAttribute('aria-labelledby'))tree.setAttribute('aria-label',O.i18n.t('tree.files',null,tree));
      treeRows(tree).forEach(function(row){
        var item=closestEl(row,'.ody-tree__item'),kids=treeChildren(item),siblings=Array.prototype.filter.call(item.parentElement.children,function(child){return child.classList.contains('ody-tree__item');});
        item.setAttribute('role','none');row.setAttribute('role','treeitem');row.setAttribute('aria-selected',String(row.classList.contains('is-active')));
        var level=1,ancestor=item.parentElement;while(ancestor&&ancestor!==tree){if(ancestor.classList.contains('ody-tree__children'))level++;ancestor=ancestor.parentElement;}
        row.setAttribute('aria-level',level);row.setAttribute('aria-posinset',siblings.indexOf(item)+1);row.setAttribute('aria-setsize',siblings.length);
        var label=row.querySelector('.ody-tree__label');if(label&&!row.hasAttribute('aria-label')&&!row.hasAttribute('aria-labelledby')){if(!label.id){do{treeId++;label.id='ody-tree-label-'+treeId;}while(document.getElementById(label.id)&&document.getElementById(label.id)!==label);}row.setAttribute('aria-labelledby',label.id);}
        if(kids&&kids.querySelector('.ody-tree__item')){
          kids.setAttribute('role','group');if(!kids.id){do{treeId++;kids.id='ody-tree-group-'+treeId;}while(document.getElementById(kids.id)&&document.getElementById(kids.id)!==kids);}
          var owns=(row.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean);if(owns.indexOf(kids.id)<0)owns.push(kids.id);row.setAttribute('aria-owns',owns.join(' '));
          row.setAttribute('aria-expanded',String(item.classList.contains('is-open')));kids.hidden=!item.classList.contains('is-open');item.classList.remove('is-leaf');
        }else{item.classList.add('is-leaf');row.removeAttribute('aria-expanded');}
      });
      var visible=treeVisible(tree),current=visible.find(function(row){return row===document.activeElement||row.tabIndex===0;}),selected=treeRows(tree).find(function(row){return row.classList.contains('is-active');});
      treeRows(tree).forEach(function(row){var active=row===selected;row.classList.toggle('is-active',active);row.setAttribute('aria-selected',String(active));});
      focusTreeRow(tree,current||(visible.indexOf(selected)>=0?selected:visible[0]),false);
    });
  }

  /* Client-side table adapter is opt-in; unenhanced tables keep native links/forms. */
  function tableHost(table) { return closestEl(table,'[data-ody-table]'); }
  function tableRows(table) { return Array.prototype.slice.call(table.tBodies[0].rows).filter(function(row){return !row.hasAttribute('data-ody-table-empty')&&!row.classList.contains('ody-table__empty');}); }
  function tableRender(host) {
    var state=host.__odyTable, table=state.table, filters=$all('.ody-table__filter input',host);
    var matches=state.rows.filter(function(row){return filters.every(function(input){var cell=closestEl(input,'th,td'),index=Array.prototype.indexOf.call(cell.parentNode.children,cell),query=input.value.trim().toLowerCase();return !query||(row.cells[index]&&row.cells[index].textContent.toLowerCase().indexOf(query)>=0);});});
    var pages=Math.max(1,Math.ceil(matches.length/state.size));state.page=Math.max(1,Math.min(state.page,pages));
    state.rows.forEach(function(row){var index=matches.indexOf(row);row.hidden=index<0||index<(state.page-1)*state.size||index>=state.page*state.size;});
    var selected=state.rows.filter(function(row){var box=row.querySelector('.ody-td--check input[type="checkbox"]');return box&&box.checked;}).map(function(row){return row.dataset.odyRowId;});
    var summary=host.querySelector('[data-ody-table-summary]');if(summary)summary.textContent=O.i18n.t('table.summary',{count:matches.length,page:state.page,pages:pages},host);
    var selectedCount=host.querySelector('[data-ody-table-selected]');if(selectedCount)selectedCount.textContent=selected.length;
    var empty=table.querySelector('[data-ody-table-empty]');empty.hidden=matches.length>0;
    var pager=host.querySelector('[data-ody-table-pager],.ody-pager');
    if(pager){var focused=pager.contains(document.activeElement)?document.activeElement.dataset.odyPage:null;pager.textContent='';['prev'].concat(Array.from({length:pages},function(_,i){return String(i+1);}),'next').forEach(function(value){var button=document.createElement('button');button.type='button';button.dataset.odyPage=value;button.textContent=value==='prev'?O.i18n.t('common.previous',null,host):value==='next'?O.i18n.t('common.next',null,host):value;button.disabled=value==='prev'&&state.page===1||value==='next'&&state.page===pages;if(+value===state.page){button.className='is-current';button.setAttribute('aria-current','page');}pager.appendChild(button);});if(focused){var next=pager.querySelector('[data-ody-page="'+focused+'"]:not(:disabled)')||pager.querySelector('[aria-current="page"]');if(next)next.focus();}}
    syncSelectAll(table);
    host.dispatchEvent(new CustomEvent('ody:table-change',{bubbles:true,detail:{page:state.page,pages:pages,total:matches.length,selected:selected}}));
  }
  function initTable(host) {
    var table=host.matches('table')?host:host.querySelector('table');if(!table||!table.tBodies[0])return;
    var previous=host.__odyTable,rows=tableRows(table);
    rows.forEach(function(row,index){if(!row.dataset.odyRowId)row.dataset.odyRowId='row-'+(index+1);});
    host.__odyTable={table:table,rows:rows,page:previous?previous.page:1,size:Math.max(1,parseInt(host.dataset.pageSize,10)||10)};
    if(!table.querySelector('[data-ody-table-empty]')){
      var empty=document.createElement('tr');empty.className='ody-table__empty';empty.setAttribute('data-ody-table-empty','');var cell=document.createElement('td');cell.colSpan=table.rows[0]?table.rows[0].cells.length:1;cell.textContent=O.i18n.t('table.empty',null,host);empty.appendChild(cell);table.tBodies[0].appendChild(empty);
    }
    $all('th.ody-th--sort',table).forEach(function(th){th.tabIndex=0;if(!th.hasAttribute('aria-sort'))th.setAttribute('aria-sort','none');});tableRender(host);
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
    var host=tableHost(table);if(host&&host.__odyTable){host.__odyTable.rows=tableRows(table);host.__odyTable.page=1;tableRender(host);}
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
    var table=closestEl(cb,'table'),host=tableHost(table);if(host&&host.__odyTable)tableRender(host);else syncSelectAll(table);
  }
  function toggleSelectAll(master) {
    var table = closestEl(master, 'table'); if (!table) return;
    var tbody = table.tBodies[0]; if (!tbody) return;
    $all('.ody-td--check input[type="checkbox"]', tbody).forEach(function (cb) {
      if(cb.disabled||(tableHost(table)&&closestEl(cb,'tr').hidden))return;
      cb.checked = master.checked;
      var tr = closestEl(cb, 'tr'); if (tr) tr.classList.toggle('is-selected', master.checked);
    });
    master.indeterminate = false;
    var host=tableHost(table);if(host&&host.__odyTable)tableRender(host);
  }
  function syncSelectAll(table) {
    if (!table) return;
    var master = table.querySelector('.ody-th--check input[type="checkbox"]');
    if (!master) return;
    var boxes = $all('.ody-td--check input[type="checkbox"]', table.tBodies[0] || table);
    if(tableHost(table))boxes=boxes.filter(function(box){return !closestEl(box,'tr').hidden&&!box.disabled;});
    var checked = boxes.filter(function (b) { return b.checked; }).length;
    master.checked = checked > 0 && checked === boxes.length;
    master.indeterminate = checked > 0 && checked < boxes.length;
    if(tableHost(table))master.disabled=boxes.length===0;
  }

  /* --------------------------------------------------------- KANBAN DND */
  var dragCard=null, dragOrigin=null, dragDropped=false;
  function initKanban(root) {
    O.roots(root,'.ody-kanban__card').forEach(function(card){
      if(!card.hasAttribute('draggable'))card.setAttribute('draggable','true');
      if(!card.hasAttribute('tabindex'))card.tabIndex=0;
      if(card.querySelector('[data-ody-kanban-move]'))return;
      var board=closestEl(card,'.ody-kanban'),lists=$all('.ody-kanban__list',board),controls=document.createElement('div');controls.className='ody-kanban__actions ody-cluster ody-cluster--sm';
      var move=document.createElement('select');move.className='ody-select';move.setAttribute('data-ody-kanban-move','');move.setAttribute('aria-label',O.i18n.t('kanban.move',{name:(card.querySelector('.ody-kanban__card-title')||card).textContent.trim()},board));
      lists.forEach(function(list,index){var option=document.createElement('option'),col=closestEl(list,'.ody-kanban__col'),head=col.querySelector('.ody-kanban__head');option.value=index;option.textContent=head?head.childNodes.length?Array.prototype.filter.call(head.childNodes,function(node){return node.nodeType===3;}).map(function(node){return node.textContent;}).join('').trim()||O.i18n.t('kanban.column',{index:index+1},board):O.i18n.t('kanban.column',{index:index+1},board):O.i18n.t('kanban.column',{index:index+1},board);move.appendChild(option);});controls.appendChild(move);
      ['up','down'].forEach(function(direction){var button=document.createElement('button');button.type='button';button.className='ody-btn ody-btn--secondary ody-btn--sm';button.setAttribute('data-ody-kanban-'+direction,'');button.textContent=O.i18n.t(direction==='up'?'kanban.up':'kanban.down',null,board);controls.appendChild(button);});card.appendChild(controls);
      if(!board.querySelector('[data-ody-kanban-status]')){var status=document.createElement('p');status.setAttribute('data-ody-kanban-status','');status.setAttribute('role','status');status.className='ody-sr-only';board.appendChild(status);}
      kanbanSync(board);
    });
  }
  function kanbanSync(board){updateKanbanCounts(board);var lists=$all('.ody-kanban__list',board);lists.forEach(function(list,index){$all('.ody-kanban__card',list).forEach(function(card){var move=card.querySelector('[data-ody-kanban-move]');if(move)move.value=String(index);});});}
  function kanbanChanged(card){var board=closestEl(card,'.ody-kanban');kanbanSync(board);var lists=$all('.ody-kanban__list',board),list=card.parentElement,status=board.querySelector('[data-ody-kanban-status]'),detail={card:card,column:lists.indexOf(list),index:$all('.ody-kanban__card',list).indexOf(card)};if(status)status.textContent=O.i18n.t('kanban.moved',{name:(card.querySelector('.ody-kanban__card-title')||card).textContent.trim(),column:detail.column+1,position:detail.index+1},board);board.dispatchEvent(new CustomEvent('ody:kanban-change',{bubbles:true,detail:detail}));}
  function onDragStart(e) {
    var card=closestEl(e.target,'.ody-kanban__card');if(!card)return;
    if(closestEl(e.target,'button,select,input,a')){e.preventDefault();return;}
    dragCard=card;dragOrigin={parent:card.parentElement,next:card.nextSibling};dragDropped=false;card.classList.add('is-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} }
  }
  function onDragEnd() {
    if(dragCard&&!dragDropped&&dragOrigin){dragOrigin.parent.insertBefore(dragCard,dragOrigin.next&&dragOrigin.next.parentElement===dragOrigin.parent?dragOrigin.next:null);kanbanSync(closestEl(dragCard,'.ody-kanban'));}
    if (dragCard) dragCard.classList.remove('is-dragging');
    $all('.ody-kanban__list.is-over').forEach(function (l) { l.classList.remove('is-over'); });
    dragCard=null;dragOrigin=null;
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
    dragDropped=true;
    if(dragCard)kanbanChanged(dragCard);else updateKanbanCounts(closestEl(list,'.ody-kanban'));
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
    var t=e.target,pageButton=closestEl(t,'[data-ody-page]'),clear=closestEl(t,'[data-ody-table-clear]');
    if(pageButton){var host=closestEl(pageButton,'[data-ody-table]');if(host&&host.__odyTable){var state=host.__odyTable,value=pageButton.dataset.odyPage;state.page=value==='prev'?state.page-1:value==='next'?state.page+1:+value;tableRender(host);}return;}
    if(clear){var clearHost=closestEl(clear,'[data-ody-table]');$all('.ody-table__filter input',clearHost).forEach(function(input){input.value='';});clearHost.__odyTable.page=1;tableRender(clearHost);return;}
    var up=closestEl(t,'[data-ody-kanban-up]'),down=closestEl(t,'[data-ody-kanban-down]');
    if(up||down){var card=closestEl(up||down,'.ody-kanban__card'),list=card.parentElement,sibling=up?card.previousElementSibling:card.nextElementSibling;if(sibling){if(up)list.insertBefore(card,sibling);else list.insertBefore(sibling,card);kanbanChanged(card);}return;}
    var caretRow = closestEl(t, '.ody-tree__caret') ? closestEl(t, '.ody-tree__row') : null;
    var treeRow = caretRow || closestEl(t, '.ody-tree__row');
    if (treeRow) {
      var item = closestEl(treeRow, '.ody-tree__item');
      if(treeRow.getAttribute('aria-disabled')==='true')return;
      if (item && !item.classList.contains('is-leaf')) { e.preventDefault(); toggleTreeNode(treeRow); }
      selectTreeRow(closestEl(treeRow,'.ody-tree'),treeRow);
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
    var t=e.target,sort=closestEl(t,'th.ody-th--sort');
    if(sort&&(e.key==='Enter'||e.key===' ')&&!O.isComposing(e)){e.preventDefault();sortTable(sort);return;}
    var row = closestEl(t, '.ody-tree__row');
    if (row && !O.isComposing(e)) {
      var tree=closestEl(row,'.ody-tree'),item=closestEl(row,'.ody-tree__item'),visible=treeVisible(tree),index=visible.indexOf(row),target=null;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      else if(e.key==='ArrowDown')target=visible[Math.min(index+1,visible.length-1)];
      else if(e.key==='ArrowUp')target=visible[Math.max(index-1,0)];
      else if(e.key==='Home')target=visible[0];
      else if(e.key==='End')target=visible[visible.length-1];
      else if(e.key==='ArrowRight'){
        e.preventDefault();if(row.hasAttribute('aria-expanded')){if(row.getAttribute('aria-expanded')==='false')toggleTreeNode(row);else target=visible[index+1];}
      }else if(e.key==='ArrowLeft'){
        e.preventDefault();if(row.getAttribute('aria-expanded')==='true')toggleTreeNode(row);else{var parent=closestEl(item.parentElement,'.ody-tree__item');if(parent)target=treeRow(parent);}
      }else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
        clearTimeout(tree.__odyTypeTimer);tree.__odyType=(tree.__odyType||'')+e.key.toLocaleLowerCase(O.i18n.locale(tree));
        target=visible.slice(index+1).concat(visible.slice(0,index+1)).find(function(item){return (item.querySelector('.ody-tree__label')||item).textContent.trim().toLocaleLowerCase(O.i18n.locale(tree)).indexOf(tree.__odyType)===0;});
        tree.__odyTypeTimer=setTimeout(function(){tree.__odyType='';},500);
      }
      if(target){e.preventDefault();focusTreeRow(tree,target,true);}
    }
  }

  function initExt(root) {
    root = root || document;
    O.roots(root,'[data-ody-chart]').forEach(renderChart);
    O.roots(root,'[data-ody-table]').forEach(initTable);
    initTree(root);
    initKanban(root);
    $all('table[data-ody-select]', root).forEach(syncSelectAll);
  }

  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', onClick, false);
    document.addEventListener('input',function(event){var host=closestEl(event.target,'[data-ody-table]');if(host&&host.__odyTable&&event.target.matches('.ody-table__filter input')){host.__odyTable.page=1;tableRender(host);}},false);
    document.addEventListener('change',function(event){var move=closestEl(event.target,'[data-ody-kanban-move]');if(move){var card=closestEl(move,'.ody-kanban__card'),board=closestEl(card,'.ody-kanban'),lists=$all('.ody-kanban__list',board);if(lists[+move.value]){lists[+move.value].appendChild(card);kanbanChanged(card);move.focus();}}},false);
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
  O.updateChart = updateChart;
  O.describeChart = describeChart;
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
    O.registerLayer(node, node.__extLast);
    node.__extClose = onClose || null;
    node.hidden = false; node.removeAttribute('hidden');
    void node.offsetWidth;
    node.classList.add('is-open');
    extStack.push(node);
    lock();
  }
  function extClose(node) {
    if (!node || !node.classList.contains('is-open')) return;
    var shouldReturn = node.contains(document.activeElement) || document.activeElement === document.body;
    node.classList.remove('is-open');
    node.setAttribute('hidden', ''); node.hidden = true;
    extStack = extStack.filter(function (n) { return n !== node; });
    unlock();
    var last = node.__extLast; node.__extLast = null;
    O.releaseLayer(node, shouldReturn);
    if (node.__extClose) { var f = node.__extClose; node.__extClose = null; f(); }
  }
  function extTop() { var top = O.topLayer(); return extStack.indexOf(top) >= 0 ? top : null; }
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
    $('.ody-notif__item-close', item).setAttribute('aria-label',O.i18n.t('common.dismiss',null,panel));
    var main = $('.ody-notif__item-main', item);
    if (opts.title) { var t = el('div', 'ody-notif__item-title'); t.textContent = opts.title; main.appendChild(t); }
    if (opts.message) { var m = el('div', 'ody-notif__item-msg'); m.textContent = opts.message; main.appendChild(m); }
    if (opts.time) { var tm = el('div', 'ody-notif__item-time'); tm.textContent = opts.time; main.appendChild(tm); }
    if (opts.actions && opts.actions.length) {
      var wrap = el('div', 'ody-notif__actions');
      opts.actions.forEach(function (a) {
        var btn = el('button', 'ody-notif__action'); btn.type = 'button'; btn.textContent = a.label || O.i18n.t('common.action',null,panel);
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
    function syncValues(){var total=vert?pane.clientHeight:pane.clientWidth,current=vert?first.offsetHeight:first.offsetWidth;gutter.setAttribute('aria-orientation',vert?'horizontal':'vertical');gutter.setAttribute('aria-valuemin',String(min));gutter.setAttribute('aria-valuemax',String(Math.max(min,total-min-(vert?gutter.offsetHeight:gutter.offsetWidth))));gutter.setAttribute('aria-valuenow',String(Math.round(current)));}
    syncValues();
    function down(e) {
      e.preventDefault();
      pane.classList.add('is-dragging'); gutter.classList.add('is-dragging');
      on(document, 'pointermove', move); on(document, 'pointerup', up);
    }
    function move(e) {
      var r = pane.getBoundingClientRect();
      var pos = vert ? (e.clientY - r.top) : (e.clientX - r.left);
      var total = vert ? r.height : r.width;
      pos = Math.max(min, Math.min(pos, total - min - (vert ? gutter.offsetHeight : gutter.offsetWidth)));
      first.style.flex = '0 0 ' + pos + 'px';
      syncValues();
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
      else if (e.key === (vert ? 'ArrowDown' : 'ArrowRight')) { e.preventDefault(); first.style.flex = '0 0 ' + Math.min(total - min - (vert ? gutter.offsetHeight : gutter.offsetWidth), cur + step) + 'px'; }
      syncValues();
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
    if(dotsWrap)dotsWrap.removeAttribute('aria-hidden');
    if (dotsWrap && !dotsWrap.children.length) {
      slides.forEach(function (s, i) {
        var d = el('button', 'ody-carousel__dot'); d.type = 'button';
        d.setAttribute('aria-label', O.i18n.t('carousel.slide',{index:i+1},car));
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
  var confirmId=0;
  function confirm(opts) {
    opts = opts || {};
    var tone = opts.tone || 'info', context = opts.root || document.activeElement;
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
      var panel=$('.ody-confirm__panel',overlay), title=$('.ody-confirm__title',overlay), message=$('.ody-confirm__msg',overlay);
      var id='ody-confirm-'+(++confirmId);while(document.getElementById(id+'-title'))id='ody-confirm-'+(++confirmId);
      title.id=id+'-title';message.id=id+'-message';panel.setAttribute('aria-labelledby',title.id);
      if(opts.message)panel.setAttribute('aria-describedby',message.id);
      overlay.lang=O.i18n.locale(context);
      title.textContent = opts.title || O.i18n.t('confirm.title',null,context);
      $('.ody-confirm__msg', overlay).textContent = opts.message || '';
      if (!opts.message) $('.ody-confirm__msg', overlay).style.display = 'none';
      var cancelBtn = $('[data-act="cancel"]', overlay); cancelBtn.textContent = opts.cancelText || O.i18n.t('confirm.cancel',null,context);
      var okBtn = $('[data-act="ok"]', overlay); okBtn.textContent = opts.confirmText || O.i18n.t('confirm.confirm',null,context);
      document.body.appendChild(overlay);
      var result=false,settled=false;
      function complete(){if(settled)return;settled=true;resolve(result);overlay.remove();}
      function settle(val) { result=val;extClose(overlay); }
      on(cancelBtn, 'click', function () { settle(false); });
      on(okBtn, 'click', function () { settle(true); });
      on($('.ody-confirm__backdrop', overlay), 'click', function () { settle(false); });
      extOpen(overlay,complete);
      (tone==='danger'?cancelBtn:okBtn).focus();
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
      if (O.isComposing(e)) return;
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
    if (O.isComposing(e) || e.defaultPrevented || document.querySelector('dialog:modal')) return;
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
    O.roots(root,'.ody-sheet').forEach(function (s) { if (!s.classList.contains('is-open') && !s.hasAttribute('hidden')) s.setAttribute('hidden', ''); initSheetDrag(s); });
    O.roots(root,'.ody-cmdk').forEach(function (c) { if (!c.classList.contains('is-open') && !c.hasAttribute('hidden')) c.setAttribute('hidden', ''); });
    O.roots(root,'.ody-split-pane').forEach(initSplit);
    O.roots(root,'[data-ody-carousel]').forEach(initCarousel);
    O.roots(root,'.ody-notif').forEach(notifSync);
    O.roots(root,'[data-ody-editable]').forEach(function (ed) {
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

/*! odyssey-canary v1.3.0-canary.1 · public shell/profile enhancement */
(function (window, document) {
  'use strict';
  var Odyssey = window.Odyssey;
  if (!Odyssey || Odyssey.canary) return;

  var RELEASE = '1.3.0-canary.1';
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
