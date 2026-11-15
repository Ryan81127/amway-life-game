import { lazy, Suspense, useState } from 'react';
import { ORGANS, ORGAN_MAP } from '../data/organs';
import { useStore, type Layers } from '../store';
import { CURRENT_MODEL, SEX_MODELS_AVAILABLE } from '../three/modelSource';

const BodyViewer = lazy(() => import('../three/BodyViewer'));

const LAYER_LABELS: [keyof Layers, string][] = [['organ', '器官'], ['vessel', '血管'], ['nerve', '神經'], ['muscle', '肌肉'], ['skeleton', '骨骼']];

export default function ViewerPanel({ flagged }: { flagged: string[] }) {
  const { selectedOrgan, selectOrgan, skinOpacity, setSkinOpacity, layers, toggleLayer, addSnapshot, snapshots, spotlight } = useStore();
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState('');
  const snap = () => {
    const label = selectedOrgan ? ORGAN_MAP[selectedOrgan].name : '全身';
    setMsg(addSnapshot(label) ? `已加入報告（${Math.min(snapshots.length + 1, 4)}/4）` : '擷取失敗');
    setTimeout(() => setMsg(''), 2200);
  };

  return (
    <div className="viewer">
      <div className="viewer-canvas">
        <Suspense fallback={<div className="loading">載入 3D 場景…</div>}>
          <BodyViewer flagged={flagged} />
        </Suspense>
        <div className="viewer-badge">{CURRENT_MODEL.label}｜即時 3D，可拖曳旋轉、滾輪或雙指縮放、右鍵或雙指平移</div>
        {(spotlight ?? flagged).length > 0 && <div className="viewer-legend"><i className="dot flag" />{spotlight ? '主題教學標示' : '問卷相關器官'}　<i className="dot sel" />目前選取</div>}
      </div>

      <div className="viewer-controls">
        <div className="row">
          <button className="btn small" aria-expanded={menu} onClick={() => setMenu(!menu)}>器官選單 {menu ? '▴' : '▾'}</button>
          <button className="btn small ghost" onClick={() => selectOrgan(null)} disabled={!selectedOrgan}>回到全身</button>
          <button className="btn small ghost" onClick={snap}>📷 擷取畫面加入報告</button>
          {msg && <span className="ok">{msg}</span>}
        </div>
        {menu && (
          <div className="organ-menu">
            {ORGANS.map((o) => (
              <button key={o.id} className={`chip ${selectedOrgan === o.id ? 'on' : ''} ${flagged.includes(o.id) ? 'flagged' : ''}`} onClick={() => selectOrgan(o.id)}>{o.name}</button>
            ))}
          </div>
        )}
        <div className="row">
          <label className="slider">皮膚透明度
            <input type="range" min={0} max={1} step={0.02} value={1 - skinOpacity} onChange={(e) => setSkinOpacity(1 - Number(e.target.value))} />
          </label>
          <div className="layers" role="group" aria-label="圖層">
            {LAYER_LABELS.map(([k, label]) => (
              <button key={k} className={`chip ${layers[k] ? 'on' : ''}`} aria-pressed={layers[k]} onClick={() => toggleLayer(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="row pending-row">
          <button className="chip" disabled>{SEX_MODELS_AVAILABLE ? '男／女模型' : '男／女解剖模型（需授權模型，尚未提供）'}</button>
          <button className="chip" disabled>組織・細胞微觀探索（第三階段，尚未完成）</button>
          <button className="chip" disabled>正常／異常動畫比較（第三階段，尚未完成）</button>
        </div>
      </div>
    </div>
  );
}
