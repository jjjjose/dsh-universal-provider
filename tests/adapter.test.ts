import { describe, expect, it, vi } from 'vitest'
import { UniversalLlmAdapter } from '../src/host/adapter.ts'
import { AssistantStreamAccumulator } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModelContextSettings } from '../src/host/model-context.ts'

vi.mock('../src/core/models/catalog.ts', () => ({ fetchCatalog: vi.fn(async () => { throw new Error('offline') }) }))

describe('UniversalLlmAdapter', () => {
  it('defaults to 1M even when discovery reports a smaller window', async () => {
    const adapter = new UniversalLlmAdapter({
      ensureRunning: async () => {},
      getProxyClient: () => ({
        discover: async () => ({
          available: [{ id: 'test-model', owned_by: 'test-provider', context_length: 272000 }],
          metadata: [{ slug: 'test-model', context_window: 272000 }],
        }),
      }),
    } as any)
    const resolved = await adapter.resolveModel('universal-chat-provider', 'test-model')
    expect(resolved.context?.contextWindow).toBe(1000000)
  })

  it('discovers all providers and removes models when their accounts disappear', async () => {
    const discover = vi.fn().mockResolvedValue({
      available: ['gemini-test', 'gpt-test', 'claude-test', 'endpoint-model'].map(id => ({ id })),
      metadata: [],
    })
    const adapter = new UniversalLlmAdapter({
      ensureRunning: async () => {},
      getProxyClient: () => ({ discover }),
    } as any)
    expect((await adapter.listModels('universal-chat-provider')).map(m => m.id)).toEqual([
      'gemini-test', 'gpt-test', 'claude-test', 'endpoint-model',
    ])
    discover.mockResolvedValue({ available: [], metadata: [] })
    expect(await adapter.listModels('universal-chat-provider')).toEqual([])
    discover.mockRejectedValue(new Error('discovery unavailable'))
    await expect(adapter.listModels('universal-chat-provider')).rejects.toThrow('discovery unavailable')
    expect(adapter.defaultFallbackModels('universal-chat-provider')).toEqual([])
  })

  const mockSupervisor = {
    ensureRunning: async () => {},
    acquireRequest: async () => () => {},
    getProxyClient: () => ({
      discover: async () => ({
        available: [{ id: 'claude-3-7-sonnet', context_length: 200000, max_completion_tokens: 8192 }],
        metadata: [{ slug: 'claude-3-7-sonnet', display_name: 'Claude 3.7 Sonnet', supported_reasoning_levels: [{ effort: 'high' }] }],
      }),
      streamResponse: async (_body: any, callbacks: any) => {
        callbacks.onThinking?.('Let me analyze...')
        callbacks.onText('Here is the ')
        callbacks.onText('answer.')
        callbacks.onToolCall('call-1', 'bash', { command: 'ls' })
        callbacks.onUsage?.({ prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 })
      },
    }),
  } as any

  it('translates DSH GenerateOptions to /v1/responses format', () => {
    const adapter = new UniversalLlmAdapter(mockSupervisor)
    const body = adapter.buildRequestBody({
      model: 'claude-3-7-sonnet',
      reasoningEffort: 'high',
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
        { role: 'user', content: [{ type: 'text', text: 'Run ls' }] },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Running' },
            { type: 'tool-call', id: 'call-1', name: 'bash', arguments: '{"command":"ls"}' },
          ],
        },
        { role: 'tool', toolCallId: 'call-1', content: [{ type: 'text', text: 'file1.txt\nfile2.txt' }] },
      ],
      tools: [{ name: 'bash', description: 'Run bash command', parameters: { type: 'object' } }],
    })

    expect(body.model).toBe('claude-3-7-sonnet')
    expect(body.reasoning).toEqual({ effort: 'high', summary: 'detailed' })
    expect(body.tools).toHaveLength(1)
    expect(body.tools![0]?.name).toBe('bash')

    expect(body.input).toHaveLength(5)
    expect(body.input[0]?.role).toBe('system')
    expect(body.input[1]?.role).toBe('user')
    expect(body.input[2]?.type).toBe('function_call')
    expect(body.input[3]?.role).toBe('assistant')
    expect(body.input[4]?.type).toBe('function_call_output')
    expect(body.input[4]?.call_id).toBe('call-1')
  })

  it('streams chunks with balanced blocks, reasoning, tools, and usage', async () => {
    const adapter = new UniversalLlmAdapter(mockSupervisor)
    const chunks: any[] = []
    const accumulator = new AssistantStreamAccumulator()

    for await (const chunk of adapter.stream({
      provider: 'universal-chat-provider',
      model: 'claude-3-7-sonnet',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    })) {
      chunks.push(chunk)
      accumulator.push({ time: chunks.length, chunk })
    }

    expect(chunks.some(c => c.type === 'block-start' && c.blockType === 'reasoning')).toBe(true)
    expect(chunks.some(c => c.type === 'reasoning-delta')).toBe(true)
    expect(chunks.some(c => c.type === 'block-end' && c.block.type === 'reasoning')).toBe(true)

    expect(chunks.some(c => c.type === 'block-start' && c.blockType === 'text')).toBe(true)
    expect(chunks.some(c => c.type === 'text-delta' && c.text === 'Here is the ')).toBe(true)
    expect(chunks.some(c => c.type === 'block-end' && c.block.type === 'text')).toBe(true)

    expect(chunks.some(c => c.type === 'block-start' && c.blockType === 'tool-call')).toBe(true)
    expect(chunks.some(c => c.type === 'tool-call-delta' && c.id === 'call-1')).toBe(true)

    expect(chunks.some(c => c.type === 'usage' && c.usage.totalTokens === 35)).toBe(true)
    expect(chunks.find(c => c.type === 'usage').usage).not.toHaveProperty('cacheReadTokens')
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })

  it('resolves model info and limits from discovery', async () => {
    const adapter = new UniversalLlmAdapter(mockSupervisor)
    const model = await adapter.resolveModel('universal-chat-provider', 'claude-3-7-sonnet')

    expect(model.id).toBe('claude-3-7-sonnet')
    expect(model.context?.contextWindow).toBe(1000000)
    expect(model.defaultMaxTokens).toBe(8192)
    expect(model.reasoning?.efforts[0]?.id).toBe('high')
  })

  it('persists per-model choices, invalidates Harness and uses the chosen value in listings and calls', async () => {
    const root = await mkdtemp(join(tmpdir(), 'model-context-'))
    try {
      const path = join(root, 'contexts.json')
      const adapter = new UniversalLlmAdapter(mockSupervisor, new ModelContextSettings(path))
      adapter.onModelsChanged = vi.fn()
      await adapter.setModelContext('claude-3-7-sonnet', 500000)
      expect(adapter.onModelsChanged).toHaveBeenCalledOnce()
      expect((await adapter.listModels('universal-chat-provider'))[0]?.contextWindow).toBe(500000)
      const restarted = new UniversalLlmAdapter(mockSupervisor, new ModelContextSettings(path))
      expect((await restarted.prepareCall('universal-chat-provider', 'claude-3-7-sonnet')).model.context?.contextWindow).toBe(500000)
      expect(await restarted.contextSettings.get('other-model')).toBe(1000000)
      await expect(restarted.setModelContext('claude-3-7-sonnet', -1)).rejects.toThrow('entero positivo')
      expect(await restarted.contextSettings.get('claude-3-7-sonnet')).toBe(500000)
      await Promise.all([
        restarted.setModelContext('first', 200000),
        restarted.setModelContext('second', 2000000),
      ])
      expect(await restarted.contextSettings.get('first')).toBe(200000)
      expect(await restarted.contextSettings.get('second')).toBe(2000000)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
