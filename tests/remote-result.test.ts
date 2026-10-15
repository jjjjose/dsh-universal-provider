import { describe, expect, it } from 'vitest'
import { expectRemote } from '../src/client/remote-result.ts'

// DSH's Typert gateway resolves every remote invocation as a RemoteResult
// envelope: `{ ok: true, value }` or `{ ok: false, error }`. `expectRemote`
// unwraps the envelope for callers and turns failure envelopes into throws.
describe('expectRemote RemoteResult unwrapping', () => {
  it('unwraps successful envelopes that carry arrays', async () => {
    const accounts = [{ name: 'saved-account', email: 'saved@example.com' }]
    await expect(expectRemote(Promise.resolve({ ok: true, value: accounts }))).resolves.toBe(accounts)
  })

  it('unwraps successful envelopes whose value is undefined', async () => {
    // The `value` key is present even when empty: the envelope must not leak.
    await expect(expectRemote(Promise.resolve({ ok: true, value: undefined }))).resolves.toBeUndefined()
  })

  it('rethrows the same error carried by failure envelopes', async () => {
    const failure = new Error('accounts unavailable')
    await expect(expectRemote(Promise.resolve({ ok: false, error: failure }))).rejects.toBe(failure)
    await expect(expectRemote(Promise.resolve({ ok: false, error: failure }))).rejects.toThrow('accounts unavailable')
  })

  it('wraps plain-object failures in an Error using their message', async () => {
    await expect(expectRemote(Promise.resolve({ ok: false, error: { message: 'boom' } }))).rejects.toThrow('boom')
  })

  it('wraps non-Error failure payloads with String()', async () => {
    await expect(expectRemote(Promise.resolve({ ok: false, error: 'denied' }))).rejects.toThrow('denied')
  })

  it('passes raw values through unchanged', async () => {
    const models = [{ id: 'test-model' }]
    await expect(expectRemote(Promise.resolve(models))).resolves.toBe(models)
    await expect(expectRemote(Promise.resolve(7))).resolves.toBe(7)
    await expect(expectRemote(Promise.resolve(null))).resolves.toBeNull()
    // A boolean `ok` alone is not an envelope: the value/error key is required.
    await expect(expectRemote(Promise.resolve({ ok: true }))).resolves.toEqual({ ok: true })
  })

  it('propagates transport rejections without wrapping them', async () => {
    const failure = new Error('temporary network error')
    await expect(expectRemote(Promise.reject(failure))).rejects.toBe(failure)
  })
})
