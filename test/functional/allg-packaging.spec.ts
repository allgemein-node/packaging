import {suite, test} from '@testdeck/mocha';
import {expect} from 'chai';
import {tmpdir} from 'os';
import {join} from 'path';
import {copyFileSync, mkdirSync} from 'fs';
import {exec} from 'child_process';
import del from 'del';
import {promisify} from 'util';
import {sortByDependencies} from '../../src/gulp/functions';

const execAsync = promisify(exec);

@suite('allgemein packaging')
export class AllgemeinPackagingSpec {

  @test.skip
  async 'update dependencies'() {
    // create modul
    const allgTestPkg = 'alg-pkg-modul';
    const path = join(tmpdir(), allgTestPkg);
    await del([path], {force: true});
    mkdirSync(path);
    copyFileSync(join(__dirname, 'data', 'package_1.json'), join(path, 'package.json'));
    const res = await execAsync('which node', {cwd: path, uid: process.getuid()});
  }


  @test
  async 'sort by name'() {
    // by name
    // const x = sortDependenciesFn({name: 'hallo', deps:[]}, {name: 'ballo', deps:[]});
    const data = sortByDependencies([
      './test/functional/data/package_d01.json',
      './test/functional/data/package_d02.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d01.json',
      './test/functional/data/package_d02.json']);

  }


  @test
  async 'sort by dep'() {
    // by name
    // const x = sortDependenciesFn({name: 'hallo', deps:[]}, {name: 'ballo', deps:[]});
    const data = sortByDependencies([
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d02.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json']);

  }



  @test
  async 'sort by multi dep'() {
    // by name
    // const x = sortDependenciesFn({name: 'hallo', deps:[]}, {name: 'ballo', deps:[]});
    let data = sortByDependencies([
      './test/functional/data/package_d04.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d02.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d04.json'
    ]);

    data = sortByDependencies([
      './test/functional/data/package_d04.json',
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d04.json'
    ]);

    data = sortByDependencies([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d04.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d04.json'
    ]);

    data = sortByDependencies([
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d04.json'
    ]);
    expect(data).to.deep.eq([
      './test/functional/data/package_d02.json',
      './test/functional/data/package_d03.json',
      './test/functional/data/package_d04.json'
    ]);

  }
}
