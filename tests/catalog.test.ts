import { describe, expect, it } from 'vitest'
import { matchCatalogModel } from '../src/core/models/catalog-match.ts'
import type { CatalogModel } from '../src/core/models/catalog.ts'

describe('Catalog Matching', () => {
  it('matches exact and suffix-trimmed model IDs', () => {
    const catalog = new Map<string, CatalogModel>([
      ['claude-3-7-sonnet', { id: 'claude-3-7-sonnet', context_length: 200000 }],
      ['gpt-4o', { id: 'gpt-4o', context_length: 128000 }],
    ])

    expect(matchCatalogModel('claude-3-7-sonnet', catalog)?.id).toBe('claude-3-7-sonnet')
    expect(matchCatalogModel('claude-3-7-sonnet-thinking', catalog)?.id).toBe('claude-3-7-sonnet')
    expect(matchCatalogModel('anthropic/claude-3-7-sonnet-online', catalog)?.id).toBe('claude-3-7-sonnet')
    expect(matchCatalogModel('non-existent-model', catalog)).toBeUndefined()
  })
})
