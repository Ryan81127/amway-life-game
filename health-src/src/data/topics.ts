import type { Evidence } from '../types';

/** 「生活因素 → 生理機制 → 器官影響 → 健康風險 → 改善方向」互動教學主題 */
export type Stage = '生活因素' | '生理機制' | '器官影響' | '健康風險' | '改善方向';

export interface TopicStep {
  stage: Stage;
  title: string;
  organs: string[];
  normal: string;
  change: string;
  evidence: Evidence;
  refs: string[];
}

export interface Topic {
  id: string;
  title: string;
  ready: boolean;
  intro: string;
  steps: TopicStep[];
}

export const TOPICS: Topic[] = [
  {
    id: 'late-night', title: '長期熬夜', ready: true,
    intro: '以下為群體研究歸納的可能機制，用於衛教說明。每個人的狀況不同，這不是對個案的預測。',
    steps: [
      { stage: '生活因素', title: '睡眠時間不足或作息延後', organs: ['brain'], evidence: 'A', refs: ['aasm'],
        normal: '成人建議每晚規律睡眠 7 小時以上，並維持固定的睡醒時間。',
        change: '長期晚睡、睡眠少於 7 小時或平假日作息差距大，身體需要持續調整節律。' },
      { stage: '生理機制', title: '大腦與生理時鐘', organs: ['brain', 'eyes'], evidence: 'B', refs: ['aha-sleep'],
        normal: '眼睛接收光線訊號傳到下視丘的視交叉上核，夜晚光線變暗後松果體分泌褪黑激素，身體準備入睡。',
        change: '夜間持續接觸強光與螢幕，可能延後褪黑激素分泌，使入睡時間後移，生理時鐘與實際作息錯位。' },
      { stage: '器官影響', title: '注意力與情緒', organs: ['brain'], evidence: 'B', refs: ['lim'],
        normal: '充足睡眠後，前額葉皮質能有效維持專注、判斷與情緒調節。',
        change: '統合分析顯示，短期睡眠剝奪會降低持續性注意力與反應速度；情緒也較容易起伏。' },
      { stage: '器官影響', title: '自律神經與心血管調節', organs: ['heart', 'vessels'], evidence: 'B', refs: ['aha-sleep'],
        normal: '夜間睡眠時副交感神經活性上升，心跳與血壓會比白天降低，讓心血管系統休息。',
        change: '睡眠不足時交感神經活性相對偏高，夜間血壓下降的幅度可能減少。觀察性研究發現睡眠時間短與高血壓風險有相關性。' },
      { stage: '器官影響', title: '胰島素敏感性與血糖代謝', organs: ['pancreas', 'liver', 'muscles'], evidence: 'B', refs: ['spiegel', 'aha-sleep'],
        normal: '進食後胰島素促使葡萄糖進入肌肉與肝臟細胞，血糖在一段時間內回到平穩。',
        change: '實驗研究顯示，連續數天限制睡眠後，健康成人的葡萄糖耐受性與胰島素敏感性下降；食慾相關荷爾蒙也可能改變，較想吃高熱量食物。' },
      { stage: '健康風險', title: '免疫反應與發炎調節', organs: ['vessels', 'airway'], evidence: 'B', refs: ['besedovsky'],
        normal: '睡眠期間免疫系統進行調節，有助於形成免疫記憶。',
        change: '長期睡眠不足與發炎指標上升、感染後恢復及疫苗反應較差有相關性。這些是群體層次的風險關聯，不代表每個人都會發生。' },
      { stage: '改善方向', title: '睡眠、飲食與運動管理', organs: ['brain', 'heart', 'pancreas'], evidence: 'A', refs: ['aasm', 'who-pa', 'dietguide'],
        normal: '固定起床時間、起床後接觸日光、白天規律活動，是穩定生理時鐘的基礎。',
        change: '可行方向：每次提早 15–30 分鐘就寢；午後減少咖啡因；晚餐不過飽、睡前 2–3 小時不進食；每週累積 150 分鐘以上中等強度運動；睡前 1 小時調暗燈光並放下螢幕。' },
    ],
  },
  { id: 'hypertension', title: '高血壓', ready: false, intro: '', steps: [] },
  { id: 'atherosclerosis', title: '動脈粥狀硬化', ready: false, intro: '', steps: [] },
  { id: 't2dm', title: '第二型糖尿病', ready: false, intro: '', steps: [] },
  { id: 'fatty-liver', title: '脂肪肝', ready: false, intro: '', steps: [] },
  { id: 'dry-eye', title: '乾眼症', ready: false, intro: '', steps: [] },
];
