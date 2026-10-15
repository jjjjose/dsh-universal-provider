import { describe, expect, it, vi } from 'vitest'
import { waitForOAuth } from '../src/client/oauth-flow.ts'

describe('client OAuth flow polling', () => {
  it('returns success when the provider confirms login', async () => {
    const remote = { pollOAuth: vi.fn().mockResolvedValue({ status: 'ok' }), cancelOAuth: vi.fn() }
    let now = 0
    const result = await waitForOAuth(remote, 'state-1', {
      now: () => now,
      delay: async ms => { now += ms },
      intervalMs: 10,
      timeoutMs: 100,
    })

    expect(result).toEqual({ status: 'ok' })
    expect(remote.pollOAuth).toHaveBeenCalledWith('state-1', undefined)
    expect(remote.cancelOAuth).not.toHaveBeenCalled()
  })

  it('returns provider errors and retries transient poll failures', async () => {
    const remote = {
      pollOAuth: vi.fn()
        .mockRejectedValueOnce(new Error('temporary network error'))
        .mockResolvedValueOnce({ status: 'error', error: 'Access denied' }),
      cancelOAuth: vi.fn(),
    }
    let now = 0
    const result = await waitForOAuth(remote, 'state-2', {
      now: () => now,
      delay: async ms => { now += ms },
      intervalMs: 10,
      timeoutMs: 100,
    })

    expect(result).toEqual({ status: 'error', error: 'Access denied' })
    expect(remote.pollOAuth).toHaveBeenCalledTimes(2)
    expect(remote.cancelOAuth).not.toHaveBeenCalled()
  })

  it('cancels an OAuth session on timeout or user cancellation', async () => {
    let now = 0
    const timedOutRemote = { pollOAuth: vi.fn().mockResolvedValue({ status: 'wait' }), cancelOAuth: vi.fn().mockResolvedValue(true) }
    const timeout = await waitForOAuth(timedOutRemote, 'state-timeout', {
      now: () => now,
      delay: async ms => { now += ms },
      intervalMs: 10,
      timeoutMs: 20,
    })
    expect(timeout).toEqual({ status: 'timeout' })
    expect(timedOutRemote.cancelOAuth).toHaveBeenCalledWith('state-timeout')

    const controller = new AbortController()
    const cancelledRemote = { pollOAuth: vi.fn(), cancelOAuth: vi.fn().mockResolvedValue(true) }
    const cancelled = await waitForOAuth(cancelledRemote, 'state-cancelled', {
      signal: controller.signal,
      delay: async () => { controller.abort() },
      timeoutMs: 100,
    })
    expect(cancelled).toEqual({ status: 'cancelled' })
    expect(cancelledRemote.cancelOAuth).toHaveBeenCalledWith('state-cancelled')
    expect(cancelledRemote.pollOAuth).not.toHaveBeenCalled()
  })
})
