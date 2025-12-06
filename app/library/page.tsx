// app/library/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type BookPage = {
  page_number: number;
  headline: string;
  content: string;
};

type Book = {
  id?: number;
  title: string;
  topic?: string;
  pages: BookPage[];
};

export default function LibraryApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 画面モード ('shelf':本棚, 'create':作成, 'read':読書)
  const [view, setView] = useState<'shelf' | 'create' | 'read'>('shelf');

  // データ
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // 作成フォーム
  const [topic, setTopic] = useState('');
  const [bookType, setBookType] = useState('study'); // study or story
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false);
      if (session) fetchBooks();
    });
  }, []);

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (data) setBooks(data);
  };

  // 本を生成
  const generateBook = async () => {
    if (!topic) return alert("テーマを入力してください");
    setIsGenerating(true);
    try {
      const res = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type: bookType }),
      });
      if (!res.ok) throw new Error('生成エラー');
      const data = await res.json();
      
      // 保存
      const { error } = await supabase.from('books').insert([{
        title: data.title,
        topic: topic,
        pages: data.pages
      }]);
      
      if (!error) {
        alert(`「${data.title}」が出版されました！`);
        setTopic('');
        fetchBooks();
        setView('shelf');
      }
    } catch (e) { alert("執筆に失敗しました"); } 
    finally { setIsGenerating(false); }
  };

  // 本を開く
  const openBook = (book: Book) => {
    setCurrentBook(book);
    setCurrentPageIndex(0);
    setView('read');
  };

  // 本を削除
  const deleteBook = async (id: number) => {
    if (!confirm("この本を廃棄しますか？")) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col h-screen text-gray-800 font-serif">
      
      {/* ヘッダー */}
      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-amber-800 hover:bg-amber-700 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">📚 AIライブラリ</h1>
        </div>
        {view !== 'shelf' && (
          <button onClick={() => setView('shelf')} className="text-sm bg-amber-800 px-3 py-1 rounded">本棚に戻る</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* --- 本棚モード --- */}
          {view === 'shelf' && (
            <div className="space-y-8">
              {/* 新規作成エリア */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200">
                <h2 className="font-bold text-lg text-amber-900 mb-4">✨ 新しい本を執筆する</h2>
                <div className="flex flex-col gap-4">
                  <input 
                    type="text" 
                    value={topic} 
                    onChange={e => setTopic(e.target.value)} 
                    placeholder="テーマを入力 (例: 宇宙の歴史、美味しいコーヒーの淹れ方)" 
                    className="border p-3 rounded-lg w-full bg-amber-50 focus:bg-white transition"
                  />
                  <div className="flex gap-2">
                    <select 
                      value={bookType} 
                      onChange={e => setBookType(e.target.value)}
                      className="border p-3 rounded-lg bg-white"
                    >
                      <option value="study">📖 参考書・入門書</option>
                      <option value="story">🧚 絵本・物語</option>
                    </select>
                    <button 
                      onClick={generateBook} 
                      disabled={isGenerating} 
                      className={`flex-1 py-3 rounded-lg font-bold text-white shadow transition ${isGenerating ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                      {isGenerating ? 'AIが執筆中...' : '執筆開始'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 本の一覧 */}
              <div>
                <h3 className="font-bold text-amber-900 mb-4 border-b border-amber-300 pb-2">蔵書一覧 ({books.length}冊)</h3>
                {books.length === 0 && <p className="text-center text-gray-400 py-10">まだ本がありません</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {books.map(book => (
                    <div key={book.id} className="group relative">
                      {/* 本の表紙デザイン */}
                      <div 
                        onClick={() => openBook(book)}
                        className="aspect-[3/4] bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-r-lg shadow-lg cursor-pointer hover:-translate-y-2 transition-transform flex flex-col justify-between p-4 border-l-8 border-indigo-950 text-white"
                      >
                        <div className="text-xs opacity-50 text-right">AI BOOK</div>
                        <h4 className="font-bold text-lg leading-snug line-clamp-3">{book.title}</h4>
                        <div className="text-xs opacity-70 border-t border-white/20 pt-2">{book.topic}</div>
                      </div>
                      
                      {/* 削除ボタン */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteBook(book.id!); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full shadow opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- 読書モード --- */}
          {view === 'read' && currentBook && (
            <div className="flex flex-col items-center h-full justify-center">
              <div className="bg-white w-full max-w-2xl aspect-[3/4] md:aspect-[4/3] rounded shadow-2xl border border-gray-200 flex flex-col md:flex-row overflow-hidden relative">
                
                {/* ページ内容 */}
                <div className="flex-1 p-8 md:p-12 flex flex-col justify-center bg-[#fffbf0]">
                  <div className="mb-6 border-b border-amber-200 pb-4">
                     <span className="text-xs text-amber-700 font-bold block mb-1">Page {currentBook.pages[currentPageIndex].page_number}</span>
                     <h2 className="text-2xl font-bold text-gray-900">{currentBook.pages[currentPageIndex].headline}</h2>
                  </div>
                  <p className="text-lg leading-loose text-gray-800 whitespace-pre-wrap flex-1 overflow-y-auto">
                    {currentBook.pages[currentPageIndex].content}
                  </p>
                </div>

                {/* ページめくりボタン */}
                <div className="absolute bottom-4 right-4 flex gap-4">
                  <button 
                    onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    className="bg-amber-800 text-white px-4 py-2 rounded-full disabled:opacity-30 shadow hover:bg-amber-700"
                  >
                    ◀ 前へ
                  </button>
                  <button 
                    onClick={() => setCurrentPageIndex(Math.min(currentBook.pages.length - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex === currentBook.pages.length - 1}
                    className="bg-amber-800 text-white px-4 py-2 rounded-full disabled:opacity-30 shadow hover:bg-amber-700"
                  >
                    次へ ▶
                  </button>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <h3 className="font-bold text-amber-900">{currentBook.title}</h3>
                <p className="text-sm text-amber-700">{currentPageIndex + 1} / {currentBook.pages.length} ページ</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}