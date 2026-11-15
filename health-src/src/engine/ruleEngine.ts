import type { AnalysisItem, AnalysisResult, Consult } from '../types';
import { SYMPTOM_MAP } from '../data/symptoms';
import { LIFESTYLE, MECHANISMS, RED_FLAGS } from '../data/knowledge';
import { NUTRIENT_MAP } from '../data/nutrients';
import { ORGAN_MAP } from '../data/organs';

export const RULE_ENGINE = { id: 'rule-v1', name: '規則式衛教分析（非 AI）', version: '1.0.0', kind: 'rule' as const };

const MECH_MAP = Object.fromEntries(MECHANISMS.map((m) => [m.id, m]));
const LIFE_MAP = Object.fromEntries(LIFESTYLE.map((l) => [l.id, l]));

/**
 * 規則式分析：把問卷勾選結果對應到知識庫條目。
 * 這是固定規則的查表與彙整，不是機器學習或語言模型，也不會做出診斷。
 */
export function analyzeRules(c: Consult): AnalysisResult {
  const ids = Object.keys(c.symptoms).filter((id) => SYMPTOM_MAP[id]);
  const refs = new Set<string>();
  const addRefs = (r?: string[]) => r?.forEach((x) => refs.add(x));

  /* 1. 緊急與儘速就醫提醒（最優先） */
  const emergency: AnalysisItem[] = [];
  const medical: AnalysisItem[] = [];
  for (const rf of RED_FLAGS) {
    if (c.redFlags[rf.id] !== 'yes') continue;
    const item: AnalysisItem = { id: rf.id, title: rf.q.replace(/？$/, ''), text: rf.action, refs: rf.refs };
    (rf.level === 'emergency' ? emergency : medical).push({ ...item, tags: [rf.level === 'emergency' ? '緊急' : '儘速就醫'] });
    addRefs(rf.refs);
  }
  for (const id of ids) {
    const sym = SYMPTOM_MAP[id];
    for (const f of sym.followups ?? []) {
      if (c.symptoms[id].followups?.[f.id] !== 'yes' || !f.ifYes) continue;
      const item: AnalysisItem = { id: `fu_${id}_${f.id}`, title: `${sym.label}：${f.q.replace(/？$/, '')}`, text: f.ifYes.text };
      if (f.ifYes.level === 'emergency') emergency.push({ ...item, tags: ['緊急'] });
      else medical.push({ ...item, tags: ['儘速就醫'] });
    }
  }

  /* 2. 症狀摘要 */
  const summary = ids.map((id) => {
    const sym = SYMPTOM_MAP[id];
    const d = c.symptoms[id];
    const bits = [d.onset && `開始：${d.onset}`, d.duration && `每次持續：${d.duration}`, d.frequency && `頻率：${d.frequency}`, d.severity && `困擾程度 ${d.severity}/10`].filter(Boolean);
    return `${sym.category}－${sym.label}${bits.length ? `（${bits.join('；')}）` : ''}`;
  });

  /* 3. 相關器官與系統 */
  const organReasons = new Map<string, string[]>();
  for (const id of ids) for (const o of SYMPTOM_MAP[id].organs) {
    if (!organReasons.has(o)) organReasons.set(o, []);
    organReasons.get(o)!.push(SYMPTOM_MAP[id].label);
  }
  for (const rf of RED_FLAGS) if (c.redFlags[rf.id] === 'yes') for (const o of rf.organs) {
    if (!organReasons.has(o)) organReasons.set(o, []);
    organReasons.get(o)!.push('就醫警訊');
  }
  const organs = [...organReasons.entries()]
    .map(([organId, reasons]) => ({ organId, reasons: [...new Set(reasons)] }))
    .sort((a, b) => b.reasons.length - a.reasons.length);
  const systems = [...new Set(organs.map((o) => ORGAN_MAP[o.organId]?.system).filter(Boolean))] as string[];

  /* 4. 可能的生理機制與生活因素 */
  const mechSyms = new Map<string, string[]>();
  for (const id of ids) for (const m of SYMPTOM_MAP[id].mech) {
    if (!mechSyms.has(m)) mechSyms.set(m, []);
    mechSyms.get(m)!.push(SYMPTOM_MAP[id].label);
  }
  const mechanisms: AnalysisItem[] = [...mechSyms.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([mid, syms]) => {
      const m = MECH_MAP[mid];
      const reported = m.lifestyle.filter((l) => c.lifestyle.includes(l)).map((l) => LIFE_MAP[l].label);
      addRefs(m.refs);
      return {
        id: `mech_${mid}`, title: m.title, evidence: m.evidence, refs: m.refs,
        text: m.text + (reported.length ? ` 個案回報的相關生活因素：${reported.join('、')}。` : ''),
        tags: [`相關症狀：${syms.join('、')}`],
      };
    });

  /* 5. 需要進一步確認的問題 */
  const questions: AnalysisItem[] = [];
  for (const id of ids) {
    const sym = SYMPTOM_MAP[id];
    const d = c.symptoms[id];
    const missing = [!d.onset && '起始時間', !d.frequency && '發生頻率', !d.severity && '困擾程度'].filter(Boolean);
    const skipped = (sym.followups ?? []).filter((f) => !d.followups?.[f.id] || d.followups[f.id] === 'unknown').map((f) => f.q);
    const all = [...sym.ask, ...skipped, ...(missing.length ? [`問卷尚未填寫：${missing.join('、')}`] : [])];
    questions.push({ id: `q_${id}`, title: sym.label, text: all.join(' ／ ') });
  }
  const unknownFlags = RED_FLAGS.filter((rf) => !c.redFlags[rf.id] || c.redFlags[rf.id] === 'unknown');
  if (ids.length && unknownFlags.length) {
    questions.push({ id: 'q_redflags', title: '尚未確認的就醫警訊', text: unknownFlags.map((r) => r.q).join(' ／ '), tags: ['請優先確認'] });
  }
  if (ids.length && !c.medications.trim()) questions.push({ id: 'q_meds', title: '用藥與補充品', text: '尚未記錄目前使用的處方藥、成藥與保健食品。部分症狀可能與藥物有關，營養建議也需考量交互作用。' });

  /* 6. 建議醫療評估的情況 */
  for (const id of ids) {
    const sym = SYMPTOM_MAP[id];
    const sev = c.symptoms[id].severity ?? 0;
    medical.push({ id: `med_${id}`, title: sym.label, text: sym.medical + (sev >= 7 ? ' 個案自述困擾程度高（≥7/10），建議主動安排就醫。' : ''), tags: sev >= 7 ? ['困擾程度高'] : undefined });
  }
  const chronic = c.historyTags.filter((t) => ['高血壓', '糖尿病', '高血脂', '心臟病', '腦中風', '腎臟病'].includes(t));
  if (chronic.length && ids.length) {
    medical.push({ id: 'med_chronic', title: '既有慢性病', text: `個案有${chronic.join('、')}病史，上述症狀建議於回診時主動告知主治醫師，生活與飲食調整也應與醫療團隊討論。` });
  }

  /* 7. 生活型態改善方向 */
  const lifestyle: AnalysisItem[] = c.lifestyle.filter((l) => LIFE_MAP[l]).map((l) => {
    const f = LIFE_MAP[l];
    addRefs(f.advice.refs);
    return { id: `life_${l}`, title: f.advice.title, text: f.advice.text, evidence: f.advice.evidence, refs: f.advice.refs, tags: [`對應：${f.label}`] };
  });
  // 機制提到、但個案未勾選的生活因素：列為可再確認的方向，不假設個案有此習慣
  const suggested = new Set<string>();
  for (const [mid] of mechSyms) MECH_MAP[mid].lifestyle.forEach((l) => !c.lifestyle.includes(l) && suggested.add(l));
  if (suggested.size) {
    lifestyle.push({ id: 'life_check', title: '可再確認的生活因素', text: `文獻中與上述機制相關、但問卷未勾選的因素：${[...suggested].map((l) => LIFE_MAP[l].label).join('、')}。請與個案確認是否適用，不宜假設。` });
  }

  /* 8. 營養衛教與食物來源 */
  const nutSyms = new Map<string, string[]>();
  for (const id of ids) for (const n of SYMPTOM_MAP[id].nutrients) {
    if (!nutSyms.has(n)) nutSyms.set(n, []);
    nutSyms.get(n)!.push(SYMPTOM_MAP[id].label);
  }
  const nutrition: AnalysisItem[] = [...nutSyms.entries()].map(([nid, syms]) => {
    const n = NUTRIENT_MAP[nid];
    addRefs(n.refs);
    return {
      id: `nut_${nid}`, title: n.name, evidence: 'C' as const, refs: n.refs,
      text: `${n.fn} 食物來源：${n.foods} 注意事項：${n.caution}`,
      tags: [`相關生理功能：${syms.join('、')}`],
    };
  });

  /* 9. 後續追蹤 */
  const followup: AnalysisItem[] = [];
  if (ids.length) {
    followup.push({ id: 'fu_diary', title: '記錄症狀日誌', text: '請個案記錄 2–4 週的症狀出現時間、頻率與可能誘因（睡眠、飲食、壓力、活動），下次諮詢時比對變化。' });
    followup.push({ id: 'fu_revisit', title: '安排追蹤諮詢', text: emergency.length || medical.some((m) => m.tags?.includes('儘速就醫')) ? '請先完成就醫評估，再安排後續生活管理追蹤。' : '建議 2–4 週後追蹤生活調整的執行情況；若症狀加重或出現新的警訊，請提前就醫。' });
    if (ids.some((id) => SYMPTOM_MAP[id].mech.includes('glucose')) || chronic.length) {
      followup.push({ id: 'fu_checkup', title: '健康檢查資料', text: '下次諮詢可請個案攜帶近期健康檢查報告（血壓、血糖、血脂等）。40 歲以上可利用國健署成人預防保健服務。' });
    }
  }

  const uncertainty = [
    '本分析由固定規則比對知識庫條目產生，不是 AI 模型，也不是醫療診斷。',
    '相同症狀可能有多種原因；列出的器官、機制與生活因素僅代表「文獻中可能相關」，不代表個案的器官已受損或確實由該因素造成。',
    '列出的營養素是與相關生理功能有關的衛教資訊，不代表個案缺乏該營養素；是否缺乏需由醫療檢驗確認。',
    '問卷為個案自述，未填寫或回答「不清楚」的項目會降低分析的完整性。',
    '知識庫內容為草稿版本，尚未經醫療專業人員審查。',
  ];

  return {
    engine: RULE_ENGINE, generatedAt: new Date().toISOString(), empty: ids.length === 0 && emergency.length === 0 && medical.length === 0,
    emergency, summary, organs, systems, mechanisms, questions, medical, lifestyle, nutrition, followup, uncertainty, refs: [...refs],
  };
}

/** 用於偵測審核後內容是否被修改 */
export function consultHash(c: Consult): string {
  const s = JSON.stringify([c.caseCode, c.date, c.symptoms, [...c.lifestyle].sort(), c.lifestyleNote, c.redFlags, c.historyTags, c.history, c.medications, c.review.excluded, c.review.note, c.ageRange, c.sex]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
