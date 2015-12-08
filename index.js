'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var config = require('config');
assert(config.dsAppRoot);
var co = require('co');
var css = require('css');
var mqRemove = require('mq-remove');
var errto = require('errto');
var serveStatic = require('serve-static');
var conext = require('conext');

// config
var APP_ROOT = config.dsAppRoot;
var DSC = config.dsComponentPrefix || 'dsc';
DSC = DSC.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
var mqWidth = config.dsMediaQueryRemoveWidth || '1200px';
var supportIE8 = config.dsSupportIE8;

exports.augmentApp = function (app) {
    assert(APP_ROOT);
    if (app.get('env') !== 'development') { // production 应该用 nginx
        return;
    }
    app.use('/'+DSC, conext(function *(req, res, next) {
        var noMediaQueries;
        var reqPath;
        if (!supportIE8) {
            reqPath = req.path;
        } else {
            reqPath = req.path.replace(/(\.nmq)(\.css)$/i, function (all, m1, m2) {
                noMediaQueries = true;
                return m2;
            });
        }
        var filePath = path.join(APP_ROOT, DSC, reqPath);
        var filePathInModule = filePath.replace(['', DSC.replace(/\/+$/, ''), ''].join(path.sep), ['', 'node_modules', '@'+DSC.replace(/\/+$/, ''), ''].join(path.sep));
        if (!(yield exists(filePath))) {
            if (filePath === filePathInModule || !(yield exists((filePath = filePathInModule)))) {
                return next();
            }
        }
        if (filePath.match(/\.css$/)) {
            res.type('css');
            var content = yield readFile(filePath);
            if (!supportIE8 || !noMediaQueries) {
                return res.send(content);
            } else {
                var parsed = css.parse(content);
                res.send(mqRemove(parsed, {
                    width: mqWidth,
                }));
            }
        } else {
            return res.sendFile(filePath);
        }
    }), function (err, req, res, next) {
        res.statusCode = 500;
        res.set('Content-Type', 'text/css');
        res.end('/* CSS 文件解析发生错误，会影响发布编译过程，请将文件按照下面的错误提示改正：\n\n'+(err.stack||err.toString())+'\n*/');
    });
    app.use('/node_modules', serveStatic(path.join(APP_ROOT, 'node_modules')));
};

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
