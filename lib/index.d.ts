import { AccountView, CommitDraftResult, EndpointModelView, EndpointView, ModelView, OAuthPollResult, OAuthStartResult, PingResult, ProviderStatus, QuotaReportView, QuotaWindowView } from "./types.js";
import { Context, Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { Static } from "@sinclair/typebox";
//#region node_modules/.pnpm/@deepseek-ai+dsh-brand@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-brand/lib/types/index.d.ts
/**
 * Duplicate-install-safe nominal primitive helpers.
 *
 * A brand makes structurally identical strings or numbers non-interchangeable
 * at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
 * expected, and an event sequence cannot be passed as a log offset. Comparison,
 * logging, and serialization retain the underlying primitive behavior.
 *
 * This package owns no concrete domain value and keeps no runtime identity or mutable
 * state, so independently installed copies produce interchangeable values.
 *
 * @module @deepseek-ai/dsh-brand
 */
declare const BRAND: unique symbol;
/** A string carrying a compile-time-only brand `B`. */
type Branded<B extends string> = string & {
  readonly [BRAND]: B;
};
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-typert-protocol@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/owned-value.d.ts
/** Generic invocation-owned values returned by synchronous Client Context resolvers. */
/** Shared identity across independently bundled Context providers and Gateway. */
declare const TYPERT_OWNED_VALUE: unique symbol;
/** A borrowed payload paired with the invocation owner's idempotent cleanup. */
interface TypertOwnedValue<Value> extends Disposable {
  readonly [TYPERT_OWNED_VALUE]: true;
  readonly value: Value;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-typert-protocol@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/types.d.ts
declare const LOOKUP_HOST: unique symbol;
declare const LOOKUP_WIRE: unique symbol;
declare const CONTEXT_WIRE: unique symbol;
/** Type-level association between a Host object and its wire identity. */
interface TypertLookup<Host, Wire> {
  readonly [LOOKUP_HOST]: Host;
  readonly [LOOKUP_WIRE]: Wire;
}
/** Extract the Host object associated with one lookup declaration. */
type TypertLookupHost<Lookup> = Lookup extends TypertLookup<infer Host, infer _Wire> ? Host : never;
/** Extract the wire identity associated with one lookup declaration. */
type TypertLookupWire<Lookup> = Lookup extends TypertLookup<infer _Host, infer Wire> ? Wire : never;
/** Type-level association between a scoped Context kind and its wire identity. */
interface TypertContext<Wire> {
  readonly [CONTEXT_WIRE]: Wire;
}
/** Extract the wire identity associated with one scoped Context declaration. */
type TypertContextWire<ContextType> = ContextType extends TypertContext<infer Wire> ? Wire : never;
/** Merge-extensible Host object lookup declarations. */
interface TypertLookupMap {}
/** Merge-extensible scoped Context declarations. */
interface TypertContextMap {}
/** Awaitable disposer returned by Cordis-owned Typert registrations. */
type TypertDisposer = () => Promise<void>;
type StringKeyOf<Value> = Extract<keyof Value, string>;
/** Minimal runtime-schema capability carried by strict generated codecs. */
interface TypertSchema<Output = unknown> {
  /**
   * Parse and validate one boundary value.
   * @param value - untrusted boundary value.
   * @returns the validated value.
   */
  parse(value: unknown): Output;
}
/** Codec attached to one invocation parameter or result. */
type TypertCodec = {
  readonly mode: 'strict';
  readonly typeSymbol: string;
  /** Materialize and return the process-realm schema on first boundary use. */
  readonly create: () => TypertSchema;
  /**
   * Decode a unary result whose fields require type-specific handling.
   * @param value - result reconstructed by the RPC carrier.
   * @returns the validated result, retaining native byte views.
   */
  readonly decode?: (value: unknown) => unknown;
  /**
   * Project typed binary fields into RPC result attachments.
   * @param value - native unary result.
   * @param writeBytes - records a byte view at its result-relative path and returns its JSON placeholder.
   * @returns JSON metadata with untouched JSON subtrees retained.
   */
  readonly encode?: (value: unknown, writeBytes: (bytes: Uint8Array, path: readonly (string | number)[]) => null) => unknown;
} | {
  readonly mode: 'src-json';
};
/** One ordered business parameter in a Remote invocation. */
interface InvocationParameterDescriptor {
  /** Source-level parameter name. */
  readonly name: string;
  /** Required key in the wire `args` object. */
  readonly wire: string;
  /** Whether the value is JSON or requires a registered Host lookup. */
  readonly source: 'json' | 'lookup';
  /** Lookup key when `source` is `lookup`. */
  readonly lookup?: string;
  /** Boundary codec for the wire representation. */
  readonly codec: TypertCodec;
  /** Missing wire fields decode to `undefined` only for an explicitly declared `T | undefined`. */
  readonly acceptsUndefined?: true;
}
/** Source position retained for diagnostics from generated definitions. */
interface InvocationSourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
/** Carrier-independent description of one exported method invocation. */
interface InvocationDescriptor {
  /** Globally stable generated identity. */
  readonly id: string;
  /** Cordis service key owning the method. */
  readonly service: string;
  /** Wire namespace, defaulting to the service key. */
  readonly namespace: string;
  /** Public instance method name. */
  readonly method: string;
  /** Service member invoked when the exported method name is an alias. */
  readonly implementation?: string;
  /** Absent for unary calls; stream calls deliver every yielded item as the Host produced it. */
  readonly mode?: 'stream';
  /** Receiver selection mode. */
  readonly invocation: {
    readonly kind: 'direct';
  } | {
    readonly kind: 'context';
    readonly context: string;
    readonly wire: string;
    readonly codec: TypertCodec;
  };
  /** Optional consuming-Context projection for one direct lookup parameter. */
  readonly scope?: {
    /** Context kind whose Client adapter supplies the identity. */
    readonly context: string;
    /** Lookup parameter wire field replaced by the Context identity. */
    readonly wire: string;
  };
  /** Ordered business parameters. */
  readonly parameters: readonly InvocationParameterDescriptor[];
  /**
   * Client-to-Host items of the same logical stream, generated from the `In`
   * type argument of the method's `RemoteStream<Out, In>` return type; absent
   * when `In` is `never`. The method reads the items through
   * `RemoteInvocation.uplink()`, so nothing enters the parameter list.
   */
  readonly uplink?: {
    /** Codec validating every uplink item before `uplink()` delivers it. */
    readonly codec: TypertCodec;
  };
  /** Transport cancellation injected after business parameters instead of entering wire args. */
  readonly cancellation?: {
    /** Reserved final Host method parameter. */
    readonly parameter: 'signal';
  };
  /** Codec for the unary result or each yielded stream item. */
  readonly result: TypertCodec;
  /** Source declaration used only for diagnostics. */
  readonly sourceLocation?: InvocationSourceLocation;
}
/**
 * Opaque identity of one Peer: a party admitted to this Host by the connection
 * layer. "Peer" is a connection-layer word; the browser application keeps the
 * word "Client".
 */
type PeerId = Branded<'PeerId'>;
/**
 * One Peer's session on this Host. Connection owns it: `ctx` is the Cordis
 * scope that owns connection-lifetime registrations and is disposed with the
 * Peer. Who the Peer is and what it may do are not recorded here.
 */
interface PeerScope {
  readonly id: PeerId;
  readonly ctx: Context;
  /**
   * Tear down every registration made through `ctx`.
   * @returns settles once the scope has quiesced; racing calls share one completion.
   */
  dispose(): Promise<void>;
}
/**
 * The context of one Remote call, reachable inside the receiving method as
 * `this.ctx.invocation`. The Gateway derives the receiver from a Context that
 * carries it, so no parameter is injected and nothing crosses the wire.
 */
interface RemoteInvocation {
  readonly request: {
    readonly namespace: string;
    readonly method: string;
    readonly args: Readonly<Record<string, unknown>>;
  };
  /** Cordis service key of the receiving Service. */
  readonly service: string;
  /** Peer the call speaks for; an in-process carrier speaks for the operator. */
  readonly peer: PeerScope;
  /** Carrier cancellation: Client cancel, socket close, or an uplink failure. */
  readonly signal: AbortSignal;
  /**
   * The Client's uplink items for this call. Available once; a second call
   * throws. With an uplink codec on the descriptor every item is decoded to
   * `In`; without one items arrive as `unknown` after a JSON-safety check.
   * Iteration ends when the Client ends its uplink; when the method finishes
   * its downlink the Gateway calls the iterator's `return()` and unread items
   * are dropped. `In` is the caller's assertion: the runtime decodes by the
   * descriptor and does not cross-check it.
   * @template In - item type the caller reads; the descriptor codec decides what arrives.
   * @returns the single-consumer uplink iterable.
   */
  uplink<In = unknown>(): AsyncIterable<In>;
}
/** Generated Host contract selected explicitly by a Client assembly. */
interface TypertRemoteContribution {
  /** npm package that owns the Remote methods. */
  readonly package: string;
  /** Consumer-side invocation descriptors generated from that package. */
  readonly descriptors: readonly InvocationDescriptor[];
}
/**
 * Resolve one validated wire identity, synchronously or asynchronously.
 * @param id - validated wire identity.
 * @returns the Host object, or `undefined` when unavailable.
 */
type TypertLookupResolver<Host = unknown, Wire = unknown> = (id: Wire) => Host | undefined | Promise<Host | undefined>;
/** Runtime provider for one declared Host object lookup. */
interface TypertLookupProvider<Host = unknown, Wire = unknown> {
  /** Source parameter name recognized by the SRC weak parser. */
  readonly parameter: string;
  /** Wire field replacing the Host object parameter. */
  readonly wire: string;
  /** Canonical Host type symbol used by strict generation. */
  readonly hostTypeSymbol: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
  /**
   * Resolve a wire identity through the provider's default policy.
   * @param id - validated wire identity.
   * @returns the object, `undefined` when unavailable, or either asynchronously.
   */
  resolve(id: Wire): Host | undefined | Promise<Host | undefined>;
}
/** Stable wire declaration retained after a lookup provider unloads. */
interface TypertLookupDefinition {
  /** Merge-declared lookup key. */
  readonly key: string;
  /** Source parameter name recognized by the SRC weak parser. */
  readonly parameter: string;
  /** Wire field replacing the Host object parameter. */
  readonly wire: string;
  /** Canonical Host type symbol used by strict generation. */
  readonly hostTypeSymbol: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
}
/** Host wire-to-Context resolver plus the declaration used by strict Remote methods. */
interface TypertHostContextAdapter<Wire = unknown> {
  /** Wire field carrying the Context identity. */
  readonly wire: string;
  /** Canonical wire type symbol used by strict generation. */
  readonly wireTypeSymbol: string;
  /**
   * Resolve a validated wire identity to a live Host Context.
   * @param id - validated wire identity.
   * @returns the Context, or `undefined` when it is unavailable.
   */
  resolve(id: Wire): Context | undefined | Promise<Context | undefined>;
}
/** Composition-owned resolver replacing one Host Context adapter's default lookup policy. */
type TypertHostContextResolver<Wire = unknown> = (id: Wire) => Context | undefined | Promise<Context | undefined>;
/** Client-side bidirectional Context adapter. */
interface TypertClientContextAdapter<Wire = unknown> {
  /**
   * Read the identity represented by a live Client Context.
   * @param ctx - Client Context inspected by a scoped Remote caller.
   * @returns the wire identity, or `undefined` for another Context kind.
   */
  identity(ctx: Context): Wire | undefined;
  /**
   * Resolve a validated identity synchronously for one Client invocation.
   * @param id - validated wire identity.
   * @returns a borrowed or invocation-owned Client Context, or undefined when unavailable.
   */
  resolve(id: Wire): Context | TypertOwnedValue<Context> | undefined;
}
/** Notification emitted after a Typert runtime registry changes. */
interface TypertRegistryChange {
  readonly kind: 'local' | 'remote' | 'lookup' | 'host-context' | 'client-context';
  readonly key: string;
}
/** Listener for one Typert runtime registry. */
type TypertRegistryListener = (change: TypertRegistryChange) => void;
/** Current-environment invocation definitions. */
interface TypertLocalRegistry {
  /**
   * Look up one invocation by `<namespace>/<method>`.
   * @param endpoint - canonical endpoint.
   * @returns the live descriptor, or `undefined` when absent.
   */
  get(endpoint: string): InvocationDescriptor | undefined;
  /**
   * Report whether a strict definition has existed during this Typert Service lifetime.
   * @param endpoint - canonical endpoint.
   * @returns `true` after the endpoint has been registered at least once, even if withdrawn.
   */
  hasSeen(endpoint: string): boolean;
  /** @returns a registration-order snapshot of local descriptors. */
  list(): readonly InvocationDescriptor[];
  /**
   * Observe later local-definition changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Consumer-selected Remote contribution registry. */
interface TypertRemoteRegistry {
  /**
   * Register one generated contribution for the calling Cordis fiber.
   * @param contribution - generated Remote descriptors.
   * @returns disposer withdrawing the exact contribution.
   */
  register(contribution: TypertRemoteContribution): TypertDisposer;
  /**
   * Look up one Remote descriptor by endpoint.
   * @param endpoint - canonical endpoint.
   * @returns the descriptor, or `undefined` when unmounted.
   */
  get(endpoint: string): InvocationDescriptor | undefined;
  /** @returns a registration-order snapshot of Remote descriptors. */
  list(): readonly InvocationDescriptor[];
  /**
   * Observe later Remote contribution changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Runtime registry for Host object lookup providers. */
interface TypertLookupRegistry {
  /**
   * Register one provider under its merge-declared key.
   * @param key - lookup key.
   * @param provider - owning package's live resolver.
   * @returns disposer withdrawing the exact provider.
   */
  register<K extends StringKeyOf<TypertLookupMap>>(key: K, provider: TypertLookupProvider<TypertLookupHost<TypertLookupMap[K]>, TypertLookupWire<TypertLookupMap[K]>>): TypertDisposer;
  /**
   * Replace one provider's default resolution policy while this contribution is active.
   * Configuration may precede provider registration; without a live provider, `get()` remains unavailable.
   * @param key - lookup key whose wire declaration remains provider-owned.
   * @param resolver - composition-owned resolver used by every lookup of this key.
   * @returns disposer restoring the provider's default resolver.
   */
  configure<K extends StringKeyOf<TypertLookupMap>>(key: K, resolver: TypertLookupResolver<TypertLookupHost<TypertLookupMap[K]>, TypertLookupWire<TypertLookupMap[K]>>): TypertDisposer;
  /**
   * Look up one provider by runtime key.
   * @param key - descriptor lookup key.
   * @returns the live provider, or `undefined` when absent.
   */
  get(key: string): TypertLookupProvider | undefined;
  /** @returns lookup declarations observed during this Typert Service lifetime. */
  definitions(): readonly TypertLookupDefinition[];
  /** @returns a snapshot of registered provider keys. */
  keys(): readonly string[];
  /**
   * Observe later lookup changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Runtime registry for the Host and Client adapters of each Context kind. */
interface TypertContextRegistry {
  /**
   * Register a Host Context adapter.
   * @param key - merge-declared Context key.
   * @param adapter - owning package's Host resolver and wire declaration.
   * @returns disposer withdrawing the exact adapter.
   */
  registerHost<K extends StringKeyOf<TypertContextMap>>(key: K, adapter: TypertHostContextAdapter<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Override one Host Context key's resolution policy for the calling fiber.
   * Configuration may precede provider registration and restores the provider's default resolver on disposal.
   * @param key - merge-declared Context key.
   * @param resolver - composition-owned resolver used by every Host Context lookup of this key.
   * @returns disposer restoring the provider's default resolver.
   */
  configureHost<K extends StringKeyOf<TypertContextMap>>(key: K, resolver: TypertHostContextResolver<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Register a Client Context adapter.
   * @param key - merge-declared Context key.
   * @param adapter - owning package's bidirectional Client projection.
   * @returns disposer withdrawing the exact adapter.
   */
  registerClient<K extends StringKeyOf<TypertContextMap>>(key: K, adapter: TypertClientContextAdapter<TypertContextWire<TypertContextMap[K]>>): TypertDisposer;
  /**
   * Look up a Host Context adapter.
   * @param key - descriptor Context key.
   * @returns the adapter, or `undefined` when absent.
   */
  getHost(key: string): TypertHostContextAdapter | undefined;
  /**
   * Look up a Client Context adapter.
   * @param key - descriptor Context key.
   * @returns the adapter, or `undefined` when absent.
   */
  getClient(key: string): TypertClientContextAdapter | undefined;
  /**
   * Observe later Context adapter changes.
   * @param listener - synchronous contained observer.
   * @returns disposer for this subscription.
   */
  subscribe(listener: TypertRegistryListener): TypertDisposer;
}
/** Minimal Typert runtime consumed through dependency inversion. */
interface TypertRegistryContract {
  readonly local: TypertLocalRegistry;
  readonly remotes: TypertRemoteRegistry;
  readonly lookups: TypertLookupRegistry;
  readonly contexts: TypertContextRegistry;
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    typert: TypertRegistryContract;
    /**
     * The Remote call this Context was derived for, or `undefined` on a
     * Context no Remote call derived. A Service method reads it as
     * `this.ctx.invocation`.
     */
    readonly invocation: RemoteInvocation | undefined;
  }
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-typert-protocol@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/index.d.ts
/** Options for an explicit Service-to-Gateway binding. */
interface TypertGatewayBindingOptions {
  /** Wire namespace; defaults to the Cordis service key. */
  readonly namespace?: string;
}
/** Visible declaration that one Service participates in Typert Gateway export. */
interface TypertGatewayBinding<Service extends object = object> {
  readonly service: Service;
  readonly serviceKey: string;
  readonly namespace: string;
}
/** Cordis Service base that exposes its registered name through Typert Gateway. */
declare abstract class TypertRemoteService<out T = never> extends Service<T> {
  /** Visible binding consumed by the Gateway's source-mode discovery. */
  readonly typertRemote: TypertGatewayBinding<this>;
  /**
   * Register the Service and bind the same key to Typert Gateway.
   * @param ctx - owning Cordis Context.
   * @param serviceKey - exact Cordis service key and default wire namespace.
   * @param options - optional distinct wire namespace.
   */
  protected constructor(ctx: Context, serviceKey: string, options?: TypertGatewayBindingOptions);
}
//#endregion
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
//#region src/host/adapter.d.ts
interface ModelInfo extends ModelView {}
interface ResolvedModelInfo extends ModelInfo {
  context?: {
    contextWindow: number;
  };
  defaultMaxTokens?: number;
  reasoning?: {
    efforts: readonly {
      id: string;
      name: string;
      description?: string;
    }[];
    defaultEffort?: string;
  };
}
declare class UniversalLlmAdapter {
  private readonly supervisor;
  private catalogs?;
  constructor(supervisor: ServerSupervisor);
  providerInfo(provider: string): {
    id: string;
    name: string;
  };
  providerRetryPolicy(_provider: string): undefined;
  imageRequestPricing(_provider: string, _model: string): undefined;
  defaultFallbackModels(_provider: string): ModelInfo[];
  listModels(provider: string, signal?: AbortSignal): Promise<readonly ModelInfo[]>;
  resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<ResolvedModelInfo>;
  prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
    model: ResolvedModelInfo;
    stream: (options: any) => AsyncIterable<any>;
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