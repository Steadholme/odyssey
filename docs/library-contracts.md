# 从同一发行选择组件

Odyssey 1.5.0 以 Line 为默认示例表达。`library/capabilities.json` 是能力目录，`capabilities.schema.json` 校验结构；`distribution.toml` 继续只描述内部消费者，不承担组件目录职责。

目录包含 54 个站点和 39 项高级输入、布局与组合。`supported` 表示保留的消费入口，`preview` 表示仍在完善的组合；`openTodo` 记录具体缺口。`tests[].coverage` 区分交互合同、展示冒烟与目录检查；无 Pencil 节点或 Rust helper 的条目显式为 null/空数组。

## 先选运行时，再选表现

| 入口 | 合同 | Rust parity |
| --- | --- | --- |
| 原生 input/select/details/dialog | 优先保留原生提交、焦点和值语义 | 表单、表格、反馈等有 helper；其他 HTML-only 有意保留 |
| public `.ody-*` | 加载 public core；`Odyssey.init(root)` 支持 root 自身、子树、重复初始化 | 不隐式等同内部 Wire/Spark |
| `data-ody-*` extensions | core 后加载 extensions；`OdysseyExtensions.init(root)`，也由 `Odyssey.init(root)` 接入 | Rust Line shell 可显式启用 |
| workspace composition | `mountWorkspace(form, adapter)`，宿主拥有数据、权限和保存 | 不需要 Rust 专属 helper |
| 可选 workflows | `OdysseyWorkflows` 挂载任务、认证、分步表单、文件队列及成员偏好 | 宿主 adapter 确认状态和权限 |
| 可选 data-tools | `OdysseyDataTools` 挂载过滤、文本、日历、资源、虚拟集合与分析图表 | 宿主提供数据、身份和可选 renderer |

动态 HTML 插入后调用 `Odyssey.init(container)`；Wire 的 `wire:after` 目标子树走同一入口。两次初始化不应复制监听。没有 public core 的独立 extensions 使用 `OdysseyExtensions.init(container)`。浏览器行为、事件和值的机器可读合同见 `library/contracts.json`。

### 同名入口保留适配，不再造第三套

- **OTP**：guide 的 `.ody-otp` 与 registry `data-ody-code-input` 保留原入口。通过 `data-ody-code-name` 显式选择完整值字段，由一个 hidden input 提交；可视格不需要逐格 name。4/6 位、粘贴/自动填充、错误重试和原生 reset 保持值、帮助及 FormData 一致。
- **文件**：旧 `.ody-dropzone` 与 registry extension 都把已接受文件写回 `input.files`；宿主从 FormData 提交，库不执行网络上传。
- **Tree**：registry 的 details/disclosure 保持原生键盘；旧增强 ARIA Tree 使用单一 Tab 入口、层级、上下/首尾/左右导航与 typeahead，通过 `ody:tree-change` 输出选择。原生 details 不增加 Tree 的方向键要求。
- **Split / Command**：保留旧 public 与 extension 入口。`data-ody-splitpane` 支持双方向尺寸约束、容器 resize、可点击 preset/数值输入，尺寸变更发 `ody:resize`。Command 的 IME 候选确认不执行操作，无结果通过关联的状态区域反馈。
- **Chart**：站点的小型静态柱图保持 CSS-only；`data-ody-chart` 显式启用 core 增强。`updateChart` 更新已有数据，`describeChart` 为 core 或宿主 renderer 提供名称、结论和替代数据表，不替换宿主自己的内容。
- **Data table**：客户端 adapter 的 filter→sort→page→selection 状态由 `ody:table-change` 输出；服务端排序/分页可保留普通链接和表单，不必把所有数据交给浏览器。

静态/动态 shell、Line root、locale/theme、CSRF 和 nonce 的可编译接法见 [Rust Line API](rust-line.md)。最小组合和三流程的宿主边界见 [Patterns 消费示例](../examples/compositions/README.md)。

## 用同一份状态和尺寸契约

`capabilities.json` 的 `states` 只列该组件适用的状态；`design/state-matrix.json` 定义状态词汇、Line 尺寸、密度和源路径。[状态图谱](../site/states.html) 展示真实控件并提供完整矩阵。Line 默认按钮 40px、小号 32px、大号 48px；compact 普通控件 32px，粗指针命中区至少 44px。间距使用 4/8/12/16/24/32/48/64，不复制旧 core 的尺寸说明。

动态系统文案使用最近的 `lang` 选择 en/zh/ja；宿主通过 `Odyssey.i18n.register(locale, strings)` 扩充词条。`t(key, vars, node)` 只格式化系统模板，用户输入、资源名称和宿主提供的文案保持原值。

## 设计交换只合并经过审阅的差异

Pencil 文档保留原有 54 reusable 与 207 变量，新增 `ex-control-border`，四表达输入框绑定它；装饰 hairline 不变。稳定节点 ID 在 `design/design-map.json`，全部变量的 MCP 读回在 `design/pencil-export.json`。

`design/tokens.json` 使用 [DTCG 2025.10 类型](https://www.designtokens.org/tr/2025.10/format/)：color 为 sRGB 分量，dimension 带 px，duration 带 ms，曲线为四数值数组。主题不依赖隐式 mode：每个 theme 组合有独立 token，`xyz.w33d.odyssey` 扩展记录 Pencil 原名、类型、主题和 CSS property。未映射的历史探索变量只归档，不自动注入生产样式。

1. 从 Pencil MCP `Print(GetVariables())` 与 reusable 查询取得新快照；不读取加密 `.pen`。
2. `node tools/design-tokens.mjs --diff new-pencil-export.json` 列出变量差异；设计 owner 审阅视觉角色，runtime owner 审阅行为，Line owner审阅 CSS 适配。
3. 更新 typed exchange 后执行 `node tools/design-tokens.mjs`，校验类型、别名、循环、roundtrip 和 source bindings；浏览器合同再对照 48 个绑定、四表达×亮暗的真实 CSS 计算值。
4. 反向导入用 `node tools/design-tokens.mjs --import design/tokens.json > /tmp/pencil-import.json`；将其中 variables 通过 MCP `SetVariables(variables)` 合并，再 MCP 读回检查。默认不 replace、不删历史变量。修改交换文件不会偷偷改画布。
5. 完成统一验收后，随**新** immutable release 发布快照和映射；不覆写既有 immutable URLs，也不自动升级其他产品。
