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

// 用語データ（辞書）
const TERMS: Term[] = [
  // --- 切り方 ---
  { name: "みじん切り", yomi: "みじんぎり", category: "cut", desc: "食材を非常に細かく刻む切り方。玉ねぎやニンニク、生姜などでよく使われます。" },
  { name: "千切り", yomi: "せんぎり", category: "cut", desc: "食材を細長い線状に切る方法。キャベツや大根などで使います。" },
  { name: "短冊切り", yomi: "たんざくぎり", category: "cut", desc: "短冊（長方形の薄い板）のような形に切る方法。大根や人参の味噌汁の具によく使います。" },
  { name: "乱切り", yomi: "らんぎり", category: "cut", desc: "食材を回しながら不規則な形に切る方法。表面積が大きくなり、味が染み込みやすくなります。" },
  { name: "いちょう切り", yomi: "いちょうぎり", category: "cut", desc: "丸い食材を4等分（銀杏の葉の形）に切る方法。大根や人参で使います。" },
  { name: "半月切り", yomi: "はんげつぎり", category: "cut", desc: "丸い食材を半分（半月の形）に切る方法。" },
  { name: "輪切り", yomi: "わぎり", category: "cut", desc: "丸い食材を端から一定の厚さで円形に切る方法。" },
  { name: "くし形切り", yomi: "くしがたぎり", category: "cut", desc: "トマトや玉ねぎなどを、中心から放射状に切る方法（櫛の形）。" },
  { name: "ささがき", yomi: "ささがき", category: "cut", desc: "ゴボウなどを鉛筆を削るように薄く削ぎ切りにする方法。" },
  { name: "拍子木切り", yomi: "ひょうしぎぎり", category: "cut", desc: "拍子木（四角い棒状）のように切る方法。1cm角くらいの棒状にします。" },
  { name: "色紙切り", yomi: "しきしぎり", category: "cut", desc: "薄い正方形に切る方法。" },
  { name: "さいの目切り", yomi: "さいのめぎり", category: "cut", desc: "サイコロ状（1cm角程度）に切る方法。" },
  { name: "そぎ切り", yomi: "そぎぎり", category: "cut", desc: "包丁を寝かせて、厚みのある食材を薄く広く切る方法。肉や魚によく使います。" },

  // --- 加熱・調理法 ---
  { name: "ソテー", yomi: "そてー", category: "cook", desc: "肉や魚、野菜などを少量の油やバターで炒め焼きにすること（フランス語で「跳ぶ」の意味）。" },
  { name: "ポワレ", yomi: "ぽわれ", category: "cook", desc: "フライパンで表面をカリッと香ばしく焼き上げる調理法。魚料理でよく使われます。" },
  { name: "コンフィ", yomi: "こんふぃ", category: "cook", desc: "低温の油でじっくりと煮るように加熱し、保存性を高める調理法。" },
  { name: "湯通し", yomi: "ゆどおし", category: "cook", desc: "熱湯にサッとくぐらせること。臭みを取ったり、色を鮮やかにするために行います。" },
  { name: "油通し", yomi: "あぶらどおし", category: "cook", desc: "中華料理の手法で、低温の油にサッとくぐらせて火を通すこと。" },
  { name: "蒸し焼き", yomi: "むしやき", category: "cook", desc: "焼いている途中で蓋をして、蒸気を閉じ込めて火を通す方法。" },
  { name: "落とし蓋", yomi: "おとしぶた", category: "cook", desc: "煮物をする際、具材の上に直接乗せる蓋のこと。味が染みやすくなり、煮崩れを防ぎます。" },

  // --- 下処理・その他 ---
  { name: "板ずり", yomi: "いたずり", category: "prep", desc: "キュウリやフキなどに塩をまぶし、まな板の上で転がすこと。色が鮮やかになり、アクが抜けます。" },
  { name: "面取り", yomi: "めんとり", category: "prep", desc: "煮崩れを防ぐため、野菜の角を薄く削ぎ落とすこと。" },
  { name: "隠し包丁", yomi: "かくしぼうちょう", category: "prep", desc: "火の通りや味の染み込みを良くするため、食材の見えない部分に切り込みを入れること。" },
  { name: "霜降り", yomi: "しもふり", category: "prep", desc: "肉や魚に熱湯をかけ（または湯にくぐらせ）、表面が白くなったら冷水に取ること。臭み取りになります。" },
  { name: "塩揉み", yomi: "しおもみ", category: "prep", desc: "野菜に塩を振って揉むこと。水分を抜き、しんなりさせます。" },
  { name: "砂抜き", yomi: "すなぬき", category: "prep", desc: "アサリなどの貝類を塩水につけて、体内の砂を吐き出させること。" },
  { name: "背ワタを取る", yomi: "せわたをとる", category: "prep", desc: "エビの背中にある黒い筋（腸管）を取り除くこと。ジャリジャリした食感や臭みを防ぎます。" },
];

export default function CookingGlossary() {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'cut' | 'cook' | 'prep'>('all');

  // フィルタリング処理
  const filteredTerms = TERMS.filter(term => {
    const matchesSearch = term.name.includes(filter) || term.yomi.includes(filter);
    const matchesTab = activeTab === 'all' || term.category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-emerald-50 p-6 rounded-xl border-2 border-emerald-100 text-center">
        <h2 className="text-2xl font-bold text-emerald-800 mb-1">📚 料理用語じてん</h2>
        <p className="text-sm text-gray-500">わからない言葉はここでチェック！</p>
      </div>

      {/* 検索バー */}
      <div className="bg-white p-3 rounded-xl border shadow-sm">
        <input 
          type="text" 
          placeholder="用語を検索 (例: みじん切り)" 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full border p-2 rounded-lg text-black focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'}`}>すべて</button>
        <button onClick={() => setActiveTab('cut')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'cut' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>🔪 切り方</button>
        <button onClick={() => setActiveTab('cook')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'cook' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>🔥 調理法</button>
        <button onClick={() => setActiveTab('prep')} className={`px-4 py-2 rounded-full whitespace-nowrap font-bold transition ${activeTab === 'prep' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>💧 下処理</button>
      </div>

      {/* 用語リスト */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredTerms.map((term, index) => (
          <div key={index} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`text-xs px-2 py-1 rounded font-bold mr-2 ${
                  term.category === 'cut' ? 'bg-orange-100 text-orange-700' :
                  term.category === 'cook' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {term.category === 'cut' ? '切り方' : term.category === 'cook' ? '調理法' : '下処理'}
                </span>
                <h3 className="text-lg font-bold text-gray-800 inline-block">{term.name}</h3>
                <span className="text-xs text-gray-400 ml-1">({term.yomi})</span>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              {term.desc}
            </p>

            {/* YouTube検索ボタン */}
            <a 
              href={`https://www.youtube.com/results?search_query=${term.name}+やり方`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition"
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