# @ds/assets

serve static files

## 1.0.0

尝试 `ccc/account/css/style.{less,css}` 失败后，会尝试 `node_modules/@ccc/account/css/style.{less,css}`

与 0.x 区别，不会再重写 /css/ /js/ /img/ 下的路径，如在 account 下需要使用全路径 `/ccc/account/css/style.css` 而不是 `/css/style.css` 这样的简写。
