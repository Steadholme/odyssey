/* The reference page is a consumer of the optional library and example adapters. */
(function () {
  'use strict';
  window.OdysseyWorkflowExamples.mount(document);
  var theme = document.querySelector('#wf-theme');
  theme.value = document.documentElement.dataset.theme || 'light';
  theme.addEventListener('change', function () { window.Odyssey.setTheme(theme.value); });
}());
