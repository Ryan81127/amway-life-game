import { forwardRef } from 'react';
import type { AnalysisItem, AnalysisResult, Consult } from '../types';
import { EVIDENCE_LABEL } from '../types';
import { ORGAN_MAP } from '../data/organs';
import { LIFESTYLE, RED_FLAGS } from '../data/knowledge';
import { CONTENT_VERSION, REF_MAP } from '../data/references';
import type { Snapshot } from '../store';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false }) : '');

function Items({ items, excluded }: { items: AnalysisItem[]; excluded: string[] }) {
  const list = items.filter((i) => !excluded.includes(i.id));
  if (!list.length) return <p className="r-muted">（無）</p>;
  return (
    <>
      {list.map((i) => (
        <div key={i.id} className="pdf-block r-item">
          <b>{i.title}</b>{i.evidence && <span className="r-ev">證據 {EVIDENCE_LABEL[i.evidence]}</span>}
          {i.tags?.map((t) => <span key={t} className="r-tag">{t}</span>)}
          <p>{i.text}</p>
        </div>
      ))}
    </>
  );
}

interface Props { c: Consult; a: AnalysisResult; snapshots: Snapshot[]; approved: boolean }

/** A4 報告版面。每個 .pdf-block 是 PDF 分頁時不會被切斷的最小單位。 */
const Report = forwardRef<HTMLDivElement, Props>(({ c, a, snapshots, approved }, ref) => {
  const ex = c.review.excluded;
  const life = LIFESTYLE.filter((l) => c.lifestyle.includes(l.id)).map((l) => l.label);
  const flagsYes = RED_FLAGS.filter((r) => c.redFlags[r.id] === 'yes');
  const flagsUnknown = RED_FLAGS.filter((r) => !c.redFlags[r.id] || c.redFlags[r.id] === 'unknown');
  const H = ({ n, children }: { n: number; children: React.ReactNode }) => <h2 className="pdf-block"><i>{n}</i>{children}</h2>;

  return (
    <div className={`report ${approved ? '' : 'draft'}`} ref={ref}>
      <header className="pdf-block r-head">
        <div>
          <h1>個人化健康衛教報告</h1>
          <p>3D 人體健康探索與個人化健康管理平台</p>
        </div>
        <table>
          <tbody>
            <tr><th>個案代碼</th><td>{c.caseCode || '—'}</td></tr>
            <tr><th>諮詢日期</th><td>{c.date}</td></tr>
            <tr><th>健康管理師</th><td>{c.managerName || '—'}</td></tr>
            <tr><th>狀態</th><td>{approved ? '已審核' : '草稿（未審核）'}</td></tr>
          </tbody>
        </table>
      </header>
      <p className="pdf-block r-disclaimer">本報告為健康教育與生活型態管理參考資料，<b>不是醫療診斷</b>，不能取代醫師的專業判斷。分析由規則式衛教系統（非 AI）依個案自述產生，並經健康管理師審核。</p>

      {a.emergency.length > 0 && (
        <div className="pdf-block r-emergency">
          <b>⚠ 緊急就醫提醒</b>
          {a.emergency.map((e) => <p key={e.id}>{e.title}：{e.text}</p>)}
        </div>
      )}

      <H n={1}>健康狀況與生活習慣摘要</H>
      <div className="pdf-block">
        <table className="r-table">
          <tbody>
            <tr><th>年齡層／性別</th><td>{[c.ageRange, c.sex].filter(Boolean).join('／') || '未填'}</td></tr>
            <tr><th>相關病史</th><td>{[...c.historyTags, c.history].filter(Boolean).join('、') || '未填'}</td></tr>
            <tr><th>用藥與保健食品</th><td>{c.medications || '未填'}</td></tr>
            <tr><th>生活習慣與環境</th><td>{[...life, c.lifestyleNote].filter(Boolean).join('、') || '未勾選'}</td></tr>
          </tbody>
        </table>
      </div>

      <H n={2}>症狀勾選結果</H>
      <div className="pdf-block">
        {a.summary.length ? <ul>{a.summary.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="r-muted">未勾選症狀。</p>}
        <p>可能相關的器官與系統：{a.organs.map((o) => ORGAN_MAP[o.organId].name).join('、') || '—'}{a.systems.length ? `（${a.systems.join('、')}）` : ''}</p>
      </div>

      <H n={3}>衛教分析與不確定性</H>
      <div className="pdf-block r-box">
        <b>分析方式：</b>{a.engine.name} v{a.engine.version}；知識庫 {CONTENT_VERSION.version}（{CONTENT_VERSION.status}）。
        <ul>{a.uncertainty.map((u) => <li key={u}>{u}</li>)}</ul>
        <p>證據強度：A 臨床指引／專家共識；B 觀察性或實驗研究；C 生理機轉推論。</p>
      </div>
      <h3 className="pdf-block">需要進一步確認的問題</h3>
      <Items items={a.questions} excluded={ex} />

      <H n={4}>相關 3D 器官畫面</H>
      {snapshots.length ? (
        <div className="pdf-block r-snaps">
          {snapshots.map((s) => <figure key={s.id}><img src={s.dataUrl} alt={s.label} /><figcaption>{s.label}（示意幾何模型，非解剖精確，亦非個案影像）</figcaption></figure>)}
        </div>
      ) : <p className="pdf-block r-muted">未擷取 3D 畫面。可回到 3D 檢視按「擷取畫面加入報告」。</p>}

      <H n={5}>生理機制與健康風險說明</H>
      <p className="pdf-block r-muted">以下為文獻中「可能相關」的機制，並非判定個案的病因或器官狀態。</p>
      <Items items={a.mechanisms} excluded={ex} />

      <H n={6}>飲食及營養管理方向</H>
      <p className="pdf-block r-muted">以食物來源為優先。列出的營養素不代表個案缺乏，也不是疾病治療方式；使用補充品前請諮詢醫師、藥師或營養師。</p>
      <Items items={a.nutrition} excluded={ex} />

      <H n={7}>睡眠、運動與生活建議</H>
      <Items items={a.lifestyle} excluded={ex} />

      <H n={8}>就醫警訊與追蹤事項</H>
      <div className="pdf-block">
        <p><b>個案回報的警訊：</b>{flagsYes.length ? flagsYes.map((f) => f.q.replace(/？$/, '')).join('；') : '無'}</p>
        {flagsUnknown.length > 0 && <p><b>尚未確認的警訊（{flagsUnknown.length} 項）：</b>{flagsUnknown.map((f) => f.q.replace(/？$/, '')).join('；')}</p>}
        <p><b>出現下列任一情況請立即撥打 119 或前往急診：</b>急性胸痛或胸悶合併冒冷汗、嚴重呼吸困難、突然單側手腳無力或臉歪嘴斜、口齒不清、突然視力喪失、突發劇烈頭痛、昏厥。</p>
      </div>
      <h3 className="pdf-block">建議醫療評估的情況</h3>
      <Items items={a.medical} excluded={[]} />
      <h3 className="pdf-block">後續追蹤</h3>
      <Items items={a.followup} excluded={ex} />

      {c.review.note.trim() && (<><h3 className="pdf-block">健康管理師補充說明</h3><p className="pdf-block r-note">{c.review.note}</p></>)}

      <H n={9}>健康管理師確認欄</H>
      <div className="pdf-block r-sign">
        <div><span>審核人</span><b>{approved ? c.review.reviewer : ''}</b></div>
        <div><span>審核時間</span><b>{approved ? fmt(c.review.approvedAt) : ''}</b></div>
        <div><span>簽名</span><b /></div>
        <div><span>個案確認</span><b /></div>
      </div>

      <H n={10}>醫學參考來源與免責說明</H>
      <ol className="pdf-block r-refs">
        {a.refs.length ? a.refs.map((r) => <li key={r}>{REF_MAP[r]?.cite ?? r}</li>) : <li>（本次分析未引用文獻）</li>}
      </ol>
      <p className="pdf-block r-disclaimer">
        免責說明：本報告內容依個案自述與一般衛教知識整理，僅供健康教育使用，不構成診斷、治療或用藥建議。任何症狀持續、加重或出現警訊時，請儘速就醫。知識庫內容為 {CONTENT_VERSION.version}，{CONTENT_VERSION.status}。
      </p>
    </div>
  );
});
export default Report;
