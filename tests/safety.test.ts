import { describe, it, expect, beforeEach, vi } from 'vitest';

// Spies for the mocked Meraki client. Declared via vi.hoisted so they are
// available inside the hoisted vi.mock factory below.
const { updateSpy, deleteSpy, requestSpy } = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  requestSpy: vi.fn(),
}));

vi.mock('../src/utils/client.js', () => ({
  getCredentials: () => ({ apiKey: 'test-key' }),
  clearClient: () => {},
  getClient: vi.fn(async () => ({
    networks: { update: updateSpy, delete: deleteSpy },
    request: requestSpy,
  })),
}));

import { networksHandler } from '../src/domains/networks.js';
import { passthroughHandler } from '../src/domains/passthrough.js';
import { getClient } from '../src/utils/client.js';

describe('safety gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.READ_ONLY_MODE;
    delete process.env.READ_ONLY;
  });

  it('blocks a write tool in read-only mode (default)', async () => {
    // No READ_ONLY_MODE set → read-only is ON by default.
    const res = await networksHandler.handleCall('meraki_networks_update', {
      network_id: 'N_1',
      name: 'renamed',
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('read_only_mode');
    expect(res.content[0].text).toContain('READ_ONLY_MODE=false');
    // Guard should short-circuit before ever reaching the SDK.
    expect(getClient).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('requires confirm_destructive_action for a destructive tool', async () => {
    process.env.READ_ONLY_MODE = 'false';

    const res = await networksHandler.handleCall('meraki_networks_delete', {
      network_id: 'N_1',
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('confirmation_required');
    expect(res.content[0].text).toContain('confirm_destructive_action');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('proceeds when confirmed and never forwards confirm_destructive_action', async () => {
    process.env.READ_ONLY_MODE = 'false';
    requestSpy.mockResolvedValue({ deleted: true });

    const res = await passthroughHandler.handleCall('meraki_raw_request', {
      method: 'DELETE',
      path: '/networks/N_1',
      body: { keepConfig: false },
      confirm_destructive_action: true,
    });

    expect(res.isError).toBeFalsy();
    expect(requestSpy).toHaveBeenCalledTimes(1);

    const [method, path, options] = requestSpy.mock.calls[0];
    expect(method).toBe('DELETE');
    expect(path).toBe('/networks/N_1');
    expect(options.body).toEqual({ keepConfig: false });

    // The confirmation flag must never be handed to the SDK.
    expect(JSON.stringify(requestSpy.mock.calls[0])).not.toContain('confirm_destructive_action');
  });
});
