// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Category = 'food' | 'seasoning' | 'other';
type Status = 'ok' | 'buy';
type ViewType = 'food' | 'seasoning' | 'other' | 'menu';

type Item = {
  id: number;
  name: string;
  quantity: string;
  category: Category;
  status: Status;
};

type Recipe = {
  title: string;
  type: string;
  difficulty: '簡単' | '普通' | '難しい';
  calories: number;
  ingredients: string[];
  steps: string[];
};

export default function StockList({ view }: { view: ViewType }) {
  const [items, setItems] = useState<Item[]>([]);
  
  // 入力・編集用
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  
  // 献立用
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [useQuantities, setUseQuantities] = useState<Record<number, string>>({});
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  // ★追加：AI読み込み中フラグ
  const [loading, setLoading] = useState(false);

  // データ読み込み
  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (!error) setItems(data || []);
  };
  useEffect(() => { fetchItems(); }, []);

  // アイテム操作系
  const addItem = async () => {
    if (!newItemName) return;
    const category: Category = view === 'menu' ? 'food' : (view as Category);
    const { error } = await supabase.from('items').insert([{ name: newItemName, quantity: newItemQuantity, category, status: 'ok' }]);
    if (!error) { setNewItemName(''); setNewItemQuantity(''); fetchItems(); }
  };
  const startEditing = (item: Item) => { setEditingId(item.id); setEditName(item.name); setEditQuantity(item.quantity || ''); };
  const saveEdit = async () => {
    if (editingId === null) return;
    setItems(items.map(i => i.id === editingId ? { ...i, name: editName, quantity: editQuantity } : i));
    await supabase.from('items').update({ name: editName, quantity: editQuantity }).eq('id', editingId);
    setEditingId(null);
  };
  const toggleStatus = async (id: number, currentStatus: Status) => {
    const newStatus = currentStatus === 'ok' ? 'buy' : 'ok';
    setItems(items.map(i => i.id === id ? { ...i, status: newStatus } : i));
    await supabase.from('items').update({ status: newStatus }).eq('id', id);
  };
  const deleteItem = async (id: number) => {
    setItems(items.filter(i => i.id !== id));
    setSelectedIds(selectedIds.filter(sid => sid !== id));
    await supabase.from('items').delete().eq('id', id);
  };

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
      const newQuantities = { ...useQuantities };
      delete newQuantities[id];
      setUseQuantities(newQuantities);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleQuantityChange = (id: number, val: string) => {
    setUseQuantities({ ...useQuantities, [id]: val });
    if (!selectedIds.includes(id) && val !== '') setSelectedIds([...selectedIds, id]);
  };

  // ★ AI献立生成ロジック (APIを呼び出す)
  const generateMenu = async () => {
    const selectedFoods = items.filter(i => selectedIds.includes(i.id) && i.category === 'food');
    if (selectedFoods.length === 0) { alert("食材を選んでください！"); return; }

    setLoading(true);
    setRecipes([]); // 一旦クリア
    setExpandedIndex(null);

    // AIに送るための食材リスト作成
    const ingredientsToSend = selectedFoods.map(f => {
      const qty = useQuantities[f.id] || f.quantity || '';
      return qty ? `${f.name}(${qty})` : f.name;
    });

    // 在庫にある調味料リスト
    const availableSeasonings = items
      .filter(i => i.category === 'seasoning' && i.status === 'ok')
      .map(i => i.name)
      .join('、');

    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ingredients: ingredientsToSend,
          seasoning: availableSeasonings || '塩、こしょう、醤油など一般的な調味料'
        }),
      });

      if (!res.ok) throw new Error('生成エラー');
      const data = await res.json();
      setRecipes(data);
    } catch (e) {
      alert('AIが混み合っているか、エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // ★★★ 献立・レシピ画面 ★★★
  if (view === 'menu') {
    const foodStock = items.filter(i => i.category === 'food' && i.status === 'ok');

    return (
      <div className="p-4 space-y-8 pb-24">
        
        {/* ステップ1：食材選択エリア */}
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 border-b pb-2 mb-3">① 食材と量を選ぶ</h3>
          <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
            {foodStock.length === 0 ? (
              <p className="text-sm text-gray-400">食材の在庫がありません。</p>
            ) : (
              foodStock.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)} 
                    onChange={() => toggleSelection(item.id)}
                    className="w-5 h-5 accent-indigo-600 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-400">在庫: {item.quantity || '未設定'}</div>
                  </div>
                  <input
                    type="text"
                    placeholder="使う量"
                    value={useQuantities[item.id] || ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="border p-1 rounded text-sm w-24 text-right text-black bg-gray-50 focus:bg-white"
                  />
                </div>
              ))
            )}
          </div>
          <button 
            onClick={generateMenu} 
            disabled={selectedIds.length === 0 || loading}
            className={`w-full py-3 rounded-lg font-bold text-white shadow transition flex justify-center items-center gap-2 ${
              loading ? 'bg-indigo-400 cursor-wait' : 
              selectedIds.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin text-xl">⏳</span>
                <span>AIシェフが10個のレシピを考案中...</span>
              </>
            ) : (
              selectedIds.length === 0 ? '食材を選んでください' : `✨ ${selectedIds.length}個の食材で10案考える！`
            )}
          </button>
        </div>

        {/* ステップ2：レシピ提案 */}
        {recipes.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 px-2">② AIシェフの提案メニュー (10選)</h3>
            
            {recipes.map((recipe, index) => {
              const isOpen = expandedIndex === index;
              const stars = recipe.difficulty === '簡単' ? '★' : recipe.difficulty === '普通' ? '★★' : '★★★';
              const difficultyColor = recipe.difficulty === '簡単' ? 'text-green-600' : recipe.difficulty === '普通' ? 'text-orange-500' : 'text-red-600';

              return (
                <div key={index} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
                  <button 
                    onClick={() => setExpandedIndex(isOpen ? null : index)}
                    className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{recipe.type}</span>
                        <span className={`text-xs font-bold ${difficultyColor}`}>{stars} {recipe.difficulty}</span>
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">約{recipe.calories}kcal</span>
                      </div>
                      <h4 className="font-bold text-lg text-gray-800">{recipe.title}</h4>
                    </div>
                    <span className={`text-2xl text-gray-400 ml-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {isOpen && (
                    <div className="p-5 border-t bg-gray-50 text-sm animate-fadeIn">
                      <div className="mb-4">
                        <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-green-500 pl-2">🥬 材料</h5>
                        <ul className="list-disc pl-5 text-gray-700 space-y-1">
                          {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-700 mb-2 border-l-4 border-orange-500 pl-2">🔥 作り方</h5>
                        <ol className="list-decimal pl-5 text-gray-700 space-y-3">
                          {recipe.steps.map((step, i) => <li key={i} className="leading-relaxed">{step}</li>)}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ★★★ 在庫リスト画面 ★★★
  const categoryMap: Record<string, Category> = { food: 'food', seasoning: 'seasoning', other: 'other' };
  const targetCategory = categoryMap[view];
  const displayItems = items.filter(i => i.category === targetCategory);
  const shoppingList = items.filter(i => i.status === 'buy' && i.category === targetCategory);

  return (
    <div className="p-4 space-y-6 pb-24">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3">
        {view === 'food' ? '🍎 食材リスト' : view === 'seasoning' ? '🧂 調味料リスト' : '🧻 日用品リスト'}
      </h2>

      {shoppingList.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <h3 className="font-bold text-yellow-800 mb-2">🛒 買うもの</h3>
          <ul className="space-y-1">
            {shoppingList.map(item => (
              <li key={item.id} className="flex justify-between text-sm bg-white px-2 py-1 rounded">
                <span>{item.name}</span><span className="text-gray-400">{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-3 rounded-xl border shadow-sm flex gap-2">
        <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="品名を追加" className="border p-2 rounded flex-1 text-black" />
        <input value={newItemQuantity} onChange={e => setNewItemQuantity(e.target.value)} placeholder="分量" className="border p-2 rounded w-20 text-black" />
        <button onClick={addItem} className="bg-blue-600 text-white px-4 rounded font-bold">＋</button>
      </div>

      <div className="space-y-2">
        {displayItems.map(item => (
          <StockItem 
            key={item.id} item={item} isEditing={editingId === item.id}
            editName={editName} editQuantity={editQuantity} setEditName={setEditName} setEditQuantity={setEditQuantity}
            onSave={saveEdit} onCancel={() => setEditingId(null)} onEditStart={() => startEditing(item)}
            onToggleStatus={toggleStatus} onDelete={deleteItem}
          />
        ))}
      </div>
    </div>
  );
}

function StockItem({ item, isEditing, editName, editQuantity, setEditName, setEditQuantity, onSave, onCancel, onEditStart, onToggleStatus, onDelete }: any) {
  if (isEditing) {
    return (
      <div className="bg-blue-50 p-2 rounded border border-blue-300 flex gap-2 items-center">
        <input value={editName} onChange={e => setEditName(e.target.value)} className="border p-1 rounded w-full text-black" />
        <input value={editQuantity} onChange={e => setEditQuantity(e.target.value)} className="border p-1 rounded w-20 text-black" />
        <button onClick={onSave} className="bg-blue-500 text-white px-2 py-1 rounded text-xs">保存</button>
        <button onClick={onCancel} className="bg-gray-300 text-black px-2 py-1 rounded text-xs">×</button>
      </div>
    );
  }
  return (
    <div className={`flex items-center p-3 rounded-lg border shadow-sm ${item.status === 'buy' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${item.status === 'buy' ? 'text-red-500' : 'text-gray-800'}`}>{item.name}</span>
          <button onClick={onEditStart} className="text-gray-300 hover:text-blue-500 text-xs">✏️</button>
        </div>
        {item.quantity && <span className="text-xs text-gray-500">{item.quantity}</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onToggleStatus(item.id, item.status)} className={`text-xs px-3 py-1 rounded-full font-bold ${item.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {item.status === 'ok' ? 'ある' : 'ない'}
        </button>
        <button onClick={() => onDelete(item.id)} className="text-gray-300 px-2">✕</button>
      </div>
    </div>
  );
}