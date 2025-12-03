// app/page.tsx
'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Auth from './components/Auth';

export default function Launcher() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  const apps = [
    // ★変更: 名前を「AI献立アプリ」、アイコンをキッチン風(🍳)、色をオレンジに
    { name: 'AI献立アプリ', icon: '🍳', color: 'bg-orange-400', link: '/house', desc: '在庫・献立・レシピ' },
    
    // ★追加: PDF編集アプリへのリンク
    { name: 'PDF編集', icon: '📄', color: 'bg-red-500', link: '/pdf', desc: '結合・編集' },
    
    { name: 'ToDo', icon: '✅', color: 'bg-green-500', link: '#', desc: '準備中' },
    { name: 'カレンダー', icon: '📅', color: 'bg-blue-500', link: '#', desc: '準備中' },
    { name: 'メモ帳', icon: '📝', color: 'bg-yellow-400', link: '#', desc: '準備中' },
    { name: 'チャットAI', icon: '🤖', color: 'bg-purple-500', link: '#', desc: '準備中' },
    { name: '天気', icon: '☀', color: 'bg-sky-400', link: '#', desc: '準備中' },
    { name: '設定', icon: '⚙', color: 'bg-gray-500', link: '#', desc: 'アカウント設定' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-lg mb-10 mt-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Good Morning</h1>
          <p className="text-gray-400 text-sm">今日は何をしますか？</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono">{new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-lg w-full">
        {apps.map((app, index) => (
          <Link key={index} href={app.link} className="flex flex-col items-center group">
            <div className={`w-20 h-20 ${app.color} rounded-2xl shadow-lg flex items-center justify-center text-4xl mb-2 transition-transform transform group-hover:scale-105 group-active:scale-95 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-full h-1/2 bg-white opacity-20 rounded-t-2xl pointer-events-none"></div>
              {app.icon}
            </div>
            <span className="text-xs font-medium tracking-wide text-gray-300 group-hover:text-white transition-colors">{app.name}</span>
          </Link>
        ))}
      </div>

      <div className="fixed bottom-6 bg-white/10 backdrop-blur-md p-4 rounded-3xl flex gap-6 border border-white/10 shadow-2xl">
        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-2xl shadow">📞</div>
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl shadow">🌐</div>
        <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center text-2xl shadow">💬</div>
        <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center text-2xl shadow">🎵</div>
      </div>
    </div>
  );
}