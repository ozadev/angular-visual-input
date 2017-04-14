var gulp = require('gulp');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');


gulp.task('sass', function () {
  return gulp.src(['./**/*.scss', '!./bower_components/**/*.scss', '!./node_modules/**/*.scss'])
    .pipe(concat("style.css"))
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 16 versions'],
      cascade: false
    }))
    .pipe(gulp.dest('./css/'));
});


gulp.task('watch', function () {
  gulp.watch(['./**/*.scss', '!./bower_components/**/*.scss', '!./node_modules/**/*.scss'], ['sass']);
});


gulp.task('default', ['sass', 'watch']);