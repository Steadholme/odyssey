//! Run `cargo run --example csp > /tmp/odyssey-csp.html`.
//! The host must send the policy in docs/rust-line.md, using a fresh nonce per response.
use odyssey::*;

fn main() {
    let nonce = "odyssey-csp-example"; // Demonstration only; generate a fresh nonce per response.
    let chrome = PageChrome {
        title: "Rust Line · Controls and recovery",
        brand: Brand {
            tile_svg: "",
            accent: "#0062ff",
            name: "Odyssey",
            sub: "Rust · Line",
        },
        nav: &[],
        user: UserBox {
            email: None,
            logout_url: "/logout",
        },
        footer: Html::default(),
    };
    let body = Html::concat([
        raw("<h1>Controls and recovery</h1><p>Native controls, deliberate recovery, strict CSP.</p><section aria-label=\"Controls\">"),
        button_with("Save unavailable", Variant::Primary, BtnOpts::default(), &[("id", "disabled-button"), ("disabled", "")]),
        link_button_with("/must-not-navigate", "Unavailable destination", Variant::Secondary, BtnOpts::default(), &[("id", "disabled-link"), ("disabled", "")]),
        link_button_with("/must-not-navigate", "Loading destination", Variant::Secondary, BtnOpts { busy: true, ..Default::default() }, &[("id", "busy-link")]),
        link_button_with("#recovery", "Go to recovery", Variant::Ghost, BtnOpts::default(), &[("id", "enabled-link")]),
        raw("<form id=\"settings\" method=\"get\" action=\"/settings\">"),
        field_hint("Traffic share", number_input_with("share", "0", "1", "0.25", "0.5", &[("id", "share"), ("required", ""), ("aria-describedby", "decimal-help")]), "Choose a quarter-step."),
        raw("<p id=\"decimal-help\">For example, 0.25 or 0.5.</p>"),
        range_field_with("Concurrent jobs", "parallelism", "1", "8", "1", "3", true, &[("id", "jobs"), ("aria-describedby", "jobs-help")]),
        raw("<p id=\"jobs-help\">The output follows the native value.</p></form></section><section aria-label=\"Wire navigation\">"),
        link_button_with_wire_attrs("/next", "Load preview", Variant::Secondary, BtnOpts::default(), WireOpts::new("#wire-content"), &[("id", "wire-link")]),
        raw("<section id=\"wire-content\"><p id=\"wire-state\">Ready to preview</p></section></section><section id=\"recovery\" aria-label=\"Recovery states\" class=\"recovery-grid\">"),
        empty_state_with(Locale::En, "database", EmptyStateOpts::new()
            .with_title("Your first workspace")
            .with_message("Create a workspace to bring your team together.")
            .with_action(link_button("/workspaces/new", "Create workspace", Variant::Primary, BtnOpts::default()))),
        empty_state_with(Locale::En, "search", EmptyStateOpts::new()
            .with_title("No matching workspaces")
            .with_message("Try a shorter name or clear the search.")
            .with_action(link_button("/workspaces", "Clear search", Variant::Secondary, BtnOpts::default()))),
        empty_state_with(Locale::En, "database", EmptyStateOpts::new()
            .with_title("Workspaces could not load")
            .with_message("Your changes are safe. Try loading the list again.")
            .with_action(form("post", "/workspaces/retry", Csrf("example-csrf"), button("Try again", Variant::Secondary, BtnOpts { kind: "submit", ..Default::default() })))),
        raw("</section><section aria-label=\"Verification\"><fieldset class=\"ody-ext-code\" data-ody-code-input><legend>Verification code</legend><div><input aria-label=\"Digit 1\" inputmode=\"numeric\"><input aria-label=\"Digit 2\" inputmode=\"numeric\"><input aria-label=\"Digit 3\" inputmode=\"numeric\"><input aria-label=\"Digit 4\" inputmode=\"numeric\"><input aria-label=\"Digit 5\" inputmode=\"numeric\"><input aria-label=\"Digit 6\" inputmode=\"numeric\"></div><small data-ody-code-help></small></fieldset></section>"),
    ]);
    print!("{}", csp_page_shell(chrome, body, ShellOpts {
        extra_css: ".console>h1{font:600 clamp(28px,4vw,40px)/1.2 var(--ody-font-display)}.console>section{margin-block:32px}.console>section> .btn{margin:4px}.recovery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px}.recovery-grid .empty{border:1px solid var(--border);border-radius:var(--r-md);padding:24px 16px}.recovery-grid .empty h3{font-size:18px}",
        ..Default::default()
    }, CspShellOpts::new(nonce)
        .with_line(LineShellOpts::new(LineExpression::Line).with_extensions())
        .with_wire(WireShellOpts::new("workspace-main").with_motion())));
}
