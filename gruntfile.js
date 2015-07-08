module.exports = function (grunt)
{
	// Project configuration
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		browserify: {
			build: {
				files: [
					{src: 'src/auction/**/*.js', dest: 'build/auction.js'},
					{src: 'src/client/**/*.js', dest: 'build/client.js'},
					{src: 'src/debug/**/*.js', dest: 'build/debug.js'}
				]
			}
		},

		copy: {
			build: {
				files: [
					{src: 'src/auction/auction.html', dest: 'build/auction.html'}
				]
			}
		},

		less: {
			development: {
				files: [
					{src: 'src/debug/debug.less', dest: 'build/debug.css'}
				]
			},
			production: {
				options: {
					cleancss: true,
					compress: true
				},
				files: [
					{src: 'src/debug/debug.less', dest: 'build/debug.css'}
				]
			}
		},

		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
			},
			build: {
				files: [
					{src: 'build/auction.js', dest: 'build/auction.js'},
					{src: 'build/client.js', dest: 'build/client.js'},
					{src: 'build/debug.js', dest: 'build/debug.js'}
				],
				sourceMap: true
			}
		},

		watchBackground: {
			options: {
				spawn: false
			},
			scripts: {
				files: ['src/**/*.js'],
				tasks: ['browserify'],
			},
			styles: {
				files: ['src/**/*.less'],
				tasks: ['less:development'],
			}
		}
	});

	// Load plugins
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Overloading
	grunt.renameTask('watch', 'watchBackground');

	// Default task(s)
	grunt.registerTask('release', ['copy', 'browserify', 'less:production', 'uglify']);
	grunt.registerTask('watch', ['copy', 'browserify', 'less:development', 'watchBackground']);
};
