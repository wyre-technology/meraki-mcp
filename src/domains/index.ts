import type { DomainName, DomainHandler } from '../utils/types.js';

const domainCache = new Map<DomainName, DomainHandler>();

export async function getDomainHandler(domain: DomainName): Promise<DomainHandler> {
  const cached = domainCache.get(domain);
  if (cached) return cached;

  let handler: DomainHandler;
  switch (domain) {
    case 'organizations': {
      const { organizationsHandler } = await import('./organizations.js');
      handler = organizationsHandler;
      break;
    }
    case 'networks': {
      const { networksHandler } = await import('./networks.js');
      handler = networksHandler;
      break;
    }
    case 'devices': {
      const { devicesHandler } = await import('./devices.js');
      handler = devicesHandler;
      break;
    }
    case 'clients': {
      const { clientsHandler } = await import('./clients.js');
      handler = clientsHandler;
      break;
    }
    case 'wireless': {
      const { wirelessHandler } = await import('./wireless.js');
      handler = wirelessHandler;
      break;
    }
    case 'switch': {
      const { switchHandler } = await import('./switch.js');
      handler = switchHandler;
      break;
    }
    case 'appliance': {
      const { applianceHandler } = await import('./appliance.js');
      handler = applianceHandler;
      break;
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }

  domainCache.set(domain, handler);
  return handler;
}
