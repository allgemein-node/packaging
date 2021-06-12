import {join, resolve} from 'path';
import {has, keys, set, uniq, unset} from 'lodash';
import * as glob from 'glob';
import * as gulp from 'gulp';
import shell from 'gulp-shell';
import * as through from 'through2';
import * as fs from 'fs';
import del from 'del';
import replace from 'gulp-replace';
import * as ts from 'gulp-typescript';
import * as sourcemaps from 'gulp-sourcemaps';

const m = require('merge-stream');

function getJson(path = './package.json') {
  return JSON.parse(fs.readFileSync(path).toString('utf-8'));
}

function extractTsImports(content: string) {
  const reg = /^import.*from.*'([^']+)';/mg;
  let result;
  const packages = [];
  while ((result = reg.exec(content)) !== null) {
    if (!['path', 'fs', 'os', 'events', 'util'].includes(result[1]) && !result[1].startsWith('.')) {
      const split = result[1].split('/');
      if (split.length > 2) {
        split.splice(2);
        if (split[0].startsWith('@')) {
          packages.push(split.join('/'));
        } else {
          packages.push(split[0]);
        }
      } else if (split.length === 2) {
        if (split[0].startsWith('@')) {
          packages.push(result[1]);
        } else {
          packages.push(split[0]);
        }
      } else {
        packages.push(result[1]);
      }
    }
  }
  return uniq(packages.filter(x => !!x));
}

const gulpExtractImports = function (deps: string[] = []) {
  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }
    if (file.isStream()) {
      return cb(new Error('Json Streaming not supported'));
    }
    const json = String(file.contents);
    const packages = extractTsImports(json);
    deps.push(...packages);
    file.packages = packages;
    cb(null, file);
  });
};


const applyImports = function (packageJsonFile: string, importPackages: string[], type: 'prod' | 'dev') {
  const mainPackageJson = getJson();
  const packageJson = getJson(packageJsonFile);

  let update = false;
  for (const pckg of importPackages) {
    const mainDep = has(mainPackageJson.dependencies, pckg);
    const mainDevDep = has(mainPackageJson.devDependencies, pckg);
    const mainNM = fs.existsSync('./node_modules/' + pckg);
    const pkgDep = has(packageJson.dependencies, pckg);
    const pkgDevDep = has(packageJson.devDependencies, pckg);
    let version = null;
    if (!(mainDep || mainDevDep || mainNM)) {
      throw new Error('Package ' + pckg + ' not im main package.json');
    } else {
      if (mainNM) {
        version = getJson('./node_modules/' + pckg + '/package.json').version;
      } else {
        version = mainDep ? mainPackageJson.dependencies[pckg] : mainPackageJson.devDependencies[pckg];
      }

    }

    if (!(pkgDep || pkgDevDep)) {
      update = true;
      if (type === 'prod') {
        if (!packageJson.dependencies) {
          packageJson.dependencies = {};
        }
        packageJson.dependencies[pckg] = version;
      } else {
        if (!packageJson.devDependencies) {
          packageJson.devDependencies = {};
        }
        packageJson.devDependencies[pckg] = version;
      }
    }
  }

  if (update) {
    packageJson.dependencies = keys(packageJson.dependencies).sort().reduce((r, k) => (r[k] = packageJson.dependencies[k], r), {});
    packageJson.devDependencies = keys(packageJson.devDependencies).sort().reduce((r, k) => (r[k] = packageJson.devDependencies[k], r), {});
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));
  }

};


// -------------------------------------------------------------------------
// Package
// -------------------------------------------------------------------------


const packages = glob.sync('./packages/*/package.json');
const packageNames = [];
const updateDeps = [];
const testDeps = [];
const publishDeps = [];


for (const path of packages) {
  const dirName = path.match(/packages\/(.*)\/package/)[1];
  const sourcePath = resolve(join('packages', dirName));

  const buildPath = resolve(join('build', 'packages', dirName));
  const buildOut = join(buildPath, 'out');
  const buildTmp = join(buildPath, 'tmp');
  // const json = JSON.parse(fs.readFileSync(path).toString('utf-8'));
  // const name = json.name.replace(/^@/, '').replace(/[^\w]+/g, '-');

  /**
   * cleans build folder.
   */
  let taskName = 'package_cleanup__' + dirName;
  const taskNames = [taskName];
  gulp.task(taskName, () => del([buildPath + '/**']));


  /**
   * Update dependencies in json
   */
  taskName = 'update_dependencies_prod__' + dirName;
  updateDeps.push(taskName);
  gulp.task(taskName, () => {
    const deps: string[] = [];
    return gulp.src(['./src/**/*.ts', '!./src/gulp/**/*.ts'], {cwd: sourcePath})
      .pipe(gulpExtractImports(deps))
      .on('end', () => {
        if (deps.length > 0) {
          // get versions from package.json and check against existing 'deps / devDeps'
          applyImports(path, uniq(deps), 'prod');
        }
      });
  });

  taskName = 'update_dependencies_dev__' + dirName;
  updateDeps.push(taskName);
  gulp.task(taskName, () => {
    const deps: string[] = [];
    return gulp.src(['./test/**/*.ts', './src/gulp/**/*.ts'], {cwd: sourcePath})
      .pipe(gulpExtractImports(deps))
      .on('end', () => {
        if (deps.length > 0) {
          // get versions from package.json and check against existing 'deps / devDeps'
          applyImports(path, uniq(deps), 'dev');
        }
      });
  });

  gulp.task('update_dependencies__' + dirName, gulp.series(
    'update_dependencies_prod__' + dirName,
    'update_dependencies_dev__' + dirName
  ));

  /**
   * set package.json with correct version
   */
  taskName = 'package_apply_version__' + dirName;
  taskNames.push(taskName);
  gulp.task(taskName, () => {
    const mainPackageJson = getJson();
    const version = mainPackageJson.version;
    return gulp.src(path)
      .pipe(replace(/0\.0\.0\-PLACEHOLDER/g, version))
      .pipe(gulp.dest(buildTmp));
  });


  const tmpPackagePath = join(buildTmp, 'package.json');
  const angularJsonPath = join(sourcePath, 'angular.json');
  // const ngPackagePath = join(sourcePath, 'ng-package.json');
  if (fs.existsSync(angularJsonPath)) {
    const angularJson = getJson(angularJsonPath);
    const ngLibName = angularJson.defaultProject;
    const packageBack = join(sourcePath, 'package-tmp.json');

    taskName = 'package_ng_build__' + dirName;
    taskNames.push(taskName);
    gulp.task(taskName, () => {
      fs.copyFileSync(path, packageBack);
      fs.copyFileSync(tmpPackagePath, path);
      return gulp.src(path, {read: false})
        .pipe(shell('ng build ' + ngLibName, {cwd: sourcePath}))
        .pipe(
          through.obj((chunk, enc, callback) => {
            fs.copyFileSync(packageBack, path);
            fs.unlinkSync(packageBack);
            callback(null, chunk);
          })
        );
    });

    /**
     * Tests
     */
    const foundTestFiles = glob.sync(join(sourcePath, 'src', '**', '*.spec.ts'));
    if (foundTestFiles.length > 0) {
      taskName = 'test__' + dirName;
      testDeps.push(taskName);
      gulp.task(taskName, shell.task('ng test ' + ngLibName + ' --code-coverage=true --watch=false', {cwd: sourcePath}));
    }

  } else {

    taskName = 'package_nodejs__' + dirName;
    taskNames.push(taskName);
    gulp.task(taskName, () => gulp.src(tmpPackagePath)
      .pipe(through.obj(function (file, enc, cb) {

        if (file.isNull()) {
          return cb(null, file);
        }
        if (file.isStream()) {
          return cb(new Error('Json Streaming not supported'));
        }
        const json = JSON.parse(String(file.contents));
        unset(json, '$schema');
        unset(json, 'private');
        set(json, 'main', 'index.js');
        set(json, 'browser', 'browser.js');
        file.contents = new Buffer(JSON.stringify(json, null, 2));
        cb(null, file);
      }))
      .pipe(gulp.dest(buildOut)));


    /**
     * Copies all sources to the package directory.
     */
    taskName = 'package_compile__' + dirName;
    taskNames.push(taskName);
    gulp.task(taskName, () => {
      const tsProject = ts.createProject('tsconfig.json');
      const tsResult = gulp.src([
        './src/**/*.ts',
        '!./src/**/files/*.ts',
        '!./src/**/files/**/*.ts',
        '!./src/app/**',
        '!./src/modules/*/*.ts',
        '!./src/modules/*/!(api|entities)/*.ts',
        '!./src/modules/*/!(api|entities)/**/*.ts',
        '!./src/public_api.ts',
        './src/modules/*/+(api|entities)/*.ts',
        './src/modules/*/+(api|entities)/**/*.ts',
        '!./src/modules/app/**/*.ts',
      ], {cwd: sourcePath})
        .pipe(sourcemaps.init())
        .pipe(tsProject());

      return m(
        tsResult.dts.pipe(gulp.dest(buildOut)),
        tsResult.js
          .pipe(sourcemaps.write('.', {sourceRoot: '', includeContent: true}))
          .pipe(gulp.dest(buildOut))
      );
    });


    /**
     * Removes /// <reference from compiled sources.
     */
    taskName = 'package_replace_references__' + dirName;
    taskNames.push(taskName);
    gulp.task(taskName, () => gulp.src(join(buildOut, '**', '*.d.ts'))
      .pipe(replace('/// <reference types="node" />', ''))
      .pipe(replace('/// <reference types="chai" />', ''))
      .pipe(gulp.dest(buildOut)));


    /**
     * Copies files into the package.
     */
    taskName = 'package_copy_files__' + dirName;
    taskNames.push(taskName);
    gulp.task(taskName, () => gulp.src([
      './README.md',
      './src/**/files/*',
      './bin/*',
      './src/**/*.json'
    ], {cwd: sourcePath}).pipe(gulp.dest(buildOut)));

    /**
     * Test
     */
    const foundTestFiles = glob.sync(join(sourcePath, 'test', '**', '*.spec.ts'));
    if (foundTestFiles.length > 0) {
      taskName = 'test__' + dirName;
      testDeps.push(taskName);
      gulp.task(taskName, shell.task(`nyc mocha ./packages/${dirName}/test/**/*.spec.ts`));
    }
  }

  taskName = 'package__' + dirName;
  packageNames.push(taskName);
  gulp.task(taskName, gulp.series(...taskNames));

  taskName = 'publish__' + dirName;
  publishDeps.push(taskName);
  gulp.task(taskName, shell.task('npm publish --access=public', {cwd: buildOut}));

}


/**
 * Test
 */
const foundTestFiles = glob.sync(join(resolve('.'), 'test', '**', '*.spec.ts'));
if (foundTestFiles.length > 0) {
  const json = getJson();
  const name = json.name.replace(/^@/, '').replace(/[^\w]+/g, '-');
  const taskName = 'test__' + name + +'__nodejs';
  testDeps.push(taskName);
  gulp.task(taskName, shell.task('nyc mocha test/{**,**/**}/*.spec.ts'));
}


const angularJsonPath = join(resolve('.'), 'angular.json');
// const ngPackagePath = join(sourcePath, 'ng-package.json');
if (fs.existsSync(angularJsonPath)) {
  /**
   * Tests
   */
  const foundTestFiles = glob.sync(join('.', 'src', '**', '*.spec.ts'));
  if (foundTestFiles.length > 0) {
    const json = getJson();
    const name = json.name.replace(/^@/, '').replace(/[^\w]+/g, '-');
    const angularJson = getJson(angularJsonPath);
    const ngName = angularJson.defaultProject;
    const taskName = 'test__' + name + '__ng_app';
    testDeps.push(taskName);
    gulp.task(taskName, shell.task('ng test ' + ngName + ' --code-coverage=true --watch=false'));
  }
}

gulp.task('update_dependencies', gulp.series(...updateDeps));
gulp.task('package', gulp.series(...packageNames));
gulp.task('test', gulp.series(...testDeps));
gulp.task('publish', gulp.series(...publishDeps));
