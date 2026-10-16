import type { ServerSupervisor } from './server.ts'
import { DEFAULT_MODEL_CONTEXT, ModelContextSettings } from './model-context.ts'
import { normalizeUsage } from './usage.ts'
import type { ProxyRequestBody } from '../core/api/proxy-client.ts'
import { matchCatalogModel } from '../core/models/catalog-match.ts'
import { fetchCatalog, type ModelCatalogs } from '../core/models/catalog.ts'
import { ProxyHttpError } from '../core/api/errors.ts'
import type { ModelView } from '../types.ts'
import { LlmAdapter, LlmError, type LlmModelInfo, type LlmResolvedModelInfo, type GenerateOptions, type ReasoningEffortId } from '@deepseek-ai/dsh-llm'

export interface ModelInfo extends ModelView, LlmModelInfo {}

export class UniversalLlmAdapter extends LlmAdapter {
  private catalogs?: ModelCatalogs
  private publishedCatalog = ''
  onModelsChanged: (() => void) | undefined

  constructor(private readonly supervisor: ServerSupervisor, readonly contextSettings = new ModelContextSettings()) { super() }

  async setModelContext(model: string, contextWindow: number): Promise<void> {
    await this.contextSettings.set(model, contextWindow)
    this.onModelsChanged?.()
  }

  override providerInfo(provider: string) {
    return {
      id: provider,
      name: 'Universal Provider',
    }
  }

  override providerRetryPolicy(_provider: string) {
    return undefined
  }

  override imageRequestPricing(_provider: string, _model: string) {
    return undefined
  }

  defaultFallbackModels(_provider: string): ModelInfo[] {
    return []
  }

  override async listModels(provider: string, signal?: AbortSignal): Promise<readonly ModelInfo[]> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const client = this.supervisor.getProxyClient()
    if (!client) {
      throw new Error('No está disponible el cliente de modelos de CLIProxyAPI.')
    }

    const discovery = await client.discover(signal)
    if (!this.catalogs && discovery.available.length) {
      try {
        this.catalogs = await fetchCatalog()
      } catch {}
    }
    signal?.throwIfAborted()

    const contexts = await this.contextSettings.all()
    const models = discovery.available.map((entry) => {
      const metadata = discovery.metadata.find(m => m.slug === entry.id)
      const catalogMatch = this.catalogs ? matchCatalogModel(entry.id, this.catalogs.router) : undefined

      const name = metadata?.display_name || catalogMatch?.display_name || entry.id
      const description = metadata?.description || catalogMatch?.description
      const modalities: ('text' | 'image')[] = ['text']
      if (metadata?.input_modalities?.includes('image') || catalogMatch?.supportedInputModalities?.includes('image')) {
        modalities.push('image')
      }

      return {
        provider,
        id: entry.id,
        contextWindow: Object.hasOwn(contexts, entry.id) ? contexts[entry.id]! : DEFAULT_MODEL_CONTEXT,
        name,
        ...(description !== undefined ? { description } : {}),
        inputModalities: modalities,
      }
    })
    const fingerprint = JSON.stringify({ models, metadata: discovery.metadata })
    if (fingerprint !== this.publishedCatalog) {
      this.publishedCatalog = fingerprint
      this.onModelsChanged?.()
    }
    return models
  }

  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    let maxOutputTokens = 4096
    let modalities: ('text' | 'image')[] = ['text']
    let reasoningEfforts: { id: ReasoningEffortId; name: string }[] | undefined
    let defaultEffort: ReasoningEffortId | undefined

    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const client = this.supervisor.getProxyClient()
    if (!client) throw new LlmError('CLIProxyAPI client unavailable', 'PROVIDER_UNAVAILABLE')

    const discovery = await client.discover(signal)
    const metadata = discovery.metadata.find(m => m.slug === model)
    const entry = discovery.available.find(m => m.id === model)
    if (!entry) throw new LlmError(`El modelo ${model} ya no está disponible. Actualiza el catálogo.`, 'MODEL_UNAVAILABLE')

    const contextWindow = await this.contextSettings.get(model)
    if (entry.max_completion_tokens) maxOutputTokens = entry.max_completion_tokens

    if (metadata?.supported_reasoning_levels?.length) {
      reasoningEfforts = [...new Set(metadata.supported_reasoning_levels.map(l => l.effort).filter(Boolean))].map(effort => ({
        id: effort as ReasoningEffortId,
        name: effort.charAt(0).toUpperCase() + effort.slice(1),
      }))
      if (reasoningEfforts.some(e => e.id === metadata.default_reasoning_level)) {
        defaultEffort = metadata.default_reasoning_level as ReasoningEffortId
      }
    }

    if (metadata?.input_modalities?.includes('image')) modalities.push('image')
    signal?.throwIfAborted()

    return {
      provider,
      id: model,
      name: model === 'universal-chat' ? 'Universal Chat (Auto)' : model,
      inputModalities: modalities,
      context: { contextWindow },
      defaultMaxTokens: maxOutputTokens,
      ...(reasoningEfforts?.length ? {
        reasoning: {
          efforts: reasoningEfforts,
          ...(defaultEffort !== undefined ? { defaultEffort } : {}),
        },
      } : {}),
    }
  }

  override async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const resolved = await this.resolveModel(provider, model, signal)
    return {
      model: resolved,
      stream: (options: GenerateOptions) => this.stream(options),
    }
  }

  async *stream(options: any): AsyncIterable<any> {
    const release = await this.supervisor.acquireRequest()
    try {
      await this.supervisor.ensureRunning(options.signal)
      const client = this.supervisor.getProxyClient()
      if (!client) throw new LlmError('CLIProxyAPI client unavailable', 'PROVIDER_UNAVAILABLE')

      const body = this.buildRequestBody(options)

      let nextIndex = 0
      let textIndex: number | undefined
      let textAccumulated = ''

      let reasoningIndex: number | undefined
      let reasoningAccumulated = ''

      const toolCalls = new Map<string, { index: number; id: string; name: string; arguments: string }>()

      let capturedUsage: any
      let streamError: any

      // Bridge SSE callbacks into queue
      const queue: any[] = []
      let notify: (() => void) | undefined

      const pushItem = (item: any) => {
        queue.push(item)
        notify?.()
      }

      const streamPromise = client.streamResponse(body, {
        onText: (delta) => {
          if (textIndex === undefined) {
            textIndex = nextIndex++
            pushItem({ type: 'block-start', index: textIndex, blockType: 'text' })
          }
          textAccumulated += delta
          pushItem({ type: 'text-delta', index: textIndex, text: delta })
        },
        onThinking: (delta) => {
          if (!delta) return
          if (reasoningIndex === undefined) {
            reasoningIndex = nextIndex++
            pushItem({ type: 'block-start', index: reasoningIndex, blockType: 'reasoning' })
          }
          reasoningAccumulated += delta
          pushItem({ type: 'reasoning-delta', index: reasoningIndex, text: delta })
        },
        onToolCall: (callId, name, input) => {
          const index = nextIndex++
          const args = JSON.stringify(input)
          toolCalls.set(callId, { index, id: callId, name, arguments: args })
          pushItem({ type: 'block-start', index, blockType: 'tool-call' })
          pushItem({ type: 'tool-call-delta', index, id: callId, name, argumentsDelta: args })
          pushItem({ type: 'block-end', index, block: { type: 'tool-call', id: callId, name, arguments: args } })
        },
        onUsage: (usage) => {
          capturedUsage = usage
        },
      }, options.signal).catch((err) => {
        streamError = err
      })

      // Yield chunks as they arrive
      while (true) {
        if (options.signal?.aborted) {
          yield {
            type: 'finish',
            reason: {
              kind: 'aborted',
              failure: { code: 'CANCELLED', message: 'Stream aborted by caller' },
            },
          }
          return
        }

        while (queue.length > 0) {
          yield queue.shift()
        }

        const isDone = await Promise.race([
          streamPromise.then(() => true),
          new Promise<boolean>((resolve) => {
            notify = () => resolve(false)
          }),
        ])

        while (queue.length > 0) {
          yield queue.shift()
        }

        if (isDone) break
      }

      if (streamError) {
        const status = streamError instanceof ProxyHttpError ? streamError.status : undefined
        yield {
          type: 'finish',
          reason: {
            kind: 'error',
            failure: {
              code: streamError.name || 'STREAM_ERROR',
               message: streamError instanceof Error ? streamError.message : String(streamError),
              ...(status ? { status } : {}),
            },
          },
        }
        return
      }

      // Close open text block
      if (textIndex !== undefined) {
        yield {
          type: 'block-end',
          index: textIndex,
          block: { type: 'text', text: textAccumulated },
        }
      }

      // Close open reasoning block
      if (reasoningIndex !== undefined) {
        yield {
          type: 'block-end',
          index: reasoningIndex,
          block: { type: 'reasoning', text: reasoningAccumulated },
        }
      }

      // Emit usage if reported
      if (capturedUsage) {
        yield {
          type: 'usage',
          usage: normalizeUsage(capturedUsage),
        }
      }

      // Finish chunk
      const hasTools = toolCalls.size > 0
      yield {
        type: 'finish',
        reason: { kind: hasTools ? 'tool-calls' : 'stop' },
      }
    } finally {
      release()
    }
  }

  buildRequestBody(options: any): ProxyRequestBody {
    const input: Record<string, unknown>[] = []

    for (const msg of options.messages ?? []) {
      const role = msg.role
      if (role === 'system' || role === 'developer') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c: any) => c.text || '').join('\n')
            : ''
        input.push({ role, content: [{ type: 'input_text', text }] })
      } else if (role === 'user') {
        const contents: any[] = []
        if (typeof msg.content === 'string') {
          contents.push({ type: 'input_text', text: msg.content })
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') {
              contents.push({ type: 'input_text', text: block.text })
            } else if (block.type === 'image' && block.attachment) {
              const mime = block.attachment.mediaType || 'image/png'
              contents.push({
                type: 'input_image',
                image_url: `data:${mime};base64,${block.attachment.base64 || ''}`,
              })
            }
          }
        }
        input.push({ role: 'user', content: contents })
      } else if (role === 'assistant') {
        const contents: any[] = []
        if (typeof msg.content === 'string') {
          contents.push({ type: 'output_text', text: msg.content })
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') {
              contents.push({ type: 'output_text', text: block.text })
            } else if (block.type === 'tool-call') {
              input.push({
                type: 'function_call',
                call_id: block.id,
                name: block.name,
                arguments: block.arguments,
              })
            }
          }
        }
        if (contents.length > 0) {
          input.push({ role: 'assistant', content: contents })
        }
      } else if (role === 'tool') {
        const output = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c: any) => c.text || '').join('\n')
            : JSON.stringify(msg.content)
        input.push({
          type: 'function_call_output',
          call_id: msg.toolCallId,
          output,
        })
      }
    }

    const tools = (options.tools ?? []).map((t: any) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {} },
      strict: false,
    }))

    const body: ProxyRequestBody = {
      model: options.model,
      input,
      stream: true,
      max_output_tokens: options.maxTokens ?? 4096,
      ...(options.reasoningEffort ? {
        reasoning: { effort: options.reasoningEffort, summary: 'detailed' },
      } : {}),
      ...(tools.length > 0 ? {
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: true,
      } : {}),
    }

    return body
  }
}
