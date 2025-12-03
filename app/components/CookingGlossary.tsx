// app/components/CookingGlossary.tsx
'use client';
import { useState } from 'react';

// 用語データの型
type Term = {
  name: string;
  yomi: string;
  category: 'cut' | 'cook' | 'prep';
  desc: string;
};

// ★大幅増量した用語データ
const TERMS: Term[] = [
  // ====================
  // 🔪 切り方 (Cutting)
  // ====================
  { name: "みじん切り", yomi: "みじんぎり", category: "cut", desc: "食材を非常に細かく刻む切り方。玉ねぎ、ニンニク、生姜などで使い、香味野菜の香り出しやハンバーグの具にします。" },
  { name: "千切り", yomi: "せんぎり", category: "cut", desc: "食材を細長い線状に切る方法。キャベツの千切りや、大根（刺身のツマ）などが代表的。" },
  { name: "短冊切り", yomi: "たんざくぎり", category: "cut", desc: "短冊（長方形の薄い板）のような形に切る方法。大根や人参の味噌汁の具、炒め物によく使います。" },
  { name: "乱切り", yomi: "らんぎり", category: "cut", desc: "食材を回しながら不規則な形に切る方法。切断面が多くなるため、味が染み込みやすくなります（カレーや煮物）。" },
  { name: "いちょう切り", yomi: "いちょうぎり", category: "cut", desc: "丸い食材を4等分（銀杏の葉の形）に切る方法。大根や人参で使い、豚汁などでよく見られます。" },
  { name: "半月切り", yomi: "はんげつぎり", category: "cut", desc: "丸い食材を半分（半月の形）に切る方法。いちょう切りより少し大きめにしたい時に。" },
  { name: "輪切り", yomi: "わぎり", category: "cut", desc: "丸い食材を端から一定の厚さで円形に切る方法。レモンやキュウリ、大根などで使います。" },
  { name: "くし形切り", yomi: "くしがたぎり", category: "cut", desc: "トマトや玉ねぎ、レモンなどを、中心から放射状に切る方法（髪をとかす櫛の形）。" },
  { name: "ささがき", yomi: "ささがき", category: "cut", desc: "ゴボウなどを鉛筆を削るように薄く削ぎ切りにする方法。味染みが良くなり、食感も良くなります。" },
  { name: "拍子木切り", yomi: "ひょうしぎぎり", category: "cut", desc: "拍子木（四角い棒状）のように切る方法。1cm角くらいの棒状にします。野菜スティックなど。" },
  { name: "色紙切り", yomi: "しきしぎり", category: "cut", desc: "薄い正方形に切る方法。スープの浮き身や酢の物などで使います。" },
  { name: "さいの目切り", yomi: "さいのめぎり", category: "cut", desc: "サイコロ状（1cm角程度）に切る方法。色紙切りより厚みがあります。ミックスベジタブルの形です。" },
  { name: "あられ切り", yomi: "あられぎり", category: "cut", desc: "さいの目切りよりもさらに小さく、5mm角程度に切る方法。お茶漬けの具などに。" },
  { name: "そぎ切り", yomi: "そぎぎり", category: "cut", desc: "包丁を寝かせて、厚みのある食材を薄く広く切る方法。鶏むね肉や白菜の芯などで使い、火の通りを早くします。" },
  { name: "小口切り", yomi: "こぐちぎり", category: "cut", desc: "ネギやキュウリなどの細長い食材を、端から薄く輪切りにしていくこと。" },
  { name: "ざく切り", yomi: "ざくぎり", category: "cut", desc: "キャベツや青菜などを、3〜4cm幅くらいの大きさに大まかに切ること。" },
  { name: "ぶつ切り", yomi: "ぶつぎり", category: "cut", desc: "ネギや肉などを、3〜4cmの長さに大きく切ること。形にはこだわらず大胆に切る場合に使います。" },
  { name: "斜め切り", yomi: "ななめぎり", category: "cut", desc: "ネギやキュウリなどを斜めに切ること。断面積が広くなり、火が通りやすくなります。" },
  { name: "桂むき", yomi: "かつらむき", category: "cut", desc: "大根や人参を、トイレットペーパーのように薄く長く帯状にむいていく高度な技術。" },
  { name: "蛇腹切り", yomi: "じゃばらぎり", category: "cut", desc: "キュウリなどに細かい切り込みを入れ、蛇腹（アコーディオン）のように曲がるようにすること。酢の物で味が染みやすくなります。" },
  { name: "飾り切り", yomi: "かざりぎり", category: "cut", desc: "人参を花の形にしたり、ウインナーをタコにするなど、見た目を華やかにする切り方の総称。" },
  { name: "シャトー切り", yomi: "しゃとーぎり", category: "cut", desc: "人参やジャガイモをラグビーボール状に切る付け合わせ用の切り方。煮崩れを防ぐ効果もあります。" },

  // ====================
  // 🔥 加熱・調理法 (Cooking)
  // ====================
  { name: "ソテー", yomi: "そてー", category: "cook", desc: "肉や魚、野菜などを少量の油やバターで炒め焼きにすること（フランス語で「跳ぶ」の意味）。" },
  { name: "ポワレ", yomi: "ぽわれ", category: "cook", desc: "フライパンで表面をカリッと香ばしく、中はふっくらと焼き上げる調理法。魚料理でよく使われます。" },
  { name: "コンフィ", yomi: "こんふぃ", category: "cook", desc: "低温の油でじっくりと煮るように加熱し、保存性を高める調理法。鶏肉や砂肝などが有名。" },
  { name: "煮詰める", yomi: "につめる", category: "cook", desc: "煮汁の水分を飛ばして、味を濃厚にすること。「煮詰まる」は失敗、「煮詰める」は仕上げの工程です。" },
  { name: "煮含める", yomi: "にふくめる", category: "cook", desc: "たっぷりの煮汁で煮て、食材に味をたっぷり吸わせること。高野豆腐やがんもどきなど。" },
  { name: "炒め煮", yomi: "いために", category: "cook", desc: "一度油で炒めてから、調味料や出汁を加えて煮ること。キンピラや筑前煮など。" },
  { name: "湯通し", yomi: "ゆどおし", category: "cook", desc: "熱湯にサッとくぐらせること。臭みを取ったり、色を鮮やかにするために行います。" },
  { name: "油通し", yomi: "あぶらどおし", category: "cook", desc: "中華料理の手法で、低温の油にサッとくぐらせて表面を固め、旨味を閉じ込めること。" },
  { name: "蒸し焼き", yomi: "むしやき", category: "cook", desc: "焼いている途中で蓋をして、蒸気を閉じ込めて火を通す方法。餃子や厚い肉などで使います。" },
  { name: "落とし蓋", yomi: "おとしぶた", category: "cook", desc: "煮物をする際、具材の上に直接乗せる蓋のこと。少ない煮汁でも味が回り、煮崩れを防ぎます。" },
  { name: "フランベ", yomi: "ふらんべ", category: "cook", desc: "調理の仕上げにアルコール度数の高いお酒を入れ、一気に炎を上げてアルコール分を飛ばし、香りをつけること。" },
  { name: "乳化", yomi: "にゅうか", category: "cook", desc: "本来混ざり合わない「水分」と「油分」を混ぜ合わせてとろみを出すこと。パスタソースやドレッシングで重要です。" },
  { name: "キャラメリゼ", yomi: "きゃらめりぜ", category: "cook", desc: "砂糖を加熱してカラメル状（焦がし砂糖）にすること。または食材の糖分で香ばしい焼き色をつけること。" },
  { name: "ブランチング", yomi: "ぶらんちんぐ", category: "cook", desc: "野菜などを冷凍する前に、短時間茹でたり蒸したりして酵素の働きを止めること。" },
  { name: "二度揚げ", yomi: "にどあげ", category: "cook", desc: "一度低温で揚げて中まで火を通し、少し休ませてから高温で再度揚げてカリッとさせること。唐揚げやポテトで有効。" },

  // ====================
  // 💧 下処理・その他 (Prep)
  // ====================
  { name: "板ずり", yomi: "いたずり", category: "prep", desc: "キュウリやフキなどに塩をまぶし、まな板の上でゴロゴロ転がすこと。色が鮮やかになり、表面が滑らかになります。" },
  { name: "面取り", yomi: "めんとり", category: "prep", desc: "大根やカボチャなどの角を薄く削ぎ落とすこと。煮ている間に角同士がぶつかって煮崩れるのを防ぎます。" },
  { name: "隠し包丁", yomi: "かくしぼうちょう", category: "prep", desc: "火の通りや味の染み込みを良くするため、食材の裏側など見えない部分に切り込みを入れること（こんにゃくやナスなど）。" },
  { name: "霜降り", yomi: "しもふり", category: "prep", desc: "肉や魚に熱湯をかけ（または湯にくぐらせ）、表面が白くなったら冷水に取ること。臭みやぬめり取りになります。" },
  { name: "塩揉み", yomi: "しおもみ", category: "prep", desc: "野菜に塩を振って揉むこと。水分を抜いてしんなりさせたり、きゅうりの食感を良くします。" },
  { name: "砂抜き", yomi: "すなぬき", category: "prep", desc: "アサリなどの貝類を塩水につけて、体内の砂を吐き出させること。" },
  { name: "背ワタを取る", yomi: "せわたをとる", category: "prep", desc: "エビの背中にある黒い筋（腸管）を取り除くこと。ジャリジャリした食感や臭みを防ぎます。" },
  { name: "筋切り", yomi: "すじきり", category: "prep", desc: "肉の赤身と脂身の間にある筋に包丁で切れ目を入れること。焼いた時に肉が縮んで反り返るのを防ぎます。" },
  { name: "三枚おろし", yomi: "さんまいおろし", category: "prep", desc: "魚をさばく基本。上身（背＋腹）、中骨、下身（背＋腹）の3つのパーツに切り分けること。" },
  { name: "湯引き", yomi: "ゆびき", category: "prep", desc: "刺身などの皮に熱湯をかけ、すぐに冷水で冷やすこと。皮と身の間の旨味を引き出し、皮を食べやすくします（鯛など）。" },
  { name: "アク抜き", yomi: "あくぬき", category: "prep", desc: "野菜のエグみや渋みを取り除くこと。水にさらす（ナス）、酢水にさらす（レンコン）、茹でる（ほうれん草）など。" },
  { name: "ピケ", yomi: "ぴけ", category: "prep", desc: "ブロック肉に切り込みを入れ、ニンニクや香草などを差し込んで風味をつけること。" },
  { name: "マリネ", yomi: "まりね", category: "prep", desc: "肉や魚、野菜を、酢・油・香草などを混ぜた漬け汁（マリネ液）に漬け込むこと。" },
  { name: "天地返し", yomi: "てんちがえし", category: "prep", desc: "炒め物や、お好み焼き、または漬物などで、下にあるものと上にあるものをひっくり返して入れ替えること。" },
  { name: "差し水", yomi: "さしみず", category: "prep", desc: "麺類や豆を茹でている時、吹きこぼれそうになったら少量の冷水を加えること。「びっくり水」とも言います。" },
];

export default function CookingGlossary() {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'cut' | 'cook' | 'prep'>('all');

  const filteredTerms = TERMS.filter(term => {
    const matchesSearch = term.name.includes(filter) || term.yomi.includes(filter);
    const matchesTab = activeTab === 'all' || term.category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-emerald-50 p-6 rounded-xl border-2 border-emerald-100 text-center">
        <h2 className="text-2xl font-bold text-emerald-800 mb-1">📚 料理用語じてん</h2>
        <p className="text-sm text-gray-500">収録数: {TERMS.length}語</p>
      </div>

      <div className="bg-white p-3 rounded-xl border shadow-sm sticky top-0 z-10">
        <input 
          type="text" 
          placeholder="用語を検索 (例: みじん切り)" 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full border p-2 rounded-lg text-black focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'}`}>すべて</button>
        <button onClick={() => setActiveTab('cut')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'cut' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>🔪 切り方</button>
        <button onClick={() => setActiveTab('cook')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'cook' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>🔥 調理法</button>
        <button onClick={() => setActiveTab('prep')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'prep' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>💧 下処理</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTerms.map((term, index) => (
          <div key={index} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold mr-2 inline-block mb-1 ${
                  term.category === 'cut' ? 'bg-orange-100 text-orange-700' :
                  term.category === 'cook' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {term.category === 'cut' ? '切り方' : term.category === 'cook' ? '調理法' : '下処理'}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 inline-block mr-2">{term.name}</h3>
                  <span className="text-xs text-gray-400">{term.yomi}</span>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4 leading-relaxed flex-1">
              {term.desc}
            </p>

            <a 
              href={`https://www.youtube.com/results?search_query=${term.name}+やり方+料理`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-50 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition border border-gray-200"
            >
              📺 YouTubeでやり方を見る
            </a>
          </div>
        ))}
        
        {filteredTerms.length === 0 && (
          <p className="text-center text-gray-400 col-span-full py-8">見つかりませんでした</p>
        )}
      </div>
    </div>
  );
}