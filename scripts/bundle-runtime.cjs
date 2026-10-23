function loadPlugin(modules) {
  const cache = Object.create(null);

  function resolveModule(request, parent) {
    const segments = parent.split('/');
    segments.pop();

    for (const segment of request.replace(/\\/g, '/').split('/')) {
      if (segment === '..') segments.pop();
      else if (segment !== '.') segments.push(segment);
    }

    const resolved = segments.join('/');
    return resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  }

  function loadModule(request, parent) {
    if (request === 'obsidian') return require('obsidian');
    if (!request.startsWith('.')) throw new Error(`Unknown external dependency: ${request}`);

    const id = resolveModule(request, parent);
    if (!Object.prototype.hasOwnProperty.call(modules, id)) throw new Error(`Unknown module: ${id}`);

    if (!cache[id]) {
      const module = { exports: {} };
      cache[id] = module;
      modules[id](module, module.exports, dependency => loadModule(dependency, id));
    }

    return cache[id].exports;
  }

  return loadModule('./main', 'entry.js').default;
}

const BUNDLE_HEADER = ["'use strict';", '// Build output. Do not edit: change src/ and run npm run build.'].join('\n');

function createModuleRegistry(modules) {
  const entries = modules.map(({ id, code }) => {
    const factory = ['function(module, exports, require) {', code, '}'].join('\n');
    return `${JSON.stringify(id)}: ${factory}`;
  });

  return ['{', entries.join(',\n'), '}'].join('\n');
}

function createBundle(modules) {
  const runtime = loadPlugin.toString();
  const registry = createModuleRegistry(modules);
  const entryPoint = `module.exports = (${runtime})(${registry});`;

  return [BUNDLE_HEADER, entryPoint, ''].join('\n');
}

module.exports = { createBundle };
