import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type {
  PingResult,
  ProviderStatus,
  AccountView,
  OAuthStartResult,
  OAuthPollResult,
  EndpointView,
  QuotaReportView,
  CommitDraftResult,
} from './types.ts'
import { resolveProviderPaths, type ProviderPaths } from './host/paths.ts'
import { Config, type ProviderConfig } from './host/config.ts'
import { ServerSupervisor } from './host/server.ts'
import { UniversalLlmAdapter } from './host/adapter.ts'
import {
  generateCommitDraft,
  configureAuxiliaryTitles,
  configureAuxiliaryCompaction,
} from './host/auxiliary.ts'
import { fetchQuotas } from './core/quota/quota.ts'
import type { OpenAICompatibilityProvider } from './core/api/management-client.ts'

export * from './types.ts'
export { Config }

declare module '@deepseek-ai/cordis' {
  interface Context {
    universalProvider: UniversalProviderService
  }
}

export class UniversalProviderService extends TypertRemoteService {
  constructor(
    ctx: Context,
    private readonly supervisor: ServerSupervisor,
    private readonly paths: ProviderPaths,
    private readonly config: ProviderConfig,
  ) {
    super(ctx, 'universalProvider')
  }

  @Remote
  async ping(signal?: AbortSignal): Promise<PingResult> {
    signal?.throwIfAborted()
    return {
      message: 'pong',
      timestamp: Date.now(),
    }
  }

  @Remote
  async getState(signal?: AbortSignal): Promise<ProviderStatus> {
    signal?.throwIfAborted()
    try {
      const running = await this.supervisor.ensureRunning(signal)
      return {
        status: 'ready',
        version: running.version || 'unknown',
        mode: running.mode,
        port: running.port,
        activeRequests: this.supervisor.getActiveRequests(),
        baseUrl: running.baseUrl,
      }
    } catch {
      return {
        status: 'error',
        version: 'unknown',
        mode: this.config.serverMode,
        activeRequests: this.supervisor.getActiveRequests(),
        baseUrl: this.config.serverMode === 'external' ? this.config.externalUrl : '',
      }
    }
  }

  @Remote
  async listAccounts(signal?: AbortSignal): Promise<AccountView[]> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    const raw = await mgmt.listAuthFilesRaw(signal)
    return raw.map(file => ({
      name: file.name || file.auth_index || 'unknown',
      type: file.type,
      provider: file.provider,
      email: file.email,
      label: file.label,
    }))
  }

  @Remote
  async startOAuth(provider: string, signal?: AbortSignal): Promise<OAuthStartResult> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    return await mgmt.requestAuthUrl(provider, signal)
  }

  @Remote
  async pollOAuth(state: string, signal?: AbortSignal): Promise<OAuthPollResult> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    return await mgmt.getAuthStatus(state, signal)
  }

  @Remote
  async cancelOAuth(state: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    await mgmt.cancelAuthSession(state, signal)
    return true
  }

  @Remote
  async deleteAccount(name: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    await mgmt.deleteAuthFile(name, signal)
    return true
  }

  @Remote
  async listEndpoints(signal?: AbortSignal): Promise<EndpointView[]> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    const providers = await mgmt.listOpenAICompatibility(signal)
    return providers.map(p => ({
      name: p.name,
      baseUrl: p['base-url'],
      models: p.models?.map(m => ({ name: m.name, alias: m.alias })),
    }))
  }

  @Remote
  async saveEndpoint(endpoint: EndpointView, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    const current = await mgmt.listOpenAICompatibility(signal)
    const existingIndex = current.findIndex(p => p.name === endpoint.name)

    const updatedProvider: OpenAICompatibilityProvider = {
      name: endpoint.name,
      'base-url': endpoint.baseUrl,
      ...(endpoint.apiKey ? { keys: [{ 'api-key': endpoint.apiKey }] } : {}),
      ...(endpoint.models ? { models: endpoint.models.map(m => ({ name: m.name, alias: m.alias })) } : {}),
    }

    if (existingIndex >= 0) {
      current[existingIndex] = updatedProvider
    } else {
      current.push(updatedProvider)
    }

    await mgmt.putOpenAICompatibility(current, signal)
    return true
  }

  @Remote
  async getQuotas(signal?: AbortSignal): Promise<QuotaReportView[]> {
    signal?.throwIfAborted()
    await this.supervisor.ensureRunning(signal)
    const mgmt = this.supervisor.getManagementClient()
    if (!mgmt) throw new Error('Management client unavailable')

    const reports = await fetchQuotas(mgmt, signal)
    return reports.map(r => ({
      provider: r.provider,
      windows: r.windows.map(w => ({
        label: w.label,
        remainingPercent: w.remainingPercent,
        balance: w.balance,
        resetsAt: w.resetsAt,
      })),
      account: r.account,
      error: r.error,
    }))
  }

  @Remote
  async getRecentLogs(signal?: AbortSignal): Promise<string[]> {
    signal?.throwIfAborted()
    if (!existsSync(this.paths.logPath)) {
      return ['No log file generated yet.']
    }

    try {
      const content = await readFile(this.paths.logPath, 'utf8')
      const lines = content.split('\n').filter(Boolean).slice(-100)
      return lines.map(line =>
        line
          .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
          .replace(/sk-[A-Za-z0-9_-]+/gi, 'sk-[REDACTED]')
          .replace(/secret-key:\s*["']?[^"'\n]+["']?/gi, 'secret-key: "[REDACTED]"'),
      )
    } catch {
      return ['Could not read server log.']
    }
  }

  @Remote
  async generateCommitDraft(options: { cwd: string; model?: string }, signal?: AbortSignal): Promise<CommitDraftResult> {
    signal?.throwIfAborted()
    return await generateCommitDraft(this.ctx, options.cwd, options.model, signal)
  }

  @Remote
  async configureTitles(model: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted()
    await configureAuxiliaryTitles(this.ctx, model)
    return true
  }

  @Remote
  async configureCompaction(model: string, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted()
    await configureAuxiliaryCompaction(this.ctx, model)
    return true
  }
}

export const inject = ['llm']

export function apply(ctx: Context, config: ProviderConfig) {
  const profileId = (ctx.fiber as any)?.entry?.options?.id ?? (ctx as any).get?.('profileContext')?.name ?? 'default'
  const paths = resolveProviderPaths(profileId)
  const supervisor = new ServerSupervisor(ctx, paths, config)

  new UniversalProviderService(ctx, supervisor, paths, config)

  const llm = (ctx as any).llm
  if (llm) {
    const adapter = new UniversalLlmAdapter(supervisor)
    llm.registerAdapter(['universal-chat-provider'], adapter)
    llm.registerConfigurableProviders([{
      provider: 'universal-chat-provider',
      displayName: 'Universal Provider',
      settingsNs: (ctx.fiber as any)?.entry?.options?.id ?? 'universal-provider',
      settingsPath: [],
    }])
  }

  ctx.effect(() => () => {
    supervisor.dispose()
  })
}
