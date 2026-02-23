#!/usr/bin/env node
// Script para corregir módulos ESM en ng-packagr
const fs = require('fs');
const path = require('path');

const fixes = [
  {
    module: 'find-cache-directory',
    wrapper: path.join(__dirname, '../node_modules/find-cache-directory-fallback/index.js'),
    target: path.join(__dirname, '../node_modules/find-cache-directory/index.js'),
    packageJson: path.join(__dirname, '../node_modules/find-cache-directory/package.json')
  },
  {
    module: 'ora',
    wrapper: path.join(__dirname, '../node_modules/ora-fallback/index.js'),
    target: path.join(__dirname, '../node_modules/ora/index.js'),
    packageJson: path.join(__dirname, '../node_modules/ora/package.json')
  }
];

fixes.forEach(({ wrapper, target, packageJson }) => {
  try {
    // Copiar wrapper si existe
    if (fs.existsSync(wrapper) && fs.existsSync(target)) {
      fs.copyFileSync(wrapper, target);
    }
    
    // Corregir package.json
    if (fs.existsSync(packageJson)) {
      let pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (pkg.type === 'module') {
        pkg.type = 'commonjs';
        fs.writeFileSync(packageJson, JSON.stringify(pkg, null, 2) + '\n');
      }
    }
  } catch (e) {
    // Ignorar errores silenciosamente
  }
});

console.log('✅ ng-packagr ESM fixes aplicados');
