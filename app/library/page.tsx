// app/library/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type BookPage = {
  page_number: number;
  headline: string;
  content: string;
};

type Book = {
  id: number;
  title: string;
  topic?: string;
  pages: BookPage[];
};

export default function LibraryApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'shelf' | 'create' | 'read'>('shelf');
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [topic, setTopic] = useState('');
  const [bookType, setBookType] = useState('study');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 読み上げ用
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 編集用
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false);
      if (session) fetchBooks();
    });
    
    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    };
  }, []);

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (data) setBooks(data);
  };

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

  const openBook = (book: Book) => {
    setCurrentBook(book);
    setCurrentPageIndex(0);
    setView('read');
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const deleteBook = async (id: number) => {
    if (!confirm("この本を廃棄しますか？")) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  };

  // タイトル変更（リネーム）
  const startEditing = (book: Book) => {
    setEditingBookId(book.id);
    setEditTitleText(book.title);
  };

  const saveTitle = async (id: number) => {
    if (!editTitleText.trim()) return;
    await supabase.from('books').update({ title: editTitleText }).eq('id', id);
    setEditingBookId(null);
    fetchBooks();
  };

  // ★読み上げテキストのクリーニング（記号除去）
  const cleanText = (text: string) => {
    return text
      .replace(/[#*_\-`]/g, '') // マークダウン記号を削除
      .replace(/\n/g, ' ')      // 改行をスペースに
      .trim();
  };

  // ★読み上げ機能（連続再生対応）
  const speakPage = (pageIndex: number) => {
    if (!currentBook) return;

    // 既に話しているなら停止
    window.speechSynthesis.cancel();

    // 範囲外なら終了
    if (pageIndex >= currentBook.pages.length) {
      setIsSpeaking(false);
      return;
    }

    // ページめくり（画面も同期）
    setCurrentPageIndex(pageIndex);
    setIsSpeaking(true);

    const page = currentBook.pages[pageIndex];
    // 見出し + 本文 を読む
    const textToRead = cleanText(`${page.headline}。${page.content}`);

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    // ★読み終わったら次のページへ
    utterance.onend = () => {
      // 最後のページでなければ次へ
      if (pageIndex < currentBook.pages.length - 1) {
        // 少し間を空けて次へ
        setTimeout(() => speakPage(pageIndex + 1), 500);
      } else {
        setIsSpeaking(false);
      }
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // ボタンからの操作用
  const toggleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakPage(currentPageIndex);
    }
  };

  const changePage = (newIndex: number) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentPageIndex(newIndex);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col h-screen text-gray-800 font-serif">
      
      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-amber-800 hover:bg-amber-700 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">📚 AIライブラリ</h1>
        </div>
        {view !== 'shelf' && (
          <button onClick={() => { setView('shelf'); window.speechSynthesis.cancel(); setIsSpeaking(false); }} className="text-sm bg-amber-800 px-3 py-1 rounded hover:bg-amber-700">本棚に戻る</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          
          {view === 'shelf' && (
            <div className="space-y-8 pb-20">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200">
                <h2 className="font-bold text-lg text-amber-900 mb-4">✨ 新しい本を執筆する</h2>
                <div className="flex flex-col gap-4">
                  <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="テーマ (例: 宇宙の歴史、眠れる森の物語)" className="border p-3 rounded-lg w-full bg-amber-50 focus:bg-white transition" />
                  <div className="flex gap-2">
                    <select value={bookType} onChange={e => setBookType(e.target.value)} className="border p-3 rounded-lg bg-white">
                      <option value="study">📖 参考書・入門書</option>
                      <option value="story">🧚 絵本・物語</option>
                    </select>
                    <button onClick={generateBook} disabled={isGenerating} className={`flex-1 py-3 rounded-lg font-bold text-white shadow transition ${isGenerating ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'}`}>{isGenerating ? 'AIが執筆中...' : '執筆開始'}</button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-amber-900 mb-4 border-b border-amber-300 pb-2">蔵書一覧 ({books.length}冊)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {books.map(book => (
                    <div key={book.id} className="group relative flex flex-col gap-2">
                      <div onClick={() => openBook(book)} className="aspect-[3/4] bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-r-lg shadow-lg cursor-pointer hover:-translate-y-2 transition-transform flex flex-col justify-between p-4 border-l-8 border-indigo-950 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-30 text-4xl">📖</div>
                        <h4 className="font-bold text-lg leading-snug line-clamp-3 z-10">{book.title}</h4>
                        <div className="text-xs opacity-70 border-t border-white/20 pt-2 z-10">{book.topic}</div>
                      </div>
                      
                      {/* 編集・削除エリア */}
                      <div className="flex items-center justify-between px-1">
                        {editingBookId === book.id ? (
                          <div className="flex gap-1 w-full">
                            <input 
                              value={editTitleText} 
                              onChange={e => setEditTitleText(e.target.value)}
                              className="w-full text-xs border rounded p-1"
                              autoFocus
                            />
                            <button onClick={() => saveTitle(book.id)} className="text-green-600 font-bold">✔</button>
                          </div>
                        ) : (
                          <button onClick={() => startEditing(book)} className="text-gray-400 hover:text-blue-500 text-xs flex items-center gap-1">
                            ✏️ 名前変更
                          </button>
                        )}
                        <button onClick={() => deleteBook(book.id)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'read' && currentBook && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#fdf6e3] p-4 border-b border-amber-100 flex justify-between items-center shrink-0">
                <div>
                   <h3 className="font-bold text-amber-900 truncate max-w-[200px] md:max-w-md">{currentBook.title}</h3>
                   <span className="text-xs text-amber-700">Page {currentBook.pages[currentPageIndex].page_number} / {currentBook.pages.length}</span>
                </div>
                <button onClick={toggleSpeak} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow transition ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-white text-orange-600 border border-orange-200'}`}>
                  {isSpeaking ? '🔇 停止' : '🗣️ 連続読上'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-[#fffbf0]">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 border-amber-200">{currentBook.pages[currentPageIndex].headline}</h2>
                <p className="text-lg leading-loose text-gray-800 whitespace-pre-wrap">{currentBook.pages[currentPageIndex].content}</p>
                <div className="h-20"></div>
              </div>

              <div className="bg-[#fdf6e3] p-4 border-t border-amber-100 flex justify-between items-center shrink-0">
                <button onClick={() => changePage(Math.max(0, currentPageIndex - 1))} disabled={currentPageIndex === 0} className="bg-amber-800 text-white px-6 py-3 rounded-lg disabled:opacity-30 shadow hover:bg-amber-700 font-bold flex-1 mr-2">◀ 前へ</button>
                <button onClick={() => changePage(Math.min(currentBook.pages.length - 1, currentPageIndex + 1))} disabled={currentPageIndex === currentBook.pages.length - 1} className="bg-amber-800 text-white px-6 py-3 rounded-lg disabled:opacity-30 shadow hover:bg-amber-700 font-bold flex-1 ml-2">次へ ▶</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}