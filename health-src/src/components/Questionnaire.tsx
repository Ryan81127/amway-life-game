import { useState } from 'react';
import { CATEGORIES } from '../data/symptoms';
import { DURATION_OPTIONS, FREQ_OPTIONS, HISTORY_TAGS, LIFESTYLE, ONSET_OPTIONS, RED_FLAGS } from '../data/knowledge';
import { useConsult, useStore } from '../store';
import { Chips, TriChoice } from './ui';

const Sel = ({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange(v: string): void }) => (
  <label className="mini">{label}
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">不清楚／略過</option>{options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </label>
);

export default function Questionnaire() {
  const c = useConsult();
  const { toggleSymptom, setSymptomDetail, setFollowup, toggleLifestyle, setRedFlag, update } = useStore();
  const [open, setOpen] = useState<string>('flags');
  const count = (catId: string) => CATEGORIES.find((x) => x.id === catId)!.symptoms.filter((s) => c.symptoms[s.id]).length;
  const flagYes = RED_FLAGS.filter((r) => c.redFlags[r.id] === 'yes').length;
  const groups = [...new Set(LIFESTYLE.map((l) => l.group))];
  const Section = ({ id, title, badge, children }: { id: string; title: string; badge?: React.ReactNode; children: React.ReactNode }) => (
    <div key={id} className={`acc ${open === id ? "open" : ""}`}>
      <button type="button" className="acc-head" aria-expanded={open === id} onClick={() => setOpen(open === id ? '' : id)}>
        <span>{title}</span>{badge}<i>{open === id ? '−' : '+'}</i>
      </button>
      {open === id && <div className="acc-body">{children}</div>}
    </div>
  );

  return (
    <div className="questionnaire">
      <p className="hint">所有題目都可略過；不確定的項目請選「不清楚」。勾選症狀後會出現追問。</p>

      {Section({ id: 'flags', title: '① 就醫警訊（請先確認）', badge: flagYes ? <b className="count danger">{flagYes}</b> : null, children: (
        <ul className="flags">
          {RED_FLAGS.map((r) => (
            <li key={r.id}><span>{r.q}</span><TriChoice name={r.q} value={c.redFlags[r.id]} onChange={(v) => setRedFlag(r.id, v)} /></li>
          ))}
        </ul>
      ) })}

      {CATEGORIES.map((cat) => Section({ id: cat.id, title: `${cat.icon} ${cat.label}`, badge: count(cat.id) ? <b className="count">{count(cat.id)}</b> : null, children: (
        <div key={cat.id}>
          {cat.symptoms.map((s) => {
            const d = c.symptoms[s.id];
            return (
              <div key={s.id} className={`sym ${d ? 'on' : ''}`}>
                <label className="check"><input type="checkbox" checked={!!d} onChange={() => toggleSymptom(s.id)} /><span>{s.label}</span></label>
                {d && (
                  <div className="detail">
                    <div className="grid2">
                      <Sel label="何時開始" value={d.onset} options={ONSET_OPTIONS} onChange={(v) => setSymptomDetail(s.id, { onset: v || undefined })} />
                      <Sel label="每次持續" value={d.duration} options={DURATION_OPTIONS} onChange={(v) => setSymptomDetail(s.id, { duration: v || undefined })} />
                      <Sel label="發生頻率" value={d.frequency} options={FREQ_OPTIONS} onChange={(v) => setSymptomDetail(s.id, { frequency: v || undefined })} />
                      <label className="mini">困擾程度 {d.severity ? `${d.severity}/10` : '（未填）'}
                        <input type="range" min={0} max={10} value={d.severity ?? 0} onChange={(e) => setSymptomDetail(s.id, { severity: Number(e.target.value) || undefined })} />
                      </label>
                    </div>
                    {s.followups?.map((f) => (
                      <div key={f.id} className="followup">
                        <span>追問：{f.q}</span>
                        <TriChoice name={f.q} value={d.followups[f.id]} onChange={(v) => setFollowup(s.id, f.id, v)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) }))}

      {Section({ id: 'life', title: '🌙 生活習慣與環境', badge: c.lifestyle.length ? <b className="count">{c.lifestyle.length}</b> : null, children: (
        <>
          {groups.map((g) => (
            <div key={g} className="lifegroup">
              <h4>{g}</h4>
              {LIFESTYLE.filter((l) => l.group === g).map((l) => (
                <label key={l.id} className="check"><input type="checkbox" checked={c.lifestyle.includes(l.id)} onChange={() => toggleLifestyle(l.id)} /><span>{l.label}</span></label>
              ))}
            </div>
          ))}
          <label className="mini">補充說明（如平均睡眠時數、工作型態）
            <textarea rows={2} value={c.lifestyleNote} onChange={(e) => update((x) => { x.lifestyleNote = e.target.value; })} />
          </label>
        </>
      ) })}

      {Section({ id: 'hist', title: '📋 病史與用藥', badge: c.historyTags.length ? <b className="count">{c.historyTags.length}</b> : null, children: (
        <>
          <Chips options={HISTORY_TAGS} value={c.historyTags} onToggle={(t) => update((x) => { x.historyTags = x.historyTags.includes(t) ? x.historyTags.filter((y) => y !== t) : [...x.historyTags, t]; })} />
          <label className="mini">其他病史、手術或家族史
            <textarea rows={2} value={c.history} onChange={(e) => update((x) => { x.history = e.target.value; })} />
          </label>
          <label className="mini">目前用藥與保健食品
            <textarea rows={2} value={c.medications} placeholder="處方藥、成藥、保健食品" onChange={(e) => update((x) => { x.medications = e.target.value; })} />
          </label>
        </>
      ) })}
    </div>
  );
}
