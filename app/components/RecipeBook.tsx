// app/components/RecipeBook.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 辞書
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

type Recipe = { 
  id: number; title: string; channel_name: string; url: string; 
  ingredients: string[]; steps: string[]; 
  rating: number; is_favorite: boolean; memo: string;
  source: string; genre?: string; difficulty?: string; calories?: number;
};
type StockItem = { id: number; name: string; quantity: string; status: 'ok' | 'buy'; category: string; };

export default function RecipeBook({ mode }: { mode: 'youtube' | 'ai' }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<number, Record<number, boolean>>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [openRecipeId, setOpenRecipeId] = useState<number | null>(null);
  
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderText, setEditFolderText] = useState('');
  const [movingRecipeId, setMovingRecipeId] = useState<number | null>(null);
  const [newFolderText, setNewFolderText] = useState('');

  const [calendarTargetId, setCalendarTargetId] = useState<number | null>(null);
  const [calendarDate, setCalendarDate] = useState('');

  const fetchData = async () => {
    const { data: r } = await supabase.from('recipes').select('*').eq('source', mode).order('created_at', { ascending: false });
    const { data: s } = await supabase.from('items').select('*');
    if (r) setRecipes(r);
    if (s) setStockItems(s);
  };

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('recipe_checks');
    if (saved) setCheckedItems(JSON.parse(saved));
    setCalendarDate(new Date().toISOString().split('T')[0]);
  }, [mode]);

  const channels = Array.from(new Set(recipes.map(r => r.channel_name || 'その他')));
  const groupedRecipes = recipes.reduce((acc, recipe) => {
    const channel = recipe.channel_name || 'その他';
    if (!acc[channel]) acc[channel] = [];
    acc[channel].push(recipe);
    return acc;
  }, {} as Record<string, Recipe[]>);

  const startEditFolder = (channel: string) => { setEditingFolder(channel); setEditFolderText(channel); };
  const saveFolder = async (oldName: string) => { if (!editFolderText.trim()) return; await supabase.from('recipes').update({ channel_name: editFolderText }).eq('channel_name', oldName).eq('source', mode); fetchData(); setEditingFolder(null); };
  const moveRecipe = async (id: number, newChannel: string) => { if (!newChannel.trim()) return; await supabase.from('recipes').update({ channel_name: newChannel }).eq('id', id); fetchData(); setMovingRecipeId(null); setNewFolderText(''); };
  const saveTitle = async (id: number) => { await supabase.from('recipes').update({ title: editTitleText }).eq('id', id); setRecipes(recipes.map(r => r.id === id ? { ...r, title: editTitleText } : r)); setEditingTitleId(null); };
  const deleteRecipe = async (id: number) => { if (!confirm('本当に削除しますか？')) return; await supabase.from('recipes').delete().eq('id', id); fetchData(); };
  const toggleCheck = (rid: number, idx: number) => { const next = { ...checkedItems, [rid]: { ...checkedItems[rid], [idx]: !checkedItems[rid]?.[idx] } }; setCheckedItems(next); localStorage.setItem('recipe_checks', JSON.stringify(next)); };
  const toggleFolder = (channel: string) => setOpenFolders(prev => ({ ...prev, [channel]: !prev[channel] }));
  const toggleFavorite = async (id: number, current: boolean, e: React.MouseEvent) => { e.stopPropagation(); await supabase.from('recipes').update({ is_favorite: !current }).eq('id', id); setRecipes(recipes.map(r => r.id === id ? { ...r, is_favorite: !current } : r)); };
  const updateRating = async (id: number, rating: number) => { await supabase.from('recipes').update({ rating }).eq('id', id); setRecipes(recipes.map(r => r.id === id ? { ...r, rating } : r)); };
  const shareToLine = (recipe: Recipe, toBuyList: any[]) => { if (toBuyList.length === 0) return alert('買い物リストが空です'); const text = `🛒 買い物リスト (${recipe.title})\n\n` + toBuyList.map(item => `・${item.text}`).join('\n'); navigator.clipboard.writeText(text).then(() => { if (confirm('買い物リストをコピーしました！\nLINEを開きますか？')) { window.open('https://line.me/R/', '_blank'); } }); };
  const addToCalendar = async () => { if (!calendarTargetId || !calendarDate) return; const recipe = recipes.find(r => r.id === calendarTargetId); if (!recipe) return; const { error } = await supabase.from('meal_plans').insert([{ date: calendarDate, recipe_id: recipe.id, recipe_title: recipe.title }]); if (error) alert('登録失敗'); else alert(`${calendarDate} に登録しました！`); setCalendarTargetId(null); };

  const findStockMatch = (ingredientText: string) => {
    const normalize = (str: string) => str.replace(/\(.*\)/g, '').replace(/（.*）/g, '').replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
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

  const completeShopping = async (recipe: Recipe) => { 
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

  const handleCooked = async (recipe: Recipe) => {
    if (!confirm(`「${recipe.title}」を作りましたか？\n在庫から材料（調味料以外）を減らします。`)) return;
    let updatedCount = 0;
    for (const ingredientStr of recipe.ingredients) {
      const matchRecipe = ingredientStr.match(/^(.+?)\s*([0-9０-９\.]+)(.*)$/);
      if (!matchRecipe) continue;
      const recipeName = matchRecipe[1].trim(); const recipeNum = parseFloat(matchRecipe[2]); const unit = matchRecipe[3].trim(); 
      const stockItem = stockItems.find(i => i.status === 'ok' && (i.name.includes(recipeName) || recipeName.includes(i.name)));
      if (stockItem) {
        if (stockItem.category === 'seasoning') continue;
        if (stockItem.quantity) {
          const matchStock = stockItem.quantity.match(/^([0-9０-９\.]+)(.*)$/);
          if (matchStock) {
            const stockNum = parseFloat(matchStock[1]); let newNum = stockNum - recipeNum; let newStatus: 'ok' | 'buy' = 'ok'; let newQuantityStr = stockItem.quantity;
            if (newNum <= 0) { newNum = 0; newStatus = 'buy'; newQuantityStr = '0' + unit; } else { newQuantityStr = Math.round(newNum * 10) / 10 + unit; }
            await supabase.from('items').update({ quantity: newQuantityStr, status: newStatus }).eq('id', stockItem.id); updatedCount++;
          }
        }
      }
    }
    alert(`${updatedCount}個の食材の在庫を更新しました！`); fetchData();
  };

  return (
    <div className="p-4 space-y-8 pb-24 relative">
      <div className={`${mode === 'youtube' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-indigo-50 border-indigo-100 text-indigo-800'} p-6 rounded-xl border-2 text-center`}>
        <h2 className="text-2xl font-bold">
          {mode === 'youtube' ? '📺 YouTubeレシピ帳' : '🤖 AI献立レシピ帳'}
        </h2>
        <p className="text-sm opacity-80">
          {mode === 'youtube' ? '動画分析で保存したレシピ' : 'AIシェフが考案したレシピ'}
        </p>
      </div>

      <div className="space-y-6">
        {recipes.length === 0 && <p className="text-center text-gray-400">レシピがありません</p>}
        
        {Object.entries(groupedRecipes).map(([channel, channelRecipes]) => (
          <div key={channel} className="border rounded-2xl shadow-sm bg-white">
            <div className="w-full flex items-center justify-between p-4 bg-gray-50 border-b">
              <div className="flex items-center gap-3 flex-1">
                <button onClick={() => toggleFolder(channel)} className="text-2xl">{mode === 'youtube' ? '📺' : '🤖'}</button>
                {editingFolder === channel ? (
                  <div className="flex gap-2 flex-1">
                    <input value={editFolderText} onChange={e => setEditFolderText(e.target.value)} className="border p-1 rounded w-full text-black" autoFocus onClick={e => e.stopPropagation()} />
                    <button onClick={() => saveFolder(channel)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">保存</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleFolder(channel)}>
                    <h3 className="font-bold text-lg text-gray-800">{channel}</h3>
                    <button onClick={(e) => { e.stopPropagation(); startEditFolder(channel); }} className="text-gray-400 hover:text-blue-500 text-xs">✏️</button>
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">{channelRecipes.length}</span>
                  </div>
                )}
              </div>
              <button onClick={() => toggleFolder(channel)} className={`text-gray-400 text-2xl transition ${openFolders[channel] ? 'rotate-180' : ''}`}>▼</button>
            </div>

            {openFolders[channel] && (
              <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
                {channelRecipes.map((recipe) => {
                  const isOpen = openRecipeId === recipe.id;
                  const ingredientsWithStock = recipe.ingredients.map((ing, i) => ({ index: i, text: ing, stock: findStockMatch(ing) }));
                  const toBuy = ingredientsWithStock.filter(i => !i.stock);
                  const inStock = ingredientsWithStock.filter(i => i.stock);
                  const checkedCount = Object.values(checkedItems[recipe.id] || {}).filter(Boolean).length;

                  return (
                    // ★修正ポイント：overflow-hidden を削除し、z-indexを調整（ドロップダウンが切れないように）
                    <div key={recipe.id} className={`border rounded-xl transition-all duration-300 relative ${isOpen ? 'col-span-1 md:col-span-2 lg:col-span-3 shadow-lg ring-2 ring-indigo-100' : 'hover:shadow-md'}`}>
                      <div className="p-4 border-b flex justify-between items-start bg-white rounded-t-xl">
                        <div className="flex-1 mr-2">
                          {mode === 'ai' && (
                            <div className="flex gap-2 mb-1 text-xs">
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{recipe.genre}</span>
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{recipe.difficulty}</span>
                              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{recipe.calories}kcal</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={(e) => toggleFavorite(recipe.id, recipe.is_favorite, e)} className={`text-xl ${recipe.is_favorite ? 'text-pink-500' : 'text-gray-300 hover:text-pink-300'}`}>{recipe.is_favorite ? '♥' : '♡'}</button>
                            <span className="text-yellow-400 text-sm">{'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}</span>
                          </div>
                          {editingTitleId === recipe.id ? (
                            <div className="flex gap-2">
                              <input value={editTitleText} onChange={e => setEditTitleText(e.target.value)} className="border p-1 w-full text-black" autoFocus />
                              <button onClick={() => saveTitle(recipe.id)} className="bg-blue-600 text-white px-2 rounded text-xs">保存</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 onClick={() => setOpenRecipeId(isOpen ? null : recipe.id)} className="font-bold text-gray-800 cursor-pointer">{recipe.title}</h4>
                              <button onClick={() => { setEditingTitleId(recipe.id); setEditTitleText(recipe.title); }} className="text-gray-300 hover:text-blue-500 text-xs">✏️</button>
                            </div>
                          )}
                        </div>
                        
                        {/* ★修正ポイント：ドロップダウンメニューの配置 */}
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <button onClick={() => setMovingRecipeId(movingRecipeId === recipe.id ? null : recipe.id)} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">📂 移動</button>
                            {movingRecipeId === recipe.id && (
                              <div className="absolute right-0 top-8 bg-white border shadow-xl rounded-lg p-2 z-20 w-48">
                                <p className="text-xs text-gray-400 mb-1">移動先フォルダ:</p>
                                <div className="max-h-40 overflow-y-auto">
                                  {channels.map(c => ( <button key={c} onClick={() => moveRecipe(recipe.id, c)} className="block w-full text-left text-sm p-1 hover:bg-indigo-50 rounded">{c}</button> ))}
                                </div>
                                <div className="border-t my-1"></div>
                                <input placeholder="新規フォルダ名" value={newFolderText} onChange={e => setNewFolderText(e.target.value)} className="w-full border p-1 text-xs text-black mb-1" />
                                <button onClick={() => moveRecipe(recipe.id, newFolderText)} className="w-full bg-blue-600 text-white text-xs py-1 rounded">新規作成して移動</button>
                              </div>
                            )}
                          </div>
                          {/* ★追加：ヘッダーにある削除ボタン */}
                          <button onClick={() => deleteRecipe(recipe.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">🗑️</button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="p-4 bg-gray-50 text-sm rounded-b-xl">
                          <button onClick={() => setCalendarTargetId(recipe.id)} className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-2 rounded-lg font-bold hover:bg-indigo-100 mb-4 flex items-center justify-center gap-2">📅 カレンダーに登録</button>

                          {mode === 'youtube' && (
                            <div className="flex gap-2 mb-4">
                              <a href={recipe.url} target="_blank" className="flex-1 bg-red-600 text-white text-center py-2 rounded font-bold hover:bg-red-700">📺 動画</a>
                            </div>
                          )}
                          
                          <div className="mb-4 bg-white p-2 rounded border flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">評価:</span>
                            {[1, 2, 3, 4, 5].map(star => ( <button key={star} onClick={() => updateRating(recipe.id, star)} className={`text-lg ${star <= recipe.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button> ))}
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <div className="mb-4 bg-white p-3 rounded border border-gray-300">
                                <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-gray-500 pl-2">📝 全材料リスト</h5>
                                <ul className="list-disc pl-5 text-gray-700 space-y-1">{recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}</ul>
                              </div>
                              <div className="bg-white p-3 rounded border border-green-200 mb-4">
                                <div className="flex justify-between items-center mb-2"><h5 className="font-bold text-green-700 flex items-center gap-2">🛒 買い物リスト <span className="text-xs font-normal text-gray-400">(在庫なし)</span></h5><button onClick={() => shareToLine(recipe, toBuy)} className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">LINE</button></div>
                                {toBuy.length === 0 ? <p className="text-xs text-gray-400">すべて在庫にあります！</p> : toBuy.map((item) => (
                                  <label key={item.index} className={`flex gap-2 p-1 cursor-pointer hover:bg-green-50 rounded ${checkedItems[recipe.id]?.[item.index] ? 'opacity-50 line-through' : ''}`}>
                                    <input type="checkbox" checked={!!checkedItems[recipe.id]?.[item.index]} onChange={() => toggleCheck(recipe.id, item.index)} className="accent-green-600" />
                                    <span className="font-bold">{item.text}</span>
                                  </label>
                                ))}
                                {checkedCount > 0 && <button onClick={() => completeShopping(recipe)} disabled={isProcessing} className="w-full mt-2 bg-green-600 text-white py-2 rounded text-xs font-bold">{isProcessing ? '...' : `🛍️ ${checkedCount}個を在庫に追加`}</button>}
                              </div>
                              {inStock.length > 0 && (
                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                  <h5 className="font-bold text-blue-700 mb-2 flex items-center gap-2">🏠 在庫にありそう <span className="text-xs font-normal text-gray-500">(確認用)</span></h5>
                                  {inStock.map((item) => (
                                    <div key={item.index} className="flex justify-between items-center p-2 bg-white rounded border border-blue-100 mb-1">
                                      <span className="font-bold text-gray-700">{item.text}</span>
                                      <div className="text-right"><span className="block font-bold text-blue-600">{item.stock?.quantity}</span><span className="text-xs text-gray-400">({item.stock?.name})</span></div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <h5 className="font-bold text-orange-600 mb-2 border-l-4 border-orange-500 pl-2">🔥 作り方</h5>
                              <ol className="list-decimal pl-5 space-y-2 text-gray-700">{recipe.steps.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}</ol>
                            </div>
                          </div>
                          <button onClick={() => handleCooked(recipe)} className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-bold shadow hover:bg-green-600 transition flex items-center justify-center gap-2">😋 美味しくできた！ <span className="text-xs font-normal">(在庫から減らす / 調味料除く)</span></button>
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

      {calendarTargetId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">📅 カレンダーに登録</h3>
            <input type="date" value={calendarDate} onChange={e => setCalendarDate(e.target.value)} className="w-full border p-3 rounded-lg mb-6 text-black" />
            <div className="flex gap-3"><button onClick={() => setCalendarTargetId(null)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg">キャンセル</button><button onClick={addToCalendar} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold">登録する</button></div>
          </div>
        </div>
      )}
    </div>
  );
}