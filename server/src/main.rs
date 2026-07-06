use axum::{
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    time::Duration,
};

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:8300";

const CONTENT_TYPE_HTML: &str = "text/html; charset=utf-8";
const CONTENT_TYPE_CSS: &str = "text/css; charset=utf-8";
const CONTENT_TYPE_JS: &str = "application/javascript; charset=utf-8";
const CONTENT_TYPE_TEXT: &str = "text/plain; charset=utf-8";

const CACHE_DOCS: &str = "no-cache";
const CACHE_DIST: &str = "public, max-age=3600";
const CACHE_VERSIONED: &str = "public, max-age=31536000, immutable";

const DIST_ODYSSEY_CSS: &str = include_str!("../../dist/odyssey.css");
const DIST_ODYSSEY_JS: &str = include_str!("../../dist/odyssey.js");
const DIST_ODYSSEY_FONT_CSS: &str = include_str!("../../dist/odyssey-font.css");

const SITE_INDEX: &str = include_str!("../../site/index.html");
const SITE_GETTING_STARTED: &str = include_str!("../../site/getting-started.html");
const SITE_TOKENS: &str = include_str!("../../site/tokens.html");
const SITE_ACTIONS: &str = include_str!("../../site/actions.html");
const SITE_FORMS: &str = include_str!("../../site/forms.html");
const SITE_DATA_DISPLAY: &str = include_str!("../../site/data-display.html");
const SITE_FEEDBACK: &str = include_str!("../../site/feedback.html");
const SITE_NAVIGATION: &str = include_str!("../../site/navigation.html");
const SITE_TYPOGRAPHY: &str = include_str!("../../site/typography.html");
const SITE_LAYOUT: &str = include_str!("../../site/layout.html");
const SITE_OVERLAYS: &str = include_str!("../../site/overlays.html");
const SITE_ASSET_CSS: &str = include_str!("../../site/assets/site.css");
const SITE_ASSET_JS: &str = include_str!("../../site/assets/site.js");

#[tokio::main]
async fn main() {
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        std::process::exit(run_healthcheck());
    }

    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
    let addr: SocketAddr = bind_addr.unwrap_or_exit("BIND_ADDR");

    let app = Router::new()
        .route("/healthz", get(healthz))
        .fallback(static_handler);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));

    println!("odyssey-server listening on http://{addr}");
    if let Err(e) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("server error: {e}");
        std::process::exit(1);
    }
}

async fn shutdown_signal() {
    if let Err(e) = tokio::signal::ctrl_c().await {
        eprintln!("failed to install Ctrl-C handler: {e}");
    }
}

async fn healthz() -> Response {
    static_response(StatusCode::OK, CONTENT_TYPE_TEXT, None, "ok")
}

async fn static_handler(uri: Uri) -> Response {
    route_static(uri.path())
}

fn route_static(path: &str) -> Response {
    match path {
        "/" | "/index.html" => site_html(SITE_INDEX),
        "/getting-started.html" => site_html(SITE_GETTING_STARTED),
        "/tokens.html" => site_html(SITE_TOKENS),
        "/actions.html" => site_html(SITE_ACTIONS),
        "/forms.html" => site_html(SITE_FORMS),
        "/data-display.html" => site_html(SITE_DATA_DISPLAY),
        "/feedback.html" => site_html(SITE_FEEDBACK),
        "/navigation.html" => site_html(SITE_NAVIGATION),
        "/typography.html" => site_html(SITE_TYPOGRAPHY),
        "/layout.html" => site_html(SITE_LAYOUT),
        "/overlays.html" => site_html(SITE_OVERLAYS),
        "/assets/site.css" => static_response(
            StatusCode::OK,
            CONTENT_TYPE_CSS,
            Some(CACHE_DOCS),
            SITE_ASSET_CSS,
        ),
        "/assets/site.js" => static_response(
            StatusCode::OK,
            CONTENT_TYPE_JS,
            Some(CACHE_DOCS),
            SITE_ASSET_JS,
        ),
        _ => {
            if let Some(file) = path.strip_prefix("/dist/") {
                dist_asset(file, CACHE_DIST)
            } else if let Some(file) = path.strip_prefix("/1.0/") {
                dist_asset(file, CACHE_VERSIONED)
            } else {
                not_found()
            }
        }
    }
}

fn site_html(body: &'static str) -> Response {
    static_response(StatusCode::OK, CONTENT_TYPE_HTML, Some(CACHE_DOCS), body)
}

fn dist_asset(file: &str, cache_control: &'static str) -> Response {
    match file {
        "odyssey.css" => static_response(
            StatusCode::OK,
            CONTENT_TYPE_CSS,
            Some(cache_control),
            DIST_ODYSSEY_CSS,
        ),
        "odyssey.js" => static_response(
            StatusCode::OK,
            CONTENT_TYPE_JS,
            Some(cache_control),
            DIST_ODYSSEY_JS,
        ),
        "odyssey-font.css" => static_response(
            StatusCode::OK,
            CONTENT_TYPE_CSS,
            Some(cache_control),
            DIST_ODYSSEY_FONT_CSS,
        ),
        _ => not_found(),
    }
}

fn not_found() -> Response {
    static_response(
        StatusCode::NOT_FOUND,
        CONTENT_TYPE_TEXT,
        Some(CACHE_DOCS),
        "not found",
    )
}

fn static_response(
    status: StatusCode,
    content_type: &'static str,
    cache_control: Option<&'static str>,
    body: &'static str,
) -> Response {
    let mut response = (status, body).into_response();
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    if let Some(value) = cache_control {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(value));
    }
    response
}

fn run_healthcheck() -> i32 {
    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
    let target = healthcheck_target(&bind_addr);

    match healthcheck_once(&target) {
        Ok(true) => 0,
        Ok(false) => {
            eprintln!("healthcheck: {target} did not return a 2xx response");
            1
        }
        Err(e) => {
            eprintln!("healthcheck: {target} error: {e}");
            1
        }
    }
}

fn healthcheck_target(bind_addr: &str) -> String {
    let port = bind_addr
        .rsplit(':')
        .next()
        .filter(|part| !part.is_empty())
        .unwrap_or("8300");
    format!("127.0.0.1:{port}")
}

fn healthcheck_once(target: &str) -> std::io::Result<bool> {
    let addr: SocketAddr = target
        .parse()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, format!("{e}")))?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2))?;
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    stream.set_write_timeout(Some(Duration::from_secs(2)))?;
    stream.write_all(b"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")?;

    let mut buf = String::new();
    stream.read_to_string(&mut buf)?;
    let status_line = buf.lines().next().unwrap_or("");
    Ok(status_line_is_success(status_line))
}

fn status_line_is_success(status_line: &str) -> bool {
    let mut parts = status_line.split_whitespace();
    let _http_version = parts.next();
    parts
        .next()
        .and_then(|code| code.parse::<u16>().ok())
        .is_some_and(|code| (200..300).contains(&code))
}

trait ParseSocketAddr {
    fn unwrap_or_exit(self, label: &str) -> SocketAddr;
}

impl ParseSocketAddr for String {
    fn unwrap_or_exit(self, label: &str) -> SocketAddr {
        match self.parse() {
            Ok(addr) => addr,
            Err(e) => {
                eprintln!("invalid {label} {self:?}: {e}");
                std::process::exit(1);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serves_doc_home_as_html() {
        let response = route_static("/");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_HTML);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DOCS);
    }

    #[test]
    fn serves_dist_assets_with_short_cache() {
        let response = route_static("/dist/odyssey.js");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_JS);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DIST);
        assert_eq!(header(&response, header::ACCESS_CONTROL_ALLOW_ORIGIN), "*");
    }

    #[test]
    fn serves_versioned_assets_with_immutable_cache() {
        let response = route_static("/1.0/odyssey.css");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_CSS);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_VERSIONED);
        assert_eq!(header(&response, header::ACCESS_CONTROL_ALLOW_ORIGIN), "*");
    }

    #[test]
    fn unknown_path_is_plain_text_404() {
        let response = route_static("/missing.css");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_TEXT);
    }

    #[test]
    fn healthcheck_targets_loopback_port_from_bind_addr() {
        assert_eq!(healthcheck_target("0.0.0.0:8399"), "127.0.0.1:8399");
        assert_eq!(healthcheck_target("[::]:8301"), "127.0.0.1:8301");
    }

    #[test]
    fn healthcheck_accepts_any_2xx_status() {
        assert!(status_line_is_success("HTTP/1.1 204 No Content"));
        assert!(!status_line_is_success(
            "HTTP/1.1 500 Internal Server Error"
        ));
    }

    fn header(response: &Response, name: header::HeaderName) -> &str {
        response.headers().get(name).unwrap().to_str().unwrap()
    }
}
