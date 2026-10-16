import type { ServerSupervisor } from './server.ts'
import type { CLIProxyClient, ProxyRequestBody } from '../core/api/proxy-client.ts'
import { matchCatalogModel } from '../core/models/catalog-match.ts'
import { fetchCatalog, type ModelCatalogs } from '../core/models/catalog.ts'
import { ProxyHttpError } from '../core/api/errors.ts'
import type { ModelView } from '../types.ts'

export interface ModelInfo extends ModelView {}

export interface ResolvedModelInfo extends ModelInfo {
  context?: { contextWindow: number }
  defaultMaxTokens?: number
  reasoning?: {
    efforts: readonly { id: string; name: string; description?: string }[]
    defaultEffort?: string
  }
}

export class UniversalLlmAdapter {
  private catalogs?: ModelCatalogs

  constructor(private readonly supervisor: ServerSupervisor) {}

  providerInfo(provider: string) {
    return {
      id: provider,
      name: 'Universal Provider',
    }
  }

  providerRetryPolicy(_provider: string) {
    return undefined
  }

  imageRequestPricing(_provider: string, _model: string) {
    return undefined
  }

  defaultFallbackModels(_provider: string): ModelInfo[] {
    return []
  }

  async listModels(provider: string, signal?: AbortSignal): Promise<readonly ModelInfo[]> {
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

    return discovery.available.map((entry) => {
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
        name,
        ...(description !== undefined ? { description } : {}),
        inputModalities: modalities,
      }
    })
  }

  async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<ResolvedModelInfo> {
    let contextWindow = 128000
    let maxOutputTokens = 4096
    let modalities: ('text' | 'image')[] = ['text']
    let reasoningEfforts: { id: string; name: string }[] | undefined

    try {
      await this.supervisor.ensureRunning(signal)
      const client = this.supervisor.getProxyClient()

      if (client) {
        const discovery = await client.discover(signal)
        const metadata = discovery.metadata.find(m => m.slug === model)
        const entry = discovery.available.find(m => m.id === model)

        if (entry?.context_length) contextWindow = entry.context_length
        if (metadata?.context_window) contextWindow = metadata.context_window
        if (entry?.max_completion_tokens) maxOutputTokens = entry.max_completion_tokens

        if (metadata?.supported_reasoning_levels && metadata.supported_reasoning_levels.length > 0) {
          reasoningEfforts = metadata.supported_reasoning_levels.map(l => ({
            id: l.effort,
            name: l.effort.charAt(0).toUpperCase() + l.effort.slice(1),
          }))
        }

        if (metadata?.input_modalities?.includes('image')) {
          modalities.push('image')
        }
      }
    } catch {}

    return {
      provider,
      id: model,
      name: model === 'universal-chat' ? 'Universal Chat (Auto)' : model,
      inputModalities: modalities,
      context: { contextWindow },
      defaultMaxTokens: maxOutputTokens,
      ...(reasoningEfforts ? {
        reasoning: {
          efforts: reasoningEfforts,
          ...(reasoningEfforts[0] !== undefined ? { defaultEffort: reasoningEfforts[0].id } : {}),
        },
      } : {}),
    }
  }

  async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const resolved = await this.resolveModel(provider, model, signal)
    return {
      model: resolved,
      stream: (options: any) => this.stream(options),
    }
  }

  async *stream(options: any): AsyncIterable<any> {
    const release = await this.supervisor.acquireRequest()
    try {
      let client: CLIProxyClient | undefined
      try {
        await this.supervisor.ensureRunning(options.signal)
        client = this.supervisor.getProxyClient()
      } catch (e: any) {
        // Safe mock fallback when server is not configured yet
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield {
          type: 'text-delta',
          index: 0,
          text: `[Universal Provider] Servidor CLIProxyAPI en preparación o no disponible (${e?.message || 'sin iniciar'}). Abre Settings -> Universal Provider para configurar una cuenta OAuth o endpoint.`,
        }
        yield {
          type: 'block-end',
          index: 0,
          block: {
            type: 'text',
            text: `[Universal Provider] Servidor CLIProxyAPI en preparación o no disponible (${e?.message || 'sin iniciar'}). Abre Settings -> Universal Provider para configurar una cuenta OAuth o endpoint.`,
          },
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      }

      if (!client) throw new Error('CLIProxyAPI client unavailable')

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
              message: streamError.message,
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
          usage: {
            inputTokens: capturedUsage.prompt_tokens ?? capturedUsage.input_tokens ?? 0,
            outputTokens: capturedUsage.completion_tokens ?? capturedUsage.output_tokens ?? 0,
            totalTokens: capturedUsage.total_tokens ?? 0,
            cacheReadTokens: capturedUsage.prompt_tokens_details?.cached_tokens,
          },
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
