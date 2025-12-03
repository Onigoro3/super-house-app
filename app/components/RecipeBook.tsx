// app/components/RecipeBook.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Recipe = {
  id: number;
  title: string;
  url: string;
  ingredients: string[];
  steps: string[];
};

type StockItem = {
  id: number;
  name: string;
  quantity: string;
  status: 'ok' | 'buy';
};

export default function RecipeBook() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  // 買い物チェック状態 { レシピID: { 材料インデックス: true/false } }
  const [checkedItems, setCheckedItems] = useState<Record<number, Record<number, boolean>>>({});

  // 編集用
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // 処理中フラグ
  const [isProcessing, setIsProcessing] = useState(false);

  // データ読み込み
  const fetchData = async () => {
    const { data: recipesData } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    const { data: stockData } = await supabase.from('items').select('*');
    
    if (recipesData) setRecipes(recipesData);
    if (stockData) setStockItems(stockData);
  };

  useEffect(() => {
    fetchData();
    const savedChecks = localStorage.getItem('recipe_checks');
    if (savedChecks) setCheckedItems(JSON.parse(savedChecks));
  }, []);

  // 削除機能
  const deleteRecipe = async (id: number) => {
    if (!confirm('本当に削除しますか？')) return;
    await supabase.from('recipes').delete().eq('id', id);
    fetchData();
  };

  // チェックボックス操作
  const toggleCheck = (recipeId: number, index: number) => {
    const newChecks = { ...checkedItems };
    if (!newChecks[recipeId]) newChecks[recipeId] = {};
    newChecks[recipeId][index] = !newChecks[recipeId][index];
    setCheckedItems(newChecks);
    localStorage.setItem('recipe_checks', JSON.stringify(newChecks));
  };

  // タイトル編集
  const startEditingTitle = (recipe: Recipe) => {
    setEditingTitleId(recipe.id);
    setEditTitleText(recipe.title);
  };
  const saveTitle = async (id: number) => {
    await supabase.from('recipes').update({ title: editTitleText }).eq('id', id);
    setRecipes(recipes.map(r => r.id === id ? { ...r, title: editTitleText } : r));
    setEditingTitleId(null);
  };

  // 在庫照合
  const findStockMatch = (ingredientText: string) => {
    return stockItems.find(stock => 
      stock.status === 'ok' && ingredientText.includes(stock.name)
    );
  };

  // ★ 循環システム：買い物完了処理 ★
  const completeShopping = async (recipe: Recipe) => {
    // このレシピでチェックがついている項目を探す
    const checks = checkedItems[recipe.id] || {};
    const checkedIndices = Object.keys(checks).filter(k => checks[Number(k)]).map(Number);

    if (checkedIndices.length === 0) {
      alert("購入したものにチェックを入れてください");
      return;
    }

    if (!confirm(`${checkedIndices.length}個の食材を在庫に追加しますか？`)) return;

    setIsProcessing(true);

    try {
      for (const index of checkedIndices) {
        const rawText = recipe.ingredients[index];
        
        // テキスト解析（簡易版）: "品名 分量" を想定して分離を試みる
        // 例: "鶏もも肉 300g" -> name="鶏もも肉", quantity="300g"
        // スペースまたは数字の境界で分けるロジック
        let name = rawText;
        let quantity = '';

        // 正規表現で「文字」と「数字以降」に分けてみる
        const match = rawText.match(/^(.+?)\s*([0-9０-９].*)$/);
        if (match) {
          name = match[1].trim(); // 前半部分
          quantity = match[2].trim(); // 後半部分
        }

        // 既存の在庫にあるかチェック（名前で検索）
        // ※完全に一致しなくても、既存在庫名が今回名前に含まれていればそれを更新対象とする
        const existingStock = stockItems.find(s => name.includes(s.name) || s.name.includes(name));

        if (existingStock) {
          // 既存があれば更新（分量を更新し、ステータスをOKに）
          await supabase.from('items').update({ 
            quantity: quantity || existingStock.quantity, // 分量が取得できれば上書き
            status: 'ok' 
          }).eq('id', existingStock.id);
        } else {
          // 新規追加（食品カテゴリーとして追加）
          await supabase.from('items').insert([{
            name: name,
            quantity: quantity,
            category: 'food',
            status: 'ok'
          }]);
        }
      }

      alert("在庫に追加しました！\nこれでまた新しい献立が作れます！");
      
      // チェックを外す
      const newChecks = { ...checkedItems };
      delete newChecks[recipe.id];
      setCheckedItems(newChecks);
      localStorage.setItem('recipe_checks', JSON.stringify(newChecks));

      // データ再読み込み
      fetchData();

    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100 text-center">
        <h2 className="text-2xl font-bold text-indigo-800 mb-1">📖 マイ・レシピ帳</h2>
        <p className="text-sm text-gray-500">保存したレシピと買い物リスト</p>
      </div>

      <div className="space-y-4">
        {recipes.map((recipe) => {
          const isOpen = expandedId === recipe.id;
          const isEditing = editingTitleId === recipe.id;

          const ingredientsWithStockStatus = recipe.ingredients.map((ing, i) => {
            const match = findStockMatch(ing);
            return { index: i, text: ing, stock: match };
          });

          const toBuyList = ingredientsWithStockStatus.filter(item => !item.stock);
          const inStockList = ingredientsWithStockStatus.filter(item => item.stock);

          // チェックされている数
          const checkedCount = Object.values(checkedItems[recipe.id] || {}).filter(Boolean).length;

          return (
            <div key={recipe.id} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
              {/* タイトル部分 */}
              <div className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 border-b">
                <div className="flex-1 mr-2">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input value={editTitleText} onChange={(e) => setEditTitleText(e.target.value)} className="border p-1 rounded w-full font-bold text-black" autoFocus />
                      <button onClick={() => saveTitle(recipe.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">保存</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className="text-left font-bold text-lg text-gray-800">{recipe.title}</button>
                      <button onClick={() => startEditingTitle(recipe)} className="text-gray-400 hover:text-blue-500 text-sm">✏️</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className={`text-2xl text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</button>
              </div>

              {isOpen && (
                <div className="p-5 bg-gray-50 text-sm animate-fadeIn">
                  <div className="flex gap-2 mb-6">
                    <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-red-600 text-white text-center py-2 rounded-lg font-bold hover:bg-red-700">📺 動画を見る</a>
                    <button onClick={() => deleteRecipe(recipe.id)} className="px-3 bg-gray-200 text-gray-600 rounded-lg font-bold">🗑️</button>
                  </div>

                  {/* 買い物リスト */}
                  {toBuyList.length > 0 && (
                    <div className="mb-4 bg-white p-3 rounded-lg border-2 border-green-100 shadow-sm relative">
                      <h5 className="font-bold text-green-700 mb-2 flex items-center gap-2">🛒 買い物リスト</h5>
                      <div className="space-y-2 mb-4">
                        {toBuyList.map((item) => {
                          const isChecked = checkedItems[recipe.id]?.[item.index];
                          return (
                            <label key={item.index} className={`flex items-start gap-3 p-2 rounded cursor-pointer transition ${isChecked ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={!!isChecked} onChange={() => toggleCheck(recipe.id, item.index)} className="w-5 h-5 accent-green-600 mt-0.5" />
                              <span className={`text-base font-bold ${isChecked ? 'text-green-700' : 'text-black'}`}>{item.text}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* ★買い物完了ボタン（チェックがある時だけ表示） */}
                      {checkedCount > 0 && (
                        <button 
                          onClick={() => completeShopping(recipe)}
                          disabled={isProcessing}
                          className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 flex justify-center items-center gap-2 animate-bounce-short"
                        >
                          {isProcessing ? '処理中...' : `🛍️ ${checkedCount}個を在庫に追加する！`}
                        </button>
                      )}
                    </div>
                  )}

                  {inStockList.length > 0 && (
                    <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <h5 className="font-bold text-blue-700 mb-2">🏠 在庫にありそう</h5>
                      <div className="space-y-2">
                        {inStockList.map((item) => (
                          <div key={item.index} className="flex justify-between items-center p-2 bg-white rounded border border-blue-100">
                            <div><span className="block font-bold text-gray-700">{item.text}</span></div>
                            <div className="text-right"><span className="block font-bold text-blue-600">{item.stock?.quantity}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <details className="mb-6 text-gray-500">
                    <summary className="cursor-pointer text-xs hover:text-gray-700">全材料リスト</summary>
                    <ul className="list-disc pl-5 mt-2 text-xs">{recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}</ul>
                  </details>

                  <div>
                    <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-orange-500 pl-2">🔥 作り方</h5>
                    <ol className="list-decimal pl-5 space-y-3 text-gray-700">
                      {recipe.steps.map((step, i) => <li key={i} className="leading-relaxed">{step}</li>)}
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