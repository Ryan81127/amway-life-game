import { useRef, useState } from 'react';
import type { AnalysisItem, AnalysisResult } from '../types';
import { isApproved, useConsult, useStore } from '../store';
import { exportReportPdf } from '../pdf/exportPdf';
import Report from './Report';

const CHECKS = [
  '我已逐項檢視分析內容，並排除不適用於此個案的項目。',
  '我已向個案說明就醫警訊，以及本報告不是醫療診斷。',
  '我確認報告不含可直接識別個人的資料，且已取得個案同意。',
];

export default function Review({ a }: { a: AnalysisResult }) {
  const c = useConsult();
  const { update, approve, revoke, log, snapshots, removeSnapshot, setStep } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const approved = isApproved(c);
  const stale = !!c.review.approvedAt && !approved;
  const canApprove = c.review.reviewer.trim() && c.review.checks.every(Boolean) && !a.empty;
  const groups: [string, AnalysisItem[]][] = [['生理機制', a.mechanisms], ['待確認問題', a.questions], ['生活建議', a.lifestyle], ['營養衛教', a.nutrition], ['後續追蹤', a.followup]];
  const toggle = (id: string) => update((x) => { x.review.excluded = x.review.excluded.includes(id) ? x.review.excluded.filter((y) => y !== id) : [...x.review.excluded, id]; });

  const download = async () => {
    if (!ref.current || !approved) return;
    setBusy(true); setErr('');
    try {
      await exportReportPdf(ref.current, `健康衛教報告_${c.caseCode || '個案'}_${c.date}.pdf`, `個案代碼 ${c.caseCode}　${c.date}　衛教用途，非醫療診斷`);
      log('匯出 PDF');
    } catch (e) { setErr(`PDF 產生失敗：${(e as Error).message}。可改用「列印／另存 PDF」。`); }
    setBusy(false);
  };
  const print = () => { if (approved) { log('列印報告'); window.print(); } };

  return (
    <div className="review">
      <aside className="review-side no-print">
        <button className="btn small ghost" onClick={() => setStep('work')}>← 返回修改問卷</button>
        <section className="card">
          <h3>審核內容</h3>
          <p className="small">取消勾選的項目不會出現在報告中。就醫警訊與醫療評估建議一律保留，不可排除。</p>
          {a.empty && <p className="error">尚未勾選任何症狀，無法產生報告。</p>}
          {groups.map(([label, items]) => items.length > 0 && (
            <details key={label} open={label === '生理機制'}>
              <summary>{label}（{items.filter((i) => !c.review.excluded.includes(i.id)).length}/{items.length}）</summary>
              {items.map((i) => (
                <label key={i.id} className="check"><input type="checkbox" checked={!c.review.excluded.includes(i.id)} onChange={() => toggle(i.id)} /><span>{i.title}</span></label>
              ))}
            </details>
          ))}
          <label className="mini">健康管理師補充說明（會印在報告上）
            <textarea rows={3} value={c.review.note} onChange={(e) => update((x) => { x.review.note = e.target.value; })} />
          </label>
        </section>

        <section className="card">
          <h3>3D 畫面（{snapshots.length}/4）</h3>
          {snapshots.length === 0 && <p className="small">尚未擷取。請返回 3D 檢視，按「擷取畫面加入報告」。截圖不會儲存，重新整理後需重新擷取。</p>}
          <div className="snaps">{snapshots.map((s) => <figure key={s.id}><img src={s.dataUrl} alt={s.label} /><button className="btn small ghost" onClick={() => removeSnapshot(s.id)}>移除 {s.label}</button></figure>)}</div>
        </section>

        <section className="card">
          <h3>審核確認</h3>
          <label className="mini">審核人姓名
            <input value={c.review.reviewer} placeholder={c.managerName || '健康管理師姓名'} onChange={(e) => update((x) => { x.review.reviewer = e.target.value; })} />
          </label>
          {CHECKS.map((t, i) => (
            <label key={t} className="check"><input type="checkbox" checked={c.review.checks[i]} onChange={(e) => update((x) => { x.review.checks[i] = e.target.checked; })} /><span>{t}</span></label>
          ))}
          {stale && <p className="error" role="alert">審核後內容已被修改，需要重新審核才能匯出。</p>}
          {approved ? (
            <><p className="ok">✓ 已審核通過，可以匯出。</p><button className="btn small ghost" onClick={revoke}>撤回審核</button></>
          ) : (
            <button className="btn primary" disabled={!canApprove} onClick={approve}>{stale ? '重新審核通過' : '審核通過'}</button>
          )}
        </section>

        <section className="card">
          <h3>匯出</h3>
          {!approved && <p className="small">報告需經健康管理師審核通過後才能匯出；目前預覽帶有「草稿」浮水印。</p>}
          <button className="btn primary" disabled={!approved || busy} onClick={download}>{busy ? '產生中…' : '⬇ 下載 A4 PDF'}</button>
          <button className="btn" disabled={!approved} onClick={print}>🖨 列印／另存 PDF</button>
          {err && <p className="error" role="alert">{err}</p>}
          <p className="small">「下載 PDF」的內容為影像，文字無法選取；需要可選取文字時請用「列印／另存 PDF」。</p>
        </section>

        <section className="card">
          <h3>紀錄</h3>
          <ul className="audit">{[...c.audit].reverse().map((x, i) => <li key={i}><time>{new Date(x.at).toLocaleString('zh-TW', { hour12: false })}</time>{x.action}</li>)}</ul>
          <p className="small">分析引擎：{a.engine.name} v{a.engine.version}</p>
        </section>
      </aside>
      <div className="report-wrap"><Report ref={ref} c={c} a={a} snapshots={snapshots} approved={approved} /></div>
    </div>
  );
}
