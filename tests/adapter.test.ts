import { describe, expect, it, vi } from 'vitest'
import { UniversalLlmAdapter } from '../src/host/adapter.ts'
import { AssistantStreamAccumulator } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { ModelContextSettings } from '../src/host/model-context.ts'

vi.mock('../src/core/models/catalog.ts', () => ({ fetchCatalog: vi.fn(async () => { throw new Error('offline') }) }))

describe('UniversalLlmAdapter', () => {
  it('shares discovery while startup and the panel request models concurrently', async () => {
    const discover = vi.fn().mockResolvedValue({ available: [], metadata: [] })
    const adapter = new UniversalLlmAdapter({
      ensureRunning: async () => {},
      getProxyClient: () => ({ discover }),
    } as any)
    await Promise.all([adapter.listModels('provider'), adapter.listModels('provider')])
    expect(discover).toHaveBeenCalledOnce()
    await adapter.listModels('provider')
    expect(discover).toHaveBeenCalledTimes(2)
  })

  it('lists the real context versions and defaults to the largest before listing models', async () => {
    const adapter = new UniversalLlmAdapter({
      ensureRunning: async () => {},
      getProxyClient: () => ({
        discover: async () => ({
          available: [{ id: 'test-model', owned_by: 'openai', context_length: 272000, max_completion_tokens: 128000 }],
          metadata: [{ slug: 'test-model', context_window: 272000, max_context_window: 921000 }],
        }),
      }),
    } as any)
    const resolved = await adapter.resolveModel('universal-chat-provider', 'test-model')
    expect(resolved.context?.contextWindow).toBe(921000)
    expect((await adapter.listModels('universal-chat-provider'))[0]).toMatchObject({
      contextWindow: 921000,
      contextOptions: [{ value: 272000, label: '400K' }, { value: 921000, label: '1M' }],
    })
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

  it('translates DSH GenerateOptions to /v1/responses format', async () => {
    const adapter = new UniversalLlmAdapter(mockSupervisor)
    const body = await adapter.buildRequestBody({
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

  it('loads durable image references before sending the request without mutating history', async () => {
    const data = Buffer.from('image bytes')
    const attachment = { attachmentId: 'stored-image', mediaType: 'image/png', bytes: data.length, width: 32, height: 16 }
    const readImageRequest = vi.fn().mockResolvedValue({
      variantId: 'request-version', attachment, data, mediaType: 'image/webp',
      bytes: data.length, width: 32, height: 16, depth: 'uchar', space: 'srgb', hasAlpha: false,
    })
    const streamResponse = vi.fn(async () => {})
    const adapter = new UniversalLlmAdapter({
      ...mockSupervisor,
      getProxyClient: () => ({ streamResponse }),
    } as any, undefined, { readImageRequest } as any)
    const signal = new AbortController().signal
    const messages = [{ role: 'user', content: [
      { type: 'text', text: 'Describe this image' },
      { type: 'image', attachment },
    ] }]
    for await (const _ of adapter.stream({ provider: 'provider', model: 'vision', messages, signal })) {}
    expect(readImageRequest).toHaveBeenCalledWith(attachment, adapter.imageRequestTarget('provider', 'vision', attachment as any), signal)
    expect(streamResponse.mock.calls[0]?.[0]).toMatchObject({ input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Describe this image' },
      { type: 'input_image', image_url: `data:image/webp;base64,${data.toString('base64')}` },
    ] }] })
    expect(attachment).not.toHaveProperty('base64')
  })

  it('rejects empty image data instead of sending an empty data URL', async () => {
    const streamResponse = vi.fn(async () => {})
    const release = vi.fn()
    const adapter = new UniversalLlmAdapter({
      ...mockSupervisor,
      acquireRequest: async () => release,
      getProxyClient: () => ({ streamResponse }),
    } as any, undefined, { readImageRequest: async () => ({ data: new Uint8Array(), mediaType: 'image/png' }) } as any)
    const options = { provider: 'provider', model: 'vision', messages: [{ role: 'user', content: [
      { type: 'image', attachment: { mediaType: 'image/png', width: 1, height: 1 } },
    ] }] }
    await expect(async () => { for await (const _ of adapter.stream(options)) {} }).rejects.toThrow('no contiene datos')
    expect(streamResponse).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
    await expect(adapter.buildRequestBody(options)).rejects.toThrow('no contiene datos')
  })

  it.each(['missing', 'read-error', 'cancelled', 'invalid-mime'])('does not dispatch images when %s', async (failure) => {
    const controller = new AbortController()
    const release = vi.fn()
    const streamResponse = vi.fn(async () => {})
    const readImageRequest = vi.fn(async () => {
      if (failure === 'read-error') throw new Error('attachment unavailable')
      if (failure === 'cancelled') controller.abort(new Error('cancelled'))
      return { data: new Uint8Array([1]), mediaType: 'application/pdf' }
    })
    const adapter = new UniversalLlmAdapter({
      ...mockSupervisor, acquireRequest: async () => release,
      getProxyClient: () => ({ streamResponse }),
    } as any, undefined, failure === 'missing' ? undefined : { readImageRequest } as any)
    await expect(async () => {
      for await (const _ of adapter.stream({
        provider: 'provider', model: 'vision', signal: controller.signal,
        messages: [{ role: 'user', content: [{ type: 'image', attachment: {
          attachmentId: 'stored', mediaType: 'image/png', bytes: 1, width: 1, height: 1,
        } }] }],
      })) {}
    }).rejects.toThrow()
    expect(streamResponse).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
  })

  it('serializes an image saved and prepared by the real Harness attachment store', async () => {
    const require = createRequire(import.meta.url)
    const dshRequire = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
    const { LocalAttachmentStore } = await import(pathToFileURL(dshRequire.resolve('@deepseek-ai/dsh-attachment-local')).href)
    const home = await mkdtemp(join(tmpdir(), 'harness-images-'))
    const ctx = new Context()
    try {
      const store = new LocalAttachmentStore(ctx, { dshHome: home })
      const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8zwACTGCSAQANHQEDgslx/wAAAABJRU5ErkJggg==', 'base64')
      const attachment = await store.saveImage({ data, mediaType: 'image/png' })
      const adapter = new UniversalLlmAdapter(mockSupervisor, undefined, store)
      const expected = await store.readImageRequest(attachment, adapter.imageRequestTarget('provider', 'vision', attachment))
      const body = await adapter.buildRequestBody({ provider: 'provider', model: 'vision', messages: [
        { role: 'user', content: [{ type: 'image', attachment }] },
      ] })
      const image = (body.input[0]!.content as any[])[0]
      expect(image.type).toBe('input_image')
      expect(image.image_url).toBe(`data:${expected.mediaType};base64,${Buffer.from(expected.data).toString('base64')}`)
    } finally {
      await ctx.fiber.dispose()
      await rm(home, { recursive: true, force: true })
    }
  })

  it('preserves text and multiple image order and exact request bytes', async () => {
    const data = new Uint8Array([0, 128, 255])
    const attachment = Object.freeze({ attachmentId: 'stored', mediaType: 'image/png', bytes: 3, width: 1, height: 1 })
    const adapter = new UniversalLlmAdapter(mockSupervisor, undefined, {
      readImageRequest: async () => ({ data, mediaType: 'image/jpeg' }),
    } as any)
    const content = Object.freeze([
      Object.freeze({ type: 'text', text: 'first' }), Object.freeze({ type: 'image', attachment }),
      Object.freeze({ type: 'text', text: 'second' }), Object.freeze({ type: 'image', attachment }),
    ])
    const body = await adapter.buildRequestBody({ provider: 'provider', model: 'vision', messages: [{ role: 'user', content }] })
    const sent = body.input[0]!.content as any[]
    expect(sent.map(block => block.type)).toEqual(['input_text', 'input_image', 'input_text', 'input_image'])
    expect(Buffer.from(sent[1].image_url.split(',')[1], 'base64')).toEqual(Buffer.from(data))
    expect(sent[1].image_url).toMatch(/^data:image\/jpeg;base64,/)
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
    expect(model.context?.contextWindow).toBe(200000)
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
