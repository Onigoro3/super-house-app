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
  image_prompt?: string;
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
  const [bookLength, setBookLength] = useState('short'); // ★追加: 長さ選択
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [useVoicevox, setUseVoicevox] = useState(true);
  const isPlayingRef = useRef(false);

  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false);
      if (session) fetchBooks();
    });
    return () => stopSpeaking();
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
        // ★ length を送信
        body: JSON.stringify({ topic, type: bookType, length: bookLength }),
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
    } catch (e) { alert("執筆に失敗しました。長編の場合は時間を置いて試すか、短編にしてみてください。"); } 
    finally { setIsGenerating(false); }
  };

  const openBook = (book: Book) => {
    setCurrentBook(book);
    setCurrentPageIndex(0);
    setView('read');
    stopSpeaking();
  };

  const deleteBook = async (id: number) => {
    if (!confirm("この本を廃棄しますか？")) return;
    await supabase.from('books').delete().eq('id', id);
    fetchBooks();
  };

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

  const cleanText = (text: string) => {
    return text.replace(/[#*_\-`]/g, '').replace(/\n/g, ' ').trim();
  };

  const speakStandard = (text: string, onEnd: () => void) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  const speakCurrentPage = async () => {
    if (!currentBook) return;
    const page = currentBook.pages[currentPageIndex];
    // ★修正: headline（見出し）を含めず、content（本文）だけを読む
    const text = cleanText(page.content);
    
    setIsSpeaking(true);
    isPlayingRef.current = true;

    const handleNext = () => {
      if (!isPlayingRef.current) return;
      if (currentPageIndex < currentBook.pages.length - 1) {
        setTimeout(() => {
          if (isPlayingRef.current) setCurrentPageIndex(prev => prev + 1);
        }, 1000);
      } else {
        stopSpeaking();
      }
    };

    if (useVoicevox) {
      try {
        const queryUrl = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(text)}&speaker=2`;
        if (audioRef.current) {
          audioRef.current.src = queryUrl;
          await audioRef.current.play();
          audioRef.current.onended = handleNext;
          audioRef.current.onerror = () => { console.warn("VOICEVOX Error"); speakStandard(text, handleNext); };
        }
      } catch (e) { console.warn("API Error"); speakStandard(text, handleNext); }
    } else {
      speakStandard(text, handleNext);
    }
  };

  useEffect(() => {
    if (isSpeaking && currentBook) {
       speakCurrentPage();
    }
  }, [currentPageIndex]);

  const stopSpeaking = () => {
    isPlayingRef.current = false;
    setIsSpeaking(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
  };

  const toggleSpeak = () => {
    if (isSpeaking) stopSpeaking();
    else { setIsSpeaking(true); isPlayingRef.current = true; speakCurrentPage(); }
  };

  const changePage = (newIndex: number) => {
    stopSpeaking();
    setCurrentPageIndex(newIndex);
  };

  const getImageUrl = (prompt?: string) => {
    if (!prompt) return null;
    const safePrompt = encodeURIComponent(prompt.substring(0, 150));
    return `https://image.pollinations.ai/prompt/${safePrompt}%20anime%20style,%20cute,%20vivid%20colors,%20high%20quality?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col h-screen text-gray-800 font-serif">
      <audio ref={audioRef} className="hidden" />

      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-amber-800 hover:bg-amber-700 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">📚 AIライブラリ</h1>
        </div>
        {view !== 'shelf' && (
          <button onClick={() => { setView('shelf'); stopSpeaking(); }} className="text-sm bg-amber-800 px-3 py-1 rounded hover:bg-amber-700">本棚に戻る</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
          
          {view === 'shelf' && (
            <div className="space-y-8 pb-20">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200">
                <h2 className="font-bold text-lg text-amber-900 mb-4">✨ 新しい本を執筆する</h2>
                <div className="flex flex-col gap-4">
                  <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="テーマ (例: 宇宙の歴史、眠れる森の物語)" className="border p-3 rounded-lg w-full bg-amber-50 focus:bg-white transition" />
                  <div className="flex gap-2">
                    <select value={bookType} onChange={e => setBookType(e.target.value)} className="border p-3 rounded-lg bg-white"><option value="study">📖 参考書</option><option value="story">🧚 絵本</option></select>
                    
                    {/* ★長さ選択 */}
                    <select value={bookLength} onChange={e => setBookLength(e.target.value)} className="border p-3 rounded-lg bg-white">
                      <option value="short">短編 (5-8頁)</option>
                      <option value="long">長編 (約20頁)</option>
                    </select>

                    <button onClick={generateBook} disabled={isGenerating} className={`flex-1 py-3 rounded-lg font-bold text-white shadow transition ${isGenerating ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'}`}>{isGenerating ? 'AIが執筆中...' : '執筆開始'}</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {books.map(book => (
                  <div key={book.id} className="group relative flex flex-col gap-2">
                    <div onClick={() => openBook(book)} className="aspect-[3/4] bg-white rounded-r-lg shadow-lg cursor-pointer hover:-translate-y-2 transition-transform flex flex-col border-l-8 border-indigo-950 text-white relative overflow-hidden">
                      {book.pages[0]?.image_prompt ? (
                        <img src={getImageUrl(book.pages[0].image_prompt) || ''} alt="cover" className="w-full h-full object-cover opacity-90" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center text-4xl">📖</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3">
                        <h4 className="font-bold text-white text-sm leading-snug line-clamp-2 shadow-sm">{book.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      {editingBookId === book.id ? (
                        <div className="flex gap-1 w-full"><input value={editTitleText} onChange={e => setEditTitleText(e.target.value)} className="w-full text-xs border rounded p-1" autoFocus /><button onClick={() => saveTitle(book.id)} className="text-green-600 font-bold">✔</button></div>
                      ) : (
                        <button onClick={() => startEditing(book)} className="text-gray-400 hover:text-blue-500 text-xs flex items-center gap-1">✏️ 名前変更</button>
                      )}
                      <button onClick={() => deleteBook(book.id)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'read' && currentBook && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#fdf6e3] p-4 border-b border-amber-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
                <div><h3 className="font-bold text-amber-900 truncate max-w-[150px] md:max-w-md">{currentBook.title}</h3><span className="text-xs text-amber-700">Page {currentBook.pages[currentPageIndex].page_number} / {currentBook.pages.length}</span></div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer bg-white px-2 py-1 rounded border border-amber-200"><input type="checkbox" checked={useVoicevox} onChange={() => setUseVoicevox(!useVoicevox)} />美声モード</label>
                  <button onClick={toggleSpeak} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow transition ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-white text-orange-600 border border-orange-200'}`}>{isSpeaking ? '🔇 停止' : '🗣️ 連続読上'}</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-[#fffbf0] flex flex-col md:flex-row">
                <div className="w-full md:w-1/2 h-64 md:h-auto bg-gray-100 relative shrink-0 overflow-hidden">
                  {currentBook.pages[currentPageIndex].image_prompt ? (
                    <img src={getImageUrl(currentBook.pages[currentPageIndex].image_prompt) || ''} alt="挿絵" className="w-full h-full object-cover transition-opacity duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">挿絵なし</div>
                  )}
                </div>
                <div className="flex-1 p-6 md:p-10 flex flex-col">
                  {/* ★見出しは表示するが、読み上げ対象からは外れる */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 border-amber-200">{currentBook.pages[currentPageIndex].headline}</h2>
                  <p className="text-lg leading-loose text-gray-800 whitespace-pre-wrap">{currentBook.pages[currentPageIndex].content}</p>
                  <div className="h-10"></div>
                </div>
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