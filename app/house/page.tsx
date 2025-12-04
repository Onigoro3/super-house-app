// app/house/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// 階層が変わったので ../ になっています
import Sidebar from '../components/Sidebar';
import StockList from '../components/StockList';
import MoneyList from '../components/MoneyList';
import YouTubeAnalyze from '../components/YouTubeAnalyze';
import RecipeBook from '../components/RecipeBook';
import CookingGlossary from '../components/CookingGlossary';
import WeeklyCalendar from '../components/WeeklyCalendar';
import Auth from '../components/Auth';

// ★ここをSidebar.tsxと完全に一致させる
type ViewType = 
  | 'home' 
  | 'calendar' 
  | 'food' 
  | 'seasoning' 
  | 'other' 
  | 'menu' 
  | 'youtube_recipes' 
  | 'ai_recipes' 
  | 'youtube' 
  | 'documents' 
  | 'glossary' 
  | 'money';

export default function HouseApp() {
  const [session, setSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('calendar'); // 初期画面
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
      case 'youtube_recipes': return '📺 YouTubeレシピ帳';
      case 'ai_recipes': return '🤖 AI献立レシピ帳';
      case 'glossary': return '📚 料理用語じてん';
      case 'calendar': return '📅 献立カレンダー';
      // documents や home はここに来る前に遷移するのでdefault扱いでOK
      default: return 'AI献立アプリ';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-gray-800">
      <Sidebar 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        currentView={currentView} onChangeView={setCurrentView}
      />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
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
        <header className="hidden md:flex bg-white p-4 shadow-sm items-center justify-between z-20">
           <h1 className="text-xl font-bold text-gray-800 px-4">{getTitle()}</h1>
           <button onClick={handleLogout} className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 mr-4">ログアウト</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {currentView === 'money' ? <MoneyList /> : 
             currentView === 'youtube' ? <YouTubeAnalyze /> : 
             currentView === 'youtube_recipes' ? <RecipeBook mode="youtube" /> : 
             currentView === 'ai_recipes' ? <RecipeBook mode="ai" /> : 
             currentView === 'glossary' ? <CookingGlossary /> : 
             currentView === 'calendar' ? <WeeklyCalendar /> : 
             // documentsの場合はサイドバー側で遷移処理されるため、ここには到達しない想定だが
             // 型合わせのためにStockListに流す（またはnullを返す）
             currentView === 'documents' ? null :
             <StockList view={currentView as any} />}
          </div>
        </div>
      </main>
    </div>
  );
}