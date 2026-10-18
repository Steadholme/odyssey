(function () {
  'use strict';
  var root = document.documentElement;
  var search = document.getElementById('states-search');
  var rows = Array.from(document.querySelectorAll('[data-state-component]'));
  var inventory = document.getElementById('states-inventory');
  function filter() {
    var query = search.value.trim().toLowerCase();
    rows.forEach(function (row) { row.hidden = !row.dataset.stateComponent.includes(query); });
    var count = rows.filter(function (row) { return !row.hidden; }).length;
    document.getElementById('states-count').textContent = count + ' component contracts';
    if (query) inventory.open = true;
  }
  search.addEventListener('input', filter);
  filter();
  document.getElementById('states-density').addEventListener('change', function (event) { root.dataset.density = event.target.value; });
  document.querySelector('[data-states-feedback]').addEventListener('click', function () { document.getElementById('states-feedback').textContent = 'Changes applied to this example.'; });
  function measure() {
    document.querySelectorAll('[data-state-metric]').forEach(function (output) {
      output.textContent = Math.round(document.getElementById(output.dataset.stateMetric).getBoundingClientRect().height) + 'px';
    });
    var computed = getComputedStyle(root);
    document.getElementById('states-spacing').textContent = Array.from({length:8}, function (_, index) { return computed.getPropertyValue('--ody-sp-' + (index + 1)).trim(); }).join(' · ');
  }
  var observer = new MutationObserver(function () { requestAnimationFrame(measure); });
  observer.observe(root, {attributes:true, attributeFilter:['data-expression','data-theme','data-density']});
  window.addEventListener('resize', measure);
  document.fonts.ready.then(measure);
}());
