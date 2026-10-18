(function () {
'use strict';
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const root = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let currentView = 'overview';
let toastCount = 0;
let undoArchive = null;

document.addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, true);
document.addEventListener('keydown', () => { root.dataset.input = 'keyboard'; }, true);

function updateMotionStatus() {
  $('#motion-status').textContent = $('#reduce').checked || motionPreference.matches
    ? 'Reduced motion active · states change instantly.'
    : 'System motion preference respected.';
}
$('#reduce').addEventListener('change', event => {
  root.toggleAttribute('data-reduced-motion', event.target.checked);
  updateMotionStatus();
});
motionPreference.addEventListener('change', updateMotionStatus);

document.addEventListener('ody:expression', () => { $('#expression-name').textContent = root.dataset.expression.toUpperCase(); updateIndicator(false); });
$('#theme').addEventListener('click', () => {
  const dark = root.dataset.theme !== 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  $('#theme').setAttribute('aria-pressed', String(dark));
});

function updateIndicator(animate) {
  const button = $('#tab-' + currentView);
  const indicator = $('#tab-indicator');
  indicator.style.transitionDuration = animate && root.dataset.input !== 'keyboard' ? '' : '0ms';
  indicator.style.width = button.offsetWidth + 'px';
  indicator.style.transform = 'translateX(' + button.offsetLeft + 'px)';
}
function setView(view, keyboard = false) {
  currentView = view;
  $$('[role=tab]').forEach(tab => {
    const active = tab.id === 'tab-' + view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $('#' + tab.getAttribute('aria-controls')).hidden = !active;
  });
  $$('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  updateIndicator(!keyboard);
}
$$('[role=tab]').forEach((tab, index, tabs) => {
  tab.addEventListener('click', () => setView(tab.getAttribute('aria-controls')));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === 'Home') target = tabs[0];
    if (event.key === 'End') target = tabs[tabs.length - 1];
    if (target) { event.preventDefault(); setView(target.getAttribute('aria-controls'), true); target.focus(); }
  });
});
$$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
window.addEventListener('resize', () => { updateIndicator(false); positionEnvironment(); });
document.fonts.ready.then(() => updateIndicator(false));

function notify(title, message, undo = null) {
  const toast = $('#toast');
  $('#toast-title').textContent = title;
  $('#toast-message').textContent = message;
  undoArchive = undo;
  $('#undo').hidden = !undo;
  toast.inert = false;
  toast.setAttribute('data-open', '');
}
function dismissToast() {
  const toast = $('#toast');
  if (toast.contains(document.activeElement)) $('#save').focus();
  toast.removeAttribute('data-open');
  toast.inert = true;
  undoArchive = null;
}
$('#toast-close').addEventListener('click', dismissToast);
$('#undo').addEventListener('click', () => {
  if (undoArchive) undoArchive();
  notify('Artifacts restored', 'Your local selection is available again.');
});
function saveDraft() {
  $('#saved-state').textContent = 'Saved in this session';
  notify('Draft saved', $('#project-name').value.trim() + ' · component example only.');
}
$('#save').addEventListener('click', saveDraft);
$('#project-name').addEventListener('input', () => { $('#saved-state').textContent = 'Unsaved component example'; });

function openDialog(id) {
  const dialog = $('#' + id);
  if (id === 'review') {
    $('#review-project').textContent = $('#project-name').value.trim() || 'Untitled project';
    $('#review-environment').textContent = $('#environment-trigger').firstChild.textContent.trim();
    $('#review-artifacts').textContent = $$('.asset-list label').filter(label => !label.hidden).length + ' prepared';
  }
  if (id === 'commands') { window.OdysseyExtensions.openCommand(dialog); return; }
  if (!dialog.open) dialog.showModal();
 
}
$$('[data-open]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.open === 'environment') {
    $('#environment-trigger').scrollIntoView({block: 'center', behavior: 'instant'});
    $('#environment').showPopover();
  } else openDialog(button.dataset.open);
}));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
}));
$('#confirm-save').addEventListener('click', () => { $('#confirm').close(); saveDraft(); });
$('#review-save').addEventListener('click', () => { $('#review').close(); notify('Review saved', 'Ready in this session. No deployment was requested.'); });
$('#nav-settings').addEventListener('click', () => { $('#theme').focus(); notify('Preview settings', 'Expression, theme and motion controls are above the console.'); });

function positionEnvironment() {
  const box = $('#environment-trigger').getBoundingClientRect();
  const panel = $('#environment');
  panel.style.left = Math.max(12, Math.min(box.left, innerWidth - 252)) + 'px';
  panel.style.top = Math.min(box.bottom + 8, innerHeight - 230) + 'px';
}
$('#environment').addEventListener('beforetoggle', event => {
  if (event.newState === 'open') positionEnvironment();
});
$$('[data-environment]').forEach(button => button.addEventListener('click', () => {
  $('#environment-trigger').firstChild.textContent = button.dataset.environment + ' ';
  $$('[data-environment]').forEach(item => {
    const selected = item === button;
    item.setAttribute('aria-pressed', String(selected));
    $('span', item).textContent = selected ? '✓' : '';
  });
  $('#environment').hidePopover();
  $('#environment-trigger').focus();
}));

document.addEventListener('ody:command', event => {
  const action = event.detail.action;
  if (action === 'review' || action === 'confirm') openDialog(action);
  else { setView(action, true); $('#tab-' + action).focus(); }
});

$$('[data-file]').forEach(button => button.addEventListener('click', () => {
  $$('[data-file]').forEach(item => item.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'page');
  $('#current-file').textContent = button.dataset.file.toUpperCase();
}));
function updateSelection() {
  const count = $$('input[name=asset]:checked').length;
  $('#selection-count').textContent = count + ' selected';
  $('#selection-toolbar').hidden = count === 0;
}
$$('input[name=asset]').forEach(input => input.addEventListener('change', updateSelection));
$('#clear-selection').addEventListener('click', () => { $$('input[name=asset]').forEach(input => { input.checked = false; }); $('#save').focus(); updateSelection(); });
$('#archive').addEventListener('click', () => {
  const labels = $$('input[name=asset]:checked').map(input => input.closest('label'));
  labels.forEach(label => { $('input', label).checked = false; label.hidden = true; });
  $('#save').focus(); updateSelection();
  notify(labels.length + ' artifacts archived', 'Component example only. You can undo this change.', () => labels.forEach(label => { label.hidden = false; }));
});
$('#create-draft').addEventListener('click', () => { setView('overview'); $('#project-name').focus(); $('#project-name').select(); notify('New draft ready', 'Edit the project name to get started.'); });

$$('[data-demo]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.demo;
  if (action === 'press') { setView('overview'); $('#save').scrollIntoView({block:'center'}); $('#save').focus(); saveDraft(); }
  if (action === 'switch') { setView('overview'); $('#auto-release').checked = !$('#auto-release').checked; $('#auto-release').scrollIntoView({block:'center'}); }
  if (action === 'toast') { toastCount++; notify('Changes saved · ' + toastCount, 'Repeat this action. The same surface updates in place.'); }
  if (action === 'accordion') { setView('overview'); const detail = $('.accordion'); detail.open = !detail.open; detail.scrollIntoView({block:'center'}); }
  if (action === 'tabs') { setView(currentView === 'activity' ? 'overview' : 'activity'); $('.tabs').scrollIntoView({block:'center'}); }
}));
updateMotionStatus();
$('#expression-name').textContent = root.dataset.expression.toUpperCase();
updateIndicator(false);
if (location.hash === '#tab-drafts') setView('drafts', true);

}());
