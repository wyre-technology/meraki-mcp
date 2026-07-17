# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Interactive device card via MCP Apps (SEP-1865).** `meraki_devices_get` results now render as an interactive card in MCP Apps hosts (Claude Desktop/web, and other hosts advertising the `io.modelcontextprotocol/ui` extension), instead of a wall of JSON. The card shows the device name, model, product type, resolved network name, MAC, LAN IP, firmware, address, tags, and notes. The card is read-only — Meraki device mutations stay behind the confirmation-gated tools. Non-App hosts are unaffected: the tool's JSON payload is unchanged apart from a new `_card` field.
  - The renderable tool advertises the UI via `_meta` (`ui/resourceUri`, plus the nested `ui.resourceUri` form) pointing at a new `ui://meraki/device-card.html` resource served as `text/html;profile=mcp-app`. The card HTML is a self-contained vite single-file bundle embedded at build time (`src/generated/device-card-html.ts`, committed), so it serves identically from stdio and Node HTTP transports. The server now declares the `resources` capability and answers `resources/list` / `resources/read` (`src/resources.ts`).
  - The card is neutral by default (system fonts, no vendor identity, no external fetches) and brandable via `window.__BRAND__` injection or `MCP_BRAND_*` env vars (`MCP_BRAND_NAME`, `MCP_BRAND_LOGO_URL`, `MCP_BRAND_PRIMARY_COLOR`, `MCP_BRAND_ACCENT_COLOR`, `MCP_BRAND_BG`, `MCP_BRAND_TEXT`): at serve time the server replaces the card's BRAND_INJECT marker with an inline, `<`-escaped `window.__BRAND__` script, so self-hosters can theme the card without rebuilding. No brand configured = HTML served unchanged.

### Fixed
- `/health` liveness endpoint now returns an unconditional `200` instead of gating on
  credentials. The Azure Container Apps liveness probe hits `GET /health` with no
  credentials, so the previous credential gate returned `503` and crash-looped the
  container. Credential state is still reported in the response body
  (`credentials.configured`); per-request credential handling for `/mcp` is unchanged.

## [1.0.0] - 2026-07-01

### Added
- Initial scaffold of the Cisco Meraki Dashboard MCP server.
- Flattened navigation (`meraki_navigate`, `meraki_status`) — all tools returned upfront; discovery only, no per-session state.
- Domain tools across `organizations`, `networks`, `devices`, `clients`, `wireless`, `switch`, and `appliance`.
- `meraki_raw_request` long-tail escape hatch for any Meraki v1 endpoint.
- Safety module: read-only mode ON by default, high-impact write gating, and destructive-action confirmation (`confirm_destructive_action`) that is never forwarded to the SDK.
- Dual transport: stdio (`src/index.ts`) and stateless Streamable HTTP (`src/http.ts`) with `/mcp` and `/health` endpoints, plus gateway header credential injection.
- Docker image, semantic-release configuration, and release workflow.
