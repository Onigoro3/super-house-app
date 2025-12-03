// app/components/WeeklyCalendar.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type MealPlan = {
  id: number;
  date: string;
  recipe_title: string;
  recipe_id: number | null;
};

type Recipe = {
  id: number;
  title: string;
  source: string;
  channel_name: string;
};

export default function WeeklyCalendar() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  
  // ★追加：レシピ選択モーダル用
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'youtube' | 'ai'>('all');

  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    setWeekDates(dates);
    fetchPlans();
    fetchRecipes(); // レシピ一覧も取得しておく
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from('meal_plans').select('*').order('date', { ascending: true });
    if (data) setPlans(data);
  };

  const fetchRecipes = async () => {
    const { data } = await supabase.from('recipes').select('id, title, source, channel_name').order('created_at', { ascending: false });
    if (data) setRecipes(data);
  };

  const deletePlan = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    await supabase.from('meal_plans').delete().eq('id', id);
    fetchPlans();
  };

  // ★追加：レシピをカレンダーに追加
  const addRecipeToPlan = async (recipe: Recipe) => {
    if (!targetDate) return;
    await supabase.from('meal_plans').insert([{
      date: targetDate,
      recipe_id: recipe.id,
      recipe_title: recipe.title
    }]);
    fetchPlans();
    setIsModalOpen(false);
  };

  // モーダルを開く
  const openAddModal = (dateStr: string) => {
    setTargetDate(dateStr);
    setIsModalOpen(true);
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const getDayName = (d: Date) => ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  // フィルタリング
  const filteredRecipes = recipes.filter(r => {
    if (filterMode === 'all') return true;
    return r.source === filterMode;
  });

  return (
    <div className="p-4 space-y-6 pb-24 relative">
      <div className="bg-orange-50 p-6 rounded-xl border-2 border-orange-100 text-center">
        <h2 className="text-2xl font-bold text-orange-800 mb-1">📅 献立カレンダー</h2>
        <p className="text-sm text-gray-500">保存したレシピを予定に入れましょう</p>
      </div>

      <div className="space-y-4">
        {weekDates.map((date) => {
          const dateStr = formatDate(date);
          const dayPlans = plans.filter(p => p.date === dateStr);
          const isToday = dateStr === formatDate(new Date());

          return (
            <div key={dateStr} className={`border rounded-xl overflow-hidden ${isToday ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200 bg-white'}`}>
              <div className={`p-3 flex justify-between items-center ${isToday ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-700'}`}>
                <div className="font-bold text-lg">
                  {date.getMonth() + 1}/{date.getDate()} <span className="text-sm">({getDayName(date)})</span>
                  {isToday && <span className="ml-2 text-xs bg-white text-orange-600 px-2 py-0.5 rounded-full">今日</span>}
                </div>
              </div>

              <div className="p-4 min-h-[80px] bg-white">
                <div className="space-y-2 mb-3">
                  {dayPlans.map(plan => (
                    <div key={plan.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-bold text-gray-800 text-sm truncate">{plan.recipe_title}</span>
                      <button onClick={() => deletePlan(plan.id)} className="text-gray-400 hover:text-red-500 px-2">×</button>
                    </div>
                  ))}
                </div>
                {/* ★追加ボタン */}
                <button 
                  onClick={() => openAddModal(dateStr)}
                  className="w-full text-center py-2 border-2 border-dashed border-blue-200 rounded-lg text-blue-500 text-xs font-bold hover:bg-blue-50"
                >
                  ＋ レシピ帳から追加
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ★レシピ選択モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-gray-800">レシピを選択 ({targetDate})</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-2xl text-gray-400">×</button>
            </div>
            
            {/* タブ切り替え */}
            <div className="flex border-b">
              <button onClick={() => setFilterMode('all')} className={`flex-1 py-3 text-sm font-bold ${filterMode === 'all' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>すべて</button>
              <button onClick={() => setFilterMode('youtube')} className={`flex-1 py-3 text-sm font-bold ${filterMode === 'youtube' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>YouTube</button>
              <button onClick={() => setFilterMode('ai')} className={`flex-1 py-3 text-sm font-bold ${filterMode === 'ai' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>AI献立</button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredRecipes.length === 0 ? <p className="text-center text-gray-400 py-10">レシピがありません</p> : filteredRecipes.map(recipe => (
                <button 
                  key={recipe.id} 
                  onClick={() => addRecipeToPlan(recipe)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-indigo-50 hover:border-indigo-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{recipe.source === 'youtube' ? '📺' : '🤖'}</span>
                    <div>
                      <div className="font-bold text-gray-800 text-sm">{recipe.title}</div>
                      <div className="text-xs text-gray-400">{recipe.channel_name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}