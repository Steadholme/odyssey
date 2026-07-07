use crate::html::{esc, Html};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
    Ok,
    Warn,
    Down,
    Info,
    Accent,
    Neutral,
}

impl Tone {
    fn pill_class(self) -> &'static str {
        match self {
            Tone::Ok => "pill-ok",
            Tone::Warn => "pill-warn",
            Tone::Down => "pill-down",
            Tone::Info => "pill-info",
            Tone::Accent => "pill-accent",
            Tone::Neutral => "pill-neutral",
        }
    }

    fn toast_class(self) -> &'static str {
        match self {
            Tone::Ok => " toast--ok",
            Tone::Down => " toast--err",
            Tone::Warn | Tone::Info | Tone::Accent | Tone::Neutral => "",
        }
    }

    fn toast_mark(self) -> &'static str {
        match self {
            Tone::Ok => "ok",
            Tone::Down => "!",
            Tone::Warn => "!",
            Tone::Info => "i",
            Tone::Accent => "*",
            Tone::Neutral => "-",
        }
    }
}

pub fn pill(tone: Tone, label: &str) -> Html {
    Html(format!(
        "<span class=\"pill {}\">{}</span>",
        tone.pill_class(),
        esc(label)
    ))
}

pub fn toast(tone: Tone, msg: &str) -> Html {
    Html(format!(
        "<div class=\"toast{}\"><span class=\"toast__ico\">{}</span>{}</div>",
        tone.toast_class(),
        esc(tone.toast_mark()),
        esc(msg)
    ))
}

pub fn switch(name: &str, checked: bool) -> Html {
    let checked_attr = if checked { " checked" } else { "" };
    Html(format!(
        "<span class=\"switch\"><input type=\"checkbox\" role=\"switch\" aria-label=\"{}\" name=\"{}\"{}><i aria-hidden=\"true\"></i></span>",
        esc(name),
        esc(name),
        checked_attr
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn switch_has_accessible_switch_semantics() {
        let html = switch("alerts", true);

        assert!(html.as_str().contains("role=\"switch\""));
        assert!(html.as_str().contains("aria-label=\"alerts\""));
        assert!(html.as_str().contains("checked"));
    }
}
