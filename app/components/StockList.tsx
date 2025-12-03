// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Category = 'food' | 'seasoning' | 'other';
type Status = 'ok' | 'buy';
type ViewType = 'food' | 'seasoning' | 'other' | 'menu'; // このコンポーネントが扱う画面

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
  ingredients: string[];
  steps: string[];
};

// 親から「今の画面」を受け取る
export default function StockList({ view }: { view: ViewType }) {
  const [items, setItems] = useState<Item[]>([]);
  
  // 入力用
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  
  // 編集・選択用
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // レシピ
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // データ読み込み
  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: true });
    if (!error) setItems(data || []);
  };

  useEffect(() => { fetchItems(); }, []);

  // 追加（現在の画面に合わせてカテゴリーを自動決定）
  const addItem = async () => {
    if (!newItemName) return;
    // 現在のviewをcategoryに変換（menuの時はfood扱い）
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

  // 各種操作関数（前回と同じ）
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
    selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(sid => sid !== id)) : setSelectedIds([...selectedIds, id]);
  };

  // レシピ生成
  const generateMenu = () => {
    const selectedFoods = items.filter(i => selectedIds.includes(i.id) && i.category === 'food');
    if (selectedFoods.length === 0) { alert("「食材の在庫」画面で、使いたい食材にチェックを入れてください！"); return; }
    
    const availableSeasonings = items.filter(i => i.category === 'seasoning' && i.status === 'ok').map(i => i.name);
    const getSeasoning = () => availableSeasonings.length > 0 ? availableSeasonings.sort(() => 0.5 - Math.random()).slice(0, 2).join('と') : '塩・こしょう';

    const main = selectedFoods[0];
    const allIngredients = selectedFoods.map(f => `${f.name}(${f.quantity || '適量'})`).join('、');
    const seasoning = getSeasoning();

    setRecipes([
      {
        title: `${main.name}の旨味炒め`, type: '🔥 炒め物',
        ingredients: [allIngredients, seasoning, '油 大さじ1'],
        steps: ['フライパンに油を熱します。', `切った${selectedFoods.map(f=>f.name).join('と')}を炒めます。`, `${seasoning}で味を調えて完成！`]
      },
      {
        title: `${main.name}の煮込み`, type: '🍲 煮込み',
        ingredients: [allIngredients, seasoning, '水 300ml'],
        steps: [`鍋に水と${seasoning}を入れて沸騰させます。`, '具材を入れて火が通るまで煮込みます。', '味が染みたら完成です。']
      },
      {
        title: `${main.name}のサラダ風`, type: '🥗 和え物',
        ingredients: [allIngredients, seasoning, 'オリーブオイル'],
        steps: ['具材を加熱して火を通します。', `ボウルで${seasoning}とオイルと和えます。`, '器に盛り付けて完成。']
      }
    ]);
  };

  // 表示モード切り替え
  if (view === 'menu') {
    // ★★★ 献立画面 ★★★
    return (
      <div className="p-4 space-y-6 pb-24">
        <div className="bg-indigo-50 p-6 rounded-xl text-center border-2 border-indigo-100">
          <h2 className="text-2xl font-bold text-indigo-800 mb-2">👨‍🍳 シェフの献立提案</h2>
          <p className="text-gray-600 mb-4">
            「食材の在庫」でチェックを入れた食材 ({selectedIds.length}個) を使います
          </p>
          <button onClick={generateMenu} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition transform hover:scale-105">
            レシピを考える！
          </button>
        </div>

        <div className="grid gap-6">
          {recipes.map((recipe, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className={`p-3 text-white font-bold text-center text-lg ${index===0?'bg-orange-500':index===1?'bg-emerald-500':'bg-blue-500'}`}>
                {recipe.type} {recipe.title}
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="font-bold text-gray-700 border-b-2 border-gray-100 pb-1 mb-2">🥕 材料</h4>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1">
                    {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-700 border-b-2 border-gray-100 pb-1 mb-2">🍳 作り方</h4>
                  <ol className="list-decimal pl-5 text-gray-600 space-y-2">
                    {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              </div>
            </div>
          ))}
          {recipes.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              ボタンを押すとここにレシピが表示されます
            </div>
          )}
        </div>
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
      {/* タイトル */}
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3">
        {view === 'food' ? '🍎 食材リスト' : view === 'seasoning' ? '🧂 調味料リスト' : '🧻 日用品リスト'}
      </h2>

      {/* 買い物リスト（このカテゴリの分だけ表示） */}
      {shoppingList.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <h3 className="font-bold text-yellow-800 mb-2">🛒 買うもの ({shoppingList.length})</h3>
          <ul className="space-y-1">
            {shoppingList.map(item => (
              <li key={item.id} className="flex justify-between text-sm bg-white px-2 py-1 rounded">
                <span>{item.name}</span>
                <span className="text-gray-400">{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 追加フォーム */}
      <div className="bg-white p-3 rounded-xl border shadow-sm flex gap-2">
        <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="品名を追加" className="border p-2 rounded flex-1 text-black" />
        <input value={newItemQuantity} onChange={e => setNewItemQuantity(e.target.value)} placeholder="分量" className="border p-2 rounded w-20 text-black" />
        <button onClick={addItem} className="bg-blue-600 text-white px-4 rounded font-bold">＋</button>
      </div>

      {/* リスト一覧 */}
      <div className="space-y-2">
        {displayItems.map(item => (
          <StockItem 
            key={item.id} item={item} isEditing={editingId === item.id}
            isSelected={selectedIds.includes(item.id)} showCheckbox={view === 'food'}
            editName={editName} editQuantity={editQuantity} setEditName={setEditName} setEditQuantity={setEditQuantity}
            onSave={saveEdit} onCancel={() => setEditingId(null)} onEditStart={() => startEditing(item)}
            onToggleStatus={toggleStatus} onDelete={deleteItem} onToggleSelect={toggleSelection}
          />
        ))}
        {displayItems.length === 0 && <p className="text-center text-gray-400 py-4">登録なし</p>}
      </div>
    </div>
  );
}

// 部品（前回と同じですが、少し調整）
function StockItem({ item, isEditing, isSelected, showCheckbox, editName, editQuantity, setEditName, setEditQuantity, onSave, onCancel, onEditStart, onToggleStatus, onDelete, onToggleSelect }: any) {
  if (isEditing) {
    return (
      <div className="bg-blue-50 p-2 rounded border border-blue-300 flex gap-2 items-center">
        <input value={editName} onChange={e => setEditName(e.target.value)} className="border p-1 rounded w-full text-black" />
        <input value={editQuantity} onChange={e => setEditQuantity(e.target.value)} className="border p-1 rounded w-20 text-black" />
        <button onClick={onSave} className="bg-blue-500 text-white px-2 py-1 rounded text-xs">保存</button>
      </div>
    );
  }
  return (
    <div className={`flex items-center p-3 rounded-lg border shadow-sm ${item.status === 'buy' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      {showCheckbox && item.status === 'ok' && (
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} className="mr-3 w-5 h-5 accent-indigo-600" />
      )}
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