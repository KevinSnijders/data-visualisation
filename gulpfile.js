'use strict';

// Load plugins
const gulp = require('gulp');
const browsersync = require('browser-sync').create();
const del = require('del');
const newer = require('gulp-newer');
const imagemin = require('gulp-imagemin');
const plumber = require('gulp-plumber');
const sass = require('gulp-sass');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const eslint = require('gulp-eslint');
const eslintConfig = require('./eslint-config');
const uglify = require('gulp-uglify');

let minifyStyles = 'style.min.css';
let minifyScripts = 'script.min.js';

// All the different app and build directory paths
let baseApp = './app/';
let baseBuild = './build/';

let dirPath = {
	app: {
		styles: baseApp + 'scss/**/*.scss',
		scripts: baseApp + 'js/*.js',
		vendor: baseApp + 'js/vendors/*.js',
		images: baseApp + 'images/**/*',
		csv: baseApp + 'csv/**/*'
	},
	build: {
		styles: baseBuild + 'css/',
		scripts: baseBuild + 'js/',
		images: baseBuild + 'images',
		csv: baseBuild + 'csv/'
	},
	public: './public/**/*'
};

// BrowserSync
function browserSync(done) {
	browsersync.init({
		server: {
			baseDir: baseBuild
		},
		port: 3000
	});
	done();
}

// BrowserSync Reload
function browserSyncReload(done) {
	browsersync.reload();
	done();
}

// Clean assets
function clean() {
	return del([baseBuild]);
}

// Optimize Images
function images() {
	return gulp
		.src(dirPath.app.images)
		.pipe(newer(dirPath.build.images))
		.pipe(
			imagemin([
				imagemin.gifsicle({interlaced: true}),
				imagemin.jpegtran({progressive: true}),
				imagemin.optipng({optimizationLevel: 5}),
				imagemin.svgo({
					plugins: [
						{
							removeViewBox: false,
							collapseGroups: true
						}
					]
				})
			])
		)
		.pipe(gulp.dest(dirPath.build.images));
}

// CSS task
function styles() {
	return gulp
		.src(dirPath.app.styles)
		.pipe(plumber())
		.pipe(sass({ outputStyle: "expanded" }))
		.pipe(cleanCSS({compatibility: 'ie11'}))
		.pipe(concat(minifyStyles))
		.pipe(gulp.dest(dirPath.build.styles))
		.pipe(browsersync.stream());
}

// Lint scripts
function scriptsLint() {
	return gulp
		.src([dirPath.app.scripts])
		.pipe(plumber())
		.pipe(eslint(
			eslintConfig
		))
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
}

// Transpile, concatenate and minify scripts
function scripts() {
	return (
		gulp
			.src([dirPath.app.vendor, dirPath.app.scripts])
			.pipe(plumber())
			.pipe(uglify())
			.pipe(concat(minifyScripts))
			.pipe(gulp.dest(dirPath.build.scripts))
			.pipe(browsersync.stream())
	);
}

function html() {
	return (
		gulp
			.src([dirPath.public])
			.pipe(plumber())
			.pipe(gulp.dest(baseBuild))
			.pipe(browsersync.stream())
	)
}

function csv() {
	return (
		gulp
			.src(dirPath.app.csv)
			.pipe(plumber())
			.pipe(gulp.dest(dirPath.build.csv))
			.pipe(browsersync.stream())
	)

}

// Watch files
function watchFiles() {
	gulp.watch(dirPath.app.styles, styles);
	gulp.watch(dirPath.app.scripts, gulp.series(scripts));
	gulp.watch(
		[dirPath.public],
		html,
		gulp.series(browserSyncReload)
	);
	gulp.watch(dirPath.app.images, images);
}

// define complex tasks
const js = gulp.series(scripts);
const watch = gulp.parallel(watchFiles, browserSync);
const build = gulp.series(clean, gulp.parallel(html, styles, images, csv, js), watch);

// export tasks
exports.images = images;
exports.html = html;
exports.styles = styles;
exports.js = js;
exports.clean = clean;
exports.build = build;
exports.watch = watch;
exports.default = build;