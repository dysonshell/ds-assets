'use strict';

var fs = require('fs');
var path = require('path');
var less = require('less');
var browserify = require('browserify');
var ecstatic = require('ecstatic');
var stringify = require('stringify');
var rewrite = require('rev-rewriter');
var glob = require('glob');
var errto = require('errto');

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
    if (!opts.componentsDirName || !filePath.match(new RegExp(opts.componentsDirName +
        '\\.less$'))) {
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
            dumpLineNumbers: 'comments',
            filename: filePath,
            relativeUrls: true,
            paths: [path.dirname(filePath)],
            sourceMap: sourceMapOptions
        }, errto(errcb, function (output) {
            cb(output.css);
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
    return function (req, res, next) {
        if (!req.url.match(/\.css($|\?)/i)) {
            return next();
        }
        if (req.path.indexOf('/assets/css/') !== 0 && !opts.componentsDirName) {
            return next();
        }
        var match;
        if (opts.componentsDirName && !(match = req.path.match(
            new RegExp('^(\\/' + opts.componentsDirName +
                '\\/[^\\/]+)\\/assets\\/css\\/')))) {
            return next();
        }
        var component;
        if (match) {
            component = match[1];
        }
        var filePath = path.join(opts.appRoot, req.path.replace(/\.css$/i,
            '.less'));
        exports.renderLess(filePath, opts, function (css) {
            if (css.match(/\/\*ERROR:/)) {
                res.status(500);
                res.setHeader('Content-Type',
                    'text/plain; charset=utf-8');
            } else {
                res.setHeader('Content-Type',
                    'text/css; charset=utf-8');
                if (component) {
                    css = rewrite({
                        revPost: function (assetFilePath) {
                            return component + '/assets/' +
                                assetFilePath;
                        }
                    }, css);
                }
            }
            res.send(css);
        });
    };
};

exports.jsMiddleware = function (opts) {
    if (typeof opts.appRoot !== 'string') {
        return function (req, res, next) {
            next();
        };
    }
    return function (req, res, next) {
        if (!req.url.match(/\.js($|\?)/i)) {
            return next();
        }
        if (req.path.indexOf('/assets/js/main/') !== 0 && !opts.componentsDirName) {
            return next();
        }
        var match;
        if (opts.componentsDirName && !(match = req.path.match(
            new RegExp('^(\\/' + opts.componentsDirName +
                '\\/[^\\/]+)\\/assets\\/js\\/main\\/')))) {
            return next();
        }
        var component;
        if (match) {
            component = match[1];
        }
        var filePath = path.join(opts.appRoot, req.path);
        fs.exists(filePath, function (exists) {
            if (!exists) {
                return next();
            }
            var b = browserify({
                entries: [filePath],
                debug: true //TODO: source maps 的文件路径不对
            });
            b.transform(stringify(['.tpl', '.html'])); //TODO: works in node-side
            b.bundle(function (err, body) {
                if (err) {
                    console.error(err.stack);
                    res.status(500);
                    res.type('txt');
                    return res.send('/*\n' + err.toString() + '\n' +
                        err.stack + '\n*\/');
                }
                if (body instanceof Buffer) {
                    body = body.toString('utf-8');
                }
                res.type('js');
                if (component) {
                    body = rewrite({ //TODO: 写成 browserify transform
                        revPost: function (assetFilePath) {
                            return component + '/assets/' +
                                assetFilePath;
                        }
                    }, body);
                }
                res.send(body);
            });
        });
    };
};

exports.getComponentsCss = function (opts) {
    return function (req, res, next) {
        var pending = 0;
        var result = [];
        glob('./' + opts.componentsDirName + '/*/assets/css/' + opts.componentsDirName +
            '.less', {
                cwd: opts.appRoot
            }, function (error, files) {
                console.log(files);
                if (error) {
                    return next(error);
                } else if (!files.length) {
                    return done();
                }
                files.forEach(function (filePath) {
                    pending += 1;
                    var fullFilePath = path.join(opts.appRoot, filePath);
                    exports.renderLess(fullFilePath, opts,
                        function (css) {
                            result.push(css);
                            pending -= 1;
                            if (pending === 0) {
                                done();
                            }
                        });
                });
            });

        function done() {
            res.type('css');
            res.send(result.join(''));
        }
    };
};

exports.argmentApp = function (app, opts) {
    opts = opts || {};
    if (app.get('env') === 'development') { // 只在开发环境做即时编译
        //app.use(exports.lessMiddleware(opts));
        /*if (opts.libJs) {
            app.get('/assets/js/lib.js', exports.getJsLib(opts.assetsRoot));
        }*/
        if (typeof opts.appRoot === 'string') {
            app.use(exports.jsMiddleware(opts));
            app.use(exports.lessMiddleware(opts));
            if (typeof opts.componentsDirName === 'string') {
                var componentsRoot = path.join(opts.appRoot, opts.componentsDirName);
                app.get('/assets/css/' + opts.componentsDirName + '.css',
                    exports.getComponentsCss(opts));
                app.use('/' + opts.componentsDirName, ecstatic(
                    componentsRoot));
            }
        }
        if (typeof opts.assetsRoot === 'string') {
            app.use('/assets', ecstatic(opts.assetsRoot));
        }
        if (app.get('env') !== 'production' && typeof opts.appRoot ===
            'string') {
            app.use('/node_modules', ecstatic(path.join(opts.appRoot,
                'node_modules')));
        }
    }
};