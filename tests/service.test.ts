import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject, UniversalProviderService } from '../src/index.ts'
import { quotaEntries } from '../src/client/quota-entries.ts'

describe('UniversalProviderService RPC Methods', () => {
  it('activates with declared llm injection and serves RPCs without optional host services', async () => {
    const root = new Context()
    let adapterRegistered = false
    const removeLlm = root.provide('llm', {
      registerAdapter: () => { adapterRegistered = true },
      registerConfigurableProviders: () => {},
    })
    const fiber = root.plugin({ apply, inject }, {
      serverMode: 'external',
      externalUrl: 'http://127.0.0.1:8317',
      apiKeyEnv: 'UNIVERSAL_PROVIDER_TEST_ABSENT_API_KEY',
      managementKeyEnv: 'UNIVERSAL_PROVIDER_TEST_ABSENT_MANAGEMENT_KEY',
      serverVersion: 'latest',
      requestLogging: false,
      port: 8317,
    })
    try {
      await fiber
      expect(adapterRegistered).toBe(true)
      for (const name of ['credentials', 'subprocess', 'configEditor']) {
        expect(root.get(name)).toBeUndefined()
      }
      const service = root.get('universalProvider')!
      expect(service).toBeDefined()
      expect(await service.ping()).toMatchObject({ message: 'pong' })
      expect(await service.getState()).toMatchObject({ status: 'ready', mode: 'external' })
      expect(await service.generateCommitDraft({ cwd: '.' })).toMatchObject({ hasStagedChanges: false })
      expect(await service.configureTitles('model')).toBe(true)
      expect(await service.configureCompaction('model')).toBe(true)
    } finally {
      await fiber.dispose()
      removeLlm()
    }
  })

  const mockSupervisor = {
    ensureRunning: async () => ({
      baseUrl: 'http://127.0.0.1:8317',
      mode: 'managed',
      port: 8317,
      version: '8.0.3',
    }),
    getActiveRequests: () => 2,
    getProxyClient: () => ({ discover: async () => ({ available: [], metadata: [] }) }),
    getManagementClient: () => ({
      listAuthFilesRaw: async () => [
        { name: 'acc-1', auth_index: 'idx-1', provider: 'codex', email: 'test@example.com', label: 'My OpenAI' },
      ],
      requestAuthUrl: async (provider: string) => ({
        url: `https://auth.example.com/${provider}`,
        state: 'state-123',
        userCode: 'ABCD-1234',
      }),
      getAuthStatus: async (state: string) => ({
        status: state === 'state-123' ? 'ok' : 'wait',
      }),
      cancelAuthSession: async () => {},
      deleteAuthFile: async () => {},
      listOpenAICompatibility: async () => [
        { name: 'Ollama', 'base-url': 'http://localhost:11434/v1', models: [{ name: 'llama3' }] },
      ],
      putOpenAICompatibility: async () => {},
      apiCall: async () => ({
        statusCode: 200,
        header: {},
        body: JSON.stringify({
          rate_limit: {
            primary_window: { used_percent: 20, limit_window_seconds: 18000 },
          },
        }),
      }),
    }),
  } as any

  const paths = {
    profileRoot: '/tmp/test',
    authDir: '/tmp/test/auth',
    configPath: '/tmp/test/config.yaml',
    logPath: '/tmp/test/server.log',
    lockPath: '/tmp/test/server.lock',
    binDir: '/tmp/test/bin',
    cacheDir: '/tmp/test/cache',
  }

  const config = {
    serverMode: 'managed' as const,
    externalUrl: 'http://127.0.0.1:8317',
    apiKeyEnv: 'API_KEY',
    managementKeyEnv: 'MGMT_KEY',
    serverVersion: '8.0.3',
    requestLogging: false,
    port: 8317,
  }

  const ctx = new Context()
  const service = new UniversalProviderService(ctx, mockSupervisor, paths, config)

  it('exposes model discovery without a native remote.llm service', async () => {
    expect(await service.listModels()).toEqual([])
    const controller = new AbortController()
    controller.abort()
    await expect(service.listModels(controller.signal)).rejects.toThrow()
  })

  it('handles ping() with timestamp', async () => {
    const res = await service.ping()
    expect(res.message).toBe('pong')
    expect(res.timestamp).toBeGreaterThan(0)
  })

  it('handles getState() reporting running managed server', async () => {
    const state = await service.getState()
    expect(state.status).toBe('ready')
    expect(state.version).toBe('8.0.3')
    expect(state.mode).toBe('managed')
    expect(state.activeRequests).toBe(2)
  })

  it('lists accounts and initiates OAuth flow', async () => {
    const accounts = await service.listAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.name).toBe('acc-1')
    expect(accounts[0]?.provider).toBe('codex')

    const oauth = await service.startOAuth('codex')
    expect(oauth.state).toBe('state-123')
    expect(oauth.userCode).toBe('ABCD-1234')

    const status = await service.pollOAuth('state-123')
    expect(status.status).toBe('ok')

    const cancelled = await service.cancelOAuth('state-123')
    expect(cancelled).toBe(true)

    const deleted = await service.deleteAccount('acc-1')
    expect(deleted).toBe(true)
  })

  it('manages OpenAI compatibility endpoints', async () => {
    const endpoints = await service.listEndpoints()
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]?.name).toBe('Ollama')

    const saved = await service.saveEndpoint({
      name: 'vLLM',
      baseUrl: 'http://localhost:8000/v1',
      apiKey: 'secret',
      models: [{ name: 'mistral' }],
    })
    expect(saved).toBe(true)
  })

  it('fetches quota reports for accounts', async () => {
    const quotas = await service.getQuotas()
    expect(quotas).toHaveLength(1)
    expect(quotas[0]?.provider).toBe('codex')
    expect(quotas[0]?.windows).toHaveLength(1)
    expect(quotas[0]?.windows[0]?.remainingPercent).toBe(80)
  })

  it('returns formatted recent logs', async () => {
    const logs = await service.getRecentLogs()
    expect(Array.isArray(logs)).toBe(true)
  })

  it('preserves per-account Google model quotas from the API through the UI entries', async () => {
    const resetTime = '2099-01-01T00:00:00Z'
    const management = {
      listAuthFilesRaw: async () => [
        { provider: 'antigravity', auth_index: 'google-1', project_id: 'project-1' },
        { provider: 'antigravity', auth_index: 'google-2', project_id: 'project-2' },
        { provider: 'antigravity', auth_index: 'google-missing' },
        { provider: 'codex', auth_index: 'gpt' },
      ],
      apiCall: async (request: any) => {
        if (request.auth_index === 'gpt') return mockSupervisor.getManagementClient().apiCall()
        expect(request.url).toBe('https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels')
        expect(request.method).toBe('POST')
        expect(JSON.parse(request.data)).toEqual({ project: request.auth_index === 'google-1' ? 'project-1' : 'project-2' })
        return { statusCode: 200, header: {}, body: JSON.stringify({ models: {
          'gemini-pro': { quotaInfo: { remainingFraction: request.auth_index === 'google-1' ? 0 : 0.75, resetTime } },
        } }) }
      },
    }
    const instance = new UniversalProviderService(new Context(), {
      ...mockSupervisor, getManagementClient: () => management,
    }, paths, config)
    const reports = await instance.getQuotas()
    expect(reports).toHaveLength(4)
    expect(quotaEntries(reports[0]!)).toEqual([{ label: 'gemini-pro', remainingPercent: 0, resetsAt: Date.parse(resetTime) }])
    expect(quotaEntries(reports[1]!)[0]?.remainingPercent).toBe(75)
    expect(reports[1]?.account?.authIndex).toBe('google-2')
    expect(reports[2]?.error).toBe('missing project_id')
    expect(quotaEntries(reports[2]!)).toEqual([])
    expect(quotaEntries(reports[3]!)[0]?.remainingPercent).toBe(80)
    expect(JSON.parse(JSON.stringify(reports))).toStrictEqual(reports)
  })
})
