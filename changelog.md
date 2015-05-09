# change log

# 2.0

从 2.0 开始，之作为一个开发环境中的静态文件服务器存在，逻辑非常简单，只是让 `/ccc/*` 的请求 fallback 到 `node_modules/@ccc/*` 以符合[DS 框架的主旨](http://gitlab.creditcloud.com/ccfe/public-docs/wikis/ds)。

开始记录 change log 了。。。

# 1.0

主要是做成符合今后方向 `ccc/*` 模块化的改进。

## pre 1.0

assets 组建的尝试，需求还不明确，做了 less middleware，把 less 编译放到里面了。
