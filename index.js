'use strict';

require('@ds/common');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var co = require('co');
// var less = require('less');
// var rewrite = require('rev-rewriter');
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
        if (!noMediaQueries) {
            return res.sendFile(filePath);
        } else {
            res.type('css');
            res.send(mqRemove((yield readFile(filePath)), {
                width: opts.mqRemoveWidth || '1024px'
            }));
        }
    }));
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
