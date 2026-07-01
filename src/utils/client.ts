import { MerakiClient } from '@wyre-technology/node-meraki';
import { logger } from './logger.js';

let _client: MerakiClient | null = null;
let _credKey: string | null = null;

interface Credentials {
  apiKey: string;
  orgId?: string;
  baseUrl?: string;
}

export function getCredentials(): Credentials | null {
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

  const key = `${creds.apiKey}:${creds.orgId ?? ''}:${creds.baseUrl ?? ''}`;
  if (_client && _credKey === key) return _client;

  _client = new MerakiClient({
    apiKey: creds.apiKey,
    orgId: creds.orgId,
    baseUrl: creds.baseUrl,
  });
  _credKey = key;
  logger.info('Created Meraki API client');
  return _client;
}

export function clearClient(): void {
  _client = null;
  _credKey = null;
}
