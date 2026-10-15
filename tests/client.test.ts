import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { expectRemote } from '../src/client/remote-result.ts'

// Exercise the client entry as DSH loads it, with its runtime require boundary.
// The small hook driver runs page effects without adding a DOM dependency.
function loadClient(remoteModule: unknown = { default: {} }, browser: any = {}, waitForOAuth = vi.fn().mockResolvedValue({ status: 'ok' })) {
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
      if (id === './oauth-flow.ts') return { waitForOAuth }
      if (id === './remote-result.ts') return { expectRemote }
      throw new Error(`Unexpected client dependency: ${id}`)
    },
    window: browser,
    AbortController,
  })
  return {
    client: exports,
    renderTree(component: any) {
      cursor = 0
      const tree = component({ view: 'page' })
      firstRender = false
      return tree
    },
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
  // Cordis' `ctx.inject` returns a Fiber thenable: awaiting it settles to the
  // raw fiber (which itself has no `then`, so promise assimilation terminates).
  const fiber: any = { state: 2, ctx: {} }
  const fiberLike: any = { then: (resolve: (value: unknown) => void) => resolve(fiber) }
  // DSH's Typert gateway always resolves remote invocations wrapped in a
  // RemoteResult envelope, so the mock models that contract.
  const api = {
    getState: vi.fn().mockResolvedValue({ ok: true, value: { status: 'ready' } }),
    listAccounts: vi.fn().mockResolvedValue({ ok: true, value: [{ name: 'saved-account', email: 'saved@example.com' }] }),
    startOAuth: vi.fn().mockResolvedValue({ ok: true, value: { url: 'https://example.com/oauth', state: 'oauth-state' } }),
    cancelOAuth: vi.fn().mockResolvedValue({ ok: true, value: true }),
  }
  const llm = { listModels: vi.fn().mockResolvedValue({ ok: true, value: [{ id: 'test-model' }] }) }
  const services = {
    remote: { $mount: mount, universalProvider: api, llm },
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
      if (key === 'inject') return (names: string[] | Record<string, unknown>, callback: (ctx: any) => unknown) => {
        callback(createContext([...allowed, ...(Array.isArray(names) ? names : Object.keys(names))]))
        return fiberLike
      }
      if (key === 'effect') return (callback: () => () => unknown) => cleanups.push(callback())
      if (!allowed.includes(key)) throw new Error(`cannot get property ${key} without inject`)
      if (key === 'remote') return new Proxy(target.remote, {
        get(remote, property: keyof typeof target.remote) {
          if (property !== '$mount' && !allowed.includes(`remote.${property}`)) {
            throw new Error(`cannot get property "remote.${property}" without inject`)
          }
          return remote[property]
        },
      })
      return target[key]
    },
  })
  const ctx = createContext(client.inject)
  return { ctx, entries, api, llm, dispose: async () => { for (const cleanup of cleanups) await cleanup() } }
}

describe('DSH client configuration entry', () => {
  it.each(['antigravity', 'codex'])('opens OAuth immediately and refreshes models after linking %s', async provider => {
    const popup = { closed: false, location: { href: '' }, close: vi.fn() }
    const open = vi.fn().mockReturnValue(popup)
    const wait = vi.fn().mockResolvedValue({ status: 'ok' })
    const { client, renderTree, render } = loadClient(undefined, { open }, wait)
    const { ctx, entries, api, llm } = context(client)
    await client.apply(ctx)
    const tree = renderTree(entries[0].component)
    const findButton = (node: any): any => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'button' && node.props?.key === provider) return node
      for (const child of Array.isArray(node) ? node : node.children || []) {
        const found = findButton(child)
        if (found) return found
      }
    }
    const connecting = findButton(tree).props.onClick()
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(api.startOAuth).toHaveBeenCalledWith(provider, expect.any(AbortSignal))
    await connecting
    expect(popup.location.href).toBe('https://example.com/oauth')
    expect(wait).toHaveBeenCalledWith(api, 'oauth-state', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(api.listAccounts).toHaveBeenCalledOnce()
    expect(llm.listModels).toHaveBeenCalledWith('universal-chat-provider')
    expect(render(entries[0].component)).toContain('1 modelos disponibles')
  })

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

  it('reports remote failure envelopes without crashing the page', async () => {
    const { client, render } = loadClient()
    const { ctx, entries, api } = context(client)
    api.listAccounts.mockResolvedValue({ ok: false, error: new Error('accounts unavailable') })
    await client.apply(ctx)
    render(entries[0].component)
    await new Promise(resolve => setImmediate(resolve))
    expect(render(entries[0].component)).toContain('accounts unavailable')
  })

  it('resolves application without returning the injected fiber', async () => {
    const { client } = loadClient()
    const { ctx } = context(client)
    await expect(client.apply(ctx)).resolves.toBeUndefined()
  })
})
