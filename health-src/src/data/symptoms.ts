/** 依人體系統分類的症狀問卷定義（含動態追問）。 */
export interface FollowUp {
  id: string;
  q: string;
  /** 回答「是」時觸發的提醒 */
  ifYes?: { level: 'emergency' | 'prompt'; text: string };
}

export interface Symptom {
  id: string;
  label: string;
  organs: string[];
  mech: string[];
  /** 需要進一步確認的問題（供健康管理師追問） */
  ask: string[];
  /** 建議醫療評估的情況 */
  medical: string;
  nutrients: string[];
  followups?: FollowUp[];
}

export interface SymptomCategory {
  id: string;
  label: string;
  icon: string;
  symptoms: Symptom[];
}

export const CATEGORIES: SymptomCategory[] = [
  {
    id: 'eye', label: '眼部', icon: '👁',
    symptoms: [
      { id: 'eye_dry', label: '乾澀', organs: ['eyes'], mech: ['tearfilm'], nutrients: ['vitA', 'fat', 'water'],
        ask: ['每天使用螢幕的時數？', '是否配戴隱形眼鏡或長時間待在冷氣房？'],
        medical: '乾澀持續數週、合併疼痛、畏光或視力下降時，建議眼科檢查。' },
      { id: 'eye_blur', label: '視力模糊', organs: ['eyes', 'brain'], mech: ['accommodation', 'tearfilm', 'glucose'], nutrients: ['vitA'],
        ask: ['模糊是暫時性（眨眼或休息後改善）還是持續性？', '最近一次驗光或眼科檢查是什麼時候？'],
        medical: '持續性視力模糊建議眼科檢查；若合併口渴、頻尿，建議同時檢查血糖。',
        followups: [{ id: 'sudden', q: '是否為突然發生的視力喪失或視野缺一塊？', ifYes: { level: 'emergency', text: '突發性視力喪失或視野缺損屬於急症，請立即前往急診或眼科急診。' } }] },
      { id: 'eye_itch', label: '紅癢', organs: ['eyes'], mech: ['allergy', 'tearfilm'], nutrients: [],
        ask: ['是否有季節性或接觸特定環境後加重？', '是否合併分泌物？'],
        medical: '眼紅合併疼痛、分泌物增多或視力下降時，建議儘速眼科就診。' },
      { id: 'eye_tired', label: '疲勞', organs: ['eyes'], mech: ['accommodation', 'sleepdebt'], nutrients: ['vitA'],
        ask: ['用眼多久後開始疲勞？', '是否有定時休息？'],
        medical: '休息後仍無法改善，或合併頭痛、複視時，建議眼科檢查。' },
    ],
  },
  {
    id: 'neuro', label: '頭部與神經', icon: '🧠',
    symptoms: [
      { id: 'headache', label: '頭痛', organs: ['brain', 'muscles'], mech: ['tension', 'sleepdebt', 'stressans'], nutrients: ['water', 'magnesium'],
        ask: ['頭痛的位置與型態（緊縮、搏動）？', '是否與睡眠、月經週期、咖啡因或螢幕使用有關？'],
        medical: '頭痛頻率增加、型態改變、夜間痛醒或止痛藥使用頻繁（每週超過 2 天）時，建議神經內科評估。',
        followups: [{ id: 'thunder', q: '是否為突然發生、有生以來最劇烈的頭痛？', ifYes: { level: 'emergency', text: '突發劇烈頭痛需要立即就醫，以排除腦血管急症。' } }] },
      { id: 'dizzy', label: '頭暈', organs: ['brain', 'heart', 'vessels'], mech: ['hydration', 'sleepdebt'], nutrients: ['water', 'iron'],
        ask: ['是天旋地轉、站起來時眼前發黑，還是頭重腳輕？', '與姿勢改變、進食或用藥是否相關？'],
        medical: '反覆頭暈、合併耳鳴、聽力下降、心悸或昏厥時，建議就醫評估。',
        followups: [{ id: 'neuro', q: '是否合併口齒不清、單側無力或走路不穩？', ifYes: { level: 'emergency', text: '頭暈合併神經學症狀可能是腦中風徵兆，請立即撥打 119 就醫。' } }] },
      { id: 'attention', label: '注意力下降', organs: ['brain'], mech: ['sleepdebt', 'stressans'], nutrients: ['iron', 'vitB'],
        ask: ['平均每晚睡眠時數與入睡時間？', '情緒狀態與工作負荷近期是否改變？'],
        medical: '若合併持續情緒低落、記憶明顯退步或影響工作與生活，建議就醫評估。' },
      { id: 'sleep', label: '睡眠問題', organs: ['brain'], mech: ['sleepdebt', 'stressans'], nutrients: ['magnesium'],
        ask: ['是難以入睡、容易中斷還是太早醒？', '睡前是否使用 3C、攝取咖啡因或酒精？', '同住者是否觀察到打鼾或呼吸中止？'],
        medical: '失眠每週 3 晚以上且持續 3 個月，或有打鼾合併白天嗜睡時，建議睡眠門診評估。' },
    ],
  },
  {
    id: 'oral', label: '口腔', icon: '👄',
    symptoms: [
      { id: 'mouth_ulcer', label: '反覆嘴破', organs: ['mouth'], mech: ['oralmucosa'], nutrients: ['b12', 'folate', 'iron'],
        ask: ['發作頻率與每次癒合所需天數？', '是否與壓力、熬夜或咬傷有關？'],
        medical: '單一潰瘍超過 2 週未癒合，或潰瘍範圍大、頻繁發作時，建議口腔科或耳鼻喉科檢查。',
        followups: [{ id: 'twoweeks', q: '是否有同一處潰瘍超過 2 週未癒合？', ifYes: { level: 'prompt', text: '口腔潰瘍超過 2 週未癒合，建議儘速至口腔外科或耳鼻喉科檢查。' } }] },
      { id: 'gum_bleed', label: '牙齦出血', organs: ['mouth'], mech: ['gingiva'], nutrients: ['vitC'],
        ask: ['是刷牙時出血還是自發性出血？', '最近一次洗牙與牙科檢查的時間？'],
        medical: '建議牙科檢查牙周狀況；若合併身體其他部位容易出血或瘀青，建議內科檢查。' },
      { id: 'dry_mouth', label: '口乾', organs: ['mouth'], mech: ['saliva', 'glucose'], nutrients: ['water'],
        ask: ['每日飲水量大約多少？', '是否服用可能造成口乾的藥物（如抗組織胺、部分血壓或身心科用藥）？'],
        medical: '口乾持續且合併眼乾、吞嚥困難，或合併口渴頻尿時，建議就醫評估。' },
    ],
  },
  {
    id: 'cardio', label: '心血管', icon: '❤️',
    symptoms: [
      { id: 'palpitation', label: '心悸', organs: ['heart', 'thyroid'], mech: ['palpitation', 'stressans'], nutrients: ['potassium', 'magnesium'],
        ask: ['發作時機（休息、活動、喝咖啡後、緊張時）與持續時間？', '是否量過發作時的脈搏？'],
        medical: '心悸頻繁、持續超過數分鐘，或合併胸痛、喘、頭暈、昏厥時，建議心臟科評估。',
        followups: [{ id: 'faint', q: '心悸時是否合併胸痛、昏厥或快要昏倒的感覺？', ifYes: { level: 'emergency', text: '心悸合併胸痛或昏厥需要立即就醫評估。' } }] },
      { id: 'chest_tight', label: '胸悶', organs: ['heart', 'lungs'], mech: ['cardiacsupply', 'stressans'], nutrients: [],
        ask: ['胸悶與活動、情緒或進食的關係？', '休息後多久緩解？'],
        medical: '胸悶症狀建議由醫師評估以排除心肺原因，特別是有高血壓、糖尿病、高血脂、吸菸或家族史者。',
        followups: [{ id: 'exertion', q: '是否在活動時出現、休息後緩解？', ifYes: { level: 'prompt', text: '活動時出現、休息緩解的胸悶，建議儘速安排心臟科門診評估，就醫前避免劇烈運動。' } }] },
      { id: 'chest_pain', label: '胸痛', organs: ['heart', 'lungs', 'stomach'], mech: ['cardiacsupply', 'reflux'], nutrients: [],
        ask: ['疼痛位置、性質（壓迫、刺痛、灼熱）與持續時間？', '與呼吸、姿勢或按壓是否有關？'],
        medical: '任何胸痛都建議由醫師評估，不宜僅以生活調整處理。',
        followups: [
          { id: 'acute', q: '胸痛是否正在發生，或合併冒冷汗、噁心、喘、疼痛延伸至手臂或下巴？', ifYes: { level: 'emergency', text: '可能是心血管急症，請立即撥打 119 或前往急診，不要自行開車。' } },
          { id: 'exertion', q: '是否在活動時出現、休息後緩解？', ifYes: { level: 'prompt', text: '活動相關的胸痛建議儘速安排心臟科門診評估。' } },
        ] },
      { id: 'exertional_dyspnea', label: '活動時喘', organs: ['heart', 'lungs'], mech: ['fitness', 'cardiacsupply'], nutrients: ['iron'],
        ask: ['爬幾層樓或走多遠會喘？相較半年前是否變差？', '是否合併下肢水腫或平躺時喘？'],
        medical: '新出現或逐漸加重的活動時喘、合併下肢水腫或夜間喘醒時，建議心臟科或胸腔科評估。',
        followups: [{ id: 'rest', q: '休息時也會喘，或夜間因喘醒來？', ifYes: { level: 'prompt', text: '休息時喘或夜間喘醒建議儘速就醫；若喘到無法說話請撥打 119。' } }] },
    ],
  },
  {
    id: 'resp', label: '呼吸', icon: '🫁',
    symptoms: [
      { id: 'cough', label: '咳嗽', organs: ['airway', 'lungs'], mech: ['airwayirritation', 'reflux', 'allergy'], nutrients: ['water'],
        ask: ['咳嗽持續多久？有痰還是乾咳？', '夜間或平躺時是否加重？'],
        medical: '咳嗽超過 3 週、咳血、合併發燒或體重下降時，建議胸腔科檢查。',
        followups: [{ id: 'threeweeks', q: '咳嗽是否已超過 3 週？', ifYes: { level: 'prompt', text: '咳嗽超過 3 週建議至胸腔科檢查（含胸部 X 光）。' } }] },
      { id: 'rhinitis', label: '鼻過敏', organs: ['airway'], mech: ['allergy'], nutrients: [],
        ask: ['是否有季節性或特定環境（灰塵、寵物、冷空氣）誘發？', '是否影響睡眠？'],
        medical: '症狀影響睡眠或日常生活時，建議耳鼻喉科或過敏科評估。' },
      { id: 'breath', label: '呼吸不順', organs: ['lungs', 'airway', 'heart'], mech: ['airwayirritation', 'fitness', 'stressans'], nutrients: [],
        ask: ['發生時機（休息、活動、夜間、緊張時）？', '是否有喘鳴聲或氣喘病史？'],
        medical: '呼吸不順反覆發生或合併喘鳴、胸悶時，建議胸腔科評估。',
        followups: [{ id: 'severe', q: '是否喘到無法完整說完一句話？', ifYes: { level: 'emergency', text: '嚴重呼吸困難需要緊急處理，請立即撥打 119 或前往急診。' } }] },
    ],
  },
  {
    id: 'gi', label: '消化', icon: '🍽',
    symptoms: [
      { id: 'bloating', label: '脹氣', organs: ['stomach', 'intestines'], mech: ['gutmotility'], nutrients: ['fiber', 'water'],
        ask: ['與特定食物（豆類、乳製品、碳酸飲料）或進食速度是否相關？', '排便後是否改善？'],
        medical: '脹氣持續加重、合併體重下降、食慾不振或排便習慣改變時，建議腸胃科檢查。' },
      { id: 'reflux', label: '胃食道逆流', organs: ['stomach'], mech: ['reflux'], nutrients: [],
        ask: ['是否常在睡前 3 小時內進食或宵夜？', '平躺或彎腰時是否加重？'],
        medical: '每週 2 次以上、合併吞嚥困難、吞嚥疼痛或體重下降時，建議腸胃科評估。',
        followups: [{ id: 'dysphagia', q: '是否有吞嚥困難或食物卡住的感覺？', ifYes: { level: 'prompt', text: '吞嚥困難屬於警示症狀，建議儘速至腸胃科檢查。' } }] },
      { id: 'bowel', label: '排便異常', organs: ['intestines'], mech: ['gutmotility', 'stressans'], nutrients: ['fiber', 'water'],
        ask: ['是便秘、腹瀉還是兩者交替？每週排便次數？', '糞便形狀或顏色是否改變？'],
        medical: '排便習慣改變超過數週、糞便變細或 50 歲以上尚未做過大腸癌篩檢者，建議就醫或參加糞便潛血篩檢。',
        followups: [{ id: 'blood', q: '是否有血便或黑便？', ifYes: { level: 'prompt', text: '血便或黑便需要儘速至腸胃科檢查；出血量大請前往急診。' } }] },
    ],
  },
  {
    id: 'limb', label: '四肢與肌肉', icon: '💪',
    symptoms: [
      { id: 'numb', label: '麻木', organs: ['nerves'], mech: ['peripheralnerve'], nutrients: ['b12', 'vitB'],
        ask: ['麻木的部位（單側或雙側、手或腳）？', '與姿勢是否相關、改變姿勢後是否緩解？'],
        medical: '持續或逐漸擴大的麻木、合併無力時，建議神經內科評估，並可檢查血糖。',
        followups: [{ id: 'sudden', q: '是否為突然發生的單側手腳麻木或無力？', ifYes: { level: 'emergency', text: '突發單側麻木或無力可能是腦中風徵兆，請立即撥打 119 就醫。' } }] },
      { id: 'ache', label: '痠痛', organs: ['muscles'], mech: ['tension'], nutrients: ['protein', 'magnesium'],
        ask: ['痠痛部位與工作姿勢的關係？', '近期活動量或運動型態是否改變？'],
        medical: '疼痛持續超過數週、夜間痛醒或合併無力、麻木時，建議復健科或骨科評估。' },
      { id: 'stiff', label: '關節僵硬', organs: ['muscles'], mech: ['joint', 'tension'], nutrients: ['vitD', 'calcium'],
        ask: ['僵硬出現的時間（早晨、久坐後）與持續多久？', '是否有關節紅、腫、熱？'],
        medical: '晨間僵硬超過 30–60 分鐘或關節紅腫熱痛時，建議風濕免疫科評估。' },
    ],
  },
  {
    id: 'skin', label: '皮膚', icon: '🖐',
    symptoms: [
      { id: 'skin_dry', label: '乾燥', organs: ['skin'], mech: ['skinbarrier'], nutrients: ['water', 'fat', 'vitA'],
        ask: ['洗澡水溫與清潔用品的使用習慣？', '是否有規律保濕？'],
        medical: '乾燥合併龜裂、滲液或大範圍紅疹時，建議皮膚科評估。' },
      { id: 'skin_itch', label: '搔癢', organs: ['skin'], mech: ['skinbarrier', 'allergy'], nutrients: [],
        ask: ['搔癢部位是局部還是全身？是否有紅疹？', '是否接觸新的清潔用品、食物或藥物？'],
        medical: '全身性搔癢持續 2 週以上而無明顯皮疹時，建議就醫檢查。' },
      { id: 'bruise', label: '容易瘀青', organs: ['skin', 'vessels'], mech: ['hemostasis'], nutrients: ['vitC', 'vitK'],
        ask: ['是否服用抗凝血劑、阿斯匹靈、類固醇或魚油等補充品？', '是否合併牙齦出血或流鼻血？'],
        medical: '無明顯碰撞卻經常瘀青、瘀青範圍大或合併其他出血現象時，建議血液科或內科檢查。' },
      { id: 'wound', label: '傷口癒合緩慢', organs: ['skin', 'vessels', 'pancreas'], mech: ['wound', 'glucose'], nutrients: ['protein', 'vitC', 'zinc'],
        ask: ['傷口位置（特別是足部）與已經持續的時間？', '最近一次血糖檢查結果？'],
        medical: '傷口超過 2 週未見改善、足部傷口或傷口紅腫熱痛時，建議就醫，並檢查血糖。' },
    ],
  },
  {
    id: 'meta', label: '代謝', icon: '⚖️',
    symptoms: [
      { id: 'thirst', label: '經常口渴', organs: ['pancreas', 'kidneys'], mech: ['glucose', 'saliva'], nutrients: ['water', 'carbs'],
        ask: ['每日飲水量與含糖飲料攝取量？', '是否有糖尿病家族史？'],
        medical: '口渴合併頻尿或體重下降時，建議抽血檢查血糖。' },
      { id: 'polyuria', label: '頻尿', organs: ['kidneys', 'bladder', 'pancreas'], mech: ['glucose'], nutrients: ['water'],
        ask: ['白天與夜間各排尿幾次？每次尿量多還是少？', '是否合併解尿疼痛、急尿或血尿？'],
        medical: '頻尿合併口渴建議檢查血糖；合併解尿疼痛、血尿或發燒建議泌尿科或家醫科就診。' },
      { id: 'weight', label: '體重異常變化', organs: ['thyroid', 'pancreas', 'liver'], mech: ['energymetabolism', 'glucose'], nutrients: ['protein', 'carbs', 'fiber'],
        ask: ['半年內體重變化幾公斤？是增加還是減少？', '食慾、活動量與作息是否改變？'],
        medical: '非刻意的體重明顯變化建議至家醫科或新陳代謝科檢查（含血糖與甲狀腺功能）。',
        followups: [{ id: 'loss5', q: '是否為半年內非刻意下降超過原體重 5%？', ifYes: { level: 'prompt', text: '非預期體重下降超過 5% 建議儘速安排門診檢查。' } }] },
    ],
  },
];

export const SYMPTOM_MAP: Record<string, Symptom & { category: string }> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.symptoms.map((x) => [x.id, { ...x, category: c.label }])),
);
