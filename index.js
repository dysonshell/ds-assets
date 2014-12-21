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

function getComponentName(componentsDirName, dirname, filePath) {
    var componentRegExp = new RegExp('(\\/' + componentsDirName +
        '\\/[^\\/]+)\\/' + rewrite.escapeRegExp(dirname) + '\\/');
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

    var component = getComponentName(opts.componentsDirName, opts.assetsDirName +
        '/css', filePath);

    function render(contents) {
        less.render(contents, {
            dumpLineNumbers: 'comments',
            filename: filePath,
            relativeUrls: true,
            paths: [path.dirname(filePath)],
            sourceMap: sourceMapOptions
        }, errto(errcb, function (output) {
            if (component) {
                cb(rewrite({
                    revPost: function (assetFilePath) {
                        return component + '/' + opts.assetsDirName +
                            '/' + assetFilePath;
                    }
                }, output.css));
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
    return function (req, res, next) {
        if (!req.url.match(/\.css($|\?)/i)) {
            return next();
        }
        if (req.path.indexOf('/' + opts.assetsDirName + '/css/') !== 0 && !opts
            .componentsDirName) {
            return next();
        }
        var filePath = path.join(opts.appRoot, req.path.replace(/\.css$/i,
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
                res.send(css);
            });
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
        var component;
        if (opts.componentsDirName) {
            component = getComponentName(opts.componentsDirName,
                opts.assetsDirName + '/js/main', req.path);
        }
        if (req.path.indexOf('/' + opts.assetsDirName + '/js/main/') !== 0 && !
            component) {
            return next();
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
                            return component + '/' + opts.assetsDirName +
                                '/' + assetFilePath;
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
        glob('./' + opts.componentsDirName + '/*/' + opts.assetsDirName +
            '/css/' + opts.componentsDirName +
            '.less', {
                cwd: opts.appRoot
            }, function (error, files) {
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
        if (typeof opts.appRoot === 'string') {
            app.use(exports.jsMiddleware(opts));
            app.use(exports.lessMiddleware(opts));
            if (typeof opts.componentsDirName === 'string' && typeof opts.componentsDirName ===
                'string') {
                app.get('/' + opts.assetsDirName + '/css/' + opts.componentsDirName +
                    '.css',
                    exports.getComponentsCss(opts));
                app.use('/' + opts.componentsDirName, ecstatic(
                    path.join(opts.appRoot, opts.componentsDirName)));
            }
        }
        if (typeof opts.assetsDirName === 'string') {
            app.use('/' + opts.assetsDirName, ecstatic(path.join(opts.appRoot,
                opts.assetsDirName)));
        }
        if (app.get('env') !== 'production' && typeof opts.appRoot ===
            'string') {
            app.use('/node_modules', ecstatic(path.join(opts.appRoot,
                'node_modules')));
        }
    }
};
