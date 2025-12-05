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
  is_recurring: boolean;
  recurring_day: number | null;
};

type Income = {
  id: number;
  name: string;
  amount: number;
  date: string;
  category: string;
};

const EXP_COLORS: Record<string, string> = {
  '固定費': '#EF4444', '食費': '#F59E0B', '日用品': '#10B981',
  'サブスク': '#8B5CF6', '娯楽': '#EC4899', '交通費': '#3B82F6', 'その他': '#6B7280',
};
const INC_COLORS: Record<string, string> = {
  '給料': '#2563EB', '賞与': '#3B82F6', '副業': '#0EA5E9', '臨時収入': '#06B6D4', 'その他': '#64748B'
};

export default function MoneyList() {
  const [mode, setMode] = useState<'expense' | 'income'>('expense');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showMenu, setShowMenu] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  
  // 入力フォーム
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRecDay, setFormRecDay] = useState('');
  const [formCategory, setFormCategory] = useState('食費');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [budget, setBudget] = useState(50000);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchData = async () => {
    const { data: exp } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    const { data: inc } = await supabase.from('incomes').select('*').order('date', { ascending: false });
    if (exp) setExpenses(exp);
    if (inc) setIncomes(inc);
    const savedBudget = localStorage.getItem('monthly_budget');
    if (savedBudget) setBudget(parseInt(savedBudget));
  };

  useEffect(() => {
    fetchData();
    setFormDate(new Date().toISOString().split('T')[0]);
  }, []);

  const handleSubmit = async () => {
    if (!formName || !formAmount) return alert("名称と金額を入力してください");
    setLoading(true);
    try {
      if (mode === 'expense') {
        const isRecurring = formCategory === '固定費' || formCategory === 'サブスク';
        const { error } = await supabase.from('expenses').insert([{ 
          name: formName, price: parseInt(formAmount), date: isRecurring ? '' : formDate, category: formCategory, is_recurring: isRecurring, recurring_day: isRecurring ? parseInt(formRecDay) : null
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('incomes').insert([{ name: formName, amount: parseInt(formAmount), date: formDate, category: formCategory }]);
        if (error) throw error;
      }
      alert(`${mode === 'expense' ? '支出' : '収入'}を登録しました！`);
      setFormName(''); setFormAmount(''); 
      if (mode === 'expense' && (formCategory === '固定費' || formCategory === 'サブスク')) setFormRecDay('');
      else setFormDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number, type: 'expense' | 'income') => {
    if (!confirm("削除しますか？")) return;
    await supabase.from(type === 'expense' ? 'expenses' : 'incomes').delete().eq('id', id);
    fetchData();
  };

  // レシート解析
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: reader.result, mode: 'money' }) });
        if (!res.ok) throw new Error('解析失敗');
        const data: any[] = await res.json();
        if (data.length > 0) { const item = data[0]; setFormName(item.name); setFormAmount(item.price); setFormDate(item.date); setFormCategory(item.category); alert(`読み取りました！\n${item.name} : ¥${item.price}`); }
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

  // --- データ計算ロジック ---
  
  // 1. カレンダー用データ（日別）
  const getCalendarData = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayExps = expenses.filter(e => (!e.is_recurring && e.date === dayStr) || (e.is_recurring && e.recurring_day === d));
      const dayIncs = incomes.filter(i => i.date === dayStr);
      calendar.push({ day: d, expenses: dayExps, incomes: dayIncs });
    }
    return calendar;
  };

  // 2. 年間サマリーデータ（月別）
  const getYearlySummary = () => {
    const year = currentMonth.getFullYear();
    const summary = [];
    // 最大値を計算してグラフの高さを決めるため
    let maxAmount = 0;

    for (let m = 1; m <= 12; m++) {
      const monthPrefix = `${year}-${String(m).padStart(2, '0')}`;
      
      // 収入（今月のもの）
      const monthInc = incomes.filter(i => i.date.startsWith(monthPrefix)).reduce((sum, i) => sum + i.amount, 0);
      
      // 支出（今月の変動費 ＋ 毎月の固定費）
      const monthExpOneTime = expenses.filter(e => !e.is_recurring && e.date.startsWith(monthPrefix)).reduce((sum, e) => sum + e.price, 0);
      const monthExpRecurring = expenses.filter(e => e.is_recurring).reduce((sum, e) => sum + e.price, 0);
      const totalExp = monthExpOneTime + monthExpRecurring;

      if (monthInc > maxAmount) maxAmount = monthInc;
      if (totalExp > maxAmount) maxAmount = totalExp;

      summary.push({ month: m, income: monthInc, expense: totalExp, balance: monthInc - totalExp });
    }
    return { data: summary, max: maxAmount };
  };

  const currentMonthData = getCalendarData();
  const monthTotalExp = currentMonthData.reduce((sum, day) => sum + day.expenses.reduce((s, e) => s + e.price, 0), 0);
  const monthTotalInc = currentMonthData.reduce((sum, day) => sum + day.incomes.reduce((s, i) => s + i.amount, 0), 0);
  const monthBalance = monthTotalInc - monthTotalExp;
  const yearlySummary = getYearlySummary();

  const currentCategories = mode === 'expense' ? Object.keys(EXP_COLORS) : Object.keys(INC_COLORS);

  return (
    <div className="relative min-h-screen pb-24">
      
      {/* サイドメニュー */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/50 flex-1" onClick={() => setShowMenu(false)}></div>
          <div className="bg-white w-64 h-full shadow-2xl p-4 flex flex-col">
            <h2 className="font-bold text-xl mb-6 text-gray-800">メニュー</h2>
            <button onClick={() => { setMode('expense'); setFormCategory('食費'); setShowMenu(false); }} className={`p-3 rounded-lg font-bold text-left mb-2 ${mode === 'expense' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}>📤 支出管理</button>
            <button onClick={() => { setMode('income'); setFormCategory('給料'); setShowMenu(false); }} className={`p-3 rounded-lg font-bold text-left mb-2 ${mode === 'income' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}>📥 収入管理</button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4 p-4 bg-white shadow-sm sticky top-0 z-10">
        <button onClick={() => setShowMenu(true)} className="p-2 bg-gray-100 rounded-lg text-gray-600">☰</button>
        <h1 className="font-bold text-gray-800">{currentMonth.getFullYear()}年の収支</h1>
        <div className={`px-3 py-1 rounded-full font-bold text-xs ${mode === 'expense' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{mode === 'expense' ? '支出' : '収入'}</div>
      </div>

      {/* ★ 年間サマリーグラフ（横スクロール） */}
      <div className="px-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <h3 className="text-xs font-bold text-gray-400 mb-3 sticky left-0">年間推移 (1月〜12月)</h3>
          <div className="flex gap-3 min-w-max items-end h-40 pb-6">
            {yearlySummary.data.map((m) => {
              const incHeight = m.income > 0 ? (m.income / yearlySummary.max) * 100 : 0;
              const expHeight = m.expense > 0 ? (m.expense / yearlySummary.max) * 100 : 0;
              const isCurrent = m.month === currentMonth.getMonth() + 1;
              
              return (
                <div key={m.month} className={`flex flex-col items-center justify-end h-full w-12 relative ${isCurrent ? 'bg-gray-50 rounded-lg -mx-1 px-1 pt-1' : ''}`}>
                  {/* 数値ラベル（残高） */}
                  <span className={`text-[9px] font-bold mb-1 ${m.balance >= 0 ? 'text-black' : 'text-red-500'}`}>
                    {m.balance > 0 ? '+' : ''}{Math.round(m.balance / 1000)}k
                  </span>
                  
                  {/* グラフバー */}
                  <div className="w-full flex gap-0.5 items-end h-20">
                    <div className="w-1/2 bg-blue-400 rounded-t-sm transition-all duration-500" style={{ height: `${incHeight}%` }}></div>
                    <div className="w-1/2 bg-red-400 rounded-t-sm transition-all duration-500" style={{ height: `${expHeight}%` }}></div>
                  </div>
                  
                  {/* 月ラベル */}
                  <span className={`text-xs mt-2 font-bold ${isCurrent ? 'text-indigo-600' : 'text-gray-400'}`}>{m.month}月</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 今月の概要 */}
      <div className="px-4 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <button onClick={() => changeMonth(-1)} className="text-xl text-gray-400">◀</button>
               <h2 className="font-bold text-gray-700 text-lg">{currentMonth.getMonth()+1}月</h2>
               <button onClick={() => changeMonth(1)} className="text-xl text-gray-400">▶</button>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">今月の残り (収支)</p>
              <p className={`text-2xl font-bold ${monthBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                {monthBalance >= 0 ? '+' : ''}¥{monthBalance.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-blue-50 p-2 rounded-lg"><p className="text-xs text-blue-500">収入</p><p className="font-bold text-blue-700">¥{monthTotalInc.toLocaleString()}</p></div>
            <div className="bg-red-50 p-2 rounded-lg"><p className="text-xs text-red-500">支出</p><p className="font-bold text-red-700">¥{monthTotalExp.toLocaleString()}</p></div>
          </div>
        </div>
      </div>

      {/* 入力フォーム */}
      <div className={`mx-4 p-4 rounded-xl border shadow-sm mb-6 ${mode === 'expense' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
        <h3 className={`font-bold mb-3 ${mode === 'expense' ? 'text-red-700' : 'text-blue-700'}`}>{mode === 'expense' ? '💸 支出入力' : '💰 収入入力'}</h3>
        <div className="grid grid-cols-2 gap-2">
           <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="名称" className="border p-2 rounded w-full col-span-2" />
           <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="金額" className="border p-2 rounded w-full" />
           {mode === 'expense' && (formCategory === '固定費' || formCategory === 'サブスク') ? (
             <div className="flex items-center border p-2 rounded w-full bg-white"><span className="text-xs text-gray-500 mr-1">毎月</span><input type="number" min="1" max="31" value={formRecDay} onChange={e => setFormRecDay(e.target.value)} placeholder="日" className="w-full outline-none text-right" /><span className="text-xs text-gray-500 ml-1">日</span></div>
           ) : (
             <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border p-2 rounded w-full text-sm" />
           )}
           <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="border p-2 rounded w-full col-span-2 bg-white">{currentCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSubmit} disabled={loading} className={`flex-1 py-3 rounded-lg font-bold text-white shadow ${mode === 'expense' ? 'bg-red-500' : 'bg-blue-500'}`}>{loading ? '...' : '追加'}</button>
          <label className={`flex items-center justify-center bg-white border px-3 rounded-lg cursor-pointer ${isAnalyzing?'opacity-50':''}`}>📷<input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isAnalyzing} /></label>
        </div>
        {mode === 'income' && <p className="text-xs text-blue-400 text-center mt-2">※未来の日付で登録すれば、上のグラフにも反映されます</p>}
      </div>

      {/* 表示切替＆リスト・カレンダー */}
      <div className="mx-4">
        <div className="flex bg-gray-200 p-1 rounded-lg mb-4">
          <button onClick={() => setViewMode('list')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}>📜 リスト</button>
          <button onClick={() => setViewMode('calendar')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'calendar' ? 'bg-white shadow' : 'text-gray-500'}`}>📅 カレンダー</button>
        </div>

        {viewMode === 'list' && (
          <div className="space-y-3">
            {mode === 'income' && incomes.map(item => <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border-l-4 border-blue-500 shadow-sm"><div><p className="text-xs text-gray-400">{item.date}</p><p className="font-bold text-gray-800">{item.name}</p></div><div className="flex items-center gap-3"><span className="font-bold text-blue-600">+¥{item.amount.toLocaleString()}</span><button onClick={() => handleDelete(item.id, 'income')} className="text-gray-300">×</button></div></div>)}
            {mode === 'expense' && expenses.map(item => <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border-l-4 border-red-400 shadow-sm"><div><p className="text-xs text-gray-400">{item.is_recurring ? `毎月${item.recurring_day}日` : item.date}</p><p className="font-bold text-gray-800">{item.name}</p></div><div className="flex items-center gap-3"><span className="font-bold text-red-600">¥{item.price.toLocaleString()}</span><button onClick={() => handleDelete(item.id, 'expense')} className="text-gray-300">×</button></div></div>)}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="grid grid-cols-7 gap-1 text-center pb-10">
            {['日','月','火','水','木','金','土'].map(d => <div key={d} className="text-xs font-bold text-gray-400 py-1">{d}</div>)}
            {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
            {currentMonthData.map(day => {
              const dayExpTotal = day.expenses.reduce((s, e) => s + e.price, 0);
              const dayIncTotal = day.incomes.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={day.day} className="bg-white rounded border min-h-[60px] flex flex-col items-center justify-start py-1">
                  <span className="text-xs font-bold text-gray-500">{day.day}</span>
                  <div className="w-full px-0.5">
                    {dayIncTotal > 0 && <span className="block text-[9px] font-bold text-blue-600 bg-blue-50 rounded px-1 mb-0.5">+{dayIncTotal.toLocaleString()}</span>}
                    {dayExpTotal > 0 && <span className="block text-[9px] font-bold text-red-500">-{dayExpTotal.toLocaleString()}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}