import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { Context, Service } from '@deepseek-ai/cordis'
import semver from 'semver'
import { describe, expect, it, vi } from 'vitest'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

/** Load the published client artifact the way DSH's module table does. */
function loadClientBundle() {
  const nodeRequire = createRequire(import.meta.url)
  const requireSeed = (id: string) => {
    if (id === 'react' || id === 'react/jsx-runtime') return nodeRequire(id)
    throw new Error(`Unseeded client module: ${id}`)
  }
  let client: any
  runInNewContext(readFileSync(new URL('lib/client.js', root), 'utf8'), {
    window: { __ModuleLoader__: { load({ id, factory }: any) {
      expect(id).toBe(pkg.name)
      client = factory(requireSeed)
    } } },
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  })
  return client
}

/**
 * Faithful `slots` service. `inject` installs the callback under the caller's
 * fiber effect, so the registration disposer runs when that fiber unloads;
 * `register` records the definition and returns an idempotent disposer.
 */
function provideSlots(ctx: Context, registrations: any[]) {
  class TestSlots extends Service {
    constructor() { super(ctx, 'slots') }
    inject(_name: string, callback: () => any) {
      return this.ctx.effect(callback)
    }
    register(options: any) {
      registrations.push(options)
      return () => {
        const index = registrations.indexOf(options)
        if (index !== -1) registrations.splice(index, 1)
      }
    }
  }
  return new TestSlots()
}

describe('Git installation package', () => {
  it('exposes the actual DSH bundle at the repository root', () => {
    expect(pkg.name).toBe('universal-provider')
    expect(pkg.private).not.toBe(true)
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh.client.immediately).toBe(true)
    expect(pkg.dsh.client.inject).toEqual(expect.arrayContaining([
      '@deepseek-ai/dsh-api-remotes',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-plugin-manager',
    ]))
    const patch = readFileSync(new URL(pkg.dsh.bundle.patch, root), 'utf8')
    expect(patch).toContain("name: 'universal-provider'")
  })

  it('installs from Git without requiring build-script approval', () => {
    expect(pkg.scripts.prepare).toBeUndefined()
    expect(pkg.scripts.prepack).toBeUndefined()
    expect(pkg.scripts.build).toContain('tsdown')
    expect(pkg.scripts.build).not.toContain('pnpm -r')
    expect(pkg.files).toContain('lib/')
    const clientArtifact = readFileSync(new URL('lib/client.js', root), 'utf8')
    expect(clientArtifact).toContain('Otros proveedores OAuth')
    expect(clientArtifact).toContain('Google Antigravity')
    expect(clientArtifact).toContain('plugins.bundle.config')
  })

  it('has source entrypoints in the root build configuration', () => {
    const config = readFileSync(new URL('tsdown.config.ts', root), 'utf8')
    expect(config).toContain('src/index.ts')
    expect(config).toContain('src/client/index.ts')
  })

  it('cleans and regenerates Typert before bundling the client', () => {
    const steps = pkg.scripts.build.split(' && ')
    expect(steps).toEqual([
      'node scripts/clean-build.mjs',
      'node scripts/build-typert.mjs',
      'tsdown',
    ])
  })

  it('activates the shipped client in Cordis and mounts the current remote descriptors', async () => {
    const client = loadClientBundle()
    expect(client.inject).toEqual(expect.arrayContaining(['slots', 'remote']))

    const ctx = new Context()
    const registrations: any[] = []
    provideSlots(ctx, registrations)
    let releaseMount!: () => void
    const mounted = new Promise<void>(resolve => { releaseMount = resolve })
    const unmount = vi.fn(async () => {})
    const mount = vi.fn(async (_artifact: any) => {
      await mounted
      return unmount
    })
    const fork = ctx.plugin(client)
    try {
      // Cordis must wait for the remote service, rather than silently skipping it.
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(registrations).toHaveLength(0)
      ctx.provide('remote', { $mount: mount })
      ctx.reflect.provide('remote.universalProvider', {})
      // Model the reported runtime: no remote.llm service. Model discovery must
      // not prevent the OAuth configuration buttons from being registered.
      await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1))
      expect(registrations).toHaveLength(0)

      const artifact = mount.mock.calls[0][0]
      const { TYPERT_REMOTE: generated } = await import(new URL('lib/typert.remote-client.js', root).href)
      expect(artifact.package).toBe(pkg.name)
      expect(artifact.descriptors.map((entry: any) => entry.id)).toEqual(
        generated.descriptors.map((entry: any) => entry.id),
      )
      const { TYPERT: host } = await import(new URL('lib/typert.host.js', root).href)
      const models = [{ provider: 'universal-chat-provider', id: 'gpt-test', name: 'GPT Test',
        description: 'Available model', inputModalities: ['text', 'image'] }]
      for (const descriptors of [artifact.descriptors, generated.descriptors, host.invocations]) {
        const descriptor = descriptors.find((entry: any) => entry.method === 'listModels')
        expect(descriptor).toMatchObject({
          id: 'universal-provider#universalProvider/listModels',
          service: 'universalProvider', namespace: 'universalProvider',
          parameters: [], cancellation: { parameter: 'signal' },
        })
        expect(descriptor.result.create().parse(models)).toEqual(models)
        expect(descriptor.result.create().parse([])).toEqual([])
        expect(() => descriptor.result.create().parse([{ id: 'missing-fields' }])).toThrow()
      }
      // Compare an actual schema result too: descriptor IDs alone cannot detect stale codecs.
      const quota = [{ provider: 'codex', windows: [{ label: 'credits', balance: {
        amount: 12, currency: 'USD', suffix: 'left',
      }, resetsAt: 123 }], account: { authIndex: '1', label: 'Work' } }]
      const quotaSchema = (value: any) => value.descriptors.find((entry: any) => entry.method === 'getQuotas').result.create()
      expect(quotaSchema(artifact).parse(quota)).toEqual(quotaSchema(generated).parse(quota))
      const googleQuota = [{
        provider: 'antigravity', windows: [], account: { authIndex: 'google-1', label: 'Google' },
        models: {
          'gemini-pro': { remainingPercent: 0, resetsAt: 4070908800000 },
          'gemini-flash': { remainingPercent: 75 },
        },
      }]
      for (const descriptors of [artifact.descriptors, generated.descriptors, host.invocations]) {
        const schema = descriptors.find((entry: any) => entry.method === 'getQuotas').result.create()
        expect(schema.parse(googleQuota)).toEqual(googleQuota)
      }

      releaseMount()
      // `apply` must settle as a successful activation and must never return the
      // injected Fiber as an effect (Cordis rejects it: "Invalid effect").
      await expect(fork).resolves.toBeDefined()
      expect(fork.state).toBe(2)
      await vi.waitFor(() => expect(registrations).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'plugins.bundle.config', key: pkg.name }),
        expect.objectContaining({ name: 'plugins.row.config', key: `${pkg.name}#universal-provider` }),
      ])))
      // Both registrations must remain after the activation settles; a failed
      // fiber would unload the child and drop them.
      expect(registrations).toHaveLength(2)
    } finally {
      releaseMount()
      await fork.dispose()
    }
  })

  it('releases the mounted remote contribution and unregisters slots when the client unloads', async () => {
    const client = loadClientBundle()
    const ctx = new Context()
    const registrations: any[] = []
    provideSlots(ctx, registrations)
    const unmount = vi.fn(async () => {})
    ctx.provide('remote', { $mount: vi.fn(async () => unmount) })
    ctx.reflect.provide('remote.universalProvider', {})
    const fork = ctx.plugin(client)
    try {
      await expect(fork).resolves.toBeDefined()
      expect(fork.state).toBe(2)
      await vi.waitFor(() => expect(registrations).toHaveLength(2))
      expect(unmount).not.toHaveBeenCalled()

      await fork.dispose()
      expect(unmount).toHaveBeenCalledOnce()
      expect(registrations).toHaveLength(0)
    } finally {
      await fork.dispose()
    }
  })

  it('client bundle only requires platform seed modules', () => {
    // The DSH web client module table seeds exactly these specifiers; any other
    // external `require(...)` aborts the web boot ("missed the module table").
    const seedWords = new Set([
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-store',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-dockkit',
    ])
    const clientArtifact = readFileSync(new URL('lib/client.js', root), 'utf8')
    const requests = [...clientArtifact.matchAll(/\brequire\("([^"]+)"\)/g)].map((match) => match[1])
    for (const request of requests) expect(seedWords.has(request)).toBe(true)
    expect(requests).toContain('react')
    expect(clientArtifact).not.toMatch(/require\(["']zod["']\)/)
    expect(clientArtifact).toContain('ZodError')
  })

  it('declares an open DSH compatibility floor so new harness releases are accepted', () => {
    // Mirrors DSH's plugin-compatibility preflight: an own `engines.dsh` range
    // decides alone; otherwise every @deepseek-ai/dsh-* peer is checked with
    // prereleases included. An exact peer pin is what blocked installations
    // (e.g. dsh 0.2.1-rc.2 rejected a plugin pinned to dsh-llm 0.2.1-alpha.2).
    expect(typeof pkg.engines?.dsh).toBe('string')
    expect(pkg.engines.dsh).toMatch(/^>=/)
    const exactPeer = Object.entries(pkg.peerDependencies as Record<string, string>)
      .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
      .filter(([, range]) => !range.includes('>=') && !range.includes('^') && !range.includes('~'))
    expect(exactPeer).toEqual([])

    const satisfies = (version: string, range: string) =>
      semver.satisfies(version, range, { includePrerelease: true })
    const compatible = (version: string) => satisfies(version, pkg.engines.dsh)

    // The floor itself and every earlier release stay supported by the range check
    // only insofar as they satisfy it; what matters is that newer harnesses pass.
    expect(compatible('0.2.1-alpha.2')).toBe(true)
    expect(compatible('0.2.1-rc.2')).toBe(true)      // reported rejection
    expect(compatible('0.2.1')).toBe(true)
    expect(compatible('0.2.2-alpha.1')).toBe(true)
    expect(compatible('0.3.0-rc.1')).toBe(true)
    expect(compatible('1.0.0')).toBe(true)
    expect(compatible('0.2.1-alpha.1')).toBe(false)   // below the tested floor
    expect(compatible('0.2.0')).toBe(false)

    // The dsh-llm peer must independently accept the same newer runtimes, since
    // an engines.dsh floor does not override unmet non-dsh peers.
    const llmRange = pkg.peerDependencies['@deepseek-ai/dsh-llm']
    for (const version of ['0.2.1-alpha.2', '0.2.1-rc.2', '0.2.1', '0.2.2', '1.0.0'])
      expect(satisfies(version, llmRange)).toBe(true)
    expect(satisfies('0.2.0', llmRange)).toBe(false)
  })

  it('keeps the client dependency policy that avoids externals drift', () => {
    const config = readFileSync(new URL('tsdown.config.ts', root), 'utf8')
    expect(config).toContain('neverBundle')
    expect(config).toContain('alwaysBundle')
    expect(config).toMatch(/alwaysBundle: \['zod'\]/)
  })
})
