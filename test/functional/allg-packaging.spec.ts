import {suite, test} from 'mocha-typescript';
import {tmpdir} from 'os';
import {join} from 'path';
import {copyFileSync, mkdirSync} from 'fs';
import {exec} from 'child_process';
import * as del from 'del';
import {promisify} from 'util';

const execAsync = promisify(exec);

@suite('allgemein packaging')
export class AllgPackagingSpec {

  @test
  async 'update dependencies'() {
    // create modul
    const allgTestPkg = 'alg-pkg-modul';
    const path = join(tmpdir(), allgTestPkg);
    await del([path], {force: true});
    mkdirSync(path);
    copyFileSync(join(__dirname, 'data', 'package_1.json'), join(path, 'package.json'));

    const res = await execAsync('which node', {cwd: path,  uid: process.getuid()});
    console.log(res);
  }
}
