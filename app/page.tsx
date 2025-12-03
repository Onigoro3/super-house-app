// app/page.tsx
'use client';
import { useState } from 'react';
import StockList from './components/StockList';
import MoneyList from './components/MoneyList';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stock' | 'money'>('stock');

  return (
    <main className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl overflow-hidden relative">
      <header className="bg-white p-4 border-b sticky top-0 z-10">
        <h1 className="text-xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
          🏠 Super-House App
        </h1>
      </header>

      <div className="min-h-[80vh]">
        {activeTab === 'stock' ? <StockList /> : <MoneyList />}
      </div>

      <nav className="fixed bottom-0 w-full max-w-lg bg-white border-t flex justify-around p-2 pb-6 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 flex flex-col items-center p-2 rounded-lg transition ${
            activeTab === 'stock' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span className="text-xl mb-1">📦</span>
          <span className="text-xs font-bold">在庫＆献立</span>
        </button>
        <button
          onClick={() => setActiveTab('money')}
          className={`flex-1 flex flex-col items-center p-2 rounded-lg transition ${
            activeTab === 'money' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:bg-gray-50'
          }`}
        >
          <span className="text-xl mb-1">💰</span>
          <span className="text-xs font-bold">資産管理</span>
        </button>
      </nav>
    </main>
  );
}