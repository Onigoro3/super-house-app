// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from './components/Sidebar';
import StockList from './components/StockList';
import MoneyList from './components/MoneyList';
import YouTubeAnalyze from './components/YouTubeAnalyze';
import RecipeBook from './components/RecipeBook';
import Auth from './components/Auth';

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money' | 'youtube' | 'recipebook';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('food');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">読み込み中...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

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
    // ★変更: PCではflex-row（横並び）にする
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-gray-800">
      
      {/* ★PC用サイドバー（常時表示）とスマホ用ドロワーの管理 */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView} 
        onChangeView={setCurrentView}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* ヘッダー（スマホのみメニューボタン表示） */}
        <header className="bg-white p-4 shadow-sm flex items-center justify-between z-20 md:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-gray-100">
              <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
              <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
              <div className="w-6 h-0.5 bg-gray-600"></div>
            </button>
            <h1 className="text-lg font-bold text-gray-800">{getTitle()}</h1>
          </div>
          <button onClick={handleLogout} className="text-xs text-gray-500 border border-gray-300 px-2 py-1 rounded hover:bg-gray-100">ログアウト</button>
        </header>

        {/* PC用ヘッダー（シンプルにログアウトのみ） */}
        <header className="hidden md:flex bg-white p-4 shadow-sm items-center justify-between z-20">
           <h1 className="text-xl font-bold text-gray-800 px-4">{getTitle()}</h1>
           <button onClick={handleLogout} className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 mr-4">ログアウト</button>
        </header>

        {/* コンテンツ本体（スクロール可能） */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto"> {/* ★コンテンツ幅を広げる */}
            {currentView === 'money' ? <MoneyList /> : 
             currentView === 'youtube' ? <YouTubeAnalyze /> : 
             currentView === 'recipebook' ? <RecipeBook /> : 
             <StockList view={currentView as any} />}
          </div>
        </div>
      </main>
    </div>
  );
}