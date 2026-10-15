import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

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
    expect(client.inject).toEqual(expect.arrayContaining(['slots', 'remote']))

    const ctx = new Context()
    const registrations: any[] = []
    ctx.provide('slots', {
      inject: (_name: string, callback: () => any) => callback(),
      register: (options: any) => {
        registrations.push(options)
        return () => { registrations.splice(registrations.indexOf(options), 1) }
      },
    })
    let releaseMount!: () => void
    const mounted = new Promise<void>(resolve => { releaseMount = resolve })
    const mount = vi.fn(async (_artifact: any) => mounted)
    const fork = ctx.plugin(client)
    try {
      // Cordis must wait for the remote service, rather than silently skipping it.
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(registrations).toHaveLength(0)
      ctx.provide('remote', { $mount: mount })
      ctx.reflect.provide('remote.universalProvider', {})
      ctx.reflect.provide('remote.llm', {})
      await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1))
      expect(registrations).toHaveLength(0)

      const artifact = mount.mock.calls[0][0]
      const { TYPERT_REMOTE: generated } = await import(new URL('lib/typert.remote-client.js', root).href)
      expect(artifact.package).toBe(pkg.name)
      expect(artifact.descriptors.map((entry: any) => entry.id)).toEqual(
        generated.descriptors.map((entry: any) => entry.id),
      )
      // Compare an actual schema result too: descriptor IDs alone cannot detect stale codecs.
      const quota = [{ provider: 'codex', windows: [{ label: 'credits', balance: {
        amount: 12, currency: 'USD', suffix: 'left',
      }, resetsAt: 123 }], account: { authIndex: '1', label: 'Work' } }]
      const quotaSchema = (value: any) => value.descriptors.find((entry: any) => entry.method === 'getQuotas').result.create()
      expect(quotaSchema(artifact).parse(quota)).toEqual(quotaSchema(generated).parse(quota))

      releaseMount()
      await vi.waitFor(() => expect(registrations).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'plugins.bundle.config', key: pkg.name }),
        expect.objectContaining({ name: 'plugins.row.config', key: `${pkg.name}#universal-provider` }),
      ])))
    } finally {
      releaseMount()
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

  it('keeps the client dependency policy that avoids externals drift', () => {
    const config = readFileSync(new URL('tsdown.config.ts', root), 'utf8')
    expect(config).toContain('neverBundle')
    expect(config).toContain('alwaysBundle')
    expect(config).toMatch(/alwaysBundle: \['zod'\]/)
  })
})
