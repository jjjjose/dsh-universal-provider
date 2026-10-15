import type { AuthFileRaw, ManagementClient } from '../api/management-client.ts'
import type { QuotaProvider, QuotaReport } from './providers/types.ts'
import { isQuotaProvider, QUOTA_PROVIDERS } from './providers/index.ts'
import { parseReset } from './providers/types.ts'
import { errorMessage } from '../shared/errors.ts'
import { asJsonValue } from '../shared/json.ts'
import { Type } from '@sinclair/typebox'

export type { QuotaReport, QuotaWindow } from './providers/types.ts'

const ObjectSchema = Type.Object({}, { additionalProperties: true })

export function quotaProviderForModel(model: { proxyOwner: string }): QuotaReport['provider'] | undefined {
  const owner = model.proxyOwner.toLowerCase()
  return (Object.keys(QUOTA_PROVIDERS) as Array<QuotaReport['provider']>)
    .find(name => QUOTA_PROVIDERS[name].owners.includes(owner))
}

export async function fetchQuotas(
  client: ManagementClient,
  signal?: AbortSignal,
  backoff: Map<string, number> = new Map(),
  providerFilter?: QuotaReport['provider'],
): Promise<QuotaReport[]> {
  const files = await client.listAuthFilesRaw(signal)
  const tasks = files.flatMap((entry) => {
    const raw = (entry.provider ?? entry.type ?? '').trim().toLowerCase()
    const provider = raw === 'xai' ? 'grok' : raw
    if (!isQuotaProvider(provider) || (providerFilter !== undefined && provider !== providerFilter))
      return []
    if ((backoff.get(entry.auth_index?.trim() ?? '') ?? 0) > Date.now()) {
      const account = accountOf(entry)
      return [Promise.resolve<QuotaReport>({ provider, windows: [], ...(account === undefined ? {} : { account }) })]
    }
    return [fetchProviderQuota(provider, QUOTA_PROVIDERS[provider], client, entry, signal, backoff)]
  })
  return Promise.all(tasks)
}

export function formatPercent(value?: number): string {
  return value === undefined ? '?' : `${Math.round(value)}%`
}

export function formatResetCountdown(resetsAt: number | undefined): string | undefined {
  const delta = (resetsAt ?? 0) - Date.now()
  if (delta <= 0)
    return undefined
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1)
    return 'soon'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0)
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  return `${mins}m`
}

export function remainingForModel(reports: QuotaReport[], model: { proxyOwner: string, proxyModelId: string }): number | undefined {
  const name = quotaProviderForModel(model)
  if (name === undefined)
    return undefined
  const provider = QUOTA_PROVIDERS[name]
  const remaining = reports
    .filter(report => report.provider === name && report.error === undefined)
    .map(report => provider.remaining(report, model.proxyModelId))
    .filter((percent): percent is number => percent !== undefined)
  return remaining.length > 0 ? Math.max(...remaining) : undefined
}

async function fetchProviderQuota(
  provider: QuotaReport['provider'],
  source: QuotaProvider,
  client: ManagementClient,
  entry: AuthFileRaw,
  signal: AbortSignal | undefined,
  backoff: Map<string, number>,
): Promise<QuotaReport> {
  const account = accountOf(entry)
  const report: QuotaReport = { provider, windows: [], ...(account === undefined ? {} : { account }) }
  const authIndex = entry.auth_index?.trim() ?? ''
  if (authIndex === '')
    return { ...report, error: 'missing auth_index' }
  const requestBody = source.body?.(entry)
  if (requestBody !== undefined && 'error' in requestBody)
    return { ...report, error: requestBody.error }
  try {
    const { statusCode, header, body } = await client.apiCall({
      auth_index: authIndex,
      method: source.method,
      url: source.url,
      header: source.header,
      ...requestBody,
    }, signal)
    const retryAfter = parseRetryAfter(header, statusCode)
    if (retryAfter === undefined)
      backoff.delete(authIndex)
    else
      backoff.set(authIndex, retryAfter)
    if (statusCode < 200 || statusCode >= 300)
      return { ...report, error: `HTTP ${statusCode} from ${source.url} — ${describeBody(body)}` }
    const data = asJsonValue(ObjectSchema, body)
    if (data === undefined)
      return { ...report, error: `invalid quota payload from ${source.url} — ${describeBody(body)}` }
    source.apply(report, data)
    return report
  }
  catch (error) {
    return { ...report, error: errorMessage(error) }
  }
}

function accountOf(entry: AuthFileRaw): { authIndex: string, label: string } | undefined {
  const authIndex = entry.auth_index?.trim() ?? ''
  if (authIndex === '')
    return undefined
  const label = (entry.label || entry.email || entry.name || authIndex).trim()
  return { authIndex, label }
}

function parseRetryAfter(header: Record<string, string[]>, statusCode: number): number | undefined {
  if (statusCode !== 429)
    return undefined
  const raw = header['retry-after']?.[0] ?? header['Retry-After']?.[0]
  if (raw === undefined)
    return Date.now() + 300_000
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? Date.now() + seconds * 1000 : parseReset(raw) ?? Date.now() + 300_000
}

function describeBody(body: unknown): string {
  if (typeof body === 'string')
    return body.slice(0, 200)
  try {
    return JSON.stringify(body).slice(0, 200)
  }
  catch {
    return String(body).slice(0, 200)
  }
}
