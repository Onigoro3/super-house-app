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
  difficulty: '簡単' | '普通' | '難しい'; // 難易度追加
  ingredients: string[];
  steps: string[];
};

export default function StockList({ view }: { view: ViewType }) {
  const [items, setItems] = useState<Item[]>([]);
  
  // 入力用
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  
  // 編集用
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  
  // 献立用（選択ID、生成されたレシピ、開いているレシピの番号）
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // データ読み込み
  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (!error) setItems(data || []);
  };

  useEffect(() => { fetchItems(); }, []);

  // 追加
  const addItem = async () => {
    if (!newItemName) return;
    const category: Category = view === 'menu' ? 'food' : (view as Category);
    const { error } = await supabase.from('items').insert([
      { name: newItemName, quantity: newItemQuantity, category, status: 'ok' }
    ]);
    if (!error) {
      setNewItemName('');
      setNewItemQuantity('');
      fetchItems();
    }
  };

  // 編集・削除・ステータス変更
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

  // チェックボックス切替（献立画面用）
  const toggleSelection = (id: number) => {
    selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(sid => sid !== id)) : setSelectedIds([...selectedIds, id]);
  };

  // ★レシピ生成ロジック
  const generateMenu = () => {
    const selectedFoods = items.filter(i => selectedIds.includes(i.id) && i.category === 'food');
    
    if (selectedFoods.length === 0) {
      alert("まずは上の一覧から、使いたい食材を選んでください！");
      return;
    }

    const availableSeasonings = items.filter(i => i.category === 'seasoning' && i.status === 'ok').map(i => i.name);
    const getSeasoning = () => availableSeasonings.length > 0 ? availableSeasonings.sort(() => 0.5 - Math.random()).slice(0, 2).join('と') : '塩・こしょう';

    const main = selectedFoods[0];
    const allIngredients = selectedFoods.map(f => `${f.name}(${f.quantity || '適量'})`).join('、');
    const seasoning = getSeasoning();

    // 難易度付きレシピ生成
    setRecipes([
      {
        title: `${main.name}のパパっと炒め`, 
        type: '🔥 炒め物',
        difficulty: '簡単',
        ingredients: [allIngredients, seasoning, 'サラダ油 大さじ1'],
        steps: ['フライパンに油を熱します。', `食べやすく切った${selectedFoods.map(f=>f.name).join('と')}を強火で炒めます。`, `${seasoning}を回し入れ、香りが立ったら完成！`]
      },
      {
        title: `${main.name}のじっくり煮込み`, 
        type: '🍲 煮込み',
        difficulty: '普通',
        ingredients: [allIngredients, seasoning, '水 300ml', 'ローリエ（あれば）'],
        steps: [`鍋に油をひき、具材を軽く炒めます。`, `水と${seasoning}を加え、沸騰したら弱火にします。`, '落とし蓋をして20分ほど煮込み、味が染みたら完成です。']
      },
      {
        title: `${main.name}の本格アレンジ`, 
        type: '👨‍🍳 アレンジ',
        difficulty: '難しい',
        ingredients: [allIngredients, seasoning, 'バター 10g', '白ワイン（または酒）'],
        steps: ['食材の下処理を丁寧に行います。', `フライパンで具材をソテーし、白ワインで蒸し焼きにします。`, `仕上げに${seasoning}とバターを絡め、ソースを乳化させたら完成です。`]
      }
    ]);
    
    // 生成したらリセットして閉じておく
    setExpandedIndex(null);
  };

  // ★★★ 献立・レシピ画面 ★★★
  if (view === 'menu') {
    // 在庫にある食材のみ抽出
    const foodStock = items.filter(i => i.category === 'food' && i.status === 'ok');

    return (
      <div className="p-4 space-y-8 pb-24">
        
        {/* ステップ1：食材選択エリア */}
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 border-b pb-2 mb-3">① 食材を選ぶ</h3>
          <div className="max-h-40 overflow-y-auto space-y-2 mb-4">
            {foodStock.length === 0 ? (
              <p className="text-sm text-gray-400">食材の在庫がありません。「食材の在庫」画面で登録してください。</p>
            ) : (
              foodStock.map(item => (
                <label key={item.id} className="flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)} 
                    onChange={() => toggleSelection(item.id)}
                    className="mr-3 w-5 h-5 accent-indigo-600"
                  />
                  <span className="text-gray-800 font-medium">{item.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{item.quantity}</span>
                </label>
              ))
            )}
          </div>
          <button 
            onClick={generateMenu} 
            disabled={selectedIds.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-white shadow transition ${
              selectedIds.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {selectedIds.length === 0 ? '食材を選んでください' : `${selectedIds.length}個の食材でレシピを考える！`}
          </button>
        </div>

        {/* ステップ2：レシピ提案（アコーディオン表示） */}
        {recipes.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 px-2">② 提案メニュー（クリックして詳細）</h3>
            
            {recipes.map((recipe, index) => {
              const isOpen = expandedIndex === index;
              // 難易度に応じた星と色
              const stars = recipe.difficulty === '簡単' ? '★' : recipe.difficulty === '普通' ? '★★' : '★★★';
              const difficultyColor = recipe.difficulty === '簡単' ? 'text-green-600' : recipe.difficulty === '普通' ? 'text-orange-500' : 'text-red-600';

              return (
                <div key={index} className="bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
                  {/* タイトルバー（常に表示・クリック可能） */}
                  <button 
                    onClick={() => setExpandedIndex(isOpen ? null : index)}
                    className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{recipe.type}</span>
                        <span className={`text-xs font-bold ${difficultyColor}`}>
                           {stars} {recipe.difficulty}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-gray-800">{recipe.title}</h4>
                    </div>
                    <span className={`text-2xl text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* 詳細エリア（開閉） */}
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
                        <ol className="list-decimal pl-5 text-gray-700 space-y-2">
                          {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
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

  // ★★★ 在庫リスト画面 (食材・調味料・日用品) ★★★
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
            showCheckbox={false} // 在庫リストではチェックボックス非表示
          />
        ))}
        {displayItems.length === 0 && <p className="text-center text-gray-400 py-4">登録なし</p>}
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