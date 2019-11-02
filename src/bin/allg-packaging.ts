#!/usr/bin/env node

import {existsSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';

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


/*
 * Using code from npm modul compare-versions
 */
const semver = /^v?(?:\d+)(\.(?:[x*]|\d+)(\.(?:[x*]|\d+)(\.(?:[x*]|\d+))?(?:-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;

function tryParse(v: any) {
  return isNaN(Number(v)) ? v : Number(v);
}

function validate(version: string) {
  if (typeof version !== 'string') {
    throw new TypeError('Invalid argument expected string');
  }
  if (!semver.test(version)) {
    throw new Error('Invalid argument not valid semver (\'' + version + '\' received)');
  }
}

function indexOrEnd(str: string, q: string) {
  return str.indexOf(q) === -1 ? str.length : str.indexOf(q);
}

function split(v: string) {
  const c = v.replace(/^v/, '').replace(/\+.*$/, '');
  const patchIndex = indexOrEnd(c, '-');
  const arr = c.substring(0, patchIndex).split('.');
  arr.push(c.substring(patchIndex + 1));
  return arr;
}


function compareVersions(v1: string, v2: string) {
  [v1, v2].forEach(validate);

  const s1 = split(v1);
  const s2 = split(v2);

  for (let i = 0; i < Math.max(s1.length - 1, s2.length - 1); i++) {
    const n1 = parseInt(s1[i] || '0', 10);
    const n2 = parseInt(s2[i] || '0', 10);

    if (n1 > n2) {
      return 1;
    }
    if (n2 > n1) {
      return -1;
    }
  }

  const sp1 = s1[s1.length - 1];
  const sp2 = s2[s2.length - 1];

  if (sp1 && sp2) {
    const p1 = sp1.split('.').map(tryParse);
    const p2 = sp2.split('.').map(tryParse);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      if (p1[i] === undefined || typeof p2[i] === 'string' && typeof p1[i] === 'number') {
        return -1;
      }
      if (p2[i] === undefined || typeof p1[i] === 'string' && typeof p2[i] === 'number') {
        return 1;
      }

      if (p1[i] > p2[i]) {
        return 1;
      }
      if (p2[i] > p1[i]) {
        return -1;
      }
    }
  } else if (sp1 || sp2) {
    return sp1 ? -1 : 1;
  }

  return 0;
}
/*
 * End of compare-versions
 */


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
const pathToPackagingJson = require(pathToPackageJsonPath);

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
    pathToPackagingJson.devDependencies[dep] = allgPackagingJson.devDependencies[dep];
    changes.push('add ' + dep + ' ' + allgPackagingJson.devDependencies[dep]);
  } else {
    const versionSrc = allgPackagingJson.devDependencies[dep].replace(/\^|>|<|=/g, '');
    const versionDest = pathToPackagingJson.devDependencies[dep].replace(/\^|>|<|=/g, '');

    if (compareVersions(versionDest, versionSrc) < 0) {
      // update version
      pathToPackagingJson.devDependencies[dep] = versionSrc;
      changes.push('update ' + dep + ' ' + allgPackagingJson.devDependencies[dep]);
    }
  }
}

if (changes.length > 0) {
  console.log('Update dev dependencies in ' + pathToPackageJsonPath);
  console.log(changes.map(x => ' - ' + x).join('\n'));
  writeFileSync(pathToPackageJsonPath, JSON.stringify(pathToPackagingJson, null, 2));
  console.log('Run `npm install` to install packages.');
} else {
  console.log('All dev dependencies are installed.');
}

if (!existsSync(join(pathToPackage, 'gulpfile.ts'))) {
  console.log('Install gulpfile.ts');
  const str = `import * as glob from 'glob';
[
  ...glob.sync('node_modules/*/*/gulp/*.js'),
  ...glob.sync('node_modules/*/gulp/*.js'),
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
