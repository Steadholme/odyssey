# syntax=docker/dockerfile:1
#
# Multi-stage build for Odyssey UI static assets and documentation.
#   - builder: rust:1.96-slim (Debian trixie).
#   - runtime: debian:trixie-slim (matching glibc), non-root, no TLS stack.
#
# The server embeds dist/ + site/ via include_str!, so the runtime image only needs
# the odyssey-server binary. The HEALTHCHECK uses the built-in subcommand, so the
# image needs no curl or HTTP client package.

FROM rust:1.96-slim AS builder
WORKDIR /build

COPY dist ./dist
COPY site ./site
COPY server ./server

RUN cargo build --release --manifest-path server/Cargo.toml \
    && strip server/target/release/odyssey-server

FROM debian:trixie-slim AS runtime

# Non-root runtime user (no shell, no home writes needed).
RUN useradd --system --uid 10001 --user-group --no-create-home odyssey
COPY --from=builder /build/server/target/release/odyssey-server /usr/local/bin/odyssey-server

USER odyssey
# Default in-container bind; overridable at runtime.
ENV BIND_ADDR=0.0.0.0:8300
EXPOSE 8300

# Dependency-free liveness probe -> GET /healthz on the loopback, exit 0/1.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD ["odyssey-server", "healthcheck"]

ENTRYPOINT ["odyssey-server"]
