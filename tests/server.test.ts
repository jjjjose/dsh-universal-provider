import { describe, expect, it } from 'vitest'
import { buildManagedConfig } from '../src/host/config.ts'
import { ServerSupervisor } from '../src/host/server.ts'
import { resolveProviderPaths } from '../src/host/paths.ts'

describe('Server Supervisor and Config', () => {
  it('builds strict loopback config with allow-remote: false', () => {
    const yaml = buildManagedConfig({
      host: '127.0.0.1',
      port: 8317,
      apiKey: 'test-api-key',
      managementKey: 'test-mgmt-key',
      authDir: '/tmp/auth',
      requestLogging: false,
    })

    expect(yaml).toContain('config-version: 8')
    expect(yaml).toContain('host: "127.0.0.1"')
    expect(yaml).toContain('port: 8317')
    expect(yaml).toContain('allow-remote: false')
    expect(yaml).toContain('auth-dir: "/tmp/auth"')
  })

  it('initializes external server mode without spawning subprocess', async () => {
    const mockCtx = {
      get(name: string) { return this[name] },
      credentials: {
        resolve: async (ref: string) => ({ value: `key-for-${ref}` }),
      },
    } as any

    const paths = resolveProviderPaths('test-profile')
    const supervisor = new ServerSupervisor(mockCtx, paths, {
      serverMode: 'external',
      externalUrl: 'http://127.0.0.1:9999',
      apiKeyEnv: 'API_KEY',
      managementKeyEnv: 'MGMT_KEY',
      serverVersion: '8.0.3',
      requestLogging: false,
      port: 8317,
    })

    const info = await supervisor.ensureRunning()
    expect(info.mode).toBe('external')
    expect(info.baseUrl).toBe('http://127.0.0.1:9999')
    expect(supervisor.getProxyClient()).toBeDefined()
    expect(supervisor.getManagementClient()).toBeDefined()

    // Test request leases
    const release = await supervisor.acquireRequest()
    expect(supervisor.getActiveRequests()).toBe(1)
    release()
    expect(supervisor.getActiveRequests()).toBe(0)

    await supervisor.dispose()
  })

  it('allocates a free loopback port', async () => {
    const mockCtx = {} as any
    const paths = resolveProviderPaths('test-profile')
    const supervisor = new ServerSupervisor(mockCtx, paths, {
      serverMode: 'external',
      externalUrl: 'http://127.0.0.1:8317',
      apiKeyEnv: 'A',
      managementKeyEnv: 'B',
      serverVersion: 'latest',
      requestLogging: false,
      port: 8317,
    })

    const port = await supervisor.getFreePort(0)
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThan(65536)
  })
})
