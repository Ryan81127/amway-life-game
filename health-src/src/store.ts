import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Consult, SymptomDetail, Tri } from './types';
import { consultHash } from './engine/ruleEngine';

export type Step = 'setup' | 'work' | 'review';
export type Layers = { muscle: boolean; skeleton: boolean; vessel: boolean; nerve: boolean; organ: boolean };

export interface Snapshot { id: string; label: string; dataUrl: string }

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

export function newConsult(): Consult {
  return {
    id: uid(), caseCode: '', date: today(), managerName: '',
    consent: { education: false, localStorage: false, thirdPartyAI: false },
    ageRange: '', sex: '', symptoms: {}, lifestyle: [], lifestyleNote: '', redFlags: {},
    historyTags: [], history: '', medications: '',
    review: { excluded: [], note: '', reviewer: '', checks: [false, false, false] },
    audit: [{ at: now(), action: '建立諮詢' }], updatedAt: now(),
  };
}

interface State {
  consults: Record<string, Consult>;
  currentId: string;
  step: Step;
  /* 3D 檢視狀態（不持久化） */
  selectedOrgan: string | null;
  spotlight: string[] | null; // 主題教學時暫時標示的器官
  skinOpacity: number;
  layers: Layers;
  snapshots: Snapshot[];
  capture: (() => string | null) | null;

  setStep(s: Step): void;
  update(fn: (c: Consult) => void, auditAction?: string): void;
  toggleSymptom(id: string): void;
  setSymptomDetail(id: string, patch: Partial<SymptomDetail>): void;
  setFollowup(id: string, fid: string, v: Tri): void;
  toggleLifestyle(id: string): void;
  setRedFlag(id: string, v: Tri): void;
  approve(): void;
  revoke(): void;
  log(action: string): void;
  startNew(): void;
  load(id: string): void;
  remove(id: string): void;
  removeAll(): void;
  selectOrgan(id: string | null): void;
  setSpotlight(ids: string[] | null): void;
  setSkinOpacity(v: number): void;
  toggleLayer(k: keyof Layers): void;
  addSnapshot(label: string): boolean;
  removeSnapshot(id: string): void;
}

const first = newConsult();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      consults: { [first.id]: first },
      currentId: first.id,
      step: 'setup',
      selectedOrgan: null,
      spotlight: null,
      skinOpacity: 0.28,
      layers: { muscle: false, skeleton: false, vessel: true, nerve: false, organ: true },
      snapshots: [],
      capture: null,

      setStep: (step) => set({ step }),
      update: (fn, auditAction) =>
        set((s) => {
          const c: Consult = structuredClone(s.consults[s.currentId]);
          fn(c);
          c.updatedAt = now();
          if (auditAction) c.audit.push({ at: now(), action: auditAction });
          return { consults: { ...s.consults, [c.id]: c } };
        }),
      toggleSymptom: (id) => get().update((c) => { if (c.symptoms[id]) delete c.symptoms[id]; else c.symptoms[id] = { followups: {} }; }),
      setSymptomDetail: (id, patch) => get().update((c) => { if (c.symptoms[id]) Object.assign(c.symptoms[id], patch); }),
      setFollowup: (id, fid, v) => get().update((c) => { if (c.symptoms[id]) c.symptoms[id].followups[fid] = v; }),
      toggleLifestyle: (id) => get().update((c) => { c.lifestyle = c.lifestyle.includes(id) ? c.lifestyle.filter((x) => x !== id) : [...c.lifestyle, id]; }),
      setRedFlag: (id, v) => get().update((c) => { c.redFlags[id] = v; }),
      approve: () => get().update((c) => { c.review.approvedAt = now(); c.review.approvedHash = consultHash(c); }, `健康管理師審核通過（${get().consults[get().currentId].review.reviewer}）`),
      revoke: () => get().update((c) => { delete c.review.approvedAt; delete c.review.approvedHash; }, '撤回審核'),
      log: (action) => get().update(() => {}, action),
      startNew: () => { const c = newConsult(); set((s) => ({ consults: { ...s.consults, [c.id]: c }, currentId: c.id, step: 'setup', snapshots: [], selectedOrgan: null, spotlight: null })); },
      load: (id) => set({ currentId: id, step: 'work', snapshots: [], selectedOrgan: null, spotlight: null }),
      remove: (id) => set((s) => {
        const consults = { ...s.consults };
        delete consults[id];
        if (id !== s.currentId) return { consults };
        const c = newConsult();
        return { consults: { ...consults, [c.id]: c }, currentId: c.id, step: 'setup', snapshots: [] };
      }),
      removeAll: () => { const c = newConsult(); set({ consults: { [c.id]: c }, currentId: c.id, step: 'setup', snapshots: [] }); },
      selectOrgan: (selectedOrgan) => set({ selectedOrgan }),
      setSpotlight: (spotlight) => set({ spotlight }),
      setSkinOpacity: (skinOpacity) => set({ skinOpacity }),
      toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
      addSnapshot: (label) => {
        const url = get().capture?.();
        if (!url) return false;
        set((s) => ({ snapshots: [...s.snapshots, { id: uid(), label, dataUrl: url }].slice(-4) }));
        return true;
      },
      removeSnapshot: (id) => set((s) => ({ snapshots: s.snapshots.filter((x) => x.id !== id) })),
    }),
    {
      name: 'health-explorer-v1',
      // 只保存問卷與審核紀錄；3D 截圖不寫入儲存空間
      // 個案未同意本機儲存時，該筆諮詢只留在記憶體，關閉分頁即消失
      partialize: (s) => ({
        consults: Object.fromEntries(Object.entries(s.consults).filter(([, c]) => c.consent.localStorage)),
        currentId: s.currentId,
        step: s.step,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const consults = { ...(p.consults ?? {}) };
        if (p.currentId && consults[p.currentId]) return { ...current, consults, currentId: p.currentId, step: p.step ?? 'setup' };
        return { ...current, consults: { ...consults, ...current.consults }, step: 'setup' };
      },
    },
  ),
);

export const useConsult = () => useStore((s) => s.consults[s.currentId]);

export function isApproved(c: Consult): boolean {
  return !!c.review.approvedAt && c.review.approvedHash === consultHash(c);
}
