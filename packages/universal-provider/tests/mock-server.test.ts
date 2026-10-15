import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import { CLIProxyClient } from '../src/core/api/proxy-client.ts'
import { ManagementClient } from '../src/core/api/management-client.ts'
import { fetchQuotas } from '../src/core/quota/quota.ts'

describe('CLIProxyAPI End-to-End Mock Integration', () => {
  let server: http.Server
  let baseUrl: string
  const apiKey = 'test-api-key'
  const mgmtKey = 'test-mgmt-key'

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const auth = req.headers.authorization

      // Auth validation
      if (!auth) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      if (url.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        if (url.searchParams.get('client_version')) {
          res.end(JSON.stringify({
            models: [
              {
                slug: 'claude-3-7-sonnet',
                display_name: 'Claude 3.7 Sonnet',
                context_window: 200000,
                input_modalities: ['text', 'image'],
                supported_reasoning_levels: [{ effort: 'high' }],
              },
            ],
          }))
        } else {
          res.end(JSON.stringify({
            data: [
              { id: 'claude-3-7-sonnet', owned_by: 'anthropic', context_length: 200000 },
            ],
          }))
        }
        return
      }

      if (url.pathname === '/v1/responses' && req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        res.write('data: {"type":"response.reasoning_text.delta","delta":"Analyzing input..."}\n\n')
        res.write('data: {"type":"response.output_text.delta","delta":"Here is the result: "}\n\n')
        res.write('data: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"c-1","name":"exec"}}\n\n')
        res.write('data: {"type":"response.function_call_arguments.delta","delta":"{\\"cmd\\":\\"test\\"}"}\n\n')
        res.write('data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"c-1","name":"exec","arguments":"{\\"cmd\\":\\"test\\"}"}}\n\n')
        res.write('data: {"type":"response.completed","response":{"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}}\n\n')
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }

      if (url.pathname === '/v8/management/oauth/auth-url') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          url: 'https://auth.openai.com/oauth',
          state: 'test-oauth-state',
          user_code: 'ABCD-5678',
        }))
        return
      }

      if (url.pathname === '/v8/management/oauth/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
        return
      }

      if (url.pathname === '/v8/management/credentials') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'x-cpa-version': '8.0.3' })
        res.end(JSON.stringify({
          files: [
            {
              name: 'codex-acc',
              auth_index: 'auth-idx-1',
              provider: 'codex',
              email: 'user@example.com',
            },
          ],
        }))
        return
      }

      if (url.pathname === '/v8/management/requests/api-call' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status_code: 200,
          header: {},
          body: JSON.stringify({
            rate_limit: {
              primary_window: { used_percent: 25, limit_window_seconds: 18000 },
              secondary_window: { used_percent: 50, limit_window_seconds: 604800 },
            },
          }),
        }))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port
        baseUrl = `http://127.0.0.1:${port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise(r => server.close(r))
  })

  it('performs model discovery against mock server', async () => {
    const client = new CLIProxyClient(baseUrl, apiKey)
    const discovery = await client.discover()

    expect(discovery.available).toHaveLength(1)
    expect(discovery.available[0]?.id).toBe('claude-3-7-sonnet')
    expect(discovery.metadata[0]?.display_name).toBe('Claude 3.7 Sonnet')
  })

  it('streams text, thinking, and tool calls from mock SSE', async () => {
    const client = new CLIProxyClient(baseUrl, apiKey)

    const texts: string[] = []
    const thinkings: string[] = []
    const tools: any[] = []
    let usage: any

    await client.streamResponse({
      model: 'claude-3-7-sonnet',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'hello' }] }],
      stream: true,
    }, {
      onText: delta => texts.push(delta),
      onThinking: delta => thinkings.push(delta),
      onToolCall: (callId, name, input) => tools.push({ callId, name, input }),
      onUsage: u => usage = u,
    })

    expect(texts.join('')).toBe('Here is the result: ')
    expect(thinkings.filter(Boolean).join('')).toBe('Analyzing input...')
    expect(tools).toHaveLength(1)
    expect(tools[0]).toEqual({
      callId: 'c-1',
      name: 'exec',
      input: { cmd: 'test' },
    })
    expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 })
  })

  it('executes OAuth workflow against management client', async () => {
    const mgmt = new ManagementClient(baseUrl, mgmtKey)

    const session = await mgmt.requestAuthUrl('codex')
    expect(session.url).toBe('https://auth.openai.com/oauth')
    expect(session.state).toBe('test-oauth-state')
    expect(session.userCode).toBe('ABCD-5678')

    const status = await mgmt.getAuthStatus(session.state)
    expect(status.status).toBe('ok')

    const version = await mgmt.serverVersion()
    expect(version).toBe('8.0.3')
  })

  it('fetches quota information via api-call', async () => {
    const mgmt = new ManagementClient(baseUrl, mgmtKey)
    const quotas = await fetchQuotas(mgmt)

    expect(quotas).toHaveLength(1)
    expect(quotas[0]?.provider).toBe('codex')
    expect(quotas[0]?.windows).toHaveLength(2)
    expect(quotas[0]?.windows[0]?.remainingPercent).toBe(75) // 100 - 25%
    expect(quotas[0]?.windows[1]?.remainingPercent).toBe(50) // 100 - 50%
  })
})
