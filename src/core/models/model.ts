import type { Static } from '@sinclair/typebox'
import { Type } from '@sinclair/typebox'

export const ProxyModelListEntrySchema = Type.Object({
  id: Type.String(),
  owned_by: Type.Optional(Type.String()),
  context_length: Type.Optional(Type.Number()),
  max_completion_tokens: Type.Optional(Type.Number()),
}, { additionalProperties: true })

export type ProxyModelListEntry = Static<typeof ProxyModelListEntrySchema>

const SupportedReasoningLevelSchema = Type.Object({
  effort: Type.String(),
}, { additionalProperties: true })

export const ProxyModelMetadataSchema = Type.Object({
  slug: Type.String(),
  display_name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  context_window: Type.Optional(Type.Number()),
  max_context_window: Type.Optional(Type.Number()),
  visibility: Type.Optional(Type.String()),
  supported_in_api: Type.Optional(Type.Boolean()),
  input_modalities: Type.Optional(Type.Array(Type.String())),
  supports_parallel_tool_calls: Type.Optional(Type.Boolean()),
  supports_search_tool: Type.Optional(Type.Boolean()),
  web_search_tool_type: Type.Optional(Type.String()),
  supported_reasoning_levels: Type.Optional(Type.Array(SupportedReasoningLevelSchema)),
  default_reasoning_level: Type.Optional(Type.String()),
}, { additionalProperties: true })

export type ProxyModelMetadata = Static<typeof ProxyModelMetadataSchema>

export interface ProviderModel {
  id: string
  name: string
  description?: string
  proxyModelId: string
  proxyOwner: string
  maxInputTokens: number
  maxOutputTokens: number
  inputModalities: readonly string[]
  reasoningLevels: readonly string[]
  reasoningEffort?: string
  supportsParallelToolCalls: boolean
  supportsWebSearch: boolean
  serviceTier?: 'priority'
}
