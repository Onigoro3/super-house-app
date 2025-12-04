// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// PDF生成用ライブラリを動的インポートするために必要
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

type Category = 'food' | 'seasoning' | 'other';
type Status = 'ok' | 'buy';
type ViewType = 'food' | 'seasoning' | 'other' | 'menu';

type Item = { id: number; name: string; quantity: string; category: Category; status: Status; };
type Dish = { title: string; type: string; difficulty: string; calories: number; ingredients: string[]; steps: string[]; };
type MenuSet = { menu_title: string; nutrition_point: string; total_calories: number; dishes: Dish[]; };

export default function StockList({ view }: { view: ViewType }) {
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCount, setNewItemCount] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('個');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [useQuantities, setUseQuantities] = useState<Record<number, string>>({});
  const [includeRice, setIncludeRice] = useState(true);
  const [dishCount, setDishCount] = useState(1);
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  
  const [menuSets, setMenuSets] = useState<MenuSet[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 保存中フラグ

  // カレンダー用
  const [calendarTarget, setCalendarTarget] = useState<Dish | null>(null);
  const [calendarDate, setCalendarDate] = useState('');

  const fetchItems = async () => { const { data } = await supabase.from('items').select('*').order('created_at', { ascending: true }); if (data) setItems(data); };
  useEffect(() => { fetchItems(); setCalendarDate(new Date().toISOString().split('T')[0]); }, []);

  // アイテム操作
  const addItem = async () => { if (!newItemName) return; const combinedQuantity = newItemCount ? `${newItemCount}${newItemUnit}` : ''; const category: Category = view === 'menu' ? 'food' : (view as Category); await supabase.from('items').insert([{ name: newItemName, quantity: combinedQuantity, category, status: 'ok' }]); setNewItemName(''); setNewItemCount(''); fetchItems(); };
  const startEditing = (item: Item) => { setEditingId(item.id); setEditName(item.name); setEditQuantity(item.quantity || ''); };
  const saveEdit = async () => { if (editingId === null) return; setItems(items.map(i => i.id === editingId ? { ...i, name: editName, quantity: editQuantity } : i)); await supabase.from('items').update({ name: editName, quantity: editQuantity }).eq('id', editingId); setEditingId(null); };
  const toggleStatus = async (id: number, currentStatus: Status) => { const newStatus = currentStatus === 'ok' ? 'buy' : 'ok'; setItems(items.map(i => i.id === id ? { ...i, status: newStatus } : i)); await supabase.from('items').update({ status: newStatus }).eq('id', id); };
  const deleteItem = async (id: number) => { setItems(items.filter(i => i.id !== id)); setSelectedIds(selectedIds.filter(sid => sid !== id)); await supabase.from('items').delete().eq('id', id); };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsAnalyzing(true); const reader = new FileReader(); reader.onloadend = async () => { const base64 = reader.result as string; try { const res = await fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) }); if (!res.ok) throw new Error('分析失敗'); const itemsData: any[] = await res.json(); for (const item of itemsData) { await supabase.from('items').insert([{ name: item.name, quantity: item.quantity || '', category: item.category || 'food', status: 'ok' }]); } alert(`${itemsData.length}個追加しました！`); fetchItems(); } catch (err) { alert('解析失敗'); } finally { setIsAnalyzing(false); e.target.value = ''; } }; reader.readAsDataURL(file); };
  const toggleSelection = (id: number) => { if (selectedIds.includes(id)) { setSelectedIds(selectedIds.filter(sid => sid !== id)); const next = { ...useQuantities }; delete next[id]; setUseQuantities(next); } else { setSelectedIds([...selectedIds, id]); } };
  const handleQuantityChange = (id: number, val: string) => { setUseQuantities({ ...useQuantities, [id]: val }); if (!selectedIds.includes(id) && val !== '') setSelectedIds([...selectedIds, id]); };

  const generateMenu = async () => {
    const selectedFoods = items.filter(i => selectedIds.includes(i.id) && i.category === 'food');
    if (selectedFoods.length === 0) { alert("食材を選んでください！"); return; }
    setLoading(true); setMenuSets([]); setExpandedIndex(null);
    const ingredientsToSend = selectedFoods.map(f => { const qty = useQuantities[f.id] || f.quantity || ''; return qty ? `${f.name}(在庫:${qty})` : f.name; });
    const availableSeasonings = items.filter(i => i.category === 'seasoning' && i.status === 'ok').map(i => i.name).join('、');
    try { const res = await fetch('/api/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredients: ingredientsToSend, seasoning: availableSeasonings || 'なし', includeRice, dishCount, adultCount, childCount }), }); if (!res.ok) throw new Error('Error'); const data = await res.json(); setMenuSets(data); } catch (e) { alert('生成エラー'); } finally { setLoading(false); }
  };

  const handleCooked = async (dish: Dish) => {
    if (!confirm(`「${dish.title}」を作りましたか？\n在庫から材料（調味料以外）を減らします。`)) return;
    let updatedCount = 0;
    for (const ingredientStr of dish.ingredients) {
      const matchRecipe = ingredientStr.match(/^(.+?)\s*([0-9０-９\.]+)(.*)$/);
      if (!matchRecipe) continue;
      const recipeName = matchRecipe[1].trim(); const recipeNum = parseFloat(matchRecipe[2]); const unit = matchRecipe[3].trim(); 
      const stockItem = items.find(i => i.status === 'ok' && (i.name.includes(recipeName) || recipeName.includes(i.name)));
      if (stockItem) {
        if (stockItem.category === 'seasoning') continue;
        if (stockItem.quantity) {
          const matchStock = stockItem.quantity.match(/^([0-9０-９\.]+)(.*)$/);
          if (matchStock) {
            const stockNum = parseFloat(matchStock[1]); let newNum = stockNum - recipeNum; let newStatus: Status = 'ok'; let newQuantityStr = stockItem.quantity;
            if (newNum <= 0) { newNum = 0; newStatus = 'buy'; newQuantityStr = '0' + unit; } else { newQuantityStr = Math.round(newNum * 10) / 10 + unit; }
            await supabase.from('items').update({ quantity: newQuantityStr, status: newStatus }).eq('id', stockItem.id); updatedCount++;
          }
        }
      }
    }
    alert(`${updatedCount}個の食材の在庫を更新しました！`); fetchItems();
  };

  // ★ AIレシピを「レシピ帳」＆「書類管理(PDF)」の両方に保存する
  const saveAiRecipe = async (dish: Dish) => {
    setIsSaving(true);
    try {
      // 1. まず「AI献立レシピ帳（データベース）」に保存
      const { error: dbError } = await supabase.from('recipes').insert([{
        title: dish.title,
        channel_name: 'AIシェフの提案',
        url: '',
        ingredients: dish.ingredients,
        steps: dish.steps,
        source: 'ai',
        genre: dish.type,
        difficulty: dish.difficulty,
        calories: dish.calories || 0
      }]);
      if (dbError) throw dbError;

      // 2. 次に、PDFファイルを自動生成して「書類管理」に保存
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      
      // フォント読み込み（ゴシック）
      let customFont;
      try {
        const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
      } catch (e) {
        console.warn('Font load failed, using standard font');
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      const page = pdfDoc.addPage([595, 842]); // A4サイズ
      const { height } = page.getSize();
      const fontSizeTitle = 24;
      const fontSizeBody = 12;
      const margin = 50;
      
      // タイトル描画
      page.drawText(dish.title, { x: margin, y: height - margin, size: fontSizeTitle, font: customFont, color: rgb(0, 0.53, 0.71) });
      
      let currentY = height - margin - 40;
      
      // 情報描画
      const infoText = `ジャンル: ${dish.type}   難易度: ${dish.difficulty}   カロリー: ${dish.calories}kcal`;
      page.drawText(infoText, { x: margin, y: currentY, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) });
      currentY -= 30;

      // 材料描画
      page.drawText('【材料】', { x: margin, y: currentY, size: 14, font: customFont, color: rgb(0, 0, 0) });
      currentY -= 20;
      for (const ing of dish.ingredients) {
        page.drawText(`・${ing}`, { x: margin + 10, y: currentY, size: fontSizeBody, font: customFont, color: rgb(0.2, 0.2, 0.2) });
        currentY -= 18;
      }
      currentY -= 20;

      // 作り方描画
      page.drawText('【作り方】', { x: margin, y: currentY, size: 14, font: customFont, color: rgb(0, 0, 0) });
      currentY -= 20;
      for (let i = 0; i < dish.steps.length; i++) {
        // 長い文章の改行処理（簡易的）
        const step = `${i + 1}. ${dish.steps[i]}`;
        const maxLineLength = 35; // 1行あたりの文字数目安
        for (let j = 0; j < step.length; j += maxLineLength) {
          const line = step.substring(j, j + maxLineLength);
          page.drawText(line, { x: margin + 10, y: currentY, size: fontSizeBody, font: customFont, color: rgb(0.2, 0.2, 0.2) });
          currentY -= 18;
        }
        currentY -= 5; // 段落間
      }

      // PDFをBase64化
      const pdfBytes = await pdfDoc.save();
      const base64String = Buffer.from(pdfBytes).toString('base64');

      // 書類管理(documents)へ保存
      const { error: docError } = await supabase.from('documents').insert([{
        title: `${dish.title}.pdf`,
        folder_name: 'AI献立', // 自動でこのフォルダに入れる
        file_data: base64String
      }]);

      if (docError) throw docError;

      alert('「AI献立レシピ帳」と「書類管理(AI献立フォルダ)」の両方に保存しました！');

    } catch (e) {
      console.error(e);
      alert('保存中にエラーが発生しましたが、レシピ帳には保存されている可能性があります。');
    } finally {
      setIsSaving(false);
    }
  };

  const addToCalendar = async () => {
    if (!calendarTarget || !calendarDate) return;
    // カレンダー登録時はレシピIDが必要なので、まずレシピ保存してから登録する流れにするのが安全ですが、
    // 簡易化のため、まずはレシピ保存を促すか、裏で保存処理を走らせる実装にします。
    // 今回はシンプルに「レシピ帳への保存」関数を再利用し、その後IDを取得する流れは複雑になるため、
    // 既存のカレンダー登録ロジック（レシピテーブルへのインサート）を利用します。
    
    const { data, error } = await supabase.from('recipes').insert([{
      title: calendarTarget.title,
      channel_name: 'AIシェフの提案',
      url: '',
      ingredients: calendarTarget.ingredients,
      steps: calendarTarget.steps,
      source: 'ai',
      genre: calendarTarget.type,
      difficulty: calendarTarget.difficulty,
      calories: calendarTarget.calories || 0
    }]).select();

    if (error || !data) { alert('エラーが発生しました'); return; }
    
    const recipeId = data[0].id;
    await supabase.from('meal_plans').insert([{ date: calendarDate, recipe_id: recipeId, recipe_title: calendarTarget.title }]);
    alert(`${calendarDate} に登録しました！`);
    setCalendarTarget(null);
  };

  if (view === 'menu') {
    const foodStock = items.filter(i => i.category === 'food' && i.status === 'ok');
    const selectedItemsList = items.filter(i => selectedIds.includes(i.id));
    return (
      <div className="p-4 space-y-8 pb-24 relative">
        {/* ... (上部のUIは変更なし) ... */}
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          {selectedIds.length > 0 && <div className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100"><p className="text-xs font-bold text-indigo-600 mb-2">👇 使う食材 ({selectedIds.length})</p><div className="flex flex-wrap gap-2">{selectedItemsList.map(item => <span key={item.id} className="bg-white text-indigo-700 px-3 py-1 rounded-full text-sm shadow-sm border border-indigo-200 flex items-center gap-1">{item.name} <button onClick={() => toggleSelection(item.id)} className="text-indigo-400 hover:text-red-500 font-bold ml-1">×</button></span>)}</div></div>}
          <h3 className="font-bold text-gray-700 border-b pb-2 mb-3">① 食材を選ぶ</h3>
          <div className="max-h-60 overflow-y-auto space-y-2 mb-4">{foodStock.length === 0 ? <p className="text-sm text-gray-400">在庫なし</p> : foodStock.map(item => <div key={item.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} className="w-5 h-5 accent-indigo-600 flex-shrink-0" /><div className="flex-1"><div className="font-bold text-gray-800">{item.name}</div><div className="text-xs text-gray-400">在庫: {item.quantity || '-'}</div></div><input type="text" placeholder="使う量" value={useQuantities[item.id] || ''} onChange={(e) => handleQuantityChange(item.id, e.target.value)} className="border p-1 rounded text-sm w-24 text-right text-black bg-gray-50" /></div>)}</div>
          <div className="space-y-4 mb-4"><label className="flex items-center gap-3 cursor-pointer bg-orange-50 p-3 rounded-lg border border-orange-100"><input type="checkbox" checked={includeRice} onChange={() => setIncludeRice(!includeRice)} className="w-5 h-5 accent-orange-500" /><span className="text-gray-800 font-bold">🍚 白ご飯も使いますか？</span></label><div className="grid grid-cols-2 gap-4"><div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><p className="text-xs font-bold text-blue-800 mb-1">🍽️ 品数</p><div className="flex items-center justify-between bg-white rounded px-2 border"><button onClick={() => setDishCount(Math.max(1, dishCount - 1))} className="text-blue-600 font-bold px-2 py-1">-</button><span className="font-bold text-gray-800">{dishCount}品</span><button onClick={() => setDishCount(Math.min(5, dishCount + 1))} className="text-blue-600 font-bold px-2 py-1">+</button></div></div><div className="bg-green-50 p-3 rounded-lg border border-green-100"><p className="text-xs font-bold text-green-800 mb-1">👨 大人</p><div className="flex items-center justify-between bg-white rounded px-2 border"><button onClick={() => setAdultCount(Math.max(1, adultCount - 1))} className="text-green-600 font-bold px-2 py-1">-</button><span className="font-bold text-gray-800">{adultCount}人</span><button onClick={() => setAdultCount(Math.min(10, adultCount + 1))} className="text-green-600 font-bold px-2 py-1">+</button></div></div><div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100"><p className="text-xs font-bold text-yellow-800 mb-1">🧒 子供</p><div className="flex items-center justify-between bg-white rounded px-2 border"><button onClick={() => setChildCount(Math.max(0, childCount - 1))} className="text-yellow-600 font-bold px-2 py-1">-</button><span className="font-bold text-gray-800">{childCount}人</span><button onClick={() => setChildCount(Math.min(10, childCount + 1))} className="text-yellow-600 font-bold px-2 py-1">+</button></div></div></div></div>
          <button onClick={generateMenu} disabled={selectedIds.length === 0 || loading} className={`w-full py-3 rounded-lg font-bold text-white shadow ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{loading ? 'AIシェフが考案中...' : `✨ ${adultCount + childCount}人分の献立を5案考える！`}</button>
        </div>

        {menuSets.length > 0 && (
          <div className="space-y-6">
            <h3 className="font-bold text-gray-700 px-2">② AIシェフの提案 (5パターン)</h3>
            {menuSets.map((menu, index) => {
              const isOpen = expandedIndex === index;
              return (
                <div key={index} className="bg-white border-2 border-indigo-50 rounded-xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandedIndex(isOpen ? null : index)} className="w-full text-left p-4 hover:bg-indigo-50 transition"><div className="flex justify-between items-start"><div><h4 className="font-bold text-xl text-indigo-900 mb-1">{menu.menu_title}</h4><div className="flex items-center gap-2"><span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">計 {menu.total_calories}kcal</span><span className="text-xs text-gray-500">{menu.dishes.length}品</span></div></div><span className={`text-2xl text-indigo-300 transition ${isOpen ? 'rotate-180' : ''}`}>▼</span></div><p className="text-sm text-gray-600 mt-3 bg-gray-50 p-2 rounded border border-gray-100">💡 {menu.nutrition_point}</p></button>
                  {isOpen && (
                    <div className="p-4 bg-indigo-50 space-y-4 border-t">
                      {menu.dishes.map((dish, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border shadow-sm">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b"><h5 className="font-bold text-lg text-gray-800"><span className="text-sm text-white bg-indigo-500 px-2 py-0.5 rounded mr-2">{dish.type}</span>{dish.title}</h5><span className="text-xs font-bold text-orange-500">{dish.difficulty}</span></div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div><p className="text-xs font-bold text-gray-500 mb-1">🥬 材料 ({adultCount + childCount}人分)</p><ul className="list-disc pl-4 text-sm text-gray-700">{dish.ingredients.map((ing, k) => <li key={k}>{ing}</li>)}</ul></div>
                            <div><p className="text-xs font-bold text-gray-500 mb-1">🔥 作り方</p><ol className="list-decimal pl-4 text-sm text-gray-700 space-y-2">{dish.steps.map((step, k) => <li key={k}>{step}</li>)}</ol></div>
                          </div>
                          <button onClick={() => handleCooked(dish)} className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg font-bold shadow hover:bg-green-600 transition flex items-center justify-center gap-2">😋 美味しくできた！ <span className="text-xs font-normal">(在庫から減らす)</span></button>
                          
                          <div className="flex gap-2 mt-2">
                            {/* ★保存ボタン（ここを押すと両方に保存） */}
                            <button onClick={() => saveAiRecipe(dish)} disabled={isSaving} className="flex-1 bg-blue-100 text-blue-700 py-2 rounded font-bold hover:bg-blue-200">
                              {isSaving ? '保存中...' : '💾 レシピ帳に保存'}
                            </button>
                            <button onClick={() => setCalendarTarget(dish)} className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200">📅 カレンダー</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {calendarTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold mb-4">📅 カレンダーに登録</h3>
              <input type="date" value={calendarDate} onChange={e => setCalendarDate(e.target.value)} className="w-full border p-3 rounded-lg mb-6 text-black" />
              <div className="flex gap-3"><button onClick={() => setCalendarTarget(null)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg">キャンセル</button><button onClick={addToCalendar} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold">登録する</button></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const categoryMap: Record<string, Category> = { food: 'food', seasoning: 'seasoning', other: 'other' };
  const targetCategory = categoryMap[view];
  const displayItems = items.filter(i => i.category === targetCategory);
  const shoppingList = items.filter(i => i.status === 'buy' && i.category === targetCategory);

  return (
    <div className="p-4 space-y-6 pb-24">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3">{view === 'food' ? '🍎 食材リスト' : view === 'seasoning' ? '🧂 調味料リスト' : '🧻 日用品リスト'}</h2>
      {shoppingList.length > 0 && <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200"><h3 className="font-bold text-yellow-800 mb-2">🛒 買うもの</h3><ul className="space-y-1">{shoppingList.map(i => <li key={i.id} className="flex justify-between text-sm bg-white px-2 py-1 rounded"><span>{i.name}</span><span className="text-gray-400">{i.quantity}</span></li>)}</ul></div>}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col gap-3">
        <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="品名を追加" className="w-full border p-3 rounded-lg text-black bg-gray-50 focus:bg-white" />
        <div className="flex gap-2 h-12">
          <input type="number" value={newItemCount} onChange={e => setNewItemCount(e.target.value)} placeholder="数" className="w-16 border p-2 rounded-lg text-black text-center bg-gray-50" />
          <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} className="w-20 border p-2 rounded-lg text-black bg-gray-50"><option value="個">個</option><option value="g">g</option><option value="ml">ml</option><option value="本">本</option><option value="束">束</option><option value="袋">袋</option><option value="パック">パック</option><option value="枚">枚</option><option value="玉">玉</option><option value="缶">缶</option><option value="箱">箱</option></select>
          <button onClick={addItem} className="flex-1 bg-blue-600 text-white rounded-lg font-bold">＋</button>
          <label className={`w-12 flex items-center justify-center bg-green-600 text-white rounded-lg font-bold cursor-pointer ${isAnalyzing?'opacity-50':''}`}><span>{isAnalyzing?'...':'📷'}</span><input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isAnalyzing} /></label>
        </div>
      </div>
      <div className="space-y-2">{displayItems.map(item => <StockItem key={item.id} item={item} isEditing={editingId === item.id} editName={editName} editQuantity={editQuantity} setEditName={setEditName} setEditQuantity={setEditQuantity} onSave={saveEdit} onCancel={() => setEditingId(null)} onEditStart={() => startEditing(item)} onToggleStatus={toggleStatus} onDelete={deleteItem} />)}</div>
    </div>
  );
}

function StockItem({ item, isEditing, editName, editQuantity, setEditName, setEditQuantity, onSave, onCancel, onEditStart, onToggleStatus, onDelete }: any) {
  if (isEditing) return <div className="bg-blue-50 p-2 rounded border border-blue-300 flex gap-2 items-center"><input value={editName} onChange={e => setEditName(e.target.value)} className="border p-1 w-full text-black" /><input value={editQuantity} onChange={e => setEditQuantity(e.target.value)} className="border p-1 w-20 text-black" /><button onClick={onSave} className="bg-blue-500 text-white px-2 py-1 rounded text-xs">保存</button></div>;
  return <div className={`flex items-center p-3 rounded-lg border shadow-sm ${item.status === 'buy' ? 'bg-red-50 border-red-200' : 'bg-white'}`}><div className="flex-1"><div className="flex items-center gap-2"><span className={`font-bold ${item.status === 'buy' ? 'text-red-500' : 'text-gray-800'}`}>{item.name}</span><button onClick={onEditStart} className="text-gray-300 hover:text-blue-500 text-xs">✏️</button></div>{item.quantity && <span className="text-xs text-gray-500">{item.quantity}</span>}</div><div className="flex gap-2"><button onClick={() => onToggleStatus(item.id, item.status)} className={`text-xs px-3 py-1 rounded-full font-bold ${item.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.status === 'ok' ? 'ある' : 'ない'}</button><button onClick={() => onDelete(item.id)} className="text-gray-300 px-2">✕</button></div></div>;
}