'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var config = require('config');
assert(config.dsAppRoot);
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
        if (!(yield exists(filePath))) {
            return next();
        }
        if (filePath.match(/\.css$/)) {
            res.type('css');
            var content = yield readFile(filePath);
            try {
                var parsed = css.parse(content);
                if (!supportIE8 || !noMediaQueries) {
                    content = mqRemove(parsed, {
                        type: 'screen',
                        width: mqWidth,
                    })
                } else {
                    content = css.stringify(parsed);
                }
                res.send(content);
            } catch (err) {
                res.statusCode = 500;
                res.set('Content-Type', 'text/css');
                res.end('/* CSS 文件解析发生错误，会影响发布编译过程，请将文件按照下面的错误提示改正：\n\n'+(err.stack||err.toString())+'\n*/');
            }
        } else {
            return res.sendFile(filePath);
        }
    }));
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
