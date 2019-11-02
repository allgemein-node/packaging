import * as gulp from 'gulp';
import * as bump from 'gulp-bump';


// -------------------------------------------------------------------------
// Versioning
// -------------------------------------------------------------------------


gulp.task('vpatch', () => {
  return gulp.src('package.json')
    .pipe(bump({type: 'patch'}))
    .pipe(gulp.dest('./'));
});

gulp.task('vminor', () => {
  return gulp.src('package.json')
    .pipe(bump({type: 'minor'}))
    .pipe(gulp.dest('./'));
});

gulp.task('vmajor', () => {
  return gulp.src('package.json')
    .pipe(bump({type: 'major'}))
    .pipe(gulp.dest('./'));
});
