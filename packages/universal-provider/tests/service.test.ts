import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { UniversalProviderService } from '../src/index.ts'

describe('UniversalProviderService RPC Methods', () => {
  const mockSupervisor = {
    ensureRunning: async () => ({
      baseUrl: 'http://127.0.0.1:8317',
      mode: 'managed',
      port: 8317,
      version: '8.0.3',
    }),
    getActiveRequests: () => 2,
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
})
