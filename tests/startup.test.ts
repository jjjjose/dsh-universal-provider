import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/index.ts'
import { UniversalLlmAdapter } from '../src/host/adapter.ts'

const config = {
  serverMode: 'external' as const,
  externalUrl: 'http://127.0.0.1:8317',
  apiKeyEnv: 'TEST_ABSENT_API_KEY',
  managementKeyEnv: 'TEST_ABSENT_MANAGEMENT_KEY',
  serverVersion: 'latest',
  requestLogging: false,
  port: 8317,
}

function activate() {
  const root = new Context()
  root.provide('llm', {
    registerAdapter: () => ({ replace: vi.fn() }),
    registerConfigurableProviders: () => {},
  })
  return root.plugin({ apply, inject }, config)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('automatic model loading', () => {
  it('retries a transient failure without opening the plugin panel', async () => {
    const list = vi.spyOn(UniversalLlmAdapter.prototype, 'listModels')
      .mockRejectedValueOnce(new Error('proxy unavailable'))
      .mockResolvedValue([])
    const fiber = activate()
    try {
      await fiber
      expect(list).toHaveBeenCalledOnce()
      await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2), { timeout: 2500 })
    } finally {
      await fiber.dispose()
    }
  })

  it('does not block activation and cancels in-flight loading on disposal', async () => {
    let signal: AbortSignal | undefined
    vi.spyOn(UniversalLlmAdapter.prototype, 'listModels').mockImplementation((_provider, abort) => {
      signal = abort
      return new Promise((_resolve, reject) => {
        abort!.addEventListener('abort', () => reject(abort!.reason), { once: true })
      })
    })
    const fiber = activate()
    await fiber
    expect(signal?.aborted).toBe(false)
    await fiber.dispose()
    expect(signal?.aborted).toBe(true)
  })

  it('cancels scheduled retries when disposed', async () => {
    const list = vi.spyOn(UniversalLlmAdapter.prototype, 'listModels').mockRejectedValue(new Error('offline'))
    const fiber = activate()
    await fiber
    await fiber.dispose()
    await new Promise(resolve => setTimeout(resolve, 1100))
    expect(list).toHaveBeenCalledOnce()
  })
})
