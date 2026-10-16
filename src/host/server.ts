import type { Context } from '@deepseek-ai/cordis'
import type { ProviderPaths } from './paths.ts'
import type { ProviderConfig } from './config.ts'
import type { DiscoveryResult } from '../core/api/proxy-client.ts'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { openSync, closeSync, unlinkSync, existsSync } from 'node:fs'
import net from 'node:net'
import { acquireBinary } from './binary.ts'
import { buildManagedConfig, generateSecret } from './config.ts'
import { CLIProxyClient } from '../core/api/proxy-client.ts'
import { ManagementClient } from '../core/api/management-client.ts'

export interface RunningServerInfo {
  baseUrl: string
  mode: 'managed' | 'external'
  port?: number
  version?: string
}

export class ServerSupervisor {
  private activeRequests = 0
  private managedHandle?: any
  private client?: CLIProxyClient
  private managementClient?: ManagementClient
  private info: RunningServerInfo | undefined
  private lockFd: number | undefined
  private startingPromise: Promise<RunningServerInfo> | undefined

  constructor(
    private readonly ctx: Context,
    private readonly paths: ProviderPaths,
    private readonly config: ProviderConfig,
  ) {}

  async getFreePort(preferred = 8317): Promise<number> {
    return new Promise((resolve) => {
      const srv = net.createServer()
      srv.listen(preferred, '127.0.0.1', () => {
        const port = (srv.address() as net.AddressInfo).port
        srv.close(() => resolve(port))
      })
      srv.on('error', () => {
        const fallback = net.createServer()
        fallback.listen(0, '127.0.0.1', () => {
          const port = (fallback.address() as net.AddressInfo).port
          fallback.close(() => resolve(port))
        })
      })
    })
  }

  async acquireRequest(): Promise<() => void> {
    this.activeRequests++
    let released = false
    return () => {
      if (!released) {
        released = true
        this.activeRequests = Math.max(0, this.activeRequests - 1)
      }
    }
  }

  getActiveRequests(): number {
    return this.activeRequests
  }

  async ensureRunning(signal?: AbortSignal): Promise<RunningServerInfo> {
    if (this.info) return this.info
    if (this.startingPromise) return this.startingPromise

    this.startingPromise = this.startInternal(signal)
    try {
      this.info = await this.startingPromise
      return this.info
    } catch (error) {
      await this.dispose()
      throw error
    } finally {
      this.startingPromise = undefined
    }
  }

  private async startInternal(signal?: AbortSignal): Promise<RunningServerInfo> {
    if (this.config.serverMode === 'external') {
      const baseUrl = this.config.externalUrl.replace(/\/+$/, '')
      const apiKey = await this.resolveCredential(this.config.apiKeyEnv) ?? ''
      const mgmtKey = await this.resolveCredential(this.config.managementKeyEnv) ?? ''
      signal?.throwIfAborted()

      this.client = new CLIProxyClient(baseUrl, apiKey)
      if (mgmtKey) {
        this.managementClient = new ManagementClient(baseUrl, mgmtKey)
      }

      return {
        baseUrl,
        mode: 'external',
      }
    }

    // Managed Mode
    await mkdir(this.paths.profileRoot, { recursive: true, mode: 0o700 })
    await mkdir(this.paths.authDir, { recursive: true, mode: 0o700 })

    // Acquire exclusive owner lock
    try {
      this.lockFd = openSync(this.paths.lockPath, 'wx')
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        throw new Error(
          `universal-provider: Another server manager owns this profile data (${this.paths.lockPath}). ` +
          'Close the other instance or configure serverMode: "external" to share an already running proxy.',
        )
      }
      throw err
    }

    // Acquire binary
    const { binaryPath, version } = await acquireBinary({
      binDir: this.paths.binDir,
      requestedVersion: this.config.serverVersion,
      log: msg => (this.ctx as any).logger?.info?.(msg),
      ...(signal !== undefined ? { signal } : {}),
    })
    signal?.throwIfAborted()

    const port = await this.getFreePort(this.config.port)
    const apiKey = generateSecret()
    const managementKey = generateSecret()

    const configYaml = buildManagedConfig({
      host: '127.0.0.1',
      port,
      apiKey,
      managementKey,
      authDir: this.paths.authDir,
      requestLogging: this.config.requestLogging,
    })

    await writeFile(this.paths.configPath, configYaml, { mode: 0o600 })
    signal?.throwIfAborted()

    const baseUrl = `http://127.0.0.1:${port}`

    // Spawn via ctx.subprocess
    const subprocess = this.ctx.get('subprocess')
    if (subprocess && typeof subprocess.spawn === 'function') {
      this.managedHandle = subprocess.spawn({
        argv: [binaryPath, '--config', this.paths.configPath],
        cwd: this.paths.profileRoot,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 64 * 1024 },
          stderr: { maxBytes: 64 * 1024 },
        },
        graceMs: 5000,
      })

      this.managedHandle.done?.then(
        (outcome: any) => {
          (this.ctx as any).logger?.warn?.(`CLIProxyAPI exited: code ${outcome?.exitCode}, signal ${outcome?.signal}`)
          this.info = undefined
        },
        (error: any) => {
          (this.ctx as any).logger?.error?.(`CLIProxyAPI process failed: ${error}`)
          this.info = undefined
        },
      )
    }

    this.client = new CLIProxyClient(baseUrl, apiKey)
    this.managementClient = new ManagementClient(baseUrl, managementKey)

    // Wait until healthy
    await this.waitForHealthy(this.client, signal)

    return {
      baseUrl,
      mode: 'managed',
      port,
      version,
    }
  }

  private async waitForHealthy(client: CLIProxyClient, signal?: AbortSignal, maxAttempts = 50): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) throw new Error('Server startup aborted')
      try {
        await client.discover(signal)
        return
      } catch {
        await new Promise(r => setTimeout(r, 200))
      }
    }
    throw new Error('CLIProxyAPI failed to become healthy within timeout.')
  }

  private async resolveCredential(ref: string): Promise<string | undefined> {
    const creds = this.ctx.get('credentials')
    if (creds && typeof creds.resolve === 'function') {
      const hit = await creds.resolve(ref)
      if (hit?.value) return hit.value
    }
    return process.env[ref]
  }

  getProxyClient(): CLIProxyClient | undefined {
    return this.client
  }

  getManagementClient(): ManagementClient | undefined {
    return this.managementClient
  }

  async dispose(): Promise<void> {
    if (this.managedHandle) {
      try {
        this.managedHandle.terminate?.()
      } catch {}
      this.managedHandle = undefined
    }

    if (this.lockFd !== undefined) {
      try {
        closeSync(this.lockFd)
        unlinkSync(this.paths.lockPath)
      } catch {}
      this.lockFd = undefined
    }

    this.info = undefined
  }
}
