# ds-assets

一个简单的静态文件模块，逻辑非常简单，只是让 `/dsc/*` 的请求 fallback 到 `node_modules/@dsc/*` 以符合[DS 框架](https://www.npmjs.com/package/dysonshell)的主旨，即可以很方便地将 `/dsc/` 的子目录打包成 npm 模块，方便共享复用。

比如访问 `/dsc/index/img/logo.png` 如果在 `${APP_ROOT}/dsc/index/img/logo.png` 找不到这个文件，就会尝试查找返回 `${APP_ROOT}/node_modules/@dsc/index/img/logo.png`，这个文件也不存在才会返回 404。

您不必考虑如何使用此模块，这是 dysenshell 的基础组建，会在您使用 dysenshell 框架时由框架调用。

## 关于 less

之前的版本还做了自动编译 less 的工作，现已将 less 的编译逻辑从框架中剔除，原因是：

1. 更容易达成“明显没有 bug”；
2. 开发者不再限于使用 less，也可以使用 sass、stylus 等自己熟悉的 css 预编译语言，只要最终提交正确的 css 即可，把正确使用预编译语言工具的责任交给开发者，框架维护者不再做支持；
3. 鼓励使用原生的 css，配合 Chrome 强大的 [DevTools 开启 Workspace](https://developer.chrome.com/devtools/docs/workspaces) 来编写 css，可能是目前最高效的 css 编写方式，使用方法见题叶的视频 http://www.tudou.com/programs/view/6Lo4HXWXh9M/

如果仍然需要继续使用 less，可以使用附带的 ds-less 和 ds-less-watch 命令，这两个小 bash script 其实是总结了能用 lessc 生成正确的 source maps 的命令。需要先安装全局的 less 和 nodemon。

```bash
ccnpm i -g less nodemon
```

然后在 `project-xxxx/web/` 目录下运行 `ds-less dsc/global/css/base.less` 即会在 dsc/global/css/ 下生成 base.css 和 base.css.map
如果是运行 `ds-less-watch dsc/global/css/base.less` 则会在生成 css 和 source map 之后继续监视 dsc/global/css/ 目录下的所有 less css 文件，有改动时重新生成

DevTools 中编辑 less 保存后，ds-less-watch 检测到改动重新编译 css，然后 Chrome 会检测到生成的 css 文件修改自动加载，这在题叶的那个视频也有演示。注意 DevTools 的设置里面 Auto-reload generated CSS 有没有被勾选上。

注意在 `project-xxxx/web/` 目录下本地安装的 `@ds/assets` 的命令放在 `node_modules/.bin`，这两个命令在 web 目录下以 `./node_modules/.bin/do-less` `./node_modules/.bin/do-less-watch` 这样运行即可。

## License
MIT
