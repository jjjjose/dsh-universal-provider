import { expectRemote } from './remote-result.ts'

export interface OAuthFlowRemote {
  // Remote methods may resolve either the Typert result envelope or a raw
  // value; `waitForOAuth` unwraps each response with `expectRemote`.
  pollOAuth(state: string, signal?: AbortSignal): Promise<unknown>
  cancelOAuth(state: string): Promise<unknown>
}

export type OAuthFlowResult =
  | { status: 'ok' }
  | { status: 'error'; error: string }
  | { status: 'timeout'; error?: string }
  | { status: 'cancelled' }

export interface OAuthFlowOptions {
  signal?: AbortSignal
  intervalMs?: number
  timeoutMs?: number
  now?: () => number
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/** Poll an active OAuth session until it settles, times out, or is cancelled. */
export async function waitForOAuth(
  remote: OAuthFlowRemote,
  state: string,
  options: OAuthFlowOptions = {},
): Promise<OAuthFlowResult> {
  const intervalMs = options.intervalMs ?? 1500
  const deadline = (options.now ?? Date.now)() + (options.timeoutMs ?? 180_000)
  let lastError: string | undefined

  while (!options.signal?.aborted && (options.now ?? Date.now)() < deadline) {
    await (options.delay ?? delay)(Math.min(intervalMs, Math.max(0, deadline - (options.now ?? Date.now)())), options.signal)
    if (options.signal?.aborted) break

    try {
      const result = await expectRemote<{ status: 'wait' | 'ok' | 'error'; error?: string }>(remote.pollOAuth(state, options.signal))
      if (result.status === 'ok') return { status: 'ok' }
      if (result.status === 'error') return { status: 'error', error: result.error || 'OAuth sign-in failed.' }
    } catch (error: any) {
      // Transient polling failures should not discard a login already in progress.
      lastError = error?.message || String(error)
    }
  }

  await expectRemote(remote.cancelOAuth(state)).catch(() => undefined)
  return options.signal?.aborted
    ? { status: 'cancelled' }
    : { status: 'timeout', ...(lastError ? { error: lastError } : {}) }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', finish, { once: true })
  })
}
