'use strict';

require('@ds/common');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var co = require('co');
var css = require('css');
var mqRemove = require('mq-remove');
var errto = require('errto');
var serveStatic = require('serve-static');

exports.augmentApp = function (app, opts) {
    opts = opts || {};
    if (!opts.appRoot && app.set('root')) {
        opts.appRoot = app.set('root');
    }
    assert(opts.appRoot);
    if (app.get('env') !== 'development') { // production 应该用 nginx
        return;
    }
    app.use('/ccc', conext(function *(req, res, next) {
        var noMediaQueries;
        var filePath = path.join(opts.appRoot, 'ccc', req.path.replace(/(\.nmq)(\.css)$/i, function (all, m1, m2) {
            noMediaQueries = true;
            return m2;
        }));
        var filePathInModule = filePath.replace(['', 'ccc', ''].join(path.sep), ['', 'node_modules', '@ccc', ''].join(path.sep));
        if (!(yield exists(filePath))) {
            if (filePath === filePathInModule || !(yield exists((filePath = filePathInModule)))) {
                return next();
            }
        }
        if (filePath.match(/\.css$/)) {
            res.type('css');
            var content = yield readFile(filePath);
            var parsed = css.parse(content);
        } else {
            return next();
        }
        if (!noMediaQueries) {
            return res.send(content);
        } else {
            res.send(mqRemove(parsed, {
                width: opts.mqRemoveWidth || '1024px'
            }));
        }
    }), function (err, req, res, next) {
        res.statusCode = 500;
        res.set('Content-Type', 'text/css');
        res.end('/* CSS 文件解析发生错误，会影响发布编译过程，请将文件按照下面的错误提示改正：\n\n'+(err.stack||err.toString())+'\n*/');
    });
    app.use('/node_modules', serveStatic(path.join(opts.appRoot, 'node_modules')));
};

function conext(fn) {
    return function (req, res, next) {
        return co.wrap(fn).call(this, req, res, next).catch(next);
    }
}
function exists(filePath) {
    return new Promise(function (resolve) {
        fs.exists(filePath, resolve);
    });
}
function readFile(filePath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', errto(reject, resolve));
    });
}
