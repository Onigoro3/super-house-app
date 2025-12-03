// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Category = 'food' | 'other';
type Status = 'ok' | 'buy';

type Item = {
  id: number;
  name: string;
  category: Category;
  status: Status;
};

export default function StockList() {
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('food');
  const [menuIdea, setMenuIdea] = useState('');

  // データの読み込み
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

  // アイテム追加
  const addItem = async () => {
    if (!newItemName) return;
    const { error } = await supabase.from('items').insert([
      { name: newItemName, category: newCategory, status: 'ok' }
    ]);

    if (!error) {
      setNewItemName('');
      fetchItems();
    }
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
    await supabase.from('items').delete().eq('id', id);
  };

  // 献立提案（修正箇所）
  const generateMenu = () => {
    const availableFoods = items.filter(i => i.category === 'food' && i.status === 'ok').map(i => i.name);
    
    if (availableFoods.length === 0) {
      setMenuIdea("冷蔵庫が空っぽです！まずは買い出しに行きましょう。");
      return;
    }

    const shuffled = availableFoods.sort(() => 0.5 - Math.random());
    // ↓↓ ここを修正しました ↓↓
    const main = shuffled[0];
    const sub = shuffled[1] || '卵';

    const ideas = [
      `👨‍🍳 「${main}」と「${sub}」のピリ辛炒め`,
      `🍲 「${main}」をたっぷり入れたお味噌汁と、「${sub}」の和え物`,
      `🍝 「${main}」を使った和風パスタ（隠し味に${sub}）`,
      `🍛 具だくさん！「${main}」カレー（${sub}添え）`,
    ];
    setMenuIdea(ideas[Math.floor(Math.random() * ideas.length)]);
  };

  const foods = items.filter(i => i.category === 'food');
  const others = items.filter(i => i.category === 'other');
  const shoppingList = items.filter(i => i.status === 'buy');

  return (
    <div className="p-4 space-y-8 pb-24">
      {shoppingList.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-300 shadow-md">
          <h2 className="font-bold text-yellow-800 text-lg mb-2 flex items-center">
            🛒 買い物リスト ({shoppingList.length})
          </h2>
          <ul className="space-y-2">
            {shoppingList.map(item => (
              <li key={item.id} className="flex justify-between items-center bg-white p-2 rounded">
                <span className="font-bold text-gray-800">{item.name}</span>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">
                  {item.category === 'food' ? '食品' : '日用品'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        <h3 className="font-bold text-gray-700">アイテム追加</h3>
        <div className="flex gap-2">
          <select 
            value={newCategory} 
            onChange={(e) => setNewCategory(e.target.value as Category)}
            className="border p-2 rounded bg-gray-50 text-black"
          >
            <option value="food">🍎 食品</option>
            <option value="other">🧻 日用品</option>
          </select>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="品名 (例: 豚肉)"
            className="border p-2 rounded flex-1 text-black"
          />
        </div>
        <button onClick={addItem} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 transition">
          追加する
        </button>
      </div>

      <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-orange-800">🍳 今日のご飯どうする？</h3>
          <button onClick={generateMenu} className="bg-orange-500 text-white text-sm px-3 py-2 rounded-lg font-bold hover:bg-orange-600 shadow">
            提案して！
          </button>
        </div>
        {menuIdea && (
          <div className="bg-white p-3 rounded-lg border-l-4 border-orange-500 animate-pulse">
            <p className="text-gray-800 font-medium">{menuIdea}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🍎 食品の在庫</h3>
          <div className="space-y-2">
            {foods.map(item => (
              <StockItem key={item.id} item={item} onToggle={toggleStatus} onDelete={deleteItem} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🧻 日用品の在庫</h3>
          <div className="space-y-2">
            {others.map(item => (
              <StockItem key={item.id} item={item} onToggle={toggleStatus} onDelete={deleteItem} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StockItem({ item, onToggle, onDelete }: { item: Item, onToggle: (id: number, status: Status) => void, onDelete: (id: number) => void }) {
  return (
    <div className={`flex justify-between items-center p-3 rounded border shadow-sm ${item.status === 'buy' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <span className={`font-medium ${item.status === 'buy' ? 'text-red-500' : 'text-gray-800'}`}>
        {item.name}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onToggle(item.id, item.status)}
          className={`text-xs px-3 py-2 rounded-full font-bold transition ${
            item.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {item.status === 'ok' ? 'ある' : 'ない'}
        </button>
        <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-500 px-2">✕</button>
      </div>
    </div>
  );
}