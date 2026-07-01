import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DomainHandler, CallToolResult } from '../utils/types.js';
import { getClient } from '../utils/client.js';
import { logger } from '../utils/logger.js';
import {
  guardWrite,
  isWriteMethod,
  isDestructiveMethod,
  stripConfirmation,
  type HttpMethod,
} from '../utils/safety.js';

function getTools(): Tool[] {
  return [
    {
      name: 'meraki_raw_request',
      description:
        'Escape hatch for the long tail of the Meraki Dashboard API. Reaches ANY Meraki v1 ' +
        'endpoint not covered by a curated tool. The call is classified by HTTP method — GET is ' +
        'a read; POST/PUT/DELETE are writes and are subject to read-only mode; DELETE is ' +
        'destructive and requires confirm_destructive_action. ' +
        'Prefer a curated tool when one exists; confirm write/destructive calls with the user before invoking.',
      annotations: {
        title: 'Raw Meraki API request',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'HTTP method',
          },
          path: {
            type: 'string',
            description: 'Meraki v1 API path, e.g. "/organizations/{id}/networks"',
          },
          query: {
            type: 'object',
            description: 'Optional query string parameters',
          },
          body: {
            type: 'object',
            description: 'Optional JSON request body',
          },
          confirm_destructive_action: {
            type: 'boolean',
            description: 'Must be true to confirm a DELETE (destructive) request.',
          },
        },
        required: ['method', 'path'],
      },
    },
  ];
}

async function handleCall(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (toolName !== 'meraki_raw_request') {
    return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
  }

  const method = String(args.method ?? 'GET').toUpperCase() as HttpMethod;
  const path = args.path as string;

  if (isWriteMethod(method)) {
    const blocked = guardWrite({ destructive: isDestructiveMethod(method) }, args);
    if (blocked) return blocked;
  }

  const client = await getClient();
  // Never forward the confirmation flag to the API.
  const clean = stripConfirmation(args);

  logger.info('API call: raw request', { method, path });
  const result = await client.request(method, path, {
    query: clean.query as Record<string, unknown> | undefined,
    body: clean.body,
  });

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

export const passthroughHandler: DomainHandler = { getTools, handleCall };
