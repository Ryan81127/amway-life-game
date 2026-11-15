/** 證據強度：A 臨床指引／共識；B 觀察性或實驗性研究；C 生理機轉推論或專家意見 */
export type Evidence = 'A' | 'B' | 'C';
export type Tri = 'yes' | 'no' | 'unknown';

export interface SymptomDetail {
  onset?: string;
  duration?: string;
  frequency?: string;
  severity?: number;
  followups: Record<string, Tri>;
}

export interface Consent {
  education: boolean; // 了解本平台為衛教用途、非診斷
  localStorage: boolean; // 同意資料存於本機瀏覽器
  thirdPartyAI: boolean; // 同意送往第三方 AI（第一階段不會使用）
  at?: string;
}

export interface Review {
  excluded: string[]; // 健康管理師排除、不納入報告的分析項目 id
  note: string;
  reviewer: string;
  checks: boolean[];
  approvedAt?: string;
  approvedHash?: string;
}

export interface AuditEntry {
  at: string;
  action: string;
}

export interface Consult {
  id: string;
  caseCode: string;
  date: string;
  managerName: string;
  consent: Consent;
  ageRange: string;
  sex: string;
  symptoms: Record<string, SymptomDetail>;
  lifestyle: string[];
  lifestyleNote: string;
  redFlags: Record<string, Tri>;
  historyTags: string[];
  history: string;
  medications: string;
  review: Review;
  audit: AuditEntry[];
  updatedAt: string;
}

export interface AnalysisItem {
  id: string;
  title: string;
  text: string;
  evidence?: Evidence;
  refs?: string[];
  tags?: string[];
}

export interface AnalysisResult {
  engine: { id: string; name: string; version: string; kind: 'rule' | 'ai' };
  generatedAt: string;
  empty: boolean;
  emergency: AnalysisItem[];
  summary: string[];
  organs: { organId: string; reasons: string[] }[];
  systems: string[];
  mechanisms: AnalysisItem[];
  questions: AnalysisItem[];
  medical: AnalysisItem[];
  lifestyle: AnalysisItem[];
  nutrition: AnalysisItem[];
  followup: AnalysisItem[];
  uncertainty: string[];
  refs: string[];
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  A: 'A｜臨床指引／專家共識',
  B: 'B｜觀察性或實驗研究',
  C: 'C｜生理機轉推論',
};
