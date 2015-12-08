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

tape('close server', function (test) {
    test.plan(1);
    request('/ccc/index/css/a.css').get('text').then(function (text) {
        server.close(function (err) {
            test.ok(!err);
        });
    });
})
