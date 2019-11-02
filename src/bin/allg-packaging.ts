#!/usr/bin/env node

import {existsSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';
import {compare} from 'compare-versions';

const packageJson = 'package.json';


function findPackageJson(_dirname: string) {
  let packageJsonPath = null;
  while (_dirname) {
    packageJsonPath = join(_dirname, packageJson);
    if (existsSync(packageJsonPath)) {
      break;
    } else {
      _dirname = dirname(_dirname);
    }

    if (!_dirname) {
      throw new Error('can\'t find path to package json');
    }
  }
  return packageJsonPath;
}

const allgPackagingJsonPath = findPackageJson(__dirname);
if (!allgPackagingJsonPath) {
  throw new Error('can\'t find path to allgemein-packaging package json');
}
const allgPackagingJson = require(allgPackagingJsonPath);

const pathToPackageJsonPath = findPackageJson(process.cwd());
const pathToPackage = dirname(pathToPackageJsonPath);
if (!pathToPackageJsonPath) {
  throw new Error('can\'t find path to project package json');
}
const pathToPackagingJson = require(allgPackagingJsonPath);

const skipPkg = ['mocha', 'chai', 'mocha-typescript', 'typescript', 'ts-node'];

const changes = [];

for (const dep of Object.keys(allgPackagingJson.devDependencies)) {
  if (skipPkg.includes(dep) || /^@types\//.test(dep)) {
    continue;
  }

  if (!pathToPackagingJson.hasOwnProperty('devDependencies')) {
    pathToPackagingJson.devDependencies = {};
  }

  if (!pathToPackagingJson.devDependencies.hasOwnProperty(dep)) {
    pathToPackagingJson[dep] = allgPackagingJson.devDependencies[dep];
    changes.push('add ' + dep + ' ' + allgPackagingJson.devDependencies[dep]);
  } else {
    const versionSrc = allgPackagingJson.devDependencies[dep].replace(/\^|>|<|=/g, '');
    const versionDest = pathToPackagingJson.devDependencies[dep].replace(/\^|>|<|=/g, '');

    if (compare(versionDest, versionSrc, '<')) {
      // update version
      pathToPackagingJson[dep] = versionSrc;
      changes.push('update ' + dep + ' ' + allgPackagingJson.devDependencies[dep]);
    }
  }
}

if (changes.length > 0) {
  console.log('Update dev dependencies in ' + pathToPackageJsonPath);
  console.log(changes.map(x => ' - ' + x).join('\n'));
  writeFileSync(pathToPackageJsonPath, JSON.stringify(pathToPackageJsonPath, null, 2));
  console.log('Run `npm install` to install packages.');
} else {
  console.log('All dev dependencies are installed.');
}

if (!existsSync(join(pathToPackage, 'gulpfile.ts'))) {
  console.log('Install gulpfile.ts');
  const str = `import * as glob from 'glob';
[
  ...glob.sync('node_modules/*/gulp/*'),
  ...glob.sync('src/gulp/*'),
  ...glob.sync('gulp/*'),
]
  .filter(x => !/@types\\//.test(x))
  .map(x => require('./' + x));
`;
  writeFileSync(join(pathToPackage, 'gulpfile.ts'), str);

} else {
  console.log('gulpfile.ts exists already');
}
