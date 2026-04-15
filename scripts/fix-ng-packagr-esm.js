#!/usr/bin/env node
// Script para corregir módulos ESM en ng-packagr
const fs = require('fs');
const path = require('path');

// Fix 1: find-cache-directory — convertir a CJS
const findCacheDir = path.join(__dirname, '../node_modules/find-cache-directory/index.js');
const findCacheDirPkg = path.join(__dirname, '../node_modules/find-cache-directory/package.json');
try {
  if (fs.existsSync(findCacheDir)) {
    const content = fs.readFileSync(findCacheDir, 'utf8');
    if (content.startsWith('import ')) {
      fs.writeFileSync(findCacheDir, `'use strict';
const process = require('node:process');
const path = require('node:path');
const fs = require('node:fs');
const commonPathPrefix = require('common-path-prefix');
const { packageDirectorySync } = require('pkg-dir');

const { env, cwd } = process;

const isWritable = p => {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; }
};

function useDirectory(directory, options) {
  if (options.create) fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function getNodeModuleDirectory(directory) {
  const nodeModules = path.join(directory, 'node_modules');
  if (!isWritable(nodeModules) && (fs.existsSync(nodeModules) || !isWritable(path.join(directory)))) return;
  return nodeModules;
}

module.exports = function findCacheDirectory(options = {}) {
  if (env.CACHE_DIR && !['true', 'false', '1', '0'].includes(env.CACHE_DIR))
    return useDirectory(path.join(env.CACHE_DIR, options.name), options);
  let { cwd: directory = cwd(), files } = options;
  if (files) {
    if (!Array.isArray(files)) throw new TypeError('Expected files to be an array');
    directory = commonPathPrefix(files.map(file => path.resolve(directory, file)));
  }
  directory = packageDirectorySync({ cwd: directory });
  if (!directory) return;
  const nodeModules = getNodeModuleDirectory(directory);
  if (!nodeModules) return;
  return useDirectory(path.join(directory, 'node_modules', '.cache', options.name), options);
};
`);
    }
  }
  if (fs.existsSync(findCacheDirPkg)) {
    let pkg = JSON.parse(fs.readFileSync(findCacheDirPkg, 'utf8'));
    if (pkg.type === 'module') { pkg.type = 'commonjs'; fs.writeFileSync(findCacheDirPkg, JSON.stringify(pkg, null, 2) + '\n'); }
  }
} catch (e) { console.warn('find-cache-directory fix failed:', e.message); }

// Fix 2: ora — reemplazar con stub CJS
const oraIndex = path.join(__dirname, '../node_modules/ora/index.js');
const oraPkg = path.join(__dirname, '../node_modules/ora/package.json');
try {
  if (fs.existsSync(oraIndex)) {
    const content = fs.readFileSync(oraIndex, 'utf8');
    if (content.startsWith('import ')) {
      fs.writeFileSync(oraIndex, `'use strict';
class Ora {
  constructor(o) { this.text = typeof o === 'string' ? o : (o && o.text) || ''; this.isSpinning = false; }
  start(t) { if (t) this.text = t; this.isSpinning = true; return this; }
  stop() { this.isSpinning = false; return this; }
  succeed(t) { if (t) this.text = t; this.isSpinning = false; return this; }
  fail(t) { if (t) this.text = t; this.isSpinning = false; return this; }
  warn(t) { if (t) this.text = t; return this; }
  info(t) { if (t) this.text = t; return this; }
  stopAndPersist() { this.isSpinning = false; return this; }
  clear() { return this; }
  render() { return this; }
  frame() { return ''; }
}
module.exports = o => new Ora(o);
module.exports.default = module.exports;
module.exports.oraPromise = async (action, options) => {
  const s = new Ora(options); s.start();
  try { const r = await (typeof action === 'function' ? action(s) : action); s.succeed(); return r; }
  catch (e) { s.fail(); throw e; }
};
`);
    }
  }
  if (fs.existsSync(oraPkg)) {
    let pkg = JSON.parse(fs.readFileSync(oraPkg, 'utf8'));
    if (pkg.type === 'module') { pkg.type = 'commonjs'; fs.writeFileSync(oraPkg, JSON.stringify(pkg, null, 2) + '\n'); }
  }
} catch (e) { console.warn('ora fix failed:', e.message); }

console.log('✅ ng-packagr ESM fixes aplicados');
