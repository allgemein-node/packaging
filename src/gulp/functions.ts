import {keys, orderBy, uniq} from 'lodash';
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

export const sortByDependencies = function (packageJsonPaths: string[]) {
  let entries: { name: string; path: string; deps: string[]; weight: number }[] = [];
  for (const pjPath of packageJsonPaths) {
    const packageJson = getJson(pjPath);
    const entry: any = {name: packageJson.name, path: pjPath, deps: [], weight: 0};
    if (keys(packageJson.dependencies).length > 0) {
      entry.deps.push(...keys(packageJson.dependencies));
    }
    if (keys(packageJson.peerDependencies).length > 0) {
      entry.deps.push(...keys(packageJson.peerDependencies));
    }
    entry.deps = uniq(entry.deps);
    entries.push(entry);
  }

  for (const entry of entries) {
    const dependents = entries.filter(x => x.deps.includes(entry.name));
    dependents.map(x => x.weight += (entry.weight + 1));
  }

  entries = orderBy(entries, ['weight', 'name']);
  return entries.map(x => x.path);
};
