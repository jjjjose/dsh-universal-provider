export interface ModelView {
  provider: string
  id: string
  name: string
  contextWindow?: number
  contextOptions?: readonly { value: number; label: string }[]
  description?: string
  inputModalities?: readonly ('text' | 'image')[]
}

export interface PingResult {
  readonly message: string
  readonly timestamp: number
}

export interface ProviderStatus {
  readonly status: string
  readonly version: string
  readonly mode: 'managed' | 'external'
  readonly port?: number
  readonly activeRequests: number
  readonly baseUrl: string
}

export interface AccountView {
  readonly name: string
  readonly type?: string
  readonly provider?: string
  readonly email?: string
  readonly label?: string
}

export interface OAuthStartResult {
  readonly url: string
  readonly state: string
  readonly userCode?: string
}

export interface OAuthPollResult {
  readonly status: 'wait' | 'ok' | 'error'
  readonly error?: string
}

export interface EndpointModelView {
  readonly name: string
  readonly alias?: string
}

export interface EndpointView {
  readonly name: string
  readonly baseUrl: string
  readonly apiKey?: string
  readonly models?: readonly EndpointModelView[]
}

export interface QuotaWindowView {
  readonly label: string
  readonly remainingPercent?: number
  readonly balance?: { amount: number; currency: string; suffix: 'left' | 'used' }
  readonly resetsAt?: number
}

export interface QuotaReportView {
  readonly provider: string
  readonly windows: readonly QuotaWindowView[]
  readonly models?: Record<string, { remainingPercent: number; resetsAt?: number }>
  readonly account?: { authIndex: string; label: string }
  readonly error?: string
}

export interface CommitDraftResult {
  readonly hasStagedChanges: boolean
  readonly message?: string
  readonly draft?: string
}
