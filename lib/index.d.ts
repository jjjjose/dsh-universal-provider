import { AccountView, CommitDraftResult, EndpointModelView, EndpointView, ModelView, OAuthPollResult, OAuthStartResult, PingResult, ProviderStatus, QuotaReportView, QuotaWindowView } from "./types.js";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";
import { GenerateOptions, LlmAdapter, LlmModelInfo, LlmResolvedModelInfo } from "@deepseek-ai/dsh-llm";
import { Static } from "@sinclair/typebox";
import { Context } from "@deepseek-ai/cordis";
//#region src/host/paths.d.ts
interface ProviderPaths {
  profileRoot: string;
  authDir: string;
  configPath: string;
  logPath: string;
  lockPath: string;
  binDir: string;
  cacheDir: string;
}
//#endregion
//#region src/core/api/management-client.d.ts
interface AuthSession {
  url: string;
  state: string;
  userCode?: string;
}
type AuthStatus = {
  status: 'wait' | 'ok';
} | {
  status: 'error';
  error: string;
};
interface AuthFile {
  name: string;
  type?: string;
}
interface OpenAICompatibilityModel {
  name: string;
  alias?: string;
  thinking?: {
    levels: string[];
  };
}
interface OpenAICompatibilityProvider {
  'name': string;
  'base-url': string;
  'headers'?: Record<string, string>;
  'keys'?: Array<{
    'api-key': string;
  }>;
  'models'?: OpenAICompatibilityModel[];
}
declare const AuthFileRawSchema: import("@sinclair/typebox").TObject<{
  name: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  type: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  provider: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  email: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  label: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  auth_index: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  project_id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  chatgpt_account_id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  account_id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  id_token: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TObject<{
    email: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    chatgpt_account_id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  }>>;
}>;
type AuthFileRaw = Static<typeof AuthFileRawSchema>;
declare class ManagementClient {
  private readonly fetcher;
  constructor(baseUrl: string, key: string);
  requestAuthUrl(provider: string, signal?: AbortSignal): Promise<AuthSession>;
  getAuthStatus(state: string, signal?: AbortSignal): Promise<AuthStatus>;
  cancelAuthSession(state: string, signal?: AbortSignal): Promise<void>;
  listAuthFileModels(name: string, signal?: AbortSignal): Promise<string[]>;
  listAuthFiles(signal?: AbortSignal): Promise<AuthFile[]>;
  deleteAuthFile(name: string, signal?: AbortSignal): Promise<void>;
  listAuthFilesRaw(signal?: AbortSignal): Promise<AuthFileRaw[]>;
  serverVersion(signal?: AbortSignal): Promise<string | undefined>;
  apiCall(payload: {
    auth_index: string;
    method: string;
    url: string;
    header?: Record<string, string>;
    data?: string;
  }, signal?: AbortSignal): Promise<{
    statusCode: number;
    header: Record<string, string[]>;
    body: unknown;
  }>;
  listOpenAICompatibility(signal?: AbortSignal): Promise<OpenAICompatibilityProvider[]>;
  putOpenAICompatibility(providers: OpenAICompatibilityProvider[], signal?: AbortSignal): Promise<void>;
}
//#endregion
//#region src/host/config.d.ts
declare const Config: z<Schemastery.ObjectS<NoInfer<{
  serverMode: z<"managed" | "external", "managed" | "external", "defined">;
  externalUrl: z<string, string, "defined">;
  apiKeyEnv: z<string, string, "defined">;
  managementKeyEnv: z<string, string, "defined">;
  serverVersion: z<string, string, "defined">;
  requestLogging: z<boolean, boolean, "defined">;
  port: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  serverMode: z<"managed" | "external", "managed" | "external", "defined">;
  externalUrl: z<string, string, "defined">;
  apiKeyEnv: z<string, string, "defined">;
  managementKeyEnv: z<string, string, "defined">;
  serverVersion: z<string, string, "defined">;
  requestLogging: z<boolean, boolean, "defined">;
  port: z<number, number, "defined">;
}>>, "plain">;
type ProviderConfig = ReturnType<typeof Config>;
//#endregion
//#region src/core/models/model.d.ts
declare const ProxyModelListEntrySchema: import("@sinclair/typebox").TObject<{
  id: import("@sinclair/typebox").TString;
  owned_by: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  context_length: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
  max_completion_tokens: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
type ProxyModelListEntry = Static<typeof ProxyModelListEntrySchema>;
declare const ProxyModelMetadataSchema: import("@sinclair/typebox").TObject<{
  slug: import("@sinclair/typebox").TString;
  display_name: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  description: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  context_window: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
  max_context_window: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
  visibility: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  supported_in_api: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
  input_modalities: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
  supports_parallel_tool_calls: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
  supports_search_tool: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
  web_search_tool_type: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
  supported_reasoning_levels: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
    effort: import("@sinclair/typebox").TString;
  }>>>;
  default_reasoning_level: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
type ProxyModelMetadata = Static<typeof ProxyModelMetadataSchema>;
//#endregion
//#region src/core/api/proxy-client.d.ts
interface DiscoveryResult {
  available: ProxyModelListEntry[];
  metadata: ProxyModelMetadata[];
}
interface StreamCallbacks {
  onText: (delta: string) => void;
  onThinking?: (delta: string) => void;
  onToolCall: (callId: string, name: string, input: object) => void;
  onUsage?: (usage: any) => void;
}
interface ProxyRequestBody {
  model: string;
  input: Record<string, unknown>[];
  stream: boolean;
  max_output_tokens?: number;
  service_tier?: string;
  prompt_cache_key?: string;
  reasoning?: {
    effort: string;
    summary: string;
  };
  tools?: Array<{
    type: string;
    name?: string;
    description?: string;
    parameters?: object;
    strict?: boolean;
  }>;
  tool_choice?: 'required' | 'auto';
  parallel_tool_calls?: boolean;
}
declare class CLIProxyClient {
  private readonly fetcher;
  constructor(baseUrl: string, apiKey: string);
  discover(signal?: AbortSignal): Promise<DiscoveryResult>;
  streamResponse(body: ProxyRequestBody, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
}
//#endregion
//#region src/host/server.d.ts
interface RunningServerInfo {
  baseUrl: string;
  mode: 'managed' | 'external';
  port?: number;
  version?: string;
}
declare class ServerSupervisor {
  private readonly ctx;
  private readonly paths;
  private readonly config;
  private activeRequests;
  private managedHandle?;
  private client?;
  private managementClient?;
  private info;
  private lockFd;
  private startingPromise;
  constructor(ctx: Context, paths: ProviderPaths, config: ProviderConfig);
  getFreePort(preferred?: number): Promise<number>;
  acquireRequest(): Promise<() => void>;
  getActiveRequests(): number;
  ensureRunning(signal?: AbortSignal): Promise<RunningServerInfo>;
  private startInternal;
  private waitForHealthy;
  private resolveCredential;
  getProxyClient(): CLIProxyClient | undefined;
  getManagementClient(): ManagementClient | undefined;
  dispose(): Promise<void>;
}
//#endregion
//#region src/host/model-context.d.ts
declare class ModelContextSettings {
  private readonly path?;
  private pending;
  constructor(path?: string | undefined);
  private read;
  all(): Promise<Record<string, number>>;
  get(model: string, defaultContext?: number): Promise<number>;
  set(model: string, contextWindow: number): Promise<void>;
}
//#endregion
//#region src/host/adapter.d.ts
interface ModelInfo extends ModelView, LlmModelInfo {}
declare class UniversalLlmAdapter extends LlmAdapter {
  private readonly supervisor;
  readonly contextSettings: ModelContextSettings;
  private catalogs?;
  private publishedCatalog;
  private pendingModels;
  onModelsChanged: (() => void) | undefined;
  constructor(supervisor: ServerSupervisor, contextSettings?: ModelContextSettings);
  setModelContext(model: string, contextWindow: number): Promise<void>;
  providerInfo(provider: string): {
    id: string;
    name: string;
  };
  providerRetryPolicy(_provider: string): undefined;
  imageRequestPricing(_provider: string, _model: string): undefined;
  defaultFallbackModels(_provider: string): ModelInfo[];
  listModels(provider: string, signal?: AbortSignal): Promise<readonly ModelInfo[]>;
  private discoverModels;
  resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
  prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
    model: LlmResolvedModelInfo;
    stream: (options: GenerateOptions) => AsyncIterable<any>;
  }>;
  stream(options: any): AsyncIterable<any>;
  buildRequestBody(options: any): ProxyRequestBody;
}
//#endregion
//#region src/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    universalProvider: UniversalProviderService;
  }
}
declare class UniversalProviderService extends TypertRemoteService {
  private readonly supervisor;
  private readonly paths;
  private readonly config;
  private readonly adapter;
  constructor(ctx: Context, supervisor: ServerSupervisor, paths: ProviderPaths, config: ProviderConfig, adapter?: UniversalLlmAdapter);
  ping(signal?: AbortSignal): Promise<PingResult>;
  getState(signal?: AbortSignal): Promise<ProviderStatus>;
  listModels(signal?: AbortSignal): Promise<readonly ModelView[]>;
  private refreshModels;
  setModelContext(options: {
    model: string;
    contextWindow: number;
  }, signal?: AbortSignal): Promise<boolean>;
  listAccounts(signal?: AbortSignal): Promise<AccountView[]>;
  startOAuth(provider: string, signal?: AbortSignal): Promise<OAuthStartResult>;
  pollOAuth(state: string, signal?: AbortSignal): Promise<OAuthPollResult>;
  cancelOAuth(state: string, signal?: AbortSignal): Promise<boolean>;
  deleteAccount(name: string, signal?: AbortSignal): Promise<boolean>;
  listEndpoints(signal?: AbortSignal): Promise<EndpointView[]>;
  saveEndpoint(endpoint: EndpointView, signal?: AbortSignal): Promise<boolean>;
  getQuotas(signal?: AbortSignal): Promise<QuotaReportView[]>;
  getRecentLogs(signal?: AbortSignal): Promise<string[]>;
  generateCommitDraft(options: {
    cwd: string;
    model?: string;
  }, signal?: AbortSignal): Promise<CommitDraftResult>;
  configureTitles(model: string, signal?: AbortSignal): Promise<boolean>;
  configureCompaction(model: string, signal?: AbortSignal): Promise<boolean>;
}
declare const inject: string[];
declare function apply(ctx: Context, config: ProviderConfig): void;
//#endregion
export { AccountView, CommitDraftResult, Config, EndpointModelView, EndpointView, ModelView, OAuthPollResult, OAuthStartResult, PingResult, ProviderStatus, QuotaReportView, QuotaWindowView, UniversalProviderService, apply, inject };
//# sourceMappingURL=index.d.ts.map