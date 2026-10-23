const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBuiltModuleLoader(obsidian) {
  const cache = new Map();

  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);

    const localRequire = request => {
      if (request === 'obsidian') return obsidian;
      const dependency = path.resolve(path.dirname(filename), request);
      return load(dependency.endsWith('.js') ? dependency : `${dependency}.js`);
    };

    const source = fs.readFileSync(filename, 'utf8');
    const initialize = vm.runInNewContext(`(function(module,exports,require){${source}\n})`, {});
    initialize(module, module.exports, localRequire);
    return module.exports;
  }

  return modulePath => load(path.resolve(__dirname, '../../.build', modulePath));
}

module.exports = { createBuiltModuleLoader };
