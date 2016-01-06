'use strict';

var path = require('path');
var http = require('http');
var express = require('express');
var app = express();
var server = http.createServer(app);
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, '..', 'config');
var dsAssets = require('../../');
var tape = require('tape');
var proagent = require('promisingagent');

dsAssets.augmentApp(app);

var port, request;

tape('start server & get port', function (test) {
    test.plan(1);
    server.listen(function () {
        port = this.address().port;
        request = proagent.bind(null, 'http://127.0.0.1:' + port);
        test.ok(true);
    });
})

tape(function (test) {
    test.plan(1);
    request('/ccc/index/css/404.css').then(function (r) {
        test.strictEqual(r.statusCode, 404);
    });
})

tape(function (test) {
    test.plan(1);
    request('/ccc/index/css/a.css').then(function (r) {
        test.strictEqual(r.text.trim(), 'body{backgroud:black}');
    });
})

tape(function (test) {
    console.log(port);
    test.plan(1);
    request('/ccc/index/css/b.css').then(function (r) {
        test.strictEqual(r.text.trim(), 'body{font-size:14px}');
    });
})

tape(function (test) {
    console.log(port);
    test.plan(1);
    request('/ccc/index/css/c.css').then(function (r) {
        test.strictEqual(r.text.trim(), '@media screen and (min-width: 960px) { .container { width: 900px; } }\n@media only screen and (min-width: 1200px) { .container { width: 1140px; } }\n@media screen and (min-width: 1440px) { .container { width: 1380px; } }');
    });
})

tape(function (test) {
    console.log(port);
    test.plan(1);
    request('/ccc/index/css/c.nmq.css').then(function (r) {
        console.log(r.statusCode);
        test.strictEqual(r.text.trim(), '.container {\n  width: 900px;\n}\n\n.container {\n  width: 1140px;\n}');
    });
})

tape('close server', function (test) {
    test.plan(1);
    request('/ccc/index/css/a.css').get('text').then(function (text) {
        server.close(function (err) {
            test.ok(!err);
        });
    });
})
