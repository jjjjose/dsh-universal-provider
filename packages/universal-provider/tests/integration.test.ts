import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as UniversalPlugin from '../src/index.ts'

describe('Universal Provider End-to-End Plugin Integration', () => {
  it('activates plugin, registers LLM adapter and handles RPC invocations', async () => {
    const ctx = new Context()

    // Setup mock services
    const mockLlm = {
      adapters: new Map<string, any>(),
      configurableProviders: [] as any[],
      registerAdapter(providers: string[], adapter: any) {
        for (const p of providers) this.adapters.set(p, adapter)
      },
      registerConfigurableProviders(entries: any[]) {
        this.configurableProviders.push(...entries)
      },
      async listModels(provider: string) {
        const adapter = this.adapters.get(provider)
        return adapter ? adapter.listModels(provider) : []
      },
      async *stream(options: any) {
        const adapter = this.adapters.get(options.provider)
        if (!adapter) throw new Error(`No adapter for ${options.provider}`)
        for await (const chunk of adapter.stream(options)) {
          yield chunk
        }
      },
    }

    ctx.provide('llm')
    ctx.llm = mockLlm
    ctx.provide('subprocess')
    ctx.subprocess = {
      spawn: () => ({
        done: Promise.resolve({ exitCode: 0 }),
        collected: { stdout: { readFrom: () => '' } },
      }),
    }

    // Mount plugin
    await ctx.plugin(UniversalPlugin, {
      serverMode: 'external',
      externalUrl: 'http://127.0.0.1:8317',
      apiKeyEnv: 'API_KEY',
      managementKeyEnv: 'MGMT_KEY',
      serverVersion: '8.0.3',
      requestLogging: false,
      port: 8317,
    })

    await new Promise(r => setTimeout(r, 50))

    expect(ctx.universalProvider).toBeDefined()
    expect(mockLlm.configurableProviders).toHaveLength(1)
    expect(mockLlm.configurableProviders[0].provider).toBe('universal-chat-provider')

    // 1. Check model discovery
    const models = await mockLlm.listModels('universal-chat-provider')
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].id).toBe('universal-chat')

    // 2. Check stream call
    const chunks: any[] = []
    for await (const chunk of mockLlm.stream({
      provider: 'universal-chat-provider',
      model: 'universal-chat',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[chunks.length - 1].type).toBe('finish')

    // 3. Check RPC ping
    const ping = await ctx.universalProvider.ping()
    expect(ping.message).toBe('pong')
    expect(ping.timestamp).toBeGreaterThan(0)

    // 4. Check commit draft on empty diff
    const draft = await ctx.universalProvider.generateCommitDraft({ cwd: '/workspace' })
    expect(draft.hasStagedChanges).toBe(false)
    expect(draft.message).toContain('No hay cambios en stage')

    // 5. Check cancellation
    const controller = new AbortController()
    controller.abort()
    await expect(ctx.universalProvider.ping(controller.signal)).rejects.toThrow()
  })
})
