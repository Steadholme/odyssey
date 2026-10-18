use odyssey::*;

fn main() {
    // Values come from the host's request/session in a real application.
    let locale = resolve_locale(None, Some("zh-CN,en;q=0.5"));
    let theme = resolve_theme(Some("__Secure-theme=light"));
    let nonce = "example-response-nonce";
    let csrf = "example-session-csrf";
    let dynamic = std::env::args().any(|arg| arg == "--dynamic");
    let chrome = PageChrome {
        title: "Rust Line · 工作区设置",
        brand: Brand {
            tile_svg: "",
            accent: "",
            name: "Odyssey",
            sub: "Rust Line example",
        },
        nav: &[NavItem {
            href: "/settings",
            label: "设置",
            icon: "",
            active: true,
        }],
        user: UserBox {
            email: None,
            logout_url: "/logout",
        },
        footer: Html::default(),
    };
    let fields = Html::concat([
        field_with(
            "工作区名称",
            text_input(
                "workspace",
                "Acme Studio",
                &[("required", ""), ("aria-describedby", "policy")],
            ),
            FieldOpts::new()
                .with_id("workspace")
                .with_hint("使用团队熟悉的名称"),
        ),
        raw("<p id=\"policy\">此示例不连接任何生产服务。</p>"),
        button(
            "保存工作区",
            Variant::Primary,
            BtnOpts {
                kind: "submit",
                ..Default::default()
            },
        ),
    ]);
    let settings = if dynamic {
        form_with_wire(
            "post",
            "/settings",
            Csrf(csrf),
            fields,
            WireOpts::new("#settings-form").success_message("已保存"),
        )
    } else {
        form("post", "/settings", Csrf(csrf), fields)
    };
    let body = Html::concat([
        raw("<section id=\"settings-form\">"), settings, raw("</section>"),
        range_field("并发任务", "parallelism", "1", "8", "1", "3", true),
        raw("<fieldset class=\"ody-ext-code\" data-ody-code-input><legend>验证码</legend><div><input aria-label=\"第1位\" inputmode=\"numeric\"><input aria-label=\"第2位\" inputmode=\"numeric\"><input aria-label=\"第3位\" inputmode=\"numeric\"><input aria-label=\"第4位\" inputmode=\"numeric\"><input aria-label=\"第5位\" inputmode=\"numeric\"><input aria-label=\"第6位\" inputmode=\"numeric\"></div><small data-ody-code-help></small></fieldset>"),
    ]);
    let opts = ShellOpts {
        locale,
        theme,
        compact: false,
        ..Default::default()
    };
    let line = LineShellOpts::new(LineExpression::Soft)
        .with_extensions()
        .with_nonce(nonce);
    let html = if dynamic {
        wire_line_page_shell(
            chrome,
            body,
            opts,
            WireShellOpts::new("workspace-content").with_motion(),
            line,
        )
    } else {
        line_page_shell(chrome, body, opts, line)
    };
    print!("{html}");
}
