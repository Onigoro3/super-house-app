// app/components/StockList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Category = 'food' | 'other';
type Status = 'ok' | 'buy';

type Item = {
  id: number;
  name: string;
  quantity: string; // 分量（例: 200g, 3個）
  category: Category;
  status: Status;
};

// レシピの型定義
type Recipe = {
  title: string;
  type: string; // 和風、洋風など
  ingredients: string[];
  steps: string[];
};

export default function StockList() {
  const [items, setItems] = useState<Item[]>([]);
  
  // 入力用ステート
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('food');
  
  // 提案されたレシピ（3つ）
  const [recipes, setRecipes] = useState<Recipe[]>([]);

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

  // アイテム追加（分量含む）
  const addItem = async () => {
    if (!newItemName) return;
    const { error } = await supabase.from('items').insert([
      { 
        name: newItemName, 
        quantity: newItemQuantity, // 分量も保存
        category: newCategory, 
        status: 'ok' 
      }
    ]);

    if (!error) {
      setNewItemName('');
      setNewItemQuantity('');
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

  // ★レシピ生成ロジック（3案作成）
  const generateMenu = () => {
    const foods = items.filter(i => i.category === 'food' && i.status === 'ok');
    
    if (foods.length === 0) {
      alert("食材の在庫がありません！まずは登録してください。");
      return;
    }

    // ランダムに食材を選ぶ関数
    const pick = () => foods[Math.floor(Math.random() * foods.length)];

    // 3つの異なるレシピを生成
    const newRecipes: Recipe[] = [];
    
    // 1. 炒め物（中華風）
    const main1 = pick();
    const sub1 = pick();
    newRecipes.push({
      title: `${main1.name}と${sub1.name}のガッツリ中華炒め`,
      type: '🇨🇳 中華風',
      ingredients: [
        `${main1.name} (${main1.quantity || '適量'})`,
        `${sub1.name} (${sub1.quantity || '適量'})`,
        'ごま油 大さじ1',
        '鶏ガラスープの素 小さじ1'
      ],
      steps: [
        `フライパンにごま油を熱し、${main1.name}を色が変わるまで炒めます。`,
        `${sub1.name}を加えてさらに炒め合わせます。`,
        '鶏ガラスープの素と塩胡椒で味を整えたら完成！'
      ]
    });

    // 2. 煮物・スープ（和風）
    const main2 = pick();
    const sub2 = pick();
    newRecipes.push({
      title: `${main2.name}のほっこり和風煮`,
      type: '🇯🇵 和風',
      ingredients: [
        `${main2.name} (${main2.quantity || '適量'})`,
        `${sub2.name} (${sub2.quantity || '適量'})`,
        'だし汁 300ml',
        '醤油・みりん 各大さじ2'
      ],
      steps: [
        `鍋にだし汁を入れて沸騰させ、${main2.name}を入れます。`,
        `アクを取りながら5分煮たら、${sub2.name}を加えます。`,
        '調味料を入れ、落とし蓋をして弱火で味が染みるまで煮込みます。'
      ]
    });

    // 3. アレンジ（洋風）
    const main3 = pick();
    newRecipes.push({
      title: `${main3.name}のガーリックバターソテー`,
      type: '🇮🇹 洋風',
      ingredients: [
        `${main3.name} (${main3.quantity || '適量'})`,
        'にんにく 1片',
        'バター 10g',
        '醤油 少々'
      ],
      steps: [
        'フライパンにバターとスライスしたにんにくを入れて弱火で香を出します。',
        `${main3.name}を入れて中火でこんがり焼きます。`,
        '最後に鍋肌から醤油を回し入れ、香ばしく仕上げます。'
      ]
    });

    setRecipes(newRecipes);
  };

  const foodList = items.filter(i => i.category === 'food');
  const otherList = items.filter(i => i.category === 'other');
  const shoppingList = items.filter(i => i.status === 'buy');

  return (
    <div className="p-4 space-y-8 pb-24">
      {/* 買い物リスト */}
      {shoppingList.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-300 shadow-md">
          <h2 className="font-bold text-yellow-800 text-lg mb-2 flex items-center">
            🛒 買い物リスト ({shoppingList.length})
          </h2>
          <ul className="space-y-2">
            {shoppingList.map(item => (
              <li key={item.id} className="flex justify-between items-center bg-white p-2 rounded">
                <div>
                  <span className="font-bold text-gray-800">{item.name}</span>
                  {item.quantity && <span className="text-sm text-gray-500 ml-2">({item.quantity})</span>}
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">
                  {item.category === 'food' ? '食品' : '日用品'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        <h3 className="font-bold text-gray-700">アイテム追加</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
             <select 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="border p-2 rounded bg-gray-50 text-black w-1/3"
            >
              <option value="food">食品</option>
              <option value="other">日用品</option>
            </select>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="品名 (例: 豚肉)"
              className="border p-2 rounded flex-1 text-black"
            />
          </div>
          <input
            type="text"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            placeholder="分量・個数 (例: 200g, 3個)...空白でもOK"
            className="border p-2 rounded w-full text-black"
          />
        </div>
        <button onClick={addItem} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow hover:bg-blue-700 transition">
          追加する
        </button>
      </div>

      {/* レシピ提案エリア */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
           <h3 className="font-bold text-gray-800 text-lg">🍳 献立の提案</h3>
           <button 
            onClick={generateMenu}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-orange-600"
          >
            3案つくる！
          </button>
        </div>

        {/* 3つのレシピカードを表示 */}
        <div className="grid grid-cols-1 gap-4">
          {recipes.map((recipe, index) => (
            <div key={index} className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className={`p-2 text-white font-bold text-center ${
                index === 0 ? 'bg-red-500' : index === 1 ? 'bg-green-600' : 'bg-blue-500'
              }`}>
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

      {/* 在庫リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🍎 食品の在庫</h3>
          <div className="space-y-2">
            {foodList.map(item => (
              <StockItem key={item.id} item={item} onToggle={toggleStatus} onDelete={deleteItem} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gray-600 border-b pb-2 mb-3">🧻 日用品の在庫</h3>
          <div className="space-y-2">
            {otherList.map(item => (
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
      <div className="flex flex-col">
        <span className={`font-medium ${item.status === 'buy' ? 'text-red-500' : 'text-gray-800'}`}>
          {item.name}
        </span>
        {/* 分量があれば表示 */}
        {item.quantity && <span className="text-xs text-gray-500">{item.quantity}</span>}
      </div>
      
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