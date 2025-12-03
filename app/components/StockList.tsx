// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// カテゴリーに「調味料(seasoning)」を追加
type Category = 'food' | 'seasoning' | 'other';
type Status = 'ok' | 'buy';

type Item = {
  id: number;
  name: string;
  quantity: string; // 分量（例: 200g, 3個）
  category: Category;
  status: Status;
};

type Recipe = {
  title: string;
  type: string;
  ingredients: string[];
  steps: string[];
};

export default function StockList() {
  const [items, setItems] = useState<Item[]>([]);
  
  // 入力用
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('food');
  
  // 編集用（編集中アイテムのIDと、その一時的な値を保持）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');

  // 献立用選択チェックボックス
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // 提案レシピ
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // データ読み込み
  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) console.error('Error:', error);
    else setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // 追加
  const addItem = async () => {
    if (!newItemName) return;
    const { error } = await supabase.from('items').insert([
      { name: newItemName, quantity: newItemQuantity, category: newCategory, status: 'ok' }
    ]);
    if (!error) {
      setNewItemName('');
      setNewItemQuantity('');
      fetchItems();
    }
  };

  // 編集モード開始
  const startEditing = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity || '');
  };

  // 編集保存（グラム数や名前を更新）
  const saveEdit = async () => {
    if (editingId === null) return;
    
    // まず画面上の表示を更新（サクサク動かすため）
    setItems(items.map(i => i.id === editingId ? { ...i, name: editName, quantity: editQuantity } : i));
    
    // 裏でデータベースを更新
    await supabase.from('items').update({ name: editName, quantity: editQuantity }).eq('id', editingId);
    
    // 編集モード終了
    setEditingId(null);
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null);
  };

  // ステータス変更
  const toggleStatus = async (id: number, currentStatus: Status) => {
    const newStatus = currentStatus === 'ok' ? 'buy' : 'ok';
    setItems(items.map(i => i.id === id ? { ...i, status: newStatus } : i));
    await supabase.from('items').update({ status: newStatus }).eq('id', id);
  };

  // 削除
  const deleteItem = async (id: number) => {
    setItems(items.filter(i => i.id !== id));
    setSelectedIds(selectedIds.filter(sid => sid !== id)); // 選択状態からも削除
    await supabase.from('items').delete().eq('id', id);
  };

  // チェックボックスの切替
  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // ★レシピ生成ロジック（選択食材＋在庫調味料）
  const generateMenu = () => {
    // チェックされた食材を取得
    const selectedFoods = items.filter(i => selectedIds.includes(i.id) && i.category === 'food');
    
    if (selectedFoods.length === 0) {
      alert("使いたい食材にチェックを入れてください！");
      return;
    }

    // 在庫にある調味料を取得
    const availableSeasonings = items.filter(i => i.category === 'seasoning' && i.status === 'ok').map(i => i.name);
    
    // 調味料をランダムに選ぶ関数
    const getSeasoning = () => {
      if (availableSeasonings.length > 0) {
        const shuffled = [...availableSeasonings].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 2).join('と');
      }
      return '塩・こしょう'; // 在庫がない場合のデフォルト
    };

    const main = selectedFoods[0];
    const sub = selectedFoods[1] || { name: '卵', quantity: '適量' }; // 2つ目がなければ卵を仮想的に追加

    // 選択された全ての食材名を連結（表示用）
    const allIngredients = selectedFoods.map(f => `${f.name}(${f.quantity || '適量'})`).join('、');
    const seasoningName = getSeasoning();

    const newRecipes: Recipe[] = [];

    // 1. 炒め物
    newRecipes.push({
      title: `${main.name}の旨味たっぷり炒め`,
      type: '🔥 炒め物',
      ingredients: [allIngredients, seasoningName, '油 大さじ1'],
      steps: [
        'フライパンに油を熱します。',
        `食べやすく切った${selectedFoods.map(f=>f.name).join('と')}を入れて炒めます。`,
        `${seasoningName}で味付けをして完成です！`
      ]
    });

    // 2. 煮込み・スープ
    newRecipes.push({
      title: `${main.name}を使った特製スープ煮`,
      type: '🍲 煮込み',
      ingredients: [allIngredients, seasoningName, '水 400ml'],
      steps: [
        `鍋に水と${seasoningName}を入れて沸騰させます。`,
        `${selectedFoods.map(f=>f.name).join('と')}を入れます。`,
        '具材に火が通るまでコトコト煮込んだら完成です。'
      ]
    });

    // 3. アレンジ
    newRecipes.push({
      title: `${main.name}の簡単和え物`,
      type: '🥗 サラダ風',
      ingredients: [allIngredients, seasoningName, 'オリーブオイルまたはごま油'],
      steps: [
        `${selectedFoods.map(f=>f.name).join('と')}を加熱して火を通します。`,
        `ボウルに入れ、${seasoningName}とオイルでよく和えます。`,
        '味が馴染んだらお皿に盛り付けて完成！'
      ]
    });

    setRecipes(newRecipes);
  };

  // リストの分類
  const foodList = items.filter(i => i.category === 'food');
  const seasoningList = items.filter(i => i.category === 'seasoning');
  const otherList = items.filter(i => i.category === 'other');
  const shoppingList = items.filter(i => i.status === 'buy');

  return (
    <div className="p-4 space-y-8 pb-24">
      {/* 買い物リスト */}
      {shoppingList.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-300 shadow-md">
          <h2 className="font-bold text-yellow-800 text-lg mb-2">🛒 買い物リスト</h2>
          <ul className="space-y-2">
            {shoppingList.map(item => (
              <li key={item.id} className="flex justify-between items-center bg-white p-2 rounded">
                <div>
                  <span className="font-bold text-gray-800">{item.name}</span>
                  {item.quantity && <span className="text-sm text-gray-500 ml-2">({item.quantity})</span>}
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">
                  {item.category === 'food' ? '食品' : item.category === 'seasoning' ? '調味料' : '日用品'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アイテム追加エリア */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        <h3 className="font-bold text-gray-700">アイテム追加</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
             <select 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="border p-2 rounded bg-gray-50 text-black w-1/3"
            >
              <option value="food">🍎 食品</option>
              <option value="seasoning">🧂 調味料</option>
              <option value="other">🧻 日用品</option>
            </select>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="品名"
              className="border p-2 rounded flex-1 text-black"
            />
          </div>
          <input
            type="text"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            placeholder="分量 (例: 200g)...あとで変更可能"
            className="border p-2 rounded w-full text-black"
          />
        </div>
        <button onClick={addItem} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 transition">
          追加する
        </button>
      </div>

      {/* レシピ提案エリア */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-200">
          <div>
            <h3 className="font-bold text-orange-800">🍳 献立の提案</h3>
            <p className="text-xs text-orange-600">下のリストで使いたい食材に✅を入れてね</p>
          </div>
          <button onClick={generateMenu} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-orange-600">
            決定！
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {recipes.map((recipe, index) => (
            <div key={index} className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className={`p-2 text-white font-bold text-center ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-green-600' : 'bg-blue-500'}`}>
                {recipe.type} : {recipe.title}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-bold text-gray-700 text-sm border-b mb-1">材料</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-gray-700 text-sm border-b mb-1">作り方</p>
                  <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
                    {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 在庫リスト表示エリア */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 食品リスト */}
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🍎 食品の在庫</h3>
          <div className="space-y-2">
            {foodList.map(item => (
              <StockItem 
                key={item.id} 
                item={item} 
                isEditing={editingId === item.id}
                isSelected={selectedIds.includes(item.id)}
                editName={editName}
                editQuantity={editQuantity}
                setEditName={setEditName}
                setEditQuantity={setEditQuantity}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onEditStart={() => startEditing(item)}
                onToggleStatus={toggleStatus} 
                onDelete={deleteItem} 
                onToggleSelect={toggleSelection}
                showCheckbox={true} // 食品にはチェックボックスを表示
              />
            ))}
          </div>
        </div>

        {/* 調味料リスト */}
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🧂 調味料の在庫</h3>
          <div className="space-y-2">
            {seasoningList.map(item => (
              <StockItem 
                key={item.id} item={item} isEditing={editingId === item.id} isSelected={false}
                editName={editName} editQuantity={editQuantity} setEditName={setEditName} setEditQuantity={setEditQuantity}
                onSave={saveEdit} onCancel={cancelEdit} onEditStart={() => startEditing(item)}
                onToggleStatus={toggleStatus} onDelete={deleteItem} onToggleSelect={toggleSelection}
                showCheckbox={false}
              />
            ))}
          </div>
        </div>

        {/* 日用品リスト */}
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🧻 日用品の在庫</h3>
          <div className="space-y-2">
            {otherList.map(item => (
              <StockItem 
                key={item.id} item={item} isEditing={editingId === item.id} isSelected={false}
                editName={editName} editQuantity={editQuantity} setEditName={setEditName} setEditQuantity={setEditQuantity}
                onSave={saveEdit} onCancel={cancelEdit} onEditStart={() => startEditing(item)}
                onToggleStatus={toggleStatus} onDelete={deleteItem} onToggleSelect={toggleSelection}
                showCheckbox={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// リストアイテム部品（編集・チェックボックス機能付き）
function StockItem({ 
  item, isEditing, isSelected, editName, editQuantity, showCheckbox,
  setEditName, setEditQuantity, onSave, onCancel, onEditStart, onToggleStatus, onDelete, onToggleSelect
}: any) {
  
  if (isEditing) {
    // 編集中の表示
    return (
      <div className="bg-blue-50 p-2 rounded border border-blue-300 flex flex-col gap-2">
        <input 
          value={editName} 
          onChange={e => setEditName(e.target.value)} 
          className="border p-1 rounded text-black w-full"
          placeholder="名前"
        />
        <input 
          value={editQuantity} 
          onChange={e => setEditQuantity(e.target.value)} 
          className="border p-1 rounded text-black w-full"
          placeholder="分量"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-xs bg-gray-300 px-2 py-1 rounded text-black">キャンセル</button>
          <button onClick={onSave} className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold">保存</button>
        </div>
      </div>
    );
  }

  // 通常時の表示
  return (
    <div className={`flex items-center p-2 rounded border shadow-sm ${item.status === 'buy' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      
      {/* 左：チェックボックス（食品のみ） */}
      {showCheckbox && item.status === 'ok' && (
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect(item.id)}
          className="mr-3 w-5 h-5 accent-orange-500 cursor-pointer"
        />
      )}

      {/* 中：名前と分量 */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${item.status === 'buy' ? 'text-red-500' : 'text-gray-800'}`}>
            {item.name}
          </span>
          {/* 編集ボタン（鉛筆） */}
          <button onClick={onEditStart} className="text-gray-400 hover:text-blue-500">
            ✏️
          </button>
        </div>
        {item.quantity && <span className="text-xs text-gray-500 block">{item.quantity}</span>}
      </div>
      
      {/* 右：在庫ボタンと削除 */}
      <div className="flex gap-2 ml-2">
        <button
          onClick={() => onToggleStatus(item.id, item.status)}
          className={`text-xs px-2 py-1 rounded font-bold transition whitespace-nowrap ${
            item.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {item.status === 'ok' ? 'ある' : 'ない'}
        </button>
        <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-500 px-1">✕</button>
      </div>
    </div>
  );
}