use axum::{
    extract::{Form, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use odyssey::{
    esc, form_with_wire, link_button_with_wire, link_with_wire, raw, stat_tile, wire_page_shell,
    Brand, BtnOpts, Csrf, Html, NavItem, PageChrome, ShellOpts, UserBox, Variant, WireOpts,
    WireShellOpts,
};
use std::{
    collections::{BTreeSet, HashMap},
    fmt::Write as _,
    fs::File,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    sync::{Arc, RwLock},
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
const CACHE_DYNAMIC: &str = "no-store";
const CSRF_COOKIE: &str = "__Host-csrf";
const CSRF_TOKEN_BYTES: usize = 32;
const CSRF_TOKEN_HEX_LEN: usize = CSRF_TOKEN_BYTES * 2;

// Frozen 1.1 immutable snapshots. Do not repoint these constants at the moving canary bundle.
// SHA-256 identities:
// css  be25e37aeb52a32067314921436c9719ee39459314b86bd2c2c005603a0ac27c
// js   6a49d1ed7f8b4135de1be717d7199721e1122f44a1146b3d0eba2e2b9420d50e
// font bfb7661166d95922624bec4f184ece1c34b70983e2b6d70bd19b807dd7d875ac
const DIST_ODYSSEY_11_CSS: &str = include_str!("../../releases/1.1/odyssey.css");
const DIST_ODYSSEY_11_JS: &str = include_str!("../../releases/1.1/odyssey.js");
const DIST_ODYSSEY_11_FONT_CSS: &str = include_str!("../../releases/1.1/odyssey-font.css");

// Frozen 1.2 canary snapshots. The build script also emits byte-identical current artifacts under
// dist/ for the short-cache route; later releases may move dist/ without changing this generation.
// SHA-256 identities:
// css  838bde951f0ab82367ff4aff156e0d375b972d4192f9b94be6914b8b889022e2
// js   c3c1616ff6cc966891a9f9c1551feceb71a226cf231e4032b69545805ebfe226
// font bfb7661166d95922624bec4f184ece1c34b70983e2b6d70bd19b807dd7d875ac
const DIST_ODYSSEY_12_CSS: &str = include_str!("../../releases/1.2/odyssey.css");
const DIST_ODYSSEY_12_JS: &str = include_str!("../../releases/1.2/odyssey.js");
const DIST_ODYSSEY_12_FONT_CSS: &str = include_str!("../../releases/1.2/odyssey-font.css");

// Frozen 1.3 Steadholme structural-language canary. This generation is additive;
// it does not supersede or rewrite the 1.1/1.2 immutable routes above.
// SHA-256 identities:
// css  7b196298f0cc81a691e705dc2555aced33dafdbd01dc1bc51473f257b759cb8f
// js   2bdee27df0d41827d179261724866bcf4facd33dad2a758d3ac03376a3a4785c
// font bfb7661166d95922624bec4f184ece1c34b70983e2b6d70bd19b807dd7d875ac
const DIST_ODYSSEY_13_CSS: &str = include_str!("../../releases/1.3/odyssey.css");
const DIST_ODYSSEY_13_JS: &str = include_str!("../../releases/1.3/odyssey.js");
const DIST_ODYSSEY_13_FONT_CSS: &str = include_str!("../../releases/1.3/odyssey-font.css");
const DIST_ODYSSEY_CURRENT_CSS: &str = include_str!("../../dist/odyssey.css");
const DIST_ODYSSEY_CURRENT_JS: &str = include_str!("../../dist/odyssey.js");
const DIST_ODYSSEY_CURRENT_FONT_CSS: &str = include_str!("../../dist/odyssey-font.css");

#[derive(Clone, Copy)]
enum DistRelease {
    Current,
    Snapshot11,
    Canary12,
    Canary13,
}

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

const BRAND_TILE: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 2v20M2 12h20"/><path d="m12 7 3 5-3 5-3-5Z"/></svg>"#;
const ICON_ATLAS: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4.5 9h15M4.5 15h15M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z"/></svg>"#;
const ICON_MANUAL: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3Z"/><path d="M7 4v16M10 8h6M10 12h6"/></svg>"#;

const ESTATE_CSS: &str = r#"
.estate-atlas{display:grid;gap:var(--sp-5);max-width:1480px;margin:0 auto}
.estate-hero{position:relative;overflow:hidden;border:1px solid var(--frame-rule);background:var(--surface-etched);padding:clamp(22px,4vw,48px);box-shadow:var(--elev-rest)}
.estate-hero::before{content:"REFERENCE / 2026-07-10";position:absolute;right:18px;top:14px;font:600 var(--fs-micro)/1 var(--mono);letter-spacing:var(--track-eyebrow);color:var(--coordinate-ink)}
.estate-hero::after{content:"";position:absolute;right:-70px;bottom:-110px;width:300px;height:300px;border:1px solid var(--frame-rule);border-radius:50%;box-shadow:0 0 0 28px color-mix(in srgb,var(--frame-rule) 45%,transparent),0 0 0 64px color-mix(in srgb,var(--frame-rule) 25%,transparent);pointer-events:none}
.estate-kicker{font:600 var(--fs-micro)/1 var(--mono);letter-spacing:var(--track-eyebrow);text-transform:uppercase;color:var(--coordinate-ink)}
.estate-title{max-width:900px;margin:var(--sp-3) 0 var(--sp-2);font-size:clamp(40px,7vw,92px);line-height:.88;letter-spacing:-.055em}
.estate-deck{max-width:760px;margin:0;color:var(--ink-3);font-size:var(--fs-h3)}
.estate-notice{position:relative;z-index:1;max-width:880px;margin-top:var(--sp-5);border-left:3px solid var(--c-oxide-600);padding:var(--sp-3) var(--sp-4);background:color-mix(in srgb,var(--c-oxide-600) 7%,var(--surface));font-size:var(--fs-sm)}
.estate-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;border:1px solid var(--frame-rule);background:var(--frame-rule)}
.estate-stats .stat{min-width:0;border:0;border-radius:0;background:var(--surface);box-shadow:none}
.estate-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) minmax(190px,.35fr) auto auto;gap:var(--sp-3);align-items:end;border-block:1px solid var(--frame-rule);padding:var(--sp-4) 0}
.estate-toolbar .field{margin:0}
.estate-result{align-self:center;font:600 var(--fs-micro)/1 var(--mono);letter-spacing:.08em;color:var(--coordinate-ink);white-space:nowrap}
.estate-viewbar{display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap}
.estate-viewbar__label{margin-right:auto;font:600 var(--fs-micro)/1 var(--mono);letter-spacing:var(--track-eyebrow);text-transform:uppercase;color:var(--coordinate-ink)}
.estate-viewbtn[aria-pressed="true"],.estate-viewbtn.is-active{color:var(--c-oxide-600);border-color:var(--c-oxide-600);background:color-mix(in srgb,var(--c-oxide-600) 8%,var(--surface))}
.estate-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.72fr);gap:var(--sp-5);align-items:start}
.estate-map{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-3);counter-reset:surface}
.estate-node{position:relative;min-height:190px;border:1px solid var(--frame-rule);background:var(--surface);padding:var(--sp-4);counter-increment:surface;transition:border-color var(--dur-2) var(--ease-out),transform var(--dur-2) var(--ease-out),box-shadow var(--dur-2) var(--ease-out)}
.estate-node::after{content:"0" counter(surface);position:absolute;right:14px;bottom:10px;font:700 42px/1 var(--mono);color:color-mix(in srgb,var(--coordinate-ink) 15%,transparent);pointer-events:none}
.estate-node:hover,.estate-node:focus-within,.estate-node.is-selected{border-color:var(--c-oxide-600);box-shadow:inset 3px 0 0 var(--c-oxide-600);transform:translateY(-2px)}
.estate-node__coord{font:600 var(--fs-micro)/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--coordinate-ink)}
.estate-node h2{margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-h2)}
.estate-node h2 a{color:inherit;text-decoration:none}
.estate-node h2 a::after{content:"";position:absolute;inset:0}
.estate-node__endpoint{position:relative;z-index:1;font:500 var(--fs-sm)/1.4 var(--mono);overflow-wrap:anywhere;color:var(--ink-3)}
.estate-node__foot{position:relative;z-index:1;display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;margin-top:var(--sp-4)}
.estate-exposure{display:inline-flex;align-items:center;min-height:24px;padding:0 var(--sp-2);border:1px solid currentColor;font:600 var(--fs-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase}
.estate-exposure--public{color:var(--ok)}.estate-exposure--mixed{color:var(--warn)}.estate-exposure--wireguard{color:var(--info)}.estate-exposure--compose{color:var(--ink-3)}
.estate-watch{font:600 var(--fs-micro)/1 var(--mono);letter-spacing:.06em;color:var(--c-oxide-600);text-transform:uppercase}
.estate-ledger{overflow-x:auto;border:1px solid var(--frame-rule);background:var(--surface);-webkit-overflow-scrolling:touch}
.estate-ledger table{min-width:720px;margin:0}.estate-ledger tr.is-selected{box-shadow:inset 3px 0 0 var(--c-oxide-600);background:color-mix(in srgb,var(--c-oxide-600) 6%,var(--surface))}
.estate-detail{position:sticky;top:calc(var(--appbar-h,64px) + var(--sp-4));border:1px solid var(--frame-rule);background:var(--surface);box-shadow:var(--elev-sticky)}
.estate-detail__head{padding:var(--sp-4);border-bottom:1px solid var(--frame-rule);background:var(--surface-etched)}
.estate-detail__head h2{margin:var(--sp-2) 0 0;font-size:var(--fs-h1)}
.estate-detail__body{display:grid;gap:var(--sp-4);padding:var(--sp-4)}
.estate-detail dl{display:grid;grid-template-columns:minmax(90px,.5fr) 1fr;gap:var(--sp-2) var(--sp-3);margin:0}
.estate-detail dt{font:600 var(--fs-micro)/1.4 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--coordinate-ink)}
.estate-detail dd{margin:0;overflow-wrap:anywhere}
.estate-sandbox{border-top:1px solid var(--frame-rule);padding-top:var(--sp-4);color:var(--ink-3);font-size:var(--fs-sm)}
.estate-sandbox form{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;margin-top:var(--sp-3)}
.estate-empty{border:1px dashed var(--frame-rule);padding:var(--sp-6);text-align:center;color:var(--ink-3)}
@media (max-width:960px){.page-estate-atlas .usermenu{display:none}.estate-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.estate-layout{grid-template-columns:1fr}.estate-detail{position:static}.estate-toolbar{grid-template-columns:1fr 1fr}.estate-toolbar__actions{grid-column:1/-1}}
@media (max-width:620px){.page-estate-atlas .langswitch{display:none}.estate-hero::before{position:static;display:block;margin-bottom:var(--sp-4)}.estate-hero::after{display:none}.estate-title{font-size:42px}.estate-toolbar,.estate-map{grid-template-columns:1fr}.estate-stats{grid-template-columns:1fr 1fr}.estate-result{white-space:normal}.estate-detail dl{grid-template-columns:1fr}.estate-node{min-height:160px}}
@media (forced-colors:active){.estate-node:hover,.estate-node:focus-within,.estate-node.is-selected{outline:2px solid Highlight}.estate-exposure{forced-color-adjust:auto}}
"#;

#[derive(Clone)]
struct AppState {
    watched: Arc<RwLock<BTreeSet<String>>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            watched: Arc::new(RwLock::new(BTreeSet::new())),
        }
    }

    #[cfg(test)]
    fn for_test() -> Self {
        Self {
            watched: Arc::new(RwLock::new(BTreeSet::new())),
        }
    }

    fn watched(&self) -> BTreeSet<String> {
        self.watched
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set_watched(&self, service: &str, watched: bool) {
        let mut current = self
            .watched
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if watched {
            current.insert(service.to_string());
        } else {
            current.remove(service);
        }
    }

    fn is_watched(&self, service: &str) -> bool {
        self.watched
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .contains(service)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Exposure {
    Public,
    Mixed,
    WireGuard,
    Compose,
}

impl Exposure {
    fn key(self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Mixed => "mixed",
            Self::WireGuard => "wireguard",
            Self::Compose => "compose",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Public => "Public",
            Self::Mixed => "Mixed path boundary",
            Self::WireGuard => "WireGuard only",
            Self::Compose => "Compose only",
        }
    }
}

#[derive(Clone, Copy)]
struct Surface {
    id: &'static str,
    name: &'static str,
    endpoint: &'static str,
    role: &'static str,
    note: &'static str,
    exposure: Exposure,
}

const SURFACES: [Surface; 7] = [
    Surface {
        id: "odyssey",
        name: "Odyssey",
        endpoint: "odyssey.w33d.xyz",
        role: "Public UI framework and field manual",
        note: "Public reference surface for the Odyssey design language and versioned assets.",
        exposure: Exposure::Public,
    },
    Surface {
        id: "beacon",
        name: "Beacon",
        endpoint: "status.w33d.xyz",
        role: "Public status surface",
        note: "Public status host recorded in the repository snapshot.",
        exposure: Exposure::Public,
    },
    Surface {
        id: "relay",
        name: "Relay",
        endpoint: "ai.w33d.xyz",
        role: "Mixed-boundary application surface",
        note: "The root uses SSO; /v1 includes public and application Bearer-auth routes.",
        exposure: Exposure::Mixed,
    },
    Surface {
        id: "cistern",
        name: "Cistern",
        endpoint: "cistern.w33d.xyz",
        role: "Mixed-boundary data surface",
        note: "The root is WireGuard-only while /rest is recorded as public.",
        exposure: Exposure::Mixed,
    },
    Surface {
        id: "atlas",
        name: "Atlas",
        endpoint: "atlas.w33d.xyz",
        role: "Private estate surface",
        note: "The asset catalogue is a WireGuard-only route protected by SSO and the infra-admins group.",
        exposure: Exposure::WireGuard,
    },
    Surface {
        id: "sanctum",
        name: "Sanctum",
        endpoint: "vault.w33d.xyz",
        role: "Private protected surface",
        note: "Representative WireGuard-only service in the verified route inventory.",
        exposure: Exposure::WireGuard,
    },
    Surface {
        id: "postgres",
        name: "Postgres",
        endpoint: "Compose network",
        role: "Internal data dependency",
        note: "Compose-only dependency; it is not presented as a public or WireGuard web surface.",
        exposure: Exposure::Compose,
    },
];

#[derive(Clone, Debug)]
struct EstateQuery {
    q: String,
    exposure: String,
    selected: Option<String>,
}

impl Default for EstateQuery {
    fn default() -> Self {
        Self {
            q: String::new(),
            exposure: "all".to_string(),
            selected: None,
        }
    }
}

impl EstateQuery {
    fn from_params(params: &HashMap<String, String>) -> Self {
        let q = params
            .get("q")
            .map(|value| value.trim().chars().take(80).collect())
            .unwrap_or_default();
        let exposure = match params.get("exposure").map(String::as_str) {
            Some("public" | "mixed" | "wireguard" | "compose") => params["exposure"].clone(),
            _ => "all".to_string(),
        };
        let selected = params
            .get("service")
            .filter(|id| surface_by_id(id).is_some())
            .cloned();
        Self {
            q,
            exposure,
            selected,
        }
    }
}

#[tokio::main]
async fn main() {
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        std::process::exit(run_healthcheck());
    }

    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
    let addr: SocketAddr = bind_addr.unwrap_or_exit("BIND_ADDR");

    let state = AppState::new();
    let app = build_router(state);

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
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut terminate = match signal(SignalKind::terminate()) {
            Ok(signal) => signal,
            Err(e) => {
                eprintln!("failed to install SIGTERM handler: {e}");
                if let Err(e) = tokio::signal::ctrl_c().await {
                    eprintln!("failed to install Ctrl-C handler: {e}");
                }
                return;
            }
        };
        tokio::select! {
            result = tokio::signal::ctrl_c() => {
                if let Err(e) = result {
                    eprintln!("failed to install Ctrl-C handler: {e}");
                }
            }
            _ = terminate.recv() => {}
        }
    }

    #[cfg(not(unix))]
    if let Err(e) = tokio::signal::ctrl_c().await {
        eprintln!("failed to install Ctrl-C handler: {e}");
    }
}

async fn healthz() -> Response {
    static_response(StatusCode::OK, CONTENT_TYPE_TEXT, None, "ok")
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/labs/estate", get(estate_get).post(estate_post))
        .fallback(static_handler)
        .with_state(state)
}

async fn static_handler(uri: Uri) -> Response {
    route_static(uri.path())
}

async fn estate_get(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let query = EstateQuery::from_params(&params);
    let csrf_token = match client_csrf_token(&headers) {
        Ok(token) => token,
        Err(_) => {
            return dynamic_text_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "could not initialize the client CSRF token",
            )
        }
    };
    let body = if is_wire_request(&headers) {
        render_estate_fragment(&state, &query, &csrf_token).0
    } else {
        render_estate_page(&state, &query, &csrf_token)
    };
    estate_html_response(body, &csrf_token)
}

async fn estate_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    Form(form): Form<HashMap<String, String>>,
) -> Response {
    if !same_origin_request(&headers) {
        return dynamic_text_response(
            StatusCode::FORBIDDEN,
            "cross-origin sandbox update rejected",
        );
    }
    let Some(csrf_token) = valid_csrf(&headers, &form) else {
        return dynamic_text_response(
            StatusCode::FORBIDDEN,
            "invalid or expired CSRF token; reload the Estate Atlas and try again",
        );
    };

    let Some(service) = form.get("service").filter(|id| surface_by_id(id).is_some()) else {
        return dynamic_text_response(StatusCode::BAD_REQUEST, "unknown reference surface");
    };
    let watched = match form.get("intent").map(String::as_str) {
        Some("watch") => true,
        Some("unwatch") => false,
        _ => return dynamic_text_response(StatusCode::BAD_REQUEST, "unknown sandbox intent"),
    };

    state.set_watched(service, watched);

    let mut query = EstateQuery::from_params(&params);
    query.selected = Some(service.clone());
    let location = estate_url(&query, query.selected.as_deref());
    if is_wire_request(&headers) {
        estate_html_response(
            render_estate_fragment(&state, &query, &csrf_token).0,
            &csrf_token,
        )
    } else {
        let mut response = Redirect::to(&location).into_response();
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static(CACHE_DYNAMIC),
        );
        response
    }
}

fn generate_csrf_token() -> std::io::Result<String> {
    let mut random = [0_u8; CSRF_TOKEN_BYTES];
    File::open("/dev/urandom")?.read_exact(&mut random)?;
    let mut token = String::with_capacity(random.len() * 2);
    for byte in random {
        write!(&mut token, "{byte:02x}").expect("writing to a String cannot fail");
    }
    Ok(token)
}

fn client_csrf_token(headers: &HeaderMap) -> std::io::Result<String> {
    if let Some(token) = csrf_cookie(headers).filter(|token| valid_csrf_token(token)) {
        return Ok(token.to_string());
    }
    generate_csrf_token()
}

fn csrf_cookie(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|cookie| {
                let (name, value) = cookie.trim().split_once('=')?;
                (name == CSRF_COOKIE).then_some(value)
            })
        })
}

fn valid_csrf_token(token: &str) -> bool {
    token.len() == CSRF_TOKEN_HEX_LEN && token.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn surface_by_id(id: &str) -> Option<&'static Surface> {
    SURFACES.iter().find(|surface| surface.id == id)
}

fn visible_surfaces(query: &EstateQuery) -> Vec<&'static Surface> {
    let needle = query.q.to_lowercase();
    SURFACES
        .iter()
        .filter(|surface| {
            (query.exposure == "all" || surface.exposure.key() == query.exposure)
                && (needle.is_empty()
                    || surface.name.to_lowercase().contains(&needle)
                    || surface.endpoint.to_lowercase().contains(&needle)
                    || surface.role.to_lowercase().contains(&needle)
                    || surface.exposure.label().to_lowercase().contains(&needle))
        })
        .collect()
}

fn selected_surface<'a>(
    query: &EstateQuery,
    visible: &'a [&'static Surface],
) -> Option<&'a Surface> {
    query
        .selected
        .as_deref()
        .and_then(|selected| {
            visible
                .iter()
                .copied()
                .find(|surface| surface.id == selected)
        })
        .or_else(|| visible.first().copied())
}

fn estate_url(query: &EstateQuery, selected: Option<&str>) -> String {
    let mut parts = Vec::new();
    if !query.q.is_empty() {
        parts.push(format!("q={}", url_encode(&query.q)));
    }
    if query.exposure != "all" {
        parts.push(format!("exposure={}", url_encode(&query.exposure)));
    }
    if let Some(selected) = selected {
        parts.push(format!("service={}", url_encode(selected)));
    }
    if parts.is_empty() {
        "/labs/estate".to_string()
    } else {
        format!("/labs/estate?{}", parts.join("&"))
    }
}

fn url_encode(value: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(byte));
        } else {
            encoded.push('%');
            encoded.push(char::from(HEX[(byte >> 4) as usize]));
            encoded.push(char::from(HEX[(byte & 0x0f) as usize]));
        }
    }
    encoded
}

fn render_estate_page(state: &AppState, query: &EstateQuery, csrf_token: &str) -> String {
    let nav = [
        NavItem {
            href: "/",
            label: "Field manual",
            icon: ICON_MANUAL,
            active: false,
        },
        NavItem {
            href: "/labs/estate",
            label: "Estate Atlas",
            icon: ICON_ATLAS,
            active: true,
        },
    ];
    let chrome = PageChrome {
        title: "Estate Atlas · Odyssey Dynamic Lab",
        brand: Brand {
            tile_svg: BRAND_TILE,
            accent: "#b6422c",
            name: "Odyssey",
            sub: "dynamic field lab",
        },
        nav: &nav,
        user: UserBox {
            email: None,
            logout_url: "/_gw/auth/logout",
        },
        footer: raw(
            "<span>Estate Atlas · reference snapshot, not live telemetry</span><a href=\"/\">Field manual</a>",
        ),
    };
    let opts = ShellOpts {
        extra_css: ESTATE_CSS,
        body_class: "page-estate-atlas",
        ..Default::default()
    };
    wire_page_shell(
        chrome,
        render_estate_fragment(state, query, csrf_token),
        opts,
        WireShellOpts::new("estate-main").with_motion(),
    )
}

fn render_estate_fragment(state: &AppState, query: &EstateQuery, csrf_token: &str) -> Html {
    let watched = state.watched();
    let visible = visible_surfaces(query);
    let selected = selected_surface(query, &visible);
    let selected_id = selected.map(|surface| surface.id);
    let stats = Html::concat([
        stat_tile("Deployables", "40", None, Some("repository inventory")),
        stat_tile("Routes", "99", None, Some("documented routes")),
        stat_tile("Public hosts", "56", None, Some("externally addressed")),
        stat_tile("WG-only routes", "27", None, Some("sso + infra-admins")),
    ]);

    let mut out = String::new();
    write!(
        &mut out,
        concat!(
            "<section id=\"estate-atlas\" class=\"estate-atlas\" aria-labelledby=\"estate-title\" ",
            "data-spark=\"view:map\" data-spark-persist=\"view=estate-atlas-view\">",
            "<header class=\"estate-hero\">",
            "<div class=\"estate-kicker\">Steadholme / DYNAMIC LAB / ESTATE 01</div>",
            "<h1 id=\"estate-title\" class=\"estate-title\">Estate<br>Atlas</h1>",
            "<p class=\"estate-deck\">A server-rendered survey of representative public, mixed, WireGuard-only, and compose-only surfaces.</p>",
            "<div class=\"estate-notice\" role=\"status\"><strong>Reference snapshot, not a live control plane.</strong> ",
            "Counts and boundaries reflect the verified 2026-07-10 repository inventory. Watch state below is a per-process sandbox and resets on restart.</div>",
            "</header>",
            "<div class=\"estate-stats\" aria-label=\"Estate snapshot totals\">{stats}</div>",
            "{filters}",
            "<div class=\"estate-viewbar\" aria-label=\"Local presentation controls\">",
            "<span class=\"estate-viewbar__label\" data-spark-cloak>Local view · no request</span>",
            "<button class=\"btn btn-ghost btn-sm estate-viewbtn is-active\" type=\"button\" aria-pressed=\"true\" data-spark-cloak ",
            "data-spark-click=\"set:view=map\" data-spark-class=\"is-active:view=map\" data-spark-attr=\"aria-pressed:view=map\">Atlas</button>",
            "<button class=\"btn btn-ghost btn-sm estate-viewbtn\" type=\"button\" aria-pressed=\"false\" data-spark-cloak ",
            "data-spark-click=\"set:view=ledger\" data-spark-class=\"is-active:view=ledger\" data-spark-attr=\"aria-pressed:view=ledger\">Ledger</button>",
            "<noscript><span class=\"estate-viewbar__label\">Atlas view · enable JavaScript for the ledger toggle</span></noscript>",
            "<span class=\"estate-result\" aria-live=\"polite\">{count} / {total} representative surfaces · {watched_count} watched</span>",
            "</div>",
            "<div class=\"estate-layout\"><div>",
            "<div data-spark-show=\"view=map\">{map}</div>",
            "<div data-spark-show=\"view=ledger\" hidden>{ledger}</div>",
            "</div>{detail}</div>",
            "</section>"
        ),
        stats = stats,
        filters = render_filters(query),
        count = visible.len(),
        total = SURFACES.len(),
        watched_count = watched.len(),
        map = render_surface_map(query, &visible, selected_id, &watched),
        ledger = render_surface_ledger(query, &visible, selected_id, &watched),
        detail = render_surface_detail(state, query, selected, csrf_token),
    )
    .expect("writing to a String cannot fail");
    raw(out)
}

fn render_filters(query: &EstateQuery) -> String {
    let mut options = String::new();
    for (value, label) in [
        ("all", "All boundaries"),
        ("public", "Public"),
        ("mixed", "Mixed path boundary"),
        ("wireguard", "WireGuard only"),
        ("compose", "Compose only"),
    ] {
        let selected = if query.exposure == value {
            " selected"
        } else {
            ""
        };
        write!(
            &mut options,
            "<option value=\"{}\"{}>{}</option>",
            esc(value),
            selected,
            esc(label)
        )
        .expect("writing to a String cannot fail");
    }

    let reset = link_button_with_wire(
        "/labs/estate",
        "Reset",
        Variant::Ghost,
        BtnOpts::default(),
        WireOpts::new("#estate-atlas")
            .select("#estate-atlas")
            .push_history(),
    );
    let body = raw(format!(
        concat!(
            "<div class=\"estate-toolbar\">",
            "<div class=\"field\"><label for=\"estate-q\">Find a surface</label>",
            "<input id=\"estate-q\" class=\"input\" type=\"search\" name=\"q\" value=\"{}\" placeholder=\"Name, route, or role\"></div>",
            "<div class=\"field\"><label for=\"estate-exposure\">Boundary</label>",
            "<select id=\"estate-exposure\" class=\"select\" name=\"exposure\">{}</select></div>",
            "<div class=\"estate-toolbar__actions\"><button class=\"btn btn-primary\" type=\"submit\">Survey</button></div>",
            "<div class=\"estate-toolbar__actions\">{}</div>",
            "</div>"
        ),
        esc(&query.q),
        options,
        reset,
    ));
    form_with_wire(
        "get",
        "/labs/estate",
        Csrf(""),
        body,
        WireOpts::new("#estate-atlas")
            .select("#estate-atlas")
            .busy_label("Surveying…")
            .push_history(),
    )
    .0
}

fn render_surface_map(
    query: &EstateQuery,
    visible: &[&Surface],
    selected: Option<&str>,
    watched: &BTreeSet<String>,
) -> String {
    if visible.is_empty() {
        return render_empty();
    }
    let mut out = String::from("<div class=\"estate-map\" data-motion-list>");
    for surface in visible {
        let (selected_class, current) = if selected == Some(surface.id) {
            (" is-selected", " aria-current=\"true\"")
        } else {
            ("", "")
        };
        let watch = if watched.contains(surface.id) {
            "<span class=\"estate-watch\">Watching</span>"
        } else {
            ""
        };
        let detail_link = link_with_wire(
            &estate_url(query, Some(surface.id)),
            surface.name,
            WireOpts::new("#estate-atlas")
                .select("#estate-atlas")
                .push_history(),
        );
        write!(
            &mut out,
            concat!(
                "<article class=\"estate-node{}\" data-exposure=\"{}\"{} data-motion-enter>",
                "<div class=\"estate-node__coord\">{} boundary</div>",
                "<h2>{}</h2>",
                "<div class=\"estate-node__endpoint\">{}</div>",
                "<div class=\"estate-node__foot\"><span class=\"estate-exposure estate-exposure--{}\">{}</span>{}</div>",
                "</article>"
            ),
            selected_class,
            esc(surface.exposure.key()),
            current,
            esc(surface.exposure.key()),
            detail_link,
            esc(surface.endpoint),
            esc(surface.exposure.key()),
            esc(surface.exposure.label()),
            watch,
        )
        .expect("writing to a String cannot fail");
    }
    out.push_str("</div>");
    out
}

fn render_surface_ledger(
    query: &EstateQuery,
    visible: &[&Surface],
    selected: Option<&str>,
    watched: &BTreeSet<String>,
) -> String {
    if visible.is_empty() {
        return render_empty();
    }
    let mut out = String::from(
        "<div class=\"table-wrap estate-ledger\" role=\"region\" aria-label=\"Surface ledger\" tabindex=\"0\"><table><thead><tr><th>Surface</th><th>Boundary</th><th>Reference endpoint</th><th>Sandbox</th></tr></thead><tbody data-motion-list>",
    );
    for surface in visible {
        let (selected_class, current) = if selected == Some(surface.id) {
            (" class=\"is-selected\"", " aria-current=\"true\"")
        } else {
            ("", "")
        };
        let watch = if watched.contains(surface.id) {
            "Watching"
        } else {
            "—"
        };
        let detail_link = link_with_wire(
            &estate_url(query, Some(surface.id)),
            surface.name,
            WireOpts::new("#estate-atlas")
                .select("#estate-atlas")
                .push_history(),
        );
        write!(
            &mut out,
            concat!(
                "<tr{}{}><td>{}</td>",
                "<td><span class=\"estate-exposure estate-exposure--{}\">{}</span></td><td>{}</td><td>{}</td></tr>"
            ),
            selected_class,
            current,
            detail_link,
            esc(surface.exposure.key()),
            esc(surface.exposure.label()),
            esc(surface.endpoint),
            watch,
        )
        .expect("writing to a String cannot fail");
    }
    out.push_str("</tbody></table></div>");
    out
}

fn render_surface_detail(
    state: &AppState,
    query: &EstateQuery,
    selected: Option<&Surface>,
    csrf_token: &str,
) -> String {
    let Some(surface) = selected else {
        return "<aside id=\"estate-detail\" class=\"estate-detail\"><div class=\"estate-empty\"><h2>No matching surface</h2><p>Adjust the query or reset the survey.</p></div></aside>".to_string();
    };
    let watched = state.is_watched(surface.id);
    let intent = if watched { "unwatch" } else { "watch" };
    let action = if watched {
        "Remove watch"
    } else {
        "Watch reference"
    };
    let state_copy = if watched {
        "Watching in this process"
    } else {
        "Not watched"
    };
    let success = if watched {
        "Reference removed from sandbox watchlist"
    } else {
        "Reference added to sandbox watchlist"
    };

    let form_body = raw(format!(
        concat!(
            "<input type=\"hidden\" name=\"service\" value=\"{}\">",
            "<input type=\"hidden\" name=\"intent\" value=\"{}\">",
            "<button class=\"btn btn-primary\" type=\"submit\">{}</button>",
            "<span class=\"estate-result\" role=\"status\">per-process sandbox</span>"
        ),
        esc(surface.id),
        esc(intent),
        esc(action),
    ));
    let watch_form = form_with_wire(
        "post",
        &estate_url(query, Some(surface.id)),
        Csrf(csrf_token),
        form_body,
        WireOpts::new("#estate-atlas")
            .select("#estate-atlas")
            .busy_label("Updating…")
            .success_message(success)
            .error_message("Sandbox update rejected"),
    );

    format!(
        concat!(
            "<aside id=\"estate-detail\" class=\"estate-detail\" aria-labelledby=\"estate-detail-title\" data-motion-enter>",
            "<div class=\"estate-detail__head\"><div class=\"estate-kicker\">Selected reference</div>",
            "<h2 id=\"estate-detail-title\">{name}</h2></div>",
            "<div class=\"estate-detail__body\"><span class=\"estate-exposure estate-exposure--{key}\">{exposure}</span>",
            "<dl><dt>Endpoint</dt><dd>{endpoint}</dd><dt>Role</dt><dd>{role}</dd><dt>Boundary note</dt><dd>{note}</dd><dt>Snapshot</dt><dd>Repository reference · 2026-07-10</dd></dl>",
            "<div class=\"estate-sandbox\"><strong>{state_copy}</strong><br>",
            "This button changes only an in-memory demo set. It never calls, deploys, restarts, or reconfigures infrastructure.",
            "<div>{watch_form}</div></div>",
            "</div></aside>"
        ),
        name = esc(surface.name),
        key = esc(surface.exposure.key()),
        exposure = esc(surface.exposure.label()),
        endpoint = esc(surface.endpoint),
        role = esc(surface.role),
        note = esc(surface.note),
        state_copy = esc(state_copy),
        watch_form = watch_form,
    )
}

fn render_empty() -> String {
    "<div class=\"estate-empty\"><h2>No matching surfaces</h2><p>Try another name or boundary.</p></div>".to_string()
}

fn is_wire_request(headers: &HeaderMap) -> bool {
    headers.get("x-wire").and_then(|value| value.to_str().ok()) == Some("1")
}

fn same_origin_request(headers: &HeaderMap) -> bool {
    let Some(host) = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
    else {
        return false;
    };
    let Some(origin) = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
    else {
        return false;
    };
    let Ok(origin) = origin.parse::<Uri>() else {
        return false;
    };
    let Some(scheme) = origin.scheme_str() else {
        return false;
    };
    if !matches!(scheme, "http" | "https") || origin.path() != "/" || origin.query().is_some() {
        return false;
    }
    let Some(authority) = origin.authority().map(|value| value.as_str()) else {
        return false;
    };
    let Some(origin_authority) = normalize_authority(authority, scheme) else {
        return false;
    };
    let Some(request_host) = normalize_authority(host, scheme) else {
        return false;
    };
    if origin_authority != request_host {
        return false;
    }
    if let Some(forwarded_proto) = headers
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
    {
        if !forwarded_proto.eq_ignore_ascii_case(scheme) {
            return false;
        }
    }
    headers
        .get("sec-fetch-site")
        .and_then(|value| value.to_str().ok())
        != Some("cross-site")
}

fn normalize_authority(authority: &str, scheme: &str) -> Option<String> {
    let authority = authority.trim().to_ascii_lowercase();
    if authority.is_empty()
        || authority
            .chars()
            .any(|ch| matches!(ch, ',' | '@' | '/' | '\\'))
    {
        return None;
    }
    let default_port = if scheme.eq_ignore_ascii_case("https") {
        ":443"
    } else {
        ":80"
    };
    Some(
        authority
            .strip_suffix(default_port)
            .unwrap_or(&authority)
            .to_string(),
    )
}

fn valid_csrf(headers: &HeaderMap, form: &HashMap<String, String>) -> Option<String> {
    let cookie = csrf_cookie(headers).filter(|token| valid_csrf_token(token))?;
    let submitted = form
        .get("csrf_token")
        .map(String::as_str)
        .filter(|token| valid_csrf_token(token))?;
    constant_time_eq(cookie.as_bytes(), submitted.as_bytes()).then(|| cookie.to_string())
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0_u8, |diff, (left, right)| diff | (left ^ right))
        == 0
}

fn estate_html_response(body: String, csrf_token: &str) -> Response {
    let mut response = (StatusCode::OK, body).into_response();
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(CONTENT_TYPE_HTML),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(CACHE_DYNAMIC),
    );
    let cookie = format!("{CSRF_COOKIE}={csrf_token}; Path=/; Secure; SameSite=Strict");
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).expect("hex CSRF token is a valid cookie value"),
    );
    response
}

fn dynamic_text_response(status: StatusCode, message: &'static str) -> Response {
    let mut response = (status, message).into_response();
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(CACHE_DYNAMIC),
    );
    response
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
                dist_asset(file, CACHE_DIST, DistRelease::Current)
            } else if let Some(file) = path.strip_prefix("/1.3/") {
                dist_asset(file, CACHE_VERSIONED, DistRelease::Canary13)
            } else if let Some(file) = path.strip_prefix("/1.2/") {
                dist_asset(file, CACHE_VERSIONED, DistRelease::Canary12)
            } else if let Some(file) = path.strip_prefix("/1.1/") {
                dist_asset(file, CACHE_VERSIONED, DistRelease::Snapshot11)
            } else if let Some(file) = path.strip_prefix("/1.0/") {
                legacy_version_redirect(file)
            } else {
                not_found()
            }
        }
    }
}

fn site_html(body: &'static str) -> Response {
    static_response(StatusCode::OK, CONTENT_TYPE_HTML, Some(CACHE_DOCS), body)
}

fn dist_asset(file: &str, cache_control: &'static str, release: DistRelease) -> Response {
    let (content_type, body) = match (release, file) {
        (DistRelease::Current, "odyssey.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_CURRENT_CSS),
        (DistRelease::Current, "odyssey.js") => (CONTENT_TYPE_JS, DIST_ODYSSEY_CURRENT_JS),
        (DistRelease::Current, "odyssey-font.css") => {
            (CONTENT_TYPE_CSS, DIST_ODYSSEY_CURRENT_FONT_CSS)
        }
        (DistRelease::Snapshot11, "odyssey.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_11_CSS),
        (DistRelease::Snapshot11, "odyssey.js") => (CONTENT_TYPE_JS, DIST_ODYSSEY_11_JS),
        (DistRelease::Snapshot11, "odyssey-font.css") => {
            (CONTENT_TYPE_CSS, DIST_ODYSSEY_11_FONT_CSS)
        }
        (DistRelease::Canary12, "odyssey.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_12_CSS),
        (DistRelease::Canary12, "odyssey.js") => (CONTENT_TYPE_JS, DIST_ODYSSEY_12_JS),
        (DistRelease::Canary12, "odyssey-font.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_12_FONT_CSS),
        (DistRelease::Canary13, "odyssey.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_13_CSS),
        (DistRelease::Canary13, "odyssey.js") => (CONTENT_TYPE_JS, DIST_ODYSSEY_13_JS),
        (DistRelease::Canary13, "odyssey-font.css") => (CONTENT_TYPE_CSS, DIST_ODYSSEY_13_FONT_CSS),
        _ => return not_found(),
    };
    static_response(StatusCode::OK, content_type, Some(cache_control), body)
}

fn legacy_version_redirect(file: &str) -> Response {
    if !matches!(file, "odyssey.css" | "odyssey.js" | "odyssey-font.css") {
        return not_found();
    }
    let location = format!("/1.1/{file}");
    let mut response = Redirect::permanent(&location).into_response();
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_DIST));
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    response
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
    use axum::{
        body::Body,
        http::{Method, Request},
    };
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    const TEST_CSRF: &str = "1111111111111111111111111111111111111111111111111111111111111111";
    const OTHER_CSRF: &str = "2222222222222222222222222222222222222222222222222222222222222222";
    const TEST_HOST: &str = "odyssey.test";
    const TEST_ORIGIN: &str = "https://odyssey.test";

    #[test]
    fn serves_doc_home_as_html() {
        let response = route_static("/");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_HTML);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DOCS);
    }

    #[tokio::test]
    async fn serves_current_dist_assets_with_short_cache() {
        let response = route_static("/dist/odyssey.js");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CONTENT_TYPE), CONTENT_TYPE_JS);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DIST);
        assert_eq!(header(&response, header::ACCESS_CONTROL_ALLOW_ORIGIN), "*");
        let body = response.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(body.as_ref(), DIST_ODYSSEY_CURRENT_JS.as_bytes());
        assert_eq!(body.as_ref(), DIST_ODYSSEY_13_JS.as_bytes());
    }

    #[tokio::test]
    async fn serves_both_versioned_generations_with_immutable_cache() {
        let assets = [
            (
                "odyssey.css",
                CONTENT_TYPE_CSS,
                DIST_ODYSSEY_11_CSS,
                DIST_ODYSSEY_12_CSS,
                true,
            ),
            (
                "odyssey.js",
                CONTENT_TYPE_JS,
                DIST_ODYSSEY_11_JS,
                DIST_ODYSSEY_12_JS,
                true,
            ),
            (
                "odyssey-font.css",
                CONTENT_TYPE_CSS,
                DIST_ODYSSEY_11_FONT_CSS,
                DIST_ODYSSEY_12_FONT_CSS,
                false,
            ),
        ];

        for (file, content_type, snapshot, canary, differs) in assets {
            let response_11 = route_static(&format!("/1.1/{file}"));
            assert_eq!(response_11.status(), StatusCode::OK);
            assert_eq!(header(&response_11, header::CONTENT_TYPE), content_type);
            assert_eq!(header(&response_11, header::CACHE_CONTROL), CACHE_VERSIONED);
            assert_eq!(
                header(&response_11, header::ACCESS_CONTROL_ALLOW_ORIGIN),
                "*"
            );
            let body_11 = response_11.into_body().collect().await.unwrap().to_bytes();
            assert_eq!(body_11.as_ref(), snapshot.as_bytes());

            let response_12 = route_static(&format!("/1.2/{file}"));
            assert_eq!(response_12.status(), StatusCode::OK);
            assert_eq!(header(&response_12, header::CONTENT_TYPE), content_type);
            assert_eq!(header(&response_12, header::CACHE_CONTROL), CACHE_VERSIONED);
            assert_eq!(
                header(&response_12, header::ACCESS_CONTROL_ALLOW_ORIGIN),
                "*"
            );
            let body_12 = response_12.into_body().collect().await.unwrap().to_bytes();
            assert_eq!(body_12.as_ref(), canary.as_bytes());
            if differs {
                assert_ne!(body_12, body_11);
            } else {
                assert_eq!(body_12, body_11);
            }
        }

        let legacy = route_static("/1.0/odyssey.css");
        assert_eq!(legacy.status(), StatusCode::PERMANENT_REDIRECT);
        assert_eq!(header(&legacy, header::LOCATION), "/1.1/odyssey.css");
        assert_eq!(header(&legacy, header::CACHE_CONTROL), CACHE_DIST);
    }

    #[tokio::test]
    async fn serves_13_canary_with_immutable_cache() {
        let assets = [
            ("odyssey.css", CONTENT_TYPE_CSS, DIST_ODYSSEY_13_CSS),
            ("odyssey.js", CONTENT_TYPE_JS, DIST_ODYSSEY_13_JS),
            (
                "odyssey-font.css",
                CONTENT_TYPE_CSS,
                DIST_ODYSSEY_13_FONT_CSS,
            ),
        ];

        for (file, content_type, expected) in assets {
            let response = route_static(&format!("/1.3/{file}"));
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(header(&response, header::CONTENT_TYPE), content_type);
            assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_VERSIONED);
            assert_eq!(header(&response, header::ACCESS_CONTROL_ALLOW_ORIGIN), "*");
            let body = response.into_body().collect().await.unwrap().to_bytes();
            assert_eq!(body.as_ref(), expected.as_bytes());
        }
    }

    #[test]
    fn release_13_snapshot_matches_current_dist_byte_for_byte() {
        assert_eq!(DIST_ODYSSEY_CURRENT_CSS, DIST_ODYSSEY_13_CSS);
        assert_eq!(DIST_ODYSSEY_CURRENT_JS, DIST_ODYSSEY_13_JS);
        assert_eq!(DIST_ODYSSEY_CURRENT_FONT_CSS, DIST_ODYSSEY_13_FONT_CSS);
    }

    #[test]
    fn frozen_versioned_assets_keep_their_byte_identity() {
        fn fnv1a64(bytes: &[u8]) -> u64 {
            bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
                (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
            })
        }

        assert_eq!(DIST_ODYSSEY_11_CSS.len(), 151_808);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_11_CSS.as_bytes()),
            0x5cf5_b38b_ee38_ab4d
        );
        assert_eq!(DIST_ODYSSEY_11_JS.len(), 102_479);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_11_JS.as_bytes()),
            0x71eb_01c1_259b_ffe9
        );
        assert_eq!(DIST_ODYSSEY_11_FONT_CSS.len(), 65_466);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_11_FONT_CSS.as_bytes()),
            0x4665_56f0_c0a0_5bf6
        );

        assert_eq!(DIST_ODYSSEY_12_CSS.len(), 161_350);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_12_CSS.as_bytes()),
            0x8dff_3da1_7133_b701
        );
        assert_eq!(DIST_ODYSSEY_12_JS.len(), 105_404);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_12_JS.as_bytes()),
            0xc462_8a72_84f5_5577
        );
        assert_eq!(DIST_ODYSSEY_12_FONT_CSS.len(), 65_466);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_12_FONT_CSS.as_bytes()),
            0x4665_56f0_c0a0_5bf6
        );
    }

    #[test]
    fn release_13_assets_keep_their_byte_identity() {
        fn fnv1a64(bytes: &[u8]) -> u64 {
            bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
                (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
            })
        }

        assert_eq!(DIST_ODYSSEY_13_CSS.len(), 168_506);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_13_CSS.as_bytes()),
            0xc9a5_0977_5ee7_08f4
        );
        assert_eq!(DIST_ODYSSEY_13_JS.len(), 105_406);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_13_JS.as_bytes()),
            0x2ea5_e2cd_6e9f_2a6a
        );
        assert_eq!(DIST_ODYSSEY_13_FONT_CSS.len(), 65_466);
        assert_eq!(
            fnv1a64(DIST_ODYSSEY_13_FONT_CSS.as_bytes()),
            0x4665_56f0_c0a0_5bf6
        );
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

    #[test]
    fn estate_page_dogfoods_the_full_odyssey_runtime() {
        let state = AppState::for_test();
        let html = render_estate_page(&state, &EstateQuery::default(), TEST_CSRF);

        assert!(html.contains("Estate<br>Atlas"));
        assert!(html.contains("Reference snapshot, not a live control plane"));
        assert!(html.contains("data-wire-nav=\"#estate-main\""));
        assert!(html.contains("id=\"estate-main\""));
        assert!(html.contains("odyssey-wire v1"));
        assert!(html.contains("odyssey-spark v1"));
        assert!(html.contains("odyssey-motion v1"));
        let filters = render_filters(&EstateQuery::default());
        assert!(filters.contains("data-wire=\"submit\""));
        assert!(filters.contains("data-wire-push"));
        assert!(filters.contains("data-wire-busy=\"Surveying…\""));
        assert!(!filters.contains("csrf_token"));
        assert!(html.contains("status.w33d.xyz"));
        assert!(html.contains("atlas.w33d.xyz"));
        assert!(html.contains("vault.w33d.xyz"));
        assert!(!html.contains("beacon.w33d.xyz"));
        assert!(html.contains("WG-only routes"));
        assert!(html.contains("Mixed path boundary"));
        assert!(!html.contains("Mixed / app auth"));
        assert!(html.contains(
            "class=\"estate-node is-selected\" data-exposure=\"public\" aria-current=\"true\""
        ));
        assert!(html.contains("<tr class=\"is-selected\" aria-current=\"true\">"));
        assert!(html.contains(
            "class=\"table-wrap estate-ledger\" role=\"region\" aria-label=\"Surface ledger\" tabindex=\"0\""
        ));
        assert!(html.contains("data-spark-cloak"));
        assert!(html.contains("<noscript>"));
        assert!(html.contains(".estate-ledger table{min-width:720px"));
    }

    #[test]
    fn estate_query_filters_and_rejects_unknown_selection() {
        let query = EstateQuery::from_params(&HashMap::from([
            ("q".to_string(), "vault".to_string()),
            ("exposure".to_string(), "wireguard".to_string()),
            ("service".to_string(), "missing".to_string()),
        ]));
        let visible = visible_surfaces(&query);

        assert_eq!(visible.len(), 1);
        assert_eq!(visible[0].id, "sanctum");
        assert_eq!(query.selected, None);
        assert_eq!(
            estate_url(&query, Some("sanctum")),
            "/labs/estate?q=vault&exposure=wireguard&service=sanctum"
        );
    }

    #[tokio::test]
    async fn estate_get_reuses_a_valid_client_cookie_in_the_form() {
        let response = build_router(AppState::for_test())
            .oneshot(
                Request::builder()
                    .uri("/labs/estate?exposure=public")
                    .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DYNAMIC);
        assert!(header(&response, header::SET_COOKIE).contains(&format!(
            "{CSRF_COOKIE}={TEST_CSRF}; Path=/; Secure; SameSite=Strict"
        )));
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.contains("2 / 7 representative surfaces"));
        assert!(html.contains(&format!("name=\"csrf_token\" value=\"{TEST_CSRF}\"")));
    }

    #[tokio::test]
    async fn estate_get_without_cookie_mints_a_per_client_token() {
        let response = build_router(AppState::for_test())
            .oneshot(
                Request::builder()
                    .uri("/labs/estate")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let csrf = response_csrf(&response);
        assert!(valid_csrf_token(&csrf));
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.contains(&format!("name=\"csrf_token\" value=\"{csrf}\"")));
    }

    #[tokio::test]
    async fn estate_wire_get_returns_only_the_matching_fragment() {
        let response = build_router(AppState::for_test())
            .oneshot(
                Request::builder()
                    .uri("/labs/estate?exposure=wireguard")
                    .header("x-wire", "1")
                    .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DYNAMIC);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.starts_with("<section id=\"estate-atlas\""));
        assert!(html.contains("2 / 7 representative surfaces"));
        assert!(!html.contains("<!doctype html>"));
        assert!(!html.contains("odyssey-wire v1"));
    }

    #[tokio::test]
    async fn estate_wire_post_updates_only_the_sandbox_and_returns_a_fragment() {
        let state = AppState::for_test();
        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/labs/estate?service=beacon")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .header(header::HOST, TEST_HOST)
                    .header(header::ORIGIN, TEST_ORIGIN)
                    .header("x-forwarded-proto", "https")
                    .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"))
                    .header("x-wire", "1")
                    .body(Body::from(format!(
                        "csrf_token={TEST_CSRF}&service=beacon&intent=watch"
                    )))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert!(state.is_watched("beacon"));
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.starts_with("<section id=\"estate-atlas\""));
        assert!(html.contains("Watching in this process"));
        assert!(!html.contains("<!doctype html>"));
    }

    #[tokio::test]
    async fn estate_wire_post_can_unwatch_and_rejects_unknown_commands() {
        let state = AppState::for_test();
        state.set_watched("beacon", true);
        let app = build_router(state.clone());
        let response = app
            .clone()
            .oneshot(sandbox_post_request(
                format!("csrf_token={TEST_CSRF}&service=beacon&intent=unwatch"),
                true,
            ))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert!(!state.is_watched("beacon"));
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let html = String::from_utf8(body.to_vec()).unwrap();
        assert!(html.contains("Not watched"));

        for body in [
            format!("csrf_token={TEST_CSRF}&service=unknown&intent=watch"),
            format!("csrf_token={TEST_CSRF}&service=beacon&intent=restart"),
        ] {
            let response = app
                .clone()
                .oneshot(sandbox_post_request(body, true))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }

    #[tokio::test]
    async fn estate_post_requires_both_csrf_copies() {
        let state = AppState::for_test();
        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/labs/estate")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .header(header::HOST, TEST_HOST)
                    .header(header::ORIGIN, TEST_ORIGIN)
                    .header("x-forwarded-proto", "https")
                    .body(Body::from(format!(
                        "csrf_token={TEST_CSRF}&service=beacon&intent=watch"
                    )))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(!state.is_watched("beacon"));
    }

    #[tokio::test]
    async fn estate_post_rejects_cross_origin_even_with_matching_tokens() {
        let state = AppState::for_test();
        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/labs/estate")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .header(header::HOST, TEST_HOST)
                    .header(header::ORIGIN, "https://attacker.test")
                    .header("x-forwarded-proto", "https")
                    .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"))
                    .body(Body::from(format!(
                        "csrf_token={TEST_CSRF}&service=beacon&intent=watch"
                    )))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(!state.is_watched("beacon"));
    }

    #[test]
    fn csrf_validation_is_per_client_and_origin_normalizes_default_ports() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, HeaderValue::from_static("odyssey.test:443"));
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://odyssey.test"),
        );
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("{CSRF_COOKIE}={TEST_CSRF}")).unwrap(),
        );
        let matching = HashMap::from([("csrf_token".to_string(), TEST_CSRF.to_string())]);
        let other = HashMap::from([("csrf_token".to_string(), OTHER_CSRF.to_string())]);

        assert!(same_origin_request(&headers));
        assert_eq!(valid_csrf(&headers, &matching).as_deref(), Some(TEST_CSRF));
        assert_eq!(valid_csrf(&headers, &other), None);
    }

    #[tokio::test]
    async fn estate_no_js_post_updates_then_redirects_to_a_get() {
        let state = AppState::for_test();
        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/labs/estate?exposure=public")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .header(header::HOST, TEST_HOST)
                    .header(header::ORIGIN, TEST_ORIGIN)
                    .header("x-forwarded-proto", "https")
                    .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"))
                    .body(Body::from(format!(
                        "csrf_token={TEST_CSRF}&service=odyssey&intent=watch"
                    )))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            header(&response, header::LOCATION),
            "/labs/estate?exposure=public&service=odyssey"
        );
        assert_eq!(header(&response, header::CACHE_CONTROL), CACHE_DYNAMIC);
        assert!(state.is_watched("odyssey"));
    }

    fn header(response: &Response, name: header::HeaderName) -> &str {
        response.headers().get(name).unwrap().to_str().unwrap()
    }

    fn response_csrf(response: &Response) -> String {
        header(response, header::SET_COOKIE)
            .strip_prefix(&format!("{CSRF_COOKIE}="))
            .and_then(|cookie| cookie.split(';').next())
            .unwrap()
            .to_string()
    }

    fn sandbox_post_request(body: String, wire: bool) -> Request<Body> {
        let mut request = Request::builder()
            .method(Method::POST)
            .uri("/labs/estate")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(header::HOST, TEST_HOST)
            .header(header::ORIGIN, TEST_ORIGIN)
            .header("x-forwarded-proto", "https")
            .header(header::COOKIE, format!("{CSRF_COOKIE}={TEST_CSRF}"));
        if wire {
            request = request.header("x-wire", "1");
        }
        request.body(Body::from(body)).unwrap()
    }
}
