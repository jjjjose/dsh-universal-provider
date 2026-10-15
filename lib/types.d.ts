//#region src/types.d.ts
interface PingResult {
  readonly message: string;
  readonly timestamp: number;
}
interface ProviderStatus {
  readonly status: string;
  readonly version: string;
  readonly mode: 'managed' | 'external';
  readonly port?: number;
  readonly activeRequests: number;
  readonly baseUrl: string;
}
interface AccountView {
  readonly name: string;
  readonly type?: string;
  readonly provider?: string;
  readonly email?: string;
  readonly label?: string;
}
interface OAuthStartResult {
  readonly url: string;
  readonly state: string;
  readonly userCode?: string;
}
interface OAuthPollResult {
  readonly status: 'wait' | 'ok' | 'error';
  readonly error?: string;
}
interface EndpointModelView {
  readonly name: string;
  readonly alias?: string;
}
interface EndpointView {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly models?: readonly EndpointModelView[];
}
interface QuotaWindowView {
  readonly label: string;
  readonly remainingPercent?: number;
  readonly balance?: {
    amount: number;
    currency: string;
    suffix: 'left' | 'used';
  };
  readonly resetsAt?: number;
}
interface QuotaReportView {
  readonly provider: string;
  readonly windows: readonly QuotaWindowView[];
  readonly account?: {
    authIndex: string;
    label: string;
  };
  readonly error?: string;
}
interface CommitDraftResult {
  readonly hasStagedChanges: boolean;
  readonly message?: string;
  readonly draft?: string;
}
//#endregion
export { AccountView, CommitDraftResult, EndpointModelView, EndpointView, OAuthPollResult, OAuthStartResult, PingResult, ProviderStatus, QuotaReportView, QuotaWindowView };
//# sourceMappingURL=types.d.ts.map