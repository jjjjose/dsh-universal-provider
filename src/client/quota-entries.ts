import type { QuotaReportView, QuotaWindowView } from '../types.ts'

export function quotaEntries(report: QuotaReportView): QuotaWindowView[] {
  return [
    ...report.windows,
    ...Object.entries(report.models ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, quota]) => ({ label, ...quota })),
  ]
}
