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

  // Register in settings.section slot
  if (ctx.slots && typeof ctx.slots.inject === 'function') {
    ctx.slots.inject('settings.section', () => {
      ctx.slots.register({
        name: 'settings.section',
        id: 'universal-provider',
        order: 25,
        label: () => 'Universal Provider',
      }, function UniversalProviderSettingsView(props: any) {
        const React = typeof require !== 'undefined' ? require('react') : (window as any).React
        const h = React.createElement
        const useState = React.useState
        const useEffect = React.useEffect

        const [tab, setTab] = useState('status')
        const [status, setStatus] = useState<any>(null)
        const [accounts, setAccounts] = useState<any[]>([])
        const [endpoints, setEndpoints] = useState<any[]>([])
        const [quotas, setQuotas] = useState<any[]>([])
        const [logs, setLogs] = useState<string[]>([])
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState<string | null>(null)

        // Form state for OAuth
        const [selectedOAuthProvider, setSelectedOAuthProvider] = useState('codex')
        const [oauthSession, setOauthSession] = useState<any>(null)
        const [oauthStatus, setOauthStatus] = useState<string>('')

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
          refreshStatus()
        }, [])

        const handleStartOAuth = async () => {
          if (!remote) return
          setError(null)
          try {
            const res = await remote.startOAuth(selectedOAuthProvider)
            setOauthSession(res)
            setOauthStatus('wait')
            window.open(res.url, '_blank')

            // Start polling
            const pollInterval = setInterval(async () => {
              try {
                const poll = await remote.pollOAuth(res.state)
                if (poll.status === 'ok') {
                  setOauthStatus('ok')
                  clearInterval(pollInterval)
                  refreshAccounts()
                } else if (poll.status === 'error') {
                  setOauthStatus('error')
                  setError(poll.error || 'OAuth error')
                  clearInterval(pollInterval)
                }
              } catch {
                clearInterval(pollInterval)
              }
            }, 2000)
          } catch (e: any) {
            setError(e?.message || 'Failed to start OAuth')
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
            h('div', { style: { marginBottom: '20px', padding: '16px', background: 'var(--dsw-alias-bg-surface-secondary, #1e293b)', borderRadius: '8px' } }, [
              h('h3', { style: { margin: '0 0 12px', fontSize: '15px' } }, 'Añadir Nueva Cuenta OAuth'),
              h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, [
                h('select', {
                  value: selectedOAuthProvider,
                  onChange: (e: any) => setSelectedOAuthProvider(e.target.value),
                  style: { padding: '8px 12px', borderRadius: '6px', background: '#0f172a', color: '#ffffff', border: '1px solid #475569' },
                }, [
                  h('option', { value: 'codex' }, 'OpenAI Codex / ChatGPT'),
                  h('option', { value: 'claude' }, 'Anthropic Claude'),
                  h('option', { value: 'antigravity' }, 'Google Antigravity'),
                  h('option', { value: 'kimi' }, 'Moonshot Kimi'),
                  h('option', { value: 'xai' }, 'xAI Grok'),
                  h('option', { value: 'devin' }, 'Devin'),
                  h('option', { value: 'meta' }, 'Meta Muse'),
                ]),
                h('button', {
                  onClick: handleStartOAuth,
                  style: {
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'var(--dsw-alias-accent, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  },
                }, 'Iniciar Inicio de Sesión'),
              ]),
              oauthStatus === 'wait' ? h('div', { style: { marginTop: '12px', color: '#38bdf8', fontSize: '13px' } }, [
                'Autorización abierta en el navegador. Esperando confirmación...',
                oauthSession?.userCode ? h('div', null, `Código de usuario: ${oauthSession.userCode}`) : null,
              ]) : null,
              oauthStatus === 'ok' ? h('div', { style: { marginTop: '12px', color: '#4ade80', fontSize: '13px' } }, '¡Cuenta vinculada con éxito!') : null,
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
      })
    })
  }
}
