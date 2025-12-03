// app/components/RecipeBook.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 辞書（省略せず記載）
const SYNONYM_MAP: Record<string, string[]> = {
  "卵": ["たまご", "玉子", "エッグ"], "たまご": ["卵", "玉子"],
  "鶏肉": ["とり肉", "鶏", "チキン", "鶏もも", "鶏むね", "ささみ"], "鶏もも肉": ["鶏肉", "とり肉", "鶏もも"],
  "豚肉": ["ぶた肉", "豚", "ポーク", "豚バラ", "豚こま", "豚ロース"], "牛肉": ["ぎゅう肉", "牛", "ビーフ"],
  "挽き肉": ["ひき肉", "ミンチ", "合い挽き"], "玉ねぎ": ["たまねぎ", "タマネギ", "オニオン"],
  "人参": ["にんじん", "ニンジン"], "じゃがいも": ["ジャガイモ", "ポテト"], "葱": ["ねぎ", "ネギ", "長ネギ", "万能ねぎ"],
  "生姜": ["しょうが", "ショウガ"], "大蒜": ["にんにく", "ニンニク", "ガーリック"], "醤油": ["しょうゆ", "ショウユ", "正油"],
  "しょうゆ": ["醤油", "正油"], "砂糖": ["さとう", "シュガー"], "塩": ["しお", "ソルト"], "胡椒": ["こしょう", "ペッパー"],
  "酒": ["料理酒", "日本酒"], "みりん": ["味醂"], "油": ["サラダ油", "キャノーラ油", "オリーブオイル", "ごま油"],
  "マヨネーズ": ["マヨ"], "ケチャップ": ["トマトケチャップ"], "コンソメ": ["固形コンソメ", "顆粒コンソメ"],
  "出汁": ["だし", "ダシ", "ほんだし"], "中華だし": ["鶏ガラスープ", "ウェイパー", "創味シャンタン"],
};

type Recipe = { id: number; title: string; channel_name: string; url: string; ingredients: string[]; steps: string[]; };
type StockItem = { id: number; name: string; quantity: string; status: 'ok' | 'buy'; category: string; };

export default function RecipeBook() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<number, Record<number, boolean>>>({});
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ★追加：フォルダの開閉状態
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  // ★追加：レシピ詳細の開閉状態（IDで管理）
  const [openRecipeId, setOpenRecipeId] = useState<number | null>(null);

  const fetchData = async () => {
    const { data: r } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    const { data: s } = await supabase.from('items').select('*');
    if (r) setRecipes(r);
    if (s) setStockItems(s);
  };

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('recipe_checks');
    if (saved) setCheckedItems(JSON.parse(saved));
  }, []);

  // チャンネルごとにグループ化する関数
  const groupedRecipes = recipes.reduce((acc, recipe) => {
    const channel = recipe.channel_name || 'その他';
    if (!acc[channel]) acc[channel] = [];
    acc[channel].push(recipe);
    return acc;
  }, {} as Record<string, Recipe[]>);

  const toggleFolder = (channel: string) => {
    setOpenFolders(prev => ({ ...prev, [channel]: !prev[channel] }));
  };

  // 以下、既存ロジック（削除、チェック、保存、照合、買い物完了）
  const deleteRecipe = async (id: number) => { if (!confirm('削除しますか？')) return; await supabase.from('recipes').delete().eq('id', id); fetchData(); };
  const toggleCheck = (rid: number, idx: number) => { const next = { ...checkedItems, [rid]: { ...checkedItems[rid], [idx]: !checkedItems[rid]?.[idx] } }; setCheckedItems(next); localStorage.setItem('recipe_checks', JSON.stringify(next)); };
  const saveTitle = async (id: number) => { await supabase.from('recipes').update({ title: editTitleText }).eq('id', id); setRecipes(recipes.map(r => r.id === id ? { ...r, title: editTitleText } : r)); setEditingTitleId(null); };
  const findStockMatch = (ingredientText: string) => {
    const normalize = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
    const target = normalize(ingredientText);
    return stockItems.find(stock => {
      if (stock.status !== 'ok') return false;
      const stockNameNorm = normalize(stock.name);
      if (stockNameNorm.length > 1 && target.includes(stockNameNorm)) return true;
      if (target.length > 1 && stockNameNorm.includes(target)) return true;
      for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
        if (normalize(key) === stockNameNorm || synonyms.some(s => normalize(s) === stockNameNorm)) {
          if (target.includes(normalize(key))) { if (normalize(key) === '油' && (target.includes('醤油') || target.includes('しょうゆ') || target.includes('正油'))) return false; return true; }
          if (synonyms.some(s => target.includes(normalize(s)))) return true;
        }
      }
      return false;
    });
  };
  const completeShopping = async (recipe: Recipe) => { /* 省略（以前と同じ）*/ 
    const checks = checkedItems[recipe.id] || {}; const indices = Object.keys(checks).filter(k => checks[Number(k)]).map(Number);
    if (indices.length === 0) return alert("購入したものにチェックを！"); if (!confirm(`${indices.length}個を在庫に追加しますか？`)) return;
    setIsProcessing(true);
    try {
      for (const idx of indices) {
        const raw = recipe.ingredients[idx]; const match = raw.match(/^(.+?)\s*([0-9０-９].*)$/);
        const name = match ? match[1].trim() : raw; const qty = match ? match[2].trim() : '';
        const normName = name.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
        const existing = stockItems.find(s => { const sName = s.name.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, ''); return sName.includes(normName) || normName.includes(sName); });
        if (existing) { await supabase.from('items').update({ quantity: qty || existing.quantity, status: 'ok' }).eq('id', existing.id); } 
        else { let category = 'food'; if (name.includes('醤油')||name.includes('油')||name.includes('塩')) category='seasoning'; if(name.includes('洗剤')) category='other'; await supabase.from('items').insert([{ name, quantity: qty, category, status: 'ok' }]); }
      }
      alert("在庫に追加しました！"); const next = { ...checkedItems }; delete next[recipe.id]; setCheckedItems(next); localStorage.setItem('recipe_checks', JSON.stringify(next)); fetchData();
    } catch (e) { alert("エラー"); } finally { setIsProcessing(false); }
  };

  return (
    <div className="p-4 space-y-8 pb-24">
      <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100 text-center">
        <h2 className="text-2xl font-bold text-indigo-800">📖 マイ・レシピ帳</h2>
        <p className="text-sm text-gray-500">チャンネルごとに整理されています</p>
      </div>

      <div className="space-y-6">
        {recipes.length === 0 && <p className="text-center text-gray-400">レシピがありません</p>}
        
        {/* チャンネルごとのループ */}
        {Object.entries(groupedRecipes).map(([channel, channelRecipes]) => (
          <div key={channel} className="border rounded-2xl overflow-hidden shadow-sm bg-white">
            {/* チャンネルヘッダー（クリックで開閉） */}
            <button 
              onClick={() => toggleFolder(channel)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📺</span>
                <h3 className="font-bold text-lg text-gray-800">{channel}</h3>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">{channelRecipes.length}</span>
              </div>
              <span className={`text-2xl text-gray-400 transition-transform ${openFolders[channel] ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* レシピリスト（グリッド表示） */}
            {openFolders[channel] && (
              <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
                {channelRecipes.map((recipe) => {
                  const isOpen = openRecipeId === recipe.id;
                  const ingredientsWithStock = recipe.ingredients.map((ing, i) => ({ index: i, text: ing, stock: findStockMatch(ing) }));
                  const toBuy = ingredientsWithStock.filter(i => !i.stock);
                  const checkedCount = Object.values(checkedItems[recipe.id] || {}).filter(Boolean).length;

                  return (
                    <div key={recipe.id} className={`border rounded-xl transition-all duration-300 ${isOpen ? 'col-span-1 md:col-span-2 lg:col-span-3 shadow-lg ring-2 ring-indigo-100' : 'hover:shadow-md'}`}>
                      {/* レシピタイトル */}
                      <div className="p-4 flex justify-between items-start cursor-pointer" onClick={() => setOpenRecipeId(isOpen ? null : recipe.id)}>
                        <h4 className="font-bold text-gray-800 flex-1">{recipe.title}</h4>
                        <span className="text-gray-400 text-xl ml-2">{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* 詳細エリア */}
                      {isOpen && (
                        <div className="p-4 border-t bg-gray-50 text-sm">
                          <div className="flex gap-2 mb-4">
                            <a href={recipe.url} target="_blank" className="flex-1 bg-red-600 text-white text-center py-2 rounded font-bold hover:bg-red-700">📺 動画</a>
                            <button onClick={() => deleteRecipe(recipe.id)} className="px-3 bg-gray-200 rounded font-bold">🗑️</button>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* 買い物リスト */}
                            <div className="bg-white p-3 rounded border border-green-200">
                              <h5 className="font-bold text-green-700 mb-2">🛒 買い物リスト</h5>
                              {toBuy.length === 0 ? <p className="text-xs text-gray-400">すべて在庫にあります！</p> : toBuy.map((item) => (
                                <label key={item.index} className={`flex gap-2 p-1 cursor-pointer ${checkedItems[recipe.id]?.[item.index] ? 'opacity-50 line-through' : ''}`}>
                                  <input type="checkbox" checked={!!checkedItems[recipe.id]?.[item.index]} onChange={() => toggleCheck(recipe.id, item.index)} className="accent-green-600" />
                                  <span>{item.text}</span>
                                </label>
                              ))}
                              {checkedCount > 0 && <button onClick={() => completeShopping(recipe)} disabled={isProcessing} className="w-full mt-2 bg-green-600 text-white py-1 rounded text-xs font-bold">{isProcessing ? '...' : '在庫に追加'}</button>}
                            </div>
                            
                            {/* 作り方 */}
                            <div>
                              <h5 className="font-bold text-orange-600 mb-2">🔥 作り方</h5>
                              <ol className="list-decimal pl-5 space-y-1 text-gray-700">{recipe.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}