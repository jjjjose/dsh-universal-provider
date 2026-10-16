/* Generated Typert Remote client artifact for universal-provider */
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
export const getStringSchema = () => (_stringSchema ??= z.string())

let _booleanSchema
export const getBooleanSchema = () => (_booleanSchema ??= z.boolean())

let _logsListSchema
export const getLogsListSchema = () => (_logsListSchema ??= z.array(z.string()))


export const TYPERT_REMOTE = {
  package: 'universal-provider',
  descriptors: [
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
}

export default TYPERT_REMOTE
