import * as gulp from 'gulp';
import * as ts from 'gulp-typescript';
import * as sourcemaps from 'gulp-sourcemaps';
import shell from 'gulp-shell';
import replace from 'gulp-replace';
import * as fs from 'fs';
import del from 'del';

const m = require('merge-stream');

// -------------------------------------------------------------------------
// Package
// -------------------------------------------------------------------------

if (fs.existsSync('./packages')) {
  const packages = fs.readdirSync('./packages');
  for (const p of packages) {

    const packageDist = `./build/${p}`;
    /**
     * Copies all sources to the package directory.
     */
    gulp.task('packageCompile-' + p, () => {
      const tsProject = ts.createProject('tsconfig.json');


      const tsResult = gulp.src([
        `./packages/${p}/src/**/*.ts`,
        `!./packages/${p}/src/**/files/*.ts`,
      ])
        .pipe(sourcemaps.init())
        .pipe(tsProject());

      return m(
        tsResult.dts.pipe(gulp.dest('./build/' + p)),
        tsResult.js
          .pipe(sourcemaps.write('.', {sourceRoot: '', includeContent: true}))
          .pipe(gulp.dest(packageDist))
      );
    });

    /**
     * Removes /// <reference from compiled sources.
     */
    gulp.task('packageReplaceReferences-' + p, () => {
      return gulp.src('./build/' + p + '/**/*.d.ts')
        .pipe(replace(/\/\/\/\s+<reference\s+types="[^"]*"\s+\/>/g, ''))
        .pipe(gulp.dest(packageDist));
    });

    /**
     * Copies README.md into the package.
     */
    gulp.task('packageCopyReadme-' + p, () => {
      return gulp.src(`./packages/${p}/README.md`)
        .pipe(replace(/```typescript([\s\S]*?)```/g, '```javascript$1```'))
        .pipe(gulp.dest(packageDist));
    });

    /**
     * Copies LICENSE into the package.
     */
    gulp.task('packageCopyLicense-' + p, () => {
      return gulp.src(`./packages/${p}/LICENSE`)
        .pipe(gulp.dest(packageDist));
    });

    /**
     * Copies README.md into the package.
     */
    gulp.task('packageCopyJsons-' + p, () => {
      return gulp.src(`./packages/${p}/src/**/*.json`)
        .pipe(gulp.dest(packageDist));
    });

    /**
     * Copies README.md into the package.
     */
    gulp.task('packageCopyFiles-' + p, () => {
      return gulp.src(`./packages/${p}/src/**/files/*`)
        .pipe(gulp.dest(packageDist));
    });

    /**
     * Copies Bin files.
     */
    gulp.task('packageCopyBin-' + p, () => {
      return gulp.src(`./packages/${p}/bin/*`)
        .pipe(gulp.dest(packageDist + '/bin'));
    });


    /**
     * Copy package.json file to the package.
     */
    gulp.task('packagePreparePackageFile-' + p, () => {
      return gulp.src(`./packages/${p}/package.json`)
        .pipe(replace('"private": true,', '"private": false,'))
        .pipe(gulp.dest(packageDist));
    });


    /**
     * Creates a package that can be published to npm.
     */
    gulp.task('package-' + p,
      gulp.series(
        'packageCompile-' + p,
        'packageCopyBin-' + p,
        'packageCopyJsons-' + p,
        'packageCopyFiles-' + p,
        'packageReplaceReferences-' + p,
        'packagePreparePackageFile-' + p,
        'packageCopyReadme-' + p,
        'packageCopyLicense-' + p
      )
    );


// -------------------------------------------------------------------------
// Main Packaging and Publishing tasks
// -------------------------------------------------------------------------

    /**
     * Publishes a package to npm from ./build/package directory.
     */
    gulp.task('packagePublish-' + p, () => {
      return gulp.src(`./packages/${p}/package.json`, {read: false})
        .pipe(shell([
          `cd ./build/${p} && npm publish --access=public && cd ../..`
        ]));
    });

  }

  gulp.task('packages',
    gulp.series(() => del(packages.map(x => './build/' + x + '/**')),
      gulp.parallel(...packages.map(x => 'package-' + x))
    )
  );

  gulp.task('packagesPublish',
    gulp.parallel(...packages.map(x => 'packagePublish-' + x))
  );
}
