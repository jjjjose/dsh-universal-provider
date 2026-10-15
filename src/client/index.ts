import { waitForOAuth } from './oauth-flow.ts'

export const inject = ['slots']

export function apply(ctx: any) {
  // Mount Remote descriptors
  if (ctx.remote && typeof ctx.remote.$mount === 'function') {
    try {
      const remote = require('universal-provider/remote')
      if (remote && remote.default) {
        ctx.remote.$mount(remote.default)
      }
    } catch {}
  }

  // Register this management page inside Plugins → Universal Provider.
  if (ctx.slots && typeof ctx.slots.inject === 'function') {
    const dispose = ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: 'universal-provider',
      label: () => 'Universal Provider',
    }, function UniversalProviderSettingsView(props: any) {
        const React = typeof require !== 'undefined' ? require('react') : (window as any).React
        const h = React.createElement
        const useState = React.useState as <T>(initial: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void]
        const useEffect = React.useEffect

        const [tab, setTab] = useState('accounts')
        const [status, setStatus] = useState<any>(null)
        const [accounts, setAccounts] = useState<any[]>([])
        const [endpoints, setEndpoints] = useState<any[]>([])
        const [quotas, setQuotas] = useState<any[]>([])
        const [logs, setLogs] = useState<string[]>([])
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState<string | null>(null)

        // OAuth flow state. The stable holder lets unmount cleanup cancel the active attempt.
        const [otherOAuthProvider, setOtherOAuthProvider] = useState('claude')
        const [oauthSession, setOauthSession] = useState<any>(null)
        const [oauthProvider, setOauthProvider] = useState<string | null>(null)
        const [oauthStatus, setOauthStatus] = useState<string>('')
        const oauthFlow = useState(() => ({ controller: null as AbortController | null, mounted: true }))[0]
        const [availableModels, setAvailableModels] = useState<any[]>([])

        // Form state for OpenAI endpoints
        const [newEndpointName, setNewEndpointName] = useState('')
        const [newEndpointUrl, setNewEndpointUrl] = useState('')
        const [newEndpointKey, setNewEndpointKey] = useState('')

        const remote = ctx.remote?.universalProvider

        const refreshStatus = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const st = await remote.getState()
            setStatus(st)
          } catch (e: any) {
            setError(e?.message || 'Error fetching status')
          } finally {
            setLoading(false)
          }
        }

        const refreshAccounts = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const list = await remote.listAccounts()
            setAccounts(list || [])
          } catch (e: any) {
            setError(e?.message || 'Error fetching accounts')
          } finally {
            setLoading(false)
          }
        }

        const refreshEndpoints = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const list = await remote.listEndpoints()
            setEndpoints(list || [])
          } catch (e: any) {
            setError(e?.message || 'Error fetching endpoints')
          } finally {
            setLoading(false)
          }
        }

        const refreshQuotas = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const q = await remote.getQuotas()
            setQuotas(q || [])
          } catch (e: any) {
            setError(e?.message || 'Error fetching quotas')
          } finally {
            setLoading(false)
          }
        }

        const refreshLogs = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const l = await remote.getRecentLogs()
            setLogs(l || [])
          } catch (e: any) {
            setError(e?.message || 'Error fetching logs')
          } finally {
            setLoading(false)
          }
        }

        useEffect(() => {
          oauthFlow.mounted = true
          if (props.view === 'page') refreshStatus()
          return () => {
            oauthFlow.mounted = false
            oauthFlow.controller?.abort()
          }
        }, [props.view])

        const refreshModelList = async () => {
          const llmRemote = ctx.remote?.llm
          if (!llmRemote || typeof llmRemote.listModels !== 'function') {
            setError('La cuenta se conectó, pero no está disponible la consulta nativa de modelos de DSH.')
            return
          }
          try {
            const list = await llmRemote.listModels('universal-chat-provider')
            setAvailableModels(list || [])
          } catch (e: any) {
            setError(e?.message || 'La cuenta se conectó, pero no se pudieron actualizar los modelos.')
          }
        }

        const handleStartOAuth = async (provider: string) => {
          if (!remote || oauthFlow.controller) return
          setError(null)
          setOauthProvider(provider)
          setOauthSession(null)
          setOauthStatus('starting')
          const controller = new AbortController()
          oauthFlow.controller = controller
          // Open synchronously during the user gesture so the browser does not block the OAuth redirect.
          const popup = window.open('', '_blank')
          try {
            const res = await remote.startOAuth(provider, controller.signal)
            if (controller.signal.aborted) {
              await remote.cancelOAuth(res.state).catch(() => undefined)
              if (popup && !popup.closed) popup.close()
              return
            }
            setOauthSession(res)
            setOauthStatus('wait')
            if (popup && !popup.closed) popup.location.href = res.url
            else setError('El navegador bloqueó la ventana. Abre manualmente el enlace de autorización mostrado abajo.')

            const result = await waitForOAuth(remote, res.state, { signal: controller.signal })
            if (!oauthFlow.mounted) return
            if (result.status === 'ok') {
              setOauthStatus('ok')
              await refreshAccounts()
              await refreshModelList()
            } else if (result.status === 'error') {
              setOauthStatus('error')
              setError(result.error)
            } else if (result.status === 'timeout') {
              setOauthStatus('timeout')
              setError(result.error
                ? `No se completó el inicio de sesión a tiempo. Último error: ${result.error}`
                : 'No se completó el inicio de sesión en 3 minutos. Puedes intentarlo de nuevo.')
            } else {
              setOauthStatus('cancelled')
            }
          } catch (e: any) {
            if (popup && !popup.closed) popup.close()
            setOauthStatus('error')
            setError(e?.message || 'No se pudo iniciar el inicio de sesión OAuth.')
          } finally {
            if (oauthFlow.controller === controller) oauthFlow.controller = null
          }
        }

        const handleDeleteAccount = async (name: string) => {
          if (!remote) return
          if (!confirm(`¿Eliminar cuenta "${name}"?`)) return
          try {
            await remote.deleteAccount(name)
            refreshAccounts()
          } catch (e: any) {
            setError(e?.message || 'Failed to delete account')
          }
        }

        const handleAddEndpoint = async () => {
          if (!remote || !newEndpointName || !newEndpointUrl) return
          try {
            await remote.saveEndpoint({
              name: newEndpointName,
              baseUrl: newEndpointUrl,
              apiKey: newEndpointKey || undefined,
            })
            setNewEndpointName('')
            setNewEndpointUrl('')
            setNewEndpointKey('')
            refreshEndpoints()
          } catch (e: any) {
            setError(e?.message || 'Failed to save endpoint')
          }
        }

        const tabButton = (id: string, label: string) => h('button', {
          key: id,
          onClick: () => {
            setTab(id)
            setError(null)
            if (id === 'status') refreshStatus()
            if (id === 'accounts') refreshAccounts()
            if (id === 'endpoints') refreshEndpoints()
            if (id === 'quotas') refreshQuotas()
            if (id === 'logs') refreshLogs()
          },
          style: {
            padding: '8px 16px',
            marginRight: '8px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: tab === id ? 'var(--dsw-alias-accent, #3b82f6)' : 'var(--dsw-alias-bg-surface-secondary, #334155)',
            color: '#ffffff',
            fontWeight: tab === id ? '600' : '400',
            fontSize: '13px',
          },
        }, label)

        if (props.view === 'summary') {
          return h('span', null, 'Conecta y administra tus cuentas de Antigravity, ChatGPT/Codex y otros proveedores.')
        }

        return h('div', {
          style: {
            padding: '24px',
            fontFamily: 'var(--dsw-font-sans, system-ui, sans-serif)',
            color: 'var(--dsw-alias-text-primary, #e2e8f0)',
            maxWidth: '800px',
          },
        }, [
          h('div', { key: 'header', style: { marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', null, [
              h('h2', { style: { margin: 0, fontSize: '20px', fontWeight: 600 } }, 'Universal Provider'),
              h('p', { style: { margin: '4px 0 0', fontSize: '13px', color: 'var(--dsw-alias-text-secondary, #94a3b8)' } },
                'Cuentas OAuth y endpoints OpenAI compatibles para DeepSeek Harness.'),
            ]),
            props.close ? h('button', {
              onClick: props.close,
              style: {
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--dsw-alias-border, #475569)',
                background: 'transparent',
                color: 'var(--dsw-alias-text-primary, #e2e8f0)',
                cursor: 'pointer',
              },
            }, 'Cerrar') : null,
          ]),

          h('div', { key: 'tabs', style: { marginBottom: '20px', borderBottom: '1px solid var(--dsw-alias-border, #334155)', paddingBottom: '12px' } }, [
            tabButton('status', 'Estado'),
            tabButton('accounts', 'Cuentas OAuth'),
            tabButton('endpoints', 'Endpoints'),
            tabButton('quotas', 'Cuotas'),
            tabButton('logs', 'Diagnóstico'),
          ]),

          error ? h('div', {
            key: 'error',
            style: {
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px',
            },
          }, error) : null,

          // Tab: Status
          tab === 'status' ? h('div', { key: 'status-content', style: { lineHeight: '1.6' } }, [
            h('div', { style: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', fontSize: '14px' } }, [
              h('span', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, 'Estado:'),
              h('span', { style: { fontWeight: 600, color: status?.status === 'ready' ? '#4ade80' : '#f87171' } }, status?.status || 'desconocido'),

              h('span', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, 'Modo:'),
              h('span', null, status?.mode || 'managed'),

              h('span', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, 'URL Servidor:'),
              h('span', null, status?.baseUrl || '-'),

              h('span', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, 'Versión:'),
              h('span', null, status?.version || '-'),

              h('span', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, 'Peticiones activas:'),
              h('span', null, String(status?.activeRequests ?? 0)),
            ]),
            h('button', {
              onClick: refreshStatus,
              style: {
                marginTop: '16px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid var(--dsw-alias-border, #475569)',
                background: 'var(--dsw-alias-bg-surface-secondary, #334155)',
                color: '#ffffff',
                cursor: 'pointer',
              },
            }, loading ? 'Actualizando...' : 'Actualizar Estado'),
          ]) : null,

          // Tab: OAuth Accounts
          tab === 'accounts' ? h('div', { key: 'accounts-content' }, [
            h('div', { style: { marginBottom: '20px', padding: '16px', background: 'var(--dsw-alias-bg-surface-secondary)', border: '1px solid var(--dsw-alias-border)', borderRadius: '8px' } }, [
              h('h3', { style: { margin: '0 0 6px', fontSize: '15px' } }, 'Vincula tus cuentas'),
              h('p', { style: { margin: '0 0 14px', fontSize: '13px', color: 'var(--dsw-alias-text-secondary)' } }, 'Autoriza en el navegador. Puedes agregar varias cuentas del mismo proveedor; sus modelos aparecerán en el selector de DSH.'),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' } }, [
                ['antigravity', 'Google Antigravity', 'Vincular cuenta de Google'],
                ['codex', 'ChatGPT / OpenAI Codex', 'Vincular cuenta de ChatGPT'],
              ].map(([provider, label, detail]: any) => h('button', {
                key: provider,
                type: 'button',
                disabled: !!oauthFlow.controller,
                onClick: () => handleStartOAuth(provider),
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--dsw-alias-border)',
                  background: 'var(--dsw-alias-bg-surface)',
                  color: 'var(--dsw-alias-text-primary)',
                  opacity: oauthFlow.controller ? 0.65 : 1,
                  cursor: oauthFlow.controller ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                },
              }, [
                h('strong', { style: { fontSize: '14px' } }, oauthProvider === provider && oauthStatus === 'starting' ? 'Conectando…' : `Conectar ${label}`),
                h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary)' } }, detail),
              ]))),
              h('details', { style: { marginTop: '14px' } }, [
                h('summary', { style: { color: 'var(--dsw-alias-text-secondary)', cursor: 'pointer', fontSize: '13px' } }, 'Otros proveedores OAuth'),
                h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, [
                  h('select', {
                    value: otherOAuthProvider,
                    disabled: !!oauthFlow.controller,
                    onChange: (e: any) => setOtherOAuthProvider(e.target.value),
                    style: { padding: '8px 12px', borderRadius: '6px', background: 'var(--dsw-alias-bg-surface)', color: 'var(--dsw-alias-text-primary)', border: '1px solid var(--dsw-alias-border)' },
                  }, [
                    h('option', { value: 'claude' }, 'Anthropic Claude'),
                    h('option', { value: 'kimi' }, 'Moonshot Kimi'),
                    h('option', { value: 'xai' }, 'xAI Grok'),
                    h('option', { value: 'devin' }, 'Devin'),
                    h('option', { value: 'meta' }, 'Meta Muse'),
                  ]),
                  h('button', {
                    type: 'button',
                    disabled: !!oauthFlow.controller,
                    onClick: () => handleStartOAuth(otherOAuthProvider),
                    style: { padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border)', background: 'transparent', color: 'var(--dsw-alias-text-primary)', cursor: oauthFlow.controller ? 'not-allowed' : 'pointer' },
                  }, 'Conectar'),
                ]),
              ]),
              oauthStatus === 'starting' ? h('div', { style: { marginTop: '12px', color: 'var(--dsw-alias-text-secondary)', fontSize: '13px' } }, `Preparando inicio de sesión de ${oauthProvider}…`) : null,
              oauthStatus === 'wait' ? h('div', { style: { marginTop: '12px', fontSize: '13px', color: 'var(--dsw-alias-text-primary)' } }, [
                `Esperando confirmación de ${oauthProvider} en el navegador…`,
                oauthSession?.userCode ? h('div', { style: { marginTop: '6px', fontWeight: 600 } }, `Código de usuario: ${oauthSession.userCode}`) : null,
                oauthSession?.url ? h('a', { href: oauthSession.url, target: '_blank', rel: 'noopener noreferrer', style: { display: 'inline-block', marginTop: '6px', color: 'var(--dsw-alias-accent)' } }, 'Abrir autorización manualmente') : null,
                h('button', { type: 'button', onClick: () => oauthFlow.controller?.abort(), style: { display: 'block', marginTop: '8px', padding: '5px 10px', border: '1px solid var(--dsw-alias-border)', borderRadius: '6px', background: 'transparent', color: 'var(--dsw-alias-text-primary)', cursor: 'pointer' } }, 'Cancelar'),
              ]) : null,
              oauthStatus === 'ok' ? h('div', { style: { marginTop: '12px', fontSize: '13px', color: 'var(--dsw-alias-text-primary)' } }, [
                'Cuenta vinculada correctamente.',
                availableModels.length ? h('div', { style: { marginTop: '5px', color: 'var(--dsw-alias-text-secondary)' } }, `${availableModels.length} modelos disponibles en el selector de DSH.`) : null,
              ]) : null,
            ]),

            h('h3', { style: { margin: '0 0 12px', fontSize: '15px' } }, 'Cuentas Registradas'),
            accounts.length === 0 ? h('p', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)', fontSize: '13px' } }, 'No hay cuentas registradas.') : null,
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, accounts.map(acc => h('div', {
              key: acc.name,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--dsw-alias-bg-surface-secondary, #1e293b)',
                borderRadius: '6px',
              },
            }, [
              h('div', null, [
                h('div', { style: { fontWeight: 600, fontSize: '14px' } }, acc.label || acc.email || acc.name),
                h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, `Proveedor: ${acc.provider || acc.type || 'desconocido'}`),
              ]),
              h('button', {
                onClick: () => handleDeleteAccount(acc.name),
                style: {
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '12px',
                },
              }, 'Eliminar'),
            ]))),
          ]) : null,

          // Tab: Endpoints
          tab === 'endpoints' ? h('div', { key: 'endpoints-content' }, [
            h('div', { style: { marginBottom: '20px', padding: '16px', background: 'var(--dsw-alias-bg-surface-secondary, #1e293b)', borderRadius: '8px' } }, [
              h('h3', { style: { margin: '0 0 12px', fontSize: '15px' } }, 'Añadir Endpoint OpenAI Compatible'),
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' } }, [
                h('input', {
                  placeholder: 'Nombre (ej: Local Ollama)',
                  value: newEndpointName,
                  onChange: (e: any) => setNewEndpointName(e.target.value),
                  style: { padding: '8px 12px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: '1px solid #475569' },
                }),
                h('input', {
                  placeholder: 'URL Base (ej: http://localhost:11434/v1)',
                  value: newEndpointUrl,
                  onChange: (e: any) => setNewEndpointUrl(e.target.value),
                  style: { padding: '8px 12px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: '1px solid #475569' },
                }),
              ]),
              h('div', { style: { marginBottom: '10px' } }, [
                h('input', {
                  placeholder: 'API Key (opcional para local)',
                  type: 'password',
                  value: newEndpointKey,
                  onChange: (e: any) => setNewEndpointKey(e.target.value),
                  style: { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: '1px solid #475569' },
                }),
              ]),
              h('button', {
                onClick: handleAddEndpoint,
                style: {
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: 'var(--dsw-alias-accent, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                },
              }, 'Guardar Endpoint'),
            ]),

            h('h3', { style: { margin: '0 0 12px', fontSize: '15px' } }, 'Endpoints Configurados'),
            endpoints.length === 0 ? h('p', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)', fontSize: '13px' } }, 'No hay endpoints adicionales.') : null,
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, endpoints.map(ep => h('div', {
              key: ep.name,
              style: {
                padding: '12px 16px',
                background: 'var(--dsw-alias-bg-surface-secondary, #1e293b)',
                borderRadius: '6px',
              },
            }, [
              h('div', { style: { fontWeight: 600, fontSize: '14px' } }, ep.name),
              h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, ep.baseUrl),
            ]))),
          ]) : null,

          // Tab: Quotas
          tab === 'quotas' ? h('div', { key: 'quotas-content' }, [
            h('div', { style: { marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              h('h3', { style: { margin: 0, fontSize: '15px' } }, 'Cuotas de Proveedores'),
              h('button', {
                onClick: refreshQuotas,
                style: {
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--dsw-alias-border, #475569)',
                  background: 'transparent',
                  color: 'var(--dsw-alias-text-primary, #e2e8f0)',
                  cursor: 'pointer',
                },
              }, loading ? 'Consultando...' : 'Refrescar Cuotas'),
            ]),
            quotas.length === 0 ? h('p', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)', fontSize: '13px' } }, 'No se encontraron reportes de cuotas.') : null,
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, quotas.map((q, idx) => h('div', {
              key: `${q.provider}-${idx}`,
              style: {
                padding: '14px 16px',
                background: 'var(--dsw-alias-bg-surface-secondary, #1e293b)',
                borderRadius: '6px',
              },
            }, [
              h('div', { style: { fontWeight: 600, fontSize: '14px', marginBottom: '8px' } },
                `${q.provider.toUpperCase()} ${q.account?.label ? `(${q.account.label})` : ''}`),
              q.error ? h('div', { style: { color: '#f87171', fontSize: '12px' } }, q.error) : null,
              h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } }, q.windows?.map((w: any) => h('div', {
                key: w.label,
                style: {
                  padding: '8px 12px',
                  background: '#0f172a',
                  borderRadius: '6px',
                  fontSize: '12px',
                },
              }, [
                h('div', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, w.label),
                h('div', { style: { fontSize: '16px', fontWeight: 600, color: '#38bdf8' } },
                  w.remainingPercent !== undefined ? `${Math.round(w.remainingPercent)}%` : '-'),
              ]))),
            ]))),
          ]) : null,

          // Tab: Diagnostic Logs
          tab === 'logs' ? h('div', { key: 'logs-content' }, [
            h('div', { style: { marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
              h('h3', { style: { margin: 0, fontSize: '15px' } }, 'Registros Recientes (Redactados)'),
              h('button', {
                onClick: refreshLogs,
                style: {
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--dsw-alias-border, #475569)',
                  background: 'transparent',
                  color: 'var(--dsw-alias-text-primary, #e2e8f0)',
                  cursor: 'pointer',
                },
              }, loading ? 'Cargando...' : 'Refrescar Logs'),
            ]),
            h('pre', {
              style: {
                padding: '12px',
                background: '#090d16',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '350px',
                color: '#cbd5e1',
                lineHeight: '1.4',
              },
            }, logs.length > 0 ? logs.join('\n') : 'Sin registros disponibles.'),
          ]) : null,
        ])
    }))
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => dispose(), 'universal-provider: plugin config page')
    }
  }
}
