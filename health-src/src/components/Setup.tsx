import { useState } from 'react';
import { useConsult, useStore } from '../store';
import { AGE_RANGES, SEX_OPTIONS } from '../data/knowledge';

export default function Setup() {
  const c = useConsult();
  const { update, setStep, consults, load, remove, removeAll, currentId } = useStore();
  const [err, setErr] = useState('');
  const others = Object.values(consults).filter((x) => x.id !== currentId && x.consent.localStorage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const start = () => {
    if (!c.caseCode.trim()) return setErr('請輸入個案代碼。');
    if (!c.consent.education) return setErr('需先向個案說明並取得「衛教用途」同意，才能開始問卷。');
    setErr('');
    if (!c.consent.at) update((x) => { x.consent.at = new Date().toISOString(); }, `取得個案同意（本機儲存：${c.consent.localStorage ? '同意' : '不同意'}；第三方 AI：${c.consent.thirdPartyAI ? '同意' : '不同意'}）`);
    setStep('work');
  };

  return (
    <div className="setup">
      <section className="card">
        <h2>建立諮詢</h2>
        <div className="grid2">
          <label>個案代碼<input value={c.caseCode} placeholder="例：A-2026-001" onChange={(e) => update((x) => { x.caseCode = e.target.value; })} /></label>
          <label>諮詢日期<input type="date" value={c.date} onChange={(e) => update((x) => { x.date = e.target.value; })} /></label>
          <label>健康管理師<input value={c.managerName} placeholder="姓名" onChange={(e) => update((x) => { x.managerName = e.target.value; x.review.reviewer ||= ''; })} /></label>
          <label>年齡層（可略過）
            <select value={c.ageRange} onChange={(e) => update((x) => { x.ageRange = e.target.value; })}>
              <option value="">未填</option>{AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label>生理性別（可略過）
            <select value={c.sex} onChange={(e) => update((x) => { x.sex = e.target.value; })}>
              <option value="">未填</option>{SEX_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <p className="hint">請使用代碼，不要輸入姓名、身分證字號、電話等可直接識別個人的資料。</p>
      </section>

      <section className="card">
        <h2>個案知情同意</h2>
        <label className="check"><input type="checkbox" checked={c.consent.education} onChange={(e) => update((x) => { x.consent.education = e.target.checked; })} />
          <span><b>（必要）</b>個案了解本平台用於健康教育、風險提醒與生活型態管理，<b>不提供疾病診斷</b>，也不能取代醫師的專業判斷。</span></label>
        <label className="check"><input type="checkbox" checked={c.consent.localStorage} onChange={(e) => update((x) => { x.consent.localStorage = e.target.checked; })} />
          <span>個案同意將本次問卷與報告內容<b>儲存在這台裝置的瀏覽器</b>（未加密、不會上傳）。不同意時資料只留在記憶體，關閉或重新整理頁面即消失。</span></label>
        <label className="check"><input type="checkbox" checked={c.consent.thirdPartyAI} onChange={(e) => update((x) => { x.consent.thirdPartyAI = e.target.checked; })} />
          <span>個案同意未來將去識別化資料送往第三方 AI 服務分析。<em className="pending">尚未完成｜目前版本沒有 AI 服務，任何資料都不會離開本機</em></span></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary" onClick={start}>開始問卷 →</button>
      </section>

      {others.length > 0 && (
        <section className="card">
          <h2>本機已儲存的諮詢</h2>
          <ul className="caselist">
            {others.map((x) => (
              <li key={x.id}>
                <span><b>{x.caseCode || '（未命名）'}</b>　{x.date}　症狀 {Object.keys(x.symptoms).length} 項{x.review.approvedAt ? '　已審核' : ''}</span>
                <span>
                  <button className="btn small" onClick={() => load(x.id)}>開啟</button>
                  <button className="btn small ghost" onClick={() => confirm(`確定刪除 ${x.caseCode || '這筆諮詢'}？此動作無法復原。`) && remove(x.id)}>刪除</button>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn small ghost" onClick={() => confirm('確定刪除本機所有諮詢資料？此動作無法復原。') && removeAll()}>刪除全部本機資料</button>
          <p className="hint">個案追蹤與前後比較屬於第三階段功能，目前只提供開啟與刪除。</p>
        </section>
      )}

      <section className="card notice">
        <h2>目前版本的範圍</h2>
        <ul>
          <li><b>已完成（第一階段）：</b>症狀與生活習慣問卷、即時 3D 示意人體與器官互動、規則式衛教分析、熬夜主題互動教學、營養素資料庫、健康管理師審核、A4 PDF 匯出與列印。</li>
          <li><b>尚未完成：</b>經授權的解剖精確 3D 模型與男女模型、AI 模型分析、組織與細胞微觀探索、其他疾病主題動畫、個案追蹤比較、加密儲存與存取控制、醫學內容專業審查。</li>
        </ul>
      </section>
    </div>
  );
}
