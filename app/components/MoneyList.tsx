// app/components/MoneyList.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// --- 型定義 ---
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

// --- 色設定 ---
const EXP_COLORS: Record<string, string> = {
  '固定費': '#EF4444', '食費': '#F59E0B', '日用品': '#10B981',
  'サブスク': '#8B5CF6', '娯楽': '#EC4899', '交通費': '#3B82F6', 'その他': '#6B7280',
};

const INC_COLORS: Record<string, string> = {
  '給料': '#2563EB', '賞与': '#3B82F6', '副業': '#0EA5E9', '臨時収入': '#06B6D4', 'その他': '#64748B'
};

export default function MoneyList() {
  // --- ステート管理 ---
  const [mode, setMode] = useState<'expense' | 'income'>('expense'); // 支出か収入か
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list'); // リストかカレンダーか
  const [showMenu, setShowMenu] = useState(false); // サイドメニュー開閉

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  
  // 入力フォーム
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRecDay, setFormRecDay] = useState(''); // 支出の毎月用
  const [formCategory, setFormCategory] = useState('食費');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [budget, setBudget] = useState(50000);
  const [loading, setLoading] = useState(false);

  // --- データ読み込み ---
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

  // --- 登録処理 ---
  const handleSubmit = async () => {
    if (!formName || !formAmount) return alert("名称と金額を入力してください");
    setLoading(true);

    try {
      if (mode === 'expense') {
        // 支出登録
        const isRecurring = formCategory === '固定費' || formCategory === 'サブスク';
        const { error } = await supabase.from('expenses').insert([{ 
          name: formName, 
          price: parseInt(formAmount), 
          date: isRecurring ? '' : formDate, 
          category: formCategory,
          is_recurring: isRecurring,
          recurring_day: isRecurring ? parseInt(formRecDay) : null
        }]);
        if (error) throw error;
      } else {
        // ★収入登録（未来の日付でもOK）
        const { error } = await supabase.from('incomes').insert([{ 
          name: formName, 
          amount: parseInt(formAmount), 
          date: formDate, // 必ず年月日指定
          category: formCategory
        }]);
        if (error) throw error;
      }

      alert(`${mode === 'expense' ? '支出' : '収入'}を登録しました！`);
      setFormName(''); setFormAmount(''); 
      if (mode === 'expense' && (formCategory === '固定費' || formCategory === 'サブスク')) setFormRecDay('');
      else setFormDate(new Date().toISOString().split('T')[0]);
      
      fetchData();
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  // --- 削除処理 ---
  const handleDelete = async (id: number, type: 'expense' | 'income') => {
    if (!confirm("削除しますか？")) return;
    await supabase.from(type === 'expense' ? 'expenses' : 'incomes').delete().eq('id', id);
    fetchData();
  };

  // --- カレンダー計算ロジック ---
  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  const getCalendarData = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const calendar = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      
      // 支出（単発＋毎月）
      const dayExps = expenses.filter(e => (!e.is_recurring && e.date === dayStr) || (e.is_recurring && e.recurring_day === d));
      // 収入（単発のみ）
      const dayIncs = incomes.filter(i => i.date === dayStr);

      calendar.push({
        day: d,
        expenses: dayExps,
        incomes: dayIncs
      });
    }
    return calendar;
  };

  // 集計
  const calData = getCalendarData();
  const totalExpense = calData.reduce((sum, day) => sum + day.expenses.reduce((s, e) => s + e.price, 0), 0);
  const totalIncome = calData.reduce((sum, day) => sum + day.incomes.reduce((s, i) => s + i.amount, 0), 0);
  
  const balance = totalIncome - totalExpense; // 収支差額
  const remainingBudget = budget - totalExpense; // 予算残高
  const progress = Math.min(100, (totalExpense / budget) * 100);

  // カテゴリ選択肢
  const currentCategories = mode === 'expense' ? Object.keys(EXP_COLORS) : Object.keys(INC_COLORS);

  return (
    <div className="relative min-h-screen pb-24">
      
      {/* --- アプリ内サイドメニュー（モード切替） --- */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/50 flex-1" onClick={() => setShowMenu(false)}></div>
          <div className="bg-white w-64 h-full shadow-2xl p-4 flex flex-col animate-slideInRight">
            <h2 className="font-bold text-xl mb-6 text-gray-800">メニュー</h2>
            <button 
              onClick={() => { setMode('expense'); setFormCategory('食費'); setShowMenu(false); }} 
              className={`p-3 rounded-lg font-bold text-left mb-2 ${mode === 'expense' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              📤 支出管理
            </button>
            <button 
              onClick={() => { setMode('income'); setFormCategory('給料'); setShowMenu(false); }} 
              className={`p-3 rounded-lg font-bold text-left mb-2 ${mode === 'income' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              📥 収入管理
            </button>
          </div>
        </div>
      )}

      {/* --- ヘッダー --- */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setShowMenu(true)} className="p-2 bg-gray-100 rounded-lg text-gray-600">
          ☰ メニュー
        </button>
        <div className={`px-4 py-1 rounded-full font-bold text-sm ${mode === 'expense' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          {mode === 'expense' ? '支出モード' : '収入モード'}
        </div>
      </div>

      {/* --- 概要カード --- */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-6">
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-bold text-gray-700 text-lg">{currentMonth.getMonth()+1}月の収支</h2>
          <div className="text-right">
            <p className="text-xs text-gray-400">収支バランス</p>
            <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <p className="text-xs text-blue-500 font-bold">総収入</p>
            <p className="text-lg font-bold text-blue-700">¥{totalIncome.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-xl">
            <p className="text-xs text-red-500 font-bold">総支出</p>
            <p className="text-lg font-bold text-red-700">¥{totalExpense.toLocaleString()}</p>
          </div>
        </div>

        {/* 予算バー（支出モード時のみ表示） */}
        <div className="border-t pt-3">
          <div className="flex justify-between mb-1">
             <span className="text-xs font-bold text-gray-500">予算: ¥{budget.toLocaleString()}</span>
             <span className={`text-xs font-bold ${remainingBudget < 0 ? 'text-red-500' : 'text-green-600'}`}>残り: ¥{remainingBudget.toLocaleString()}</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${remainingBudget < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      {/* --- 入力フォーム --- */}
      <div className={`p-4 rounded-xl border shadow-sm mb-6 ${mode === 'expense' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
        <h3 className={`font-bold mb-3 ${mode === 'expense' ? 'text-red-700' : 'text-blue-700'}`}>
          {mode === 'expense' ? '💸 支出を記録' : '💰 収入を記録'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
           <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="名称 (例: 給料)" className="border p-2 rounded w-full col-span-2" />
           <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="金額" className="border p-2 rounded w-full" />
           
           {/* 日付入力切り替え */}
           {mode === 'expense' && (formCategory === '固定費' || formCategory === 'サブスク') ? (
             <div className="flex items-center border p-2 rounded w-full bg-white">
               <span className="text-xs text-gray-500 mr-1">毎月</span>
               <input type="number" min="1" max="31" value={formRecDay} onChange={e => setFormRecDay(e.target.value)} placeholder="日" className="w-full outline-none text-right" />
               <span className="text-xs text-gray-500 ml-1">日</span>
             </div>
           ) : (
             <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="border p-2 rounded w-full text-sm" />
           )}

           <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="border p-2 rounded w-full col-span-2 bg-white">
             {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        <button onClick={handleSubmit} disabled={loading} className={`w-full mt-3 py-3 rounded-lg font-bold text-white shadow transition ${mode === 'expense' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
          {loading ? '...' : '追加する'}
        </button>
        {mode === 'income' && <p className="text-xs text-blue-400 text-center mt-2">※未来の日付で登録すれば予定として管理できます</p>}
      </div>

      {/* --- 表示切り替え --- */}
      <div className="flex bg-gray-200 p-1 rounded-lg mb-4">
        <button onClick={() => setViewMode('list')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}>📜 リスト</button>
        <button onClick={() => setViewMode('calendar')} className={`flex-1 py-1 rounded-md text-sm font-bold ${viewMode === 'calendar' ? 'bg-white shadow' : 'text-gray-500'}`}>📅 カレンダー</button>
      </div>

      {/* --- カレンダー表示 --- */}
      {viewMode === 'calendar' && (
        <div>
          <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={() => changeMonth(-1)} className="text-2xl text-gray-500">◀</button>
            <h2 className="text-xl font-bold text-gray-800">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</h2>
            <button onClick={() => changeMonth(1)} className="text-2xl text-gray-500">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['日','月','火','水','木','金','土'].map(d => <div key={d} className="text-xs font-bold text-gray-400 py-1">{d}</div>)}
            {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
            
            {calData.map(day => {
              const dayExpTotal = day.expenses.reduce((s, e) => s + e.price, 0);
              const dayIncTotal = day.incomes.reduce((s, i) => s + i.amount, 0);
              
              return (
                <div key={day.day} className="bg-white rounded border min-h-[60px] flex flex-col items-center justify-start py-1 relative">
                  <span className="text-xs font-bold text-gray-500">{day.day}</span>
                  <div className="w-full px-0.5">
                    {/* 収入がある日 */}
                    {dayIncTotal > 0 && <span className="block text-[9px] font-bold text-blue-600 bg-blue-50 rounded px-1 mb-0.5">+{dayIncTotal.toLocaleString()}</span>}
                    {/* 支出がある日 */}
                    {dayExpTotal > 0 && <span className="block text-[9px] font-bold text-red-500">-{dayExpTotal.toLocaleString()}</span>}
                    
                    {/* 詳細ドット */}
                    <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                      {day.incomes.map(i => <div key={`inc-${i.id}`} className="w-1.5 h-1.5 rounded-full bg-blue-500" />)}
                      {day.expenses.map(e => <div key={`exp-${e.id}`} className="w-1.5 h-1.5 rounded-full bg-red-400" />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- リスト表示 --- */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* 収入リスト */}
          {mode === 'income' && incomes.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border-l-4 border-blue-500 shadow-sm">
              <div>
                <p className="text-xs text-gray-400">{item.date}</p>
                <p className="font-bold text-gray-800">{item.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-blue-600 text-lg">+¥{item.amount.toLocaleString()}</span>
                <button onClick={() => handleDelete(item.id, 'income')} className="text-gray-300 hover:text-red-500">×</button>
              </div>
            </div>
          ))}
          {/* 支出リスト */}
          {mode === 'expense' && expenses.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border-l-4 border-red-400 shadow-sm">
              <div>
                <p className="text-xs text-gray-400">{item.is_recurring ? `毎月${item.recurring_day}日` : item.date}</p>
                <p className="font-bold text-gray-800">{item.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-red-600 text-lg">¥{item.price.toLocaleString()}</span>
                <button onClick={() => handleDelete(item.id, 'expense')} className="text-gray-300 hover:text-red-500">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}