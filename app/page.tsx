// app/page.tsx
'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Auth from './components/Auth';

export default function Launcher() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState<string>('');
  
  // ★ページネーション用
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 9; // 1ページに表示する数（3x3）

  // スワイプ判定用
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });

    const updateTime = () => {
      const now = new Date();
      setTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => { subscription.unsubscribe(); clearInterval(timer); };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // ★全アプリリスト
  const apps = [
    // 1ページ目に入れたい主要アプリ
    { name: 'AI献立アプリ', icon: '🍳', color: 'bg-orange-400', link: '/house', desc: '在庫・献立' },
    { name: 'お出かけ', icon: '✈', color: 'bg-teal-500', link: '/travel', desc: 'AI旅行計画' },
    { name: 'AIライブラリ', icon: '📚', color: 'bg-amber-600', link: '/library', desc: '読書・学習' },
    
    { name: 'メモ帳', icon: '📝', color: 'bg-yellow-400', link: '/memo', desc: 'AIマインドマップ' },
    { name: '資産管理', icon: '💰', color: 'bg-yellow-500', link: '/money', desc: '家計簿' },
    { name: '書類管理', icon: '🗂️', color: 'bg-blue-500', link: '/documents', desc: '保存・整理' },
    
    { name: 'PDF編集', icon: '📄', color: 'bg-red-500', link: '/pdf', desc: '編集・作成' },
    { name: 'チャットAI', icon: '🤖', color: 'bg-purple-500', link: '/chat', desc: '執事とお喋り' },
    { name: '天気', icon: '☀', color: 'bg-cyan-400', link: '/weather', desc: '天気予報' },
    
    // 2ページ目以降
    // ★追加: AI絵本メーカー
    { name: 'AI絵本', icon: '🎨', color: 'bg-pink-500', link: '/picture-book', desc: 'アニメ絵本作成' },
    { name: 'ToDo', icon: '✅', color: 'bg-green-500', link: '#', desc: '準備中' },
    { name: 'カレンダー', icon: '📅', color: 'bg-sky-500', link: '#', desc: '準備中' },
    { name: '設定', icon: '⚙', color: 'bg-gray-500', link: '#', desc: 'アカウント設定' },
    // 今後アプリが増えてもここに追加すれば自動でページが増えます
  ];

  // ページ計算
  const totalPages = Math.ceil(apps.length / ITEMS_PER_PAGE);
  const displayedApps = apps.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // スワイプ処理
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // 感度
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentPage < totalPages - 1) { setCurrentPage(p => p + 1); } // 次へ
      else if (diff < 0 && currentPage > 0) { setCurrentPage(p => p - 1); } // 前へ
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center selection:bg-indigo-500 selection:text-white overflow-hidden">
      
      {/* ヘッダー */}
      <div className="w-full max-w-lg mb-8 mt-4 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Good Morning</h1>
          <p className="text-gray-400 text-sm mt-1">今日は何をしますか？</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-light">{time}</p>
        </div>
      </div>

      {/* ★ アプリグリッドエリア (スワイプ対応) */}
      <div 
        className="flex-1 w-full max-w-lg flex flex-col min-h-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-3 gap-x-6 gap-y-8 w-full content-start py-4">
          {displayedApps.map((app, index) => (
            <Link key={index} href={app.link} className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform duration-100">
              <div 
                className={`w-20 h-20 ${app.color} rounded-2xl shadow-lg flex items-center justify-center text-4xl mb-3 relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                <span className="drop-shadow-sm">{app.icon}</span>
              </div>
              <span className="text-xs font-medium tracking-wide text-gray-300 group-hover:text-white transition-colors text-center leading-tight">
                {app.name}
              </span>
            </Link>
          ))}
        </div>

        {/* ページインジケーター (● ○) */}
        <div className="flex justify-center gap-2 mt-auto pb-4">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button 
              key={i} 
              onClick={() => setCurrentPage(i)}
              className={`rounded-full transition-all duration-300 ${currentPage === i ? 'bg-white w-4 h-2' : 'bg-gray-600 w-2 h-2'}`}
            />
          ))}
        </div>
      </div>
      
      {/* ドック (固定アプリ) */}
      <div className="shrink-0 pb-4">
        <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl flex gap-6 border border-white/10 shadow-2xl">
          <Link href="/house" className="w-12 h-12 bg-orange-400 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">🍳</Link>
          <Link href="/travel" className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">✈</Link>
          <Link href="/library" className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">📚</Link>
          <Link href="/chat" className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-2xl shadow-lg hover:-translate-y-2 transition-transform duration-300">🤖</Link>
        </div>
      </div>

    </div>
  );
}