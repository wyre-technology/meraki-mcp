import type { CallToolResult } from './types.js';

/**
 * Safety module for the Meraki MCP server.
 *
 * Ported from the Cisco Meraki community server's safety design:
 *   - Read-only mode is ON by default and must be explicitly disabled.
 *   - Passthrough calls are classified by HTTP method (GET = read;
 *     POST/PUT/DELETE = write; DELETE = destructive).
 *   - Destructive operations require an explicit `confirm_destructive_action`
 *     flag, which is never forwarded to the Meraki API.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Read-only mode defaults to TRUE. `READ_ONLY_MODE` takes precedence over the
 * legacy `READ_ONLY` variable. Any value other than an explicit falsey string
 * ("false", "0", "no", "off") leaves the server in read-only mode.
 */
export function isReadOnly(): boolean {
  const raw = process.env.READ_ONLY_MODE ?? process.env.READ_ONLY;
  if (raw === undefined || raw.trim() === '') return true; // default: read-only
  return !/^(false|0|no|off)$/i.test(raw.trim());
}

/** GET is a read; POST, PUT and DELETE are writes. */
export function isWriteMethod(method: string): boolean {
  return method.toUpperCase() !== 'GET';
}

/** DELETE is destructive. */
export function isDestructiveMethod(method: string): boolean {
  return method.toUpperCase() === 'DELETE';
}

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return /^(true|1|yes|on)$/i.test(value.trim());
  return false;
}

/**
 * Remove the `confirm_destructive_action` flag so it is never forwarded to the
 * Meraki SDK / API as part of a query or body.
 */
export function stripConfirmation(args: Record<string, unknown>): Record<string, unknown> {
  const { confirm_destructive_action: _confirm, ...rest } = args;
  void _confirm;
  return rest;
}

function blocked(error: string, message: string, hint: string): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error, message, hint }, null, 2) }],
    isError: true,
  };
}

/**
 * Gate a write / destructive tool call.
 *
 * Returns a structured error `CallToolResult` when:
 *   (a) the server is read-only and this is a write, or
 *   (b) the call is destructive and `confirm_destructive_action` is not truthy.
 *
 * Returns `null` when the call may proceed.
 */
export function guardWrite(
  { destructive }: { destructive: boolean },
  args: Record<string, unknown>
): CallToolResult | null {
  // (a) read-only mode blocks every write
  if (isReadOnly()) {
    return blocked(
      'read_only_mode',
      'This server is running in read-only mode; write operations are disabled.',
      'Set READ_ONLY_MODE=false to enable writes',
    );
  }

  // (b) destructive operations require explicit confirmation
  if (destructive && !isTruthy(args.confirm_destructive_action)) {
    return blocked(
      'confirmation_required',
      'This is a destructive, irreversible operation. Re-invoke with the ' +
        'confirm_destructive_action parameter set to true to proceed.',
      'Pass confirm_destructive_action: true to confirm this destructive action',
    );
  }

  return null;
}
