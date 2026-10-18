# Rust 接入 Line

已有 Rust 页面只需把 shell 入口换成 `line_page_shell`，不需要替换整页 HTML。原来的 `page_shell`、`ShellOpts` 和 profile 入口保持兼容。

```rust
use odyssey::{line_page_shell, LineExpression, LineShellOpts};
// chrome、body、opts 仍使用已有 PageChrome / Html / ShellOpts。
let line = LineShellOpts::new(LineExpression::Soft)
    .with_extensions()
    .with_nonce(response_nonce);
let html = line_page_shell(chrome, body, opts, line);
```

`LineExpression` 有 `Line`、`Soft`、`Studio`、`Signal` 四种。新入口直接在 `<html>` 写入 `data-ody-design="line"` 和 `data-expression`；样式、字体和选择的表达随页面内联，不需要公共网站的 CSS URL。

## 运行完整示例

仓库中的独立项目使用 `odyssey = { path = "../.." }`。复制到自己的项目时，将 dependency 路径改为本地 Odyssey checkout。

```sh
cargo run --manifest-path examples/rust-line/Cargo.toml > /tmp/odyssey-static.html
cargo run --manifest-path examples/rust-line/Cargo.toml -- --dynamic > /tmp/odyssey-dynamic.html
cargo test --all-targets
cargo doc --no-deps --open
```

可编译源码在 `examples/rust-line/src/main.rs`；`examples/line.rs` 复用它，确保主仓库的 all-targets 检查也编译该示例。生成的页面演示界面；`/settings` 的读取、CSRF 验证、保存及 Wire HTML response 由宿主应用实现。

## 静态 shell 与渐进增强

- `line_page_shell` 不加入 Wire/Spark。表单保留原生 `method`、`action` 和 CSRF hidden input。
- `wire_line_page_shell` 接收已有 `WireShellOpts`，加入稳定 main region、Wire/Spark；`with_motion()` 仍是单独选项。`form_with_wire` 保留原生提交入口，并显式声明替换区域。
- `with_extensions()` 才加入 extension CSS/JS，支持 OTP、文件输入、分隔器、原生命令 dialog 等扩展。它不是上传服务，也不会把页面演示连接到生产后端。
- `ShellOpts.locale` 仍由 `resolve_locale` 决定；`ShellOpts.theme` 支持 `light`、`dark`、`auto`。主题、语言切换链接继续使用宿主 gateway 的既有端点。
- `LineShellOpts::with_nonce` 为 style、Wire/Spark/Motion 和 extensions script 加同一响应 nonce。严格禁止 style attribute 的站点使用下面的 `csp_page_shell`；仅附加 script nonce 不足以覆盖整页。nonce 和 CSRF token 由宿主为实际响应/会话提供。

## 字段的名称、帮助和错误

```rust
use odyssey::{field_with, text_input, FieldOpts};
let control = text_input("email", "bad", &[("aria-describedby", "privacy")]);
let field = field_with("工作邮箱", control,
    FieldOpts::new().with_id("work-email")
        .with_hint("例如 you@example.com")
        .with_error("请输入有效邮箱"));
```

`field_with` 连接 label、hint 和 error，并保留 `privacy` 等既有描述。没有错误时不要传 `with_error`；服务器重新渲染后自然恢复有效状态。旧 `field`、`field_hint`、`field_err` 仍可调用；单独的 `field_err` 只有错误内容，字段关联应使用 `field_with`。

## 普通禁用、小数与实时 Range

按钮仍使用原来的 `BtnOpts`。需要额外原生属性时，换用 `_with` helper：

```rust
use odyssey::{button_with, number_input_with, range_field_with, BtnOpts, Variant};
let save = button_with("保存", Variant::Primary, BtnOpts::default(),
    &[("disabled", ""), ("data-action", "save")]);
let share = number_input_with("share", "0", "1", "0.25", "0.5",
    &[("required", ""), ("aria-describedby", "share-help")]);
let jobs = range_field_with("并发任务", "jobs", "1", "8", "1", "3", true,
    &[("id", "job-count")]);
```

`number_input` 保留整数步长的原入口。`range_field` 和 `range_field_with` 的输出由 Spark 的委托 `input` 事件实时同步；使用 Wire shell 或 `dynamic_scripts()` 加入 Spark。静态页面仍有原生 Range 与初始输出。调用者传入的 ID 同时连接 label 和 output；属性值会转义，属性名与 `text_input` 一样由调用者提供。

`link_button` 现在保留原生导航 link 语义，不再附加 `role="button"`。启用状态保留原 `href` 与 Wire 行为；busy 或 `link_button_with(..., &[("disabled", "")])` 输出具名 disabled link，但不输出 `href` 或 Wire 激活属性，因此键盘与指针都不能导航。重新启用时由宿主重新渲染带原 URL 的链接。需要执行动作时使用 `button` 或 `button_with`，而不是导航链接。

## 空状态给出当前上下文和下一步

`empty_state(locale, icon)` 继续输出原来的本地化无数据标题和说明。只覆盖当前页面需要的部分：

```rust
use odyssey::{empty_state_with, link_button, EmptyStateOpts, Locale, Variant, BtnOpts};
let empty = empty_state_with(Locale::Zh, "search", EmptyStateOpts::new()
    .with_title("没有匹配的工作区")
    .with_message("换一个较短的名称，或清除筛选。")
    .with_action(link_button("/workspaces", "清除筛选", Variant::Secondary, BtnOpts::default())));
```

标题和说明按普通文本转义；action 接收已有 `Html` helper。`examples/csp.rs` 展示首次创建、搜索无结果和加载失败重试三种状态：导航用 link，重试用带 CSRF 的 POST form。

## 严格 CSP：样式、字体和交互一起授权

采用严格策略的宿主改用独立入口，旧 shell 不需要迁移：

```rust
use odyssey::{csp_page_shell, CspShellOpts, LineExpression, LineShellOpts, WireShellOpts};
let csp = CspShellOpts::new(response_nonce)
    .with_line(LineShellOpts::new(LineExpression::Line).with_extensions())
    .with_wire(WireShellOpts::new("workspace-main").with_motion());
let html = csp_page_shell(chrome, body, opts, csp);
```

宿主在同一 HTML 响应发送以下 `Content-Security-Policy` header；将 `RESPONSE_NONCE` 替换为本次响应随机生成的 nonce，与 `CspShellOpts::new` 一致：

```text
default-src 'none'; script-src 'nonce-RESPONSE_NONCE'; style-src 'nonce-RESPONSE_NONCE'; style-src-attr 'none'; font-src data:; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'
```

此入口给所有 shell 生成的 style/script 统一 nonce，将品牌 accent 移入授权 style，避免 shell 生成 style attribute。内嵌 Inter、Archivo 和 Azeret Mono 通过 `font-src data:` 加载；Wire 通过 `connect-src 'self'` 请求同源 HTML；原生表单受 `form-action 'self'` 约束。纯静态严格页面可省略 `with_wire`，无需放宽策略。

宿主提供的 body、footer、`head_extra` 和 `extra_css` 仍由宿主管理：不要使用 inline event handler 或 style attribute，额外 script/style 必须使用同一 nonce；需要动态样式的旧 helper（例如 `progress` 的 style width）应改用宿主授权样式或原生 progress。`Brand.accent` 和 `extra_css` 是受信任应用 CSS，不应放入外部输入。

可编译页面与真实 HTTP header 的浏览器夹具：

```sh
cargo run --example csp > /tmp/odyssey-csp.html
BROWSERS=chromium,firefox,webkit node tools/tests/rust-p2-browser.test.mjs
```

夹具通过本地临时 HTTP 服务发送策略，检查实际 CSS、data 字体、Wire HTML 请求、Spark Range、扩展验证码与 Motion 入口，收集 CSP violation，并覆盖 disabled 键盘/指针、小数 FormData、三个恢复动作和 320px 布局。

## API 参考

[`shell` 的入口和 options](../src/shell.rs)、[`controls` 的字段与表单 API](../src/controls.rs)均带 Rustdoc。可导航的 HTML 参考由 `cargo doc --no-deps --open` 生成于 `target/doc/odyssey/index.html`：`shell::{LineShellOpts,line_page_shell,wire_line_page_shell,CspShellOpts,csp_page_shell}`、`controls::{FieldOpts,field_with,form_with_wire,button_with,number_input_with,range_field_with}`、`data::{EmptyStateOpts,empty_state_with}`、`RuntimeOpts`。静态和动态示例共享同一组 locale、theme、CSRF 和 nonce 输入。
