# Odyssey TODO

更新：2026-10-18 · Line 主线 P2 已部署

## 先修可复用性，再扩大组件数量

**54 个站点不是 Odyssey 的全部能力。** 旧 guide/runtime 已有多选、Tag input、Date/Time picker、Dual-range、Rating、Notification center、Context menu、Bottom sheet、Carousel、Hover card、Calendar、Kanban 等。当前最缺的是统一能力目录、同名控件契约、Line 兼容性和稳定消费路径，而不是再做一遍这些控件。

本清单共 **70 项：P1 33、P2 31、P3 6**。本轮 **P1 已完成 32 项，ENG-09 的 VoiceOver 人工抽验延期**；用户明确决定直接推进生产，该项不计通过。条目勾选和“本轮结果”表示当前进展，“状态／依据”保留修复前的调查快照。“新增组合/领域扩展”是设计建议，不代表现有能力故障。

### 本轮 P2 执行

目标：完成 31 项 P2，Line 为主线；新公开版本 **1.5.0**，验证后仅部署 OVH Odyssey。1.4.0 与更早冻结资产、旧消费者 URL 保留；P1 VoiceOver 延期状态不变，P3 不在本轮。

- [x] 公共 core：Chart 更新/替代数据、完整 Tree、Confirm/Tooltip、en/zh/ja（p2_core）。
- [x] 增强输入：Selection、OTP、文件、Split、Popover、Command 状态与 locale 字体（p2_extensions）。
- [x] Rust：disabled/step/Range、Empty、链接语义和严格 CSP opt-in（p2_rust）。
- [x] 工作流：任务/恢复、认证、分步表单、文件队列、成员与通知偏好（p2_workflows）。
- [x] 数据组合：过滤/视图、Code/Log/Diff、日历/Agenda、资源选择、虚拟化和分析图表入口（p2_data）。
- [x] 状态矩阵、设计源、目录/契约和站点入口统一（root）。
- [x] 真正视觉差分、消费预算、MIT/元数据和跨平台构建检查（p2_engineering；项目 owner 已确认 MIT，字体 OFL 保留）。
- [x] 整合候选、三引擎/键盘/a11y/动效/窄屏验收，冻结后仅 Odyssey 切换；独立公网复验和本轮回滚基线（p2_engineering + root）。

**31 项 P2 全部完成并部署。** [完整 CI 39140867898](https://github.com/Steadholme/odyssey/actions/runs/39140867898) 在 `b6e71fe` 通过 19 项整合门禁及 Rust 1.87 MSRV：Chromium、Firefox、WebKit 的组件、工作流/身份、数据组合、严格 CSP 和消费入口通过；四张 Linux 视觉基线零差分，字节与初始化预算通过。macOS 四张视觉基线也已审阅并直接比对通过。

独立审查发现的任务旧回执污染、稀疏图表孤立观测不可见和状态矩阵消费链接已分别在 `ad97f81`、`20d6d0a`、`31d81c8` 修复；Line 动效复用当前 token，Split 的 ResizeObserver 交付期布局写入及 Firefox OTP 重复事件已在 `b999972`、`69890b1` 修复。对应真实浏览器回归与最终统一门禁通过，未放宽事件次数、屏蔽异常或更新 PNG 掩盖差异。

所有实现保持原调用条件；新增工作流只通过宿主 adapter 消费状态，不在组件库内实现认证、上传存储或业务授权。

### P2 当前生产：1.5.0 / Line

[Odyssey 生产站](https://odyssey.w33d.xyz/) 已使用冻结 commit `85d42fcae5c7edd85142d18df10eaee53ba3d9a4`。27 个发行文件及 metadata 与已验收 `tB4ULx` 候选逐字节相同；目录为 54 个既有站点和 39 个 guide/组合能力，共 93 项。新增入口为 [Workflows](https://odyssey.w33d.xyz/workflows.html)、[Data & content](https://odyssey.w33d.xyz/data-tools.html)、[State atlas](https://odyssey.w33d.xyz/states.html)。MIT 已按项目 owner 决定落地，三套字体继续保留各自 OFL 许可。

**部署与隔离**：生产镜像 `e5ff00abb9f5b29faabcb5f78c3a5a7a335033c03e2b066969d6782822c79f0e`，容器 `3d77e04be5f00ce663e0d290a433083e8e63d0a06638d8977ccad69fd9ea1fac`，healthy、restart 0。正式预览和生产各 91 项 HTTP/发行检查通过；1.1～1.4.0 冻结资产及 compat aliases 保留原字节。134 个非 Odyssey 容器的 ID/image 不变，有效 compose 只有 Odyssey image 一行改变，其他产品未推广。

**独立公网消费**：外部 HTTPS 27 个固定资产逐字节一致且为 immutable；Chromium 的 modular、complete、真实 Forms 三入口通过。State atlas 的 93 项目录、八主题、密度/尺寸、真实 Tab/readonly、弹窗焦点返回、搜索、Axe 和 320px 通过。IAB 实测第 10,000 条记录的选择与离开后恢复，以及任务 queued → running 36% → cancellation requested → 来源确认 cancelled；实际桌面和 320px 截图已审阅。日志与截图：`/Users/w33d/.codex/visualizations/2026/10/18/01a14cce-8c61-77a1-a455-8844e22e2e39/odyssey-p2/production/`。公开消费复验使用相同冻结 payload，不重复运行已有效的全部源验证。

**来源与恢复**：GitHub 保存冻结 commit；OVH 从该 commit 的独立 archive 构建，context 为 `/home/debian/odyssey-p2-release-85d42fc-20261018/`。OVH 旧 Git checkout 的对象写权限拒绝使其 P2 ref 停在 `1eb369d`，未改其权限，也不将该 checkout 作为生产来源。当前恢复包为 `/srv/ovh-migration/odyssey-line-p2-20261018/receipt.json`，独立健康及回滚脚本保留；本轮回退目标为切换前的 1.4.0 镜像 `9e68491`，不是 P1 包中的 `95ce746`。P1 VoiceOver 人工抽验继续按用户原决定延期，不计通过；P3 未推进。

### P1 已部署基线

- [x] 33 项分工和共享接口确定；Line 为主线，旧入口与冻结发行保留。
- [x] 运行时、Line/Rust、可消费组合及必要的旧 guide 邻接修复。
- [x] 能力目录/Pencil 同步、未冻结发行候选、统一验收与三引擎验证。
- [x] Safari + 原有 SCIM.ITABC 真实 IME 抽验通过；临时设置恢复，VoiceOver 关闭（A11Y-04）。
- [ ] VoiceOver 对 custom combo/date/tree/modal 的真实导航抽验；按用户“直接推动生产”决定延期，不阻断本次发布（ENG-09）。
- [x] 冻结 1.4.0，仅切换 OVH Odyssey；独立公网安装、工作流和视觉验收通过，保留本轮恢复路径（ENG-04、ENG-05）。

**P1 历史部署**：[Odyssey 生产站](https://odyssey.w33d.xyz/)，冻结 commit `16797915deaceb90e32ddaeab9608b2f61f559bf`，公开 `/1.4.0/`，Line 为主线。冻结 20 文件与已验收 IvwAre 候选逐字节相同；正式构建返回一年 `immutable`。当前生产已升为上节的 1.5.0，1.4.0 继续作为冻结入口及本轮回退基线。

**候选复现入口**：`http://localhost:18770/`，资产目录 `/tmp/odyssey-1.4.0-candidate.IvwAre`，核心来源 `5112206`；后续 `bc907b2` 增补真实 Forms 跨引擎测试，`5768c80` 仅修候选缓存。显式候选返回 `no-store`。旧浏览上下文可能已有先前 immutable 缓存，首次验收用新 origin 或隔离上下文，不清用户全局浏览数据。

**已消费的证据**：本地统一 `tools/verify.sh`（Chromium/WebKit）通过；OVH 隔离候选的 Chromium 156.0.8078.4、Firefox 157.0、WebKit 27.2 共九条 modular/complete/真实 Forms 入口通过；[GitHub CI 39130254060](https://github.com/Steadholme/odyssey/actions/runs/39130254060) 在 `bc907b2` 运行同一入口、三引擎全绿。缓存补丁的五项受影响断言及实际 HTTP 响应已通过。26 项候选 a11y 门禁和代表性实际截图已审阅；真实 Safari/SCIM 输入抽验另行通过，VoiceOver 未完成。

本地完整日志：`/tmp/odyssey-full-verify-20261018.log`；隔离 Linux 三引擎日志及截图：`/Users/w33d/.codex/visualizations/2026/10/18/01a14cce-8c61-77a1-a455-8844e22e2e39/odyssey-p1/`。源码保存在 `codex/odyssey-p1-20261018`，代码的完整三引擎 CI [39130749486](https://github.com/Steadholme/odyssey/actions/runs/39130749486) 已通过。

**生产验收**：镜像 `9e68491db4cf98c0b7344e4948e494b028ef845bfef06741fd89e47a77cab809`，容器 `9ef0873410d88b6c2cfc7a1b52d7e2a5bee0340a4773066fae3eb10624d45eb5`，healthy、restart 0。内部/宿主 HTTP、20 正式资产及旧快照/compat 检查通过；公网 20 固定发行资产逐字节一致且为 immutable。134 个非 Odyssey 容器 ID/image 不变，五份有效 compose 仅 Odyssey image 一行改变。Cloudflare 会改写示例 email 的 HTML，CDN HTML 不作逐字节相同承诺。

独立公网 Chromium 的 modular/complete/真实 Forms 三入口通过，实际请求 `/1.4.0/` CSS、JS、字体；Patterns 入口 48 项断言通过，无应用写请求。IAB 实看 54+28 能力目录、Patterns 页签、Studio 对话框及焦点返回；桌面/320px 截图已审阅。日志与截图在上述证据目录的 `production/`。

本轮恢复包：OVH `/srv/ovh-migration/odyssey-line-p1-20261018/`，`receipt.json` 记录实际切换与检查；回退目标为切换前镜像 `95ce746`，恢复脚本语法及镜像 guard 已核验，本次未执行回滚。旧 `/dist`、Line/extensions aliases 保持旧部署字节，其他产品不隐式消费本轮更新。

### 调查基线和边界

- 调查时的源码/测试基线：`67a2d4ec99d0f7dad632317e8d1140b4f59c6454`；当时已上线运行代码：`736284240c35c5722cdda154dad5272c141a7d35`。本文“状态／依据”源文件行号按该基线定位。
- 初始调查只读确认当时 OVH Odyssey healthy；后续修复和本次生产切换见“本轮 P1 执行”。
- 覆盖 Rust helpers、public HTML/CSS/JS、Line/四表达、全部组件 guide、三个 Patterns、发行/CLI/gates/测试及当前 Pencil 文档。
- 证据包括源码交叉盘点、本地真实 Chromium 控件/AX/forced-colors 探针、最小 DOM 探针、CLI 定向失败和临时 vendor 编译；已有有效验收继续复用，不把一次截图或 Axe 当成全部能力通过。
- 保留 Line 主线、旧 API/markup/入口。修复应进入源实现与**新发行**；冻结 `releases/1.1`、`1.2`、`1.3` 不覆写。此 TODO 不授权推广到其他产品。
- 外部目录用于查漏，行为标准用于验收；不照搬 React 架构，不因成熟库有某组件就强制 Odyssey 全量复制。

### 已存在，按补全或抽取处理

| 现有基础 | 待推进的准确层级 |
| --- | --- |
| 54 站 + guide 中的高级控件 | LIB-01/02：统一目录、成熟度、契约与入口，不重复建设 |
| OTP、upload、Tree、Split、Command、Popover | ACT：原生提交、事件、动态初始化、键盘及边界状态 |
| 三套已上线 Patterns | LIB-06/PAT：抽取可消费组合并扩展真实状态，不宣称演示就是后端服务 |
| 四表达、亮暗、密度、减少动效，Pencil 207 变量 | FIX/LIB/A11Y：兼容、语义、来源映射和覆盖矩阵 |
| vendor CLI、immutable releases、canary gate、多层测试和截图 | ENG：修复具体失败，补可 pin 发行、统一入口与系统覆盖 |
| 远端原 checkout 的未跟踪 application-patterns/helper/验收材料 | ENG-09/PAT-01/10：先核证并接纳，复用已有路径，不覆盖原材料或直接算本库通过 |

### 推荐推进顺序

1. **先修 Line 与输入/键盘阻断**：FIX-01～06、ACT-02/03/09/13/16、A11Y-01～06；ENG-01/02 两个已失败的产物测试同步修复。
2. **让“可看”成为“可用”**：LIB-01/02 定义目录与契约，再推进动态生命周期、Rust 接入、发行版本和安装示例。
3. **把当前能力守住**：ENG-06～10 持续验收、跨引擎、a11y 和视觉回归；把旧 guide 纳入，而不只测新 Patterns。
4. **再加通用组合与领域能力**：PAT 优先按产品场景选取；EXT/P3 在需求和资源路径明确后启动。

优先级：**P1** 优先修当前可靠性/可消费底座；**P2** 下一阶段补完整能力与质量；**P3** 按明确需求启动。每项完成时关联实现 commit 和对应验收证据。

## 1. Line 兼容性：先保住已经有的组件

责任域：Line CSS / token / Rust 样式。

- [x] **FIX-01 · P1 · 修复带可见标签的 Switch 布局**
  - 本轮结果：完成。`7cc1486` 将轨道与可见标签分离；长中英文、旧/标准 markup、forced-colors 和文本间距候选回归通过。
  - 状态／依据：**已复现**。css/line.css:117–122；site/forms.html:229–270。整个 label 被固定为38×20；六字标签实测被挤成约12.94×124.78px竖列并重叠。
  - 验收：尺寸限制只落在轨道；标准__control结构及registry简化结构均支持长中英文、换行、checked/disabled/focus，不破坏旧markup。 参考：[Reflow][wcag-reflow]。

- [x] **FIX-02 · P1 · 隔离简例 Chart 样式，恢复四类 SVG 图表布局**
  - 本轮结果：完成。`7cc1486` 将简例柱图限定为专用作用域；guide 四类 SVG 保留比例、名称与窄容器布局，实际页面 Axe/重排通过。
  - 状态／依据：**已复现**。css/line.css:164–165；site/data-display.html:665–674。bar/line容器高88但SVG高149，donut为88/140；行内spark也被撑高88。
  - 验收：registry柱状简例使用专用作用域；已有bar/line/donut/spark保持各自比例、标题间距及行内尺寸，亮暗和窄容器均不重叠。

- [x] **FIX-03 · P1 · 补全 Rust/public Line 角色映射，保留语义 Tone**
  - 本轮结果：完成。`7cc1486`、`de7576c` 映射 Rust/public 语义角色；四表达亮暗 48 个绑定共 384 个实际值检查通过。
  - 状态／依据：**代码确认**。css/line.css:69–84未映射--brand/--info*；:147将Alert轨道统一warning，:151将Progress统一Line蓝；css/components.css:297,659。
  - 验收：Rust/public两入口的Button、Pill、Alert、Progress、Empty角色一致；ok/warn/down/info语义不被线路家族色覆盖，不能只依赖颜色表达状态。

- [x] **FIX-04 · P1 · 修复 Rust Line busy spinner 的关键帧引用**
  - 本轮结果：完成。`7cc1486` 修正 APP_CSS 自有旋转关键帧并保留 reduced-motion busy 状态；Rust/helper 与 Line 浏览器回归通过。
  - 状态／依据：**代码确认**。css/line.css:170–172使用ody-spin；css/components.css:278–284只定义odyssey-spin；src/lib.rs:1–9的APP_CSS不含public dist关键帧。
  - 验收：仅加载APP_CSS的busy按钮能旋转；减少动效时仍有可辨识busy状态且不旋转，避免为此要求加载public全量包。

- [x] **FIX-05 · P1 · 统一 root / table / 旧 modifier 三种 density 入口**
  - 本轮结果：完成。`7cc1486` 统一 root、table 和旧 modifier 密度入口；粗指针目标下限与统一候选回归通过。
  - 状态／依据：**已复现**。css/line.css:139–140仅识别table自身data-density=compact；旧.ody-table--compact实测仍44px；Patterns使用root density。
  - 验收：明确可继承的comfortable/compact契约；兼容旧modifier；表格、列表、字段和工具栏在同一偏好下按约定缩放，触摸目标不随视觉密度失去可用性。

- [x] **FIX-06 · P1 · 恢复 Rust 表格窄容器中的完整数据可读性**
  - 本轮结果：完成。`7cc1486` 恢复可聚焦的横向表格滚动区域；320px、真实键盘和页面重排回归通过。
  - 状态／依据：**代码确认**。src/data.rs:43输出.table-wrap；css/components.css:315为overflow:hidden，public .ody-table-wrap为overflow:auto。
  - 验收：320px容器内长表能横向读取全部列；宿主页不被撑开；键盘用户能进入滚动区域，既有表格入口保持可用。

## 2. 控件运行时与数据能力：把展示补成可消费契约

责任域：组件 runtime / forms / data。

- [x] **ACT-01 · P1 · 扩展组件支持 root 自身、动态子树和幂等初始化**
  - 本轮结果：完成。`8c8c56b` 支持 root 自身/后代、动态插入、幂等初始化及 Wire 接线；21 项运行时浏览器回归通过。
  - 状态／依据：**已复现**。js/extensions.js:164–187只扫描后代；最小DOM探针init(otpRoot)绑定0监听，传父容器绑定24。
  - 验收：沿用已有root自身+后代扫描模式；明确与Odyssey.init/Wire更新的接线；初始页面、根自身、动态插入、重复init均正确，监听不重复。
  - 依赖：LIB-02。

- [x] **ACT-02 · P1 · 拖入文件必须进入原生 input / FormData**
  - 本轮结果：完成。`8c8c56b` 使 drop 回写 input.files；共享旧/增强 fixture 及三引擎真实 guide 均校验 FormData 文件名、类型、大小和内容。
  - 状态／依据：**已复现**。js/extensions.js:69–83仅更新文案与ody:file-selected；有效ZIP拖入后input.files仍0。旧dist/odyssey.js:939–947已有DataTransfer回写。
  - 验收：优先复用成熟文件输入契约；browse/drop产生相同FormData及变更事件；原生提交真的携带已显示文件。网络上传仍由宿主提供。

- [x] **ACT-03 · P1 · 修复 Multi-select 的键盘模型与 chip 变更事件**
  - 本轮结果：完成。`8c8c56b` 统一键盘选择、具名删除/清空及单次 detail.value 数组事件；真实 guide 三引擎和运行时回归通过。
  - 状态／依据：**已复现**。site/forms.html:483–493；dist/odyssey.js:792–793,1042–1052。Enter不开、option只有点击；chip删除不发选择时约定的ody:change，删除名称仅Remove。
  - 验收：选定一致的listbox/combobox模型；Enter/Space、方向键、Escape可完成选择；删除名称含项目名；点选/移除/清空均发一次一致values事件，移除后焦点有效。 参考：[Listbox][apg-listbox]。

- [x] **ACT-04 · P2 · Selection toolbar 初始化、Clear 与批量变更同步**
  - 本轮结果：`897ec48`。初值/全选/Clear 统一 selection-change 与 change；真实事件和宿主值检查通过。
  - 状态／依据：**代码确认**。js/extensions.js:138–149未在init调用update；Clear直接改checked，不发change或选择事件。
  - 验收：从真实checkbox初值计算0/N计数和显隐；单项、全选、Clear共用选择事件；宿主集合与UI一致。
  - 依赖：ACT-01、LIB-02。

- [x] **ACT-05 · P2 · OTP 原生提交、reset 与错误恢复**
  - 本轮结果：`897ec48、ce2f268、065940b`。增强与旧 OTP 的单一原生提交值、4/6 位、粘贴/自动填充、错误恢复与 reset（含取消 reset）通过。
  - 状态／依据：**补全**。site/index.html:579六格无name；js/extensions.js:34–63仅发JS value且帮助文案固定six；旧forms已有4/6位和text模式。
  - 验收：在canonical OTP上提供完整值的序列化与reset；4/6位、粘贴、自动填充、错误重试及form reset后格子、帮助和FormData一致，不再造第三套。
  - 依赖：LIB-02。

- [x] **ACT-06 · P2 · 文件验证配置、清除、重选与可读屏状态**
  - 本轮结果：`897ec48`。accept/大小/数量/多文件、清除/重选、input.files/FormData、无效恢复及关联状态通过。
  - 状态／依据：**补全**。js/extensions.js:71–77硬编码ZIP/20MB，缺清除/重选状态；成功文件名仅修改普通文本。
  - 验收：accept/大小/多选限制可配置；有效→无效→重选同文件→清除路径的文案、input值和宿主状态一致；selected/not-uploaded及恢复以适当status播报。 参考：[Status messages][wcag-status]。
  - 依赖：ACT-02、LIB-07。

- [x] **ACT-07 · P2 · Split pane 的 resize 约束、尺寸事件和点击替代**
  - 本轮结果：`897ec48`。双方向约束、容器 resize、尺寸事件及 preset/数值/指针/键盘共用路径通过；registry 源码同步。
  - 状态／依据：**补全**。js/extensions.js:85–104只在拖动/按键时clamp，硬编码另一侧160px，无容器resize同步；pointer路径仅拖动。
  - 验收：统一min/max/orientation；拖宽后缩容器不溢出；尺寸事件可供宿主保存；保留键盘并提供可点击preset或数值入口。 参考：[Dragging movements][wcag-drag]。
  - 依赖：LIB-02。

- [x] **ACT-08 · P2 · Popover 用真实尺寸定位并跟随环境变化**
  - 本轮结果：`897ec48`。原生 Popover 测量实际面板，跟随 resize/scroll 并限制视口边界；长内容/320px 通过。
  - 状态／依据：**补全**。js/extensions.js:155–162按固定266/220估算，只在beforetoggle定位。
  - 验收：统一定位策略，测实际面板；短/长内容、视口边角、打开后的resize/scroll均不越界且不脱离触发器；保留原生Popover入口。
  - 依赖：LIB-02。

- [x] **ACT-09 · P1 · 旧 Date/Time picker 的键盘、日期值和约束契约**
  - 本轮结果：完成。`8c8c56b` 补齐 custom date/time 键盘、完整日期名称及约束；闰日/无效初值/边界回归与三引擎真实日期取值通过。
  - 状态／依据：**已复现/补全**。dist/odyssey.js:810–875,1060–1075；readonly输入Enter不开，日期按钮只有数字；现有自定义日历无min/max/不可选日。
  - 验收：优先复用原生date/time；保留custom时完成打开、日期导航、完整日期名称、选中/今日语义、翻月焦点、Escape恢复；支持min/max、无效初值、闰日及跨月边界。 参考：[Date picker/Combobox][apg-combo]。

- [x] **ACT-10 · P2 · Chart 可更新，并提供摘要及替代数据**
  - 本轮结果：`ce2f268`。updateChart/describeChart 更新既有 SVG、具名结论和可展开替代数据，保留宿主内容/焦点；装饰 spark 保持原 28px。
  - 状态／依据：**补全**。dist/odyssey.js:1298–1315遇ready直接return；SVG为role=img但无具名摘要；现有四类图表没有label-value数据替代。
  - 验收：明确update或重绘API；数据与标签更新不复制SVG；有意义图表提供名称、结论和可读数据表，装饰spark明确隐藏。 参考：[Non-text content][wcag-nontext]。
  - 依赖：FIX-02。

- [x] **ACT-11 · P2 · Rust 基础 helper 的普通 disabled、step 和 Range 输出**
  - 本轮结果：`414fdb3`。兼容式 _with/opts、非 busy disabled、小数 step/attrs、Range input/reset 输出；真实 CSP/FormData 夹具通过。
  - 状态／依据：**补全**。src/controls.rs:25–29,146–159按钮仅busy禁用；:384–391 NumberInput缺step/attrs；:341–369 Range值仅初始徽章。
  - 验收：兼容式新增opts/helper，保留现有struct literal；覆盖非busy禁用、小数step、Range实时输出及调用者属性传递。
  - 依赖：A11Y-03。

- [x] **ACT-12 · P2 · Rust Empty state 可配置上下文与恢复动作**
  - 本轮结果：`414fdb3`。EmptyStateOpts 可配标题/说明/CTA，保留默认 locale；首次使用/无结果/失败恢复及真实 GET/POST+CSRF 通过。
  - 状态／依据：**补全**。src/data.rs:90–102固定no-data文案且不能传CTA；public feedback已有上下文与动作。
  - 验收：保留旧本地化默认；新增可选标题、说明和CTA配置，至少展示首次使用、无搜索结果、失败恢复三种真实状态。 参考：[Empty states][carbon-empty]。

- [x] **ACT-13 · P1 · 数据表真实筛选、分页、选择计数与状态组合**
  - 本轮结果：完成。`8c8c56b` 将筛选、排序、分页和选择接到同一数据流；实际行/计数、空结果恢复与键盘排序回归通过。
  - 状态／依据：**代码确认**。site/data-display.html:575–603展示筛选/分页且已选计数硬编码0；dist/odyssey.js:1431–1480仅实现排序/checkbox；site/assets/line-site.js:36–44只切页码标签。
  - 验收：定义客户端数据表或服务端adapter；真实数据完成筛选→排序→分页→选择，显示行/总数/页码/选中数同步；排序可键盘操作并暴露状态；空结果可清除恢复。

- [x] **ACT-14 · P2 · 旧 ARIA Tree 的完整层级与键盘模型**
  - 本轮结果：`ce2f268`。旧 ARIA Tree 层级、单 Tab、上下/首尾/左右和 typeahead 通过；原生 details 不受影响。
  - 状态／依据：**代码确认**。site/data-display.html:634–642容器无tree且部分row无treeitem；dist/odyssey.js:1416–1427,1562–1570所有row tabindex=0，缺上下/Home/End。
  - 验收：保留旧入口时选完整ARIA tree或原生disclosure模型，统一层级/选中/焦点；registry原生details不强加不必要的tree箭头键规则。 参考：[Tree view][apg-tree]。
  - 依赖：LIB-02。

- [x] **ACT-15 · P1 · Kanban 除拖拽外可用点击和键盘移动**
  - 本轮结果：完成。`8c8c56b` 为原 board 增加移动到列、上移/下移及状态反馈；键盘/点击路径与既有拖拽回归通过。
  - 状态／依据：**代码确认**。site/data-display.html:740–747；dist/odyssey.js:1483–1529仅HTML5 DnD，卡片不可键盘聚焦。
  - 验收：复用既有board与事件；提供移动到列/上移下移操作，键盘及单指点击均能完成且播报结果，列计数一致。 参考：[Dragging movements][wcag-drag]。

- [x] **ACT-16 · P1 · 旧 custom Combobox 完成名称及 ARIA 状态同步**
  - 本轮结果：完成。`8c8c56b` 补齐稳定名称/controls/activedescendant/selected；过滤与空态回归、三引擎真实 guide 键盘及 AX 通过。
  - 状态／依据：**已复现**。site/forms.html:456–463；dist/odyssey.js:729–765,1011,1110–1117。方向键仅改视觉active，缺controls/activedescendant/option selected及名称连接。
  - 验收：稳定ID和可访问名称连接input/popup/option；过滤、活动项、选中、空结果、Escape的AX状态一致；保留native datalist入口。 参考：[Combobox][apg-combo]。

## 3. 无障碍、焦点和输入法：修复已经复现的阻断

责任域：a11y / controls / overlay runtime。

- [x] **A11Y-01 · P1 · 输入框边界不能复用低对比装饰分隔线**
  - 本轮结果：完成。`7cc1486`、`de7576c` 分离 control-border/hairline 并修文字角色；八主题控件边界对比最低 5.58:1，384 个浏览器 token 值检查通过。
  - 状态／依据：**已实测**。css/line.css:45,105–106；css/expressions.css:2–7。边界/背景对比实测Line暗2.18:1，Soft亮1.62/暗2.58，Studio亮1.78/暗2.84。
  - 验收：拆分交互边界token和装饰hairline；空输入框必要边界在实际相邻背景上达到3:1；覆盖四表达亮暗，不以加粗全部分隔线代替。 参考：[Non-text contrast][wcag-contrast]。

- [x] **A11Y-02 · P1 · forced-colors 下 Switch 本体可见**
  - 本轮结果：完成。`7cc1486` 的 Switch 使用系统色边框/滑块；forced-colors checked/unchecked/disabled/focus 实测与截图审阅通过。
  - 状态／依据：**已实测**。dist/odyssey.css:388–398；css/line.css:117–122,196–199。track/thumb均白且无边框，原input opacity=0，SWT只剩空白。
  - 验收：使用系统色边框/滑块或恢复原生；checked/unchecked/disabled/focus均可辨识，不能只检查焦点环。 参考：[Forced colors][forced-colors]。
  - 依赖：FIX-01。

- [x] **A11Y-03 · P1 · Rust label、hint、error 与字段真实关联**
  - 本轮结果：完成。`7cc1486` 新增兼容式 FieldOpts/field_with 并补旧 guide 关联；73 项 Rust 测试、真实字段 AX/文本重排门禁通过。
  - 状态／依据：**代码确认**。src/controls.rs:311–324,341–369；range label无for/input id，hint/error缺描述连接。site/forms.html:278–288同类示例也缺关联。
  - 验收：兼容旧签名，提供显式id/describedby/error连接路径，追加而非覆盖调用者描述；读屏能读名称、当前值、帮助和错误。 参考：[表单标签][wai-labels] / [错误通知][wai-notifications]。

- [x] **A11Y-04 · P1 · 中文/日文 IME 合成期不得执行命令或创建 chip**
  - 本轮结果：完成。`8c8c56b` 统一 composition/isComposing/229 防护，合成事件与非 IME 键盘回归通过。Safari + 原有 SCIM.ITABC 实际输入：Tag 的合成期 Return 只确认文字，下一次 Return 才创建一个 chip；拼音选字得到“中”后提交只创建一个中文 chip。Command 的合成期 Enter/Escape 不执行命令或关闭层，确认后普通 Enter 才执行并归还有效焦点。测试后恢复原设置；未增加或移除输入法。
  - 状态／依据：**已实测**。js/extensions.js:132–135；dist/odyssey.js:1121–1125,1989–1993；site/assets/patterns-20261018.js:293。isComposing Enter已复现命令执行/关闭及未完成zhong被创建chip。
  - 验收：统一处理composition状态；候选确认不触发业务动作，compositionend后正常提交；合成事件回归加真实IME抽验，保持已有非IME键盘路径。 参考：[UI Events isComposing][uievents-composing]。

- [x] **A11Y-05 · P1 · 旧 Modal/Drawer 单一语义节点与逐层焦点恢复**
  - 本轮结果：完成。`8c8c56b` 移除重复 dialog 语义并逐层记录返回焦点；嵌套/移除触发器恢复和三引擎 modal 关键路径通过。
  - 状态／依据：**已实测**。dist/odyssey.js:108,124–149。命名dialog内再次生成无名dialog；modal→drawer逆序关闭后焦点留在隐藏modal按钮。
  - 验收：每层一个具名dialog；按层记录返回焦点；嵌套、触发器删除、反向切换均回到有效目标，与既有原生dialog路径协调。 参考：[Modal dialog][apg-dialog]。

- [x] **A11Y-06 · P1 · Menu 动作关闭后交还有效焦点**
  - 本轮结果：完成。`8c8c56b` 区分普通动作、导航和新层焦点归属；关闭后有效焦点及 Escape/Tab 路径回归通过。
  - 状态／依据：**已实测**。dist/odyssey.js:168–175,503–508。registry MNU的Duplicate执行后菜单关闭，焦点仍在隐藏项。
  - 验收：普通动作回trigger；导航/开层交给目的地；Escape、Tab离开和鼠标选择一致，不抢新层焦点。 参考：[Menu button][apg-menu]。
  - 依赖：A11Y-05。

- [x] **A11Y-07 · P2 · Promise Confirm 的名称、说明与安全初始焦点**
  - 本轮结果：`ce2f268`。Confirm 唯一名称/描述、危险操作初焦 Cancel，各关闭路径均恢复有效焦点。
  - 状态／依据：**已实测**。dist/odyssey.js:1938–1960。alertdialog无可访问名称；danger初始focus在Confirm。
  - 验收：唯一labelledby/describedby；不可逆操作初始focus选Cancel；结果、Escape及关闭均恢复有效焦点。 参考：[Alert dialog][apg-alertdialog]。
  - 依赖：A11Y-05。

- [x] **A11Y-08 · P2 · Tooltip 不丢既有描述，并可移入阅读**
  - 本轮结果：`ce2f268`。Tooltip 保留既有描述，可移入/选择文本；Escape 优先关闭 tooltip，长内容回归通过。
  - 状态／依据：**已复现**。dist/odyssey.js:370–394,593–598覆盖并删除aria-describedby；原external-help实测丢失；dist/odyssey.css:2172–2177禁止指针进入。
  - 验收：追加/恢复已有描述；指针进入tooltip仍保持，Escape可关闭；长文本可读不截断，不能把必要操作藏在tooltip里。 参考：[Hover/focus content][wcag-hover]。
  - 依赖：ACT-08。

- [x] **A11Y-09 · P2 · 导航链接保留语义，busy/disabled 同时约束键盘与指针**
  - 本轮结果：`414fdb3`。Rust 导航保留 link 语义；busy/disabled 不生成可激活 href/Wire，真实指针与 Enter 均不能执行。
  - 状态／依据：**代码确认**。src/controls.rs:185–199统一role=button；busy仅aria-disabled且href仍存在，pointer-events不能拦键盘Enter。
  - 验收：导航仍是link，动作使用button；约定disabled/busy在两输入方式都不重复动作；保留原有可用href与正常导航条件。 参考：[Button][apg-button] / [aria-disabled][aria-disabled]。

- [x] **A11Y-10 · P2 · Command 无结果及状态变化可被读屏获知**
  - 本轮结果：`897ec48`。Command 空结果关联 polite status，保持输入焦点和既有 IME 保护；真实键盘/AX 通过。
  - 状态／依据：**代码确认**。js/extensions.js:114–118；site/index.html:421。空结果只改普通p，输入未关联该状态。
  - 验收：用适当status或描述告知无结果与纠正方式；不移动focus、不逐键重复读整列表；复用已具有status的station/selection计数。 参考：[Status messages][wcag-status]。
  - 依赖：LIB-07。

## 4. 库契约、设计源与文档：先让已有能力找得到、接得上

责任域：library API / design / docs。

- [x] **LIB-01 · P1 · 建立 canonical 能力目录与可校验组件 manifest**
  - 本轮结果：完成。`a0015a1`、`ebea7a2` 建立 82 能力（54 站＋28 guide/组合）的 schema/manifest 与可搜索目录；Ajv、锚点/导出/发行库存检查通过，fleet 原义不变。
  - 状态／依据：**缺失统一索引**。site/index.html:30维护54站；site/forms.html:447–683、site/feedback.html:414–784另有大量成熟站外能力；distribution.toml:1–13仅是consumer/fleet语义。
  - 验收：schema记录稳定ID、成熟度、HTML/Rust入口、CSS/JS依赖、状态、guide/设计/测试链接；搜索找到站外组件，目录/导出/发行遗漏可校验；fleet manifest保留原义。

- [x] **LIB-02 · P1 · 统一同名组件契约，明确 HTML/Rust 有意的 parity**
  - 本轮结果：完成。`a0015a1`、`ebea7a2` 明确 native/增强/页面私有/Rust parity 与有效 JSON Pointer；共享 old/new FormData fixture、生命周期及消费契约回归通过。
  - 状态／依据：**部分/双实现**。site/forms.html:646–661与js/extensions.js:34–63是两套OTP；File/Tree/Split/Command也有双入口；src/lib.rs:42–59只导出部分Rust helper。
  - 验收：选择canonical行为并保留旧入口适配；说明native/增强/页面私有及runtime边界；共享fixture验证状态/语义/事件；不强求每个HTML组件都有Rust helper或名称完全相同。
  - 依赖：LIB-01。

- [x] **LIB-03 · P1 · 提供可编译、可复制的 Rust Line 接入与 API 指南**
  - 本轮结果：完成。`7cc1486` 增加兼容的 Line shell builder/API 指南及最小 path-dependency 示例；静态/动态、locale/theme、CSRF/nonce 编译与 Rust 73 项测试通过。
  - 状态／依据：**部分**。src/shell.rs:177–210无design opt-in；examples/gallery.rs:16–69已有旧gallery；src/lib.rs已有资产/helper，现有站点主要讲HTML/data API。
  - 验收：最小path-dependency示例覆盖静态/动态shell、Line root、extensions、locale/theme、CSRF及nonce；链接Rust API参考并持续编译；无需手改完整HTML字符串，旧shell输出兼容。
  - 依赖：LIB-02、ACT-01、FIX-03。

- [x] **LIB-04 · P1 · Pencil token → CSS → 组件 → 文档可追踪同步**
  - 本轮结果：完成。`a0015a1`、`b1c5b34`、`de7576c` 建立 typed 交换/来源映射；Pencil 保留 54 reusable、原 207 变量并新增 control-border，实际读回 208 变量；8 模式边界、Line 亮暗 pigments、类型/别名/round-trip 与 384 个 CSS 值通过。
  - 状态／依据：**已有基础/缺同步契约**。Pencil现有54 reusable、207变量、四expression×亮暗及States/Extensions/Patterns画板；css/line.css:3–37、site/tokens.html:68–80仍分别维护值，tracked库无重放映射。
  - 验收：保留现有Line方向；明确token/组件语义来源、稳定节点ID及typed token映射；采用兼容DTCG的交换层或明确等价schema；检查别名/类型/差异，设计与代码共同审阅后进入新release。 参考：[DTCG 2025.10交换格式][dtcg]。
  - 依赖：LIB-01。

- [x] **LIB-05 · P2 · 组件状态矩阵、Line 尺寸与文档例子保持一致**
  - 本轮结果：`d2d828e`。93 能力适用状态、实际尺寸/密度/八主题图谱及源码片段一致；Pencil vwF4F 延展既有矩阵，变量/reusable 保留。18772 实际93行、Axe、Tab/readonly、焦点及320px通过，截图已审阅。
  - 状态／依据：**补全**。现有Pencil States画板存在；site/actions.html:97仍写Large46px，Line为48；site/layout.html:230–246间距说明落后。54站与guide状态未由manifest连结。
  - 验收：按组件适用范围列default/hover/focus/active/selected/disabled/readonly/invalid/busy/empty及长内容；四表达亮暗/密度引用同一token；示例锚点精确，尺寸说明和复制片段可验证。
  - 依赖：LIB-01、LIB-04、FIX-05。

- [x] **LIB-06 · P1 · 三套 Patterns 提供可消费的组合与状态接口**
  - 本轮结果：完成。`7cc1486`、`42fb20a` 抽取 OdysseyCompositions 的 Workspace Settings 宿主状态/保存接口；最小声明资产示例、50 项消费检查及三引擎 complete 路径通过，三 Patterns 保留。
  - 状态／依据：**已有演示/待抽取**。site/patterns.html:3加载专用CSS/JS；site/assets/patterns-20261018.js:168–225依赖页面私有结构。Release/Inbox/Settings实际已上线并完成交互验收。
  - 验收：保留三流程，列出库组件映射、最小组合、宿主数据/状态接口；至少一个流程仅加载声明资产即可运行，不依赖整页私有selector；示例状态不冒充后端授权或真实部署。
  - 依赖：LIB-02、ACT-01、ACT-13。

- [x] **LIB-07 · P2 · 运行时文案和 Line 字体接回 en/zh/ja locale**
  - 本轮结果：`ce2f268、897ec48`。共享 locale/t/register 接动态系统文案 en/zh/ja 和最近 lang 字体顺序；月份、移除名称、OTP/文件/选择/Command 状态均验证，用户内容保持原值。
  - 状态／依据：**补全**。js/extensions.js:40,71,76,142及dist/odyssey.js多处硬编码英文；css/tokens.css:58–64已有ja字体顺序，但Line输入实测PingFang先于Hiragino。
  - 验收：复用现有catalog/字符串注入；月份、状态、删除名称、OTP描述本地化；Line保留locale字体顺序；用户内容不翻译。 参考：[语言标签][w3c-language]。
  - 依赖：LIB-02。

## 5. 分发、测试和工程：已有机制需要补齐契约

责任域：release / tooling / QA。

- [x] **ENG-01 · P1 · 修复 CLI canonical-bundle 测试基线**
  - 本轮结果：完成。`807a145` 以核准的完整 canonical 文件列表取代过期数量；6 项 CLI 测试包含精确清单与相关指纹断言，统一验收通过。
  - 状态／依据：**已执行失败**。tools/odysseyctl/src/main.rs:838–853锁28文件，:662–668当前实际31；定向测试exit101，left31/right28。
  - 验收：核对新增文件后更新明确清单/基线，保留断言；定向及相关CLI测试通过；旧指纹断言尚未执行，更新时核对而不预先断言其结果。

- [x] **ENG-02 · P1 · vendored crate 的单测输入完整**
  - 本轮结果：完成。`807a145` 将 public dist 专属测试移至 server 边界；实际临时 vendor 的 cargo check 与完整 lib 单测通过，没有跳过失败测试。
  - 状态／依据：**已执行失败**。src/lib.rs:272–280读取../dist/odyssey.js；canonical vendor只带Cargo/css/js/src。等价临时fixture的cargo test --lib --no-run缺文件，cargo check --lib通过。
  - 验收：正常消费构建与vendor自身单测编译均通过；将public dist专属测试放到正确边界，或明确测试输入；保持既有vendor payload/入口，不能靠跳过测试。

- [x] **ENG-03 · P1 · 明确发行身份、兼容/迁移及 stable/canary 条件**
  - 本轮结果：完成。`5112206` 在 release manifest/RELEASES.md 映射 Cargo 0.1.0、Rust 1.4.0-canary.1、public 1.4.0、Line 与 shell 1.3；兼容/弃用/晋级条件及候选身份一致性检查通过。
  - 状态／依据：**部分**。Cargo.toml:3为0.1.0；distribution.toml:2为1.4 canary；公开build仍1.3。FLEET.md:249–257已有immutable和runtime边界。
  - 验收：元数据映射Cargo/internal/public/design-layer身份；列出弃用、breaking changes、迁移与本版本晋级证据；不强行统一版本号，不借旧canary窗口为新release背书。 参考：[SemVer][semver]。
  - 依赖：LIB-01。

- [x] **ENG-04 · P1 · Line/Expressions/Extensions 可 pin 的完整公开发行组合**
  - 本轮结果：完成。`5112206` 实现完整候选、原子冻结/拒绝覆写及 pin 路由；`1679791` 冻结 20 文件并仅部署 OVH Odyssey。正式 `/1.4.0/` 全部资产与已验收候选及公网逐字节一致、一年 immutable；modular/complete/自托管通过，1.1/1.2/1.3 和兼容 aliases 保持原字节。VoiceOver 人工抽验按用户决定延期，见 ENG-09。
  - 状态／依据：**部分**。tools/build-public-dist.sh:14–38仅生成1.3 core/profile/canary；Line/Extensions仍可变assets，冻结1.3明确不含Line。
  - 验收：新增完整immutable资产URL及自托管文件清单；core/Line/fonts/extensions组合版本相容；冻结1.1/1.2/1.3不覆写，旧assets兼容；仅准备Odyssey发行，不自动同步消费者。
  - 依赖：ENG-03、LIB-02。

- [x] **ENG-05 · P1 · CDN/自托管/Line 安装说明指向同一明确 release**
  - 本轮结果：完成。`5112206` 将 13 个 Odyssey 页面和安装说明统一 pin 到 1.4.0，模块化/complete 空白 fixture 及自托管候选通过三引擎。切换后独立 Chromium 直接请求真实 HTTPS `/1.4.0/` CSS/JS/字体，modular、complete、真实 Forms 三入口通过，运行时版本 1.4.0；生产 Patterns 入口 48 项断言通过。
  - 状态／依据：**文档不一致**。site/getting-started.html:218–222把CDN1.1和当前dist称同产物，FLEET.md:249当前dist为1.3；Line还需额外assets。
  - 验收：给出同release的完整文件列表和最小片段；复制到空白HTML、自托管及Line/extensions三条路径得到声明的组件版本/行为，无漏依赖。
  - 依赖：ENG-04、LIB-03。

- [x] **ENG-06 · P1 · 浏览器测试环境在 Odyssey 内可独立复现**
  - 本轮结果：完成。`3c54755`、`bc907b2` 固定本仓 Node/Playwright/Axe/Ajv 与 lockfile、安装/运行入口；干净 GitHub runner 和 Linux 官方浏览器镜像实际安装并运行，不依赖其他产品 node_modules。
  - 状态／依据：**部分**。tools/browser-runtime/package.json:1–5无依赖/脚本；tools/install-canary-gate.sh:25,109–112从别的产品复制Playwright。既有安装器已有runtime pin。
  - 验收：在本项目声明支持Node/Playwright/browser版本及安装执行入口；干净环境可跑已有测试，不依赖其他产品node_modules；复用Playwright，不要求换框架。

- [x] **ENG-07 · P1 · 将现有测试连成一个仓库持续验收入口**
  - 本轮结果：完成。`5112206` 的 tools/verify.sh 串联格式/Rust/CLI/vendor/server/发行/契约/浏览器，GitHub CI 调用同入口；真实 run 39130254060 全绿，systemd collector 职责保留。
  - 状态／依据：**tracked配置缺失**。Dockerfile:23–24只build；Rust/CLI/Node gate和browser测试已存在但分散，tracked基线未见CI或统一任务入口。
  - 验收：统一入口执行约定format/build/test、发行一致性及消费fixture；CI调用同入口并阻止失败发行；保留systemd collector的线上观察职责。
  - 依赖：ENG-01、ENG-02、ENG-06。

- [x] **ENG-08 · P1 · 声明浏览器支持范围并验证跨引擎降级**
  - 本轮结果：完成。`bc907b2`、`4aa91d1` 声明锁定引擎支持基线；Linux Chromium/Firefox/WebKit 九条入口通过，Firefox/WebKit 无 interpolate-size 时 disclosure 正常；macOS Firefox 宿主启动问题单独保留。
  - 状态／依据：**未验证**。line/extensions/patterns-browser.test.mjs仅Chromium；css/extensions.css:36–54用details-content/interpolate-size/popover/discrete transitions。
  - 验收：明确最低支持范围；对承诺引擎验证关键控件、键盘和progressive fallback。未测写成未验证，而非直接宣称不支持。
  - 依赖：ENG-06、ENG-07。

- [ ] **ENG-09 · P1 · 复用既有 pattern/a11y helper，扩展当前库验收**
  - 本轮结果：部分完成。`200c8c2` 审阅并纳入既有 helper 及其失败 fixture；本候选 26 项 Axe/真实 Tab/AX/合成 IME/200%/文本间距/forced-colors/无 JS 门禁通过，真实 Safari/SCIM 输入另见 A11Y-04。VoiceOver 实际启动及 AppleScript 辅助尝试仍未取得四控件的有效朗读/导航结果；用户明确决定“直接推动生产”，本次延期，不计通过。VoiceOver 已恢复关闭，临时设置恢复。后续责任域为 a11y，恢复条件是可用的真实 VoiceOver 导航通道；外部四产品报告不计入本库通过。
  - 状态／依据：**部分/待接纳**。当前测试已有部分键盘、reduced-motion、touch/no-JS；远端另有未跟踪pattern-assertions.mjs、tests及patterns/ACCEPTANCE.md，报告四产品证据，未纳入本基线。
  - 验收：先审阅、核证并版本化现有helper，复用assertSurface(AxeBuilder)/native form/真实Tab；覆盖旧guide、AX关联、IME、200%文本/文本间距、forced-colors，并对custom combo/date/tree/modal做VoiceOver抽验。外部报告不直接算本库通过。 参考：[Text spacing][wcag-spacing] / [Reflow][wcag-reflow]。
  - 依赖：ENG-06、ENG-07、LIB-01。

- [x] **ENG-10 · P2 · 已有截图升级为可审阅的视觉回归**
  - 本轮结果：`a47b346、e018b33`。现有 Playwright 真正 PNG 差分：macOS/Linux 各4张人工接受基线；像素故障 fixture 实际失败，缺图和未授权 -u 不会自动更新。
  - 状态／依据：**部分**。tools/tests/line-browser.test.mjs:24,50,66及tools/tests/extensions-browser.test.mjs:32–40,64已有可选截图，未见图像差分断言。
  - 验收：少量关键基线经人工接受；固定字体/数据/运动，覆盖代表性表达/主题/宽度/浮层；有差异审阅和更新流程，复用现有截图而非另造平台。
  - 依赖：ENG-06、ENG-07、LIB-05。

- [x] **ENG-11 · P2 · 按真实消费建立字节/初始化预算与按需组合**
  - 本轮结果：`a47b346`。按需/core/fonts/complete/可选模块的实际字节与初始化/reinit预算已接统一门禁；实测中位0.2/0.1ms，最终整合门禁复核阈值。
  - 状态／依据：**部分**。src/lib.rs:1–29已有全量与可选常量；:182–185,233约束JS行数。当前未压缩core CSS/JS约168506/105406 bytes，Line字体层82365 bytes。
  - 验收：测量必要字节、初始化与重复初始化成本；明确core/fonts/Line/extensions/runtime组合；基于真实页面制定预算；旧全量入口可用，不预设npm/bundler。
  - 依赖：ENG-04、LIB-01。

- [x] **ENG-12 · P2 · 严格 CSP 有完整可选接入路径**
  - 本轮结果：`414fdb3`。CspShellOpts/csp_page_shell 完整 nonce CSS/字体/scripts 与品牌样式，默认旧入口不变；真实 HTTP/Wire/Motion/表单与320px通过。
  - 状态／依据：**部分**。src/lib.rs:61–114已有script nonce；src/shell.rs:200–203,229仍生成style属性及无nonce style block。
  - 验收：提供完整CSP示例及浏览器fixture，样式/字体/交互都可用；标准shell增加兼容式opt-in，默认调用保持可用；不能只给JS nonce就宣称整页通过。
  - 依赖：LIB-03、ENG-07。

- [x] **ENG-13 · P2 · 确认项目许可及发行元数据**
  - 本轮结果：`a47b346`。项目 owner 明确确认 MIT；LICENSE、repository/MSRV 1.87 与 Inter/Archivo/Azeret OFL 随新发行保留，旧 immutable 不变。
  - 状态／依据：**占位信息**。dist/odyssey.css:9写MIT placeholder；Cargo.toml:1–7无license/repository/rust-version；tracked无项目LICENSE，两份字体OFL已存在。
  - 验收：由项目owner确认许可后写入新发行和元数据，保留字体notice；历史immutable snapshot不覆写，所需补充notice另行发布。许可选项由owner决定，TODO不代替授权。

- [x] **ENG-14 · P2 · 构建脚本不能静默保留旧版本标记**
  - 本轮结果：`a47b346`。核实既有 Node wrapper 已消除 sed 平台差异；新 CSS/JS RELEASE 身份缺失会拒绝构建，macOS 与 Linux 构建/读取实证通过。
  - 状态／依据：**最小复现**。tools/build-public-dist.sh:23–34使用sed的0,/…/地址；macOS /usr/bin/sed实测exit0但版本仍v1.1.0。Docker已pin Rust镜像，Cargo未声明最低版本。
  - 验收：使用支持平台兼容的替换，或显式检查GNU工具前提；生成后断言release identity；记录Rust/Node/shell支持范围，版本替换失败必须报错。
  - 依赖：ENG-03、ENG-06。

## 6. 工作流与高级输入：补组合能力，不接管业务后端

责任域：pattern / forms / application integration。

- [x] **PAT-01 · P2 · 异步/长任务状态与错误恢复模板**
  - 本轮结果：`ef36897`。mountTask 的 queued/running/cancelling/unknown-result/error/offline/denied/retry 可消费；成功须匹配来源 receipt，取消须确认，竞态通过。
  - 状态／依据：**组合缺口**。Patterns仅本地demo状态；既有Wire已处理请求错误，远端application-interactions.md已有queued/running/cancelling/unknown-result及receipt语义。
  - 验收：接纳并链接现有契约；提供可配置loading/empty/error/permission/offline/unknown-result/cancel/retry组合与fake adapter；仅源确认终态显示成功，不从计时猜百分比；宿主负责数据/权限/操作身份。 参考：[Loading][carbon-loading]。
  - 依赖：LIB-06、ENG-09。

- [x] **PAT-02 · P2 · 登录、MFA、凭据恢复与会话过期界面模板**
  - 本轮结果：`ef36897`。原生密码管理器字段、MFA/恢复/过期返回、提交拒绝与重试，宿主 auth adapter 独立消费通过。
  - 状态／依据：**新增组合**。forms已有password及OTP，i18n已有sign_in文案，但当前site/patterns仅三流程，无完整账户入口与恢复模板。
  - 验收：组合已有字段/OTP/通知，覆盖提交中、错误、MFA重试、恢复、过期后返回；支持密码管理器/自动填充；认证、SSO及passkey调用由宿主adapter处理，不在UI库新造认证服务。 参考：[Login pattern][carbon-login]。
  - 依赖：ACT-05、A11Y-03、LIB-07。

- [x] **PAT-03 · P2 · 多步骤表单、Onboarding 和问卷状态编排**
  - 本轮结果：`ef36897`。mountWizard 关联 Stepper/fieldset、可跳过步骤、校验焦点、返回保留答案、草稿恢复和最终来源确认通过。
  - 状态／依据：**已有Step指示/缺编排**。site/data-display.html:689–707有Stepper/Wizard指示，dist:1554–1556只切步骤状态；缺关联分步字段、校验、返回和完成流程。
  - 验收：复用Stepper/原生fieldset；明确当前步骤、可返回/可跳过、验证失败焦点、保留答案与最终提交；草稿持久化和分支由宿主决定。 参考：[Questionnaire组合参考][questionnaire]。
  - 依赖：A11Y-03、LIB-06。

- [x] **PAT-04 · P2 · 多字段过滤、Query chips 与保存视图**
  - 本轮结果：`4fe71e3、f77463c`。复合过滤/query chips、白名单字段序列化、结果数、命名保存/恢复视图与 URL 返回通过。
  - 状态／依据：**补全组合**。已有Multi-select/Tag input及Inbox筛选；ACT-13处理表格基本数据流，尚无跨列表的复合过滤/保存视图契约。
  - 验收：给出可复制filter toolbar与序列化状态模型：条件增删、清除、结果数、保存/恢复视图、URL返回；query字段白名单与后端查询均宿主拥有。 参考：[Search pattern][carbon-search]。
  - 依赖：ACT-03、ACT-13、LIB-06。

- [x] **PAT-05 · P2 · 文件队列的进度、取消、重试与恢复 UI**
  - 本轮结果：`ef36897`。文件任务逐项 queued/running/success/error/cancelling，来源进度、确认取消/重试、同名身份与晚回包隔离通过。
  - 状态／依据：**输入已有/缺任务展示**。旧/新dropzone都有本地选择；现有库未提供可绑定真实上传状态的多文件任务队列。
  - 验收：在ACT-06基础上显示每文件queued/uploading/success/error/cancelling；进度仅取adapter，取消确认后才终止显示；失败可重试且同文件状态不混淆；不内置存储服务。
  - 依赖：ACT-06、PAT-01。

- [x] **PAT-06 · P2 · 可复用 Code / Log / Diff 展示组件**
  - 本轮结果：`4fe71e3、f77463c`。安全纯文本 Code/Log/Diff、行号/换行/折叠/复制不带装饰、追加日志保持阅读位置通过；不引入基础高亮引擎。
  - 状态／依据：**页面私有/待抽取**。css/components.css:642–654已有Markdown排版；Patterns有私有diff和checks日志，guide有pre/code/copy，但缺独立内容/行/状态契约。
  - 验收：抽取纯文本安全默认、行号/换行/折叠/复制/新增删除标记；复制不混入行号和diff装饰；长日志增量更新不抢滚动，语法高亮可选且不拖入基础包。 参考：[Code Block][code-block]。
  - 依赖：LIB-06、ENG-11。

- [ ] **PAT-07 · P3 · 富文本/Markdown 编辑及提及、附件组合**
  - 状态／依据：**新增领域组合**。已有Markdown展示和inline editable，不等于富文本编辑器；当前src/JS未见contenteditable编辑模型。
  - 验收：先按内容产品需求选成熟编辑内核或提供adapter；完成工具栏键盘、selection/undo、粘贴与安全内容边界、mention/attachment状态；不自行实现通用编辑引擎。
  - 依赖：PAT-06、ACT-06。

- [x] **PAT-08 · P2 · Calendar 的事件、范围与 Agenda**
  - 本轮结果：`4fe71e3、f77463c`。月切换、Shift 范围、事件/空态/Agenda 同步；date-only 与宿主时区标签、键盘取值通过。
  - 状态／依据：**静态展示/待产品化**。site/data-display.html:710–737有静态月网格，日期输入已有picker；它们尚非可绑定事件的排期视图。
  - 验收：复用日期值契约；月切换、选中范围、事件列表/空态与agenda同步；明确date-only和时区时间，不在UI层发明时区换算；资源排期作为后续可选变体。
  - 依赖：ACT-09、LIB-07。

- [x] **PAT-09 · P2 · 成员、角色权限与通知偏好面板**
  - 本轮结果：`ef36897`。源返回成员/角色矩阵、邀请、拒绝/只读、通知渠道/频率，保存失败保留草稿和恢复通过。
  - 状态／依据：**新增组合**。现有Settings仅workspace名/slug/appearance；已有Inbox和旧Notification center，不等于权限编辑/偏好工作流。
  - 验收：提供角色矩阵、成员邀请状态、只读/拒绝及通知渠道/频率组合；展示源返回权限，不能把隐藏按钮或本地选项当授权；保存/失败恢复和不可修改状态清楚。
  - 依赖：LIB-06、PAT-01。

- [x] **PAT-10 · P2 · 资源选择、版本固定与来源可用性模板**
  - 本轮结果：`4fe71e3、f77463c`。资源搜索/分页/来源不可用/权限拒绝、follow-current 或 pin 真实版本身份；重试与来源恢复通过。
  - 状态／依据：**外部已有参考/库中待接纳**。远端patterns/application-interactions.md及ACCEPTANCE.md报告Workspaces/resource-kit参考路径；当前tracked Odyssey无可消费picker组合。
  - 验收：先核实并复用参考，再抽取搜索/分页/来源不可用/权限拒绝/跟随当前或pin版本组合；保留真实资源身份，不将不可用来源当成功空列表；仅新增Odyssey示例，不推广其他产品。
  - 依赖：LIB-06、ENG-09、PAT-01。

## 7. 规模与领域扩展：按产品需求启动

责任域：advanced data / content / i18n。

- [x] **EXT-01 · P2 · 长列表/表格/Tree 的可访问虚拟化**
  - 本轮结果：`4fe71e3、f77463c`。真实10,000行与初始11行DOM对比；list/read-only table-grid/host-flattened tree 的动态高度、键盘定位、总数/索引、选中焦点和返回恢复通过；WebKit RO 同步重建循环已修。
  - 状态／依据：**新增规模能力**。现有TBL/LST/TRE已实现基础展示/部分行为；当前src/JS/发行API未见virtualizer，缺大集合消费契约。
  - 验收：先用真实大集合测基线，再选可选adapter/实现；约束DOM/初始化预算，支持动态高度、键盘定位、总行数/索引及返回位置，不因虚拟化丢焦点或选择。 参考：[Virtualizer参考][virtualizer]。
  - 依赖：ACT-13、ACT-14、ENG-11。

- [ ] **EXT-02 · P3 · TreeGrid / 可编辑层级数据表**
  - 状态／依据：**新增组件**。已有Tree和Table分别存在；当前catalog/API无层级行+列的统一交互模型。
  - 验收：有实际层级表格需求再启动；支持展开行、单元格/行导航、选择与编辑模式切换及正确层级语义；不把普通导航Tree升级成复杂grid。 参考：[APG Treegrid][apg-treegrid]。
  - 依赖：ACT-13、ACT-14。

- [x] **EXT-03 · P2 · 多序列、轴、图例、时间域和专业图表入口**
  - 本轮结果：`4fe71e3、f77463c`。多序列/轴/单位/图例、时间/数值域、空段/负值与可选宿主 renderer，复用 core 摘要及完整替代表；真实交互通过。
  - 状态／依据：**补全图表体系**。已有bar/line/donut/spark不缺基础图表；现有data-values只覆盖轻量统计，缺分析图表的统一数据/交互契约。
  - 验收：先补轴/单位/图例与多序列、时间/数值域、空值/负值；按场景评估scatter/heatmap/histogram等可选adapter，数据摘要与替代读取沿用ACT-10，不把完整图表引擎塞进core。 参考：[Carbon图表范围][carbon-charts]。
  - 依赖：ACT-10、ENG-11。

- [ ] **EXT-04 · P3 · AI/Agent 消息、流式输出与执行轨迹**
  - 状态／依据：**新增领域组合**。现有Timeline/Command/Code/Popover可组合，但当前库无消息流、来源引用、tool状态/审批/中止的共用模式。
  - 验收：提供prompt+attachment、message/streaming、sources/citation、tool trace、确认与cancel/retry组合；流式不抢用户阅读位置，播报可控；只呈现宿主提供的可见状态，不伪造模型内部推理。 参考：[AI Elements组合参考][ai-elements] / [Trace][trace]。
  - 依赖：PAT-01、PAT-05、PAT-06。

- [ ] **EXT-05 · P3 · 数据导入、列映射、预检与导出反馈**
  - 状态／依据：**新增组合**。已有文件输入、Table及Stepper，不等于可恢复的数据导入流程。
  - 验收：复用文件队列和分步表单；样本预览、列映射、行级错误、批次结果与导出状态清晰；文件解析/业务写入/权限由宿主适配，不在库中实现数据库导入。
  - 依赖：PAT-03、PAT-05、ACT-13。

- [ ] **EXT-06 · P3 · 图片/附件预览与可访问 Lightbox**
  - 状态／依据：**新增媒体组件**。已有Avatar initials、文件选择与Markdown图片排版；当前registry/guide未见统一media viewer、加载/失败替代及缩放预览契约。
  - 验收：提供image/attachment loading/error/fallback及可关闭预览；焦点/键盘/替代文本正确，图片保持比例，音视频优先原生控件；重型PDF/3D查看器仅adapter，不默认捆绑。
  - 依赖：ACT-06、A11Y-05、ENG-11。

- [ ] **EXT-07 · P3 · RTL/bidi 与繁体等新增 locale 的显式支持**
  - 状态／依据：**支持范围扩展**。src/i18n/mod.rs:24–29,60–71当前仅en/zh/ja且zh-Hant折到简体；shell无direction接口，extensions仍有physical left与LTR split计算。
  - 验收：先决定新增locale范围；RTL传递dir、逻辑属性、方向相关键盘/拖动及bidi隔离；繁体作为独立翻译覆盖校验，不宣称当前已支持；不阻塞现有三locale修复。 参考：[HTML Direction][w3c-dir]。
  - 依赖：LIB-07。

## 官方对照资料

调查读取日期：2026-10-18。具体条目引用直接指向所采用的行为或能力来源。

- [shadcn/ui 组件目录][shadcn-catalog]、[Fluent 2 Web 组件][fluent-catalog]：对照常见控件覆盖及组合层级。
- [React Aria][react-aria]、[Virtualizer][virtualizer]：对照复杂交互与规模能力，不要求采用其框架。
- [Carbon Patterns][carbon-patterns]、[Empty states][carbon-empty]、[图表目录][carbon-charts]：对照组合工作流、恢复状态及数据呈现。
- WAI-ARIA APG、WCAG 2.2 Understanding 与 UI Events：条目中的具体交互/可访问性验收来源。
- [DTCG 2025.10][dtcg] 是设计令牌交换格式的 Community Group 报告，作为互操作参考；[SemVer][semver] 用于兼容与发行身份约定。

[shadcn-catalog]: https://ui.shadcn.com/docs/components
[fluent-catalog]: https://fluent2.microsoft.design/components/web/react
[react-aria]: https://react-aria.adobe.com/
[virtualizer]: https://react-aria.adobe.com/Virtualizer
[carbon-patterns]: https://www.carbondesignsystem.com/building-blocks/core/patterns/overview
[carbon-empty]: https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states
[carbon-loading]: https://www.carbondesignsystem.com/building-blocks/core/patterns/loading
[carbon-login]: https://www.carbondesignsystem.com/building-blocks/core/patterns/login
[carbon-search]: https://www.carbondesignsystem.com/building-blocks/core/components/search/guidelines
[carbon-charts]: https://www.carbondesignsystem.com/building-blocks/data-visualization/overview
[questionnaire]: https://ui.shadcn.com/docs/components/base/questionnaire
[code-block]: https://ui.shadcn.com/docs/components/base/code-block
[ai-elements]: https://ui.shadcn.com/docs/ai-elements
[trace]: https://ui.shadcn.com/docs/components/base/trace
[dtcg]: https://www.designtokens.org/tr/2025.10/format/
[semver]: https://semver.org/
[apg-combo]: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
[apg-listbox]: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
[apg-tree]: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
[apg-treegrid]: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/
[apg-dialog]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
[apg-alertdialog]: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
[apg-menu]: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
[apg-button]: https://www.w3.org/WAI/ARIA/apg/patterns/button/
[aria-disabled]: https://www.w3.org/TR/wai-aria-1.2/#aria-disabled
[wcag-reflow]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[wcag-contrast]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[wcag-nontext]: https://www.w3.org/TR/WCAG22/#non-text-content
[wcag-drag]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
[wcag-status]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
[wcag-spacing]: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
[wcag-hover]: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
[forced-colors]: https://www.w3.org/TR/css-color-adjust-1/#forced-colors-mode
[wai-labels]: https://www.w3.org/WAI/tutorials/forms/labels/
[wai-notifications]: https://www.w3.org/WAI/tutorials/forms/notifications/
[uievents-composing]: https://www.w3.org/TR/uievents/#dom-keyboardevent-iscomposing
[w3c-language]: https://www.w3.org/International/questions/qa-choosing-language-tags
[w3c-dir]: https://www.w3.org/International/questions/qa-html-dir

