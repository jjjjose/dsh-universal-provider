import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

describe('Git installation package', () => {
  it('exposes the actual DSH bundle at the repository root', () => {
    expect(pkg.name).toBe('universal-provider')
    expect(pkg.private).not.toBe(true)
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh.client.immediately).toBe(true)
    const clientEntry = readFileSync(new URL('src/client/index.ts', root), 'utf8')
    expect(clientEntry).toContain("export const inject = ['slots']")
    expect(clientEntry).toContain("ctx.slots.inject('plugins.bundle.config'")
    expect(clientEntry).toContain("key: 'universal-provider'")
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
