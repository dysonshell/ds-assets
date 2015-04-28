'use strict';

var fs = require('fs');
var path = require('path');
var co = require('co');
var less = require('less');
var rewrite = require('rev-rewriter');
var errto = require('errto');
var mqRemove = require('mq-remove');

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

    function render(contents) {
        less.render(contents, {
            dumpLineNumbers: opts.debug && 'comments',
            filename: filePath,
            relativeUrls: true,
            paths: [path.dirname(filePath)],
            sourceMap: opts.debug && sourceMapOptions,
            compress: !opts.debug
        }, errto(errcb, function (output) {
            cb(output.css);
        }));
    }

    function errcb(err) {
        cb('/*ERROR:\n' + JSON.stringify(err, null, '  ') + err.stack + '\n*/');
    }
};

function exists(filePath) {
    return new Promise(function (resolve) {
        fs.exists(filePath, resolve);
    });
}

exports.lessMiddleware = function (opts) {
    if (typeof opts.appRoot !== 'string') {
        return function (req, res, next) {
            next();
        };
    }
    var cssPathRegExp = /(?:\/ccc\/[^\/]+|\/assets)\/.*?(\.nmq)?\.css($|\?)/i;
    return co.wrap(function * (req, res, next) {
        var match = req.url.match(cssPathRegExp);
        if (!match) {
            return next();
        }
        var noMediaQueries = !! match[1];
        var filePath = path.join(opts.appRoot, req.path.replace(/(\.nmq)?\.css$/i, '.less'));
        var filePathInModule = filePath.replace('/ccc/', '/node_modules/@ccc/');
        if (!(yield exists(filePath))) {
            if (filePath === filePathInModule || !(yield exists((filePath = filePathInModule)))) {
                return next();
            }
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
            app.use(function (req, res, next) {
                if (req.url.indexOf('/ccc/') > -1) {
                    req.cccOriginalUrl = req.url;
                    req.url = '/node_modules/@' + req.url.substring(1);
                    delete req.sturl;
                }
                next()
            });
            app.use('/node_modules', serveStatic(path.join(opts.appRoot, 'node_modules'), false));
            app.use('/ccc', function (req, res, next) {
                if (req.cccOriginalUrl) {
                   req.url = req.cccOriginalUrl;
                }
                next()
            });
            app.use('/assets', serveStatic(path.join(opts.appRoot, 'assets'), false));
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
            app.use('/assets', serveStatic(path.join(opts.appRoot, 'dist', 'assets')));
        }
    }
};
