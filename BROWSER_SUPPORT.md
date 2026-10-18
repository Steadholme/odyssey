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
- `ODYSSEY_RELEASE`：该服务上的发行路径，默认 `/1.5.0`。
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

## 1.4.0 验证与生产部署

2026-10-18，在 macOS 27.0（26A428）、Node 24.18.0 上，已从本仓 lockfile 安装所有三个引擎。本轮在 `http://127.0.0.1:18770` 的 `/1.4.0` 未冻结候选服务上执行结果：

- **Chromium 156.0.8078.4：通过**模块化、complete 两种入口及真实 `/forms.html` 的全部上述关键路径。
- **WebKit 27.2：通过**同样两种入口及真实 `/forms.html`；实测不支持 `interpolate-size:allow-keywords`，原生 disclosure 内容仍能展开、收起。
- **Firefox 157.0：前序执行宿主启动失败，本次未重试**，退出信息为 `Could not find profile folder`，未执行组件断言。macOS 27 的同类问题见 [Playwright #42768](https://github.com/microsoft/playwright/issues/42768)。没有修改用户 Firefox 数据或宿主隐私权限。

随后在 OVH 的隔离 Linux 候选容器验证了同一 IvwAre 资产（源码 `5112206`，测试 `bc907b2`），没有切换生产容器。官方 `mcr.microsoft.com/playwright:v1.64.1-noble`、Node 24.21.0 实际结果：**Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2 全部通过** modular、complete 和真实 Forms guide，共九条入口验收。包括本轮 custom combobox/multiselect/date 的键盘取值与 AX，以及 drop→input.files→FormData 的文件名、类型、大小和内容。

Firefox 与 WebKit 实测 `interpolate-size` 不可用时，原生 disclosure 仍正常展开、收起。Linux 通过解决了本轮跨引擎验证依赖；macOS Firefox 的宿主启动限制仍保留，不把 Linux 结果冒充该宿主已修复。代码的完整三引擎 [GitHub CI 39130749486](https://github.com/Steadholme/odyssey/actions/runs/39130749486) 也已通过。

Safari + 原有 SCIM.ITABC 真实输入法抽验通过：Tag 的候选确认不提前创建 chip，确认后正常提交；中文“中”只创建一个 chip；Command 的合成期 Enter/Escape 不执行命令或关闭层，后续正常 Enter 可执行。VoiceOver 对 custom combo/date/tree/modal 的完整人工抽验未完成，用户明确批准直接推进生产，因此延期并保留在 TODO ENG-09，不计为通过。临时设置已恢复，VoiceOver 关闭。

用户批准后，`16797915deaceb90e32ddaeab9608b2f61f559bf` 冻结的 20 文件与 IvwAre 候选逐字节相同，并仅部署到 [OVH Odyssey](https://odyssey.w33d.xyz/)。正式构建和公网固定发行资产的一年 immutable、旧快照及 compat 检查通过。切换后的独立 Chromium 通过真实 HTTPS modular/complete 空白消费者和真实 Forms guide 三入口；Patterns 入口 48 项断言通过，无应用写请求；桌面/320px 实际截图及 IAB 对话框/焦点返回已审阅。生产证据在 `/Users/w33d/.codex/visualizations/2026/10/18/01a14cce-8c61-77a1-a455-8844e22e2e39/odyssey-p1/production/`。

公开消费检查只复验实际部署和 CDN 路径；三引擎组件证据来自上述相同 payload 的 Linux/CI 门禁。其他产品不推广，旧消费 URL 保持原字节。后续内容变更只重验受影响路径；已公开 immutable 发行不覆写。

## 旧线上 canary gate 的安装边界

`tools/install-canary-gate.sh` 现在从本仓 package/lock 运行 `npm ci`，不再读取 Siteflow 的依赖。它仍保留既有 system Chromium、1.2 canary policy 和 implementation pins 的校验契约。

新的依赖树不能继承旧 `browserRuntimeSha256`。旧 policy 会拒绝不匹配的 runtime；部署新的线上 gate 需要该候选独立的 policy、runtime pin 和验收窗口。本地浏览器验证不执行这个 root/systemd 安装器。

## P2 工程门禁（1.5.0）

`tools/verify.sh` 同时运行 P2 core/extensions、Rust strict-CSP、workflows、data-tools、state atlas、字节/初始化预算和视觉差分。默认明确选择三个引擎；`BROWSERS=chromium,webkit` 只作为 macOS 宿主上的定向证据。最低 Rust 1.87 有独立 CI 检查，生产构建仍固定 Rust 1.96；构建入口采用 POSIX sh 与 Node >=22.12，不要求 GNU sed。

本轮最终来源 `b6e71fe` 的 [统一 CI 39140867898](https://github.com/Steadholme/odyssey/actions/runs/39140867898) 已全绿：19/19 独立 gate 与 Rust 1.87 MSRV 均通过。固定官方 Playwright 1.64.1 noble 容器中的 Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2 覆盖 core/extensions、strict CSP、工作流及回执身份、数据/运动/稀疏图、真实 Forms 和 modular/complete 安装；state atlas 的八主题、93 项库存及 320px 也通过。常规 Linux PNG 四项零差分，冻结 27 文件与已审阅候选逐字节相同。macOS Firefox 宿主限制及 VoiceOver 延期仍按上述范围保留。

### 审阅视觉差异，再更新基线

在已启动候选服务的同一平台执行：

```sh
ODYSSEY_BASE_URL=http://127.0.0.1:18772 \
  node tools/browser-runtime/node_modules/playwright/cli.js test \
  --config tools/tests/visual.config.mjs
```

失败会在 `/tmp/odyssey-visual-results/` 保存实际图、预期图和差分图；CI 失败时上传相同目录。确认组件值、布局、主题与浮层正确后，明确接受更新：

```sh
ODYSSEY_BASE_URL=http://127.0.0.1:18772 ODYSSEY_ACCEPT_VISUAL=1 \
  node tools/browser-runtime/node_modules/playwright/cli.js test \
  --config tools/tests/visual.config.mjs --update-snapshots
```

新 PNG 必须与对应源码一同审阅和提交；没有接受开关时拒绝更新。`ODYSSEY_VISUAL_PROBE=1` 是测试自身的故障 fixture，会将标题改为洋红色；它必须失败，不用于接受基线。四个逻辑状态在 macOS/Linux 各保存一组，避免用跨平台字体光栅差异掩盖组件变化。保持无重试、`maxDiffPixels=0`、颜色阈值 `0.2` 与固定浏览器 runtime。

本轮负责人已逐张审阅并接受 macOS/Linux 的八张 P2 初始基线。真实故障 fixture 使标题变色时差分门禁失败（1518 像素）；关闭故障 fixture 后 macOS 四项重新比对通过。最终发行候选仍需对接受的基线执行常规差分，不用更新命令覆盖失败。
