// app/components/MoneyList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Expense = {
  id: number;
  name: string;
  price: number;
  date: string;
  category: string;
};

// カテゴリごとの色定義
const CAT_COLORS: Record<string, string> = {
  '固定費': '#EF4444', // 赤
  '食費': '#F59E0B',   // オレンジ
  '日用品': '#10B981', // 緑
  'サブスク': '#8B5CF6', // 紫
  '娯楽': '#EC4899',   // ピンク
  '交通費': '#3B82F6', // 青
  'その他': '#6B7280', // グレー
};

export default function MoneyList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // 入力用
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('食費');
  
  // 設定用
  const [budget, setBudget] = useState(50000); // 目標予算（デフォルト5万）
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // データ読み込み
  const fetchExpenses = async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (!error) setExpenses(data || []);
    
    // 予算をローカルストレージから復元
    const savedBudget = localStorage.getItem('monthly_budget');
    if (savedBudget) setBudget(parseInt(savedBudget));
  };

  useEffect(() => { fetchExpenses(); }, []);

  // 登録
  const addExpense = async () => {
    if (!name || !price) return alert("名称と金額を入力してください");
    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').insert([{ 
        name, price: parseInt(price), date: date || new Date().toISOString().split('T')[0], category 
      }]);
      if (error) throw error;
      setName(''); setPrice(''); setDate(''); fetchExpenses();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  // 削除
  const deleteExpense = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  // レシート解析
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/receipt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: reader.result, mode: 'money' }) // ★moneyモード指定
        });
        if (!res.ok) throw new Error('解析失敗');
        const data: any[] = await res.json();
        
        if (data.length > 0) {
          const item = data[0];
          setName(item.name);
          setPrice(item.price);
          setDate(item.date);
          setCategory(item.category);
          alert(`読み取りました！\n${item.name} : ¥${item.price}`);
        }
      } catch (e) { alert('読み取り失敗'); } finally { setIsAnalyzing(false); e.target.value = ''; }
    };
    reader.readAsDataURL(file);
  };

  // 予算変更
  const handleBudgetChange = (val: string) => {
    const num = parseInt(val);
    setBudget(num);
    localStorage.setItem('monthly_budget', val);
  };

  // 集計ロジック
  const total = expenses.reduce((sum, item) => sum + item.price, 0);
  const remaining = budget - total;
  const progress = Math.min(100, (total / budget) * 100);

  // カテゴリ別集計（円グラフ用）
  const catTotals = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.price;
    return acc;
  }, {} as Record<string, number>);
  
  // 円グラフのCSSグラデーション作成
  let currentDeg = 0;
  const conicGradient = Object.entries(catTotals).map(([cat, amount]) => {
    const deg = (amount / total) * 360;
    const color = CAT_COLORS[cat] || '#999';
    const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
    currentDeg += deg;
    return str;
  }).join(', ');

  // カレンダー生成用
  const getDaysInMonth = () => {
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      
      {/* 1. 予算・グラフカード */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-6 items-center">
        {/* 円グラフ */}
        <div className="relative w-32 h-32 shrink-0">
          <div 
            className="w-full h-full rounded-full"
            style={{ background: total > 0 ? `conic-gradient(${conicGradient})` : '#eee' }}
          ></div>
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center flex-col">
            <span className="text-xs text-gray-400">支出計</span>
            <span className="font-bold text-lg">¥{total.toLocaleString()}</span>
          </div>
        </div>

        {/* 予算バー */}
        <div className="flex-1 w-full">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-bold text-gray-600">今月の予算</span>
            <input 
              type="number" value={budget} 
              onChange={e => handleBudgetChange(e.target.value)}
              className="text-right font-bold text-blue-600 border-b border-dashed border-blue-300 w-24 outline-none"
            />
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{progress.toFixed(1)}% 使用</span>
            <span className={`font-bold text-xl ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
              あと ¥{remaining.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 入力エリア */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-700">📝 支出入力</h3>
          <label className={`text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold cursor-pointer hover:bg-blue-200 ${isAnalyzing?'opacity-50':''}`}>
            {isAnalyzing ? '解析中...' : '📷 レシート読取'}
            <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isAnalyzing} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
           <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="品名 (例: ランチ)" className="border p-2 rounded w-full col-span-2" />
           <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="金額" className="border p-2 rounded w-full" />
           <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded w-full text-sm" />
           <select value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded w-full col-span-2 bg-white">
             {Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        <button onClick={addExpense} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow">
          {loading ? '...' : '追加する'}
        </button>
      </div>

      {/* 3. 表示切り替えタブ */}
      <div className="flex bg-gray-200 p-1 rounded-lg">
        <button onClick={() => setViewMode('list')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}>📜 リスト</button>
        <button onClick={() => setViewMode('calendar')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'calendar' ? 'bg-white shadow' : 'text-gray-500'}`}>📅 カレンダー</button>
      </div>

      {/* 4. リスト表示 */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {expenses.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm" style={{ borderLeft: `4px solid ${CAT_COLORS[item.category]||'#999'}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{item.date}</span>
                  <span className="text-xs text-white px-2 rounded-full" style={{ backgroundColor: CAT_COLORS[item.category]||'#999' }}>{item.category}</span>
                </div>
                <p className="font-bold text-gray-800">{item.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">¥{item.price.toLocaleString()}</span>
                <button onClick={() => deleteExpense(item.id)} className="text-gray-300 hover:text-red-500">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. カレンダー表示 */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-7 gap-1 text-center">
          {['日','月','火','水','木','金','土'].map(d => <div key={d} className="text-xs font-bold text-gray-400 py-1">{d}</div>)}
          {getDaysInMonth().map(day => {
            // 今日の日付文字列作成 (YYYY-MM-DD) - 簡易実装(今月のみ)
            const today = new Date();
            const dStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayExpenses = expenses.filter(e => e.date === dStr);
            const dayTotal = dayExpenses.reduce((sum, e) => sum + e.price, 0);
            
            return (
              <div key={day} className="bg-white rounded border min-h-[50px] flex flex-col items-center justify-start py-1 relative">
                <span className="text-xs font-bold text-gray-500">{day}</span>
                {dayTotal > 0 && (
                  <div className="mt-1">
                    <span className="text-[10px] font-bold text-red-500 block">¥{dayTotal.toLocaleString()}</span>
                    <div className="flex gap-0.5 justify-center mt-1 flex-wrap px-1">
                      {dayExpenses.map(e => (
                        <div key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CAT_COLORS[e.category]||'#999' }} />
                      ))}
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