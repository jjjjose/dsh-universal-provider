/* Generated Typert host manifest for universal-provider */
import { z } from 'zod'

let _pingResultSchema
export const getPingResultSchema = () => (_pingResultSchema ??= z.object({
  message: z.string().readonly(),
  timestamp: z.number().readonly(),
}))

let _statusResultSchema
export const getStatusResultSchema = () => (_statusResultSchema ??= z.object({
  status: z.string().readonly(),
  version: z.string().readonly(),
  mode: z.enum(['managed', 'external']).readonly(),
  port: z.number().readonly().optional(),
  activeRequests: z.number().readonly(),
  baseUrl: z.string().readonly(),
}))

let _modelsListSchema
export const getModelsListSchema = () => (_modelsListSchema ??= z.array(z.object({
  provider: z.string(),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputModalities: z.array(z.enum(['text', 'image'])).readonly().optional(),
  contextWindow: z.number().optional(),
})).readonly())

let _accountViewSchema
export const getAccountViewSchema = () => (_accountViewSchema ??= z.object({
  name: z.string().readonly(),
  type: z.string().readonly().optional(),
  provider: z.string().readonly().optional(),
  email: z.string().readonly().optional(),
  label: z.string().readonly().optional(),
}))

let _accountsListSchema
export const getAccountsListSchema = () => (_accountsListSchema ??= z.array(getAccountViewSchema()))

let _oauthStartResultSchema
export const getOAuthStartResultSchema = () => (_oauthStartResultSchema ??= z.object({
  url: z.string().readonly(),
  state: z.string().readonly(),
  userCode: z.string().readonly().optional(),
}))

let _oauthPollResultSchema
export const getOAuthPollResultSchema = () => (_oauthPollResultSchema ??= z.object({
  status: z.enum(['wait', 'ok', 'error']).readonly(),
  error: z.string().readonly().optional(),
}))

let _endpointViewSchema
export const getEndpointViewSchema = () => (_endpointViewSchema ??= z.object({
  name: z.string().readonly(),
  baseUrl: z.string().readonly(),
  apiKey: z.string().readonly().optional(),
  models: z.array(z.object({
    name: z.string().readonly(),
    alias: z.string().readonly().optional(),
  })).readonly().optional(),
}))

let _endpointsListSchema
export const getEndpointsListSchema = () => (_endpointsListSchema ??= z.array(getEndpointViewSchema()))

let _quotaReportSchema
export const getQuotaReportSchema = () => (_quotaReportSchema ??= z.object({
  provider: z.string().readonly(),
  windows: z.array(z.object({
    label: z.string().readonly(),
    remainingPercent: z.number().readonly().optional(),
    balance: z.object({
      amount: z.number().readonly(),
      currency: z.string().readonly(),
      suffix: z.enum(['left', 'used']).readonly(),
    }).readonly().optional(),
    resetsAt: z.number().readonly().optional(),
  })).readonly(),
  account: z.object({
    authIndex: z.string().readonly(),
    label: z.string().readonly(),
  }).readonly().optional(),
  error: z.string().readonly().optional(),
}))

let _quotasListSchema
export const getQuotasListSchema = () => (_quotasListSchema ??= z.array(getQuotaReportSchema()))

let _commitDraftInputSchema
export const getCommitDraftInputSchema = () => (_commitDraftInputSchema ??= z.object({
  cwd: z.string().readonly(),
  model: z.string().readonly().optional(),
}))

let _commitDraftResultSchema
export const getCommitDraftResultSchema = () => (_commitDraftResultSchema ??= z.object({
  hasStagedChanges: z.boolean().readonly(),
  message: z.string().readonly().optional(),
  draft: z.string().readonly().optional(),
}))

let _stringSchema
export const getModelContextSchema = () => z.object({ model: z.string().min(1), contextWindow: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })
export const getStringSchema = () => (_stringSchema ??= z.string())

let _booleanSchema
export const getBooleanSchema = () => (_booleanSchema ??= z.boolean())

let _logsListSchema
export const getLogsListSchema = () => (_logsListSchema ??= z.array(z.string()))


export const TYPERT = {
  package: 'universal-provider',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: 'universal-provider#universalProvider/setModelContext',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'setModelContext',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'options', wire: 'options', source: 'json', codec: {
        mode: 'strict', typeSymbol: 'universal-provider/types#ModelContextOptions', create: getModelContextSchema,
      } }],
      cancellation: { parameter: 'signal' },
      result: { mode: 'strict', typeSymbol: 'universal-provider/types#boolean', create: getBooleanSchema },
      sourceLocation: { file: 'src/index.ts', line: 100, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/listModels',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'listModels',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#ModelsList',
        create: getModelsListSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 82, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/ping',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'ping',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#PingResult',
        create: getPingResultSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 15, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/getState',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'getState',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#ProviderStatus',
        create: getStatusResultSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 25, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/listAccounts',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'listAccounts',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#AccountsList',
        create: getAccountsListSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 35, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/startOAuth',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'startOAuth',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'provider',
          wire: 'provider',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#OAuthStartResult',
        create: getOAuthStartResultSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 45, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/pollOAuth',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'pollOAuth',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'state',
          wire: 'state',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#OAuthPollResult',
        create: getOAuthPollResultSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 55, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/cancelOAuth',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'cancelOAuth',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'state',
          wire: 'state',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#boolean',
        create: getBooleanSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 65, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/deleteAccount',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'deleteAccount',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'name',
          wire: 'name',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#boolean',
        create: getBooleanSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 75, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/listEndpoints',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'listEndpoints',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#EndpointsList',
        create: getEndpointsListSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 85, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/saveEndpoint',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'saveEndpoint',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'endpoint',
          wire: 'endpoint',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#EndpointView',
            create: getEndpointViewSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#boolean',
        create: getBooleanSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 95, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/getQuotas',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'getQuotas',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#QuotasList',
        create: getQuotasListSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 105, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/getRecentLogs',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'getRecentLogs',
      invocation: { kind: 'direct' },
      parameters: [],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#LogsList',
        create: getLogsListSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 115, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/generateCommitDraft',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'generateCommitDraft',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'options',
          wire: 'options',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#CommitDraftInput',
            create: getCommitDraftInputSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#CommitDraftResult',
        create: getCommitDraftResultSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 125, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/configureTitles',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'configureTitles',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'model',
          wire: 'model',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#boolean',
        create: getBooleanSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 135, column: 3 },
    },
    {
      id: 'universal-provider#universalProvider/configureCompaction',
      service: 'universalProvider',
      namespace: 'universalProvider',
      method: 'configureCompaction',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'model',
          wire: 'model',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'universal-provider/types#string',
            create: getStringSchema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: 'universal-provider/types#boolean',
        create: getBooleanSchema,
      },
      sourceLocation: { file: 'src/index.ts', line: 145, column: 3 },
    }
  ],
  model: {
    services: [
      {
        tags: [],
        key: 'universalProvider',
        exportName: 'UniversalProviderService',
        members: [
          { kind: 'method', name: 'setModelContext', signature: '@Remote async setModelContext(options: { model: string; contextWindow: number }, signal?: AbortSignal): Promise<boolean>' },
          { kind: 'method', name: 'listModels', signature: '@Remote async listModels(signal?: AbortSignal): Promise<readonly ModelView[]>' },
          { kind: 'method', name: 'ping', signature: '@Remote async ping(signal?: AbortSignal): Promise<PingResult>' },
          { kind: 'method', name: 'getState', signature: '@Remote async getState(signal?: AbortSignal): Promise<ProviderStatus>' },
          { kind: 'method', name: 'listAccounts', signature: '@Remote async listAccounts(signal?: AbortSignal): Promise<AccountView[]>' },
          { kind: 'method', name: 'startOAuth', signature: '@Remote async startOAuth(provider: string, signal?: AbortSignal): Promise<OAuthStartResult>' },
          { kind: 'method', name: 'pollOAuth', signature: '@Remote async pollOAuth(state: string, signal?: AbortSignal): Promise<OAuthPollResult>' },
          { kind: 'method', name: 'cancelOAuth', signature: '@Remote async cancelOAuth(state: string, signal?: AbortSignal): Promise<boolean>' },
          { kind: 'method', name: 'deleteAccount', signature: '@Remote async deleteAccount(name: string, signal?: AbortSignal): Promise<boolean>' },
          { kind: 'method', name: 'listEndpoints', signature: '@Remote async listEndpoints(signal?: AbortSignal): Promise<EndpointView[]>' },
          { kind: 'method', name: 'saveEndpoint', signature: '@Remote async saveEndpoint(endpoint: EndpointView, signal?: AbortSignal): Promise<boolean>' },
          { kind: 'method', name: 'getQuotas', signature: '@Remote async getQuotas(signal?: AbortSignal): Promise<QuotaReportView[]>' },
          { kind: 'method', name: 'getRecentLogs', signature: '@Remote async getRecentLogs(signal?: AbortSignal): Promise<string[]>' },
          { kind: 'method', name: 'generateCommitDraft', signature: '@Remote async generateCommitDraft(options: { cwd: string; model?: string }, signal?: AbortSignal): Promise<CommitDraftResult>' },
          { kind: 'method', name: 'configureTitles', signature: '@Remote async configureTitles(model: string, signal?: AbortSignal): Promise<boolean>' },
          { kind: 'method', name: 'configureCompaction', signature: '@Remote async configureCompaction(model: string, signal?: AbortSignal): Promise<boolean>' },
        ],
        types: [
          { name: 'ModelView', declaration: 'export interface ModelView { provider: string; id: string; name: string; contextWindow?: number; description?: string; inputModalities?: readonly ("text" | "image")[]; }' },
          { name: 'PingResult', declaration: 'export interface PingResult { readonly message: string; readonly timestamp: number; }' },
          { name: 'ProviderStatus', declaration: 'export interface ProviderStatus { readonly status: string; readonly version: string; readonly mode: "managed" | "external"; readonly port?: number; readonly activeRequests: number; readonly baseUrl: string; }' },
          { name: 'AccountView', declaration: 'export interface AccountView { readonly name: string; readonly type?: string; readonly provider?: string; readonly email?: string; readonly label?: string; }' },
          { name: 'OAuthStartResult', declaration: 'export interface OAuthStartResult { readonly url: string; readonly state: string; readonly userCode?: string; }' },
          { name: 'OAuthPollResult', declaration: 'export interface OAuthPollResult { readonly status: "wait" | "ok" | "error"; readonly error?: string; }' },
          { name: 'EndpointView', declaration: 'export interface EndpointView { readonly name: string; readonly baseUrl: string; readonly apiKey?: string; readonly models?: readonly { name: string; alias?: string; }[]; }' },
          { name: 'QuotaReportView', declaration: 'export interface QuotaReportView { readonly provider: string; readonly windows: readonly { label: string; remainingPercent?: number; }[]; }' },
          { name: 'CommitDraftResult', declaration: 'export interface CommitDraftResult { readonly hasStagedChanges: boolean; readonly message?: string; readonly draft?: string; }' },
        ],
      }
    ],
    events: [],
    objects: [],
  },
}
