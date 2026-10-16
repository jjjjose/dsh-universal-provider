function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function tokens(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
}

export function normalizeUsage(value: unknown) {
  const usage = record(value)
  const cacheReadTokens = tokens(usage.cache_read_input_tokens,
    record(usage.input_tokens_details).cached_tokens,
    record(usage.prompt_tokens_details).cached_tokens)
  const cacheWriteTokens = tokens(usage.cache_creation_input_tokens)
  const anthropic = usage.cache_read_input_tokens !== undefined || usage.cache_creation_input_tokens !== undefined
  const inputTokens = (tokens(usage.input_tokens, usage.prompt_tokens) ?? 0)
    + (anthropic ? (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0) : 0)
  const outputTokens = tokens(usage.output_tokens, usage.completion_tokens) ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: tokens(usage.total_tokens) ?? inputTokens + outputTokens,
    ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
  }
}
