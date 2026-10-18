/* Guide-only search; product state remains in Odyssey's component runtimes. */
(function () {
  'use strict';
  var search = document.getElementById('station-search');
  var entries = Array.from(document.querySelectorAll('[data-capability]'));
  if (!search || !entries.length) return;
  function update() {
    var query = search.value.trim().toLowerCase();
    entries.forEach(function (entry) {
      entry.hidden = !entry.getAttribute('data-search').toLowerCase().includes(query);
    });
    var count = entries.filter(function (entry) { return !entry.hidden; }).length;
    document.getElementById('capability-count').textContent = count + ' GUIDE CAPABILITIES';
    document.getElementById('capability-catalog').hidden = count === 0;
    document.getElementById('station-empty').hidden = count > 0 || !!document.querySelector('[data-station]:not([hidden])');
  }
  search.addEventListener('input', update);
  update();
}());
