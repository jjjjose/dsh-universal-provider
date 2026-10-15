import type { QuotaProvider, QuotaWindow } from './types.ts'
import { Type } from '@sinclair/typebox'
import { clamp, parseReset, percentOf } from './types.ts'
import { asValue } from '../../shared/json.ts'

const BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits'

const MetricSchema = Type.Object({
  val: Type.Optional(Type.Number()),
})

const BodySchema = Type.Object({
  config: Type.Optional(Type.Object({
    creditUsagePercent: Type.Optional(Type.Number()),
    currentPeriod: Type.Optional(Type.Object({
      end: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    })),
    productUsage: Type.Optional(Type.Array(Type.Object({
      usagePercent: Type.Optional(Type.Number()),
    }))),
    onDemandCap: Type.Optional(MetricSchema),
    onDemandUsed: Type.Optional(MetricSchema),
  })),
})

export const grokProvider: QuotaProvider = {
  method: 'GET',
  url: BILLING_URL,
  header: { Authorization: 'Bearer $TOKEN$', Accept: 'application/json' },
  apply: (report, data) => {
    report.windows = parseWindows(data)
  },
  owners: ['xai'],
  remaining: report => report.windows[0]?.remainingPercent,
}

function parseWindows(data: unknown): QuotaWindow[] {
  const config = asValue(BodySchema, data)?.config
  const productUsage = config?.productUsage?.reduce<number | undefined>(
    (sum, product) => product.usagePercent === undefined ? sum : (sum ?? 0) + product.usagePercent,
    undefined,
  )
  const percentUsed = config?.creditUsagePercent ?? productUsage
  if (percentUsed === undefined)
    return []
  const resetsAt = parseReset(config?.currentPeriod?.end)
  const onDemandUsed = percentOf(config?.onDemandUsed?.val, config?.onDemandCap?.val)
  return [
    window('Credits', percentUsed, resetsAt),
    ...(onDemandUsed === undefined ? [] : [window('On-Demand', onDemandUsed, resetsAt)]),
  ]
}

function window(label: string, usedPercent: number, resetsAt: number | undefined): QuotaWindow {
  return { label, remainingPercent: clamp(100 - usedPercent, 0, 100), ...(resetsAt === undefined ? {} : { resetsAt }) }
}
