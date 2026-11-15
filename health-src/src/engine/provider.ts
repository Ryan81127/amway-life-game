import type { AnalysisResult, Consult } from '../types';
import { analyzeRules, RULE_ENGINE } from './ruleEngine';

/**
 * 可替換的分析服務介面。
 * 第一階段只有本機「規則式衛教分析」；第二階段的 AI 模型服務實作同一介面即可接入。
 */
export interface AnalysisProvider {
  id: string;
  name: string;
  kind: 'rule' | 'ai';
  /** 是否會把個案資料送出本機（需個案同意第三方 AI） */
  sendsDataOffDevice: boolean;
  available: boolean;
  unavailableReason?: string;
  analyze(consult: Consult): Promise<AnalysisResult>;
}

export const ruleProvider: AnalysisProvider = {
  id: RULE_ENGINE.id,
  name: RULE_ENGINE.name,
  kind: 'rule',
  sendsDataOffDevice: false,
  available: true,
  analyze: async (c) => analyzeRules(c),
};

/**
 * 第二階段預留：AI 分析 API。
 * 目前「沒有」接上任何 AI 模型，呼叫一律拋出錯誤，介面上也標示為尚未完成。
 * 實作時必須：(1) 檢查 consult.consent.thirdPartyAI；(2) 只送去識別化資料；
 * (3) 回傳結果仍須經健康管理師審核；(4) 於 audit 紀錄模型名稱與版本。
 */
export const remoteAIProvider: AnalysisProvider = {
  id: 'remote-ai',
  name: 'AI 模型分析（第二階段）',
  kind: 'ai',
  sendsDataOffDevice: true,
  available: false,
  unavailableReason: '尚未完成：第二階段才會接上後端 AI 分析 API。',
  analyze: async (c) => {
    if (!c.consent.thirdPartyAI) throw new Error('個案未同意將資料送往第三方 AI 服務。');
    throw new Error('AI 分析 API 尚未實作（第二階段）。');
  },
};

export const PROVIDERS: AnalysisProvider[] = [ruleProvider, remoteAIProvider];
