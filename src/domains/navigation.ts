import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DomainName } from '../utils/types.js';

export const DOMAINS: DomainName[] = [
  'organizations',
  'networks',
  'devices',
  'clients',
  'wireless',
  'switch',
  'appliance',
];

export function getNavigationTools(): Tool[] {
  return [
    {
      name: 'meraki_navigate',
      description: `Discover available Cisco Meraki tools by domain. Returns tool names and descriptions for the selected domain. All tools are callable at any time — this is a help/discovery aid, not a prerequisite.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            enum: DOMAINS,
            description: `The domain to explore:
- organizations: list/get organizations, list inventory devices
- networks: list/get/update/delete networks within an organization
- devices: list/get devices, reboot, remove from network
- clients: list/get network clients, get/update client policy
- wireless: SSIDs, RF profiles
- switch: switch ports and port statuses
- appliance: MX L3 firewall rules, site-to-site VPN`,
          },
        },
        required: ['domain'],
      },
    },
    {
      name: 'meraki_status',
      description: 'Check Meraki API connection status, configured organization, and available domains.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
  ];
}
