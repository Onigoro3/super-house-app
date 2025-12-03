// app/page.tsx
'use client';
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import StockList from './components/StockList';
import MoneyList from './components/MoneyList';

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('food');

  // ヘッダーのタイトルを決定
  const getTitle = () => {
    switch (currentView) {
      case 'food': return '🍎 食材の在庫';
      case 'seasoning': return '🧂 調味料の在庫';
      case 'other': return '🧻 日用品の在庫';
      case 'menu': return '👨‍🍳 献立・レシピ';
      case 'money': return '💰 資産管理';
      default: return 'Super House App';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl overflow-hidden relative">
      
      {/* ヘッダーエリア */}
      <header className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-30">
        {/* ハンバーガーボタン */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded hover:bg-gray-100"
        >
          <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
          <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div>
          <div className="w-6 h-0.5 bg-gray-600"></div>
        </button>
        
        <h1 className="text-lg font-bold text-gray-800">{getTitle()}</h1>
      </header>

      {/* サイドバー（メニュー） */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* メイン画面の切り替え */}
      <div className="min-h-[85vh]">
        {currentView === 'money' ? (
          <MoneyList />
        ) : (
          /* 食材、調味料、日用品、献立は StockList コンポーネントで管理 */
          <StockList view={currentView} />
        )}
      </div>

    </main>
  );
}