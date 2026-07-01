import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DomainHandler, CallToolResult } from '../utils/types.js';
import { getClient } from '../utils/client.js';
import { logger } from '../utils/logger.js';

function getTools(): Tool[] {
  return [
    {
      name: 'meraki_organizations_list',
      description: 'List the organizations accessible to the configured API key.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'meraki_organizations_get',
      description: 'Get a single organization by ID.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object' as const,
        properties: {
          organization_id: { type: 'string', description: 'Organization ID' },
        },
        required: ['organization_id'],
      },
    },
    {
      name: 'meraki_organizations_inventory_list',
      description: 'List inventory devices for an organization.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object' as const,
        properties: {
          organization_id: { type: 'string', description: 'Organization ID' },
          per_page: { type: 'number', description: 'Results per page' },
          starting_after: { type: 'string', description: 'Pagination cursor' },
        },
        required: ['organization_id'],
      },
    },
  ];
}

async function handleCall(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const client = await getClient();

  switch (toolName) {
    case 'meraki_organizations_list': {
      logger.info('API call: organizations.list');
      const result = await client.organizations.list();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'meraki_organizations_get': {
      const organizationId = args.organization_id as string;
      logger.info('API call: organizations.get', { organizationId });
      const org = await client.organizations.get(organizationId);
      return { content: [{ type: 'text', text: JSON.stringify(org, null, 2) }] };
    }
    case 'meraki_organizations_inventory_list': {
      const organizationId = args.organization_id as string;
      logger.info('API call: organizations.inventoryDevices', { organizationId });
      const inventory = await client.organizations.inventoryDevices(organizationId, {
        perPage: args.per_page as number | undefined,
        startingAfter: args.starting_after as string | undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(inventory, null, 2) }] };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
  }
}

export const organizationsHandler: DomainHandler = { getTools, handleCall };
