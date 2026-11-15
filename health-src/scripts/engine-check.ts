/** 規則引擎與知識庫的一致性檢查：npm test */
import assert from 'node:assert/strict';
import { CATEGORIES } from '../src/data/symptoms';
import { LIFESTYLE, MECHANISMS, RED_FLAGS } from '../src/data/knowledge';
import { NUTRIENT_MAP, NUTRIENTS } from '../src/data/nutrients';
import { ORGAN_MAP } from '../src/data/organs';
import { REF_MAP } from '../src/data/references';
import { TOPICS } from '../src/data/topics';
import { analyzeRules, consultHash } from '../src/engine/ruleEngine';
import { remoteAIProvider } from '../src/engine/provider';
import type { Consult } from '../src/types';

const mech = new Set(MECHANISMS.map((m) => m.id));
const life = new Set(LIFESTYLE.map((l) => l.id));
const ref = (ids: string[], where: string) => ids.forEach((r) => assert(REF_MAP[r], `未知的參考來源 ${r}（${where}）`));

for (const c of CATEGORIES) for (const s of c.symptoms) {
  s.organs.forEach((o) => assert(ORGAN_MAP[o], `${s.id} 未知器官 ${o}`));
  s.mech.forEach((m) => assert(mech.has(m), `${s.id} 未知機制 ${m}`));
  s.nutrients.forEach((n) => assert(NUTRIENT_MAP[n], `${s.id} 未知營養素 ${n}`));
}
MECHANISMS.forEach((m) => { ref(m.refs, m.id); m.lifestyle.forEach((l) => assert(life.has(l), `${m.id} 未知生活因素 ${l}`)); });
LIFESTYLE.forEach((l) => ref(l.advice.refs, l.id));
RED_FLAGS.forEach((r) => { ref(r.refs, r.id); r.organs.forEach((o) => assert(ORGAN_MAP[o], `${r.id} 未知器官 ${o}`)); });
NUTRIENTS.forEach((n) => { ref(n.refs, n.id); n.organs.forEach((o) => assert(ORGAN_MAP[o], `${n.id} 未知器官 ${o}`)); });
TOPICS.forEach((t) => t.steps.forEach((s) => { ref(s.refs, t.id); s.organs.forEach((o) => assert(ORGAN_MAP[o], `${t.id} 未知器官 ${o}`)); }));

const base = (): Consult => ({
  id: 't', caseCode: 'T-1', date: '2026-01-01', managerName: '', consent: { education: true, localStorage: false, thirdPartyAI: false },
  ageRange: '', sex: '', symptoms: {}, lifestyle: [], lifestyleNote: '', redFlags: {}, historyTags: [], history: '', medications: '',
  review: { excluded: [], note: '', reviewer: '', checks: [false, false, false] }, audit: [], updatedAt: '',
});

// 空問卷
assert(analyzeRules(base()).empty);

// 緊急警訊必須出現在 emergency
const e = base(); e.redFlags.rf_chest = 'yes';
assert.equal(analyzeRules(e).emergency.length, 1);
const f = base(); f.symptoms.chest_pain = { followups: { acute: 'yes' } };
assert(analyzeRules(f).emergency.some((x) => x.id === 'fu_chest_pain_acute'));

// 一般情境
const c = base();
c.symptoms.eye_dry = { followups: {}, severity: 8 };
c.symptoms.thirst = { followups: {} };
c.lifestyle = ['lateNight', 'screen'];
const a = analyzeRules(c);
assert(!a.empty && a.emergency.length === 0);
assert(a.organs.some((o) => o.organId === 'eyes') && a.organs.some((o) => o.organId === 'pancreas'));
assert(a.mechanisms.find((m) => m.id === 'mech_tearfilm')!.text.includes('長時間使用 3C'));
assert(a.medical.find((m) => m.id === 'med_eye_dry')!.text.includes('困擾程度高'));
assert(a.lifestyle.some((l) => l.id === 'life_lateNight'));
assert(a.questions.some((q) => q.id === 'q_redflags'));
// 不得出現確診或判定缺乏的措辭
const all = JSON.stringify(a);
for (const banned of ['確診', '你缺乏', '個案缺乏維生素', '已受損，', '罹患了']) assert(!all.includes(banned), `分析結果出現禁用措辭：${banned}`);

// 審核雜湊會隨內容改變
const h1 = consultHash(c); c.symptoms.cough = { followups: {} };
assert.notEqual(h1, consultHash(c));

// AI 介面未實作時必須明確拒絕，且未同意時不得送出
assert.equal(remoteAIProvider.available, false);
await assert.rejects(() => remoteAIProvider.analyze(base()), /未同意/);

console.log('engine-check：全部通過');
