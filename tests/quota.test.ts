import { describe, expect, it } from 'vitest'
import {
  formatPercent,
  formatResetCountdown,
  remainingForModel,
  type QuotaReport,
} from '../src/core/quota/quota.ts'

describe('Quota Helpers and Providers', () => {
  it('formats percentages correctly', () => {
    expect(formatPercent(95.4)).toBe('95%')
    expect(formatPercent(100)).toBe('100%')
    expect(formatPercent(undefined)).toBe('?')
  })

  it('formats reset countdowns correctly', () => {
    expect(formatResetCountdown(undefined)).toBeUndefined()
    expect(formatResetCountdown(Date.now() - 1000)).toBeUndefined()

    const in30Mins = Date.now() + 30 * 60 * 1000
    expect(formatResetCountdown(in30Mins)).toBe('30m')

    const in2Hours = Date.now() + (2 * 60 + 15) * 60 * 1000
    expect(formatResetCountdown(in2Hours)).toBe('2h 15m')

    const in3Days = Date.now() + (3 * 24 + 4) * 60 * 60 * 1000
    expect(formatResetCountdown(in3Days)).toBe('3d 4h')
  })

  it('determines remaining percentage for supported models', () => {
    const reports: QuotaReport[] = [
      {
        provider: 'codex',
        windows: [
          { label: '5h Quota', remainingPercent: 80 },
          { label: '7d Quota', remainingPercent: 65 },
        ],
      },
      {
        provider: 'antigravity',
        windows: [],
        models: {
          'gemini-2.5-pro': { remainingPercent: 90 },
        },
      },
    ]

    expect(remainingForModel(reports, { proxyOwner: 'openai', proxyModelId: 'gpt-4o' })).toBe(65)
    expect(remainingForModel(reports, { proxyOwner: 'antigravity', proxyModelId: 'gemini-2.5-pro' })).toBe(90)
    expect(remainingForModel(reports, { proxyOwner: 'unknown', proxyModelId: 'some-model' })).toBeUndefined()
  })
})
