// app/money/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import MoneyList from '../components/MoneyList'; // 既存の部品を使う
import Auth from '../components/Auth';

export default function MoneyApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">読み込み中...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen text-gray-800">
      
      {/* 独自のヘッダー */}
      <header className="bg-yellow-500 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">💰 資産管理 <span className="text-xs font-normal opacity-80">家計簿・固定費</span></h1>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-3xl mx-auto">
           {/* 既存のMoneyListを表示 */}
           <MoneyList />
         </div>
      </div>
    </div>
  );
}