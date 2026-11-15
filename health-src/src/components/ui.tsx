import type { AnalysisItem, Evidence, Tri } from '../types';
import { EVIDENCE_LABEL } from '../types';
import { REF_MAP } from '../data/references';

export function EvidenceBadge({ level }: { level?: Evidence }) {
  if (!level) return null;
  return <span className={`ev ev-${level}`} title="證據強度">證據 {EVIDENCE_LABEL[level]}</span>;
}

export function Sources({ refs }: { refs?: string[] }) {
  if (!refs) return null;
  if (!refs.length) return <div className="src">來源：一般生理學與臨床衛教知識（待補文獻）</div>;
  return <div className="src">來源：{refs.map((r) => REF_MAP[r]?.cite.split('。')[0].split('. ').slice(0, 2).join('. ') ?? r).join('；')}</div>;
}

export function ItemCard({ item, tone, children }: { item: AnalysisItem; tone?: 'danger' | 'warn'; children?: React.ReactNode }) {
  return (
    <div className={`card item ${tone ?? ''}`}>
      <div className="item-head">
        <strong>{item.title}</strong>
        {item.tags?.map((t) => <span key={t} className="tag">{t}</span>)}
        <EvidenceBadge level={item.evidence} />
      </div>
      <p>{item.text}</p>
      <Sources refs={item.refs} />
      {children}
    </div>
  );
}

const TRI: [Tri, string][] = [['yes', '是'], ['no', '否'], ['unknown', '不清楚']];
export function TriChoice({ value, onChange, name }: { value?: Tri; onChange(v: Tri): void; name: string }) {
  return (
    <span className="tri" role="radiogroup" aria-label={name}>
      {TRI.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? `on ${v}` : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </span>
  );
}

export function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle(v: string): void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value.includes(o)} className={value.includes(o) ? 'chip on' : 'chip'} onClick={() => onToggle(o)}>{o}</button>
      ))}
    </div>
  );
}

export function Pending({ children }: { children: React.ReactNode }) {
  return <span className="pending">尚未完成｜{children}</span>;
}
