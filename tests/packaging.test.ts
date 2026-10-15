import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

describe('Git installation package', () => {
  it('exposes the actual DSH bundle at the repository root', () => {
    expect(pkg.name).toBe('universal-provider')
    expect(pkg.private).not.toBe(true)
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
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
  })

  it('has source entrypoints in the root build configuration', () => {
    const config = readFileSync(new URL('tsdown.config.ts', root), 'utf8')
    expect(config).toContain('src/index.ts')
    expect(config).toContain('src/client/index.ts')
  })
})
