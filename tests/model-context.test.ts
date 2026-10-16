import { describe, expect, it } from 'vitest'
import { modelContextOptions } from '../src/core/models/context.ts'

describe('model context discovery', () => {
  it('uses catalog input/output limits for endpoints', () => {
    const result = modelContextOptions({ id: 'endpoint-model' }, undefined, {
      router: new Map(),
      modelsDev: new Map([['endpoint-model', { id: 'endpoint-model', context_length: 900000, max_completion_tokens: 100000 }]]),
    })
    expect(result).toEqual({ outputTokens: 100000, options: [{ value: 900000, label: '1M' }] })
  })

  it.each([128000, 64000, -1, NaN, Infinity])('does not invent an extended option for maximum %s', maximum => {
    expect(modelContextOptions({ id: 'test', context_length: 128000 }, {
      slug: 'test', max_context_window: maximum,
    }).options.map(option => option.value)).toEqual([128000])
  })

  it('uses an advertised maximum even when the base is missing', () => {
    expect(modelContextOptions({ id: 'test' }, { slug: 'test', max_context_window: 2000000 }).options.map(option => option.value)).toEqual([2000000])
  })
})
