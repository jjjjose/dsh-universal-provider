import { describe, expect, it } from 'vitest'
import { AssistantStreamAccumulator } from '@deepseek-ai/dsh-llm'
import { normalizeUsage } from '../src/host/usage.ts'

describe('usage normalization', () => {
  it.each([
    [{ input_tokens: 10, output_tokens: 2 }, { inputTokens: 10, outputTokens: 2, totalTokens: 12 }],
    [{ input_tokens: 10, output_tokens: 2, input_tokens_details: { cached_tokens: 0 } }, { inputTokens: 10, outputTokens: 2, totalTokens: 12, cacheReadTokens: 0 }],
    [{ prompt_tokens: 10, completion_tokens: 2, total_tokens: 15, prompt_tokens_details: { cached_tokens: 5 } }, { inputTokens: 10, outputTokens: 2, totalTokens: 15, cacheReadTokens: 5 }],
    [{ input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 }, { inputTokens: 35, outputTokens: 2, totalTokens: 37, cacheReadTokens: 20 }],
    [{ input_tokens: NaN, output_tokens: Infinity, total_tokens: -1 }, { inputTokens: 0, outputTokens: 0, totalTokens: 0 }],
  ])('normalizes usage and passes the durable stream validator (%j)', (raw, expected) => {
    const usage = normalizeUsage(raw)
    expect(usage).toEqual(expected)
    expect(() => new AssistantStreamAccumulator().push({ time: 1, chunk: { type: 'usage', usage } })).not.toThrow()
  })
})
