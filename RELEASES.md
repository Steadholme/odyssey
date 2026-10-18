# Odyssey 发行与兼容契约

## 为新页面固定 1.5.0，旧页面保留原入口

公开 HTML 使用 `/1.5.0/` 的完整文件组；复制 `releases/1.5.0/` 可得到相同的自托管产物。`dist/` 是公共 core 的可变开发输入，不是一个包含 Line、字体、表达和组合的完整发布目录。

| 身份 | 本轮值 | 含义 |
| --- | --- | --- |
| Cargo package | `0.1.0` | 内部 Rust crate API 身份 |
| Internal Rust distribution | `1.5.0-canary.1` | `distribution.toml` 的受控 vendor 身份 |
| Public assets | `1.5.0` | HTML/CSS/JS 及组件目录的完整公开快照 |
| Design | `line` | 显式 `data-ody-design="line"` 的视觉契约 |
| Shell profile | `1.3` | 既有 `data-ody-shell` 标记，不与资产号混用 |

机器映射见 `/1.5.0/release.json`。编号不同不表示 payload 可任意混装；一个页面的 core、Line、extensions、compositions 应全部来自同一个公开版本。

## 文件组合

- 基础：`odyssey.css` + `odyssey.js`；纯静态组件可以不加载 JS。
- Line：再加 `odyssey-line.css`；字体可选择 `odyssey-font.css`（Inter）及 `odyssey-line-font.css`（Archivo/Azeret Mono）。
- 四表达：再加 `odyssey-expressions.css`；增强控件再加 `odyssey-extensions.css`、`odyssey-extensions.js`。
- 宿主可消费组合：`compositions.css`、`compositions.js`；状态、保存、网络和存储由宿主提供。
- 可选工作流：`workflows.css`、`workflows.js`，依赖 core/extensions；通过 `OdysseyWorkflows` 接宿主 adapter，模块不自动挂载任务或带 demo adapter。
- 可选数据/内容：`data-tools.css`、`data-tools.js`，依赖 core；通过 `OdysseyDataTools` 消费数据与编辑/日志状态。
- 全量：`odyssey-complete.css`、`odyssey-complete.js` 已按依赖顺序包含基础、Line、字体、表达、extensions 和 compositions；不要重复加载单项。`workflows`、`data-tools` 另选加载，避免普通页面承担重型能力。
- 目录与来源：`capabilities.json`、`capabilities.schema.json`、`tokens.json`、`design-map.json`、`state-matrix.json`；项目 `LICENSE.txt` 及 Inter、Archivo、Azeret Mono 的 OFL notice 随包保留。

公开运行时保持 network-free，不包含内部 Wire/Spark/Motion。Rust 继续使用现有 vendor channel；公开组件目录不改变 fleet membership 的定义。

## 兼容和迁移

1. `/1.1`、`/1.2`、`/1.3`、`/1.4.0` 是冻结快照，保留 URL 和字节；不会被 1.5.0 覆盖。旧 `/dist` 三文件保持已上线 `7362842` 的 1.3 字节；旧 Line/extensions 及被替代的私有 site asset aliases 保存在 `releases/compat-7362842/`，继续返回该部署的精确内容。`dist/` 的工作源修改不会通过旧 URL 推广到外部消费者。只有 Odyssey 新页面和显式选择 1.5.0 的页面消费本轮新实现。
2. 默认 `page_shell`、helper 签名、旧 markup 与正常调用条件保留；Line、表达和增强行为为显式选择。迁移先固定整组资产，再添加 root 属性，最后接入所需增强控件。
3. 删除/改名公开 class、data 属性、事件字段、helper 入口，或改变既有数据含义和默认行为，属于 breaking change，应进入新的 major 公开版本；新增可选能力进入 minor，兼容修复进入 patch。
4. 弃用先在能力目录和迁移说明标注替代入口，旧入口至少保留整个当前 major；不能只删文档后静默删除实现。Rust API 变更按其独立 Cargo 版本声明，并继续保留旧调用路径。

## 1.5.0 P2 发布验证（2026-10-18）

新增能力使用独立的 `/1.5.0/`，旧 `/1.4.0/` 二十文件继续原字节和 immutable 响应。Line 为主线，只有 Odyssey 的新页面选择本轮资产；Rust vendor 的新 canary 身份不会自动同步或部署其他消费者。

项目 owner 已确认 MIT。新发行带完整 `LICENSE.txt`；三套字体保持各自 SIL OFL 1.1，Inter 的旧 placeholder 已在开发源纠正，历史发行不改写。

构建入口是 POSIX `sh` + Node **>=22.12.0**，不依赖 GNU `sed`。CSS 版本行以及 JS `VERSION`/`RELEASE` 均必须存在，生成和 server 内嵌时再次核对 route 身份。Rust 最低支持 **1.87**，由 `is_multiple_of` 的既有 API 和真实编译验证确定；生产 Docker 与主 CI 继续固定 **1.96**，另有 1.87 MSRV job。

实际字节与动态初始化预算在 `tools/tests/performance-budgets.json`；runner 测 core、字体、Line、extensions、compositions、可选模块与 complete 的原始/gzip 字节，并测 100 控件子树首次及重复初始化。超出预算会失败，不能用增大阈值替代来源审阅。

视觉门禁采用现有 Playwright 的真正 PNG 差分：固定数据、内嵌字体、关闭运动，四个状态分别为 Line/light/960px、Line/dark/320px、Soft/light/960px、Signal/dark/浮层。macOS 与 Linux 各持自己的四张基线，不混用宿主光栅结果；差异输出 actual/expected/diff，审阅入口见 `BROWSER_SUPPORT.md`。

来源 `b6e71fe53f7e84daf4ce92c5c4d2bb9889c0d68f` 的 [GitHub CI 39140867898](https://github.com/Steadholme/odyssey/actions/runs/39140867898) 已通过 Rust/helper/server/目录前置、19 项独立浏览器及预算门禁和 Rust 1.87 MSRV。Linux Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2 的关键路径全部通过；四张已接受 Linux PNG 常规比对零差分，没有重录基线。100 控件首次/重复初始化中位数为 0.7/0.6ms。

本轮冻结的 27 个文件与已接受 `tB4ULx` 候选逐文件、逐字节一致，包括 `release.json`。旧 1.1、1.2、1.3、1.4.0 和 compat 快照未改写。仅 Odyssey 可晋级；恢复包 `/srv/ovh-migration/odyssey-line-p2-20261018/` 保留实际冻结 commit、镜像、容器、健康及切换 receipt，回退基线是本轮原生产 1.4.0 的 `9e68491` 镜像。

## 1.4.0 本轮发布决定（2026-10-18）

本轮冻结的 20 个文件与已验收 `IvwAre` 候选逐文件、逐字节一致，`release.json` 来源与身份元数据也一致。旧 `1.1`、`1.2`、`1.3` 和 `compat-7362842` 保持原字节。

- 自动验收复用本轮 [GitHub CI 39130749486](https://github.com/Steadholme/odyssey/actions/runs/39130749486) 与 Linux Chromium、Firefox、WebKit 三引擎的实际组件、完整组合、真实 Forms 输入及文件 `FormData` 证据；冻结后另核正式构建的 immutable header 和发行/兼容资产。
- macOS Safari 与真实 `SCIM.ITABC` 输入法已验证 Tag 和 Command 的组合输入确认、取消及后续正常执行路径。
- VoiceOver 完整导航尚未完成；用户已明确批准直接推进 Odyssey 生产，因此该人工检查延期，不计为通过。

本轮只部署 Odyssey，不同步或自动推广外部消费者。实际冻结 commit、镜像、容器、健康检查及回滚基线记录在 OVH 本轮恢复包 `/srv/ovh-migration/odyssey-line-p1-20261018/receipt.json`；回滚目标是本轮切换前的 `95ce746` 镜像，不是更早的 `bd0ccce`。

## 准备、冻结、验收、晋级

```sh
# 在所有来源 owner 完成后准备临时候选，尚不创建 immutable release。
./tools/build-public-dist.sh --output /tmp/odyssey-1.5.0-candidate
# 冻结前也能以同一 server/runner 验候选，构建时将该目录内嵌：
ODYSSEY_PUBLIC_RELEASE_DIR=/tmp/odyssey-1.5.0-candidate ./tools/verify.sh
# 负责人明确批准冻结后执行；已存在且不同的快照会直接失败。
./tools/build-public-dist.sh --freeze
npm ci --prefix tools/browser-runtime
npm run --prefix tools/browser-runtime install:browsers
./tools/verify.sh
```

`tools/verify.sh` 是本地和 CI 的同一入口：Rust/helper/vendor/server、目录 schema、发行一致性、现有交互、P1 回归、组合和三引擎关键路径。`ODYSSEY_BASE_URL` 可指定已有候选服务；否则只启动并清理自己创建的本地 server。测试不会同步消费者或部署。

显式设置 `ODYSSEY_PUBLIC_RELEASE_DIR` 构建的是**未冻结候选**：server 内嵌候选标记，`/1.5.0/` 资产统一返回 `Cache-Control: no-store`，同 origin 换候选时不会继续缓存上一版。默认从 `releases/1.5.0/` 构建的正式快照继续返回一年 `immutable`；旧冻结版本和 compat aliases 的缓存契约不变。此前已被浏览器存为 `immutable` 的候选不能靠新响应清除，首次改用新浏览上下文或新 origin 验收，不清除用户的全局浏览数据。

稳定晋级由负责人在**本轮候选**通过统一验收、视觉/a11y 审阅以及目标 Odyssey 部署检查后记录实际 commit、命令结果和证据位置。文件的版本号或 `--freeze` 成功不等于晋级；旧 `1.2.0-canary.1` collector/policy/window 不为本轮提供验收凭据。任何必需检查失败时修复候选来源并重新核对，尚未公开的版本需由负责人明确重开候选；已公开 immutable 版本只能发布新版本，不能覆写。

跨引擎支持和已知宿主限制见 `BROWSER_SUPPORT.md`。完整发行门禁要求 Chromium、Firefox、WebKit 实际通过；显式选择部分 `BROWSERS` 只产生该范围证据。
