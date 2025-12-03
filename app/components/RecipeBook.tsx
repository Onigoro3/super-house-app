// app/components/RecipeBook.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Recipe = { id: number; title: string; url: string; ingredients: string[]; steps: string[]; };
type StockItem = { id: number; name: string; quantity: string; status: 'ok' | 'buy'; category: string; };

// 強化版：言葉のゆらぎ変換リスト
const SYNONYM_MAP: Record<string, string[]> = {
  "卵": ["たまご", "玉子", "エッグ"],
  "たまご": ["卵", "玉子"],
  "鶏肉": ["とり肉", "鶏", "チキン", "鶏もも", "鶏むね", "ささみ", "手羽"],
  "鶏もも肉": ["鶏肉", "とり肉", "鶏もも"],
  "豚肉": ["ぶた肉", "豚", "ポーク", "豚バラ", "豚こま", "豚ロース"],
  "牛肉": ["ぎゅう肉", "牛", "ビーフ"],
  "挽き肉": ["ひき肉", "ミンチ", "合い挽き"],
  "玉ねぎ": ["たまねぎ", "タマネギ", "オニオン"],
  "人参": ["にんじん", "ニンジン"],
  "じゃがいも": ["ジャガイモ", "ポテト", "馬鈴薯"],
  "葱": ["ねぎ", "ネギ", "長ネギ", "万能ねぎ", "小ねぎ"],
  "生姜": ["しょうが", "ショウガ"],
  "大蒜": ["にんにく", "ニンニク", "ガーリック"],
  "醤油": ["しょうゆ", "ショウユ", "正油"],
  "しょうゆ": ["醤油", "正油"],
  "砂糖": ["さとう", "サトウ", "シュガー", "三温糖", "上白糖"],
  "塩": ["しお", "ソルト", "岩塩"],
  "胡椒": ["こしょう", "コショウ", "ペッパー"],
  "酒": ["料理酒", "日本酒"],
  "みりん": ["味醂", "本みりん"],
  "油": ["サラダ油", "キャノーラ油", "オリーブオイル", "ごま油", "米油"],
  "マヨネーズ": ["マヨ"],
  "ケチャップ": ["トマトケチャップ"],
  "コンソメ": ["固形コンソメ", "顆粒コンソメ"],
  "出汁": ["だし", "ダシ", "ほんだし", "かつおだし", "昆布だし"],
  "中華だし": ["鶏ガラスープ", "ウェイパー", "創味シャンタン"],
  "味噌": ["みそ"],
  "酢": ["お酢", "ビネガー"],
};

export default function RecipeBook() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, Record<number, boolean>>>({});
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const deleteRecipe = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    await supabase.from('recipes').delete().eq('id', id);
    fetchData();
  };

  const toggleCheck = (rid: number, idx: number) => {
    const next = { ...checkedItems, [rid]: { ...checkedItems[rid], [idx]: !checkedItems[rid]?.[idx] } };
    setCheckedItems(next);
    localStorage.setItem('recipe_checks', JSON.stringify(next));
  };

  const saveTitle = async (id: number) => {
    await supabase.from('recipes').update({ title: editTitleText }).eq('id', id);
    setRecipes(recipes.map(r => r.id === id ? { ...r, title: editTitleText } : r));
    setEditingTitleId(null);
  };

  // ★ 誤判定修正版：在庫照合ロジック
  const findStockMatch = (ingredientText: string) => {
    const normalize = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
    const target = normalize(ingredientText);

    return stockItems.find(stock => {
      if (stock.status !== 'ok') return false;

      const stockNameRaw = stock.name;
      const stockNameNorm = normalize(stockNameRaw);

      // A. 完全一致・包含チェック（基本）
      // 「醤油」の中に「油」が含まれていても、ここでは単純比較なのでOK
      if (stockNameNorm.length > 1 && target.includes(stockNameNorm)) return true;
      if (target.length > 1 && stockNameNorm.includes(target)) return true;

      // B. 辞書チェック（応用）
      // 「在庫名」が辞書にあるかチェック（例：在庫「サラダ油」）
      for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
        // 在庫名が、辞書の「キー」または「類語」と一致したら
        if (normalize(key) === stockNameNorm || synonyms.some(s => normalize(s) === stockNameNorm)) {
          
          // そのキー（代表名）がレシピに含まれているかチェック
          // 例：キー「油」が、レシピ「醤油」に含まれているか？ → 含まれている！
          if (target.includes(normalize(key))) {
             // ★ここが修正ポイント：誤判定の除外ルール
             // 「油」という文字を見つけても、それが「醤油」の一部なら無視する
             if (normalize(key) === '油' && (target.includes('醤油') || target.includes('しょうゆ') || target.includes('正油'))) {
               return false;
             }
             return true;
          }

          // 類語がレシピに含まれているかチェック
          if (synonyms.some(s => target.includes(normalize(s)))) return true;
        }
      }

      return false;
    });
  };

  const completeShopping = async (recipe: Recipe) => {
    const checks = checkedItems[recipe.id] || {};
    const indices = Object.keys(checks).filter(k => checks[Number(k)]).map(Number);
    if (indices.length === 0) return alert("購入したものにチェックを入れてください");
    if (!confirm(`${indices.length}個を在庫に追加しますか？`)) return;

    setIsProcessing(true);
    try {
      for (const idx of indices) {
        const raw = recipe.ingredients[idx];
        const match = raw.match(/^(.+?)\s*([0-9０-９].*)$/);
        const name = match ? match[1].trim() : raw;
        const qty = match ? match[2].trim() : '';

        const normalize = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
        const normName = normalize(name);
        
        const existing = stockItems.find(s => {
           const sName = normalize(s.name);
           return sName.includes(normName) || normName.includes(sName);
        });

        if (existing) {
          await supabase.from('items').update({ quantity: qty || existing.quantity, status: 'ok' }).eq('id', existing.id);
        } else {
          let category = 'food';
          if (name.includes('醤油') || name.includes('油') || name.includes('塩') || name.includes('ソース') || name.includes('だし') || name.includes('素')) category = 'seasoning';
          if (name.includes('ペーパー') || name.includes('洗剤')) category = 'other';

          await supabase.from('items').insert([{ name, quantity: qty, category, status: 'ok' }]);
        }
      }
      alert("在庫に追加しました！");
      const next = { ...checkedItems };
      delete next[recipe.id];
      setCheckedItems(next);
      localStorage.setItem('recipe_checks', JSON.stringify(next));
      fetchData();
    } catch (e) { alert("エラーが発生しました"); } finally { setIsProcessing(false); }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100 text-center">
        <h2 className="text-2xl font-bold text-indigo-800">📖 マイ・レシピ帳</h2>
        <p className="text-sm text-gray-500">在庫連動＆自動マッチング強化版</p>
      </div>

      <div className="space-y-4">
        {recipes.map((recipe) => {
          const isOpen = expandedId === recipe.id;
          const isEditing = editingTitleId === recipe.id;
          
          const ingredientsWithStock = recipe.ingredients.map((ing, i) => ({
            index: i, text: ing, stock: findStockMatch(ing)
          }));
          const toBuy = ingredientsWithStock.filter(i => !i.stock);
          const inStock = ingredientsWithStock.filter(i => i.stock);
          const checkedCount = Object.values(checkedItems[recipe.id] || {}).filter(Boolean).length;

          return (
            <div key={recipe.id} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
              <div className="w-full p-4 flex justify-between items-center border-b hover:bg-gray-50">
                <div className="flex-1 mr-2">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input value={editTitleText} onChange={e => setEditTitleText(e.target.value)} className="border p-1 w-full text-black" autoFocus />
                      <button onClick={() => saveTitle(recipe.id)} className="bg-blue-600 text-white px-3 rounded text-sm">保存</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className="text-left font-bold text-lg text-gray-800">{recipe.title}</button>
                      <button onClick={() => { setEditingTitleId(recipe.id); setEditTitleText(recipe.title); }} className="text-gray-400 hover:text-blue-500 text-sm">✏️</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className={`text-gray-400 text-2xl transition ${isOpen ? 'rotate-180' : ''}`}>▼</button>
              </div>

              {isOpen && (
                <div className="p-5 bg-gray-50 text-sm animate-fadeIn">
                  <div className="flex gap-2 mb-6">
                    <a href={recipe.url} target="_blank" className="flex-1 bg-red-600 text-white text-center py-2 rounded-lg font-bold">📺 動画を見る</a>
                    <button onClick={() => deleteRecipe(recipe.id)} className="px-3 bg-gray-200 text-gray-600 rounded-lg font-bold">🗑️</button>
                  </div>

                  {toBuy.length > 0 && (
                    <div className="mb-4 bg-white p-3 rounded-lg border-2 border-green-100 shadow-sm">
                      <h5 className="font-bold text-green-700 mb-2">🛒 買い物リスト</h5>
                      {toBuy.map((item) => (
                        <label key={item.index} className={`flex gap-3 p-2 rounded cursor-pointer ${checkedItems[recipe.id]?.[item.index] ? 'bg-green-50' : ''}`}>
                          <input type="checkbox" checked={!!checkedItems[recipe.id]?.[item.index]} onChange={() => toggleCheck(recipe.id, item.index)} className="w-5 h-5 accent-green-600" />
                          <span className="font-bold text-black">{item.text}</span>
                        </label>
                      ))}
                      {checkedCount > 0 && (
                        <button onClick={() => completeShopping(recipe)} disabled={isProcessing} className="w-full mt-3 bg-green-600 text-white py-2 rounded font-bold shadow">
                          {isProcessing ? '処理中...' : `🛍️ ${checkedCount}個を在庫に追加`}
                        </button>
                      )}
                    </div>
                  )}

                  {inStock.length > 0 && (
                    <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <h5 className="font-bold text-blue-700 mb-2">🏠 在庫にありそう</h5>
                      {inStock.map((item) => (
                        <div key={item.index} className="flex justify-between p-2 bg-white rounded border border-blue-100 mb-1">
                          <span className="font-bold text-gray-700">{item.text}</span>
                          <div className="text-right">
                            <span className="block font-bold text-blue-600">{item.stock?.quantity}</span>
                            <span className="text-xs text-gray-400">({item.stock?.name})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <h5 className="font-bold text-orange-600 border-l-4 border-orange-500 pl-2 mb-2">🔥 作り方</h5>
                    <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                      {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}