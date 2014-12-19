'use strict';

var fs = require('fs');
var path = require('path');
var less = require('less');
var browserify = require('browserify');
var ecstatic = require('ecstatic');
var stringify = require('stringify');
var rewrite = require('rev-rewriter');
var glob = require('glob');

exports.renderLess = function (filePath, content, cb) {
    var indexMin = Math.min(filePath.indexOf('/assets/'), filePath.indexOf(
        '/components/'));
    var indexMax = Math.max(filePath.indexOf('/assets/'), filePath.indexOf(
        '/components/'));
    var index = indexMin > -1 ?
        indexMin : (indexMax > -1 ? indexMax : -1);
    var sourceMapOptions = {
        sourceMapFileInline: true,
        outputSourceFiles: true,
        sourceMapInputFilename: filePath
    };
    if (index !== -1) {
        sourceMapOptions.sourceMapBasepath = path.dirname(filePath);
        sourceMapOptions.sourceMapRootpath = path.dirname(filePath.substring(
            index + 1));
    } //TODO: 这段写得有点繁琐，待重构
    less.render(content, {
        dumpLineNumbers: 'comments',
        filename: filePath,
        relativeUrls: true,
        paths: [path.dirname(filePath)],
        sourceMap: filePath.match(/component\.less$/) ? null : sourceMapOptions
    }, function (err, output) {
        if (err) {
            cb('/*ERROR:\n' + JSON.stringify(err, null, '  ') + '\n*/');
        } else {
            cb(output.css);
        }
    });
};

exports.lessMiddleware = function (appRoot) {
    return function (req, res, next) {
        if (!req.url.match(/\.css($|\?)/i)) {
            return next();
        }
        var match;
        if (!(req.path.indexOf('/assets/css/') === 0 || (match = req.path.match(
            /^(\/components\/[^\/]+)\/assets\/css\//)))) {
            return next();
        }
        var component;
        if (match) {
            component = match[1];
        }
        var filePath = path.join(appRoot, req.path.replace(/\.css$/i,
            '.less'));
        fs.readFile(filePath, {
            encoding: 'utf-8'
        }, function (err, content) {
            if (err) {
                return next(err.code === 'ENOENT' ? null : err);
            }
            exports.renderLess(filePath, content, function (css) {
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
        });
    };
};

exports.jsMiddleware = function (appRoot) {
    return function (req, res, next) {
        if (!req.url.match(/\.js($|\?)/i)) {
            return next();
        }
        var match;
        if (!(req.url.indexOf('/assets/js/main/') === 0 || (match = req.url.match(
            /^(\/components\/[^\/]+)\/assets\/js\/main\//)))) {
            return next();
        }
        var component;
        if (match) {
            component = match[1];
        }
        var filePath = path.join(appRoot, req.path);
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

exports.getComponentsCss = function (componentsRoot) {
    return function (req, res) {
        var pending = 0;
        var result = [];
        glob('./*/assets/css/component.less', {
            cwd: componentsRoot
        }, function (error, files) {
            files.forEach(function (filePath) {
                pending += 1;
                var fullFilePath = path.join(componentsRoot, filePath);
                fs.readFile(fullFilePath, 'utf-8', function (err,
                    content) {
                    exports.renderLess(fullFilePath, content,
                        function (css) {
                            result.push(css);
                            pending -= 1;
                            if (pending === 0) {
                                done();
                            }
                        });
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
            app.use(exports.jsMiddleware(opts.appRoot));
            app.use(exports.lessMiddleware(opts.appRoot));
        }
        if (typeof opts.componentsRoot === 'string') {
            app.get('/assets/css/components.css', exports.getComponentsCss(opts
                .componentsRoot));
            app.use('/components', ecstatic(opts.componentsRoot));
        }
        if (typeof opts.assetsRoot === 'string') {
            app.use('/assets', ecstatic(opts.assetsRoot));
        }
        if (app.get('env') !== 'production' && typeof opts.appRoot === 'string') {
            app.use('/node_modules', ecstatic(path.join(opts.appRoot,
                'node_modules')));
        }
    }
};