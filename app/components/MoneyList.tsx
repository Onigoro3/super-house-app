// app/components/MoneyList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Expense = {
  id: number;
  name: string;
  price: number;
  date: string;     // "2023-12-01" (単発の場合)
  category: string;
  is_recurring: boolean; // 毎月かどうか
  recurring_day: number; // 毎月何日か
};

const CAT_COLORS: Record<string, string> = {
  '固定費': '#EF4444', '食費': '#F59E0B', '日用品': '#10B981',
  'サブスク': '#8B5CF6', '娯楽': '#EC4899', '交通費': '#3B82F6', 'その他': '#6B7280',
};

export default function MoneyList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // 入力用
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(''); // 単発用日付
  const [recurringDay, setRecurringDay] = useState(''); // 毎月用日付
  const [category, setCategory] = useState('食費');
  
  // カレンダー表示月
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [budget, setBudget] = useState(50000);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchExpenses = async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (!error) setExpenses(data || []);
    const savedBudget = localStorage.getItem('monthly_budget');
    if (savedBudget) setBudget(parseInt(savedBudget));
  };

  useEffect(() => { fetchExpenses(); setDate(new Date().toISOString().split('T')[0]); }, []);

  // 登録処理
  const addExpense = async () => {
    if (!name || !price) return alert("名称と金額を入力してください");
    setLoading(true);
    
    // 固定費・サブスクなら「毎月」扱いにする
    const isRecurring = category === '固定費' || category === 'サブスク';
    
    try {
      const { error } = await supabase.from('expenses').insert([{ 
        name, 
        price: parseInt(price), 
        date: isRecurring ? '' : date, // 毎月の場合は日付空欄
        category,
        is_recurring: isRecurring,
        recurring_day: isRecurring ? parseInt(recurringDay) : null
      }]);

      if (error) throw error;
      
      setName(''); setPrice(''); 
      // 日付リセット
      if(isRecurring) setRecurringDay(''); 
      else setDate(new Date().toISOString().split('T')[0]);
      
      fetchExpenses();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

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
          body: JSON.stringify({ imageBase64: reader.result, mode: 'money' })
        });
        if (!res.ok) throw new Error('解析失敗');
        const data: any[] = await res.json();
        if (data.length > 0) {
          const item = data[0];
          setName(item.name); setPrice(item.price); setDate(item.date); setCategory(item.category);
          alert(`読み取りました！\n${item.name} : ¥${item.price}`);
        }
      } catch (e) { alert('読み取り失敗'); } finally { setIsAnalyzing(false); e.target.value = ''; }
    };
    reader.readAsDataURL(file);
  };

  // カレンダー操作
  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  // カレンダー用データ生成（今月の支出 ＋ 毎月の固定費）
  const getCalendarData = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1; // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const calendar = [];
    for (let d = 1; d <= daysInMonth; d++) {
      // 1. その日の単発支出を探す
      const dayStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayItems = expenses.filter(e => !e.is_recurring && e.date === dayStr);
      
      // 2. 毎月の固定費を探す
      const recurringItems = expenses.filter(e => e.is_recurring && e.recurring_day === d);
      
      calendar.push({
        day: d,
        items: [...dayItems, ...recurringItems]
      });
    }
    return calendar;
  };

  // 今月の合計計算（固定費含む）
  const currentMonthData = getCalendarData();
  const monthTotal = currentMonthData.reduce((sum, day) => sum + day.items.reduce((s, i) => s + i.price, 0), 0);
  const remaining = budget - monthTotal;
  const progress = Math.min(100, (monthTotal / budget) * 100);

  // カテゴリ集計
  const catTotals: Record<string, number> = {};
  currentMonthData.forEach(day => {
    day.items.forEach(item => {
      catTotals[item.category] = (catTotals[item.category] || 0) + item.price;
    });
  });
  let currentDeg = 0;
  const conicGradient = Object.entries(catTotals).map(([cat, amount]) => {
    const deg = (amount / monthTotal) * 360;
    const color = CAT_COLORS[cat] || '#999';
    const str = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
    currentDeg += deg;
    return str;
  }).join(', ');

  // 入力モード判定
  const isRecurringInput = category === '固定費' || category === 'サブスク';

  return (
    <div className="p-4 space-y-6 pb-24">
      
      {/* 予算・グラフカード */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative w-32 h-32 shrink-0">
          <div className="w-full h-full rounded-full" style={{ background: monthTotal > 0 ? `conic-gradient(${conicGradient})` : '#eee' }}></div>
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center flex-col">
            <span className="text-xs text-gray-400">今月の支出</span>
            <span className="font-bold text-lg">¥{monthTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-bold text-gray-600">{currentMonth.getMonth()+1}月の予算</span>
            <input type="number" value={budget} onChange={e => { setBudget(parseInt(e.target.value)); localStorage.setItem('monthly_budget', e.target.value); }} className="text-right font-bold text-blue-600 border-b border-dashed border-blue-300 w-24 outline-none" />
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className={`h-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{progress.toFixed(1)}% 使用</span>
            <span className={`font-bold text-xl ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>あと ¥{remaining.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 入力エリア */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-700">📝 支出入力</h3>
          <label className={`text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold cursor-pointer ${isAnalyzing?'opacity-50':''}`}>
            {isAnalyzing ? '...' : '📷 レシート'}
            <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isAnalyzing} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
           <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="品名 (例: Netflix)" className="border p-2 rounded w-full col-span-2" />
           <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="金額" className="border p-2 rounded w-full" />
           
           {/* 日付入力（カテゴリによって変化） */}
           {isRecurringInput ? (
             <div className="flex items-center border p-2 rounded w-full bg-orange-50 border-orange-200">
               <span className="text-xs text-orange-600 mr-1 font-bold">毎月</span>
               <input 
                 type="number" min="1" max="31" 
                 value={recurringDay} onChange={e => setRecurringDay(e.target.value)} 
                 placeholder="日" 
                 className="w-full bg-transparent outline-none text-right font-bold" 
               />
               <span className="text-xs text-gray-500 ml-1">日</span>
             </div>
           ) : (
             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded w-full text-sm" />
           )}

           <select value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded w-full col-span-2 bg-white">
             <option value="食費">食費</option>
             <option value="日用品">日用品</option>
             <option value="固定費">🏠 固定費 (毎月)</option>
             <option value="サブスク">📱 サブスク (毎月)</option>
             <option value="娯楽">娯楽</option>
             <option value="交通費">交通費</option>
             <option value="その他">その他</option>
           </select>
        </div>
        <button onClick={addExpense} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow">
          {loading ? '...' : isRecurringInput ? '毎月の支出として登録' : '追加する'}
        </button>
      </div>

      {/* 表示切り替え */}
      <div className="flex bg-gray-200 p-1 rounded-lg">
        <button onClick={() => setViewMode('list')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}>📜 リスト</button>
        <button onClick={() => setViewMode('calendar')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'calendar' ? 'bg-white shadow' : 'text-gray-500'}`}>📅 カレンダー</button>
      </div>

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {expenses.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm" style={{ borderLeft: `4px solid ${CAT_COLORS[item.category]||'#999'}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                    {item.is_recurring ? `毎月${item.recurring_day}日` : item.date}
                  </span>
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

      {/* カレンダー表示 */}
      {viewMode === 'calendar' && (
        <div>
          {/* 月切り替えヘッダー */}
          <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={() => changeMonth(-1)} className="text-2xl text-gray-500 hover:text-black">◀</button>
            <h2 className="text-xl font-bold text-gray-800">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</h2>
            <button onClick={() => changeMonth(1)} className="text-2xl text-gray-500 hover:text-black">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['日','月','火','水','木','金','土'].map(d => <div key={d} className="text-xs font-bold text-gray-400 py-1">{d}</div>)}
            
            {/* 空白セル（月の開始曜日まで） */}
            {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}

            {currentMonthData.map(day => {
              const dayTotal = day.items.reduce((sum, e) => sum + e.price, 0);
              return (
                <div key={day.day} className="bg-white rounded border min-h-[60px] flex flex-col items-center justify-start py-1 relative">
                  <span className="text-xs font-bold text-gray-500">{day.day}</span>
                  {dayTotal > 0 && (
                    <div className="mt-1 w-full">
                      <span className="text-[10px] font-bold text-red-500 block">¥{dayTotal.toLocaleString()}</span>
                      <div className="flex flex-col gap-0.5 mt-1 px-1">
                        {day.items.slice(0, 3).map(e => (
                          <div key={e.id} className="flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[e.category]||'#999' }} />
                             <span className="text-[8px] text-gray-400 truncate">{e.name}</span>
                          </div>
                        ))}
                        {day.items.length > 3 && <span className="text-[8px] text-gray-300">他{day.items.length-3}件</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}