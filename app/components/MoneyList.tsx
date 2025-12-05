// app/components/MoneyList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Expense = {
  id: number;
  name: string;
  price: number;
  date: string;
  category: string; // カテゴリ追加
};

export default function MoneyList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('固定費'); // デフォルト
  const [loading, setLoading] = useState(false);

  // データ読み込み
  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) console.error('読み込みエラー:', error);
    else setExpenses(data || []);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // 登録処理
  const addExpense = async () => {
    if (!name || !price) return alert("名称と金額を入力してください");
    
    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').insert([
        { 
          name, 
          price: parseInt(price), 
          date: date || '毎月', 
          category 
        }
      ]);

      if (error) throw error;

      // 成功したらリセットして再読み込み
      setName('');
      setPrice('');
      setDate('');
      fetchExpenses();
      alert("登録しました！");

    } catch (e: any) {
      console.error(e);
      alert(`登録エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 削除処理
  const deleteExpense = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  // 合計計算
  const total = expenses.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* 合計カード */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 rounded-2xl text-white shadow-lg text-center">
        <p className="text-sm opacity-90 mb-1">毎月の固定費・支出合計</p>
        <p className="text-4xl font-bold tracking-tight">¥{total.toLocaleString()}</p>
      </div>

      {/* 入力フォーム */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">支出の追加</h3>
        <div className="flex flex-col gap-2">
          <input 
            type="text" value={name} onChange={e => setName(e.target.value)} 
            placeholder="名称 (例: 家賃、Netflix)" 
            className="border p-2 rounded text-black" 
          />
          <div className="flex gap-2">
            <input 
              type="number" value={price} onChange={e => setPrice(e.target.value)} 
              placeholder="金額" 
              className="border p-2 rounded text-black flex-1" 
            />
            <input 
              type="text" value={date} onChange={e => setDate(e.target.value)} 
              placeholder="支払日 (例: 25日)" 
              className="border p-2 rounded text-black w-1/3" 
            />
          </div>
          {/* カテゴリ選択 */}
          <select 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            className="border p-2 rounded text-black bg-gray-50"
          >
            <option value="固定費">🏠 固定費 (家賃・光熱費)</option>
            <option value="サブスク">📱 サブスク</option>
            <option value="ローン">💳 ローン・返済</option>
            <option value="その他">✨ その他</option>
          </select>
        </div>
        <button 
          onClick={addExpense} 
          disabled={loading}
          className="w-full bg-yellow-500 text-white py-2 rounded-lg font-bold hover:bg-yellow-600 shadow"
        >
          {loading ? '登録中...' : '登録する'}
        </button>
      </div>

      {/* リスト表示 */}
      <div className="space-y-3">
        {expenses.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-400">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.category || '固定費'}</span>
                <p className="font-bold text-gray-800 text-lg">{item.name}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">支払日: {item.date}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-700 text-lg">¥{item.price.toLocaleString()}</span>
              <button onClick={() => deleteExpense(item.id)} className="text-gray-300 hover:text-red-500 text-xl">✕</button>
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-center text-gray-400 py-4">登録データがありません</p>}
      </div>
    </div>
  );
}