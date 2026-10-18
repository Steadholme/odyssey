# 浏览器支持与复现

Odyssey 的浏览器门禁使用仓库自己的 Playwright runtime，不从其他产品复制 `node_modules`。默认门禁必须启动 Chromium、Firefox、WebKit 三个引擎；任一启动或断言失败都会使命令失败。

## 安装和运行

需要 Node.js **22.12.0 或更高版本**及 npm。依赖精确固定为 Playwright **1.64.1**、`@axe-core/playwright` **4.14.0**，用于契约 schema 验证的开发依赖 Ajv **8.20.0** 也精确固定；传递依赖由 `tools/browser-runtime/package-lock.json` 固定。

在仓库根目录执行：

```sh
npm ci --prefix tools/browser-runtime --ignore-scripts --engine-strict
npm --prefix tools/browser-runtime run install:browsers

# 先启动包含候选发行资产的本地 Odyssey 服务。
ODYSSEY_BASE_URL=http://127.0.0.1:18300 \
  npm --prefix tools/browser-runtime run test:compatibility
```

安装脚本使用锁定的本地 Playwright CLI 下载 Chromium、Firefox、WebKit，不使用本机已安装浏览器替代它们。Linux 执行宿主还需满足 [Playwright 系统依赖要求](https://playwright.dev/docs/browsers#install-system-dependencies)。安装及使用方法依据 [Playwright Library 文档](https://playwright.dev/docs/library)。

### Runner 接口

- `ODYSSEY_BASE_URL`：候选服务 origin，默认 `http://127.0.0.1:18300`。
- `ODYSSEY_RELEASE`：该服务上的发行路径，默认 `/1.4.0`。
- `PLAYWRIGHT_MODULE`：可选模块路径或 `file:` URL，默认导入本仓 `tools/browser-runtime/node_modules/playwright/index.mjs`。
- `ODYSSEY_SCREENSHOTS`：可选截图目录，按引擎和安装入口输出 320px 全页图。
- `BROWSERS`：逗号分隔的引擎名，默认 `chromium,firefox,webkit`。例如 `BROWSERS=chromium,webkit` 仅用于明确标注的定向诊断，不能代替三引擎发行门禁。

也可直接执行 `node tools/tests/compatibility-browser.test.mjs`。Runner 不使用 Chromium 专属 CDP；模块化与 complete 安装的文档 fixture 由测试提供，CSS、JS 和字体由各引擎真实请求候选服务。每个引擎还会直接访问该服务的 `/forms.html`，检查真实 guide 控件。覆盖：

- core tabs 的方向键/Home、modal 的焦点约束/Escape/焦点返回、原生输入及选择；
- extensions 原生 popover、OTP、details disclosure；
- Forms guide 的 custom combobox、multiselect、date picker 键盘取值及关键 AX 状态；
- guide 真实 dropzone 的 drop → `input.files` → 原生 `FormData`，校验文件名、类型、大小、内容。测试只补消费者所属的 form/name，不替换 guide 控件；原生 `DataTransfer` 缺失时失败，不跳过；
- 四种 expression × light/dark，切换后保留输入；
- reduced motion、320px 宽度及浮层不溢出；
- 资源失败、运行时错误、跨 origin 请求及写请求。

## 支持基线与降级

持续验收基线是 lockfile 对应的 **Chromium、Firefox、WebKit 构建**，而非任意旧版品牌浏览器。扩大或下调最低版本前，应在相应真实版本运行同一关键路径；本仓未建立更早版本的兼容承诺。

| 能力 | 要求或降级行为 |
| --- | --- |
| core tabs、modal、原生输入 | 由三引擎关键路径验收；不会依赖 Chromium CDP。 |
| extensions popover | 需要原生 Popover API；不提供旧浏览器 polyfill。缺少该 API 的浏览器不在该扩展支持范围。 |
| extensions command dialog | 需要原生 `HTMLDialogElement.showModal()`。 |
| details 展开 | 原生 `details` 保持可操作；缺少 `interpolate-size` 时直接展开/收起，不承诺高度动画。 |
| discrete transitions / `@starting-style` | 只增强进出场；不具备相应 CSS 能力时不承诺同样的动画。 |
| reduced motion | 保持操作及内容，移除被测浮层的过渡位移；无视觉位移的 identity matrix 与 `transform:none` 等价。 |
| 无 JavaScript | 原生输入和 `details` 可用；core 交互及 OTP 增强需要对应 JS。 |

WebKit 测试不是每一个 Safari/iOS 版本的实机证明；320px viewport 测试也不代替真机触摸验收。

## 本轮证据与待接验收

2026-10-18，在 macOS 27.0（26A428）、Node 24.18.0 上，已从本仓 lockfile 安装所有三个引擎。本轮在 `http://127.0.0.1:18770` 的 `/1.4.0` 未冻结候选服务上执行结果：

- **Chromium 156.0.8078.4：通过**模块化、complete 两种入口及真实 `/forms.html` 的全部上述关键路径。
- **WebKit 27.2：通过**同样两种入口及真实 `/forms.html`；实测不支持 `interpolate-size:allow-keywords`，原生 disclosure 内容仍能展开、收起。
- **Firefox 157.0：前序执行宿主启动失败，本次未重试**，退出信息为 `Could not find profile folder`，未执行组件断言。macOS 27 的同类问题见 [Playwright #42768](https://github.com/microsoft/playwright/issues/42768)。没有修改用户 Firefox 数据或宿主隐私权限。

发行负责人仍须运行默认三引擎门禁；Firefox 由已配置浏览器依赖的 Linux CI/执行宿主完成。当前记录不包含 Firefox 组件断言通过。候选内容变更后，需要重新验收受影响路径。

## 旧线上 canary gate 的安装边界

`tools/install-canary-gate.sh` 现在从本仓 package/lock 运行 `npm ci`，不再读取 Siteflow 的依赖。它仍保留既有 system Chromium、1.2 canary policy 和 implementation pins 的校验契约。

新的依赖树不能继承旧 `browserRuntimeSha256`。旧 policy 会拒绝不匹配的 runtime；部署新的线上 gate 需要该候选独立的 policy、runtime pin 和验收窗口。本地浏览器验证不执行这个 root/systemd 安装器。
