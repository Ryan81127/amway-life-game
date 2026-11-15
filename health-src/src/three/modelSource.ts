/**
 * 3D 模型來源的擴充介面。
 *
 * 第一階段：'procedural' —— 以 Three.js 基本幾何即時產生的「示意人體」，
 *   是真正可旋轉、縮放、透視的 3D 場景，但不是解剖精確模型。
 * 第二階段：'gltf' —— 載入經授權的解剖模型（GLB），以 meshName 對應 organs.ts 的器官 id。
 *   尚未實作；取得授權模型後在 BodyViewer 依 source.kind 切換即可。
 */
export type ModelSource =
  | { kind: 'procedural'; label: string }
  | { kind: 'gltf'; label: string; url: string; license: string; meshMap: Record<string, string[]> };

export const CURRENT_MODEL: ModelSource = { kind: 'procedural', label: '示意幾何模型（非解剖精確）' };

/** 男女解剖模型：需授權模型，目前不可用 */
export const SEX_MODELS_AVAILABLE = false;
