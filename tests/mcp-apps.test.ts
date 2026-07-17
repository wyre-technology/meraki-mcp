/**
 * MCP Apps (SEP-1865) contract tests — mirrors the checks an MCP Apps host
 * performs to render the device card:
 *   1. the renderable tool advertises the UI resource via _meta (both forms)
 *   2. the ui:// resource lists and reads back as profile=mcp-app HTML
 *   3. buildDeviceCard normalizes a Meraki device into the card payload
 *      the iframe renders from, resolving the network id to its name
 */

import { describe, it, expect, vi } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getNavigationTools, DOMAINS } from '../src/domains/navigation.js';
import { getDomainHandler } from '../src/domains/index.js';
import { passthroughHandler } from '../src/domains/passthrough.js';
import { listResources, readResource } from '../src/resources.js';
import {
  buildDeviceCard,
  applyBrandInjection,
  DEVICE_CARD_RESOURCE_URI,
  MCP_APP_RESOURCE_MIME,
} from '../src/card.builder.js';
import { DEVICE_CARD_HTML } from '../src/generated/device-card-html.js';

const RENDERABLE_TOOLS = ['meraki_devices_get'];

async function getAllTools(): Promise<Tool[]> {
  const tools: Tool[] = [...getNavigationTools()];
  for (const domain of DOMAINS) {
    const handler = await getDomainHandler(domain);
    tools.push(...handler.getTools());
  }
  tools.push(...passthroughHandler.getTools());
  return tools;
}

describe('MCP Apps device card', () => {
  describe('tool _meta advertisement', () => {
    it.each(RENDERABLE_TOOLS)('%s links the card via _meta', async name => {
      const tool = (await getAllTools()).find(t => t.name === name);
      expect(tool).toBeDefined();
      // Canonical flat key (ext-apps RESOURCE_URI_META_KEY) …
      expect(tool?._meta?.['ui/resourceUri']).toBe(DEVICE_CARD_RESOURCE_URI);
      // … and the nested form registerAppTool also emits.
      expect((tool?._meta?.ui as { resourceUri?: string })?.resourceUri).toBe(
        DEVICE_CARD_RESOURCE_URI
      );
    });

    it('no other tools carry UI metadata', async () => {
      const others = (await getAllTools()).filter(
        t => t._meta && !RENDERABLE_TOOLS.includes(t.name)
      );
      expect(others).toEqual([]);
    });
  });

  describe('ui:// resource', () => {
    it('is listed with the MCP Apps MIME type', () => {
      const card = listResources().find(r => r.uri === DEVICE_CARD_RESOURCE_URI);
      expect(card?.mimeType).toBe(MCP_APP_RESOURCE_MIME);
    });

    it('reads back as profile=mcp-app HTML containing the card app', () => {
      const content = readResource(DEVICE_CARD_RESOURCE_URI);
      expect(content.mimeType).toBe(MCP_APP_RESOURCE_MIME);
      // No MCP_BRAND_* env set → the embedded HTML is served byte-identical.
      expect(content.text).toBe(DEVICE_CARD_HTML);
      expect(content.text).toContain('card__bar');
      // The BRAND_INJECT marker must survive the vite build exactly once so
      // serve-time injection has an unambiguous anchor.
      expect(content.text.match(/BRAND_INJECT/g)).toHaveLength(1);
      // The vite build must have inlined the bridge script — a bare <script src>
      // would be unloadable from a resources/read HTML string.
      expect(content.text).not.toContain('src="./device-card.ts"');
    });

    it('serves neutral defaults with no vendor identity', () => {
      const { text } = readResource(DEVICE_CARD_RESOURCE_URI);
      expect(text).not.toMatch(/WYRE/i);
      expect(text).not.toContain('00c9db'); // WYRE cyan
      expect(text).not.toContain('ede947'); // WYRE yellow
      expect(text).not.toContain('fonts.googleapis.com'); // no external fetches
    });

    it('injects MCP_BRAND_* env vars into the served HTML', () => {
      vi.stubEnv('MCP_BRAND_NAME', 'Acme MSP');
      vi.stubEnv('MCP_BRAND_PRIMARY_COLOR', '#ff0000');
      try {
        const { text } = readResource(DEVICE_CARD_RESOURCE_URI);
        expect(text).toContain(
          '<script>window.__BRAND__={"name":"Acme MSP","primaryColor":"#ff0000"}</script>'
        );
        expect(text).not.toContain('BRAND_INJECT');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('rejects unknown resource URIs', () => {
      expect(() => readResource('ui://meraki/nope.html')).toThrow(/Unknown resource/);
    });
  });

  describe('applyBrandInjection', () => {
    const html = DEVICE_CARD_HTML;

    it('replaces the marker with an inline window.__BRAND__ script', () => {
      const out = applyBrandInjection(html, { name: 'Acme', primaryColor: '#123456' });
      expect(out).toContain('window.__BRAND__={"name":"Acme","primaryColor":"#123456"}');
      expect(out).not.toContain('BRAND_INJECT');
    });

    it('escapes < so brand values cannot break out of the script tag', () => {
      const out = applyBrandInjection(html, { name: '</script><script>alert(1)' });
      expect(out).not.toContain('</script><script>alert(1)');
      expect(out).toContain('\\u003c/script>\\u003cscript>alert(1)');
    });

    it('returns the HTML unchanged for an empty brand', () => {
      expect(applyBrandInjection(html, {})).toBe(html);
      expect(applyBrandInjection(html, { name: '' })).toBe(html);
    });
  });

  describe('buildDeviceCard', () => {
    const device = {
      serial: 'Q2XX-ABCD-1234',
      name: 'Front Office AP',
      model: 'MR46',
      networkId: 'N_1234',
      productType: 'wireless',
      mac: '00:11:22:33:44:55',
      lanIp: '10.0.1.20',
      firmware: 'wireless-30-7',
      address: '500 Main St, Chattanooga, TN',
      tags: ['branch', 'wifi'],
      notes: 'Mounted above reception.',
    };

    const mockNetworksGet = vi.fn(async () => ({ id: 'N_1234', name: 'Branch Office' }));
    const client = { networks: { get: mockNetworksGet } };

    it('normalizes the device into the card payload with a resolved network name', async () => {
      const card = await buildDeviceCard(device, client as never);
      expect(mockNetworksGet).toHaveBeenCalledWith('N_1234');
      expect(card).toEqual({
        serial: 'Q2XX-ABCD-1234',
        name: 'Front Office AP',
        model: 'MR46',
        productType: 'wireless',
        network: 'Branch Office',
        mac: '00:11:22:33:44:55',
        lanIp: '10.0.1.20',
        firmware: 'wireless-30-7',
        address: '500 Main St, Chattanooga, TN',
        tags: ['branch', 'wifi'],
        notes: 'Mounted above reception.',
      });
    });

    it('falls back to the serial as the display name for unnamed devices', async () => {
      const card = await buildDeviceCard({ serial: 'Q2XX-ABCD-1234' }, client as never);
      expect(card).toEqual({ serial: 'Q2XX-ABCD-1234', name: 'Q2XX-ABCD-1234', tags: [] });
    });

    it('keeps the network id label when the lookup fails (card is best-effort)', async () => {
      const failing = {
        networks: {
          get: vi.fn(async () => {
            throw new Error('Meraki 500');
          }),
        },
      };
      const card = await buildDeviceCard(device, failing as never);
      expect(card?.network).toBe('N_1234');
      expect(card?.name).toBe('Front Office AP');
    });

    it('truncates long notes and caps tags so the card payload stays small', async () => {
      const noisy = {
        ...device,
        notes: 'x'.repeat(600),
        tags: Array.from({ length: 12 }, (_, i) => `tag-${i}`),
      };
      const card = await buildDeviceCard(noisy, client as never);
      expect(card?.notes).toHaveLength(500);
      expect(card?.tags).toHaveLength(8);
    });

    it('returns null for payloads that are not a device', async () => {
      expect(await buildDeviceCard({}, client as never)).toBeNull();
      expect(await buildDeviceCard({ name: 'no serial' }, client as never)).toBeNull();
    });
  });
});
