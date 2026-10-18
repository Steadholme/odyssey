/* Documentation specimens only. Product interactions remain in the existing Odyssey runtime. */
(function () {
  'use strict';
  var search = document.getElementById('station-search');
  var stations = Array.from(document.querySelectorAll('[data-station]'));
  if (search) search.addEventListener('input', function () {
    var query = search.value.trim().toLowerCase();
    var count = 0;
    stations.forEach(function (station) {
      station.hidden = !station.getAttribute('data-search').toLowerCase().includes(query);
      if (!station.hidden) count += 1;
    });
    document.querySelectorAll('[data-family]').forEach(function (family) {
      family.hidden = !family.querySelector('[data-station]:not([hidden])');
    });
    document.getElementById('station-count').textContent = count + (count === 1 ? ' STATION' : ' STATIONS');
    document.getElementById('station-empty').hidden = count > 0;
  });
  var activeToast;
  document.addEventListener('click', function (event) {
    var toast = event.target.closest('[data-line-toast]');
    if (toast && window.Odyssey) {
      if (activeToast) { activeToast.dismiss(); activeToast.el.remove(); }
      activeToast = window.Odyssey.toast({ title: toast.getAttribute('data-line-toast'), timeout: 6000, tone: 'ok' });
    }
    var copy = event.target.closest('[data-line-copy]');
    if (copy) {
      var code = copy.parentElement.querySelector('code').textContent;
      var status = document.getElementById('line-copy-status');
      if (!navigator.clipboard) { status.textContent = 'Clipboard unavailable. Select and copy the source.'; return; }
      navigator.clipboard.writeText(code).then(function () {
        copy.textContent = 'Copied'; status.textContent = 'Source copied.';
        setTimeout(function () { copy.textContent = 'Copy source'; }, 1800);
      }, function () { status.textContent = 'Copy failed. Select and copy the source.'; });
    }
    var page = event.target.closest('[data-line-page]');
    if (page) {
      var pager = page.closest('.ody-pager');
      var current = pager.querySelector('[aria-current="page"]');
      var value = page.getAttribute('data-line-page');
      var next = value === 'prev' ? Math.max(1, Number(current.textContent) - 1) : value === 'next' ? Math.min(3, Number(current.textContent) + 1) : Number(value);
      current.removeAttribute('aria-current');
      pager.querySelector('[data-line-page="' + next + '"]').setAttribute('aria-current', 'page');
      pager.parentElement.querySelector('[data-line-page-label]').textContent = 'PAGE ' + next + ' OF 3';
    }
  });
  var validation = document.getElementById('line-validation');
  if (validation) validation.addEventListener('submit', function (event) {
    event.preventDefault();
    var input = validation.elements.email;
    var valid = input.validity.valid;
    input.setAttribute('aria-invalid', String(!valid));
    var hint = document.getElementById('validation-hint');
    hint.textContent = valid ? 'The email is valid.' : 'Enter a valid email address.';
    hint.className = valid ? 'ody-hint' : 'ody-error';
    document.getElementById('validation-status').textContent = valid ? 'Field validated.' : 'Check the email field.';
    if (!valid) input.focus();
  });
}());
