import { useMemo, useState } from 'react';
import { analyzeRules } from './engine/ruleEngine';
import { isApproved, useConsult, useStore, type Step } from './store';
import Setup from './components/Setup';
import Questionnaire from './components/Questionnaire';
import ViewerPanel from './components/ViewerPanel';
import RightPanel, { EmergencyBanner } from './components/RightPanel';
import Review from './components/Review';

const STEPS: [Step, string][] = [['setup', '① 建立諮詢'], ['work', '② 問卷・3D・分析'], ['review', '③ 審核與匯出']];
type Pane = 'form' | 'viewer' | 'analysis';

export default function App() {
  const c = useConsult();
  const { step, setStep, startNew } = useStore();
  const [pane, setPane] = useState<Pane>('form');
  const analysis = useMemo(() => analyzeRules(c), [c]);
  const flagged = useMemo(() => analysis.organs.map((o) => o.organId), [analysis]);
  const ready = c.consent.education && !!c.caseCode.trim();
  const current: Step = ready ? step : 'setup';
  const go = (s: Step) => { if (s === 'setup' || ready) setStep(s); };
  const nSym = Object.keys(c.symptoms).length;

  return (
    <div className="app">
      <header className="top no-print">
        <div className="brand"><span className="logo">✚</span><div><b>3D 人體健康探索</b><small>健康管理衛教平台・第一階段 MVP</small></div></div>
        <nav className="steps" aria-label="流程">
          {STEPS.map(([s, label]) => (
            <button key={s} className={current === s ? 'on' : ''} aria-current={current === s ? 'step' : undefined} disabled={s !== 'setup' && !ready} onClick={() => go(s)}>{label}</button>
          ))}
        </nav>
        <div className="top-right">
          {ready && <span className="case">{c.caseCode}{isApproved(c) && ' ✓'}</span>}
          <button className="btn small ghost" onClick={() => confirm('建立新的諮詢？目前這筆若已同意本機儲存會保留。') && startNew()}>＋ 新諮詢</button>
        </div>
      </header>
      <div className="disclaimer no-print">衛教用途，不提供疾病診斷，不能取代醫療專業判斷。</div>
      <div className="no-print"><EmergencyBanner a={analysis} /></div>

      {current === 'setup' && <main className="main"><Setup /></main>}

      {current === 'work' && (
        <>
          <nav className="mtabs no-print" role="tablist">
            {([['form', `問卷${nSym ? `（${nSym}）` : ''}`], ['viewer', '3D 人體'], ['analysis', '分析與衛教']] as [Pane, string][]).map(([p, label]) => (
              <button key={p} role="tab" aria-selected={pane === p} className={pane === p ? 'on' : ''} onClick={() => setPane(p)}>{label}</button>
            ))}
          </nav>
          <main className={`work show-${pane}`}>
            <section className="col col-form"><h2 className="col-title">症狀問卷與生活因素</h2><div className="col-scroll"><Questionnaire /></div></section>
            <section className="col col-viewer"><ViewerPanel flagged={flagged} /></section>
            <section className="col col-analysis"><RightPanel a={analysis} /></section>
          </main>
          <footer className="bottom no-print">
            <button className="btn ghost" onClick={() => setStep('setup')}>← 諮詢資料</button>
            <span className="small">已勾選 {nSym} 項症狀、{c.lifestyle.length} 項生活因素</span>
            <button className="btn primary" onClick={() => setStep('review')}>健康管理師審核 →</button>
          </footer>
        </>
      )}

      {current === 'review' && <main className="main"><Review a={analysis} /></main>}
    </div>
  );
}
