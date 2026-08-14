export interface BugReportSummary {
  id: number;
  area: string;
  summary: string;
  steps: string;
  expected: string;
  actual: string;
  page_url: string;
  status: string;
  created_at: number;
}

export interface BugReportDetail extends BugReportSummary {}

export interface BugReportEmailResult {
  sent: boolean;
  message: string;
}
