import type { Evidence } from '../types';

/* ---------- 生理機制知識條目 ---------- */
export interface Mechanism {
  id: string;
  title: string;
  text: string;
  evidence: Evidence;
  refs: string[];
  /** 文獻中與此機制相關的生活因素 */
  lifestyle: string[];
}

export const MECHANISMS: Mechanism[] = [
  { id: 'tearfilm', title: '淚膜不穩定與眨眼減少', evidence: 'A', refs: ['dews'], lifestyle: ['screen', 'airPollution', 'lateNight'],
    text: '專注用眼時眨眼次數下降，淚液蒸發增加；空調、低濕度與空氣污染物可能使淚膜更不穩定，出現乾澀、異物感或暫時性模糊。' },
  { id: 'accommodation', title: '睫狀肌持續調節的負荷', evidence: 'C', refs: [], lifestyle: ['screen', 'lateNight'],
    text: '長時間近距離用眼需要睫狀肌持續收縮對焦，可能出現眼睛疲勞與暫時性視力模糊。持續性的視力模糊需要驗光或眼科檢查釐清。' },
  { id: 'allergy', title: '過敏性發炎反應', evidence: 'B', refs: ['who-aqg'], lifestyle: ['airPollution', 'envExposure', 'smoking'],
    text: '黏膜或皮膚接觸過敏原、刺激物後，肥大細胞釋放組織胺等物質，引起紅、癢、流鼻水或打噴嚏。空氣污染物可能加重呼吸道與眼表的刺激。' },
  { id: 'sleepdebt', title: '睡眠不足與生理時鐘失調', evidence: 'B', refs: ['lim', 'aasm'], lifestyle: ['lateNight', 'caffeine', 'screen'],
    text: '睡眠不足會影響注意力、反應速度與情緒調節；作息不固定會讓生理時鐘與實際作息錯位，白天容易疲倦、頭部脹痛。' },
  { id: 'stressans', title: '壓力與自律神經反應', evidence: 'B', refs: ['aha-sleep'], lifestyle: ['stress', 'lateNight', 'caffeine'],
    text: '壓力會活化交感神經與壓力荷爾蒙（如皮質醇），可能出現心跳加快、肌肉緊繃、腸胃蠕動改變與睡眠品質下降。' },
  { id: 'tension', title: '肌肉緊繃與姿勢負荷', evidence: 'C', refs: ['who-pa'], lifestyle: ['sedentary', 'lowExercise', 'stress'],
    text: '長時間固定姿勢使肩頸、下背等肌群持續出力，局部血流與代謝受影響，可能出現痠痛、僵硬或緊縮型的頭部不適。' },
  { id: 'hydration', title: '水分與血壓調節', evidence: 'C', refs: ['dri8'], lifestyle: ['irregularMeals', 'alcohol', 'caffeine'],
    text: '水分攝取不足、久站或突然改變姿勢時，血壓調節可能來不及因應而出現頭暈。反覆或合併其他症狀的頭暈需要醫療評估。' },
  { id: 'oralmucosa', title: '口腔黏膜屏障與修復', evidence: 'B', refs: ['ods'], lifestyle: ['stress', 'lateNight', 'irregularMeals'],
    text: '口腔黏膜更新快速，壓力、睡眠不足、局部咬傷或摩擦都可能與反覆嘴破有關。部分個案與鐵、葉酸或維生素 B12 的營養狀態相關，但需要抽血檢驗才能確認。' },
  { id: 'gingiva', title: '牙菌斑與牙齦發炎', evidence: 'A', refs: [], lifestyle: ['smoking', 'irregularMeals'],
    text: '牙齦出血最常見的原因是牙菌斑堆積引起的牙齦發炎。若合併全身多處容易出血或瘀青，則需要就醫檢查凝血相關問題。' },
  { id: 'saliva', title: '唾液分泌減少', evidence: 'B', refs: ['ada'], lifestyle: ['caffeine', 'alcohol', 'smoking'],
    text: '水分攝取不足、張口呼吸、部分藥物的副作用都可能造成口乾。若同時有明顯口渴與頻尿，需要考慮檢查血糖。' },
  { id: 'cardiacsupply', title: '心肌供氧與需求的平衡', evidence: 'A', refs: ['chestpain'], lifestyle: ['smoking', 'stress', 'lowExercise'],
    text: '胸悶、胸痛或活動時喘可能來自心臟、肺部、食道、肌肉骨骼或焦慮等多種來源，無法僅由症狀判斷。臨床指引建議胸部不適應由醫療人員評估，以排除心血管原因。' },
  { id: 'palpitation', title: '心跳節律與自律神經調節', evidence: 'B', refs: ['aha-sleep'], lifestyle: ['caffeine', 'stress', 'lateNight', 'alcohol'],
    text: '咖啡因、壓力、睡眠不足與酒精都可能讓人較容易感覺到心跳。心悸也可能與心律、甲狀腺功能或貧血有關，需要檢查才能區分。' },
  { id: 'fitness', title: '心肺適能下降', evidence: 'B', refs: ['who-pa'], lifestyle: ['sedentary', 'lowExercise', 'smoking'],
    text: '活動量長期不足時，心肺與肌肉利用氧氣的效率下降，相同活動強度下較容易感到喘。新出現或逐漸加重的喘需要先由醫師評估。' },
  { id: 'airwayirritation', title: '呼吸道刺激與發炎', evidence: 'A', refs: ['who-aqg'], lifestyle: ['airPollution', 'smoking', 'envExposure'],
    text: '懸浮微粒、菸、粉塵與化學氣體會刺激呼吸道黏膜，增加黏液分泌並誘發咳嗽。咳嗽超過 3 週建議就醫檢查。' },
  { id: 'gutmotility', title: '腸胃蠕動與腦腸軸', evidence: 'B', refs: ['dietguide'], lifestyle: ['irregularMeals', 'stress', 'sedentary', 'lowExercise'],
    text: '腸道蠕動受飲食內容（纖維、水分）、進食速度、活動量與壓力影響。腸道與大腦透過神經和荷爾蒙互相影響，壓力大時排便習慣與脹氣感可能改變。' },
  { id: 'reflux', title: '下食道括約肌與胃酸逆流', evidence: 'A', refs: ['acg-gerd'], lifestyle: ['irregularMeals', 'lateNight', 'alcohol', 'smoking'],
    text: '過飽、睡前進食、餐後平躺與腹壓增加時，胃內容物較容易逆流至食道。臨床指引建議調整進食時間、避免睡前 2–3 小時進食，並維持健康體重。' },
  { id: 'peripheralnerve', title: '周邊神經傳導與局部壓迫', evidence: 'B', refs: ['ada', 'ods'], lifestyle: ['sedentary', 'alcohol'],
    text: '姿勢壓迫可造成暫時性麻木。持續或對稱性的手腳麻木，可能與血糖長期偏高、維生素 B12 狀態、頸腰椎神經壓迫等多種原因有關，需要醫療評估。' },
  { id: 'joint', title: '關節與軟組織的活動負荷', evidence: 'C', refs: ['who-pa'], lifestyle: ['sedentary', 'lowExercise'],
    text: '關節長時間不活動後，關節液流動減少，可能出現短暫僵硬。晨間僵硬超過 30–60 分鐘或合併紅腫熱痛，建議就醫評估。' },
  { id: 'skinbarrier', title: '皮膚屏障與含水量', evidence: 'B', refs: [], lifestyle: ['envExposure', 'airPollution'],
    text: '角質層脂質減少或過度清潔會使皮膚水分散失增加，出現乾燥與搔癢。全身性搔癢若持續，也可能與內科狀況有關，需要就醫確認。' },
  { id: 'hemostasis', title: '微血管與凝血功能', evidence: 'C', refs: ['ods'], lifestyle: ['alcohol'],
    text: '容易瘀青可能與年齡、皮膚變薄、部分藥物（如抗凝血劑、阿斯匹靈、類固醇）或凝血功能有關，無法由症狀判斷原因，建議就醫並告知目前用藥。' },
  { id: 'wound', title: '傷口癒合與組織修復', evidence: 'B', refs: ['ada', 'ods'], lifestyle: ['smoking', 'irregularMeals'],
    text: '傷口癒合需要良好的血液循環、血糖控制與足夠的蛋白質和微量營養素。癒合明顯變慢時，建議就醫檢查血糖與循環狀況。' },
  { id: 'glucose', title: '血糖調節與胰島素敏感性', evidence: 'A', refs: ['ada', 'spiegel'], lifestyle: ['lateNight', 'sedentary', 'lowExercise', 'irregularMeals'],
    text: '血糖偏高時，腎臟會排出較多葡萄糖與水分，可能出現口渴與頻尿。是否有血糖異常必須以抽血（空腹血糖、糖化血色素等）確認，症狀本身不足以判斷。' },
  { id: 'energymetabolism', title: '能量代謝與內分泌調節', evidence: 'C', refs: ['ada'], lifestyle: ['irregularMeals', 'stress', 'lateNight'],
    text: '體重受飲食、活動量、睡眠、壓力與甲狀腺等內分泌功能影響。非刻意的體重明顯變化需要醫療評估，以找出原因。' },
];

/* ---------- 生活因素 ---------- */
export interface LifestyleFactor {
  id: string;
  label: string;
  group: '作息與壓力' | '飲食' | '活動' | '環境' | '其他';
  advice: { title: string; text: string; evidence: Evidence; refs: string[] };
}

export const LIFESTYLE: LifestyleFactor[] = [
  { id: 'lateNight', label: '經常熬夜／睡眠不足', group: '作息與壓力',
    advice: { title: '建立固定的睡眠時段', evidence: 'A', refs: ['aasm', 'aha-sleep'],
      text: '成人建議每晚規律睡眠 7 小時以上。可先固定起床時間，起床後接觸日光；睡前 1 小時調暗燈光、減少螢幕使用。' } },
  { id: 'stress', label: '壓力大／情緒緊繃', group: '作息與壓力',
    advice: { title: '安排可執行的壓力調適', evidence: 'C', refs: ['who-pa'],
      text: '規律運動、腹式呼吸、適度休息與社交支持有助於壓力調適。若情緒低落或焦慮持續影響生活，建議尋求身心科或心理專業協助。' } },
  { id: 'irregularMeals', label: '飲食不規律', group: '飲食',
    advice: { title: '規律用餐、食物多樣化', evidence: 'A', refs: ['dietguide'],
      text: '依《每日飲食指南》均衡攝取六大類食物，三餐盡量定時，以未精製全穀雜糧、足量蔬菜與優質蛋白質為基礎，避免長時間空腹後大量進食。' } },
  { id: 'caffeine', label: '咖啡因攝取較多', group: '飲食',
    advice: { title: '調整咖啡因的時間與份量', evidence: 'C', refs: ['aasm'],
      text: '咖啡因的作用可持續數小時，建議午後減量、睡前 6 小時避免攝取，並留意是否與心悸、睡眠或胃部不適有關。' } },
  { id: 'alcohol', label: '經常飲酒', group: '飲食',
    advice: { title: '減少飲酒', evidence: 'A', refs: ['dietguide'],
      text: '酒精會影響睡眠結構、肝臟代謝與胃食道逆流。建議減少飲酒頻率與份量；若難以自行減量，可尋求醫療協助。' } },
  { id: 'sedentary', label: '久坐', group: '活動',
    advice: { title: '中斷久坐', evidence: 'A', refs: ['who-pa'],
      text: 'WHO 建議減少靜態時間。可設定每 30–60 分鐘起身活動 2–3 分鐘，調整螢幕高度與座椅支撐。' } },
  { id: 'lowExercise', label: '運動不足', group: '活動',
    advice: { title: '逐步累積身體活動量', evidence: 'A', refs: ['who-pa'],
      text: 'WHO 建議成人每週至少 150–300 分鐘中等強度有氧活動，並有 2 天以上的肌力訓練。可由每天快走 10 分鐘開始逐步增加；有胸悶、胸痛或慢性病者，運動前請先諮詢醫師。' } },
  { id: 'screen', label: '長時間使用 3C／近距離用眼', group: '活動',
    advice: { title: '安排用眼休息', evidence: 'C', refs: ['dews'],
      text: '每用眼 20 分鐘，看 6 公尺外 20 秒；螢幕略低於視線、提醒自己完整眨眼，並注意環境濕度。' } },
  { id: 'airPollution', label: '空氣污染暴露', group: '環境',
    advice: { title: '依空氣品質調整活動', evidence: 'A', refs: ['who-aqg'],
      text: '留意空氣品質指標（AQI），品質不佳時減少戶外劇烈活動、外出配戴口罩，室內可使用空氣清淨設備並保持清潔。' } },
  { id: 'envExposure', label: '其他環境暴露（粉塵、化學品、二手菸等）', group: '環境',
    advice: { title: '降低環境刺激物暴露', evidence: 'B', refs: ['who-aqg'],
      text: '工作中接觸粉塵或化學品時，依規定使用防護具並保持通風；避免二手菸與三手菸環境。' } },
  { id: 'smoking', label: '吸菸／電子煙', group: '其他',
    advice: { title: '戒菸', evidence: 'C', refs: [],
      text: '吸菸與心血管、呼吸道及多種健康風險相關。可利用戒菸門診或免費戒菸專線 0800-636363 取得協助。' } },
];

/* ---------- 就醫警訊（問卷必問，可回答不清楚） ---------- */
export interface RedFlag {
  id: string;
  q: string;
  level: 'emergency' | 'prompt';
  action: string;
  refs: string[];
  organs: string[];
}

export const RED_FLAGS: RedFlag[] = [
  { id: 'rf_chest', level: 'emergency', refs: ['chestpain'], organs: ['heart'],
    q: '目前有急性胸痛或胸悶，或合併冒冷汗、噁心、疼痛延伸至手臂、下巴或背部？',
    action: '急性胸痛可能是心血管急症。請立即停止活動，撥打 119 或由他人陪同前往急診，不要自行開車。' },
  { id: 'rf_breath', level: 'emergency', refs: ['chestpain'], organs: ['lungs', 'heart'],
    q: '目前有嚴重呼吸困難，休息時也喘、無法完整說完一句話，或嘴唇發紫？',
    action: '嚴重呼吸困難需要緊急處理，請立即撥打 119 或前往急診。' },
  { id: 'rf_stroke', level: 'emergency', refs: ['stroke'], organs: ['brain'],
    q: '突然出現單側手腳無力或麻木、臉歪嘴斜、口齒不清？',
    action: '可能是腦中風徵兆。請記下發作時間，立即撥打 119 送醫，把握治療時間。' },
  { id: 'rf_vision', level: 'emergency', refs: ['stroke'], organs: ['eyes', 'brain'],
    q: '突然單眼或雙眼視力喪失、視野缺損，或突然出現複視？',
    action: '突發性視力喪失屬於急症，請立即前往急診或眼科急診。' },
  { id: 'rf_headache', level: 'emergency', refs: ['stroke'], organs: ['brain'],
    q: '突然發生劇烈頭痛（有生以來最嚴重），或頭痛合併發燒、頸部僵硬、意識改變？',
    action: '突發劇烈頭痛需要立即就醫，以排除腦血管或感染等急症。' },
  { id: 'rf_syncope', level: 'emergency', refs: ['chestpain'], organs: ['heart', 'brain'],
    q: '近期曾昏倒、短暫失去意識，或出現意識混亂？',
    action: '昏厥或意識改變需要儘速就醫評估；若正在發生，請撥打 119。' },
  { id: 'rf_bleed', level: 'prompt', refs: [], organs: ['stomach', 'intestines'],
    q: '曾解黑便、血便，或吐血、咳血？',
    action: '消化道或呼吸道出血需要儘速就醫檢查；出血量大或合併頭暈、心跳快時請前往急診。' },
  { id: 'rf_weight', level: 'prompt', refs: ['ada'], organs: ['thyroid', 'pancreas'],
    q: '半年內非刻意的體重下降超過原體重 5%？',
    action: '非預期的體重下降需要安排門診檢查（如家醫科或內科），以找出原因。' },
  { id: 'rf_fever', level: 'prompt', refs: [], organs: [],
    q: '持續發燒超過 3 天，或夜間盜汗持續數週？',
    action: '持續發燒或夜間盜汗建議儘速就醫評估。' },
];

/* ---------- 病史標籤 ---------- */
export const HISTORY_TAGS = ['高血壓', '糖尿病', '高血脂', '心臟病', '腦中風', '腎臟病', '肝臟疾病', '氣喘／慢性肺病', '甲狀腺疾病', '過敏體質', '懷孕或哺乳中', '服用抗凝血劑'];

export const AGE_RANGES = ['未滿 18 歲', '18–29 歲', '30–39 歲', '40–49 歲', '50–64 歲', '65 歲以上'];
export const SEX_OPTIONS = ['女性', '男性'];
export const ONSET_OPTIONS = ['一週內', '一個月內', '1–3 個月', '3–6 個月', '半年以上'];
export const DURATION_OPTIONS = ['數秒至數分鐘', '數小時', '一整天', '持續數天以上'];
export const FREQ_OPTIONS = ['偶爾（每月數次）', '每週數次', '幾乎每天', '持續存在'];
