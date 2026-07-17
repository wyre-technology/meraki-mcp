/**
 * Device-card payload builder for the MCP Apps (SEP-1865) UI surface.
 *
 * meraki_devices_get results get a normalized `_card` object attached
 * (see domains/devices.ts) that the ui:// device card renders from. The card
 * is progressive enhancement: every step here is best-effort, and a null
 * return simply means the host renders no card while the JSON payload is
 * unchanged. The card is read-only — Meraki device mutations stay behind the
 * confirmation-gated tools.
 */

import type { MerakiClient } from '@wyre-technology/node-meraki';

export const DEVICE_CARD_RESOURCE_URI = 'ui://meraki/device-card.html';

/** MCP Apps resource MIME (RESOURCE_MIME_TYPE in @modelcontextprotocol/ext-apps). */
export const MCP_APP_RESOURCE_MIME = 'text/html;profile=mcp-app';

/**
 * Tool `_meta` advertising the card. Carries both the canonical flat key
 * (RESOURCE_URI_META_KEY in ext-apps) and the nested form ext-apps'
 * registerAppTool emits, so any MCP Apps host revision finds it.
 */
export const DEVICE_CARD_META = {
  'ui/resourceUri': DEVICE_CARD_RESOURCE_URI,
  ui: { resourceUri: DEVICE_CARD_RESOURCE_URI },
} as const;

/** Mirror of Brand in ui/device-card.ts — keep in sync. */
export interface CardBrand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}

/** The BRAND_INJECT comment marker baked into the card HTML (see ui/index.html). */
const BRAND_INJECT_RE = /<!--\s*BRAND_INJECT:[\s\S]*?-->/;

/**
 * Serve-time brand injection: replace the BRAND_INJECT marker with an inline
 * `window.__BRAND__` script so self-hosters can theme the card without
 * rebuilding the bundle. An empty brand returns the HTML unchanged (the card
 * renders its neutral defaults). `<` is escaped so brand values can never
 * break out of the script tag.
 */
export function applyBrandInjection(html: string, brand: CardBrand): string {
  if (!brand || Object.values(brand).every(v => !v)) return html;
  const json = JSON.stringify(brand).replace(/</g, '\\u003c');
  return html.replace(BRAND_INJECT_RE, `<script>window.__BRAND__=${json}</script>`);
}

/**
 * Resolve brand overrides from MCP_BRAND_* environment variables. Guarded for
 * runtimes without `process`, where this returns an empty brand and the card
 * serves its neutral defaults.
 */
export function resolveBrandFromEnv(): CardBrand {
  if (typeof process === 'undefined' || !process.env) return {};
  const env = process.env;
  const brand: CardBrand = {};
  if (env.MCP_BRAND_NAME) brand.name = env.MCP_BRAND_NAME;
  if (env.MCP_BRAND_LOGO_URL) brand.logoUrl = env.MCP_BRAND_LOGO_URL;
  if (env.MCP_BRAND_PRIMARY_COLOR) brand.primaryColor = env.MCP_BRAND_PRIMARY_COLOR;
  if (env.MCP_BRAND_ACCENT_COLOR) brand.accentColor = env.MCP_BRAND_ACCENT_COLOR;
  if (env.MCP_BRAND_BG) brand.bg = env.MCP_BRAND_BG;
  if (env.MCP_BRAND_TEXT) brand.text = env.MCP_BRAND_TEXT;
  return brand;
}

/** Mirror of DeviceCard in ui/device-card.ts — keep in sync. */
export interface DeviceCard {
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

const CARD_TAG_LIMIT = 8;
const CARD_NOTES_MAX_LENGTH = 500;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Build the renderable card from a meraki_devices_get payload. The network id
 * is resolved to its display name via the existing networks.get lookup —
 * best-effort, with the raw id as the fallback label.
 */
export async function buildDeviceCard(
  device: Record<string, unknown>,
  client: Pick<MerakiClient, 'networks'>
): Promise<DeviceCard | null> {
  const serial = str(device?.serial);
  if (!serial) return null;

  const card: DeviceCard = {
    serial,
    // Unnamed devices are common in Meraki; the serial is the canonical label.
    name: str(device.name) ?? serial,
    tags: [],
  };

  const model = str(device.model);
  const productType = str(device.productType);
  const mac = str(device.mac);
  const lanIp = str(device.lanIp);
  const firmware = str(device.firmware);
  const address = str(device.address);
  if (model) card.model = model;
  if (productType) card.productType = productType;
  if (mac) card.mac = mac;
  if (lanIp) card.lanIp = lanIp;
  if (firmware) card.firmware = firmware;
  if (address) card.address = address;

  if (Array.isArray(device.tags)) {
    card.tags = device.tags
      .filter((t): t is string => typeof t === 'string' && !!t)
      .slice(0, CARD_TAG_LIMIT);
  }

  const notes = str(device.notes);
  if (notes) card.notes = notes.slice(0, CARD_NOTES_MAX_LENGTH);

  // Resolve the network id to a human-readable name — best-effort; the raw id
  // still labels the card if the lookup fails.
  const networkId = str(device.networkId);
  if (networkId) {
    card.network = networkId;
    try {
      const network = await client.networks.get(networkId);
      const name = str(network?.name);
      if (name) card.network = name;
    } catch {
      // Best-effort: keep the id label rather than failing the tool.
    }
  }

  return card;
}
