'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Auth from './components/Auth';

export default function Launcher() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    // ログインチェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // 時計の更新
    const timer = setInterval(() => {
      const now = new Date();
      setTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 1000);
    
    // 初期時刻セット
    const now = new Date();
    setTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);

    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // ★アプリ一覧の設定
  const apps = [
    // 1. メインの献立アプリ
    { 
      name: 'AI献立アプリ', 
      icon: '🍳', 
      color: 'bg-orange-400', 
      link: '/house', 
      desc: '在庫管理・レシピ提案' 
    },
    // 2. PDF編集アプリ (Python版の機能をWebで再現したページへ)
    { 
      name: 'PDF編集', 
      icon: '📄', 
      color: 'bg-red-500', 
      link: '/pdf', 
      desc: '文字入れ・図形・保存' 
    },
    // 3. 書類管理アプリ (作成したPDFやレシピを管理)
    { 
      name: '書類管理', 
      icon: '🗂️', 
      color: 'bg-blue-500', 
      link: '/documents', 
      desc: 'クラウド保存データ' 
    },
    // app/page.tsx の apps 配列内
    { 
      name: 'チャットAI', 
      icon: '🤖', 
      color: 'bg-purple-500', 
      link: '/chat',  // ★ここを '#' から '/chat' に変更
      desc: '執事とお喋り' 
    },
    
    // --- 以下、将来開発予定のアプリ（モックアップ） ---
    { name: 'ToDo', icon: '✅', color: 'bg-green-500', link: '#', desc: '準備中' },
    { name: 'カレンダー', icon: '📅', color: 'bg-sky-500', link: '#', desc: '準備中' },
    { name: 'メモ帳', icon: '📝', color: 'bg-yellow-400', link: '#', desc: '準備中' },
    { name: 'チャットAI', icon: '🤖', color: 'bg-purple-500', link: '#', desc: '準備中' },
    { name: '天気', icon: '☀', color: 'bg-cyan-400', link: '/weather', desc: '天気予報' }, // 天気も作りましたね
    { name: '設定', icon: '⚙', color: 'bg-gray-500', link: '#', desc: 'アカウント設定' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center selection:bg-indigo-500 selection:text-white">
      
      {/* ヘッダーエリア（時計・挨拶） */}
      <div className="w-full max-w-lg mb-12 mt-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Good Morning</h1>
          <p className="text-gray-400 text-sm mt-1">今日は何をしますか？</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-light">{time}</p>
        </div>
      </div>

      {/* アプリグリッド */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-10 max-w-lg w-full">
        {apps.map((app, index) => (
          <Link key={index} href={app.link} className="flex flex-col items-center group cursor-pointer">
            <div 
              className={`w-20 h-20 ${app.color} rounded-2xl shadow-lg flex items-center justify-center text-4xl mb-3 transition-all duration-300 transform group-hover:scale-110 group-hover:shadow-2xl group-active:scale-95 relative overflow-hidden`}
            >
              {/* ガラスっぽい光沢エフェクト */}
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
              <span className="drop-shadow-sm">{app.icon}</span>
            </div>
            <span className="text-xs font-medium tracking-wide text-gray-300 group-hover:text-white transition-colors">
              {app.name}
            </span>
          </Link>
        ))}
      </div>

      {/* ドック（よく使うアプリ用・飾り） */}
      <div className="fixed bottom-8">
        <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl flex gap-6 border border-white/10 shadow-2xl">
          <Link href="/house" className="w-12 h-12 bg-orange-400 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">🍳</Link>
          <Link href="/pdf" className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">📄</Link>
          <Link href="/documents" className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">🗂️</Link>
          <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-2xl shadow-lg opacity-50 cursor-not-allowed">⚙</div>
        </div>
      </div>

    </div>
  );
}