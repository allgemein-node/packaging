import * as gulp from 'gulp';
import * as shell from 'gulp-shell';


gulp.task('compile', () => {
  return gulp.src('package.json', {read: false})
    .pipe(shell(['tsc']));
});

