import "./types.js";
import { Context, Service } from "@deepseek-ai/cordis";
import { access, chmod, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { closeSync, existsSync, openSync, unlinkSync } from "node:fs";
import { arch, homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import z from "@deepseek-ai/schemastery";
import { createHash, randomBytes } from "node:crypto";
import net from "node:net";
import ky, { isHTTPError } from "ky";
import { unzipSync } from "fflate";
import { parseTarGzip } from "nanotar";
import semver from "semver";
import { Type } from "@sinclair/typebox";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { Value } from "@sinclair/typebox/value";
//#region node_modules/.pnpm/@deepseek-ai+dsh-typert-protocol@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
/**
* Remote decorators and explicit Gateway bindings backed by versioned
* descriptors carried on decorated class prototypes. Strict reflection
* remains a Typert compiler responsibility.
* @module @deepseek-ai/dsh-typert-protocol
*/
const TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
/**
* Test one generated Remote name against the Connection endpoint grammar.
* @param value - namespace, method, lookup, or Context segment.
* @returns whether the value can cross the shared RPC carrier unchanged.
*/
function isTypertRemoteSegment(value) {
	return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
const REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
/**
* Bind one visible Service field to a Cordis key and Remote namespace. A
* service that owns a Cordis Context also gives its tree `ctx.invocation`,
* `undefined` outside a Remote call, so no `TypertRemoteService` is needed for
* a Host composition to read it.
* @param service - owning Service instance, normally `this`.
* @param serviceKey - exact Cordis service key.
* @param options - optional distinct wire namespace.
* @returns a frozen, inspectable binding with no compiler-injected metadata.
*/
function bindTypertRemote(service, serviceKey, options = {}) {
	validateName("service key", serviceKey);
	const namespace = options.namespace ?? serviceKey;
	validateName("namespace", namespace);
	const ctx = Reflect.get(service, "ctx");
	if (ctx instanceof Context) provideInvocationAccessor(ctx);
	return Object.freeze({
		service,
		serviceKey,
		namespace
	});
}
/** Cordis Service base that exposes its registered name through Typert Gateway. */
var TypertRemoteService = class extends Service {
	/** Visible binding consumed by the Gateway's source-mode discovery. */
	typertRemote;
	/**
	* Register the Service and bind the same key to Typert Gateway.
	* @param ctx - owning Cordis Context.
	* @param serviceKey - exact Cordis service key and default wire namespace.
	* @param options - optional distinct wire namespace.
	*/
	constructor(ctx, serviceKey, options = {}) {
		super(ctx, serviceKey);
		this.typertRemote = bindTypertRemote(this, this.name, options);
	}
};
/**
* Make `ctx.invocation` read as `undefined` outside a Remote call instead of the
* reflect service's "cannot get property" error; a call-derived Context shadows
* the accessor with its own property. The first Remote Service constructed in a
* tree registers it on the root, where it outlives any one Service.
*/
function provideInvocationAccessor(ctx) {
	if (Object.hasOwn(ctx.root.reflect.props, "invocation")) return;
	ctx.root.accessor("invocation", { get: () => void 0 });
}
function Remote(methodExportOrOptions, context) {
	if (typeof methodExportOrOptions === "string") {
		validateName("Remote export name", methodExportOrOptions);
		return remoteDecorator({ kind: "direct" }, void 0, methodExportOrOptions);
	}
	if (typeof methodExportOrOptions === "object") {
		if (remoteOptionMode(methodExportOrOptions) !== "stream" || Reflect.ownKeys(methodExportOrOptions).length !== 1) throw new TypeError("typert-protocol: Remote options must contain exactly mode: \"stream\"");
		return remoteDecorator({ kind: "direct" }, "stream");
	}
	if (context === void 0) throw new TypeError("typert-protocol: Remote decorator context is missing");
	addMarkerInitializer(context, { kind: "direct" });
}
function remoteOptionMode(options) {
	return Reflect.get(options, "mode");
}
function remoteDecorator(invocation, mode, exportName) {
	return function(_method, context) {
		addMarkerInitializer(context, invocation, mode, exportName);
	};
}
function readRemoteMethodDescriptor(prototype) {
	const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
	if (property === void 0) return void 0;
	const descriptor = property.value;
	if (descriptor === null || typeof descriptor !== "object") throw new TypeError("typert-protocol: Remote method descriptor must be an object");
	const version = Reflect.get(descriptor, "version");
	if (version !== 1) throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version)}`);
	const methods = Reflect.get(descriptor, "methods");
	if (!Array.isArray(methods)) throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
	return descriptor;
}
function addMarkerInitializer(context, invocation, mode, exportName) {
	if (context.private || context.static || typeof context.name !== "string") throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
	const method = context.name;
	context.addInitializer(function() {
		const prototype = Object.getPrototypeOf(this);
		if (prototype === null) throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
		mark(prototype, method, invocation, mode, exportName);
	});
}
function mark(prototype, method, invocation, mode, exportName) {
	const descriptor = readRemoteMethodDescriptor(prototype);
	const marker = Object.freeze({
		method,
		...exportName === void 0 || exportName === method ? {} : { exportName },
		...mode === void 0 ? {} : { mode },
		invocation: Object.freeze(invocation)
	});
	const current = descriptor?.methods.find((candidate) => candidate.method === method);
	if (current !== void 0) {
		if (current.exportName === marker.exportName && current.mode === marker.mode && sameInvocation(current.invocation, invocation)) return;
		throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
	}
	Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
		configurable: true,
		value: Object.freeze({
			version: 1,
			methods: Object.freeze([...descriptor?.methods ?? [], marker])
		})
	});
}
function sameInvocation(left, right) {
	if (left.kind === "direct") return right.kind === "direct";
	if (right.kind === "direct") return false;
	return left.context === right.context;
}
function validateName(subject, value) {
	if (!isTypertRemoteSegment(value)) throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-home-paths@0.2.1-alpha.2_@deepseek-ai+cordis@4.0.5-alpha.1/node_modules/@deepseek-ai/dsh-home-paths/lib/index.js
/**
* Shared filesystem path helpers for DeepSeek Harness user data.
*
* @module @deepseek-ai/dsh-home-paths
*/
/** Directory name for the default DeepSeek Harness home under the OS home. */
const DSH_HOME_DIR_NAME = ".dsh";
/** Environment variable that overrides the default DeepSeek Harness home. */
const DSH_HOME_ENV = "DSH_HOME";
/**
* Resolve the default DeepSeek Harness home using Node's platform path rules.
* @returns the absolute default harness home path.
*/
function defaultDshHome() {
	return join(homedir(), DSH_HOME_DIR_NAME);
}
/**
* Expand supported tilde prefixes against the operating-system home.
* @param path - configured path that may begin with `~`, `~/`, or `~\`.
* @returns the expanded path, or the original value when no supported prefix is present.
*/
function expandHomePath(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}
/**
* Resolve one user-data root from an explicit path, an environment override, and a default.
* @param configured - explicit path, which has highest precedence.
* @param env - environment mapping to read.
* @param envName - environment variable that overrides the default.
* @param fallback - default root, used when neither the explicit path nor the environment provides one.
* @returns the normalized absolute root.
*/
function resolveRoot(configured, env, envName, fallback) {
	const fromEnv = env[envName];
	return resolve(expandHomePath(configured ?? (fromEnv !== void 0 && fromEnv.trim().length > 0 ? fromEnv : fallback())));
}
/**
* Resolve the single-root DeepSeek Harness home.
*
* Precedence, highest first: an explicit configured path, `$DSH_HOME`, then
* `~/.dsh`. The harness keeps all user data under one root. An empty or
* whitespace-only `$DSH_HOME` is treated as unset, so a blank override never
* resolves the home to the current working directory.
* @param configured - explicit harness-home override, which has highest precedence.
* @param env - environment mapping used to read `DSH_HOME`.
* @returns the normalized absolute harness home path.
*/
function resolveDshHome(configured, env = process.env) {
	return resolveRoot(configured, env, DSH_HOME_ENV, defaultDshHome);
}
/**
* Join path segments onto the resolved DeepSeek Harness home.
* @param segments - path segments appended to the Harness home; an empty list returns the home itself.
* @returns the normalized absolute joined path.
*/
function dshHomePath(...segments) {
	return join(resolveDshHome(), ...segments);
}
/**
* Join path segments onto the resolved Harness home's `cache` directory without creating it; no arguments returns the directory itself.
* @param optionsOrSegment - explicit home override, or the first path segment; omission uses the default home resolution.
* @param segments - additional path segments after the first child, if any.
* @returns the normalized absolute cache path.
*/
function dshCachePath(optionsOrSegment = {}, ...segments) {
	if (typeof optionsOrSegment === "string") return dshHomePath("cache", optionsOrSegment, ...segments);
	return join(resolveDshHome(optionsOrSegment.dshHome), "cache", ...segments);
}
//#endregion
//#region src/host/paths.ts
function resolveProviderPaths(profileId) {
	const profileRoot = dshHomePath("universal-provider", profileId.replace(/[^a-zA-Z0-9._-]/g, "_") || "default");
	const cacheDir = dshCachePath("universal-provider");
	return {
		profileRoot,
		authDir: join(profileRoot, "auth"),
		configPath: join(profileRoot, "config.yaml"),
		logPath: join(profileRoot, "server.log"),
		lockPath: join(profileRoot, "server.lock"),
		binDir: join(cacheDir, "bin"),
		cacheDir
	};
}
//#endregion
//#region src/host/config.ts
const Config = z.object({
	serverMode: z.union([z.const("managed"), z.const("external")]).default("managed").description("Modo de ejecución: \"managed\" inicia el proxy localmente; \"external\" conecta a uno existente."),
	externalUrl: z.string().default("http://127.0.0.1:8317").description("URL base del servidor CLIProxyAPI en modo external."),
	apiKeyEnv: z.string().role("credential-ref").default("UNIVERSAL_PROVIDER_API_KEY").description("Referencia a la clave de inferencia en ctx.credentials."),
	managementKeyEnv: z.string().role("credential-ref").default("UNIVERSAL_PROVIDER_MANAGEMENT_KEY").description("Referencia a la clave de gestión en ctx.credentials."),
	serverVersion: z.string().default("latest").description("Versión de CLIProxyAPI solicitada para el modo managed."),
	requestLogging: z.boolean().default(false).description("Habilitar registro de peticiones en el servidor CLIProxyAPI."),
	port: z.number().default(8317).description("Puerto local preferido para el servidor managed.")
});
function generateSecret() {
	return randomBytes(32).toString("hex");
}
function buildManagedConfig(options) {
	const lines = [
		"config-version: 8",
		"server:",
		`  host: "${options.host}"`,
		`  port: ${options.port}`,
		"management:",
		"  allow-remote: false",
		`  secret-key: "${options.managementKey}"`,
		"access:",
		"  api-keys:",
		`    - "${options.apiKey}"`,
		"oauth:",
		`  auth-dir: "${options.authDir.replace(/\\/g, "/")}"`,
		"routing:",
		"  strategy: round-robin",
		"  session-affinity: true",
		"  retry:",
		"    request-retry: 3",
		"    max-retry-interval: 30",
		"  cooldown:",
		"    transient-error-cooldown-seconds: -1",
		"observability:",
		"  logs:",
		`    debug: ${options.requestLogging ?? false}`,
		"    logging-to-file: false",
		`    request-log: ${options.requestLogging ?? false}`
	];
	if (options.openAICompatibility && options.openAICompatibility.length > 0) {
		lines.push("api-keys:");
		lines.push("  openai-compatibility:");
		for (const provider of options.openAICompatibility) {
			lines.push(`    - name: "${provider.name}"`);
			lines.push(`      base-url: "${provider["base-url"]}"`);
			if (provider.keys && provider.keys.length > 0) {
				lines.push("      keys:");
				for (const k of provider.keys) lines.push(`        - api-key: "${k["api-key"]}"`);
			}
			if (provider.models && provider.models.length > 0) {
				lines.push("      models:");
				for (const m of provider.models) {
					lines.push(`        - name: "${m.name}"`);
					if (m.alias) lines.push(`          alias: "${m.alias}"`);
				}
			}
		}
	}
	return lines.join("\n") + "\n";
}
//#endregion
//#region src/core/shared/kyFetch.ts
const kyFetch = ky.extend({ fetch: async (input, init) => fetch(input, input instanceof Request && input.body && init?.duplex === void 0 ? {
	...init,
	duplex: "half"
} : init) });
//#endregion
//#region src/host/binary.ts
const REPO = "router-for-me/CLIProxyAPI";
const MIN_CLIPROXY_VERSION = "8.0.3";
function resolveAsset(platform, arch, version) {
	const os = platform === "darwin" ? "darwin" : platform === "win32" ? "windows" : "linux";
	const cpu = arch === "arm64" ? "aarch64" : "amd64";
	const isZip = os === "windows";
	return {
		assetName: `CLIProxyAPI_${version}_${os}_${cpu}.${isZip ? "zip" : "tar.gz"}`,
		binaryName: os === "windows" ? "cli-proxy-api.exe" : "cli-proxy-api",
		isZip
	};
}
function parseChecksums(text) {
	const result = /* @__PURE__ */ new Map();
	for (const line of text.split("\n")) {
		const match = /^([0-9a-f]{64})\s+\*?(\S.*)$/i.exec(line.trim());
		if (match && match[2] && match[1]) result.set(match[2].trim(), match[1].toLowerCase());
	}
	return result;
}
function normalizeVersion(version) {
	return version.trim().replace(/^v/i, "");
}
function isSupportedVersion(version) {
	const normalized = normalizeVersion(version);
	const valid = semver.valid(normalized);
	return valid !== null && semver.satisfies(valid, `>=8.0.3`);
}
const fetcher = kyFetch.extend({
	headers: { "User-Agent": "universal-chat-provider-dsh" },
	retry: { limit: 3 },
	timeout: false
});
async function resolveVersion(requested, signal) {
	if (requested.toLowerCase() !== "latest") return normalizeVersion(requested);
	const payload = await fetcher.get(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: signal ?? null }).json();
	if (typeof payload.tag_name !== "string" || payload.tag_name.length === 0) throw new Error("Could not determine the latest CLIProxyAPI release.");
	return normalizeVersion(payload.tag_name);
}
async function acquireBinary(options) {
	let version;
	try {
		version = await resolveVersion(options.requestedVersion, options.signal);
	} catch (error) {
		const cachedVersion = await readInstalledVersion(options.binDir);
		if (cachedVersion === void 0) throw error;
		options.log?.(`Could not resolve latest CLIProxyAPI release (${error instanceof Error ? error.message : String(error)}). Using cached CLIProxyAPI ${cachedVersion}.`);
		version = cachedVersion;
	}
	if (!isSupportedVersion(version)) throw new Error(`CLIProxyAPI ${version} is not supported. Minimum required version is ${MIN_CLIPROXY_VERSION}.`);
	const asset = resolveAsset(platform(), arch(), version);
	const versionDir = join(options.binDir, version);
	const binaryPath = join(versionDir, asset.binaryName);
	if (await access(binaryPath).then(() => true, () => false)) {
		options.log?.(`Using cached CLIProxyAPI ${version} at ${binaryPath}.`);
		return {
			binaryPath,
			version
		};
	}
	options.log?.(`Downloading CLIProxyAPI ${version} (${asset.assetName})...`);
	const base = `https://github.com/${REPO}/releases/download/v${version}`;
	const signal = options.signal ?? null;
	const [archiveResponse, checksumResponse] = await Promise.all([fetcher.get(`${base}/${asset.assetName}`, { signal }), fetcher.get(`${base}/checksums.txt`, { signal })]);
	const archive = new Uint8Array(await archiveResponse.arrayBuffer());
	const expected = parseChecksums(await checksumResponse.text()).get(asset.assetName);
	if (expected === void 0) throw new Error(`No checksum found for ${asset.assetName}.`);
	const actual = createHash("sha256").update(archive).digest("hex");
	if (actual !== expected) throw new Error(`Checksum mismatch for ${asset.assetName} (expected ${expected}, got ${actual}).`);
	await rm(versionDir, {
		recursive: true,
		force: true
	});
	await mkdir(versionDir, { recursive: true });
	await extractArchive(archive, asset.isZip, versionDir);
	if (!await access(binaryPath).then(() => true, () => false)) throw new Error(`Extracted archive did not contain ${asset.binaryName}.`);
	if (platform() !== "win32") await chmod(binaryPath, 493);
	options.log?.(`Installed CLIProxyAPI ${version} at ${binaryPath}.`);
	await pruneOldVersions(options.binDir, version, options.log);
	return {
		binaryPath,
		version
	};
}
async function extractArchive(archive, isZip, dest) {
	const entries = isZip ? Object.entries(unzipSync(archive)).map(([name, data]) => ({
		name,
		data
	})) : (await parseTarGzip(archive)).map((item) => ({
		name: item.name,
		data: item.data
	}));
	for (const { name, data } of entries) {
		if (data === void 0 || name.endsWith("/")) continue;
		const parts = name.replace(/\\/g, "/").split("/");
		if (parts.includes("..") || parts.some((p) => p.startsWith("/"))) throw new Error(`Refusing to extract unsafe archive entry: ${name}`);
		const target = join(dest, ...parts);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, data);
	}
}
async function readInstalledVersion(binDir) {
	let entries;
	try {
		entries = await readdir(binDir);
	} catch {
		return;
	}
	const valid = entries.filter((entry) => semver.valid(entry) !== null);
	return semver.rsort(valid)[0];
}
async function pruneOldVersions(binDir, keep, log) {
	let entries;
	try {
		entries = await readdir(binDir);
	} catch {
		return;
	}
	await Promise.all(entries.filter((entry) => entry !== keep).map(async (entry) => {
		try {
			await rm(join(binDir, entry), {
				recursive: true,
				force: true
			});
			log?.(`Removed old CLIProxyAPI version ${entry}.`);
		} catch {}
	}));
}
function asValue(schema, value) {
	if (Value.Check(schema, value)) return value;
	[...Value.Errors(schema, value)];
}
function asJsonValue(schema, value) {
	if (typeof value !== "string") return void 0;
	try {
		return asValue(schema, JSON.parse(value));
	} catch {
		return;
	}
}
//#endregion
//#region src/core/api/errors.ts
var ProxyHttpError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.status = status;
		this.name = "ProxyHttpError";
	}
};
//#endregion
//#region src/core/api/codex-citations.ts
const CitationSchema = Type.Object({
	type: Type.Literal("url_citation"),
	start_index: Type.Integer({ minimum: 0 }),
	end_index: Type.Integer({ minimum: 0 }),
	url: Type.String(),
	title: Type.String()
});
const SearchResultCitationSchema = Type.Object({
	type: Type.Literal("web_search_result_location"),
	url: Type.String(),
	title: Type.String()
});
const codexCitations = {
	marker: "",
	render: renderCitations
};
function renderCitations(text, emittedUtf16Length, annotations) {
	const characters = Array.from(text);
	const replacements = /* @__PURE__ */ new Map();
	const sources = /* @__PURE__ */ new Set();
	for (const value of annotations) {
		const source = asValue(SearchResultCitationSchema, value);
		const sourceLink = source && markdownLink(source.url, source.title);
		if (sourceLink !== void 0) sources.add(sourceLink);
		const citation = asValue(CitationSchema, value);
		if (citation === void 0 || citation.end_index > characters.length || citation.end_index <= citation.start_index) continue;
		const marker = characters.slice(citation.start_index, citation.end_index).join("");
		if (!/^\uE200cite\uE202[^\uE201]*\uE201$/.test(marker)) continue;
		const link = markdownLink(citation.url, citation.title);
		if (link === void 0) continue;
		const replacement = replacements.get(citation.start_index) ?? {
			end: citation.end_index,
			links: /* @__PURE__ */ new Set()
		};
		replacement.links.add(link);
		replacements.set(citation.start_index, replacement);
	}
	let codePointOffset = Array.from(text.slice(0, emittedUtf16Length)).length;
	let result = "";
	const orderedReplacements = [...replacements].sort(([left], [right]) => left - right);
	for (const [start, replacement] of orderedReplacements) {
		if (start < codePointOffset) continue;
		result += characters.slice(codePointOffset, start).join("") + [...replacement.links].join(" ");
		codePointOffset = replacement.end;
	}
	const body = result + characters.slice(codePointOffset).join("");
	return sources.size > 0 ? `${body}\n\n${[...sources].join(" ")}` : body;
}
function markdownLink(rawUrl, rawTitle) {
	try {
		const url = new URL(rawUrl);
		if (url.protocol !== "https:" && url.protocol !== "http:") return void 0;
		return `[${(rawTitle.trim() || url.hostname).replace(/\s+/g, " ").replace(/[\\`*_[\]<>]/g, "\\$&")}](<${url.href}>)`;
	} catch {
		return;
	}
}
//#endregion
//#region src/core/api/responses-stream.ts
const ErrorObjectSchema = Type.Object({ message: Type.Optional(Type.String()) });
const StreamItemSchema = Type.Object({
	type: Type.Optional(Type.String()),
	status: Type.Optional(Type.String()),
	call_id: Type.Optional(Type.String()),
	name: Type.Optional(Type.String()),
	arguments: Type.Optional(Type.String()),
	id: Type.Optional(Type.String()),
	action: Type.Optional(Type.Unknown()),
	content: Type.Optional(Type.Array(Type.Unknown()))
});
const StreamResponseSchema = Type.Object({
	usage: Type.Optional(Type.Unknown()),
	incomplete_details: Type.Optional(Type.Union([Type.Null(), Type.Object({ reason: Type.Optional(Type.String()) })])),
	error: Type.Optional(Type.Union([
		Type.Null(),
		Type.String(),
		ErrorObjectSchema
	]))
});
const StreamEventSchema = Type.Object({
	type: Type.Optional(Type.String()),
	delta: Type.Optional(Type.String()),
	item: Type.Optional(Type.Unknown()),
	item_id: Type.Optional(Type.String()),
	output_index: Type.Optional(Type.Unknown()),
	content_index: Type.Optional(Type.Unknown()),
	part: Type.Optional(Type.Unknown()),
	response: Type.Optional(Type.Unknown()),
	error: Type.Optional(Type.Union([Type.String(), ErrorObjectSchema])),
	message: Type.Optional(Type.String())
});
const TextContentSchema = Type.Object({
	type: Type.Literal("output_text"),
	text: Type.String(),
	annotations: Type.Optional(Type.Array(Type.Unknown()))
});
const WebActionSchema = Type.Record(Type.String(), Type.Unknown());
const PlainObjectSchema = Type.Object({});
function streamKey(payload, item, contentIndex) {
	const key = payload.item_id ?? item?.id ?? item?.call_id ?? `output-${String(payload.output_index ?? "unknown")}`;
	return contentIndex === void 0 ? key : `${key}:${String(contentIndex)}`;
}
function streamErrorMessage(payload) {
	const nested = asValue(StreamResponseSchema, payload.response);
	const error = typeof payload.error === "string" ? void 0 : payload.error ?? (typeof nested?.error === "string" ? void 0 : nested?.error);
	const stringError = typeof payload.error === "string" ? payload.error : typeof nested?.error === "string" ? nested.error : void 0;
	return error?.message ?? stringError ?? payload.message ?? "CLIProxyAPI response failed.";
}
function toolCallAssembler(emit) {
	const pending = /* @__PURE__ */ new Map();
	const emitted = /* @__PURE__ */ new Set();
	const create = (key, item) => ({
		callId: item.call_id ?? key,
		name: item.name ?? "unknown_tool",
		arguments: item.arguments ?? ""
	});
	const complete = (call) => {
		if (emitted.has(call.callId)) return;
		emitted.add(call.callId);
		emit(call.callId, call.name, parseToolInput(call.arguments));
	};
	return {
		add(key, item) {
			pending.set(key, create(key, item));
		},
		push(key, delta) {
			const current = pending.get(key);
			if (current) current.arguments += delta;
		},
		end(key, item) {
			const current = pending.get(key) ?? create(key, item);
			pending.delete(key);
			if (item.status === "incomplete") return;
			current.arguments = item.arguments ?? current.arguments;
			complete(current);
		},
		flush() {
			for (const call of pending.values()) complete(call);
			pending.clear();
		}
	};
}
function parseToolInput(raw) {
	if (!raw.trim()) return {};
	try {
		const parsed = JSON.parse(raw);
		return asValue(PlainObjectSchema, parsed) ?? { value: parsed };
	} catch {
		return { raw };
	}
}
function textPartBuffer(emit, renderer) {
	const pending = /* @__PURE__ */ new Map();
	return {
		push(key, delta) {
			const current = pending.get(key) ?? {
				text: "",
				emittedUtf16Length: 0
			};
			current.text += delta;
			pending.set(key, current);
			const marker = current.text.indexOf(renderer.marker, current.emittedUtf16Length);
			const end = marker < 0 ? current.text.length : marker;
			if (end > current.emittedUtf16Length) {
				emit(current.text.slice(current.emittedUtf16Length, end));
				current.emittedUtf16Length = end;
			}
		},
		end(key, value) {
			const current = pending.get(key);
			if (current === void 0) return;
			pending.delete(key);
			const content = asValue(TextContentSchema, value);
			const tail = content?.text === current.text ? renderer.render(current.text, current.emittedUtf16Length, content.annotations ?? []) : current.text.slice(current.emittedUtf16Length);
			if (tail.length > 0) emit(tail);
		},
		flush() {
			for (const current of pending.values()) if (current.emittedUtf16Length < current.text.length) emit(current.text.slice(current.emittedUtf16Length));
			pending.clear();
		}
	};
}
function emitWebSearchStep(rawAction, emit) {
	const action = asValue(WebActionSchema, rawAction);
	const actionType = typeof action?.["type"] === "string" ? action["type"].trim().replace(/[_-]+/g, " ") : "";
	const label = actionType.length > 0 ? actionType.charAt(0).toUpperCase() + actionType.slice(1) : "Web Search";
	const detail = Object.entries(action ?? {}).filter(([key, value]) => key !== "type" && key !== "sources" && value != null).map(([, value]) => {
		if (typeof value === "string") return value.trim();
		if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value.map((entry) => entry.trim()).filter(Boolean).join(", ");
		return JSON.stringify(value);
	}).filter(Boolean).join(", ");
	emit?.(detail.length > 0 ? `${label}: ${detail}` : label);
	emit?.("");
}
function thinkingSectionEmitter(emit) {
	let hasEmittedThinking = false;
	return {
		push(delta) {
			if (delta.length > 0) {
				emit?.(delta);
				hasEmittedThinking = true;
			}
		},
		end() {
			if (hasEmittedThinking) {
				emit?.("");
				hasEmittedThinking = false;
			}
		}
	};
}
//#endregion
//#region src/core/models/model.ts
const ProxyModelListEntrySchema = Type.Object({
	id: Type.String(),
	owned_by: Type.Optional(Type.String()),
	context_length: Type.Optional(Type.Number()),
	max_completion_tokens: Type.Optional(Type.Number())
}, { additionalProperties: true });
const SupportedReasoningLevelSchema = Type.Object({ effort: Type.String() }, { additionalProperties: true });
const ProxyModelMetadataSchema = Type.Object({
	slug: Type.String(),
	display_name: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	context_window: Type.Optional(Type.Number()),
	max_context_window: Type.Optional(Type.Number()),
	visibility: Type.Optional(Type.String()),
	supported_in_api: Type.Optional(Type.Boolean()),
	input_modalities: Type.Optional(Type.Array(Type.String())),
	supports_parallel_tool_calls: Type.Optional(Type.Boolean()),
	supports_search_tool: Type.Optional(Type.Boolean()),
	web_search_tool_type: Type.Optional(Type.String()),
	supported_reasoning_levels: Type.Optional(Type.Array(SupportedReasoningLevelSchema)),
	default_reasoning_level: Type.Optional(Type.String())
}, { additionalProperties: true });
//#endregion
//#region src/core/api/proxy-client.ts
const ErrorBodySchema = Type.Object({
	error: Type.Optional(Type.Union([Type.String(), Type.Object({ message: Type.Optional(Type.String()) })])),
	message: Type.Optional(Type.String())
});
const ModelsListSchema = Type.Object({ data: Type.Optional(Type.Array(ProxyModelListEntrySchema)) }, { additionalProperties: true });
const ModelsMetadataSchema = Type.Object({ models: Type.Optional(Type.Array(ProxyModelMetadataSchema)) }, { additionalProperties: true });
const toProxyHttpError = ({ error }) => {
	if (!isHTTPError(error)) return error;
	const body = error.data;
	const objectBody = asValue(ErrorBodySchema, body);
	return new ProxyHttpError((typeof objectBody?.error === "string" ? objectBody.error : objectBody?.error?.message ?? "").trim() || (objectBody?.message ?? "").trim() || (typeof body === "string" ? body.trim() : "") || `CLIProxyAPI request failed with HTTP ${error.response.status}.`, error.response.status);
};
var CLIProxyClient = class {
	fetcher;
	constructor(baseUrl, apiKey) {
		this.fetcher = kyFetch.extend({
			prefix: baseUrl,
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			retry: 0,
			timeout: false,
			hooks: { beforeError: [toProxyHttpError] }
		});
	}
	async discover(signal) {
		const [available, metadata] = await Promise.all([this.fetcher.get("v1/models", { signal: signal ?? null }).json().then((payload) => asValue(ModelsListSchema, payload)?.data ?? []), this.fetcher.get("v1/models?client_version=0.156.1", { signal: signal ?? null }).json().then((payload) => asValue(ModelsMetadataSchema, payload)?.models ?? []).catch(() => [])]);
		return {
			available,
			metadata
		};
	}
	async streamResponse(body, callbacks, signal) {
		const response = await this.fetcher.post("v1/responses", {
			json: body,
			signal: signal ?? null
		});
		if (!response.body) throw new Error("CLIProxyAPI returned an empty streaming response.");
		const text = textPartBuffer(callbacks.onText, codexCitations);
		const thinking = thinkingSectionEmitter(callbacks.onThinking);
		const tools = toolCallAssembler(callbacks.onToolCall);
		const events = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
		try {
			for await (const event of events) {
				if (event.data === "[DONE]") break;
				const payload = asJsonValue(StreamEventSchema, event.data);
				if (payload === void 0) continue;
				const type = payload.type ?? event.event;
				if (type === "response.output_text.delta") text.push(streamKey(payload, void 0, payload.content_index ?? 0), payload.delta ?? "");
				else if (type === "response.content_part.done") text.end(streamKey(payload, void 0, payload.content_index ?? 0), payload.part);
				else if (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") thinking.push(payload.delta ?? "");
				else if (type === "response.reasoning_summary_text.done" || type === "response.reasoning_summary_part.done" || type === "response.reasoning_text.done") thinking.end();
				else if (type === "response.output_item.added") {
					const item = asValue(StreamItemSchema, payload.item);
					if (item?.type === "function_call") tools.add(streamKey(payload, item), item);
				} else if (type === "response.function_call_arguments.delta") tools.push(streamKey(payload), payload.delta ?? "");
				else if (type === "response.output_item.done") {
					const item = asValue(StreamItemSchema, payload.item);
					if (item?.type === "function_call") tools.end(streamKey(payload, item), item);
					else if (item?.type === "web_search_call") emitWebSearchStep(item.action, callbacks.onThinking);
					else if (item?.type === "message") item.content?.forEach((content, contentIndex) => {
						text.end(streamKey(payload, item, contentIndex), content);
					});
				} else if (type === "response.completed") {
					tools.flush();
					const completed = asValue(StreamResponseSchema, payload.response);
					callbacks.onUsage?.(completed?.usage);
				} else if (type === "response.incomplete") {
					const incomplete = asValue(StreamResponseSchema, payload.response);
					callbacks.onUsage?.(incomplete?.usage);
					const reason = incomplete?.incomplete_details?.reason;
					if (reason === "max_output_tokens") return;
					if (reason === "content_filter") throw new Error("CLIProxyAPI blocked the response with its content filter.");
					throw new Error(reason !== void 0 && reason.length > 0 ? `CLIProxyAPI returned an incomplete response: ${reason}.` : "CLIProxyAPI returned an incomplete response without a reason.");
				} else if (type === "response.failed" || type === "error") throw new Error(streamErrorMessage(payload));
			}
		} finally {
			thinking.end();
			text.flush();
		}
	}
};
//#endregion
//#region src/core/api/management-client.ts
const OPENAI_COMPATIBILITY_PATH = "config/api-keys/openai-compatibility";
const IdTokenSchema = Type.Object({
	email: Type.Optional(Type.String()),
	chatgpt_account_id: Type.Optional(Type.String())
});
const AuthFileRawSchema = Type.Object({
	name: Type.Optional(Type.String()),
	type: Type.Optional(Type.String()),
	provider: Type.Optional(Type.String()),
	email: Type.Optional(Type.String()),
	label: Type.Optional(Type.String()),
	auth_index: Type.Optional(Type.String()),
	project_id: Type.Optional(Type.String()),
	chatgpt_account_id: Type.Optional(Type.String()),
	account_id: Type.Optional(Type.String()),
	id_token: Type.Optional(IdTokenSchema)
});
const AuthFilesPayloadSchema = Type.Object({ files: Type.Optional(Type.Array(Type.Unknown())) });
const ManagementErrorSchema = Type.Object({ error: Type.Optional(Type.String()) });
const AuthUrlPayloadSchema = Type.Object({
	url: Type.Optional(Type.Unknown()),
	state: Type.Optional(Type.Unknown()),
	user_code: Type.Optional(Type.Unknown())
});
const AuthStatusPayloadSchema = Type.Object({
	status: Type.Optional(Type.Unknown()),
	error: Type.Optional(Type.Unknown())
});
const AuthFileModelsPayloadSchema = Type.Object({ models: Type.Optional(Type.Array(Type.Object({ id: Type.String() }, { additionalProperties: true }))) });
const ApiCallResponseSchema = Type.Object({
	status_code: Type.Optional(Type.Number()),
	statusCode: Type.Optional(Type.Number()),
	header: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String()))),
	body: Type.Optional(Type.Unknown())
});
const OpenAICompatibilityProviderSchema = Type.Object({
	"name": Type.String(),
	"base-url": Type.String()
}, { additionalProperties: true });
const OpenAICompatibilityPayloadSchema = Type.Array(Type.Unknown());
const toManagementError = ({ error }) => {
	if (!isHTTPError(error)) return error;
	return new Error(managementErrorMessage(error.data) ?? `Management request failed with HTTP ${error.response.status}.`);
};
var ManagementClient = class {
	fetcher;
	constructor(baseUrl, key) {
		const cleanBase = baseUrl.replace(/\/+$/, "");
		this.fetcher = kyFetch.extend({
			prefix: `${cleanBase}/v8/management/`,
			headers: { Authorization: `Bearer ${key}` },
			retry: 0,
			timeout: false,
			hooks: { beforeError: [toManagementError] }
		});
	}
	async requestAuthUrl(provider, signal) {
		const payload = asValue(AuthUrlPayloadSchema, await this.fetcher.get(`oauth/auth-url?provider=${encodeURIComponent(provider)}&is_webui=true`, { signal: signal ?? null }).json());
		if (typeof payload?.url !== "string" || typeof payload.state !== "string" || payload.state.trim() === "") throw new Error("CLIProxyAPI returned an invalid auth URL response.");
		const userCode = typeof payload.user_code === "string" ? payload.user_code.trim() : "";
		return {
			url: payload.url,
			state: payload.state,
			...userCode ? { userCode } : {}
		};
	}
	async getAuthStatus(state, signal) {
		const payload = asValue(AuthStatusPayloadSchema, await this.fetcher.get(`oauth/status?state=${encodeURIComponent(state)}`, { signal: signal ?? null }).json());
		if (payload?.status === "wait" || payload?.status === "ok") return { status: payload.status };
		if (payload?.status === "error") return {
			status: "error",
			error: typeof payload.error === "string" && payload.error.trim() !== "" ? payload.error : "Authentication failed."
		};
		throw new Error("CLIProxyAPI returned an invalid auth status response.");
	}
	async cancelAuthSession(state, signal) {
		await this.fetcher.delete(`oauth/session?state=${encodeURIComponent(state)}`, { signal: signal ?? null });
	}
	async listAuthFileModels(name, signal) {
		return (asValue(AuthFileModelsPayloadSchema, await this.fetcher.get(`credentials/models?name=${encodeURIComponent(name)}`, { signal: signal ?? null }).json())?.models ?? []).map((model) => model.id);
	}
	async listAuthFiles(signal) {
		return (await this.listAuthFilesRaw(signal)).filter((file) => file.name !== void 0).map((file) => file.type === void 0 ? { name: file.name } : {
			name: file.name,
			type: file.type
		});
	}
	async deleteAuthFile(name, signal) {
		await this.fetcher.delete(`credentials?name=${encodeURIComponent(name)}`, { signal: signal ?? null });
	}
	async listAuthFilesRaw(signal) {
		return (asValue(AuthFilesPayloadSchema, await this.fetcher.get("credentials", { signal: signal ?? null }).json())?.files ?? []).flatMap((file) => {
			const entry = asValue(AuthFileRawSchema, file);
			return entry === void 0 ? [] : [entry];
		});
	}
	async serverVersion(signal) {
		const version = (await this.fetcher.get("credentials", { signal: signal ?? null })).headers.get("x-cpa-version")?.trim();
		return version === void 0 || version === "" ? void 0 : version;
	}
	async apiCall(payload, signal) {
		const json = asValue(ApiCallResponseSchema, await this.fetcher.post("requests/api-call", {
			json: payload,
			signal: signal ?? null,
			retry: {
				limit: 2,
				methods: ["post"],
				statusCodes: [
					500,
					502,
					503,
					504
				]
			}
		}).json());
		return {
			statusCode: json?.status_code ?? json?.statusCode ?? 0,
			header: json?.header ?? {},
			body: json?.body
		};
	}
	async listOpenAICompatibility(signal) {
		const response = await this.fetcher.get(OPENAI_COMPATIBILITY_PATH, {
			signal: signal ?? null,
			throwHttpErrors: (status) => status !== 404
		});
		if (response.status === 404) return [];
		return (asValue(OpenAICompatibilityPayloadSchema, await response.json()) ?? []).flatMap((entry) => {
			const provider = asValue(OpenAICompatibilityProviderSchema, entry);
			return provider === void 0 ? [] : [provider];
		});
	}
	async putOpenAICompatibility(providers, signal) {
		await this.fetcher.put(OPENAI_COMPATIBILITY_PATH, {
			json: providers,
			signal: signal ?? null
		});
	}
};
function managementErrorMessage(data) {
	return asValue(ManagementErrorSchema, data)?.error ?? (typeof data === "string" && data.trim() ? data.trim() : void 0);
}
//#endregion
//#region src/host/server.ts
var ServerSupervisor = class {
	ctx;
	paths;
	config;
	activeRequests = 0;
	managedHandle;
	client;
	managementClient;
	info;
	lockFd;
	startingPromise;
	constructor(ctx, paths, config) {
		this.ctx = ctx;
		this.paths = paths;
		this.config = config;
	}
	async getFreePort(preferred = 8317) {
		return new Promise((resolve) => {
			const srv = net.createServer();
			srv.listen(preferred, "127.0.0.1", () => {
				const port = srv.address().port;
				srv.close(() => resolve(port));
			});
			srv.on("error", () => {
				const fallback = net.createServer();
				fallback.listen(0, "127.0.0.1", () => {
					const port = fallback.address().port;
					fallback.close(() => resolve(port));
				});
			});
		});
	}
	async acquireRequest() {
		this.activeRequests++;
		let released = false;
		return () => {
			if (!released) {
				released = true;
				this.activeRequests = Math.max(0, this.activeRequests - 1);
			}
		};
	}
	getActiveRequests() {
		return this.activeRequests;
	}
	async ensureRunning(signal) {
		if (this.info) return this.info;
		if (this.startingPromise) return this.startingPromise;
		this.startingPromise = this.startInternal(signal);
		try {
			this.info = await this.startingPromise;
			return this.info;
		} finally {
			this.startingPromise = void 0;
		}
	}
	async startInternal(signal) {
		if (this.config.serverMode === "external") {
			const baseUrl = this.config.externalUrl.replace(/\/+$/, "");
			const apiKey = await this.resolveCredential(this.config.apiKeyEnv) ?? "";
			const mgmtKey = await this.resolveCredential(this.config.managementKeyEnv) ?? "";
			this.client = new CLIProxyClient(baseUrl, apiKey);
			if (mgmtKey) this.managementClient = new ManagementClient(baseUrl, mgmtKey);
			return {
				baseUrl,
				mode: "external"
			};
		}
		await mkdir(this.paths.profileRoot, {
			recursive: true,
			mode: 448
		});
		await mkdir(this.paths.authDir, {
			recursive: true,
			mode: 448
		});
		try {
			this.lockFd = openSync(this.paths.lockPath, "wx");
		} catch (err) {
			if (err.code === "EEXIST") throw new Error(`universal-provider: Another server manager owns this profile data (${this.paths.lockPath}). Close the other instance or configure serverMode: "external" to share an already running proxy.`);
			throw err;
		}
		const { binaryPath, version } = await acquireBinary({
			binDir: this.paths.binDir,
			requestedVersion: this.config.serverVersion,
			log: (msg) => this.ctx.logger?.info?.(msg),
			signal
		});
		const port = await this.getFreePort(this.config.port);
		const apiKey = generateSecret();
		const managementKey = generateSecret();
		const configYaml = buildManagedConfig({
			host: "127.0.0.1",
			port,
			apiKey,
			managementKey,
			authDir: this.paths.authDir,
			requestLogging: this.config.requestLogging
		});
		await writeFile(this.paths.configPath, configYaml, { mode: 384 });
		const baseUrl = `http://127.0.0.1:${port}`;
		const subprocess = this.ctx.subprocess;
		if (subprocess && typeof subprocess.spawn === "function") {
			this.managedHandle = subprocess.spawn({
				argv: [
					binaryPath,
					"--config",
					this.paths.configPath
				],
				cwd: this.paths.profileRoot,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: 65536 },
					stderr: { maxBytes: 65536 }
				},
				graceMs: 5e3
			});
			this.managedHandle.done?.then((outcome) => {
				this.ctx.logger?.warn?.(`CLIProxyAPI exited: code ${outcome?.exitCode}, signal ${outcome?.signal}`);
				this.info = void 0;
			}, (error) => {
				this.ctx.logger?.error?.(`CLIProxyAPI process failed: ${error}`);
				this.info = void 0;
			});
		}
		this.client = new CLIProxyClient(baseUrl, apiKey);
		this.managementClient = new ManagementClient(baseUrl, managementKey);
		await this.waitForHealthy(this.client, signal);
		return {
			baseUrl,
			mode: "managed",
			port,
			version
		};
	}
	async waitForHealthy(client, signal, maxAttempts = 50) {
		for (let i = 0; i < maxAttempts; i++) {
			if (signal?.aborted) throw new Error("Server startup aborted");
			try {
				await client.discover(signal);
				return;
			} catch {
				await new Promise((r) => setTimeout(r, 200));
			}
		}
		throw new Error("CLIProxyAPI failed to become healthy within timeout.");
	}
	async resolveCredential(ref) {
		const creds = this.ctx.credentials;
		if (creds && typeof creds.resolve === "function") {
			const hit = await creds.resolve(ref);
			if (hit?.value) return hit.value;
		}
		return process.env[ref];
	}
	getProxyClient() {
		return this.client;
	}
	getManagementClient() {
		return this.managementClient;
	}
	async dispose() {
		if (this.managedHandle) {
			try {
				this.managedHandle.terminate?.();
			} catch {}
			this.managedHandle = void 0;
		}
		if (this.lockFd !== void 0) {
			try {
				closeSync(this.lockFd);
				unlinkSync(this.paths.lockPath);
			} catch {}
			this.lockFd = void 0;
		}
		this.info = void 0;
	}
};
//#endregion
//#region src/core/models/catalog-match.ts
const VARIANT_SUFFIX = /-(?:openai-compact|nothinking|thinking-\d+|thinking|internet|search|online|minimal|medium|xhigh|high|low|none|max|ultra|auto)$/i;
function matchCatalogModel(id, catalog) {
	const bare = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
	for (const root of /* @__PURE__ */ new Set([id, bare])) for (const name of /* @__PURE__ */ new Set([root, root.split(":")[0] ?? root])) for (let current = name;;) {
		const hit = catalog.get(current) ?? (current.includes(".") ? catalog.get(current.replaceAll(".", "-")) : void 0);
		if (hit !== void 0) return hit;
		const next = current.replace(VARIANT_SUFFIX, "");
		if (next === current || next === "") break;
		current = next;
	}
}
//#endregion
//#region src/core/shared/url.ts
function urlHostname(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return;
	}
}
//#endregion
//#region src/core/models/catalog.ts
const CatalogPayloadSchema = Type.Object({}, { additionalProperties: true });
const MODEL_CATALOG_URL = "https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json";
const MODELS_DEV_CATALOG_URL = "https://models.dev/catalog.json";
let catalogCache;
const CatalogThinkingSchema = Type.Object({
	max: Type.Optional(Type.Number()),
	zero_allowed: Type.Optional(Type.Boolean()),
	dynamic_allowed: Type.Optional(Type.Boolean()),
	levels: Type.Optional(Type.Array(Type.String()))
});
const CatalogModelSchema = Type.Object({
	id: Type.String(),
	type: Type.Optional(Type.String()),
	display_name: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	version: Type.Optional(Type.String()),
	context_length: Type.Optional(Type.Number()),
	max_completion_tokens: Type.Optional(Type.Number()),
	inputTokenLimit: Type.Optional(Type.Number()),
	outputTokenLimit: Type.Optional(Type.Number()),
	supported_parameters: Type.Optional(Type.Array(Type.String())),
	supportedInputModalities: Type.Optional(Type.Array(Type.String())),
	supportedOutputModalities: Type.Optional(Type.Array(Type.String())),
	thinking: Type.Optional(CatalogThinkingSchema),
	fastCostMultiplier: Type.Optional(Type.Number())
});
const ModelsDevCostSchema = Type.Object({ output: Type.Optional(Type.Number()) }, { additionalProperties: true });
const ModelsDevModelSchema = Type.Object({
	id: Type.String(),
	name: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	reasoning_options: Type.Optional(Type.Array(Type.Object({ values: Type.Optional(Type.Array(Type.Unknown())) }, { additionalProperties: true }))),
	tool_call: Type.Optional(Type.Boolean()),
	cost: Type.Optional(ModelsDevCostSchema),
	experimental: Type.Optional(Type.Object({ modes: Type.Optional(Type.Object({ fast: Type.Optional(Type.Object({ cost: Type.Optional(ModelsDevCostSchema) }, { additionalProperties: true })) }, { additionalProperties: true })) }, { additionalProperties: true })),
	modalities: Type.Optional(Type.Object({
		input: Type.Optional(Type.Array(Type.String())),
		output: Type.Optional(Type.Array(Type.String()))
	}, { additionalProperties: true })),
	limit: Type.Optional(Type.Object({
		context: Type.Optional(Type.Number()),
		input: Type.Optional(Type.Number()),
		output: Type.Optional(Type.Number())
	}, { additionalProperties: true }))
}, { additionalProperties: true });
const ModelsDevCatalogSchema = Type.Object({
	providers: Type.Optional(Type.Record(Type.String(), Type.Object({
		id: Type.String(),
		api: Type.Optional(Type.String()),
		models: Type.Record(Type.String(), ModelsDevModelSchema)
	}, { additionalProperties: true }))),
	models: Type.Optional(Type.Record(Type.String(), ModelsDevModelSchema))
}, { additionalProperties: true });
async function fetchCatalog(signal) {
	if (catalogCache) return catalogCache;
	const [routerPayload, modelsDevPayload] = await Promise.all([fetchPayload(MODEL_CATALOG_URL, signal), fetchPayload(MODELS_DEV_CATALOG_URL, signal)]);
	catalogCache = {
		router: flattenCatalog(routerPayload),
		modelsDev: flattenModelsDevCatalog(modelsDevPayload)
	};
	return catalogCache;
}
function flattenCatalog(payload) {
	const result = /* @__PURE__ */ new Map();
	const root = asValue(CatalogPayloadSchema, payload);
	if (root === void 0) return result;
	for (const value of Object.values(root)) {
		if (!Array.isArray(value)) continue;
		for (const candidate of value) {
			const model = asValue(CatalogModelSchema, candidate);
			if (model === void 0) continue;
			const current = result.get(model.id);
			if (!current || scoreCatalogModel(model) > scoreCatalogModel(current)) result.set(model.id, model);
		}
	}
	return result;
}
function scoreCatalogModel(model) {
	return Number((model.context_length ?? model.inputTokenLimit ?? 0) > 0) + Number((model.max_completion_tokens ?? model.outputTokenLimit ?? 0) > 0) + Number(model.thinking !== void 0);
}
async function fetchPayload(url, signal) {
	try {
		return await kyFetch.get(url, { signal: signal ?? null }).json();
	} catch {
		return;
	}
}
function flattenModelsDevCatalog(payload) {
	const result = /* @__PURE__ */ new Map();
	const modelsDev = asValue(ModelsDevCatalogSchema, payload);
	if (modelsDev === void 0) return result;
	for (const [id, candidate] of Object.entries(modelsDev.models ?? {})) {
		const model = toCatalogModel(candidate);
		const separator = id.indexOf("/");
		const owner = separator === -1 ? void 0 : id.slice(0, separator);
		const modelId = separator === -1 ? id : id.slice(separator + 1);
		const providerModel = owner === void 0 ? void 0 : modelsDev.providers?.[owner]?.models[modelId];
		result.set(id, model);
		result.set(modelId, providerModel === void 0 ? model : toCatalogModel(providerModel));
	}
	for (const [providerId, provider] of Object.entries(modelsDev.providers ?? {})) for (const [modelId, candidate] of Object.entries(provider.models)) {
		const model = toCatalogModel(candidate);
		result.set(`${providerId}/${modelId}`, model);
		const hostname = provider.api === void 0 ? void 0 : apiHostname(provider.api);
		if (hostname !== void 0) result.set(`${hostname}/${modelId}`, model);
	}
	return result;
}
function toCatalogModel(model) {
	const levels = model.reasoning_options?.flatMap((option) => option.values ?? []).filter((value) => typeof value === "string") ?? [];
	const fastMultiplier = fastCostMultiplier(model);
	const output = model.limit?.output;
	const input = model.limit?.input ?? (model.limit?.context === void 0 || output === void 0 ? void 0 : output < model.limit.context ? model.limit.context - output : model.limit.context);
	return {
		id: model.id,
		...model.name === void 0 ? {} : { display_name: model.name },
		...model.description === void 0 ? {} : { description: model.description },
		...input === void 0 ? {} : { context_length: input },
		...output === void 0 ? {} : { max_completion_tokens: output },
		...model.tool_call === void 0 ? {} : { supported_parameters: model.tool_call ? ["tools"] : [] },
		...model.modalities?.input === void 0 ? {} : { supportedInputModalities: model.modalities.input },
		...model.modalities?.output === void 0 ? {} : { supportedOutputModalities: model.modalities.output },
		...levels.length === 0 ? {} : { thinking: { levels } },
		...fastMultiplier === void 0 ? {} : { fastCostMultiplier: fastMultiplier }
	};
}
function fastCostMultiplier(model) {
	const base = model.cost?.output;
	const fast = model.experimental?.modes?.fast?.cost?.output;
	if (base === void 0 || fast === void 0 || base <= 0 || fast <= 0) return void 0;
	return Math.round(fast / base * 10) / 10;
}
function apiHostname(value) {
	const hostname = urlHostname(value);
	return hostname ? hostname.replace(/^www\./, "") : void 0;
}
//#endregion
//#region src/host/adapter.ts
var UniversalLlmAdapter = class {
	supervisor;
	catalogs;
	lastDiscoveredModels = [];
	lastDiscoveredTime = 0;
	constructor(supervisor) {
		this.supervisor = supervisor;
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "Universal Provider"
		};
	}
	providerRetryPolicy(_provider) {}
	imageRequestPricing(_provider, _model) {}
	defaultFallbackModels(provider) {
		return [{
			provider,
			id: "universal-chat",
			name: "Universal Chat (Auto)",
			inputModalities: ["text"],
			description: "Modelo universal conectado a CLIProxyAPI."
		}];
	}
	async listModels(provider) {
		try {
			await this.supervisor.ensureRunning();
			const client = this.supervisor.getProxyClient();
			if (!client) return this.lastDiscoveredModels.length ? this.lastDiscoveredModels : this.defaultFallbackModels(provider);
			const discovery = await client.discover();
			if (!this.catalogs) try {
				this.catalogs = await fetchCatalog();
			} catch {}
			const models = discovery.available.map((entry) => {
				const metadata = discovery.metadata.find((m) => m.slug === entry.id);
				const catalogMatch = this.catalogs ? matchCatalogModel(entry.id, this.catalogs.router) : void 0;
				const name = metadata?.display_name || catalogMatch?.display_name || entry.id;
				const modalities = ["text"];
				if (metadata?.input_modalities?.includes("image") || catalogMatch?.supportedInputModalities?.includes("image")) modalities.push("image");
				return {
					provider,
					id: entry.id,
					name,
					description: metadata?.description || catalogMatch?.description,
					inputModalities: modalities
				};
			});
			if (models.length > 0) {
				this.lastDiscoveredModels = models;
				this.lastDiscoveredTime = Date.now();
				return models;
			}
			return this.defaultFallbackModels(provider);
		} catch {
			return this.lastDiscoveredModels.length ? this.lastDiscoveredModels : this.defaultFallbackModels(provider);
		}
	}
	async resolveModel(provider, model, signal) {
		let contextWindow = 128e3;
		let maxOutputTokens = 4096;
		let modalities = ["text"];
		let reasoningEfforts;
		try {
			await this.supervisor.ensureRunning(signal);
			const client = this.supervisor.getProxyClient();
			if (client) {
				const discovery = await client.discover(signal);
				const metadata = discovery.metadata.find((m) => m.slug === model);
				const entry = discovery.available.find((m) => m.id === model);
				if (entry?.context_length) contextWindow = entry.context_length;
				if (metadata?.context_window) contextWindow = metadata.context_window;
				if (entry?.max_completion_tokens) maxOutputTokens = entry.max_completion_tokens;
				if (metadata?.supported_reasoning_levels && metadata.supported_reasoning_levels.length > 0) reasoningEfforts = metadata.supported_reasoning_levels.map((l) => ({
					id: l.effort,
					name: l.effort.charAt(0).toUpperCase() + l.effort.slice(1)
				}));
				if (metadata?.input_modalities?.includes("image")) modalities.push("image");
			}
		} catch {}
		return {
			provider,
			id: model,
			name: model === "universal-chat" ? "Universal Chat (Auto)" : model,
			inputModalities: modalities,
			context: { contextWindow },
			defaultMaxTokens: maxOutputTokens,
			...reasoningEfforts ? { reasoning: {
				efforts: reasoningEfforts,
				defaultEffort: reasoningEfforts[0]?.id
			} } : {}
		};
	}
	async prepareCall(provider, model, signal) {
		return {
			model: await this.resolveModel(provider, model, signal),
			stream: (options) => this.stream(options)
		};
	}
	async *stream(options) {
		const release = await this.supervisor.acquireRequest();
		try {
			let client;
			try {
				await this.supervisor.ensureRunning(options.signal);
				client = this.supervisor.getProxyClient();
			} catch (e) {
				yield {
					type: "block-start",
					index: 0,
					blockType: "text"
				};
				yield {
					type: "text-delta",
					index: 0,
					text: `[Universal Provider] Servidor CLIProxyAPI en preparación o no disponible (${e?.message || "sin iniciar"}). Abre Settings -> Universal Provider para configurar una cuenta OAuth o endpoint.`
				};
				yield {
					type: "block-end",
					index: 0,
					block: {
						type: "text",
						text: `[Universal Provider] Servidor CLIProxyAPI en preparación o no disponible (${e?.message || "sin iniciar"}). Abre Settings -> Universal Provider para configurar una cuenta OAuth o endpoint.`
					}
				};
				yield {
					type: "finish",
					reason: { kind: "stop" }
				};
				return;
			}
			if (!client) throw new Error("CLIProxyAPI client unavailable");
			const body = this.buildRequestBody(options);
			let nextIndex = 0;
			let textIndex;
			let textAccumulated = "";
			let reasoningIndex;
			let reasoningAccumulated = "";
			const toolCalls = /* @__PURE__ */ new Map();
			let capturedUsage;
			let streamError;
			const queue = [];
			let notify;
			const pushItem = (item) => {
				queue.push(item);
				notify?.();
			};
			const streamPromise = client.streamResponse(body, {
				onText: (delta) => {
					if (textIndex === void 0) {
						textIndex = nextIndex++;
						pushItem({
							type: "block-start",
							index: textIndex,
							blockType: "text"
						});
					}
					textAccumulated += delta;
					pushItem({
						type: "text-delta",
						index: textIndex,
						text: delta
					});
				},
				onThinking: (delta) => {
					if (!delta) return;
					if (reasoningIndex === void 0) {
						reasoningIndex = nextIndex++;
						pushItem({
							type: "block-start",
							index: reasoningIndex,
							blockType: "reasoning"
						});
					}
					reasoningAccumulated += delta;
					pushItem({
						type: "reasoning-delta",
						index: reasoningIndex,
						text: delta
					});
				},
				onToolCall: (callId, name, input) => {
					const index = nextIndex++;
					const args = JSON.stringify(input);
					toolCalls.set(callId, {
						index,
						id: callId,
						name,
						arguments: args
					});
					pushItem({
						type: "block-start",
						index,
						blockType: "tool-call"
					});
					pushItem({
						type: "tool-call-delta",
						index,
						id: callId,
						name,
						argumentsDelta: args
					});
					pushItem({
						type: "block-end",
						index,
						block: {
							type: "tool-call",
							id: callId,
							name,
							arguments: args
						}
					});
				},
				onUsage: (usage) => {
					capturedUsage = usage;
				}
			}, options.signal).catch((err) => {
				streamError = err;
			});
			while (true) {
				if (options.signal?.aborted) {
					yield {
						type: "finish",
						reason: {
							kind: "aborted",
							failure: {
								code: "CANCELLED",
								message: "Stream aborted by caller"
							}
						}
					};
					return;
				}
				while (queue.length > 0) yield queue.shift();
				const isDone = await Promise.race([streamPromise.then(() => true), new Promise((resolve) => {
					notify = () => resolve(false);
				})]);
				while (queue.length > 0) yield queue.shift();
				if (isDone) break;
			}
			if (streamError) {
				const status = streamError instanceof ProxyHttpError ? streamError.status : void 0;
				yield {
					type: "finish",
					reason: {
						kind: "error",
						failure: {
							code: streamError.name || "STREAM_ERROR",
							message: streamError.message,
							...status ? { status } : {}
						}
					}
				};
				return;
			}
			if (textIndex !== void 0) yield {
				type: "block-end",
				index: textIndex,
				block: {
					type: "text",
					text: textAccumulated
				}
			};
			if (reasoningIndex !== void 0) yield {
				type: "block-end",
				index: reasoningIndex,
				block: {
					type: "reasoning",
					text: reasoningAccumulated
				}
			};
			if (capturedUsage) yield {
				type: "usage",
				usage: {
					inputTokens: capturedUsage.prompt_tokens ?? capturedUsage.input_tokens ?? 0,
					outputTokens: capturedUsage.completion_tokens ?? capturedUsage.output_tokens ?? 0,
					totalTokens: capturedUsage.total_tokens ?? 0,
					cacheReadTokens: capturedUsage.prompt_tokens_details?.cached_tokens
				}
			};
			yield {
				type: "finish",
				reason: { kind: toolCalls.size > 0 ? "tool-calls" : "stop" }
			};
		} finally {
			release();
		}
	}
	buildRequestBody(options) {
		const input = [];
		for (const msg of options.messages ?? []) {
			const role = msg.role;
			if (role === "system" || role === "developer") {
				const text = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((c) => c.text || "").join("\n") : "";
				input.push({
					role,
					content: [{
						type: "input_text",
						text
					}]
				});
			} else if (role === "user") {
				const contents = [];
				if (typeof msg.content === "string") contents.push({
					type: "input_text",
					text: msg.content
				});
				else if (Array.isArray(msg.content)) {
					for (const block of msg.content) if (block.type === "text") contents.push({
						type: "input_text",
						text: block.text
					});
					else if (block.type === "image" && block.attachment) {
						const mime = block.attachment.mediaType || "image/png";
						contents.push({
							type: "input_image",
							image_url: `data:${mime};base64,${block.attachment.base64 || ""}`
						});
					}
				}
				input.push({
					role: "user",
					content: contents
				});
			} else if (role === "assistant") {
				const contents = [];
				if (typeof msg.content === "string") contents.push({
					type: "output_text",
					text: msg.content
				});
				else if (Array.isArray(msg.content)) {
					for (const block of msg.content) if (block.type === "text") contents.push({
						type: "output_text",
						text: block.text
					});
					else if (block.type === "tool-call") input.push({
						type: "function_call",
						call_id: block.id,
						name: block.name,
						arguments: block.arguments
					});
				}
				if (contents.length > 0) input.push({
					role: "assistant",
					content: contents
				});
			} else if (role === "tool") {
				const output = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((c) => c.text || "").join("\n") : JSON.stringify(msg.content);
				input.push({
					type: "function_call_output",
					call_id: msg.toolCallId,
					output
				});
			}
		}
		const tools = (options.tools ?? []).map((t) => ({
			type: "function",
			name: t.name,
			description: t.description,
			parameters: t.parameters || {
				type: "object",
				properties: {}
			},
			strict: false
		}));
		return {
			model: options.model,
			input,
			stream: true,
			max_output_tokens: options.maxTokens ?? 4096,
			...options.reasoningEffort ? { reasoning: {
				effort: options.reasoningEffort,
				summary: "detailed"
			} } : {},
			...tools.length > 0 ? {
				tools,
				tool_choice: "auto",
				parallel_tool_calls: true
			} : {}
		};
	}
};
//#endregion
//#region src/host/auxiliary.ts
async function generateCommitDraft(ctx, cwd, model = "universal-mock", signal) {
	signal?.throwIfAborted();
	let diffOutput = "";
	const subprocess = ctx.subprocess;
	if (subprocess && typeof subprocess.spawn === "function") {
		const handle = subprocess.spawn({
			argv: [
				"git",
				"diff",
				"--cached"
			],
			cwd,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: 65536 },
				stderr: { maxBytes: 16384 }
			},
			graceMs: 3e3
		});
		const { exitCode } = await handle.done;
		if (exitCode === 0 && handle.collected?.stdout) diffOutput = handle.collected.stdout.readFrom(0)?.trim() || "";
	}
	if (!diffOutput) return {
		hasStagedChanges: false,
		message: "No hay cambios en stage (git diff --cached está vacío). Agrega archivos con git add antes de generar un borrador."
	};
	const llm = ctx.llm;
	if (!llm) throw new Error("LLM service is not available.");
	const prompt = `Eres un asistente experto en Git. Genera un mensaje de commit claro, conciso y siguiendo las convenciones de Conventional Commits (feat, fix, refactor, docs, chore...) basado en el diff de cambios staged proporcionado. Responde ÚNICAMENTE con el mensaje de commit sin explicaciones ni bloques de markdown adicionales.\n\nDiff:\n${diffOutput.slice(0, 32e3)}`;
	let draft = "";
	for await (const chunk of llm.stream({
		provider: "universal-chat-provider",
		model,
		messages: [{
			role: "user",
			content: [{
				type: "text",
				text: prompt
			}]
		}],
		signal
	})) if (chunk.type === "text-delta") draft += chunk.text;
	return {
		hasStagedChanges: true,
		draft: draft.trim()
	};
}
async function configureAuxiliaryTitles(ctx, model) {
	const configEditor = ctx.configEditor;
	if (!configEditor || typeof configEditor.edit !== "function") return;
	const titleEntry = configEditor.entries().find((e) => e.name?.includes("session-title"));
	if (!titleEntry) return;
	await configEditor.edit(titleEntry, (current) => ({
		...current,
		provider: "universal-chat-provider",
		model
	}));
}
async function configureAuxiliaryCompaction(ctx, model) {
	const configEditor = ctx.configEditor;
	if (!configEditor || typeof configEditor.edit !== "function") return;
	const compactionEntry = configEditor.entries().find((e) => e.name?.includes("compaction-basic"));
	if (!compactionEntry) return;
	await configEditor.edit(compactionEntry, (current) => ({
		...current,
		summarizationProvider: "universal-chat-provider",
		summarizationModel: model
	}));
}
//#endregion
//#region src/core/quota/providers/types.ts
function Nullable(schema) {
	return Type.Optional(Type.Union([schema, Type.Null()]));
}
function clamp(value, low, high) {
	return Math.min(Math.max(value, low), high);
}
function parseReset(value) {
	if (value == null) return void 0;
	const ms = typeof value === "string" ? Date.parse(value) : value * 1e3;
	return Number.isNaN(ms) || ms <= Date.now() ? void 0 : ms;
}
function percentOf(used, limit) {
	return used === void 0 || limit === void 0 || limit <= 0 ? void 0 : used / limit * 100;
}
function minRemaining(windows) {
	const percents = windows.map((window) => window.remainingPercent).filter((percent) => percent !== void 0);
	return percents.length > 0 ? Math.min(...percents) : void 0;
}
//#endregion
//#region src/core/quota/providers/antigravity.ts
const MODELS_URL = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
const ModelSchema = Type.Object({ quotaInfo: Type.Optional(Type.Object({
	remainingFraction: Type.Optional(Type.Number()),
	resetTime: Type.Optional(Type.Union([Type.String(), Type.Number()]))
})) });
const BodySchema$4 = Type.Object({ models: Type.Optional(Type.Record(Type.String(), Type.Unknown())) });
const antigravityProvider = {
	method: "POST",
	url: MODELS_URL,
	header: {
		"Authorization": "Bearer $TOKEN$",
		"Content-Type": "application/json",
		"User-Agent": "antigravity/1.11.5 windows/amd64"
	},
	body: (entry) => {
		const projectId = entry.project_id?.trim() ?? "";
		return projectId === "" ? { error: "missing project_id" } : { data: JSON.stringify({ project: projectId }) };
	},
	apply: (report, data) => {
		report.models = parseModels(data);
	},
	owners: ["antigravity"],
	remaining: (report, proxyModelId) => report.models?.[proxyModelId]?.remainingPercent
};
function parseModels(data) {
	const models = asValue(BodySchema$4, data)?.models;
	if (models === void 0) return {};
	const out = {};
	for (const [id, rawValue] of Object.entries(models)) {
		const quotaInfo = asValue(ModelSchema, rawValue)?.quotaInfo;
		if (quotaInfo?.remainingFraction === void 0) continue;
		const resetsAt = parseReset(quotaInfo.resetTime);
		out[id] = {
			remainingPercent: clamp(quotaInfo.remainingFraction * 100, 0, 100),
			...resetsAt === void 0 ? {} : { resetsAt }
		};
	}
	return out;
}
//#endregion
//#region src/core/quota/providers/claude.ts
const USAGE_URL$2 = "https://api.anthropic.com/api/oauth/usage";
const SEVEN_DAY_FAMILY = /^seven_day_(.+)$/;
const WindowSchema$1 = Type.Object({
	utilization: Nullable(Type.Number()),
	resets_at: Nullable(Type.Union([Type.String(), Type.Number()])),
	is_enabled: Type.Optional(Type.Boolean()),
	used_credits: Type.Optional(Type.Number()),
	monthly_limit: Nullable(Type.Number()),
	currency: Type.Optional(Type.String()),
	decimal_places: Type.Optional(Type.Number())
});
const WindowValueSchema = Type.Union([WindowSchema$1, Type.Null()]);
const BodySchema$3 = Type.Object({
	extra_usage: Type.Optional(WindowValueSchema),
	limits: Nullable(Type.Array(Type.Unknown()))
}, { additionalProperties: true });
const claudeProvider = {
	method: "GET",
	url: USAGE_URL$2,
	header: {
		"Authorization": "Bearer $TOKEN$",
		"Accept": "application/json",
		"anthropic-beta": "oauth-2025-04-20"
	},
	apply: (report, data) => {
		report.windows = parseWindows$3(data);
	},
	owners: ["anthropic"],
	remaining: (report, proxyModelId) => {
		const id = proxyModelId.toLowerCase();
		return minRemaining(report.windows.filter((window) => {
			if (window.key === "extra_usage") return false;
			const family = sevenDayFamily(window.key);
			return family === void 0 || id.includes(family);
		}));
	}
};
function sevenDayFamily(key) {
	return SEVEN_DAY_FAMILY.exec(key ?? "")?.[1];
}
function parseWindows$3(data) {
	const body = asValue(BodySchema$3, data);
	if (body === void 0) return [];
	const windows = [];
	for (const [key, rawValue] of Object.entries(body)) {
		const label = windowLabel$1(key);
		if (label === void 0) continue;
		const raw = asValue(WindowValueSchema, rawValue);
		if (raw == null) continue;
		const used = raw.utilization;
		const resetsAt = parseReset(raw.resets_at);
		windows.push({
			key,
			label,
			...used == null ? {} : { remainingPercent: clamp(100 - used, 0, 100) },
			...resetsAt === void 0 ? {} : { resetsAt }
		});
	}
	return windows;
}
function windowLabel$1(key) {
	if (key === "five_hour") return "5h Quota";
	if (key === "seven_day") return "7d Quota";
	if (key === "extra_usage") return "Extra Usage";
	const family = sevenDayFamily(key);
	if (family !== void 0) return `7d ${family.charAt(0).toUpperCase() + family.slice(1)}`;
}
//#endregion
//#region src/core/quota/providers/codex.ts
const USAGE_URL$1 = "https://chatgpt.com/backend-api/wham/usage";
const WEEKLY_WINDOW_SECONDS = 604800;
const WindowSchema = Type.Object({
	used_percent: Nullable(Type.Number()),
	limit_window_seconds: Nullable(Type.Number()),
	reset_at: Nullable(Type.Union([Type.String(), Type.Number()])),
	reset_after_seconds: Nullable(Type.Number())
});
const RateLimitSchema = Type.Object({
	primary_window: Nullable(WindowSchema),
	secondary_window: Nullable(WindowSchema)
});
const AdditionalLimitSchema = Type.Object({
	limit_name: Nullable(Type.String()),
	metered_feature: Nullable(Type.String()),
	rate_limit: Nullable(RateLimitSchema)
});
const AmountSchema = Nullable(Type.Union([Type.String(), Type.Number()]));
const BodySchema$2 = Type.Object({
	rate_limit: Nullable(RateLimitSchema),
	additional_rate_limits: Nullable(Type.Array(Type.Unknown())),
	spend_control: Nullable(Type.Object({ individual_limit: Nullable(Type.Object({
		limit: AmountSchema,
		used: AmountSchema
	})) }))
});
const codexProvider = {
	method: "GET",
	url: USAGE_URL$1,
	header: {
		"Authorization": "Bearer $TOKEN$",
		"Content-Type": "application/json"
	},
	apply: (report, data) => {
		report.windows = parseWindows$2(data);
	},
	owners: ["openai"],
	remaining: (report) => minRemaining(report.windows.filter((window) => window.key === void 0))
};
function parseWindows$2(data) {
	const body = asValue(BodySchema$2, data);
	if (body === void 0) return [];
	const windows = rateWindows(body.rate_limit);
	for (const rawLimit of body.additional_rate_limits ?? []) {
		const entry = asValue(AdditionalLimitSchema, rawLimit);
		if (!`${entry?.limit_name} ${entry?.metered_feature}`.toLowerCase().includes("spark")) continue;
		windows.push(...rateWindows(entry?.rate_limit).map((window) => ({
			...window,
			key: "spark",
			label: `Spark ${window.label}`
		})));
	}
	const individual = body.spend_control?.individual_limit;
	const creditsUsed = percentOf(amount(individual?.used) ?? 0, amount(individual?.limit));
	if (creditsUsed !== void 0) windows.push({
		key: "credits",
		label: "Credits",
		remainingPercent: clamp(100 - creditsUsed, 0, 100)
	});
	return windows;
}
function amount(value) {
	if (value == null) return void 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : void 0;
}
function rateWindows(rateLimit) {
	const windows = [];
	for (const raw of [rateLimit?.primary_window, rateLimit?.secondary_window]) {
		if (raw == null) continue;
		const used = raw.used_percent;
		const resetsAt = windowReset(raw);
		windows.push({
			label: raw.limit_window_seconds === WEEKLY_WINDOW_SECONDS ? "7d Quota" : "5h Quota",
			...used == null ? {} : { remainingPercent: clamp(100 - used, 0, 100) },
			...resetsAt === void 0 ? {} : { resetsAt }
		});
	}
	return windows;
}
function windowReset(window) {
	const absolute = parseReset(window.reset_at);
	if (absolute !== void 0) return absolute;
	const after = window.reset_after_seconds;
	return after == null ? void 0 : Date.now() + after * 1e3;
}
//#endregion
//#region src/core/quota/providers/grok.ts
const BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const MetricSchema = Type.Object({ val: Type.Optional(Type.Number()) });
const BodySchema$1 = Type.Object({ config: Type.Optional(Type.Object({
	creditUsagePercent: Type.Optional(Type.Number()),
	currentPeriod: Type.Optional(Type.Object({ end: Type.Optional(Type.Union([Type.String(), Type.Number()])) })),
	productUsage: Type.Optional(Type.Array(Type.Object({ usagePercent: Type.Optional(Type.Number()) }))),
	onDemandCap: Type.Optional(MetricSchema),
	onDemandUsed: Type.Optional(MetricSchema)
})) });
const grokProvider = {
	method: "GET",
	url: BILLING_URL,
	header: {
		Authorization: "Bearer $TOKEN$",
		Accept: "application/json"
	},
	apply: (report, data) => {
		report.windows = parseWindows$1(data);
	},
	owners: ["xai"],
	remaining: (report) => report.windows[0]?.remainingPercent
};
function parseWindows$1(data) {
	const config = asValue(BodySchema$1, data)?.config;
	const productUsage = config?.productUsage?.reduce((sum, product) => product.usagePercent === void 0 ? sum : (sum ?? 0) + product.usagePercent, void 0);
	const percentUsed = config?.creditUsagePercent ?? productUsage;
	if (percentUsed === void 0) return [];
	const resetsAt = parseReset(config?.currentPeriod?.end);
	const onDemandUsed = percentOf(config?.onDemandUsed?.val, config?.onDemandCap?.val);
	return [window("Credits", percentUsed, resetsAt), ...onDemandUsed === void 0 ? [] : [window("On-Demand", onDemandUsed, resetsAt)]];
}
function window(label, usedPercent, resetsAt) {
	return {
		label,
		remainingPercent: clamp(100 - usedPercent, 0, 100),
		...resetsAt === void 0 ? {} : { resetsAt }
	};
}
//#endregion
//#region src/core/quota/providers/kimi.ts
const USAGE_URL = "https://api.kimi.com/coding/v1/usages";
const MINUTES_PER_UNIT = [
	["SECOND", 1 / 60],
	["HOUR", 60],
	["DAY", 1440]
];
const CountSchema = Type.Optional(Type.Union([Type.String(), Type.Number()]));
const UsageSchema = Type.Object({
	limit: CountSchema,
	used: CountSchema,
	remaining: CountSchema,
	resetTime: Type.Optional(Type.String())
});
const LimitSchema = Type.Object({
	window: Type.Optional(Type.Object({
		duration: Type.Optional(Type.Number()),
		timeUnit: Type.Optional(Type.String())
	})),
	detail: Type.Optional(UsageSchema)
});
const BodySchema = Type.Object({
	usage: Type.Optional(UsageSchema),
	limits: Type.Optional(Type.Array(Type.Unknown())),
	totalQuota: Type.Optional(UsageSchema)
});
const kimiProvider = {
	method: "GET",
	url: USAGE_URL,
	header: {
		Authorization: "Bearer $TOKEN$",
		Accept: "application/json"
	},
	apply: (report, data) => {
		report.windows = parseWindows(data);
	},
	owners: ["moonshot"],
	remaining: (report) => minRemaining(report.windows)
};
function parseWindows(data) {
	const body = asValue(BodySchema, data);
	if (body === void 0) return [];
	const limits = (body.limits ?? []).map((rawLimit) => asValue(LimitSchema, rawLimit));
	return [
		usageWindow("Weekly Quota", body.usage),
		...limits.map((limit) => usageWindow(windowLabel(limit?.window), limit?.detail)),
		usageWindow("Total", body.totalQuota)
	].filter((window) => window !== void 0);
}
function usageWindow(label, usage) {
	const limit = count(usage?.limit);
	const remaining = count(usage?.remaining);
	const percentUsed = percentOf(count(usage?.used) ?? (limit === void 0 || remaining === void 0 ? void 0 : limit - remaining), limit);
	if (percentUsed === void 0) return void 0;
	const resetsAt = parseReset(usage?.resetTime);
	return {
		label,
		remainingPercent: clamp(100 - percentUsed, 0, 100),
		...resetsAt === void 0 ? {} : { resetsAt }
	};
}
function count(value) {
	if (value === void 0) return void 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : void 0;
}
function windowLabel(window) {
	const duration = window?.duration;
	if (duration === void 0 || duration <= 0) return "Quota";
	const unit = window?.timeUnit?.toUpperCase() ?? "";
	const minutes = duration * (MINUTES_PER_UNIT.find(([name]) => unit.includes(name))?.[1] ?? 1);
	if (minutes % 1440 === 0) return `${minutes / 1440}d Quota`;
	return minutes % 60 === 0 ? `${minutes / 60}h Quota` : `${Math.round(minutes)}m Quota`;
}
//#endregion
//#region src/core/quota/providers/index.ts
const QUOTA_PROVIDERS = {
	codex: codexProvider,
	antigravity: antigravityProvider,
	claude: claudeProvider,
	grok: grokProvider,
	kimi: kimiProvider
};
function isQuotaProvider(value) {
	return Object.hasOwn(QUOTA_PROVIDERS, value);
}
//#endregion
//#region src/core/shared/errors.ts
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region src/core/quota/quota.ts
const ObjectSchema = Type.Object({}, { additionalProperties: true });
async function fetchQuotas(client, signal, backoff = /* @__PURE__ */ new Map(), providerFilter) {
	const tasks = (await client.listAuthFilesRaw(signal)).flatMap((entry) => {
		const raw = (entry.provider ?? entry.type ?? "").trim().toLowerCase();
		const provider = raw === "xai" ? "grok" : raw;
		if (!isQuotaProvider(provider) || providerFilter !== void 0 && provider !== providerFilter) return [];
		if ((backoff.get(entry.auth_index?.trim() ?? "") ?? 0) > Date.now()) {
			const account = accountOf(entry);
			return [Promise.resolve({
				provider,
				windows: [],
				...account === void 0 ? {} : { account }
			})];
		}
		return [fetchProviderQuota(provider, QUOTA_PROVIDERS[provider], client, entry, signal, backoff)];
	});
	return Promise.all(tasks);
}
async function fetchProviderQuota(provider, source, client, entry, signal, backoff) {
	const account = accountOf(entry);
	const report = {
		provider,
		windows: [],
		...account === void 0 ? {} : { account }
	};
	const authIndex = entry.auth_index?.trim() ?? "";
	if (authIndex === "") return {
		...report,
		error: "missing auth_index"
	};
	const requestBody = source.body?.(entry);
	if (requestBody !== void 0 && "error" in requestBody) return {
		...report,
		error: requestBody.error
	};
	try {
		const { statusCode, header, body } = await client.apiCall({
			auth_index: authIndex,
			method: source.method,
			url: source.url,
			header: source.header,
			...requestBody
		}, signal);
		const retryAfter = parseRetryAfter(header, statusCode);
		if (retryAfter === void 0) backoff.delete(authIndex);
		else backoff.set(authIndex, retryAfter);
		if (statusCode < 200 || statusCode >= 300) return {
			...report,
			error: `HTTP ${statusCode} from ${source.url} — ${describeBody(body)}`
		};
		const data = asJsonValue(ObjectSchema, body);
		if (data === void 0) return {
			...report,
			error: `invalid quota payload from ${source.url} — ${describeBody(body)}`
		};
		source.apply(report, data);
		return report;
	} catch (error) {
		return {
			...report,
			error: errorMessage(error)
		};
	}
}
function accountOf(entry) {
	const authIndex = entry.auth_index?.trim() ?? "";
	if (authIndex === "") return void 0;
	return {
		authIndex,
		label: (entry.label || entry.email || entry.name || authIndex).trim()
	};
}
function parseRetryAfter(header, statusCode) {
	if (statusCode !== 429) return void 0;
	const raw = header["retry-after"]?.[0] ?? header["Retry-After"]?.[0];
	if (raw === void 0) return Date.now() + 3e5;
	const seconds = Number(raw);
	return Number.isFinite(seconds) ? Date.now() + seconds * 1e3 : parseReset(raw) ?? Date.now() + 3e5;
}
function describeBody(body) {
	if (typeof body === "string") return body.slice(0, 200);
	try {
		return JSON.stringify(body).slice(0, 200);
	} catch {
		return String(body).slice(0, 200);
	}
}
//#endregion
//#region src/index.ts
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
let UniversalProviderService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _ping_decorators;
	let _getState_decorators;
	let _listAccounts_decorators;
	let _startOAuth_decorators;
	let _pollOAuth_decorators;
	let _cancelOAuth_decorators;
	let _deleteAccount_decorators;
	let _listEndpoints_decorators;
	let _saveEndpoint_decorators;
	let _getQuotas_decorators;
	let _getRecentLogs_decorators;
	let _generateCommitDraft_decorators;
	let _configureTitles_decorators;
	let _configureCompaction_decorators;
	return class UniversalProviderService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_ping_decorators = [Remote];
			_getState_decorators = [Remote];
			_listAccounts_decorators = [Remote];
			_startOAuth_decorators = [Remote];
			_pollOAuth_decorators = [Remote];
			_cancelOAuth_decorators = [Remote];
			_deleteAccount_decorators = [Remote];
			_listEndpoints_decorators = [Remote];
			_saveEndpoint_decorators = [Remote];
			_getQuotas_decorators = [Remote];
			_getRecentLogs_decorators = [Remote];
			_generateCommitDraft_decorators = [Remote];
			_configureTitles_decorators = [Remote];
			_configureCompaction_decorators = [Remote];
			__esDecorate(this, null, _ping_decorators, {
				kind: "method",
				name: "ping",
				static: false,
				private: false,
				access: {
					has: (obj) => "ping" in obj,
					get: (obj) => obj.ping
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getState_decorators, {
				kind: "method",
				name: "getState",
				static: false,
				private: false,
				access: {
					has: (obj) => "getState" in obj,
					get: (obj) => obj.getState
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listAccounts_decorators, {
				kind: "method",
				name: "listAccounts",
				static: false,
				private: false,
				access: {
					has: (obj) => "listAccounts" in obj,
					get: (obj) => obj.listAccounts
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _startOAuth_decorators, {
				kind: "method",
				name: "startOAuth",
				static: false,
				private: false,
				access: {
					has: (obj) => "startOAuth" in obj,
					get: (obj) => obj.startOAuth
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _pollOAuth_decorators, {
				kind: "method",
				name: "pollOAuth",
				static: false,
				private: false,
				access: {
					has: (obj) => "pollOAuth" in obj,
					get: (obj) => obj.pollOAuth
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _cancelOAuth_decorators, {
				kind: "method",
				name: "cancelOAuth",
				static: false,
				private: false,
				access: {
					has: (obj) => "cancelOAuth" in obj,
					get: (obj) => obj.cancelOAuth
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteAccount_decorators, {
				kind: "method",
				name: "deleteAccount",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteAccount" in obj,
					get: (obj) => obj.deleteAccount
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listEndpoints_decorators, {
				kind: "method",
				name: "listEndpoints",
				static: false,
				private: false,
				access: {
					has: (obj) => "listEndpoints" in obj,
					get: (obj) => obj.listEndpoints
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _saveEndpoint_decorators, {
				kind: "method",
				name: "saveEndpoint",
				static: false,
				private: false,
				access: {
					has: (obj) => "saveEndpoint" in obj,
					get: (obj) => obj.saveEndpoint
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getQuotas_decorators, {
				kind: "method",
				name: "getQuotas",
				static: false,
				private: false,
				access: {
					has: (obj) => "getQuotas" in obj,
					get: (obj) => obj.getQuotas
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _getRecentLogs_decorators, {
				kind: "method",
				name: "getRecentLogs",
				static: false,
				private: false,
				access: {
					has: (obj) => "getRecentLogs" in obj,
					get: (obj) => obj.getRecentLogs
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _generateCommitDraft_decorators, {
				kind: "method",
				name: "generateCommitDraft",
				static: false,
				private: false,
				access: {
					has: (obj) => "generateCommitDraft" in obj,
					get: (obj) => obj.generateCommitDraft
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _configureTitles_decorators, {
				kind: "method",
				name: "configureTitles",
				static: false,
				private: false,
				access: {
					has: (obj) => "configureTitles" in obj,
					get: (obj) => obj.configureTitles
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _configureCompaction_decorators, {
				kind: "method",
				name: "configureCompaction",
				static: false,
				private: false,
				access: {
					has: (obj) => "configureCompaction" in obj,
					get: (obj) => obj.configureCompaction
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		supervisor = __runInitializers(this, _instanceExtraInitializers);
		paths;
		config;
		constructor(ctx, supervisor, paths, config) {
			super(ctx, "universalProvider");
			this.supervisor = supervisor;
			this.paths = paths;
			this.config = config;
		}
		async ping(signal) {
			signal?.throwIfAborted();
			return {
				message: "pong",
				timestamp: Date.now()
			};
		}
		async getState(signal) {
			signal?.throwIfAborted();
			try {
				const running = await this.supervisor.ensureRunning(signal);
				return {
					status: "ready",
					version: running.version || "unknown",
					mode: running.mode,
					port: running.port,
					activeRequests: this.supervisor.getActiveRequests(),
					baseUrl: running.baseUrl
				};
			} catch {
				return {
					status: "error",
					version: "unknown",
					mode: this.config.serverMode,
					activeRequests: this.supervisor.getActiveRequests(),
					baseUrl: this.config.serverMode === "external" ? this.config.externalUrl : ""
				};
			}
		}
		async listAccounts(signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			return (await mgmt.listAuthFilesRaw(signal)).map((file) => ({
				name: file.name || file.auth_index || "unknown",
				type: file.type,
				provider: file.provider,
				email: file.email,
				label: file.label
			}));
		}
		async startOAuth(provider, signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			return await mgmt.requestAuthUrl(provider, signal);
		}
		async pollOAuth(state, signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			return await mgmt.getAuthStatus(state, signal);
		}
		async cancelOAuth(state, signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			await mgmt.cancelAuthSession(state, signal);
			return true;
		}
		async deleteAccount(name, signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			await mgmt.deleteAuthFile(name, signal);
			return true;
		}
		async listEndpoints(signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			return (await mgmt.listOpenAICompatibility(signal)).map((p) => ({
				name: p.name,
				baseUrl: p["base-url"],
				models: p.models?.map((m) => ({
					name: m.name,
					alias: m.alias
				}))
			}));
		}
		async saveEndpoint(endpoint, signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			const current = await mgmt.listOpenAICompatibility(signal);
			const existingIndex = current.findIndex((p) => p.name === endpoint.name);
			const updatedProvider = {
				name: endpoint.name,
				"base-url": endpoint.baseUrl,
				...endpoint.apiKey ? { keys: [{ "api-key": endpoint.apiKey }] } : {},
				...endpoint.models ? { models: endpoint.models.map((m) => ({
					name: m.name,
					alias: m.alias
				})) } : {}
			};
			if (existingIndex >= 0) current[existingIndex] = updatedProvider;
			else current.push(updatedProvider);
			await mgmt.putOpenAICompatibility(current, signal);
			return true;
		}
		async getQuotas(signal) {
			signal?.throwIfAborted();
			await this.supervisor.ensureRunning(signal);
			const mgmt = this.supervisor.getManagementClient();
			if (!mgmt) throw new Error("Management client unavailable");
			return (await fetchQuotas(mgmt, signal)).map((r) => ({
				provider: r.provider,
				windows: r.windows.map((w) => ({
					label: w.label,
					remainingPercent: w.remainingPercent,
					balance: w.balance,
					resetsAt: w.resetsAt
				})),
				account: r.account,
				error: r.error
			}));
		}
		async getRecentLogs(signal) {
			signal?.throwIfAborted();
			if (!existsSync(this.paths.logPath)) return ["No log file generated yet."];
			try {
				return (await readFile(this.paths.logPath, "utf8")).split("\n").filter(Boolean).slice(-100).map((line) => line.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]").replace(/sk-[A-Za-z0-9_-]+/gi, "sk-[REDACTED]").replace(/secret-key:\s*["']?[^"'\n]+["']?/gi, "secret-key: \"[REDACTED]\""));
			} catch {
				return ["Could not read server log."];
			}
		}
		async generateCommitDraft(options, signal) {
			signal?.throwIfAborted();
			return await generateCommitDraft(this.ctx, options.cwd, options.model, signal);
		}
		async configureTitles(model, signal) {
			signal?.throwIfAborted();
			await configureAuxiliaryTitles(this.ctx, model);
			return true;
		}
		async configureCompaction(model, signal) {
			signal?.throwIfAborted();
			await configureAuxiliaryCompaction(this.ctx, model);
			return true;
		}
	};
})();
const inject = ["llm"];
function apply(ctx, config) {
	const paths = resolveProviderPaths(ctx.fiber?.entry?.options?.id ?? ctx.get?.("profileContext")?.name ?? "default");
	const supervisor = new ServerSupervisor(ctx, paths, config);
	new UniversalProviderService(ctx, supervisor, paths, config);
	const llm = ctx.llm;
	if (llm) {
		const adapter = new UniversalLlmAdapter(supervisor);
		llm.registerAdapter(["universal-chat-provider"], adapter);
		llm.registerConfigurableProviders([{
			provider: "universal-chat-provider",
			displayName: "Universal Provider",
			settingsNs: ctx.fiber?.entry?.options?.id ?? "universal-provider",
			settingsPath: []
		}]);
	}
	ctx.effect(() => () => {
		supervisor.dispose();
	});
}
//#endregion
export { Config, UniversalProviderService, apply, inject };

//# sourceMappingURL=index.js.map