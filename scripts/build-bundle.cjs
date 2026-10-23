const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createBundle } = require('./bundle-runtime.cjs');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const buildDirectory = path.join(root, '.build');

function loadTypeScript() {
  try {
    return require('typescript');
  } catch {
    const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(path.join(globalModules, 'typescript'));
  }
}

function cleanBuildDirectory() {
  const isExpectedDirectory = path.relative(root, buildDirectory) === '.build';
  const isSymbolicLink = fs.existsSync(buildDirectory) && fs.lstatSync(buildDirectory).isSymbolicLink();

  if (!isExpectedDirectory || isSymbolicLink) {
    throw new Error('Refusing to clean an unexpected build directory.');
  }

  fs.rmSync(buildDirectory, { recursive: true, force: true });
}

function collectTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(filename);
    return entry.name.endsWith('.ts') ? [filename] : [];
  });
}

function transpileModule(typescript, filename) {
  const id = path.relative(sourceRoot, filename).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  const source = fs.readFileSync(filename, 'utf8');

  const { outputText } = typescript.transpileModule(source, {
    fileName: filename,

    compilerOptions: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.CommonJS,
      esModuleInterop: true
    }
  });

  const outputPath = path.join(buildDirectory, id);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outputText);

  return { id, code: outputText };
}

function build() {
  const typescript = loadTypeScript();
  cleanBuildDirectory();

  const modules = collectTypeScriptFiles(sourceRoot).map(filename => transpileModule(typescript, filename));
  const bundle = createBundle(modules);

  fs.writeFileSync(path.join(root, 'main.js'), bundle);
  console.log(`Built main.js (${Buffer.byteLength(bundle)} bytes) from ${modules.length} TypeScript modules`);
}

build();
