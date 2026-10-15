/**
 * Typert Remote invocations resolve a result envelope, never the raw value:
 * every gateway-mounted namespace method answers `{ ok: true, value }` or
 * `{ ok: false, error }`. Unwrapping here keeps panel state from holding the
 * envelope (which crashed the account list) and rethrows the Remote failure so
 * the existing error paths still report it.
 */
export interface RemoteResultEnvelope<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: unknown
}

function isEnvelope(value: unknown): value is RemoteResultEnvelope<unknown> {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { ok?: unknown }).ok === 'boolean'
    && ('value' in value || 'error' in value)
}

/** Settle one remote invocation, unwrapping its result envelope. */
export async function expectRemote<T>(invocation: Promise<unknown>): Promise<T> {
  const result = await invocation
  if (!isEnvelope(result)) return result as T
  if (result.ok) return result.value as T
  const error = result.error
  if (error instanceof Error) throw error
  const message = error !== null && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : String(error)
  throw new Error(message)
}
