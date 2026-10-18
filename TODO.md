# Odyssey TODO

更新：2026-10-18 · Line 主线组件库系统调查

## 先修可复用性，再扩大组件数量

**54 个站点不是 Odyssey 的全部能力。** 旧 guide/runtime 已有多选、Tag input、Date/Time picker、Dual-range、Rating、Notification center、Context menu、Bottom sheet、Carousel、Hover card、Calendar、Kanban 等。当前最缺的是统一能力目录、同名控件契约、Line 兼容性和稳定消费路径，而不是再做一遍这些控件。

本清单共 **70 项：P1 33、P2 31、P3 6**。条目已合并重复发现；“已复现”指问题已得到证据，仍是未修复待办。“新增组合/领域扩展”是设计建议，不代表现有能力故障。

### 调查基线和边界

- 源码/测试基线：`67a2d4ec99d0f7dad632317e8d1140b4f59c6454`；已上线运行代码：`736284240c35c5722cdda154dad5272c141a7d35`。本文源文件行号按该基线定位。
- 已只读确认 OVH Odyssey 当前镜像 healthy；调查中未修改运行代码、生产容器或消费者。
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

- [ ] **FIX-01 · P1 · 修复带可见标签的 Switch 布局**
  - 状态／依据：**已复现**。css/line.css:117–122；site/forms.html:229–270。整个 label 被固定为38×20；六字标签实测被挤成约12.94×124.78px竖列并重叠。
  - 验收：尺寸限制只落在轨道；标准__control结构及registry简化结构均支持长中英文、换行、checked/disabled/focus，不破坏旧markup。 参考：[Reflow][wcag-reflow]。

- [ ] **FIX-02 · P1 · 隔离简例 Chart 样式，恢复四类 SVG 图表布局**
  - 状态／依据：**已复现**。css/line.css:164–165；site/data-display.html:665–674。bar/line容器高88但SVG高149，donut为88/140；行内spark也被撑高88。
  - 验收：registry柱状简例使用专用作用域；已有bar/line/donut/spark保持各自比例、标题间距及行内尺寸，亮暗和窄容器均不重叠。

- [ ] **FIX-03 · P1 · 补全 Rust/public Line 角色映射，保留语义 Tone**
  - 状态／依据：**代码确认**。css/line.css:69–84未映射--brand/--info*；:147将Alert轨道统一warning，:151将Progress统一Line蓝；css/components.css:297,659。
  - 验收：Rust/public两入口的Button、Pill、Alert、Progress、Empty角色一致；ok/warn/down/info语义不被线路家族色覆盖，不能只依赖颜色表达状态。

- [ ] **FIX-04 · P1 · 修复 Rust Line busy spinner 的关键帧引用**
  - 状态／依据：**代码确认**。css/line.css:170–172使用ody-spin；css/components.css:278–284只定义odyssey-spin；src/lib.rs:1–9的APP_CSS不含public dist关键帧。
  - 验收：仅加载APP_CSS的busy按钮能旋转；减少动效时仍有可辨识busy状态且不旋转，避免为此要求加载public全量包。

- [ ] **FIX-05 · P1 · 统一 root / table / 旧 modifier 三种 density 入口**
  - 状态／依据：**已复现**。css/line.css:139–140仅识别table自身data-density=compact；旧.ody-table--compact实测仍44px；Patterns使用root density。
  - 验收：明确可继承的comfortable/compact契约；兼容旧modifier；表格、列表、字段和工具栏在同一偏好下按约定缩放，触摸目标不随视觉密度失去可用性。

- [ ] **FIX-06 · P1 · 恢复 Rust 表格窄容器中的完整数据可读性**
  - 状态／依据：**代码确认**。src/data.rs:43输出.table-wrap；css/components.css:315为overflow:hidden，public .ody-table-wrap为overflow:auto。
  - 验收：320px容器内长表能横向读取全部列；宿主页不被撑开；键盘用户能进入滚动区域，既有表格入口保持可用。

## 2. 控件运行时与数据能力：把展示补成可消费契约

责任域：组件 runtime / forms / data。

- [ ] **ACT-01 · P1 · 扩展组件支持 root 自身、动态子树和幂等初始化**
  - 状态／依据：**已复现**。js/extensions.js:164–187只扫描后代；最小DOM探针init(otpRoot)绑定0监听，传父容器绑定24。
  - 验收：沿用已有root自身+后代扫描模式；明确与Odyssey.init/Wire更新的接线；初始页面、根自身、动态插入、重复init均正确，监听不重复。
  - 依赖：LIB-02。

- [ ] **ACT-02 · P1 · 拖入文件必须进入原生 input / FormData**
  - 状态／依据：**已复现**。js/extensions.js:69–83仅更新文案与ody:file-selected；有效ZIP拖入后input.files仍0。旧dist/odyssey.js:939–947已有DataTransfer回写。
  - 验收：优先复用成熟文件输入契约；browse/drop产生相同FormData及变更事件；原生提交真的携带已显示文件。网络上传仍由宿主提供。

- [ ] **ACT-03 · P1 · 修复 Multi-select 的键盘模型与 chip 变更事件**
  - 状态／依据：**已复现**。site/forms.html:483–493；dist/odyssey.js:792–793,1042–1052。Enter不开、option只有点击；chip删除不发选择时约定的ody:change，删除名称仅Remove。
  - 验收：选定一致的listbox/combobox模型；Enter/Space、方向键、Escape可完成选择；删除名称含项目名；点选/移除/清空均发一次一致values事件，移除后焦点有效。 参考：[Listbox][apg-listbox]。

- [ ] **ACT-04 · P2 · Selection toolbar 初始化、Clear 与批量变更同步**
  - 状态／依据：**代码确认**。js/extensions.js:138–149未在init调用update；Clear直接改checked，不发change或选择事件。
  - 验收：从真实checkbox初值计算0/N计数和显隐；单项、全选、Clear共用选择事件；宿主集合与UI一致。
  - 依赖：ACT-01、LIB-02。

- [ ] **ACT-05 · P2 · OTP 原生提交、reset 与错误恢复**
  - 状态／依据：**补全**。site/index.html:579六格无name；js/extensions.js:34–63仅发JS value且帮助文案固定six；旧forms已有4/6位和text模式。
  - 验收：在canonical OTP上提供完整值的序列化与reset；4/6位、粘贴、自动填充、错误重试及form reset后格子、帮助和FormData一致，不再造第三套。
  - 依赖：LIB-02。

- [ ] **ACT-06 · P2 · 文件验证配置、清除、重选与可读屏状态**
  - 状态／依据：**补全**。js/extensions.js:71–77硬编码ZIP/20MB，缺清除/重选状态；成功文件名仅修改普通文本。
  - 验收：accept/大小/多选限制可配置；有效→无效→重选同文件→清除路径的文案、input值和宿主状态一致；selected/not-uploaded及恢复以适当status播报。 参考：[Status messages][wcag-status]。
  - 依赖：ACT-02、LIB-07。

- [ ] **ACT-07 · P2 · Split pane 的 resize 约束、尺寸事件和点击替代**
  - 状态／依据：**补全**。js/extensions.js:85–104只在拖动/按键时clamp，硬编码另一侧160px，无容器resize同步；pointer路径仅拖动。
  - 验收：统一min/max/orientation；拖宽后缩容器不溢出；尺寸事件可供宿主保存；保留键盘并提供可点击preset或数值入口。 参考：[Dragging movements][wcag-drag]。
  - 依赖：LIB-02。

- [ ] **ACT-08 · P2 · Popover 用真实尺寸定位并跟随环境变化**
  - 状态／依据：**补全**。js/extensions.js:155–162按固定266/220估算，只在beforetoggle定位。
  - 验收：统一定位策略，测实际面板；短/长内容、视口边角、打开后的resize/scroll均不越界且不脱离触发器；保留原生Popover入口。
  - 依赖：LIB-02。

- [ ] **ACT-09 · P1 · 旧 Date/Time picker 的键盘、日期值和约束契约**
  - 状态／依据：**已复现/补全**。dist/odyssey.js:810–875,1060–1075；readonly输入Enter不开，日期按钮只有数字；现有自定义日历无min/max/不可选日。
  - 验收：优先复用原生date/time；保留custom时完成打开、日期导航、完整日期名称、选中/今日语义、翻月焦点、Escape恢复；支持min/max、无效初值、闰日及跨月边界。 参考：[Date picker/Combobox][apg-combo]。

- [ ] **ACT-10 · P2 · Chart 可更新，并提供摘要及替代数据**
  - 状态／依据：**补全**。dist/odyssey.js:1298–1315遇ready直接return；SVG为role=img但无具名摘要；现有四类图表没有label-value数据替代。
  - 验收：明确update或重绘API；数据与标签更新不复制SVG；有意义图表提供名称、结论和可读数据表，装饰spark明确隐藏。 参考：[Non-text content][wcag-nontext]。
  - 依赖：FIX-02。

- [ ] **ACT-11 · P2 · Rust 基础 helper 的普通 disabled、step 和 Range 输出**
  - 状态／依据：**补全**。src/controls.rs:25–29,146–159按钮仅busy禁用；:384–391 NumberInput缺step/attrs；:341–369 Range值仅初始徽章。
  - 验收：兼容式新增opts/helper，保留现有struct literal；覆盖非busy禁用、小数step、Range实时输出及调用者属性传递。
  - 依赖：A11Y-03。

- [ ] **ACT-12 · P2 · Rust Empty state 可配置上下文与恢复动作**
  - 状态／依据：**补全**。src/data.rs:90–102固定no-data文案且不能传CTA；public feedback已有上下文与动作。
  - 验收：保留旧本地化默认；新增可选标题、说明和CTA配置，至少展示首次使用、无搜索结果、失败恢复三种真实状态。 参考：[Empty states][carbon-empty]。

- [ ] **ACT-13 · P1 · 数据表真实筛选、分页、选择计数与状态组合**
  - 状态／依据：**代码确认**。site/data-display.html:575–603展示筛选/分页且已选计数硬编码0；dist/odyssey.js:1431–1480仅实现排序/checkbox；site/assets/line-site.js:36–44只切页码标签。
  - 验收：定义客户端数据表或服务端adapter；真实数据完成筛选→排序→分页→选择，显示行/总数/页码/选中数同步；排序可键盘操作并暴露状态；空结果可清除恢复。

- [ ] **ACT-14 · P2 · 旧 ARIA Tree 的完整层级与键盘模型**
  - 状态／依据：**代码确认**。site/data-display.html:634–642容器无tree且部分row无treeitem；dist/odyssey.js:1416–1427,1562–1570所有row tabindex=0，缺上下/Home/End。
  - 验收：保留旧入口时选完整ARIA tree或原生disclosure模型，统一层级/选中/焦点；registry原生details不强加不必要的tree箭头键规则。 参考：[Tree view][apg-tree]。
  - 依赖：LIB-02。

- [ ] **ACT-15 · P1 · Kanban 除拖拽外可用点击和键盘移动**
  - 状态／依据：**代码确认**。site/data-display.html:740–747；dist/odyssey.js:1483–1529仅HTML5 DnD，卡片不可键盘聚焦。
  - 验收：复用既有board与事件；提供移动到列/上移下移操作，键盘及单指点击均能完成且播报结果，列计数一致。 参考：[Dragging movements][wcag-drag]。

- [ ] **ACT-16 · P1 · 旧 custom Combobox 完成名称及 ARIA 状态同步**
  - 状态／依据：**已复现**。site/forms.html:456–463；dist/odyssey.js:729–765,1011,1110–1117。方向键仅改视觉active，缺controls/activedescendant/option selected及名称连接。
  - 验收：稳定ID和可访问名称连接input/popup/option；过滤、活动项、选中、空结果、Escape的AX状态一致；保留native datalist入口。 参考：[Combobox][apg-combo]。

## 3. 无障碍、焦点和输入法：修复已经复现的阻断

责任域：a11y / controls / overlay runtime。

- [ ] **A11Y-01 · P1 · 输入框边界不能复用低对比装饰分隔线**
  - 状态／依据：**已实测**。css/line.css:45,105–106；css/expressions.css:2–7。边界/背景对比实测Line暗2.18:1，Soft亮1.62/暗2.58，Studio亮1.78/暗2.84。
  - 验收：拆分交互边界token和装饰hairline；空输入框必要边界在实际相邻背景上达到3:1；覆盖四表达亮暗，不以加粗全部分隔线代替。 参考：[Non-text contrast][wcag-contrast]。

- [ ] **A11Y-02 · P1 · forced-colors 下 Switch 本体可见**
  - 状态／依据：**已实测**。dist/odyssey.css:388–398；css/line.css:117–122,196–199。track/thumb均白且无边框，原input opacity=0，SWT只剩空白。
  - 验收：使用系统色边框/滑块或恢复原生；checked/unchecked/disabled/focus均可辨识，不能只检查焦点环。 参考：[Forced colors][forced-colors]。
  - 依赖：FIX-01。

- [ ] **A11Y-03 · P1 · Rust label、hint、error 与字段真实关联**
  - 状态／依据：**代码确认**。src/controls.rs:311–324,341–369；range label无for/input id，hint/error缺描述连接。site/forms.html:278–288同类示例也缺关联。
  - 验收：兼容旧签名，提供显式id/describedby/error连接路径，追加而非覆盖调用者描述；读屏能读名称、当前值、帮助和错误。 参考：[表单标签][wai-labels] / [错误通知][wai-notifications]。

- [ ] **A11Y-04 · P1 · 中文/日文 IME 合成期不得执行命令或创建 chip**
  - 状态／依据：**已实测**。js/extensions.js:132–135；dist/odyssey.js:1121–1125,1989–1993；site/assets/patterns-20261018.js:293。isComposing Enter已复现命令执行/关闭及未完成zhong被创建chip。
  - 验收：统一处理composition状态；候选确认不触发业务动作，compositionend后正常提交；合成事件回归加真实IME抽验，保持已有非IME键盘路径。 参考：[UI Events isComposing][uievents-composing]。

- [ ] **A11Y-05 · P1 · 旧 Modal/Drawer 单一语义节点与逐层焦点恢复**
  - 状态／依据：**已实测**。dist/odyssey.js:108,124–149。命名dialog内再次生成无名dialog；modal→drawer逆序关闭后焦点留在隐藏modal按钮。
  - 验收：每层一个具名dialog；按层记录返回焦点；嵌套、触发器删除、反向切换均回到有效目标，与既有原生dialog路径协调。 参考：[Modal dialog][apg-dialog]。

- [ ] **A11Y-06 · P1 · Menu 动作关闭后交还有效焦点**
  - 状态／依据：**已实测**。dist/odyssey.js:168–175,503–508。registry MNU的Duplicate执行后菜单关闭，焦点仍在隐藏项。
  - 验收：普通动作回trigger；导航/开层交给目的地；Escape、Tab离开和鼠标选择一致，不抢新层焦点。 参考：[Menu button][apg-menu]。
  - 依赖：A11Y-05。

- [ ] **A11Y-07 · P2 · Promise Confirm 的名称、说明与安全初始焦点**
  - 状态／依据：**已实测**。dist/odyssey.js:1938–1960。alertdialog无可访问名称；danger初始focus在Confirm。
  - 验收：唯一labelledby/describedby；不可逆操作初始focus选Cancel；结果、Escape及关闭均恢复有效焦点。 参考：[Alert dialog][apg-alertdialog]。
  - 依赖：A11Y-05。

- [ ] **A11Y-08 · P2 · Tooltip 不丢既有描述，并可移入阅读**
  - 状态／依据：**已复现**。dist/odyssey.js:370–394,593–598覆盖并删除aria-describedby；原external-help实测丢失；dist/odyssey.css:2172–2177禁止指针进入。
  - 验收：追加/恢复已有描述；指针进入tooltip仍保持，Escape可关闭；长文本可读不截断，不能把必要操作藏在tooltip里。 参考：[Hover/focus content][wcag-hover]。
  - 依赖：ACT-08。

- [ ] **A11Y-09 · P2 · 导航链接保留语义，busy/disabled 同时约束键盘与指针**
  - 状态／依据：**代码确认**。src/controls.rs:185–199统一role=button；busy仅aria-disabled且href仍存在，pointer-events不能拦键盘Enter。
  - 验收：导航仍是link，动作使用button；约定disabled/busy在两输入方式都不重复动作；保留原有可用href与正常导航条件。 参考：[Button][apg-button] / [aria-disabled][aria-disabled]。

- [ ] **A11Y-10 · P2 · Command 无结果及状态变化可被读屏获知**
  - 状态／依据：**代码确认**。js/extensions.js:114–118；site/index.html:421。空结果只改普通p，输入未关联该状态。
  - 验收：用适当status或描述告知无结果与纠正方式；不移动focus、不逐键重复读整列表；复用已具有status的station/selection计数。 参考：[Status messages][wcag-status]。
  - 依赖：LIB-07。

## 4. 库契约、设计源与文档：先让已有能力找得到、接得上

责任域：library API / design / docs。

- [ ] **LIB-01 · P1 · 建立 canonical 能力目录与可校验组件 manifest**
  - 状态／依据：**缺失统一索引**。site/index.html:30维护54站；site/forms.html:447–683、site/feedback.html:414–784另有大量成熟站外能力；distribution.toml:1–13仅是consumer/fleet语义。
  - 验收：schema记录稳定ID、成熟度、HTML/Rust入口、CSS/JS依赖、状态、guide/设计/测试链接；搜索找到站外组件，目录/导出/发行遗漏可校验；fleet manifest保留原义。

- [ ] **LIB-02 · P1 · 统一同名组件契约，明确 HTML/Rust 有意的 parity**
  - 状态／依据：**部分/双实现**。site/forms.html:646–661与js/extensions.js:34–63是两套OTP；File/Tree/Split/Command也有双入口；src/lib.rs:42–59只导出部分Rust helper。
  - 验收：选择canonical行为并保留旧入口适配；说明native/增强/页面私有及runtime边界；共享fixture验证状态/语义/事件；不强求每个HTML组件都有Rust helper或名称完全相同。
  - 依赖：LIB-01。

- [ ] **LIB-03 · P1 · 提供可编译、可复制的 Rust Line 接入与 API 指南**
  - 状态／依据：**部分**。src/shell.rs:177–210无design opt-in；examples/gallery.rs:16–69已有旧gallery；src/lib.rs已有资产/helper，现有站点主要讲HTML/data API。
  - 验收：最小path-dependency示例覆盖静态/动态shell、Line root、extensions、locale/theme、CSRF及nonce；链接Rust API参考并持续编译；无需手改完整HTML字符串，旧shell输出兼容。
  - 依赖：LIB-02、ACT-01、FIX-03。

- [ ] **LIB-04 · P1 · Pencil token → CSS → 组件 → 文档可追踪同步**
  - 状态／依据：**已有基础/缺同步契约**。Pencil现有54 reusable、207变量、四expression×亮暗及States/Extensions/Patterns画板；css/line.css:3–37、site/tokens.html:68–80仍分别维护值，tracked库无重放映射。
  - 验收：保留现有Line方向；明确token/组件语义来源、稳定节点ID及typed token映射；采用兼容DTCG的交换层或明确等价schema；检查别名/类型/差异，设计与代码共同审阅后进入新release。 参考：[DTCG 2025.10交换格式][dtcg]。
  - 依赖：LIB-01。

- [ ] **LIB-05 · P2 · 组件状态矩阵、Line 尺寸与文档例子保持一致**
  - 状态／依据：**补全**。现有Pencil States画板存在；site/actions.html:97仍写Large46px，Line为48；site/layout.html:230–246间距说明落后。54站与guide状态未由manifest连结。
  - 验收：按组件适用范围列default/hover/focus/active/selected/disabled/readonly/invalid/busy/empty及长内容；四表达亮暗/密度引用同一token；示例锚点精确，尺寸说明和复制片段可验证。
  - 依赖：LIB-01、LIB-04、FIX-05。

- [ ] **LIB-06 · P1 · 三套 Patterns 提供可消费的组合与状态接口**
  - 状态／依据：**已有演示/待抽取**。site/patterns.html:3加载专用CSS/JS；site/assets/patterns-20261018.js:168–225依赖页面私有结构。Release/Inbox/Settings实际已上线并完成交互验收。
  - 验收：保留三流程，列出库组件映射、最小组合、宿主数据/状态接口；至少一个流程仅加载声明资产即可运行，不依赖整页私有selector；示例状态不冒充后端授权或真实部署。
  - 依赖：LIB-02、ACT-01、ACT-13。

- [ ] **LIB-07 · P2 · 运行时文案和 Line 字体接回 en/zh/ja locale**
  - 状态／依据：**补全**。js/extensions.js:40,71,76,142及dist/odyssey.js多处硬编码英文；css/tokens.css:58–64已有ja字体顺序，但Line输入实测PingFang先于Hiragino。
  - 验收：复用现有catalog/字符串注入；月份、状态、删除名称、OTP描述本地化；Line保留locale字体顺序；用户内容不翻译。 参考：[语言标签][w3c-language]。
  - 依赖：LIB-02。

## 5. 分发、测试和工程：已有机制需要补齐契约

责任域：release / tooling / QA。

- [ ] **ENG-01 · P1 · 修复 CLI canonical-bundle 测试基线**
  - 状态／依据：**已执行失败**。tools/odysseyctl/src/main.rs:838–853锁28文件，:662–668当前实际31；定向测试exit101，left31/right28。
  - 验收：核对新增文件后更新明确清单/基线，保留断言；定向及相关CLI测试通过；旧指纹断言尚未执行，更新时核对而不预先断言其结果。

- [ ] **ENG-02 · P1 · vendored crate 的单测输入完整**
  - 状态／依据：**已执行失败**。src/lib.rs:272–280读取../dist/odyssey.js；canonical vendor只带Cargo/css/js/src。等价临时fixture的cargo test --lib --no-run缺文件，cargo check --lib通过。
  - 验收：正常消费构建与vendor自身单测编译均通过；将public dist专属测试放到正确边界，或明确测试输入；保持既有vendor payload/入口，不能靠跳过测试。

- [ ] **ENG-03 · P1 · 明确发行身份、兼容/迁移及 stable/canary 条件**
  - 状态／依据：**部分**。Cargo.toml:3为0.1.0；distribution.toml:2为1.4 canary；公开build仍1.3。FLEET.md:249–257已有immutable和runtime边界。
  - 验收：元数据映射Cargo/internal/public/design-layer身份；列出弃用、breaking changes、迁移与本版本晋级证据；不强行统一版本号，不借旧canary窗口为新release背书。 参考：[SemVer][semver]。
  - 依赖：LIB-01。

- [ ] **ENG-04 · P1 · Line/Expressions/Extensions 可 pin 的完整公开发行组合**
  - 状态／依据：**部分**。tools/build-public-dist.sh:14–38仅生成1.3 core/profile/canary；Line/Extensions仍可变assets，冻结1.3明确不含Line。
  - 验收：新增完整immutable资产URL及自托管文件清单；core/Line/fonts/extensions组合版本相容；冻结1.1/1.2/1.3不覆写，旧assets兼容；仅准备Odyssey发行，不自动同步消费者。
  - 依赖：ENG-03、LIB-02。

- [ ] **ENG-05 · P1 · CDN/自托管/Line 安装说明指向同一明确 release**
  - 状态／依据：**文档不一致**。site/getting-started.html:218–222把CDN1.1和当前dist称同产物，FLEET.md:249当前dist为1.3；Line还需额外assets。
  - 验收：给出同release的完整文件列表和最小片段；复制到空白HTML、自托管及Line/extensions三条路径得到声明的组件版本/行为，无漏依赖。
  - 依赖：ENG-04、LIB-03。

- [ ] **ENG-06 · P1 · 浏览器测试环境在 Odyssey 内可独立复现**
  - 状态／依据：**部分**。tools/browser-runtime/package.json:1–5无依赖/脚本；tools/install-canary-gate.sh:25,109–112从别的产品复制Playwright。既有安装器已有runtime pin。
  - 验收：在本项目声明支持Node/Playwright/browser版本及安装执行入口；干净环境可跑已有测试，不依赖其他产品node_modules；复用Playwright，不要求换框架。

- [ ] **ENG-07 · P1 · 将现有测试连成一个仓库持续验收入口**
  - 状态／依据：**tracked配置缺失**。Dockerfile:23–24只build；Rust/CLI/Node gate和browser测试已存在但分散，tracked基线未见CI或统一任务入口。
  - 验收：统一入口执行约定format/build/test、发行一致性及消费fixture；CI调用同入口并阻止失败发行；保留systemd collector的线上观察职责。
  - 依赖：ENG-01、ENG-02、ENG-06。

- [ ] **ENG-08 · P1 · 声明浏览器支持范围并验证跨引擎降级**
  - 状态／依据：**未验证**。line/extensions/patterns-browser.test.mjs仅Chromium；css/extensions.css:36–54用details-content/interpolate-size/popover/discrete transitions。
  - 验收：明确最低支持范围；对承诺引擎验证关键控件、键盘和progressive fallback。未测写成未验证，而非直接宣称不支持。
  - 依赖：ENG-06、ENG-07。

- [ ] **ENG-09 · P1 · 复用既有 pattern/a11y helper，扩展当前库验收**
  - 状态／依据：**部分/待接纳**。当前测试已有部分键盘、reduced-motion、touch/no-JS；远端另有未跟踪pattern-assertions.mjs、tests及patterns/ACCEPTANCE.md，报告四产品证据，未纳入本基线。
  - 验收：先审阅、核证并版本化现有helper，复用assertSurface(AxeBuilder)/native form/真实Tab；覆盖旧guide、AX关联、IME、200%文本/文本间距、forced-colors，并对custom combo/date/tree/modal做VoiceOver抽验。外部报告不直接算本库通过。 参考：[Text spacing][wcag-spacing] / [Reflow][wcag-reflow]。
  - 依赖：ENG-06、ENG-07、LIB-01。

- [ ] **ENG-10 · P2 · 已有截图升级为可审阅的视觉回归**
  - 状态／依据：**部分**。tools/tests/line-browser.test.mjs:24,50,66及tools/tests/extensions-browser.test.mjs:32–40,64已有可选截图，未见图像差分断言。
  - 验收：少量关键基线经人工接受；固定字体/数据/运动，覆盖代表性表达/主题/宽度/浮层；有差异审阅和更新流程，复用现有截图而非另造平台。
  - 依赖：ENG-06、ENG-07、LIB-05。

- [ ] **ENG-11 · P2 · 按真实消费建立字节/初始化预算与按需组合**
  - 状态／依据：**部分**。src/lib.rs:1–29已有全量与可选常量；:182–185,233约束JS行数。当前未压缩core CSS/JS约168506/105406 bytes，Line字体层82365 bytes。
  - 验收：测量必要字节、初始化与重复初始化成本；明确core/fonts/Line/extensions/runtime组合；基于真实页面制定预算；旧全量入口可用，不预设npm/bundler。
  - 依赖：ENG-04、LIB-01。

- [ ] **ENG-12 · P2 · 严格 CSP 有完整可选接入路径**
  - 状态／依据：**部分**。src/lib.rs:61–114已有script nonce；src/shell.rs:200–203,229仍生成style属性及无nonce style block。
  - 验收：提供完整CSP示例及浏览器fixture，样式/字体/交互都可用；标准shell增加兼容式opt-in，默认调用保持可用；不能只给JS nonce就宣称整页通过。
  - 依赖：LIB-03、ENG-07。

- [ ] **ENG-13 · P2 · 确认项目许可及发行元数据**
  - 状态／依据：**占位信息**。dist/odyssey.css:9写MIT placeholder；Cargo.toml:1–7无license/repository/rust-version；tracked无项目LICENSE，两份字体OFL已存在。
  - 验收：由项目owner确认许可后写入新发行和元数据，保留字体notice；历史immutable snapshot不覆写，所需补充notice另行发布。许可选项由owner决定，TODO不代替授权。

- [ ] **ENG-14 · P2 · 构建脚本不能静默保留旧版本标记**
  - 状态／依据：**最小复现**。tools/build-public-dist.sh:23–34使用sed的0,/…/地址；macOS /usr/bin/sed实测exit0但版本仍v1.1.0。Docker已pin Rust镜像，Cargo未声明最低版本。
  - 验收：使用支持平台兼容的替换，或显式检查GNU工具前提；生成后断言release identity；记录Rust/Node/shell支持范围，版本替换失败必须报错。
  - 依赖：ENG-03、ENG-06。

## 6. 工作流与高级输入：补组合能力，不接管业务后端

责任域：pattern / forms / application integration。

- [ ] **PAT-01 · P2 · 异步/长任务状态与错误恢复模板**
  - 状态／依据：**组合缺口**。Patterns仅本地demo状态；既有Wire已处理请求错误，远端application-interactions.md已有queued/running/cancelling/unknown-result及receipt语义。
  - 验收：接纳并链接现有契约；提供可配置loading/empty/error/permission/offline/unknown-result/cancel/retry组合与fake adapter；仅源确认终态显示成功，不从计时猜百分比；宿主负责数据/权限/操作身份。 参考：[Loading][carbon-loading]。
  - 依赖：LIB-06、ENG-09。

- [ ] **PAT-02 · P2 · 登录、MFA、凭据恢复与会话过期界面模板**
  - 状态／依据：**新增组合**。forms已有password及OTP，i18n已有sign_in文案，但当前site/patterns仅三流程，无完整账户入口与恢复模板。
  - 验收：组合已有字段/OTP/通知，覆盖提交中、错误、MFA重试、恢复、过期后返回；支持密码管理器/自动填充；认证、SSO及passkey调用由宿主adapter处理，不在UI库新造认证服务。 参考：[Login pattern][carbon-login]。
  - 依赖：ACT-05、A11Y-03、LIB-07。

- [ ] **PAT-03 · P2 · 多步骤表单、Onboarding 和问卷状态编排**
  - 状态／依据：**已有Step指示/缺编排**。site/data-display.html:689–707有Stepper/Wizard指示，dist:1554–1556只切步骤状态；缺关联分步字段、校验、返回和完成流程。
  - 验收：复用Stepper/原生fieldset；明确当前步骤、可返回/可跳过、验证失败焦点、保留答案与最终提交；草稿持久化和分支由宿主决定。 参考：[Questionnaire组合参考][questionnaire]。
  - 依赖：A11Y-03、LIB-06。

- [ ] **PAT-04 · P2 · 多字段过滤、Query chips 与保存视图**
  - 状态／依据：**补全组合**。已有Multi-select/Tag input及Inbox筛选；ACT-13处理表格基本数据流，尚无跨列表的复合过滤/保存视图契约。
  - 验收：给出可复制filter toolbar与序列化状态模型：条件增删、清除、结果数、保存/恢复视图、URL返回；query字段白名单与后端查询均宿主拥有。 参考：[Search pattern][carbon-search]。
  - 依赖：ACT-03、ACT-13、LIB-06。

- [ ] **PAT-05 · P2 · 文件队列的进度、取消、重试与恢复 UI**
  - 状态／依据：**输入已有/缺任务展示**。旧/新dropzone都有本地选择；现有库未提供可绑定真实上传状态的多文件任务队列。
  - 验收：在ACT-06基础上显示每文件queued/uploading/success/error/cancelling；进度仅取adapter，取消确认后才终止显示；失败可重试且同文件状态不混淆；不内置存储服务。
  - 依赖：ACT-06、PAT-01。

- [ ] **PAT-06 · P2 · 可复用 Code / Log / Diff 展示组件**
  - 状态／依据：**页面私有/待抽取**。css/components.css:642–654已有Markdown排版；Patterns有私有diff和checks日志，guide有pre/code/copy，但缺独立内容/行/状态契约。
  - 验收：抽取纯文本安全默认、行号/换行/折叠/复制/新增删除标记；复制不混入行号和diff装饰；长日志增量更新不抢滚动，语法高亮可选且不拖入基础包。 参考：[Code Block][code-block]。
  - 依赖：LIB-06、ENG-11。

- [ ] **PAT-07 · P3 · 富文本/Markdown 编辑及提及、附件组合**
  - 状态／依据：**新增领域组合**。已有Markdown展示和inline editable，不等于富文本编辑器；当前src/JS未见contenteditable编辑模型。
  - 验收：先按内容产品需求选成熟编辑内核或提供adapter；完成工具栏键盘、selection/undo、粘贴与安全内容边界、mention/attachment状态；不自行实现通用编辑引擎。
  - 依赖：PAT-06、ACT-06。

- [ ] **PAT-08 · P2 · Calendar 的事件、范围与 Agenda**
  - 状态／依据：**静态展示/待产品化**。site/data-display.html:710–737有静态月网格，日期输入已有picker；它们尚非可绑定事件的排期视图。
  - 验收：复用日期值契约；月切换、选中范围、事件列表/空态与agenda同步；明确date-only和时区时间，不在UI层发明时区换算；资源排期作为后续可选变体。
  - 依赖：ACT-09、LIB-07。

- [ ] **PAT-09 · P2 · 成员、角色权限与通知偏好面板**
  - 状态／依据：**新增组合**。现有Settings仅workspace名/slug/appearance；已有Inbox和旧Notification center，不等于权限编辑/偏好工作流。
  - 验收：提供角色矩阵、成员邀请状态、只读/拒绝及通知渠道/频率组合；展示源返回权限，不能把隐藏按钮或本地选项当授权；保存/失败恢复和不可修改状态清楚。
  - 依赖：LIB-06、PAT-01。

- [ ] **PAT-10 · P2 · 资源选择、版本固定与来源可用性模板**
  - 状态／依据：**外部已有参考/库中待接纳**。远端patterns/application-interactions.md及ACCEPTANCE.md报告Workspaces/resource-kit参考路径；当前tracked Odyssey无可消费picker组合。
  - 验收：先核实并复用参考，再抽取搜索/分页/来源不可用/权限拒绝/跟随当前或pin版本组合；保留真实资源身份，不将不可用来源当成功空列表；仅新增Odyssey示例，不推广其他产品。
  - 依赖：LIB-06、ENG-09、PAT-01。

## 7. 规模与领域扩展：按产品需求启动

责任域：advanced data / content / i18n。

- [ ] **EXT-01 · P2 · 长列表/表格/Tree 的可访问虚拟化**
  - 状态／依据：**新增规模能力**。现有TBL/LST/TRE已实现基础展示/部分行为；当前src/JS/发行API未见virtualizer，缺大集合消费契约。
  - 验收：先用真实大集合测基线，再选可选adapter/实现；约束DOM/初始化预算，支持动态高度、键盘定位、总行数/索引及返回位置，不因虚拟化丢焦点或选择。 参考：[Virtualizer参考][virtualizer]。
  - 依赖：ACT-13、ACT-14、ENG-11。

- [ ] **EXT-02 · P3 · TreeGrid / 可编辑层级数据表**
  - 状态／依据：**新增组件**。已有Tree和Table分别存在；当前catalog/API无层级行+列的统一交互模型。
  - 验收：有实际层级表格需求再启动；支持展开行、单元格/行导航、选择与编辑模式切换及正确层级语义；不把普通导航Tree升级成复杂grid。 参考：[APG Treegrid][apg-treegrid]。
  - 依赖：ACT-13、ACT-14。

- [ ] **EXT-03 · P2 · 多序列、轴、图例、时间域和专业图表入口**
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

