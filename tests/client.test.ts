import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

// Exercise the client entry as DSH loads it, with its runtime require boundary.
// The small hook driver runs page effects without adding a DOM dependency.
function loadClient(remoteModule: unknown = { default: {} }) {
  const states: unknown[] = []
  const effects: (() => unknown)[] = []
  let cursor = 0
  let firstRender = true
  const react = {
    createElement: (type: string, props: unknown, ...children: unknown[]) => ({ type, props, children }),
    useState: (initial: unknown) => {
      const index = cursor++
      if (firstRender) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], (next: unknown) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next
      }]
    },
    useEffect: (effect: () => unknown) => { if (firstRender) effects.push(effect) },
  }
  const source = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports: any = {}
  vm.runInNewContext(compiled, {
    exports,
    require: (id: string) => {
      if (id === 'react') return react
      if (id === 'universal-provider/remote') return remoteModule
      if (id === './oauth-flow.ts') return {}
      throw new Error(`Unexpected client dependency: ${id}`)
    },
  })
  return {
    client: exports,
    render(component: any, view = 'page') {
      cursor = 0
      const tree = component({ view })
      firstRender = false
      for (const effect of effects.splice(0)) effect()
      return JSON.stringify(tree)
    },
  }
}

function context(client: any, mount = vi.fn().mockResolvedValue(undefined)) {
  const entries: { options: any; component: any }[] = []
  const cleanups: (() => unknown)[] = []
  const api = {
    getState: vi.fn().mockResolvedValue({ status: 'ready' }),
    listAccounts: vi.fn().mockResolvedValue([{ name: 'saved-account', email: 'saved@example.com' }]),
  }
  const services = {
    remote: { $mount: mount, universalProvider: api },
    slots: {
      inject: vi.fn((_name: string, callback: () => void) => callback()),
      register: vi.fn((options: any, component: any) => {
        entries.push({ options, component })
        return () => undefined
      }),
    },
  }
  // Model Cordis' service-access guard, which caused the reported regression.
  const createContext = (allowed: string[]): any => new Proxy(services, {
    get(target, key: keyof typeof services | 'inject' | 'effect') {
      if (key === 'inject') return (names: string[], callback: (ctx: any) => unknown) => callback(createContext([...allowed, ...names]))
      if (key === 'effect') return (callback: () => () => unknown) => cleanups.push(callback())
      if (!allowed.includes(key)) throw new Error(`cannot get property ${key} without inject`)
      if (key === 'remote') return new Proxy(target.remote, {
        get(remote, property: keyof typeof target.remote) {
          if (property === 'universalProvider' && !allowed.includes('remote.universalProvider')) {
            throw new Error('cannot get property "remote.universalProvider" without inject')
          }
          return remote[property]
        },
      })
      return target[key]
    },
  })
  const ctx = createContext(client.inject)
  return { ctx, entries, api, dispose: async () => { for (const cleanup of cleanups) await cleanup() } }
}

describe('DSH client configuration entry', () => {
  it('releases the mounted remote contribution on disposal', async () => {
    const { client } = loadClient()
    const unmount = vi.fn().mockResolvedValue(undefined)
    const { ctx, dispose } = context(client, vi.fn().mockResolvedValue(unmount))
    await client.apply(ctx)
    expect(unmount).not.toHaveBeenCalled()
    await dispose()
    expect(unmount).toHaveBeenCalledOnce()
  })

  it('waits for remote mounting and registers the same component for bundle and row', async () => {
    const { client } = loadClient()
    let finish!: () => void
    const mount = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const { ctx, entries } = context(client, mount)
    const applying = client.apply(ctx)
    expect(entries).toHaveLength(0)
    finish()
    await applying
    expect(entries.map(({ options }) => [options.name, options.key])).toEqual([
      ['plugins.bundle.config', 'universal-provider'],
      ['plugins.row.config', 'universal-provider#universal-provider'],
    ])
    expect(entries[0].component).toBe(entries[1].component)
  })

  it('loads saved accounts and status on initial page entry', async () => {
    const { client, render } = loadClient()
    const { ctx, entries, api } = context(client)
    await client.apply(ctx)
    render(entries[0].component)
    await new Promise(resolve => setImmediate(resolve))
    expect(api.getState).toHaveBeenCalledOnce()
    expect(api.listAccounts).toHaveBeenCalledOnce()
    expect(render(entries[0].component)).toContain('saved@example.com')
  })

  it('renders a summary without requesting page data', async () => {
    const { client, render } = loadClient()
    const { ctx, entries, api } = context(client)
    await client.apply(ctx)
    expect(render(entries[1].component, 'summary')).toContain('Conecta y administra')
    expect(api.getState).not.toHaveBeenCalled()
    expect(api.listAccounts).not.toHaveBeenCalled()
  })

  it('shows rejected async mounts instead of losing the rejection', async () => {
    const { client, render } = loadClient()
    const { ctx, entries, api } = context(client, vi.fn().mockRejectedValue(new Error('mount failed')))
    await client.apply(ctx)
    const page = render(entries[0].component)
    expect(page).toContain('mount failed')
    expect(page).toContain('"role":"alert"')
    expect(api.listAccounts).not.toHaveBeenCalled()
  })

  it('shows initial account request failures while still loading status', async () => {
    const { client, render } = loadClient()
    const { ctx, entries, api } = context(client)
    api.listAccounts.mockRejectedValue(new Error('accounts unavailable'))
    await client.apply(ctx)
    render(entries[0].component)
    await new Promise(resolve => setImmediate(resolve))
    expect(render(entries[0].component)).toContain('accounts unavailable')
    expect(api.getState).toHaveBeenCalledOnce()
  })
})
