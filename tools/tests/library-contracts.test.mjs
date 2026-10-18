import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkDesign, toPencil} from '../design-tokens.mjs';
import Ajv from '../browser-runtime/node_modules/ajv/dist/2020.js';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const json = async path => JSON.parse(await read(path));
const [manifest, schema, contracts, map, tokens, fixture] = await Promise.all(['library/capabilities.json','library/capabilities.schema.json','library/contracts.json','design/design-map.json','design/tokens.json','library/fixtures.json'].map(json));
const validate = new Ajv({allErrors:true, strict:false}).compile(schema);
assert.ok(validate(manifest), JSON.stringify(validate.errors));
assert.equal(manifest.components.length, 82);
assert.equal(new Set(manifest.components.map(c => c.id)).size, 82);
const index = await read('site/index.html');
const stations = [...index.matchAll(/data-station="([A-Z]+)"/g)].map(match => match[1]);
assert.equal(stations.length, 54);
assert.deepEqual(manifest.components.filter(c => c.station).map(c => c.station), stations);
const rust = (await Promise.all(['src/controls.rs','src/data.rs','src/feedback.rs','src/shell.rs'].map(read))).join('\n');
const release = await json('releases/1.4.0/release.json');
const assets = new Set((Array.isArray(release.files) ? release.files.map(f => typeof f === 'string' ? f : f.path) : Object.keys(release.files || release.assets || {})).map(path => path.split('/').pop()));
for (const component of manifest.components) {
  for (const key of ['html','guide']) {
    const [path, anchor] = component[key].split('#');
    const content = await read(path);
    if (anchor) assert.ok(content.includes('id="' + anchor + '"'), component.id + ' missing ' + component[key]);
  }
  for (const test of component.tests) await read(test.path);
  for (const helper of component.rust) assert.match(rust, new RegExp('pub fn ' + helper + '\\b'), component.id);
  for (const asset of [...component.assets.css, ...component.assets.js]) assert.ok(assets.has(asset), component.id + ': release omits ' + asset);
  const contract = contracts.components[component.id.slice(4)];
  assert.ok(contract && contract.runtime === component.runtime, component.id + ': contract drift');
  if (component.station) assert.equal(component.design.nodeId, map.components.find(c => c.station === component.station)?.pencilNodeId);
  if (!component.station) assert.ok(index.includes('data-search="' + component.id + ' '), component.id + ': not searchable');
}
assert.equal(contracts.components['tree'].rustParity, 'html-only-intentional');
assert.equal(contracts.components['file-dropzone'].value.includes('FormData'), true);
assert.equal(fixture.file.variants.length, 2);
console.log('PASS manifest: schema, 82 unique capabilities, 54 station/design bindings, HTML/Rust/guide/test/asset inventory and runtime parity.');
console.log('PASS design:', await checkDesign());
const broken = structuredClone(tokens);
broken.pencil.ink.base.$value = '{pencil.ink.base}';
assert.throws(() => toPencil(broken), /Circular token alias/);
broken.pencil.ink.base.$value = '{pencil.space-1.base}';
assert.throws(() => toPencil(broken), /Alias type mismatch/);

if (process.env.ODYSSEY_BASE_URL) {
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../browser-runtime/node_modules/playwright/index.mjs');
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(process.env.ODYSSEY_BASE_URL);
    await page.locator('#station-search').fill('Multi-select');
    assert.equal(await page.locator('[data-capability]:visible').count(), 1);
    assert.equal(await page.locator('#station-empty').isVisible(), false);
    assert.match(await page.locator('[data-capability]:visible').innerText(), /Multi-select/);
    await page.locator('#station-search').fill('');
    for (const expression of map.themes.expression) for (const mode of map.themes.mode) {
      const actual = await page.evaluate(({expression, mode, bindings}) => {
        document.documentElement.dataset.expression = expression;
        document.documentElement.dataset.theme = mode;
        const computed = getComputedStyle(document.documentElement);
        return Object.fromEntries(bindings.map(binding => [binding.pencilVariable, computed.getPropertyValue(binding.cssProperty).trim()]));
      }, {expression,mode,bindings:map.tokenBindings});
      for (const binding of map.tokenBindings) {
        const options = Object.values(tokens.pencil[binding.pencilVariable]);
        const token = options.find(t => {
          const theme = t.$extensions['xyz.w33d.odyssey'].theme;
          return (!theme.expression || theme.expression === expression) && (!theme.mode || theme.mode === mode);
        });
        assert.ok(token, binding.pencilVariable);
        const value = token.$value;
        let expected = token.$type === 'color' ? value.hex : token.$type === 'dimension' || token.$type === 'duration' ? value.value + value.unit : value;
        let observed = actual[binding.pencilVariable];
        if (token.$type === 'fontFamily') observed = observed.split(',')[0].replaceAll('"','');
        if (token.$type === 'color' && /^#[0-9a-f]{3}$/i.test(observed)) observed = '#' + observed.slice(1).split('').map(c => c + c).join('');
        assert.equal(observed.toLowerCase(), String(expected).toLowerCase(), expression + '/' + mode + ' ' + binding.pencilVariable);
      }
    }
    // Both old and enhanced file entry points consume exactly the same declared fixture.
    const outcomes = [];
    for (const variant of fixture.file.variants) {
      outcomes.push(await page.evaluate(({variant, file}) => {
        const form = document.createElement('form');
        form.innerHTML = variant.markup; document.body.append(form);
        window.Odyssey.init(form); window.Odyssey.init(form);
        const transfer = new DataTransfer();
        transfer.items.add(new File([file.content], file.name, {type:file.type}));
        const zone = form.querySelector(variant.name === 'public' ? '[data-ody-dropzone]' : '[data-ody-file-dropzone]');
        zone.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:transfer}));
        const result = new FormData(form).get(file.field);
        const outcome = {name:result.name, type:result.type, size:result.size};
        form.remove(); return outcome;
      }, {variant,file:fixture.file}));
    }
    assert.deepEqual(outcomes[0], outcomes[1]);
    assert.equal(outcomes[0].name, fixture.file.name);
    assert.equal(outcomes[0].size, fixture.file.content.length);
    console.log('PASS consumption: extra capability search, 48 token bindings × 8 themes, old/enhanced shared FormData fixture.');
  } finally { await browser.close(); }
}
