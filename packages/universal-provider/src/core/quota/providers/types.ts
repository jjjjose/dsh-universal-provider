import type { TNull, TOptional, TSchema, TUnion } from '@sinclair/typebox'
import type { AuthFileRaw } from '../../api/management-client.ts'
import { Type } from '@sinclair/typebox'

export function Nullable<T extends TSchema>(schema: T): TOptional<TUnion<[T, TNull]>> {
  return Type.Optional(Type.Union([schema, Type.Null()]))
}

export interface QuotaWindow {
  label: string
  remainingPercent?: number
  balance?: { amount: number, currency: string, suffix: 'left' | 'used' }
  key?: string
  resetsAt?: number
}

export interface QuotaReport {
  provider: 'codex' | 'antigravity' | 'claude' | 'grok' | 'kimi'
  windows: QuotaWindow[]
  models?: Record<string, { remainingPercent: number, resetsAt?: number }>
  account?: { authIndex: string, label: string }
  error?: string
}

export interface QuotaProvider {
  method: 'GET' | 'POST'
  url: string
  header: Record<string, string>
  body?: (entry: AuthFileRaw) => { data: string } | { error: string }
  apply: (report: QuotaReport, data: unknown) => void
  owners: string[]
  remaining: (report: QuotaReport, proxyModelId: string) => number | undefined
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

export function parseReset(value: string | number | null | undefined): number | undefined {
  if (value == null)
    return undefined
  const ms = typeof value === 'string' ? Date.parse(value) : value * 1000
  return Number.isNaN(ms) || ms <= Date.now() ? undefined : ms
}

export function percentOf(used: number | undefined, limit: number | undefined): number | undefined {
  return used === undefined || limit === undefined || limit <= 0 ? undefined : (used / limit) * 100
}

export function minRemaining(windows: readonly QuotaWindow[]): number | undefined {
  const percents = windows.map(window => window.remainingPercent).filter((percent): percent is number => percent !== undefined)
  return percents.length > 0 ? Math.min(...percents) : undefined
}
