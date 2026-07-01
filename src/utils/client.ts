import { AsyncLocalStorage } from 'node:async_hooks';
import { MerakiClient } from '@wyre-technology/node-meraki';
import { logger } from './logger.js';

export interface Credentials {
  apiKey: string;
  orgId?: string;
  baseUrl?: string;
}

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({apiKey, orgId, baseUrl}); getCredentials()
// reads it. Falls back to process.env for stdio / single-tenant mode.
//
// SECURITY-CRITICAL: credentials must NEVER be stashed in module-level mutable
// state (process.env or a cached singleton). Under concurrent multi-tenant
// requests the event loop interleaves, so a shared slot lets one tenant's key
// be read by another tenant's tool call. The ALS context is the only per-request
// credential carrier; do not reintroduce a global client cache.
const credStore = new AsyncLocalStorage<Credentials>();

export function runWithCredentials<T>(creds: Credentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): Credentials | null {
  const scoped = credStore.getStore();
  if (scoped?.apiKey) return scoped;

  const apiKey = process.env.MERAKI_API_KEY;
  if (!apiKey) {
    logger.warn('Missing MERAKI_API_KEY');
    return null;
  }
  return {
    apiKey,
    orgId: process.env.MERAKI_ORG_ID || undefined,
    baseUrl: process.env.MERAKI_BASE_URL || undefined,
  };
}

export async function getClient(): Promise<MerakiClient> {
  const creds = getCredentials();
  if (!creds) throw new Error('No Meraki API credentials configured. Set MERAKI_API_KEY.');

  // Build fresh from the (request-scoped) credentials on every call. A cached
  // singleton keyed by creds still races: two concurrent tenants would each
  // rebuild and clobber the shared slot. MerakiClient construction is cheap
  // (config only, no connection), so per-call construction is the safe choice.
  return new MerakiClient({
    apiKey: creds.apiKey,
    orgId: creds.orgId,
    baseUrl: creds.baseUrl,
  });
}
