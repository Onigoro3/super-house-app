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

export default function WeeklyCalendar() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  // 今日から7日分の日付を生成
  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    setWeekDates(dates);
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from('meal_plans').select('*').order('date', { ascending: true });
    if (data) setPlans(data);
  };

  const deletePlan = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    await supabase.from('meal_plans').delete().eq('id', id);
    fetchPlans();
  };

  // 日付のフォーマット (YYYY-MM-DD)
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  // 曜日取得
  const getDayName = (d: Date) => ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-orange-50 p-6 rounded-xl border-2 border-orange-100 text-center">
        <h2 className="text-2xl font-bold text-orange-800 mb-1">📅 献立カレンダー</h2>
        <p className="text-sm text-gray-500">1週間の予定を立てましょう</p>
      </div>

      <div className="space-y-4">
        {weekDates.map((date) => {
          const dateStr = formatDate(date);
          const dayPlans = plans.filter(p => p.date === dateStr);
          const isToday = dateStr === formatDate(new Date());

          return (
            <div key={dateStr} className={`border rounded-xl overflow-hidden ${isToday ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200 bg-white'}`}>
              {/* 日付ヘッダー */}
              <div className={`p-3 flex justify-between items-center ${isToday ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-700'}`}>
                <div className="font-bold text-lg">
                  {date.getMonth() + 1}/{date.getDate()} <span className="text-sm">({getDayName(date)})</span>
                  {isToday && <span className="ml-2 text-xs bg-white text-orange-600 px-2 py-0.5 rounded-full">今日</span>}
                </div>
              </div>

              {/* 予定リスト */}
              <div className="p-4 min-h-[80px] bg-white">
                {dayPlans.length === 0 ? (
                  <p className="text-sm text-gray-300 text-center py-2">予定なし</p>
                ) : (
                  <div className="space-y-2">
                    {dayPlans.map(plan => (
                      <div key={plan.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="font-bold text-gray-800">{plan.recipe_title}</span>
                        <button onClick={() => deletePlan(plan.id)} className="text-gray-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-center">
                  <p className="text-xs text-blue-400">＋ レシピ帳から追加</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}