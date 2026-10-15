import type { QuotaProvider, QuotaReport } from './types.ts'
import { antigravityProvider } from './antigravity.ts'
import { claudeProvider } from './claude.ts'
import { codexProvider } from './codex.ts'
import { grokProvider } from './grok.ts'
import { kimiProvider } from './kimi.ts'

export const QUOTA_PROVIDERS = {
  codex: codexProvider,
  antigravity: antigravityProvider,
  claude: claudeProvider,
  grok: grokProvider,
  kimi: kimiProvider,
} satisfies Record<QuotaReport['provider'], QuotaProvider>

export function isQuotaProvider(value: string): value is QuotaReport['provider'] {
  return Object.hasOwn(QUOTA_PROVIDERS, value)
}
