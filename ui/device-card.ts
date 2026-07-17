/**
 * Iframe bridge + renderer for the Meraki device card (MCP Apps, SEP-1865).
 *
 * Runs inside the host's sandboxed iframe. Uses the official MCP Apps client
 * (`App`) to receive the tool result from the host. The card is read-only:
 * Meraki device mutations (reboot, remove) are high-impact and stay behind
 * the confirmation-gated tools — no write round-trip is exposed here.
 *
 * The server attaches a normalized `_card` payload to meraki_devices_get
 * results (see src/card.builder.ts) so this renderer never needs to resolve
 * ids or entity names itself.
 *
 * Rendering uses DOM construction (no innerHTML) — device names, notes, and
 * tags are untrusted dashboard data, so text only ever lands in text nodes.
 *
 * White-label: the card is neutral by default (no vendor identity) and applies
 * an injected `window.__BRAND__` override (set by the MCP server via
 * MCP_BRAND_* env vars, or a gateway per-org) so the same card can render in
 * any operator's brand.
 */
import { App } from "@modelcontextprotocol/ext-apps";

interface Brand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}
declare global {
  interface Window {
    __BRAND__?: Brand;
  }
}

/** Mirror of DeviceCard in src/card.builder.ts — keep in sync. */
interface DeviceCard {
  serial: string;
  name: string;
  model?: string;
  productType?: string;
  network?: string;
  mac?: string;
  lanIp?: string;
  firmware?: string;
  address?: string;
  tags: string[];
  notes?: string;
}

const brand: Brand = window.__BRAND__ ?? {};
const brandName = brand.name ?? "";

// Apply any injected brand overrides onto the CSS custom properties.
function applyBrand(): void {
  const root = document.documentElement.style;
  if (brand.primaryColor) root.setProperty("--brand-primary", brand.primaryColor);
  if (brand.accentColor) root.setProperty("--brand-accent", brand.accentColor);
  if (brand.bg) root.setProperty("--brand-bg", brand.bg);
  if (brand.text) root.setProperty("--brand-text", brand.text);
}

const app = new App({ name: "Meraki Device Card", version: "1.0.0" });

/** Create an element with a class and (safe, text-node) children. */
function el(
  tag: string,
  className = "",
  ...children: Array<Node | string | null>
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child == null) continue;
    node.append(child); // strings become text nodes — never parsed as HTML
  }
  return node;
}

function field(label: string, value: Node | string | undefined): HTMLElement | null {
  if (!value) return null;
  return el(
    "div",
    "field",
    el("div", "field__label", label),
    el("div", "field__value", value),
  );
}

function badge(text: string | undefined, cls: string): HTMLElement | null {
  return text ? el("span", `badge ${cls}`, text) : null;
}

function render(d: DeviceCard): void {
  // Brand identity only renders when a brand was injected — the neutral
  // default shows just the serial/vendor context in the header.
  let brandId: HTMLElement | null = null;
  if (brandName || brand.logoUrl) {
    brandId = el("span", "brandid");
    if (brand.logoUrl) {
      const logo = document.createElement("img");
      logo.src = brand.logoUrl;
      logo.alt = brandName;
      logo.style.display = "inline-block";
      brandId.append(logo);
    }
    if (brandName) brandId.append(el("span", "brand", brandName));
  }

  let tagsEl: HTMLElement | undefined;
  if (d.tags.length > 0) {
    tagsEl = el("span", "tags");
    for (const tag of d.tags) tagsEl.append(el("span", "tag", tag));
  }

  const body = el(
    "div",
    "card__body",
    el("div", "brandrow", brandId, el("span", "serialno", `${d.serial} · Meraki`)),
    el("h1", "", d.name),
    el("div", "badges", badge(d.productType, "badge--type"), badge(d.model, "badge--model")),
    el(
      "div",
      "grid",
      field("Network", d.network),
      field("MAC", d.mac),
      field("LAN IP", d.lanIp),
      field("Firmware", d.firmware),
      field("Address", d.address),
      field("Tags", tagsEl),
    ),
    d.notes ? el("div", "notes", el("div", "notes__h", "Notes"), el("div", "note", d.notes)) : null,
  );

  const root = document.getElementById("root")!;
  root.replaceChildren(el("div", "card", el("div", "card__bar"), body));
}

// meraki-mcp returns the device JSON directly and attaches the normalized
// card to meraki_devices_get results as _card.
function extractCard(obj: unknown): DeviceCard | null {
  const card = (obj as { _card?: DeviceCard })?._card;
  return card && typeof card.serial === "string" && typeof card.name === "string"
    ? { ...card, tags: Array.isArray(card.tags) ? card.tags : [] }
    : null;
}

applyBrand();

// Must be set before connect() so the initial tool-result isn't missed.
app.ontoolresult = (result: { content?: Array<{ type: string; text?: string }> }) => {
  const payload = (result.content ?? []).find((c) => c.type === "text");
  if (!payload?.text) return;
  try {
    const card = extractCard(JSON.parse(payload.text));
    if (card) render(card);
  } catch {
    /* ignore malformed payloads */
  }
};

app.connect();
