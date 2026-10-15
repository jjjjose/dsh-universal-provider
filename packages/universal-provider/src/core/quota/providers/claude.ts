import type { QuotaProvider, QuotaWindow } from './types.ts'
import { Type } from '@sinclair/typebox'
import { clamp, minRemaining, Nullable, parseReset } from './types.ts'
import { asValue } from '../../shared/json.ts'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const SEVEN_DAY_FAMILY = /^seven_day_(.+)$/

const WindowSchema = Type.Object({
  utilization: Nullable(Type.Number()),
  resets_at: Nullable(Type.Union([Type.String(), Type.Number()])),
  is_enabled: Type.Optional(Type.Boolean()),
  used_credits: Type.Optional(Type.Number()),
  monthly_limit: Nullable(Type.Number()),
  currency: Type.Optional(Type.String()),
  decimal_places: Type.Optional(Type.Number()),
})

const WindowValueSchema = Type.Union([WindowSchema, Type.Null()])

const BodySchema = Type.Object({
  extra_usage: Type.Optional(WindowValueSchema),
  limits: Nullable(Type.Array(Type.Unknown())),
}, { additionalProperties: true })

export const claudeProvider: QuotaProvider = {
  method: 'GET',
  url: USAGE_URL,
  header: { 'Authorization': 'Bearer $TOKEN$', 'Accept': 'application/json', 'anthropic-beta': 'oauth-2025-04-20' },
  apply: (report, data) => {
    report.windows = parseWindows(data)
  },
  owners: ['anthropic'],
  remaining: (report, proxyModelId) => {
    const id = proxyModelId.toLowerCase()
    return minRemaining(report.windows.filter((window) => {
      if (window.key === 'extra_usage')
        return false
      const family = sevenDayFamily(window.key)
      return family === undefined || id.includes(family)
    }))
  },
}

function sevenDayFamily(key: string | undefined): string | undefined {
  return SEVEN_DAY_FAMILY.exec(key ?? '')?.[1]
}

function parseWindows(data: unknown): QuotaWindow[] {
  const body = asValue(BodySchema, data)
  if (body === undefined)
    return []
  const windows: QuotaWindow[] = []
  for (const [key, rawValue] of Object.entries(body)) {
    const label = windowLabel(key)
    if (label === undefined)
      continue
    const raw = asValue(WindowValueSchema, rawValue)
    if (raw == null)
      continue
    const used = raw.utilization
    const resetsAt = parseReset(raw.resets_at)
    windows.push({ key, label, ...(used == null ? {} : { remainingPercent: clamp(100 - used, 0, 100) }), ...(resetsAt === undefined ? {} : { resetsAt }) })
  }
  return windows
}

function windowLabel(key: string): string | undefined {
  if (key === 'five_hour')
    return '5h Quota'
  if (key === 'seven_day')
    return '7d Quota'
  if (key === 'extra_usage')
    return 'Extra Usage'
  const family = sevenDayFamily(key)
  if (family !== undefined)
    return `7d ${family.charAt(0).toUpperCase() + family.slice(1)}`
  return undefined
}
