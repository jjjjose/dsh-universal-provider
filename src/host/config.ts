import z from '@deepseek-ai/schemastery'
import { randomBytes } from 'node:crypto'
import type { OpenAICompatibilityProvider } from '../core/api/management-client.ts'

export const Config = z.object({
  serverMode: z.union([z.const('managed'), z.const('external')]).default('managed').description('Modo de ejecución: "managed" inicia el proxy localmente; "external" conecta a uno existente.'),
  externalUrl: z.string().default('http://127.0.0.1:8317').description('URL base del servidor CLIProxyAPI en modo external.'),
  apiKeyEnv: z.string().role('credential-ref').default('UNIVERSAL_PROVIDER_API_KEY').description('Referencia a la clave de inferencia en ctx.credentials.'),
  managementKeyEnv: z.string().role('credential-ref').default('UNIVERSAL_PROVIDER_MANAGEMENT_KEY').description('Referencia a la clave de gestión en ctx.credentials.'),
  serverVersion: z.string().default('latest').description('Versión de CLIProxyAPI solicitada para el modo managed.'),
  requestLogging: z.boolean().default(false).description('Habilitar registro de peticiones en el servidor CLIProxyAPI.'),
  port: z.number().default(8317).description('Puerto local preferido para el servidor managed.'),
})

export type ProviderConfig = ReturnType<typeof Config>

export function generateSecret(): string {
  return randomBytes(32).toString('hex')
}

export interface BuildManagedConfigOptions {
  host: string
  port: number
  apiKey: string
  managementKey: string
  authDir: string
  requestLogging?: boolean
  openAICompatibility?: OpenAICompatibilityProvider[]
}

export function buildManagedConfig(options: BuildManagedConfigOptions): string {
  const lines: string[] = [
    'config-version: 8',
    'server:',
    `  host: "${options.host}"`,
    `  port: ${options.port}`,
    'management:',
    '  allow-remote: false',
    `  secret-key: "${options.managementKey}"`,
    'access:',
    '  api-keys:',
    `    - "${options.apiKey}"`,
    'oauth:',
    `  auth-dir: "${options.authDir.replace(/\\/g, '/')}"`,
    'routing:',
    '  strategy: round-robin',
    '  session-affinity: true',
    '  retry:',
    '    request-retry: 3',
    '    max-retry-interval: 30',
    '  cooldown:',
    '    transient-error-cooldown-seconds: -1',
    'observability:',
    '  logs:',
    `    debug: ${options.requestLogging ?? false}`,
    '    logging-to-file: false',
    `    request-log: ${options.requestLogging ?? false}`,
  ]

  if (options.openAICompatibility && options.openAICompatibility.length > 0) {
    lines.push('api-keys:')
    lines.push('  openai-compatibility:')
    for (const provider of options.openAICompatibility) {
      lines.push(`    - name: "${provider.name}"`)
      lines.push(`      base-url: "${provider['base-url']}"`)
      if (provider.keys && provider.keys.length > 0) {
        lines.push('      keys:')
        for (const k of provider.keys) {
          lines.push(`        - api-key: "${k['api-key']}"`)
        }
      }
      if (provider.models && provider.models.length > 0) {
        lines.push('      models:')
        for (const m of provider.models) {
          lines.push(`        - name: "${m.name}"`)
          if (m.alias) lines.push(`          alias: "${m.alias}"`)
        }
      }
    }
  }

  return lines.join('\n') + '\n'
}
