// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from './components/Sidebar';
import StockList from './components/StockList';
import MoneyList from './components/MoneyList';
import YouTubeAnalyze from './components/YouTubeAnalyze';
import RecipeBook from './components/RecipeBook';
import Auth from './components/Auth'; // ログイン画面

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money' | 'youtube' | 'recipebook';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('food');
  const [loading, setLoading] = useState(true);

  // 起動時にログイン状態をチェック
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // 読み込み中
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">読み込み中...</div>;
  }

  // ★ログインしていなければログイン画面を表示
  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  // タイトル決定
  const getTitle = () => {
    switch (currentView) {
      case 'food': return '🍎 食材の在庫';
      case 'seasoning': return '🧂 調味料の在庫';
      case 'other': return '🧻 日用品の在庫';
      case 'menu': return '👨‍🍳 献立・レシピ';
      case 'money': return '💰 資産管理';
      case 'youtube': return '📺 動画レシピ分析';
      case 'recipebook': return '📖 保存レシピ帳';
      default: return 'Super House App';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl overflow-hidden relative">
      <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-gray-100">
            <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
            <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
            <div className="w-6 h-0.5 bg-gray-600"></div>
          </button>
          <h1 className="text-lg font-bold text-gray-800">{getTitle()}</h1>
        </div>
        
        {/* ログアウトボタン */}
        <button onClick={handleLogout} className="text-xs text-gray-500 border border-gray-300 px-2 py-1 rounded hover:bg-gray-100">
          ログアウト
        </button>
      </header>

      <Sidebar 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        currentView={currentView} onChangeView={setCurrentView}
      />

      <div className="min-h-[85vh]">
        {currentView === 'money' ? <MoneyList /> : 
         currentView === 'youtube' ? <YouTubeAnalyze /> : 
         currentView === 'recipebook' ? <RecipeBook /> : 
         <StockList view={currentView as any} />}
      </div>
    </main>
  );
}