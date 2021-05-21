import * as gulp from 'gulp';
import shell from 'gulp-shell';


gulp.task('compile', () => {
  return gulp.src('package.json', {read: false})
    .pipe(shell(['tsc']));
});

