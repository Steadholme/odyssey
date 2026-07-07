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
        section("bank", "W3 bank components", bank_demo()),
        section("density", "Compact density", compact_demo()),
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
    tabs(
        "Resource sections",
        &[
            Tab {
                href: "#overview",
                label: "Overview",
                active: true,
            },
            Tab {
                href: "#usage",
                label: "Usage",
                active: false,
            },
            Tab {
                href: "#keys",
                label: "Keys",
                active: false,
            },
        ],
        TabsOpts::default(),
    )
}

fn pager_demo() -> Html {
    pager(Locale::En, 2, 3, "#page-")
}

fn modal_demo() -> Html {
    modal(
        "revoke-key",
        "Revoke key",
        raw(format!(
            "<p>This trusted static snippet demonstrates modal classes.</p>{}",
            checkbox_field("confirm", "I understand this cannot be undone", false)
        )),
        raw(format!(
            "{}{}",
            button("Cancel", Variant::Ghost, BtnOpts::default()),
            button("Revoke", Variant::Danger, BtnOpts::default())
        )),
        true,
    )
}

fn bank_demo() -> Html {
    let alerts = raw(format!(
        "<div class=\"gallery-stack\">{}{}{}{}</div>",
        alert(
            Tone::Ok,
            Some("Saved"),
            "Changes replicated to all regions."
        ),
        alert(Tone::Warn, Some("Near limit"), "Storage is above 80%."),
        alert(
            Tone::Down,
            Some("Deploy failed"),
            "Builder node is unreachable."
        ),
        alert(Tone::Info, None, "Version 1.1.0 is available.")
    ));
    let chips = raw(format!(
        "<div class=\"gallery-row\">{}<span class=\"chip tone-3 chip--dot\">Growth<span class=\"countpill\">7</span><button class=\"chip__remove\" type=\"button\" aria-label=\"Remove Growth\">×</button></span>{}</div>",
        filter_chip(Locale::En, "region: fsn1", "#remove-region"),
        letter_tile("Odyssey", "odyssey")
    ));
    let rich = raw(concat!(
        "<dl class=\"desc\"><dt class=\"desc__term\">Owner</dt><dd class=\"desc__val\">Platform</dd><dt class=\"desc__term\">Region</dt><dd class=\"desc__val\">FSN1</dd></dl>",
        "<div class=\"segment\"><a class=\"segment__item is-active\" href=\"#\">Daily</a><a class=\"segment__item\" href=\"#\">Weekly</a><a class=\"segment__item\" href=\"#\">Monthly</a></div>",
        "<div class=\"stepper\"><div class=\"step is-done\"><span class=\"step__dot\">1</span><div class=\"step__body\"><div class=\"step__label\">Plan</div><div class=\"step__sub\">Done</div></div></div><div class=\"step is-active\"><span class=\"step__dot\">2</span><div class=\"step__body\"><div class=\"step__label\">Build</div><div class=\"step__sub\">Running</div></div></div><div class=\"step\"><span class=\"step__dot\">3</span><div class=\"step__body\"><div class=\"step__label\">Ship</div><div class=\"step__sub\">Queued</div></div></div></div>"
    ));
    let disclosure = raw(concat!(
        "<div class=\"accordion\"><details class=\"accordion__item\" open><summary class=\"accordion__head\"><span>Deployment notes</span><svg class=\"accordion__caret\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg></summary><div class=\"accordion__panel\">Zero JavaScript details/summary accordion.</div></details></div>",
        "<details class=\"pop\"><summary class=\"btn btn-ghost btn-sm\">Actions</summary><div class=\"pop__card\"><a class=\"menuitem\" href=\"#\">Open</a><a class=\"menuitem menuitem--danger\" href=\"#\">Delete</a></div></details>",
        "<div class=\"drawer is-open\" style=\"position:relative;height:190px;inset:auto\"><div class=\"drawer__backdrop\"></div><div class=\"drawer__panel\"><div class=\"drawer__head\"><h2 class=\"drawer__title\">Drawer</h2></div><div class=\"drawer__body\">Server-rendered drawer shell.</div><div class=\"drawer__foot\"><button class=\"btn btn-ghost btn-sm\">Close</button></div></div></div>"
    ));
    let timeline = raw(concat!(
        "<ul class=\"eventline\"><li class=\"eventline__item\"><span class=\"eventline__dot eventline__dot--ok\"></span><div class=\"eventline__time\">09:12</div><div class=\"eventline__title\">Build complete</div><div class=\"eventline__body\">Artifacts uploaded.</div></li><li class=\"eventline__item\"><span class=\"eventline__dot eventline__dot--warn\"></span><div class=\"eventline__time\">09:18</div><div class=\"eventline__title\">Manual approval</div><div class=\"eventline__body\">Waiting on operator.</div></li></ul>",
        "<div class=\"error-card\"><div class=\"error-card__code\">404</div><div class=\"error-card__title\">Not found</div><div class=\"error-card__msg\">The requested example does not exist.</div></div>"
    ));
    let chrome = raw(format!(
        concat!(
            "<div class=\"masthead\"><div><div class=\"masthead__eyebrow\">Release</div><h1 class=\"masthead__title\">Bank withdrawal</h1><p class=\"masthead__tagline\">Components harvested into canonical Odyssey.</p></div><div class=\"masthead__actions\">{}</div></div>",
            "<div class=\"filterbar\"><input class=\"input\" type=\"search\" value=\"status:open\"><div class=\"filterbar__right\"><span class=\"notif-badge-wrap\"><button class=\"iconbtn\" type=\"button\">{}</button><span class=\"notif-badge notif-badge--accent\">3</span></span></div></div>"
        ),
        button("Ship", Variant::Primary, BtnOpts::default()),
        icons::icon("search")
    ));

    raw(format!(
        "<div class=\"gallery-grid\">{}{}{}{}{}{}{}{}</div>",
        card("Alerts", alerts),
        card("Chips and identity", chips),
        card(
            "Progress and skeleton",
            raw(format!("{}{}", progress(63, Tone::Ok), skeleton(4)))
        ),
        card(
            "Breadcrumb",
            breadcrumb(Locale::En, &[("/", "Home"), ("#bank", "Bank")])
        ),
        card("Description, segment, stepper", rich),
        card("Disclosure and overlays", disclosure),
        card("Timeline and errors", timeline),
        card("Masthead, filterbar, badge", chrome)
    ))
}

fn compact_demo() -> Html {
    raw(format!(
        "<div data-density=\"compact\" class=\"gallery-grid\">{}{}{}</div>",
        card(
            "Compact controls",
            raw(format!(
                "<div class=\"gallery-row\">{}{}{} </div>",
                button("Save", Variant::Primary, BtnOpts::default()),
                button("Cancel", Variant::Ghost, BtnOpts::default()),
                filter_chip(Locale::En, "compact", "#")
            ))
        ),
        card(
            "Compact data",
            raw(format!("{}{}", progress(42, Tone::Info), skeleton(3)))
        ),
        pagehead(PageHead {
            eyebrow: Some("Density"),
            glyph: Some(icons::icon("zap")),
            title: "Compact pagehead",
            meta: raw("<p>Scoped preview using the density tokens.</p>"),
            actions: raw(format!(
                "{}",
                button("Action", Variant::Primary, BtnOpts::default())
            )),
        })
    ))
}
