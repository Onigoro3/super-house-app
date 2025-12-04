// app/documents/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '../components/Sidebar';
import DocumentManager from '../components/DocumentManager';
import Auth from '../components/Auth';

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money' | 'youtube' | 'recipebook' | 'glossary' | 'calendar' | 'documents';

export default function DocumentsPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // ★サイドバーは閉じた状態、ビューはダミー（このページ専用なので）
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-gray-800">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentView={'documents' as any} onChangeView={() => {}} />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white p-4 shadow-sm flex items-center gap-4 md:hidden z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-gray-100">
             <div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div><div className="w-6 h-0.5 bg-gray-600 mb-1.5"></div><div className="w-6 h-0.5 bg-gray-600"></div>
          </button>
          <h1 className="text-lg font-bold">🗂️ 書類管理</h1>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
           <div className="max-w-7xl mx-auto">
             <DocumentManager />
           </div>
        </div>
      </main>
    </div>
  );
}