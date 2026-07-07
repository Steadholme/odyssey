use crate::html::{esc, raw, Html};
use crate::i18n::{t, Locale};
use crate::icons;
use crate::APP_CSS;

pub struct Brand {
    pub tile_svg: &'static str,
    pub accent: &'static str,
    pub name: &'static str,
    pub sub: &'static str,
}

pub struct NavItem {
    pub href: &'static str,
    pub label: &'static str,
    pub icon: &'static str,
    pub active: bool,
}

pub struct UserBox {
    pub email: Option<String>,
    pub logout_url: &'static str,
}

pub struct ShellOpts {
    pub extra_css: &'static str,
    pub head_extra: Html,
    pub body_class: &'static str,
    /// The resolved UI locale — drives `<html lang>`, the chrome strings, and the CSS `:lang`
    /// CJK font selection. Defaults to `En`; a service opts in with
    /// `ShellOpts { locale: odyssey::resolve_locale(cookie, accept_language), ..Default::default() }`.
    pub locale: Locale,
}

impl Default for ShellOpts {
    fn default() -> Self {
        Self {
            extra_css: "",
            head_extra: Html::default(),
            body_class: "",
            locale: Locale::En,
        }
    }
}

pub struct PageChrome<'a> {
    pub title: &'a str,
    pub brand: Brand,
    pub nav: &'a [NavItem],
    pub user: UserBox,
    pub footer: Html,
}

pub fn page_shell(chrome: PageChrome<'_>, body: Html, opts: ShellOpts) -> String {
    let body_attr = if opts.body_class.is_empty() {
        String::new()
    } else {
        format!(" class=\"{}\"", esc(opts.body_class))
    };
    let nav = render_nav(chrome.nav);
    let footer = if chrome.footer.as_str().is_empty() {
        String::new()
    } else {
        format!("<footer class=\"site-foot\">{}</footer>", chrome.footer)
    };
    let tile_style = if chrome.brand.accent.is_empty() {
        String::new()
    } else {
        format!(" style=\"--app:{}\"", esc(chrome.brand.accent))
    };

    format!(
        concat!(
            "<!doctype html>\n",
            "<html lang=\"{lang}\">\n",
            "<head>\n",
            "<meta charset=\"utf-8\">\n",
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n",
            "<title>{title}</title>\n",
            "<style>{css}{extra_css}</style>\n",
            "{head_extra}\n",
            "</head>\n",
            "<body{body_attr}>\n",
            "<header class=\"appbar\">",
            "<a class=\"appbar__brand\" href=\"/\">",
            "<span class=\"app-tile\"{tile_style}>{tile_svg}</span>",
            "<span class=\"appbar__name\"><b>{brand_name}</b><span>{brand_sub}</span></span>",
            "</a>",
            "{nav}",
            "<span class=\"appbar__spacer\"></span>",
            "<div class=\"appbar__right\">{switcher}{userbox}</div>",
            "</header>\n",
            "<main class=\"console\">{body}</main>\n",
            "{footer}\n",
            "</body>\n",
            "</html>\n"
        ),
        lang = opts.locale.bcp47(),
        title = esc(chrome.title),
        css = APP_CSS,
        extra_css = opts.extra_css,
        head_extra = opts.head_extra,
        body_attr = body_attr,
        tile_style = tile_style,
        tile_svg = raw(chrome.brand.tile_svg),
        brand_name = esc(chrome.brand.name),
        brand_sub = esc(chrome.brand.sub),
        nav = nav,
        switcher = render_switcher(opts.locale),
        userbox = render_userbox(&chrome.user, opts.locale),
        body = body,
        footer = footer
    )
}

/// The estate language switcher: three script-native autonyms linking to the gateway-owned
/// `/_gw/lang?to=…` endpoint, which sets the `__Secure-lang` cookie (Domain=.w33d.xyz) and bounces
/// back. Pure SSR — works with no JavaScript. The current locale is marked active.
fn render_switcher(locale: Locale) -> String {
    let mut out = String::from("<div class=\"langswitch\" role=\"group\" aria-label=\"Language\">");
    for l in Locale::all() {
        let key = match l {
            Locale::En => "lang.name.en",
            Locale::Zh => "lang.name.zh",
            Locale::Ja => "lang.name.ja",
        };
        let (active, current) = if l == locale {
            (" is-active", " aria-current=\"true\"")
        } else {
            ("", "")
        };
        out.push_str(&format!(
            "<a class=\"langswitch__opt{}\" href=\"/_gw/lang?to={}\"{}>{}</a>",
            active,
            l.code(),
            current,
            esc(t(locale, key)).0
        ));
    }
    out.push_str("</div>");
    out
}

pub fn layout_split(main: Html, side: Html) -> Html {
    Html(format!(
        "<div class=\"layout\"><div>{}</div><div>{}</div></div>",
        main, side
    ))
}

pub fn console_head(h1: &str, sub: Html) -> Html {
    Html(format!(
        "<div class=\"pagehead\"><div><h1>{}</h1>{}</div></div>",
        esc(h1),
        sub
    ))
}

fn render_nav(nav: &[NavItem]) -> String {
    if nav.is_empty() {
        return String::new();
    }

    let mut out = String::from("<nav class=\"appbar__nav\">");
    for item in nav {
        let active = if item.active { " is-active" } else { "" };
        out.push_str(&format!(
            "<a class=\"appnav{}\" href=\"{}\">{}<span>{}</span></a>",
            active,
            esc(item.href),
            raw(item.icon),
            esc(item.label)
        ));
    }
    out.push_str("</nav>");
    out
}

fn render_userbox(user: &UserBox, locale: Locale) -> String {
    let (avatar, name, sub) = match user.email.as_deref() {
        Some(email) if !email.is_empty() => (
            esc(&initials(email)).0,
            esc(&local_part(email)).0,
            esc(email).0,
        ),
        _ => (
            icons::icon("key").0,
            esc(t(locale, "chrome.account")).0,
            esc(t(locale, "chrome.not_signed_in")).0,
        ),
    };

    // CSS focus-within controls this popover; without JS there is no truthful aria-expanded state.
    format!(
        concat!(
            "<div class=\"usermenu\">",
            "<button class=\"usermenu__btn\" type=\"button\" aria-haspopup=\"true\">",
            "<span class=\"avatar\" aria-hidden=\"true\">{avatar}</span>",
            "<span class=\"usermenu__name\">{name}</span>",
            "{caret}",
            "</button>",
            "<div class=\"usermenu__pop\">",
            "<div class=\"usermenu__head\"><span class=\"avatar avatar--lg\" aria-hidden=\"true\">{avatar}</span>",
            "<div><b>{name}</b><span>{sub}</span></div></div>",
            "<a class=\"menuitem\" href=\"/\">{apps}<span>{all_apps}</span></a>",
            "<a class=\"menuitem menuitem--danger\" href=\"{logout}\">{logout_icon}<span>{log_out}</span></a>",
            "</div>",
            "</div>"
        ),
        avatar = avatar,
        name = name,
        sub = sub,
        caret = caret_icon(),
        apps = icons::icon("database"),
        all_apps = esc(t(locale, "chrome.all_apps")).0,
        logout = esc(user.logout_url),
        logout_icon = icons::icon("x"),
        log_out = esc(t(locale, "chrome.log_out")).0
    )
}

fn caret_icon() -> Html {
    raw(
        r#"<svg class="usermenu__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>"#,
    )
}

fn initials(email: &str) -> String {
    let local = email.split('@').next().unwrap_or(email);
    let letters: Vec<char> = local
        .split(|c: char| !c.is_alphanumeric())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.chars().next())
        .take(2)
        .collect();
    if letters.is_empty() {
        return email
            .chars()
            .next()
            .unwrap_or('H')
            .to_uppercase()
            .to_string();
    }
    letters.into_iter().flat_map(|c| c.to_uppercase()).collect()
}

fn local_part(email: &str) -> String {
    email.split('@').next().unwrap_or(email).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chrome() -> PageChrome<'static> {
        PageChrome {
            title: "Test",
            brand: Brand {
                tile_svg: "",
                accent: "",
                name: "App",
                sub: "app.w33d.xyz",
            },
            nav: &[],
            user: UserBox {
                email: None,
                logout_url: "https://sso.w33d.xyz/_gw/auth/logout",
            },
            footer: Html::default(),
        }
    }

    #[test]
    fn shell_localizes_chrome_and_html_lang() {
        // English (default): the untranslated chrome + en lang tag.
        let en = page_shell(chrome(), Html::default(), ShellOpts::default());
        assert!(en.contains("<html lang=\"en\">"));
        assert!(en.contains(">Account<") && en.contains(">All apps<") && en.contains(">Log out<"));

        // Chinese: localized chrome + the BCP-47 tag that drives CSS :lang CJK fonts.
        let zh = page_shell(
            chrome(),
            Html::default(),
            ShellOpts {
                locale: Locale::Zh,
                ..Default::default()
            },
        );
        assert!(
            zh.contains("<html lang=\"zh-Hans\">"),
            "zh lang tag drives CJK :lang fonts"
        );
        assert!(zh.contains("账户") && zh.contains("所有应用") && zh.contains("退出登录"));

        // Japanese.
        let ja = page_shell(
            chrome(),
            Html::default(),
            ShellOpts {
                locale: Locale::Ja,
                ..Default::default()
            },
        );
        assert!(ja.contains("<html lang=\"ja\">"));
        assert!(ja.contains("アカウント") && ja.contains("ログアウト"));
    }

    #[test]
    fn shell_renders_language_switcher() {
        let out = page_shell(chrome(), Html::default(), ShellOpts::default());
        // Autonyms (each language in its own script) linking the gateway switcher endpoint.
        assert!(out.contains("href=\"/_gw/lang?to=zh\">中文"));
        assert!(out.contains("href=\"/_gw/lang?to=ja\">日本語"));
        // The active locale is marked.
        assert!(out.contains("langswitch__opt is-active\" href=\"/_gw/lang?to=en\""));
    }
}
