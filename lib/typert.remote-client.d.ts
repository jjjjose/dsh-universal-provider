/* Generated Typert Remote client declaration for universal-provider */
import type { ModelView, PingResult, ProviderStatus, AccountView, OAuthStartResult, OAuthPollResult, EndpointView, QuotaReportView, CommitDraftResult } from './types.js'

export declare const TYPERT_REMOTE: unknown;
export default TYPERT_REMOTE;

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    universalProvider: UniversalProviderRemote;
  }
}

export interface UniversalProviderRemote {
  listModels(signal?: AbortSignal): Promise<readonly ModelView[]>;
  ping(signal?: AbortSignal): Promise<PingResult>;
  getState(signal?: AbortSignal): Promise<ProviderStatus>;
  listAccounts(signal?: AbortSignal): Promise<AccountView[]>;
  startOAuth(provider: string, signal?: AbortSignal): Promise<OAuthStartResult>;
  pollOAuth(state: string, signal?: AbortSignal): Promise<OAuthPollResult>;
  cancelOAuth(state: string, signal?: AbortSignal): Promise<boolean>;
  deleteAccount(name: string, signal?: AbortSignal): Promise<boolean>;
  listEndpoints(signal?: AbortSignal): Promise<EndpointView[]>;
  saveEndpoint(endpoint: EndpointView, signal?: AbortSignal): Promise<boolean>;
  getQuotas(signal?: AbortSignal): Promise<QuotaReportView[]>;
  getRecentLogs(signal?: AbortSignal): Promise<string[]>;
  generateCommitDraft(options: { cwd: string; model?: string }, signal?: AbortSignal): Promise<CommitDraftResult>;
  configureTitles(model: string, signal?: AbortSignal): Promise<boolean>;
  configureCompaction(model: string, signal?: AbortSignal): Promise<boolean>;
}
