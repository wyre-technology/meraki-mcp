# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-01

### Added
- Initial scaffold of the Cisco Meraki Dashboard MCP server.
- Flattened navigation (`meraki_navigate`, `meraki_status`) — all tools returned upfront; discovery only, no per-session state.
- Domain tools across `organizations`, `networks`, `devices`, `clients`, `wireless`, `switch`, and `appliance`.
- `meraki_raw_request` long-tail escape hatch for any Meraki v1 endpoint.
- Safety module: read-only mode ON by default, high-impact write gating, and destructive-action confirmation (`confirm_destructive_action`) that is never forwarded to the SDK.
- Dual transport: stdio (`src/index.ts`) and stateless Streamable HTTP (`src/http.ts`) with `/mcp` and `/health` endpoints, plus gateway header credential injection.
- Docker image, semantic-release configuration, and release workflow.
