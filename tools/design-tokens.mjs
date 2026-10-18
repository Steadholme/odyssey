import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
export function toPencil(exchange) {
  const variables = {};
  const resolve = (token, seen = new Set()) => {
    assert.ok(token && token.$type && '$value' in token, 'Typed token required');
    const value = token.$value;
    if (typeof value === 'string' && /^\{.*\}$/.test(value)) {
      const path = value.slice(1, -1);
      assert.ok(!seen.has(path), 'Circular token alias: ' + path);
      const target = path.split('.').reduce((node, key) => node?.[key], exchange);
      assert.equal(target?.$type, token.$type, 'Alias type mismatch: ' + path);
      return resolve(target, new Set([...seen, path]));
    }
    switch (token.$type) {
      case 'color': {
        assert.equal(value.colorSpace, 'srgb');
        assert.equal(value.components.length, 3);
        assert.ok(value.components.every(n => Number.isFinite(n) && n >= 0 && n <= 1));
        assert.ok(value.alpha >= 0 && value.alpha <= 1);
        const hex = '#' + value.components.map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('') + (value.alpha === 1 ? '' : Math.round(value.alpha * 255).toString(16).padStart(2, '0'));
        if (value.hex) assert.equal(value.hex.toLowerCase(), hex, 'Color hex/components differ');
        return hex.toUpperCase();
      }
      case 'dimension': assert.equal(value.unit, 'px'); assert.ok(Number.isFinite(value.value)); return value.value;
      case 'duration': assert.equal(value.unit, 'ms'); assert.ok(value.value >= 0); return value.value;
      case 'number': assert.ok(Number.isFinite(value)); return value;
      case 'fontFamily': assert.equal(typeof value, 'string'); return value;
      case 'cubicBezier':
        assert.equal(value.length, 4); assert.ok(value.every(Number.isFinite));
        assert.ok(value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1);
        return 'cubic-bezier(' + value.join(',') + ')';
      default: throw new Error('Unsupported exchange type: ' + token.$type);
    }
  };
  for (const [name, variants] of Object.entries(exchange.pencil)) {
    assert.ok(!name.startsWith('$') && !name.includes('.'), 'Invalid variable name');
    const entries = Object.values(variants).map(token => {
      const meta = token.$extensions['xyz.w33d.odyssey'];
      assert.equal(meta.pencilVariable, name);
      return {type: meta.pencilType, value: resolve(token), theme: meta.theme};
    });
    assert.ok(entries.length);
    assert.ok(entries.every(entry => entry.type === entries[0].type));
    assert.ok(['number', 'string', 'color'].includes(entries[0].type));
    assert.equal(new Set(entries.map(entry => JSON.stringify(entry.theme))).size, entries.length, 'Duplicate token mode');
    variables[name] = {type: entries[0].type, value: entries.length === 1 && Object.keys(entries[0].theme).length === 0 ? entries[0].value : entries.map(({value, theme}) => ({value, theme}))};
  }
  return {variables, themes: exchange.$extensions['xyz.w33d.odyssey'].themes};
}

export async function checkDesign() {
  const [tokens, snapshot, mapping] = await Promise.all([read('design/tokens.json'), read('design/pencil-export.json'), read('design/design-map.json')]);
  const roundtrip = toPencil(tokens);
  const normalize = value => JSON.stringify(value).toLowerCase().replace(/\(\./g, '(0.').replace(/,\./g, ',0.');
  assert.equal(normalize(roundtrip), normalize({variables: snapshot.variables, themes: snapshot.themes}), 'Pencil exchange roundtrip drift');
  assert.equal(Object.keys(snapshot.variables).length, 208, '207 original variables plus control boundary');
  assert.equal(mapping.components.length, 54);
  assert.equal(new Set(mapping.components.map(c => c.pencilNodeId)).size, 54);
  for (const component of mapping.components) {
    const saved = snapshot.components.find(node => node.id === component.pencilNodeId);
    assert.ok(saved && saved.name === component.name, 'Pencil component identity drift: ' + component.station);
  }
  for (const binding of mapping.tokenBindings) {
    assert.ok(tokens.pencil[binding.pencilVariable], binding.pencilVariable);
    assert.match(binding.cssProperty, /^--ody-[a-z0-9-]+$/);
    const sources = await Promise.all(binding.sources.map(path => readFile(new URL(path, root), 'utf8')));
    assert.ok(sources.some(css => css.includes(binding.cssProperty + ':')), 'CSS property missing: ' + binding.cssProperty);
  }
  return {variables: 208, nodes: 54, bindings: mapping.tokenBindings.length};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--import') {
    const exchange = JSON.parse(await readFile(process.argv[3], 'utf8'));
    process.stdout.write(JSON.stringify(toPencil(exchange), null, 2) + '\n');
  } else if (process.argv[2] === '--diff') {
    const incoming = JSON.parse(await readFile(process.argv[3], 'utf8'));
    const expected = await read('design/pencil-export.json');
    const changed = [...new Set([...Object.keys(expected.variables), ...Object.keys(incoming.variables)])].filter(name => JSON.stringify(expected.variables[name]) !== JSON.stringify(incoming.variables[name]));
    console.log(JSON.stringify({changed, themesChanged: JSON.stringify(expected.themes) !== JSON.stringify(incoming.themes)}));
    if (changed.length || JSON.stringify(expected.themes) !== JSON.stringify(incoming.themes)) process.exitCode = 1;
  } else {
    console.log('PASS design exchange:', await checkDesign());
  }
}
