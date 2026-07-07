use odyssey::*;

const BRAND_TILE: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>"#;
const ICON_GRID: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>"#;
const ICON_SHIELD: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>"#;

const GALLERY_CSS: &str = r#"
.gallery-stack{display:grid;gap:var(--sp-5)}
.gallery-section{display:grid;gap:var(--sp-3)}
.gallery-row{display:flex;flex-wrap:wrap;gap:var(--sp-3);align-items:center}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--sp-4)}
"#;

fn main() {
    let chrome = PageChrome {
        title: "Odyssey Helper Gallery",
        brand: Brand {
            tile_svg: BRAND_TILE,
            accent: "#4f46e5",
            name: "Odyssey",
            sub: "helper-rendered UI",
        },
        nav: &[
            NavItem {
                href: "#controls",
                label: "Controls",
                icon: ICON_GRID,
                active: true,
            },
            NavItem {
                href: "#data",
                label: "Data",
                icon: ICON_SHIELD,
                active: false,
            },
        ],
        user: UserBox {
            email: Some(String::from("ops@w33d.xyz")),
            logout_url: "/logout",
        },
        footer: raw("<span>Odyssey helper gallery</span><a href=\"#top\">Top</a>"),
    };

    let opts = ShellOpts {
        extra_css: GALLERY_CSS,
        head_extra: Html::default(),
        body_class: "page-console",
        ..Default::default()
    };

    print!("{}", page_shell(chrome, gallery_body(), opts));
}

fn gallery_body() -> Html {
    Html::concat([
        raw("<div id=\"top\" class=\"gallery-stack\">"),
        console_head(
            "Odyssey helpers",
            raw("<p>Kitchen-sink page rendered by the Rust helper API.</p>"),
        ),
        section("controls", "Buttons", buttons_demo()),
        section("feedback", "Pills, toasts, switches", feedback_demo()),
        section("data", "Cards, stats, tables", data_demo()),
        section("forms", "Forms and fields", forms_demo()),
        section("layout", "Layout, tabs, modal, pager", layout_demo()),
        raw("</div>"),
    ])
}

fn section(id: &str, title: &str, body: Html) -> Html {
    raw(format!(
        "<section id=\"{}\" class=\"gallery-section\"><h2>{}</h2>{}</section>",
        esc(id),
        esc(title),
        body
    ))
}

fn buttons_demo() -> Html {
    raw(format!(
        "<div class=\"gallery-row\">{}{}{}{}{}{}{}{}</div>",
        button("Primary", Variant::Primary, BtnOpts::default()),
        button("Secondary", Variant::Secondary, BtnOpts::default()),
        button("Ghost", Variant::Ghost, BtnOpts::default()),
        button("Subtle", Variant::Subtle, BtnOpts::default()),
        button("Danger", Variant::Danger, BtnOpts::default()),
        button(
            "Small",
            Variant::Primary,
            BtnOpts {
                small: true,
                ..BtnOpts::default()
            }
        ),
        button(
            "Large",
            Variant::Primary,
            BtnOpts {
                large: true,
                ..BtnOpts::default()
            }
        ),
        button(
            "Saving",
            Variant::Primary,
            BtnOpts {
                busy: true,
                ..BtnOpts::default()
            }
        )
    ))
}

fn feedback_demo() -> Html {
    raw(format!(
        concat!(
            "<div class=\"gallery-row\">{}{}{}{}{}{}{}{}{}</div>",
            "<div class=\"toast-region\" style=\"position:static;transform:none;align-items:flex-start;pointer-events:auto\">{}{}</div>"
        ),
        pill(Tone::Ok, "ok"),
        pill(Tone::Warn, "warn"),
        pill(Tone::Down, "down"),
        pill(Tone::Info, "info"),
        pill(Tone::Accent, "accent"),
        pill(Tone::Neutral, "neutral"),
        raw("<label class=\"check\">"),
        switch("enabled", true),
        raw(" Enabled</label>"),
        toast(Tone::Ok, "API key created"),
        toast(Tone::Down, "Upstream returned 502")
    ))
}

fn data_demo() -> Html {
    let cols = [
        Col {
            label: "Service",
            numeric: false,
        },
        Col {
            label: "Status",
            numeric: false,
        },
        Col {
            label: "Requests",
            numeric: true,
        },
    ];
    let table_html = table(
        Locale::En,
        &cols,
        vec![
            vec![raw("relay"), pill(Tone::Ok, "healthy"), raw("48,211")],
            vec![raw("corvid"), pill(Tone::Warn, "degraded"), raw("9,038")],
            vec![raw("beacon"), pill(Tone::Down, "down"), raw("0")],
        ],
    );
    let stats = raw(format!(
        "<div class=\"stat-grid\">{}{}{}</div>",
        stat_tile(
            "Requests",
            "48,211",
            Some(raw(
                "<div class=\"stat__meter\"><i style=\"width:72%\"></i></div>"
            )),
            Some("+12.4% vs yesterday"),
        ),
        stat_tile(
            "Latency",
            "184 ms",
            Some(raw(
                "<div class=\"stat__meter\"><i style=\"width:46%\"></i></div>"
            )),
            Some("P95"),
        ),
        stat_tile("Uptime", "99.98%", None, Some("90 days")),
    ));
    raw(format!(
        "<div class=\"gallery-grid\">{}{}{}</div>",
        card("Status", stats),
        card_list("Service table", table_html),
        card("Empty table", table(Locale::En, &cols, Vec::new()))
    ))
}

fn forms_demo() -> Html {
    let form_body = Html::concat([
        field("Name", text_input("name", "relay", &[])),
        field("Replicas", number_input("replicas", "1", "9", "3")),
        field(
            "Region",
            select(
                "region",
                &[("fsn1", "FSN1"), ("hel1", "HEL1"), ("ash", "ASH")],
                Some("fsn1"),
                &[],
            ),
        ),
        field_hint(
            "Notes",
            textarea("notes", 4, "Rotate keys monthly.", &[]),
            "Plain text only.",
        ),
        range_field("Traffic split", "split", "0", "100", "5", "45", true),
        checkbox_field("logging", "Enable request logging", true),
        raw(format!(
            "<div class=\"actions\">{}{}</div>",
            button("Save changes", Variant::Primary, BtnOpts::default()),
            link_button("/cancel", "Cancel", Variant::Ghost, BtnOpts::default())
        )),
    ]);

    card(
        "Settings form",
        form("post", "/settings", Csrf("csrf<&token"), form_body),
    )
}

fn layout_demo() -> Html {
    let main = card_list(
        "Main column",
        raw(format!("{}{}", tabs_demo(), pager_demo())),
    );
    let side = Html::concat([
        stat_tile(
            "Spend",
            "$66.15",
            Some(raw(
                "<div class=\"stat__meter\"><i style=\"width:58%\"></i></div>",
            )),
            Some("30d"),
        ),
        modal_demo(),
    ]);
    layout_split(main, side)
}

fn tabs_demo() -> Html {
    raw(concat!(
        "<nav class=\"tabs\">",
        "<a class=\"tab is-active\" href=\"#\">Overview</a>",
        "<a class=\"tab\" href=\"#\">Usage</a>",
        "<a class=\"tab\" href=\"#\">Keys</a>",
        "</nav>"
    ))
}

fn pager_demo() -> Html {
    raw(format!(
        concat!(
            "<nav class=\"pager\" aria-label=\"Pagination\">",
            "{}",
            "<span class=\"pager__spacer\"></span>",
            "<a href=\"#\">1</a>",
            "<span class=\"is-current\">2</span>",
            "<a href=\"#\">3</a>",
            "{}",
            "</nav>"
        ),
        link_button(
            "#",
            "Newer",
            Variant::Ghost,
            BtnOpts {
                small: true,
                ..BtnOpts::default()
            }
        ),
        link_button(
            "#",
            "Older",
            Variant::Ghost,
            BtnOpts {
                small: true,
                ..BtnOpts::default()
            }
        )
    ))
}

fn modal_demo() -> Html {
    raw(format!(
        concat!(
            "<div class=\"modal\" role=\"dialog\" aria-modal=\"true\">",
            "<div class=\"modal__card\">",
            "<div class=\"modal__head\"><h2>Revoke key</h2></div>",
            "<div class=\"modal__body\"><p>This trusted static snippet demonstrates modal classes.</p>{}</div>",
            "<div class=\"modal__foot\">{}{}</div>",
            "</div>",
            "</div>"
        ),
        checkbox_field("confirm", "I understand this cannot be undone", false),
        button("Cancel", Variant::Ghost, BtnOpts::default()),
        button("Revoke", Variant::Danger, BtnOpts::default())
    ))
}
