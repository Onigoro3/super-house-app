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

  // 編集用ステート
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // データ読み込み（レシピと在庫の両方を取ってくる）
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

  // タイトル編集開始
  const startEditingTitle = (recipe: Recipe) => {
    setEditingTitleId(recipe.id);
    setEditTitleText(recipe.title);
  };

  // タイトル保存
  const saveTitle = async (id: number) => {
    await supabase.from('recipes').update({ title: editTitleText }).eq('id', id);
    setRecipes(recipes.map(r => r.id === id ? { ...r, title: editTitleText } : r));
    setEditingTitleId(null);
  };

  // ★在庫照合ロジック
  // レシピの材料テキストの中に、在庫アイテムの名前が含まれているか探す
  const findStockMatch = (ingredientText: string) => {
    // 在庫があるもの(status: 'ok')の中から探す
    return stockItems.find(stock => 
      stock.status === 'ok' && ingredientText.includes(stock.name)
    );
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100 text-center">
        <h2 className="text-2xl font-bold text-indigo-800 mb-1">📖 マイ・レシピ帳</h2>
        <p className="text-sm text-gray-500">在庫と連動したスマートなレシピ帳</p>
      </div>

      <div className="space-y-4">
        {recipes.length === 0 && <p className="text-center text-gray-400">まだ保存されたレシピはありません</p>}
        
        {recipes.map((recipe) => {
          const isOpen = expandedId === recipe.id;
          const isEditing = editingTitleId === recipe.id;

          // 材料を「買うべきもの」と「在庫にあるもの」に分類
          const ingredientsWithStockStatus = recipe.ingredients.map((ing, i) => {
            const match = findStockMatch(ing);
            return { index: i, text: ing, stock: match };
          });

          // 在庫がないもの（＝買うもの）
          const toBuyList = ingredientsWithStockStatus.filter(item => !item.stock);
          // 在庫があるもの（＝確認するもの）
          const inStockList = ingredientsWithStockStatus.filter(item => item.stock);

          return (
            <div key={recipe.id} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
              {/* タイトル部分（編集可能） */}
              <div className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 border-b">
                <div className="flex-1 mr-2">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input 
                        value={editTitleText}
                        onChange={(e) => setEditTitleText(e.target.value)}
                        className="border p-1 rounded w-full text-lg font-bold text-black"
                        autoFocus
                      />
                      <button onClick={() => saveTitle(recipe.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm whitespace-nowrap">保存</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className="text-left">
                         <h4 className="font-bold text-lg text-gray-800">{recipe.title}</h4>
                      </button>
                      <button onClick={() => startEditingTitle(recipe)} className="text-gray-400 hover:text-blue-500 text-sm">✏️</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setExpandedId(isOpen ? null : recipe.id)} className={`text-2xl text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</button>
              </div>

              {/* 詳細部分 */}
              {isOpen && (
                <div className="p-5 bg-gray-50 text-sm animate-fadeIn">
                  
                  {/* 動画リンクなど */}
                  <div className="flex gap-2 mb-6">
                    <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-red-600 text-white text-center py-2 rounded-lg font-bold hover:bg-red-700">
                      📺 動画を見る
                    </a>
                    <button onClick={() => deleteRecipe(recipe.id)} className="px-3 bg-gray-200 text-gray-600 rounded-lg font-bold">🗑️</button>
                  </div>

                  {/* ★★★ 買い物リスト（在庫にないもの） ★★★ */}
                  {toBuyList.length > 0 && (
                    <div className="mb-4 bg-white p-3 rounded-lg border-2 border-green-100 shadow-sm">
                      <h5 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                        🛒 買い物リスト <span className="text-xs font-normal text-gray-500">(在庫になし)</span>
                      </h5>
                      <div className="space-y-2">
                        {toBuyList.map((item) => {
                          const isChecked = checkedItems[recipe.id]?.[item.index];
                          return (
                            <label key={item.index} className={`flex items-start gap-3 p-2 rounded cursor-pointer transition ${isChecked ? 'bg-gray-100 text-gray-400 line-through' : 'hover:bg-green-50'}`}>
                              <input type="checkbox" checked={!!isChecked} onChange={() => toggleCheck(recipe.id, item.index)} className="w-5 h-5 accent-green-600 mt-0.5" />
                              <span className="text-base font-bold">{item.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ★★★ 在庫ありリスト（確認用） ★★★ */}
                  {inStockList.length > 0 && (
                    <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <h5 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                        🏠 在庫にありそう <span className="text-xs font-normal text-gray-500">(量を確認してね)</span>
                      </h5>
                      <div className="space-y-2">
                        {inStockList.map((item) => (
                          <div key={item.index} className="flex justify-between items-center p-2 bg-white rounded border border-blue-100">
                            <div>
                              <span className="block font-bold text-gray-700">{item.text}</span>
                              <span className="text-xs text-gray-400">必要な量 (レシピ)</span>
                            </div>
                            <div className="text-right">
                              <span className="block font-bold text-blue-600">{item.stock?.quantity}</span>
                              <span className="text-xs text-gray-400">在庫の量</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 全材料リスト（念のため表示） */}
                  <details className="mb-6 text-gray-500">
                    <summary className="cursor-pointer text-xs hover:text-gray-700">全材料リストを表示</summary>
                    <ul className="list-disc pl-5 mt-2 text-xs">
                      {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                    </ul>
                  </details>

                  {/* 作り方 */}
                  <div>
                    <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-orange-500 pl-2">🔥 作り方</h5>
                    <ol className="list-decimal pl-5 space-y-3 text-gray-700">
                      {recipe.steps.map((step, i) => (
                        <li key={i} className="leading-relaxed">{step}</li>
                      ))}
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