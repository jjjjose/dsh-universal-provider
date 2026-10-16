import { waitForOAuth } from './oauth-flow.ts'
import { expectRemote } from './remote-result.ts'
import { quotaEntries } from './quota-entries.ts'
import type { QuotaReportView } from '../types.ts'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'

export const inject = ['slots', 'remote']

interface ClientContext {
  slots: Pick<SlotRegistry, 'inject' | 'register'>
  remote: any
  inject: (services: string[], callback: (ctx: ClientContext) => void) => unknown
  effect: (callback: () => (() => unknown)) => unknown
}

export async function apply(ctx: ClientContext): Promise<void> {
  try {
    const descriptors = require('universal-provider/remote')
    if (!descriptors?.default) throw new Error('No se encontraron los descriptores remotos de Universal Provider.')
    const unmount = await ctx.remote.$mount(descriptors.default)
    if (typeof unmount === 'function') ctx.effect(() => unmount)
  } catch (error) {
    registerSettings(ctx, `No se pudo inicializar Universal Provider: ${error instanceof Error ? error.message : String(error)}`)
    return
  }
  ctx.inject(['remote.universalProvider', 'slots'], child => registerSettings(child))
}

function registerSettings(ctx: ClientContext, mountError: string | null = null) {
  // Both official configuration slots share the same management page.
  function UniversalProviderSettingsView(props: PluginConfigViewProps) {
        const React = typeof require !== 'undefined' ? require('react') : (window as any).React
        const h = React.createElement
        const useState = React.useState as <T>(initial: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void]
        const useEffect = React.useEffect

        const [tab, setTab] = useState('accounts')
        const [status, setStatus] = useState<any>(null)
        const [accounts, setAccounts] = useState<any[]>([])
        const [endpoints, setEndpoints] = useState<any[]>([])
        const [quotas, setQuotas] = useState<QuotaReportView[]>([])
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
        const [modelsStatus, setModelsStatus] = useState('idle')
        const [contextDrafts, setContextDrafts] = useState<Record<string, string>>({})
        const [savingContext, setSavingContext] = useState<string | null>(null)

        const saveModelContext = async (model: string, contextWindow: number) => {
          if (!remote) return
          setSavingContext(model)
          setError(null)
          try {
            await expectRemote(remote.setModelContext({ model, contextWindow }))
            setAvailableModels(previous => previous.map(item => item.id === model ? { ...item, contextWindow } : item))
          } catch (e: any) {
            setError(e?.message || 'No se pudo guardar el contexto.')
          } finally {
            setSavingContext(null)
          }
        }

        // Form state for OpenAI endpoints
        const [newEndpointName, setNewEndpointName] = useState('')
        const [newEndpointUrl, setNewEndpointUrl] = useState('')
        const [newEndpointKey, setNewEndpointKey] = useState('')

        const remote = mountError ? null : ctx.remote.universalProvider

        const refreshStatus = async () => {
          if (!remote) return
          setLoading(true)
          try {
            const st = await expectRemote<any>(remote.getState())
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
            const list = await expectRemote<any[]>(remote.listAccounts())
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
            const list = await expectRemote<any[]>(remote.listEndpoints())
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
          setError(null)
          try {
            const q = await expectRemote<QuotaReportView[]>(remote.getQuotas())
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
            const l = await expectRemote<string[]>(remote.getRecentLogs())
            setLogs(l || [])
          } catch (e: any) {
            setError(e?.message || 'Error fetching logs')
          } finally {
            setLoading(false)
          }
        }

        useEffect(() => {
          oauthFlow.mounted = true
          if (props.view === 'page') {
            void refreshStatus()
             void refreshAccounts()
             void refreshModelList()
          }
          return () => {
            oauthFlow.mounted = false
            oauthFlow.controller?.abort()
          }
        }, [props.view])

        const refreshModelList = async () => {
          if (!remote) return
          setModelsStatus('loading')
          try {
            const list = await expectRemote<any[]>(remote.listModels())
            setAvailableModels(list || [])
            setModelsStatus('ready')
          } catch (e: any) {
            setModelsStatus('error')
            setAvailableModels([])
            setError(e?.message || 'No se pudieron consultar los modelos disponibles.')
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
          // Reserve a tab during the user gesture in web browsers. Desktop hosts
          // may reject blank URLs or open externally without returning a Window.
          let popup: Window | null = null
          try { popup = window.open('', '_blank') } catch { /* Try the actual URL below. */ }
          try {
            const res = await expectRemote<{ state: string; url: string }>(remote.startOAuth(provider, controller.signal))
            if (controller.signal.aborted) {
              await expectRemote(remote.cancelOAuth(res.state)).catch(() => undefined)
              if (popup && !popup.closed) popup.close()
              return
            }
            setOauthSession(res)
            setOauthStatus('wait')
            try {
              if (popup && !popup.closed) popup.location.href = res.url
              else window.open(res.url, '_blank', 'noopener,noreferrer')
              // A null return also occurs when DSH delegates to the system browser;
              // it is not evidence that opening the authorization URL failed.
            } catch {
              setError('No se pudo abrir la autorización automáticamente. Abre manualmente el enlace mostrado abajo.')
            }

            const result = await waitForOAuth(remote, res.state, { signal: controller.signal })
            if (!oauthFlow.mounted) return
            if (result.status === 'ok') {
              setOauthStatus('ok')
              await Promise.all([refreshAccounts(), refreshModelList(), refreshStatus()])
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
            await expectRemote(remote.deleteAccount(name))
            await Promise.all([refreshAccounts(), refreshModelList()])
          } catch (e: any) {
            setError(e?.message || 'Failed to delete account')
          }
        }

        const handleAddEndpoint = async () => {
          if (!remote || !newEndpointName || !newEndpointUrl) return
          try {
            await expectRemote(remote.saveEndpoint({
              name: newEndpointName,
              baseUrl: newEndpointUrl,
              apiKey: newEndpointKey || undefined,
            }))
            setNewEndpointName('')
            setNewEndpointUrl('')
            setNewEndpointKey('')
            await Promise.all([refreshEndpoints(), refreshModelList()])
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
            if (id === 'accounts') { refreshAccounts(); refreshModelList() }
            if (id === 'endpoints') { refreshEndpoints(); refreshModelList() }
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
          h('style', { key: 'oauth-button-styles' }, `
            .up-oauth-button {
              position: relative; display: flex; align-items: center; gap: 12px;
              min-height: 98px; padding: 18px; border-radius: 14px;
              border: 1px solid var(--dsw-alias-border, #334155);
              background: var(--dsw-alias-bg-surface, #172033);
              background-image: linear-gradient(125deg, var(--up-tint), transparent 75%);
              color: var(--dsw-alias-text-primary, #e2e8f0);
              text-align: left; font: inherit; cursor: pointer;
              box-shadow: 0 2px 8px rgba(0, 0, 0, .06);
              transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
            }
            .up-oauth-button:not(:disabled):hover {
              border-color: var(--up-accent); transform: translateY(-2px);
              box-shadow: 0 6px 20px var(--up-tint);
            }
            .up-oauth-button:focus-visible { outline: 2px solid var(--up-accent); outline-offset: 3px; }
            .up-oauth-button:not(:disabled):active { transform: translateY(0); }
            .up-oauth-button:disabled { opacity: .6; cursor: not-allowed; }
            .up-oauth-button .up-oauth-arrow { margin-left: auto; color: var(--up-accent); flex-shrink: 0; }
            @media (prefers-reduced-motion: reduce) { .up-oauth-button { transition: none; } .up-oauth-button:not(:disabled):hover { transform: none; } }
          `),
          h('div', { key: 'header', style: { marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', null, [
              h('h2', { style: { margin: 0, fontSize: '20px', fontWeight: 600 } }, 'Universal Provider'),
              h('p', { style: { margin: '4px 0 0', fontSize: '13px', color: 'var(--dsw-alias-text-secondary, #94a3b8)' } },
                'Cuentas OAuth y endpoints OpenAI compatibles para DeepSeek Harness.'),
            ]),
          ]),

          h('div', { key: 'tabs', style: { marginBottom: '20px', borderBottom: '1px solid var(--dsw-alias-border, #334155)', paddingBottom: '12px' } }, [
            tabButton('status', 'Estado'),
            tabButton('accounts', 'Cuentas OAuth'),
            tabButton('endpoints', 'Endpoints'),
            tabButton('quotas', 'Cuotas'),
            tabButton('logs', 'Diagnóstico'),
          ]),

          (mountError || error) ? h('div', {
            key: 'error',
            role: 'alert',
            style: {
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px',
            },
          }, mountError || error) : null,

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

          (tab === 'accounts' || tab === 'endpoints') ? h('section', { key: 'models', style: { marginBottom: '20px' } }, [
            h('h3', null, 'Modelos disponibles'),
            h('button', { type: 'button', disabled: modelsStatus === 'loading', onClick: refreshModelList }, modelsStatus === 'loading' ? 'Consultando modelos…' : 'Actualizar modelos'),
            modelsStatus === 'ready' && !availableModels.length ? h('p', null, 'No hay modelos disponibles para las cuentas y endpoints configurados.') : null,
            h('p', null, 'Opciones de contexto anunciadas por cada modelo. Por defecto se usa la mayor. Las etiquetas incluyen entrada + salida máxima, igual que en VS Code.'),
            modelsStatus === 'ready' ? h('ul', null, availableModels.map(model => {
              const current = model.contextWindow ?? 1000000
              const contextOptions: { value: number; label: string }[] = model.contextOptions ?? []
              const custom = Object.hasOwn(contextDrafts, model.id) || !contextOptions.some(option => option.value === current)
              const draft = contextDrafts[model.id] ?? String(current)
              return h('li', { key: `${model.provider}/${model.id}`, style: { marginBottom: '12px' } }, [
                h('span', null, `${model.name} (${model.id}) `),
                h('select', {
                  'aria-label': `Contexto de ${model.id}`,
                  value: custom ? 'custom' : String(current),
                  disabled: savingContext !== null,
                  onChange: (event: any) => {
                    const value = event.target.value
                    if (value === 'custom') {
                      setContextDrafts(previous => ({ ...previous, [model.id]: String(current) }))
                    } else {
                      setContextDrafts(previous => {
                        const next = { ...previous }
                        delete next[model.id]
                        return next
                      })
                      void saveModelContext(model.id, Number(value))
                    }
                  },
                }, [
                  ...contextOptions.map(option => h('option', { key: option.value, value: String(option.value) }, option.label)),
                  h('option', { value: 'custom' }, 'Personalizado'),
                ]),
                custom ? h('input', {
                  type: 'number', min: 1, step: 1, value: draft,
                  'aria-label': `Tokens de contexto de ${model.id}`,
                  onChange: (event: any) => setContextDrafts(previous => ({ ...previous, [model.id]: event.target.value })),
                }) : null,
                custom ? h('button', {
                  type: 'button', disabled: savingContext !== null || !Number.isSafeInteger(Number(draft)) || Number(draft) <= 0,
                  onClick: () => void saveModelContext(model.id, Number(draft)),
                }, 'Guardar contexto') : null,
                h('span', null, savingContext === model.id ? ' Guardando…' : ` Entrada activa: ${current.toLocaleString()} tokens`),
              ])
            })) : null,
          ]) : null,

          // Tab: OAuth Accounts
          tab === 'accounts' ? h('div', { key: 'accounts-content' }, [
            h('div', { style: { marginBottom: '20px', padding: '16px', background: 'var(--dsw-alias-bg-surface-secondary)', border: '1px solid var(--dsw-alias-border)', borderRadius: '8px' } }, [
              h('h3', { style: { margin: '0 0 6px', fontSize: '15px' } }, 'Vincula tus cuentas'),
              h('p', { style: { margin: '0 0 14px', fontSize: '13px', color: 'var(--dsw-alias-text-secondary)' } }, 'Autoriza en el navegador. Puedes agregar varias cuentas del mismo proveedor; sus modelos aparecerán en el selector de DSH.'),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '12px' } }, [
                ['antigravity', 'Google Antigravity', 'Tu cuenta de Google, conectada a DSH'],
                ['codex', 'ChatGPT', 'Accede a tus modelos de OpenAI Codex'],
              ].map(([provider, label, detail]: any) => h('button', {
                key: provider,
                type: 'button',
                className: 'up-oauth-button',
                'aria-busy': oauthProvider === provider && oauthStatus === 'starting',
                disabled: !!oauthFlow.controller,
                onClick: () => handleStartOAuth(provider),
                style: {
                  '--up-accent': provider === 'antigravity' ? '#60a5fa' : '#34d399',
                  '--up-tint': provider === 'antigravity' ? 'rgba(66, 133, 244, .12)' : 'rgba(16, 185, 129, .12)',
                },
              }, [
                h('span', { 'aria-hidden': true, style: { display: 'grid', placeItems: 'center', width: '42px', height: '42px', flexShrink: 0, borderRadius: '12px', background: provider === 'antigravity' ? '#fff' : '#10a37f', boxShadow: '0 2px 6px rgba(0, 0, 0, .1)' } },
                  provider === 'antigravity'
                    ? h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' }, [
                      h('path', { fill: '#4285F4', d: 'M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z' }),
                      h('path', { fill: '#34A853', d: 'M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z' }),
                      h('path', { fill: '#FBBC05', d: 'M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z' }),
                      h('path', { fill: '#EA4335', d: 'M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z' }),
                    ])
                    : h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
                      h('path', { d: 'M20 11.5a8 8 0 0 1-8 8H8l-4 2v-6a8 8 0 1 1 16-4Z' }),
                      h('path', { d: 'm9 11 2 2 4-4' }),
                    ])),
                h('span', { style: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 } }, [
                  h('strong', { style: { fontSize: '14px', fontWeight: 650, lineHeight: 1.4 } }, oauthProvider === provider && oauthStatus === 'starting' ? 'Conectando…' : `Conectar ${label}`),
                  h('span', { style: { fontSize: '12px', lineHeight: 1.5, color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, detail),
                ]),
                h('svg', { className: 'up-oauth-arrow', 'aria-hidden': true, width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
                  h('path', { d: 'M5 12h14m-5-5 5 5-5 5' }),
                ]),
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
                oauthSession?.url ? h('a', { href: oauthSession.url, target: '_blank', rel: 'noopener noreferrer', style: { display: 'inline-block', marginTop: '6px', color: 'var(--dsw-alias-accent)' } }, 'Si no se abrió el navegador, abrir autorización manualmente') : null,
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
            quotas.length === 0 ? h('p', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)', fontSize: '13px' } }, loading ? 'Consultando cuotas...' : error ? 'No se pudieron consultar las cuotas.' : 'No se encontraron reportes de cuotas.') : null,
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
              !q.error && quotaEntries(q).length === 0 ? h('div', null, 'Sin datos de cuotas disponibles.') : null,
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' } }, quotaEntries(q).map(w => {
                const percent = w.remainingPercent !== undefined && Number.isFinite(w.remainingPercent)
                  ? Math.max(0, Math.min(100, w.remainingPercent)) : undefined
                const color = percent === undefined ? '#94a3b8'
                  : percent > 50 ? '#4ade80' : percent > 20 ? '#facc15' : percent > 10 ? '#fb923c' : '#f87171'
                return h('div', {
                key: w.label,
                style: {
                  padding: '8px 12px',
                  background: 'var(--dsw-alias-bg-surface-primary, #0f172a)',
                  borderRadius: '6px',
                  fontSize: '12px',
                },
              }, [
                h('div', { style: { color: 'var(--dsw-alias-text-secondary, #94a3b8)', marginBottom: '6px', overflowWrap: 'anywhere' } }, w.label),
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                  h('div', {
                    ...(percent === undefined ? { 'aria-hidden': true } : {
                      role: 'progressbar', 'aria-label': `Cuota restante de ${w.label}`,
                      'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent,
                    }),
                    style: { flex: 1, height: '4px', borderRadius: '999px', overflow: 'hidden', background: 'var(--dsw-alias-border, #334155)' },
                  }, h('div', { style: { width: `${percent ?? 0}%`, height: '100%', borderRadius: 'inherit', background: color } })),
                  h('span', { style: { color, fontWeight: 600, minWidth: '4ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } },
                    percent === undefined ? 'Sin datos' : `${Math.round(percent)}%`),
                ]),
                w.resetsAt !== undefined ? h('div', { style: { marginTop: '5px', fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #94a3b8)' } }, `Reinicio: ${new Date(w.resetsAt).toLocaleString()}`) : null,
              ])
              })),
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
  }

  // SlotRegistry owns the inject effects and unregisters entries on disposal.
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: 'universal-provider',
  }, UniversalProviderSettingsView))
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config',
    key: 'universal-provider#universal-provider',
  }, UniversalProviderSettingsView))
}
