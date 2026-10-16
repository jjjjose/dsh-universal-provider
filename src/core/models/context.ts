import { matchCatalogModel } from './catalog-match.ts'
import type { ModelCatalogs } from './catalog.ts'
import type { ProxyModelListEntry, ProxyModelMetadata } from './model.ts'

const oauthOwners = new Set(['openai', 'anthropic', 'google', 'moonshot', 'xai', 'antigravity', 'cognition', 'meta'])
const tokenFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function firstPositive(...values: (number | undefined)[]): number | undefined {
  return values.find(value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
}

export function modelContextOptions(entry: ProxyModelListEntry, metadata: ProxyModelMetadata | undefined, catalogs?: ModelCatalogs) {
  const oauth = oauthOwners.has(entry.owned_by?.toLowerCase() ?? '')
  const catalog = catalogs && (matchCatalogModel(entry.id, oauth ? catalogs.router : catalogs.modelsDev)
    ?? matchCatalogModel(entry.id, oauth ? catalogs.modelsDev : catalogs.router))
  const base = firstPositive(entry.context_length, metadata?.context_window, catalog?.context_length, catalog?.inputTokenLimit)
  const maximum = firstPositive(metadata?.max_context_window)
  const outputTokens = firstPositive(entry.max_completion_tokens, catalog?.max_completion_tokens, catalog?.outputTokenLimit) ?? 4096
  const sizes = base === undefined ? [] : [base]
  if (maximum !== undefined && (base === undefined || maximum > base)) sizes.push(maximum)
  // Preserve usability for endpoints that do not publish any limits.
  if (!sizes.length) {
    return { outputTokens, options: [{ value: 1000000, label: '1M (sin metadatos)' }] }
  }
  return {
    outputTokens,
    options: sizes.map(value => ({ value, label: tokenFormat.format(value + outputTokens) })),
  }
}
