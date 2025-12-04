// app/documents/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import DocumentManager from '../components/DocumentManager';
import Auth from '../components/Auth';

export default function DocumentsPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">読み込み中...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      
      {/* 独自のヘッダー */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">🗂️ 書類管理 <span className="text-xs font-normal opacity-80">(クラウド)</span></h1>
        </div>
        <div className="text-sm text-blue-100">PDF Manager</div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-7xl mx-auto">
           <DocumentManager />
         </div>
      </div>
    </div>
  );
}