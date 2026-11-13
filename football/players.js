/* 熱門球員中文譯名（台灣媒體常用譯法）。比對時忽略大小寫與重音符號；沒有收錄的球員保留 ESPN 原名。 */
const PLAYER_ZH_RAW = {
  /* 英超 */
  "Erling Haaland": "哈蘭德", "Phil Foden": "福登", "Rodri": "羅德里", "Bernardo Silva": "貝爾納多·席爾瓦",
  "Ruben Dias": "魯本·迪亞斯", "Josko Gvardiol": "格瓦迪奧爾", "Jeremy Doku": "多庫", "Omar Marmoush": "馬爾穆什",
  "Rayan Cherki": "謝爾基", "Tijjani Reijnders": "賴因德斯", "Gianluigi Donnarumma": "唐納魯瑪", "Nico O'Reilly": "奧萊利",
  "Mohamed Salah": "沙拉", "Virgil van Dijk": "范戴克", "Alisson Becker": "阿利松", "Alisson": "阿利松",
  "Florian Wirtz": "維爾茨", "Alexis Mac Allister": "麥卡利斯特", "Dominik Szoboszlai": "索博斯洛伊",
  "Ryan Gravenberch": "格拉芬貝赫", "Cody Gakpo": "加克波", "Alexander Isak": "伊薩克", "Hugo Ekitike": "埃基蒂克",
  "Ibrahima Konate": "科納特", "Federico Chiesa": "基耶薩", "Curtis Jones": "柯蒂斯·瓊斯", "Milos Kerkez": "凱爾克茲",
  "Jeremie Frimpong": "弗林蓬", "Conor Bradley": "布拉德利", "Rio Ngumoha": "恩古莫哈", "Trey Nyoni": "尼奧尼",
  "Bukayo Saka": "薩卡", "Martin Odegaard": "厄德高", "Declan Rice": "萊斯", "Kai Havertz": "哈維茨",
  "Gabriel Magalhaes": "加布里埃爾", "William Saliba": "薩利巴", "Viktor Gyokeres": "約克雷斯", "Eberechi Eze": "埃澤",
  "Noni Madueke": "馬杜埃凱", "Gabriel Martinelli": "馬丁內利", "David Raya": "拉亞", "Jurrien Timber": "廷伯",
  "Riccardo Calafiori": "卡拉菲奧里", "Myles Lewis-Skelly": "路易斯-斯凱利", "Mikel Merino": "梅里諾",
  "Leandro Trossard": "特羅薩德", "Martin Zubimendi": "蘇比門迪", "Ben White": "本·懷特", "Christian Norgaard": "諾爾高",
  "Cole Palmer": "帕爾默", "Enzo Fernandez": "恩佐·費南德斯", "Moises Caicedo": "凱塞多", "Reece James": "里斯·詹姆斯",
  "Joao Pedro": "若昂·佩德羅", "Pedro Neto": "內托", "Liam Delap": "德拉普", "Marc Cucurella": "庫庫雷利亞",
  "Robert Sanchez": "羅伯特·桑切斯", "Estevao": "埃斯特旺", "Levi Colwill": "科爾威爾", "Wesley Fofana": "福法納",
  "Bruno Fernandes": "布魯諾·費南德斯", "Bryan Mbeumo": "姆貝烏莫", "Matheus Cunha": "庫尼亞", "Benjamin Sesko": "謝什科",
  "Amad Diallo": "阿馬德", "Kobbie Mainoo": "梅努", "Lisandro Martinez": "利桑德羅·馬丁內斯", "Harry Maguire": "馬奎爾",
  "Casemiro": "卡塞米羅", "Diogo Dalot": "達洛特", "Mason Mount": "芒特", "Senne Lammens": "拉門斯",
  "Dominic Solanke": "索蘭克", "James Maddison": "麥迪遜", "Cristian Romero": "羅梅羅", "Micky van de Ven": "范德文",
  "Mohammed Kudus": "庫杜斯", "Xavi Simons": "哈維·西蒙斯", "Guglielmo Vicario": "維卡里奧", "Richarlison": "理查利森",
  "Pedro Porro": "波羅", "Joao Palhinha": "帕利尼亞", "Rodrigo Bentancur": "本坦庫爾",
  "Bruno Guimaraes": "吉馬良斯", "Anthony Gordon": "戈登", "Nick Woltemade": "沃爾特馬德", "Sandro Tonali": "托納利",
  "Harvey Barnes": "巴恩斯", "Nick Pope": "波普", "Joelinton": "喬林頓",
  "Ollie Watkins": "沃特金斯", "Emiliano Martinez": "埃米利亞諾·馬丁內斯", "Morgan Rogers": "羅傑斯", "Ezri Konsa": "孔薩",
  "Youri Tielemans": "蒂勒曼斯", "John McGinn": "麥金", "Amadou Onana": "奧納納",
  "Jarrod Bowen": "鮑文", "Yoane Wissa": "維薩", "Jean-Philippe Mateta": "馬特塔", "Chris Wood": "伍德",
  "Morgan Gibbs-White": "吉布斯-懷特", "Jack Grealish": "格里利什", "Antoine Semenyo": "塞門約", "Kaoru Mitoma": "三笘薰",
  "Takehiro Tomiyasu": "冨安健洋", "Wataru Endo": "遠藤航", "Daichi Kamada": "鎌田大地", "Dean Henderson": "亨德森",
  "Jordan Pickford": "皮克福德", "Dominic Calvert-Lewin": "卡爾弗特-勒溫", "Iliman Ndiaye": "恩迪亞耶",
  "Danny Welbeck": "維爾貝克", "Carlos Baleba": "巴萊巴", "Igor Thiago": "伊戈爾·蒂亞戈", "Kevin Schade": "沙德",
  /* 西甲 */
  "Kylian Mbappe": "姆巴佩", "Vinicius Junior": "維尼修斯", "Jude Bellingham": "貝林罕", "Federico Valverde": "巴爾維德",
  "Aurelien Tchouameni": "楚阿梅尼", "Thibaut Courtois": "庫爾圖瓦", "Rodrygo": "羅德里戈", "Eder Militao": "米利唐",
  "Antonio Rudiger": "呂迪格", "Trent Alexander-Arnold": "阿諾德", "Dean Huijsen": "海森", "Arda Guler": "居萊爾",
  "Franco Mastantuono": "馬斯坦托諾", "Alvaro Carreras": "卡雷拉斯", "Dani Carvajal": "卡瓦哈爾",
  "Eduardo Camavinga": "卡馬文加", "Brahim Diaz": "布拉欣", "Ferland Mendy": "門迪", "Dani Ceballos": "塞瓦略斯",
  "Lamine Yamal": "亞馬爾", "Robert Lewandowski": "萊萬多夫斯基", "Raphinha": "拉菲尼亞", "Pedri": "佩德里",
  "Gavi": "加維", "Frenkie de Jong": "德容", "Fermin Lopez": "費爾明·洛佩斯", "Ferran Torres": "費蘭·托雷斯",
  "Marcus Rashford": "拉什福德", "Jules Kounde": "孔德", "Pau Cubarsi": "庫巴西", "Alejandro Balde": "巴爾德",
  "Joan Garcia": "霍安·加西亞", "Marc-Andre ter Stegen": "特爾施特根", "Dani Olmo": "奧爾莫", "Ronald Araujo": "阿勞霍",
  "Andreas Christensen": "克里斯滕森", "Joao Cancelo": "坎塞洛", "Eric Garcia": "埃里克·加西亞", "Marc Casado": "卡薩多",
  "Julian Alvarez": "胡利安·阿爾瓦雷斯", "Antoine Griezmann": "格里茲曼", "Jan Oblak": "奧布拉克", "Koke": "科克",
  "Giuliano Simeone": "朱利亞諾·西蒙尼", "Alexander Sorloth": "瑟洛特", "Marcos Llorente": "略倫特",
  "Conor Gallagher": "加拉格爾", "Pablo Barrios": "巴里奧斯", "Robin Le Normand": "勒諾爾芒", "Jose Maria Gimenez": "希門尼斯",
  "Thiago Almada": "阿爾馬達", "Alex Baena": "巴埃納", "Marc Pubill": "普比爾", "Johnny Cardoso": "卡多索",
  "David Hancko": "漢茨科", "Clement Lenglet": "朗格萊", "Nahuel Molina": "莫利納", "Jan Oblak ": "奧布拉克",
  "Nico Williams": "尼可·威廉斯", "Inaki Williams": "伊尼亞基·威廉斯", "Oihan Sancet": "桑塞特", "Unai Simon": "烏奈·西蒙",
  "Mikel Oyarzabal": "奧亞薩巴爾", "Takefusa Kubo": "久保建英", "Isco": "伊斯科", "Ayoze Perez": "阿約塞·佩雷斯",
  "Gerard Moreno": "傑拉德·莫雷諾", "Iago Aspas": "阿斯帕斯", "Borja Iglesias": "博爾哈·伊格萊西亞斯",
  /* 義甲 */
  "Lautaro Martinez": "勞塔羅", "Marcus Thuram": "圖拉姆", "Nicolo Barella": "巴雷拉", "Hakan Calhanoglu": "恰爾汗奧盧",
  "Alessandro Bastoni": "巴斯托尼", "Yann Sommer": "索默", "Federico Dimarco": "迪馬爾科", "Denzel Dumfries": "鄧弗里斯",
  "Henrikh Mkhitaryan": "姆希塔良", "Ange-Yoan Bonny": "邦尼", "Francesco Pio Esposito": "埃斯波西托",
  "Dusan Vlahovic": "弗拉霍維奇", "Kenan Yildiz": "伊爾迪茲", "Gleison Bremer": "布雷默", "Jonathan David": "喬納森·大衛",
  "Lois Openda": "奧彭達", "Francisco Conceicao": "孔塞桑", "Manuel Locatelli": "洛卡特利", "Teun Koopmeiners": "庫普邁納斯",
  "Rafael Leao": "萊奧", "Christian Pulisic": "普利西奇", "Luka Modric": "莫德里奇", "Mike Maignan": "邁尼昂",
  "Adrien Rabiot": "拉比奧", "Youssouf Fofana": "優素福·福法納", "Santiago Gimenez": "聖地亞哥·希門尼斯",
  "Scott McTominay": "麥克托米奈", "Kevin De Bruyne": "德布勞內", "Romelu Lukaku": "盧卡庫", "Rasmus Hojlund": "霍伊倫",
  "Stanislav Lobotka": "洛博特卡", "Frank Anguissa": "安吉薩", "Alex Meret": "梅雷特", "Giovanni Di Lorenzo": "迪洛倫索",
  "Ademola Lookman": "盧克曼", "Paulo Dybala": "迪巴拉", "Mattia Zaccagni": "扎卡尼", "Moise Kean": "基恩",
  "Nico Paz": "尼科·帕斯", "Mateo Retegui": "雷特吉", "Artem Dovbyk": "多夫比克", "Lorenzo Pellegrini": "佩萊格里尼",
  "Riccardo Orsolini": "奧爾索利尼", "Charles De Ketelaere": "德凱特拉爾", "Gianluca Scamacca": "斯卡馬卡",
  /* 德甲 */
  "Harry Kane": "哈利·凱恩", "Jamal Musiala": "穆西亞拉", "Michael Olise": "奧利塞", "Joshua Kimmich": "基米希",
  "Manuel Neuer": "諾伊爾", "Luis Diaz": "路易斯·迪亞斯", "Serge Gnabry": "格納布里", "Dayot Upamecano": "于帕梅卡諾",
  "Kim Min-Jae": "金玟哉", "Min-Jae Kim": "金玟哉", "Leon Goretzka": "格雷茨卡", "Konrad Laimer": "萊默",
  "Alphonso Davies": "戴維斯", "Jonathan Tah": "塔", "Aleksandar Pavlovic": "帕夫洛維奇", "Hiroki Ito": "伊藤洋輝",
  "Serhou Guirassy": "吉拉西", "Karim Adeyemi": "阿德耶米", "Gregor Kobel": "科貝爾", "Julian Brandt": "布蘭特",
  "Nico Schlotterbeck": "施洛特貝克", "Patrik Schick": "希克", "Ritsu Doan": "堂安律", "Florian Neuhaus": "諾伊豪斯",
  "Xavi Simons ": "哈維·西蒙斯", "Christoph Baumgartner": "鮑姆加特納", "Deniz Undav": "溫達夫",
  /* 法甲 */
  "Ousmane Dembele": "登貝萊", "Khvicha Kvaratskhelia": "克瓦拉茨赫利亞", "Achraf Hakimi": "阿什拉夫·哈基米",
  "Vitinha": "維蒂尼亞", "Joao Neves": "若昂·內維斯", "Desire Doue": "杜埃", "Marquinhos": "馬基尼奧斯",
  "Nuno Mendes": "努諾·門德斯", "Bradley Barcola": "巴爾科拉", "Goncalo Ramos": "貢薩洛·拉莫斯", "Lucas Chevalier": "謝瓦利埃",
  "Fabian Ruiz": "法比安·魯伊斯", "Warren Zaire-Emery": "扎伊爾-埃梅里", "Willian Pacho": "帕喬", "Lee Kang-In": "李康仁",
  "Kang-In Lee": "李康仁", "Mason Greenwood": "格林伍德", "Pierre-Emerick Aubameyang": "奧巴梅揚", "Takumi Minamino": "南野拓實",
  "Jonathan David ": "喬納森·大衛", "Alexandre Lacazette": "拉卡澤特", "Hamed Traore": "特拉奧雷",
  /* 國家隊／其他 */
  "Hassan Al-Haydos": "哈桑·海多斯", "Akram Afif": "阿克拉姆·阿菲夫",
  "Alessandro Circati": "亞歷山德羅·奇爾卡蒂", "Aziz Behich": "阿齊茲·貝希奇",
  "Cristiano Ronaldo": "C羅", "Lionel Messi": "梅西", "Neymar": "內馬爾", "Son Heung-Min": "孫興慜", "Heung-Min Son": "孫興慜",
  "Hwang Hee-Chan": "黃喜燦", "Lee Jae-Sung": "李在城", "Hidemasa Morita": "守田英正", "Ayase Ueda": "上田綺世",
  "Zion Suzuki": "鈴木彩艷", "Junya Ito": "伊東純也", "Takumi Minamino ": "南野拓實", "Ko Itakura": "板倉滉",
  "N'Golo Kante": "坎特", "Olivier Giroud": "吉魯", "Mike Maignan ": "邁尼昂", "Michael Olise ": "奧利塞",
  "John Stones": "史東斯", "Marc Guehi": "格伊", "Jordan Henderson": "亨德森", "Ivan Perisic": "佩里西奇",
  "Mateo Kovacic": "科瓦契奇", "Andrej Kramaric": "克拉馬里奇", "Memphis Depay": "德佩", "Leroy Sane": "薩內",
  "Niclas Fullkrug": "菲爾克魯格", "Darwin Nunez": "努涅斯", "Ronald Araujo ": "阿勞霍", "Federico Valverde ": "巴爾維德",
  "Joao Felix": "若昂·菲利克斯", "Rafael Leao ": "萊奧", "Diogo Costa": "迪奧戈·科斯塔", "Ruben Neves": "魯本·內維斯",
  "Rasmus Hojlund ": "霍伊倫", "Christian Eriksen": "艾瑞克森", "Kasper Schmeichel": "舒梅切爾", "Martin Odegaard ": "厄德高",
  "Erling Haaland ": "哈蘭德", "Viktor Gyokeres ": "約克雷斯", "Dejan Kulusevski": "庫盧塞夫斯基", "Granit Xhaka": "扎卡",
  "Manuel Akanji": "阿坎吉", "Robert Lewandowski ": "萊萬多夫斯基", "Piotr Zielinski": "澤林斯基", "Kerem Akturkoglu": "阿克蒂爾科奧盧",
  "Arda Guler ": "居萊爾", "Hakan Calhanoglu ": "恰爾汗奧盧", "Vinicius Jr.": "維尼修斯", "Vinicius Jr": "維尼修斯"
};

function plainKey(name) {
  return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l").replace(/ı/g, "i").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

const PLAYER_ZH = {};
for (const [en, zh] of Object.entries(PLAYER_ZH_RAW)) PLAYER_ZH[plainKey(en)] = zh;

function playerZh(name) {
  if (!name) return name;
  return PLAYER_ZH[plainKey(name)] || name;
}
