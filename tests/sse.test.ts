import { describe, expect, it } from 'vitest'
import {
  streamKey,
  textPartBuffer,
  thinkingSectionEmitter,
  toolCallAssembler,
} from '../src/core/api/responses-stream.ts'

describe('SSE Responses Stream Assembler', () => {
  it('assembles text deltas and flushes remaining buffer', () => {
    const emitted: string[] = []
    const renderer = {
      marker: '\uE200',
      render: (text: string) => text,
    }
    const buffer = textPartBuffer(chunk => emitted.push(chunk), renderer)

    buffer.push('key-1', 'Hello ')
    buffer.push('key-1', 'world!')
    buffer.flush()

    expect(emitted.join('')).toBe('Hello world!')
  })

  it('assembles multi-part tool calls', () => {
    const toolCalls: Array<{ callId: string, name: string, input: object }> = []
    const assembler = toolCallAssembler((callId, name, input) => {
      toolCalls.push({ callId, name, input })
    })

    assembler.add('call-1', { call_id: 'call-1', name: 'search_files' })
    assembler.push('call-1', '{"query":')
    assembler.push('call-1', '"test"}')
    assembler.end('call-1', { call_id: 'call-1', name: 'search_files' })

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]).toEqual({
      callId: 'call-1',
      name: 'search_files',
      input: { query: 'test' },
    })
  })

  it('handles thinking sections and empty ending delimiters', () => {
    const emittedThinking: string[] = []
    const emitter = thinkingSectionEmitter(delta => emittedThinking.push(delta))

    emitter.push('Thinking step 1...')
    emitter.push(' Thinking step 2...')
    emitter.end()

    expect(emittedThinking).toEqual(['Thinking step 1...', ' Thinking step 2...', ''])
  })

  it('generates consistent stream keys', () => {
    expect(streamKey({ item_id: 'item-123' })).toBe('item-123')
    expect(streamKey({ item_id: 'item-123' }, undefined, 1)).toBe('item-123:1')
  })
})
