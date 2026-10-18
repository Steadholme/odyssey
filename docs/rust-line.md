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
- `LineShellOpts::with_nonce` 为此 shell 发出的内联 style、Wire/Spark/Motion 和 extensions script 加同一响应 nonce。nonce 和 CSRF token 必须由宿主为实际响应/会话提供；示例字符串仅便于本地运行。

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

## API 参考

[`shell` 的入口和 options](../src/shell.rs)、[`controls` 的字段与表单 API](../src/controls.rs)均带 Rustdoc。可导航的 HTML 参考由 `cargo doc --no-deps --open` 生成于 `target/doc/odyssey/index.html`：`shell::{LineShellOpts,line_page_shell,wire_line_page_shell}`、`controls::{FieldOpts,field_with,form_with_wire}`、`RuntimeOpts`。静态和动态示例共享同一组 locale、theme、CSRF 和 nonce 输入。
