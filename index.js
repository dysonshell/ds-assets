'use strict';

var fs = require('fs');
var path = require('path');
var less = require('less');
var rewrite = require('rev-rewriter');
var errto = require('errto');
var mqRemove = require('mq-remove');

var rewriteComponentSource = require('@ds/rewrite-component-source');

function getComponentName(dirname, filePath) {
    var componentRegExp = new RegExp('(\\/ccc\\/[^\\/]+)\\/' + rewrite.escapeRegExp(
        dirname) + '\\/');
    var match = filePath.match(componentRegExp);
    return match && match[1];
}

exports.renderLess = function (filePath, opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    var contents = opts.contents;
    if (contents instanceof Buffer) {
        contents = contents.toString('utf-8');
    }

    var sourceMapOptions = null;
    if (!filePath.match(/ccc\.less$/)) {
        sourceMapOptions = {
            sourceMapFileInline: true,
            outputSourceFiles: true,
            sourceMapInputFilename: filePath,
            sourceMapBasepath: path.dirname(filePath),
            sourceMapRootpath: path.dirname(path.relative(opts.appRoot,
                filePath))
        };
    }

    if (typeof contents === 'string') {
        render(contents);
    } else {
        fs.readFile(filePath, 'utf-8', errto(errcb, render));
    }

    var component = getComponentName('css', filePath);

    function render(contents) {
        less.render(contents, {
            dumpLineNumbers: opts.debug && 'comments',
            filename: filePath,
            relativeUrls: true,
            paths: [path.dirname(filePath)],
            sourceMap: opts.debug && sourceMapOptions,
            compress: !opts.debug
        }, errto(errcb, function (output) {
            if (component) {
                cb(rewriteComponentSource(filePath, output.css));
            } else {
                cb(output.css);
            }
        }));
    }

    function errcb(err) {
        cb('/*ERROR:\n' + JSON.stringify(err, null, '  ') + err.stack + '\n*/');
    }
};

exports.lessMiddleware = function (opts) {
    if (typeof opts.appRoot !== 'string') {
        return function (req, res, next) {
            next();
        };
    }
    var cssPathRegExp = /(?:\/ccc\/[^\/]+|\/assets)\/.*(\.nmq)?\.css($|\?)/i;
    return function (req, res, next) {
        var match = req.url.match(cssPathRegExp);
        if (!match) {
            return next();
        }
        var noMediaQueries = !! match[1];
        var filePath = path.join(opts.appRoot, req.path.replace(
            /(\.nmq)?\.css$/i,
            '.less'));
        fs.exists(filePath, function (exists) {
            if (!exists) {
                return next();
            }
            exports.renderLess(filePath, opts, function (css) {
                if (css.match(/\/\*ERROR:/)) {
                    res.status(500);
                    res.setHeader('Content-Type',
                        'text/plain; charset=utf-8');
                } else {
                    res.setHeader('Content-Type',
                        'text/css; charset=utf-8');
                }
                if (noMediaQueries) {
                    res.send(mqRemove(css, {
                        width: opts.mqRemoveWidth || '1024px'
                    }));
                } else {
                    res.send(css);
                }
            });
        });
    };
};

var st = require('st');

function serveStatic(root, cache) {
    var opts = {
        path: root, // resolved against the process cwd

        cache: { // specify cache:false to turn off caching entirely
            fd: {
                max: 1000, // number of fd's to hang on to
                maxAge: 1000 * 60 * 60, // amount of ms before fd's expire
            },

            stat: {
                max: 5000, // number of stat objects to hang on to
                maxAge: 1000 * 60, // number of ms that stats are good for
            },

            content: {
                max: 1024 * 1024 * 64, // how much memory to use on caching contents
                cacheControl: 'public; max-age=31536000' // to set an explicit cache-control
                // header value
            }
        },

        index: false, // return 404's for directories

        dot: false, // default: return 403 for any url with a dot-file part

        passthrough: true, // calls next/returns instead of returning a 404 error

        gzip: true, // default: compresses the response with gzip compression
    };
    if (cache === false) {
        opts.cache = false;
    }
    return st(opts);
}


exports.argmentApp = function (app, opts) {
    opts = opts || {};
    if (app.get('env') === 'development') { // 只在开发环境做即时编译
        if (typeof opts.appRoot === 'string') {
            app.use(exports.lessMiddleware(opts));
            app.use('/ccc', serveStatic(path.join(opts.appRoot, 'ccc'), false));
            app.use('/node_modules', serveStatic(path.join(opts.appRoot,
                'node_modules'), false));
        }
        if (typeof opts.assetsDirName === 'string') {
            app.use('/' + opts.assetsDirName, serveStatic(path.join(opts.appRoot,
                opts.assetsDirName), false));
        }
    } else {
        if (typeof opts.appRoot === 'string') {
            app.use('/ccc', serveStatic(
                path.join(opts.appRoot, 'dist', 'ccc')
            ));
            app.use('/node_modules/bootstrap', serveStatic(path.join(opts.appRoot,
                'node_modules', 'bootstrap')));
            app.use('/node_modules/font-awesome', serveStatic(path.join(opts.appRoot,
                'node_modules', 'font-awesome')));
        }
        if (typeof opts.assetsDirName === 'string') {
            app.use('/' + opts.assetsDirName, serveStatic(path.join(opts.appRoot,
                'dist',
                opts.assetsDirName)));
        }
    }
};
