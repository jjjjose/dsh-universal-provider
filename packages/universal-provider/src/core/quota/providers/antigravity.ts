import type { QuotaProvider, QuotaReport } from './types.ts'
import { Type } from '@sinclair/typebox'
import { clamp, parseReset } from './types.ts'
import { asValue } from '../../shared/json.ts'

const MODELS_URL = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'

const ModelSchema = Type.Object({
  quotaInfo: Type.Optional(Type.Object({
    remainingFraction: Type.Optional(Type.Number()),
    resetTime: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  })),
})

const BodySchema = Type.Object({
  models: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export const antigravityProvider: QuotaProvider = {
  method: 'POST',
  url: MODELS_URL,
  header: { 'Authorization': 'Bearer $TOKEN$', 'Content-Type': 'application/json', 'User-Agent': 'antigravity/1.11.5 windows/amd64' },
  body: (entry) => {
    const projectId = entry.project_id?.trim() ?? ''
    return projectId === '' ? { error: 'missing project_id' } : { data: JSON.stringify({ project: projectId }) }
  },
  apply: (report, data) => {
    report.models = parseModels(data)
  },
  owners: ['antigravity'],
  remaining: (report, proxyModelId) => report.models?.[proxyModelId]?.remainingPercent,
}

function parseModels(data: unknown): NonNullable<QuotaReport['models']> {
  const models = asValue(BodySchema, data)?.models
  if (models === undefined)
    return {}
  const out: NonNullable<QuotaReport['models']> = {}
  for (const [id, rawValue] of Object.entries(models)) {
    const quotaInfo = asValue(ModelSchema, rawValue)?.quotaInfo
    if (quotaInfo?.remainingFraction === undefined)
      continue
    const resetsAt = parseReset(quotaInfo.resetTime)
    out[id] = { remainingPercent: clamp(quotaInfo.remainingFraction * 100, 0, 100), ...(resetsAt === undefined ? {} : { resetsAt }) }
  }
  return out
}
