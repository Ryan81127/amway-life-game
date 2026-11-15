/** 醫學參考來源。內容版本與審查狀態見 CONTENT_VERSION。 */
export const CONTENT_VERSION = {
  version: '0.1.0-draft',
  date: '2026-11-15',
  status: '草稿：尚未經醫療專業人員審查，正式使用前須完成醫學內容審查',
};

export interface Reference {
  id: string;
  cite: string;
}

export const REFERENCES: Reference[] = [
  { id: 'dri8', cite: '衛生福利部國民健康署。《國人膳食營養素參考攝取量》第八版。' },
  { id: 'dietguide', cite: '衛生福利部國民健康署。《每日飲食指南》手冊（2018）。' },
  { id: 'ods', cite: 'U.S. National Institutes of Health, Office of Dietary Supplements. Dietary Supplement Fact Sheets for Health Professionals.' },
  { id: 'who-pa', cite: 'World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: WHO; 2020.' },
  { id: 'who-aqg', cite: 'World Health Organization. WHO global air quality guidelines. Geneva: WHO; 2021.' },
  { id: 'aasm', cite: 'Watson NF, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the AASM and Sleep Research Society. Sleep. 2015;38(6):843–844.' },
  { id: 'aha-sleep', cite: 'St-Onge MP, et al. Sleep duration and quality: impact on lifestyle behaviors and cardiometabolic health: a scientific statement from the American Heart Association. Circulation. 2016;134(18):e367–e386.' },
  { id: 'spiegel', cite: 'Spiegel K, Leproult R, Van Cauter E. Impact of sleep debt on metabolic and endocrine function. Lancet. 1999;354(9188):1435–1439.' },
  { id: 'lim', cite: 'Lim J, Dinges DF. A meta-analysis of the impact of short-term sleep deprivation on cognitive variables. Psychol Bull. 2010;136(3):375–389.' },
  { id: 'besedovsky', cite: 'Besedovsky L, Lange T, Haack M. The sleep-immune crosstalk in health and disease. Physiol Rev. 2019;99(3):1325–1380.' },
  { id: 'dews', cite: 'Craig JP, et al. TFOS DEWS II definition and classification report. Ocul Surf. 2017;15(3):276–283.' },
  { id: 'acg-gerd', cite: 'Katz PO, et al. ACG clinical guideline for the diagnosis and management of gastroesophageal reflux disease. Am J Gastroenterol. 2022;117(1):27–56.' },
  { id: 'ada', cite: 'American Diabetes Association Professional Practice Committee. Standards of Care in Diabetes（年度更新）. Diabetes Care.' },
  { id: 'chestpain', cite: 'Gulati M, et al. 2021 AHA/ACC/ASE/CHEST/SAEM/SCCT/SCMR guideline for the evaluation and diagnosis of chest pain. Circulation. 2021;144(22):e368–e454.' },
  { id: 'stroke', cite: '衛生福利部國民健康署。腦中風辨識口訣「微笑、舉手、說你好、搶時間」衛教資料。' },
];

export const REF_MAP: Record<string, Reference> = Object.fromEntries(REFERENCES.map((r) => [r.id, r]));
