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

export default function RecipeBook() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  // 買い物チェック状態 { レシピID: { 材料インデックス: true/false } }
  const [checkedItems, setCheckedItems] = useState<Record<number, Record<number, boolean>>>({});

  // データ読み込み
  const fetchRecipes = async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (!error) setRecipes(data || []);
  };

  useEffect(() => {
    fetchRecipes();
    // ローカルストレージからチェック状態を復元（アプリを閉じても覚えているように）
    const savedChecks = localStorage.getItem('recipe_checks');
    if (savedChecks) setCheckedItems(JSON.parse(savedChecks));
  }, []);

  // 削除機能
  const deleteRecipe = async (id: number) => {
    if (!confirm('本当に削除しますか？')) return;
    await supabase.from('recipes').delete().eq('id', id);
    fetchRecipes();
  };

  // チェックボックス操作
  const toggleCheck = (recipeId: number, index: number) => {
    const newChecks = { ...checkedItems };
    if (!newChecks[recipeId]) newChecks[recipeId] = {};
    
    newChecks[recipeId][index] = !newChecks[recipeId][index];
    
    setCheckedItems(newChecks);
    localStorage.setItem('recipe_checks', JSON.stringify(newChecks));
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100 text-center">
        <h2 className="text-2xl font-bold text-indigo-800 mb-1">📖 マイ・レシピ帳</h2>
        <p className="text-sm text-gray-500">保存した動画レシピのリストです</p>
      </div>

      <div className="space-y-4">
        {recipes.length === 0 && <p className="text-center text-gray-400">まだ保存されたレシピはありません</p>}
        
        {recipes.map((recipe) => {
          const isOpen = expandedId === recipe.id;
          
          return (
            <div key={recipe.id} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
              {/* タイトル部分 */}
              <button 
                onClick={() => setExpandedId(isOpen ? null : recipe.id)}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-gray-800">{recipe.title}</h4>
                  <span className="text-xs text-blue-500">クリックして詳細＆買い物リスト</span>
                </div>
                <span className={`text-2xl text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* 詳細部分 */}
              {isOpen && (
                <div className="p-5 border-t bg-gray-50 text-sm animate-fadeIn">
                  
                  {/* 動画リンク */}
                  <div className="flex gap-2 mb-6">
                    <a 
                      href={recipe.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 bg-red-600 text-white text-center py-2 rounded-lg font-bold hover:bg-red-700"
                    >
                      📺 動画を見る
                    </a>
                    <button 
                      onClick={() => deleteRecipe(recipe.id)}
                      className="px-3 bg-gray-200 text-gray-600 rounded-lg font-bold"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* 買い物リスト（チェックボックス付き） */}
                  <div className="mb-6 bg-white p-3 rounded-lg border border-gray-200 shadow-inner">
                    <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-green-500 pl-2">🥬 買い物リスト</h5>
                    <div className="space-y-2">
                      {recipe.ingredients.map((ing, i) => {
                        const isChecked = checkedItems[recipe.id]?.[i];
                        return (
                          <label key={i} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition ${isChecked ? 'bg-gray-100 text-gray-400 line-through' : 'hover:bg-green-50'}`}>
                            <input 
                              type="checkbox" 
                              checked={!!isChecked} 
                              onChange={() => toggleCheck(recipe.id, i)}
                              className="w-5 h-5 accent-green-600"
                            />
                            <span className="text-base">{ing}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

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