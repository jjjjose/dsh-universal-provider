import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import * as UniversalPlugin from '../src/index.ts'
import { LlmRuntime, type ReasoningEffortId } from '@deepseek-ai/dsh-llm'

vi.mock('../src/core/models/catalog.ts', () => ({ fetchCatalog: async () => { throw new Error('offline') } }))

describe('Universal Provider End-to-End Plugin Integration', () => {
  let server: http.Server
  let baseUrl: string
  let requestedModel: string
  let requestedEffort: string
  let modelIds = ['gemini-test', 'gpt-test', 'claude-test']
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url?.startsWith('/v1/models')) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(req.url.includes('?') ? { models: modelIds.map(slug => ({
          slug, supported_reasoning_levels: [{ effort: 'off' }, { effort: 'high' }], default_reasoning_level: 'high',
        })) } : { data: modelIds.map(id => ({ id, owned_by: 'test' })) }))
      } else if (req.url === '/v1/responses') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          requestedModel = JSON.parse(body).model
          requestedEffort = JSON.parse(body).reasoning?.effort
          res.setHeader('Content-Type', 'text/event-stream')
          res.end('data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed","response":{}}\n\ndata: [DONE]\n\n')
        })
      } else {
        res.writeHead(404).end()
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  })
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })
  it('activates plugin, registers LLM adapter and handles RPC invocations', async () => {
    const ctx = new Context()

    const llm = new LlmRuntime(ctx)
    const updated = vi.fn()
    ctx.on('llm/adapters-updated', updated)
    ctx.provide('subprocess')
    ctx.subprocess = {
      spawn: () => ({
        done: Promise.resolve({ exitCode: 0 }),
        collected: { stdout: { readFrom: () => '' } },
      }),
    }

    // Mount plugin
    const fiber = await ctx.plugin(UniversalPlugin, {
      serverMode: 'external',
      externalUrl: baseUrl,
      apiKeyEnv: 'API_KEY',
      managementKeyEnv: 'MGMT_KEY',
      serverVersion: '8.0.3',
      requestLogging: false,
      port: 8317,
    })

    try {

    expect(ctx.universalProvider).toBeDefined()
    expect(llm.listConfigurableProviders()).toHaveLength(1)
    expect(llm.listProviders()[0].id).toBe('universal-chat-provider')

    // 1. Check model discovery
    updated.mockClear()
    const models = await llm.listModels('universal-chat-provider')
    expect(models.length).toBeGreaterThan(0)
    expect(models.map((model: any) => model.id)).toEqual(['gemini-test', 'gpt-test', 'claude-test'])
    expect(await ctx.universalProvider.listModels()).toEqual(models)
    expect(updated).toHaveBeenCalledOnce()
    const info = await llm.resolveModelInfo('universal-chat-provider', 'gpt-test')
    expect(info.reasoning).toEqual({ efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }], defaultEffort: 'high' })
    await expect(llm.resolveCallConfig({ provider: 'universal-chat-provider', model: 'gpt-test', reasoningEffort: 'invalid' as ReasoningEffortId })).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })

    // 2. Check stream call
    const chunks: any[] = []
    for await (const chunk of llm.stream({
      provider: 'universal-chat-provider',
      model: 'gpt-test',
      reasoningEffort: 'off' as ReasoningEffortId,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[chunks.length - 1].type).toBe('finish')
    expect(requestedModel).toBe('gpt-test')
    expect(requestedEffort).toBe('off')
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'Hello')).toBe(true)

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
    modelIds = []
    expect(await ctx.universalProvider.listModels()).toEqual([])
    expect(updated).toHaveBeenCalledTimes(2)
    expect(await llm.listModels('universal-chat-provider')).toEqual([])
    } finally {
      await fiber.dispose()
    }
  })
})
