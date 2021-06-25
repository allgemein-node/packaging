import * as gulp from 'gulp';
import * as ts from 'gulp-typescript';
import shell from 'gulp-shell';
import {resolve} from 'path';
import * as sourcemaps from 'gulp-sourcemaps';
import replace from 'gulp-replace';

const m = require('merge-stream');

// -------------------------------------------------------------------------
// Package
// -------------------------------------------------------------------------

/**
 * Copies all sources to the package directory.
 */

gulp.task('packageCompile', () => {
  const tsProject = ts.createProject('tsconfig.json');
  const tsResult = gulp.src([
    './src/**/*.ts',
    '!./src/**/files/*.ts',
  ])
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  return m(
    tsResult.dts.pipe(gulp.dest('./build/package')),
    tsResult.js
      .pipe(sourcemaps.write('.', {sourceRoot: '', includeContent: true}))
      .pipe(gulp.dest('./build/package'))
  );
});

/**
 * Removes /// <reference from compiled sources.
 */
gulp.task('packageReplaceReferences', () => gulp.src('./build/package/**/*.d.ts')
  .pipe(replace(/\/\/\/\s+<reference\s+types="[^"]*"\s+\/>/g, ''))
  .pipe(gulp.dest('./build/package')));

/**
 * Copies README.md into the package.
 */
gulp.task('packageCopyReadme', () => gulp.src('./README.md')
  .pipe(replace(/```typescript([\s\S]*?)```/g, '```javascript$1```'))
  .pipe(gulp.dest('./build/package')));

/**
 * Copies LICENSE into the package.
 */
gulp.task('packageCopyLicense', () => gulp.src('./LICENSE')
  .pipe(gulp.dest('./build/package')));

/**
 * Copies README.md into the package.
 */
gulp.task('packageCopyJsons', () => gulp.src('./src/**/*.json').pipe(gulp.dest('./build/package')));

/**
 * Copies README.md into the package.
 */
gulp.task('packageCopyFiles', () => gulp.src('./src/**/files/*').pipe(gulp.dest('./build/package')));

/**
 * Copies Bin files.
 */
gulp.task('packageCopyBin', () => gulp.src('./bin/*').pipe(gulp.dest('./build/package/bin')));


/**
 * Copy package.json file to the package.
 */
gulp.task('packagePreparePackageFile', () => gulp.src('./package.json')
  .pipe(replace('"private": true', '"private": false'))
  .pipe(gulp.dest('./build/package')));


/**
 * Creates a package that can be published to npm.
 */
gulp.task('package', gulp.series(
  'clean',
  'packageCompile',
  'packageCopyBin',
  'packageCopyJsons',
  'packageCopyFiles',
  'packageReplaceReferences',
  'packagePreparePackageFile',
  'packageCopyReadme',
  'packageCopyLicense'
));


/**
 * Creates a package that can be published to npm.
 */
gulp.task('packageNoClean', gulp.series(
  'packageCompile',
  gulp.parallel(
    'packageCopyBin',
    'packageCopyJsons',
    'packageCopyFiles',
    'packageReplaceReferences',
    'packagePreparePackageFile',
    'packageCopyReadme',
    'packageCopyLicense'
  )
));

gulp.task('pack', shell.task([
  'npm pack',
  'cp *.tgz main.tgz',
  'mv *.tgz ../'
], {cwd: resolve('./build/package')}));


// gulp.task('watchPackage', () => {
//   return watch(["src/**/*.(ts|json|css|scss)"], {ignoreInitial: true, read: false}, (file: any) => {
//     sequence(["packageNoClean"]);
//   })
// });


// -------------------------------------------------------------------------
// Main Packaging and Publishing tasks
// -------------------------------------------------------------------------

/**
 * Publishes a package to npm from ./build/package directory.
 */
gulp.task('packagePublish', () => gulp.src('package.json', {read: false})
  .pipe(shell([
    'cd ./build/package && npm publish --access=public'
  ])));

/**
 * Publishes a package to npm from ./build/package directory with @next tag.
 */
gulp.task('packagePublishNext', () => gulp.src('package.json', {read: false})
  .pipe(shell([
    'cd ./build/package && npm publish --tag next --access=public'
  ])));
