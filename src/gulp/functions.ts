import {has, keys, uniq} from 'lodash';
import fs from 'fs';

export function getJson(path = './package.json') {
  return JSON.parse(fs.readFileSync(path).toString('utf-8'));
}

export const sortDependenciesFn = (a: any, b: any) => {
  const src = [a.name, ...a.deps];
  const trg = [b.name, ...b.deps];
  const x = trg.filter(x => src.includes(x));
  const y = src.filter(x => trg.includes(x));
  if (x.length > 0) {
    // src depends on target
    return -1;
  }
  return a.name.localeCompare(b.name);

};

interface IPackageData {
  name: string;
  path: string;
  deps: string[];
  weight: number;
  cycle: number;
}

export const sortByDependencies = function (packageJsonPaths: string[]) {
  const entries: IPackageData[] = [];
  for (const pjPath of packageJsonPaths) {
    const packageJson = getJson(pjPath);
    const entry: any = {name: packageJson.name, path: pjPath, deps: [], weight: 0, cycle: 20};
    const depKeys = ['dependencies', 'peerDependencies', 'optionalDependencies'];
    for (const depKey of depKeys) {
      if (!has(packageJson, depKey)) {
        continue;
      }
      const _keys = keys(packageJson[depKey]);
      if (_keys && _keys.length > 0) {
        entry.deps.push(..._keys);
      }
    }
    entry.deps = uniq(entry.deps);
    entries.push(entry);
  }

  const tmpOrder: IPackageData[] = [];
  while (entries.length > 0) {
    const entry = entries.shift();
    const res = entry.cycle--;
    if (res < 0) {
      // if cycle push
      tmpOrder.push(entry);
      continue;
    }
    if (entry.deps.length === 0) {
      // no deps then push
      tmpOrder.push(entry);
    } else {
      // has deps
      // are deps in entries

      const hasUnprocessedDeps = entry.deps.reduce((p, c) => p || !!entries.find(x => x.name === c), false);
      if (hasUnprocessedDeps) {
        entries.push(entry);
      } else {
        tmpOrder.push(entry);
      }
    }
  }
  return tmpOrder.map(x => x.path);
};
