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
  is_favorite: boolean;
  current_page: number; // ★追加: しおり
};

// ストック用データ型
type RawText = { id: number; title: string; content: string; created_at: string; };

export default function LibraryApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'shelf' | 'create' | 'read' | 'stock'>('shelf');
  const [filterMode, setFilterMode] = useState<'all' | 'fav'>('all');
  const [showMenu, setShowMenu] = useState(false);

  const [books, setBooks] = useState<Book[]>([]);
  const [rawTexts, setRawTexts] = useState<RawText[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [topic, setTopic] = useState('');
  const [bookType, setBookType] = useState('study');
  const [bookLength, setBookLength] = useState('short');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState(''); // 生成状況メッセージ

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
      if (session) { fetchBooks(); fetchRawTexts(); }
    });
    return () => stopSpeaking();
  }, []);

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (data) setBooks(data);
  };
  const fetchRawTexts = async () => {
    const { data } = await supabase.from('raw_texts').select('*').order('created_at', { ascending: false });
    if (data) setRawTexts(data);
  };

  // --- AI生成ロジック (超長編対応) ---
  const generateBook = async () => {
    if (!topic) return alert("テーマを入力してください");
    setIsGenerating(true);
    setGenerateStatus('AIが執筆中...');
    
    try {
      // 1. 前編（または短編）を作成
      if (bookLength === 'super_long') setGenerateStatus('前編を執筆中 (1/2)...');
      
      const res1 = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type: bookType, length: bookLength }),
      });
      if (!res1.ok) throw new Error('生成エラー');
      const data1 = await res1.json();
      
      let finalPages = data1.pages;

      // 2. 超長編なら後編を作成して合体
      if (bookLength === 'super_long') {
        setGenerateStatus('後編を執筆中 (2/2)...');
        // 前編の最後の内容をコンテキストとして渡す
        const lastContent = data1.pages[data1.pages.length - 1].content;
        
        const res2 = await fetch('/api/book', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, type: bookType, length: 'part2', previousContent: lastContent }),
        });
        
        if (res2.ok) {
          const data2 = await res2.json();
          // ページ番号を調整して結合
          const startPage = data1.pages.length + 1;
          const part2Pages = data2.pages.map((p: any, i: number) => ({ ...p, page_number: startPage + i }));
          finalPages = [...finalPages, ...part2Pages];
        }
      }
      
      setGenerateStatus('製本中...');
      const { error } = await supabase.from('books').insert([{
        title: data1.title,
        topic: topic,
        pages: finalPages,
        current_page: 0 // 初期位置
      }]);
      
      if (!error) {
        alert(`「${data1.title}」が出版されました！(全${finalPages.length}ページ)`);
        setTopic(''); fetchBooks(); setView('shelf'); setFilterMode('all');
      }
    } catch (e) { alert("執筆に失敗しました"); } 
    finally { setIsGenerating(false); setGenerateStatus(''); }
  };

  // --- 操作系 ---
  const openBook = (book: Book) => {
    setCurrentBook(book);
    // ★しおりの位置から開く
    const startPage = book.current_page || 0;
    // ページ数が変わっている可能性もあるので安全策
    setCurrentPageIndex(Math.min(startPage, book.pages.length - 1));
    setView('read');
    stopSpeaking();
  };

  // ★ページをめくったら「しおり」を保存
  const saveBookmark = async (bookId: number, pageIndex: number) => {
    // データベースを更新
    await supabase.from('books').update({ current_page: pageIndex }).eq('id', bookId);
    // ローカルも更新
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, current_page: pageIndex } : b));
  };

  const deleteBook = async (id: number) => { if (!confirm("廃棄しますか？")) return; await supabase.from('books').delete().eq('id', id); fetchBooks(); };
  const startEditing = (book: Book) => { setEditingBookId(book.id); setEditTitleText(book.title); };
  const saveTitle = async (id: number) => { if (!editTitleText.trim()) return; await supabase.from('books').update({ title: editTitleText }).eq('id', id); setEditingBookId(null); fetchBooks(); };
  const toggleFavorite = async (id: number, current: boolean, e: React.MouseEvent) => { e.stopPropagation(); setBooks(prev => prev.map(b => b.id === id ? { ...b, is_favorite: !current } : b)); await supabase.from('books').update({ is_favorite: !current }).eq('id', id); };
  
  // ストック機能
  const uploadToStock = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (ev) => { const text = ev.target?.result as string; if (!text) return; const title = file.name.replace(/\.[^/.]+$/, ""); await supabase.from('raw_texts').insert([{ title, content: text }]); alert('保存しました'); fetchRawTexts(); e.target.value = ''; }; reader.readAsText(file); };
  const convertStockToBook = async (raw: RawText) => { if (!confirm(`「${raw.title}」を本にしますか？`)) return; const chars=300; const pages=[]; let p=1; for(let i=0;i<raw.content.length;i+=chars){ pages.push({page_number:p,headline:p===1?raw.title:`ページ ${p}`,content:raw.content.substring(i,i+chars).trim()}); p++; } await supabase.from('books').insert([{ title:raw.title, topic:'インポート', pages }]); alert('本棚に追加しました'); fetchBooks(); setView('shelf'); };
  const deleteStock = async (id: number) => { if(!confirm("削除しますか？")) return; await supabase.from('raw_texts').delete().eq('id', id); fetchRawTexts(); };

  // 読み上げ
  const cleanText = (text: string) => text.replace(/[#*_\-`]/g, '').replace(/\n/g, ' ').trim();
  const speakStandard = (text: string, onEnd: () => void) => { if (typeof window === 'undefined') return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 1.0; u.onend = onEnd; window.speechSynthesis.speak(u); };
  
  const speakCurrentPage = async () => {
    if (!currentBook) return;
    const page = currentBook.pages[currentPageIndex];
    const text = cleanText(page.content); // 見出し読まない
    setIsSpeaking(true); isPlayingRef.current = true;
    const handleNext = () => { if (!isPlayingRef.current) return; if (currentPageIndex < currentBook.pages.length - 1) { setTimeout(() => { if (isPlayingRef.current) changePage(currentPageIndex + 1, true); }, 1000); } else { stopSpeaking(); } };
    if (useVoicevox) { try { const url = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(text)}&speaker=2`; if (audioRef.current) { audioRef.current.src = url; await audioRef.current.play(); audioRef.current.onended = handleNext; audioRef.current.onerror = () => speakStandard(text, handleNext); } } catch (e) { speakStandard(text, handleNext); } } else { speakStandard(text, handleNext); }
  };
  const stopSpeaking = () => { isPlayingRef.current = false; setIsSpeaking(false); if (audioRef.current) { audioRef.current.pause(); } if (typeof window !== 'undefined') window.speechSynthesis.cancel(); };
  const toggleSpeak = () => { if (isSpeaking) stopSpeaking(); else { setIsSpeaking(true); isPlayingRef.current = true; speakCurrentPage(); } };
  
  // ページ変更時にしおり保存
  const changePage = (newIndex: number, autoPlay = false) => {
    stopSpeaking();
    setCurrentPageIndex(newIndex);
    if (currentBook) saveBookmark(currentBook.id, newIndex); // ★しおり保存

    if (autoPlay && currentBook) {
      setIsSpeaking(true);
      setTimeout(() => {
        const page = currentBook.pages[newIndex];
        if (page) speakCurrentPage(); // 再帰呼び出しではなく現在のインデックスで再生
      }, 500);
    }
  };

  // useEffectでの自動再生は廃止（ループ防止のため、changePage内で制御）

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col h-screen text-gray-800 font-serif relative overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* サイドメニュー */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/50 flex-1" onClick={() => setShowMenu(false)}></div>
          <div className="bg-amber-50 w-64 h-full shadow-2xl p-4 flex flex-col animate-slideInRight border-l border-amber-200">
            <h2 className="font-bold text-xl mb-6 text-amber-900 border-b border-amber-200 pb-2">本棚メニュー</h2>
            <div className="space-y-2">
              <button onClick={() => { setFilterMode('all'); setShowMenu(false); setView('shelf'); }} className={`w-full p-3 rounded-lg font-bold text-left flex items-center gap-2 ${filterMode === 'all' && view === 'shelf' ? 'bg-amber-200 text-amber-900' : 'text-gray-600 hover:bg-amber-100'}`}>📚 すべての本</button>
              <button onClick={() => { setFilterMode('fav'); setShowMenu(false); setView('shelf'); }} className={`w-full p-3 rounded-lg font-bold text-left flex items-center gap-2 ${filterMode === 'fav' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-pink-50'}`}>❤ お気に入り</button>
              <div className="border-t border-amber-200 my-2"></div>
              <button onClick={() => { setView('stock'); setShowMenu(false); }} className={`w-full p-3 rounded-lg font-bold text-left flex items-center gap-2 ${view === 'stock' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-amber-100'}`}>📂 テキストストック</button>
              <div className="border-t border-amber-200 my-2"></div>
              <button onClick={() => { setView('create'); setShowMenu(false); }} className="w-full p-3 rounded-lg font-bold text-left text-amber-800 hover:bg-amber-100">✨ 新しく執筆する</button>
            </div>
            <button onClick={() => setShowMenu(false)} className="mt-auto p-3 text-gray-400 text-center">閉じる</button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-amber-800 hover:bg-amber-700 px-3 py-1 rounded-lg font-bold text-xs transition">🔙 ホーム</Link>
          <h1 className="text-lg font-bold">{view === 'stock' ? '📂 ストック' : (filterMode === 'all' ? '📚 AIライブラリ' : '❤ お気に入り')}</h1>
        </div>
        {view === 'read' ? (
          <button onClick={() => { setView('shelf'); stopSpeaking(); }} className="text-xs bg-amber-800 px-3 py-1 rounded hover:bg-amber-700">本棚へ</button>
        ) : (
          <button onClick={() => setShowMenu(true)} className="p-2 rounded hover:bg-amber-800 text-2xl">☰</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
          
          {/* 作成画面 */}
          {view === 'create' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200">
              <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg text-amber-900">✨ 新しい本を執筆</h2><button onClick={() => setView('shelf')} className="text-sm text-gray-400">キャンセル</button></div>
              <div className="flex flex-col gap-4">
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="テーマ (例: 宇宙の歴史)" className="border p-3 rounded-lg w-full bg-amber-50" />
                <div className="flex gap-2">
                  <select value={bookType} onChange={e => setBookType(e.target.value)} className="border p-3 rounded-lg bg-white"><option value="study">📖 参考書</option><option value="story">🧚 絵本</option></select>
                  {/* ★超長編を追加 */}
                  <select value={bookLength} onChange={e => setBookLength(e.target.value)} className="border p-3 rounded-lg bg-white">
                    <option value="short">短編 (5頁)</option>
                    <option value="long">中編 (15頁)</option>
                    <option value="super_long">超長編 (40頁)</option>
                  </select>
                  <button onClick={generateBook} disabled={isGenerating} className="flex-1 py-3 rounded-lg font-bold text-white shadow bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400">{isGenerating ? generateStatus || '執筆中...' : '作成'}</button>
                </div>
              </div>
            </div>
          )}

          {/* 本棚モード */}
          {view === 'shelf' && (
            <div className="pb-20">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayedBooks.map(book => (
                  <div key={book.id} className="group relative flex flex-col gap-2">
                    <div onClick={() => openBook(book)} className="aspect-[3/4] bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-r-lg shadow-lg cursor-pointer hover:-translate-y-2 transition-transform flex flex-col justify-center items-center border-l-8 border-indigo-950 text-white relative overflow-hidden p-3 text-center">
                       <button onClick={(e) => toggleFavorite(book.id, book.is_favorite, e)} className={`absolute top-2 right-2 text-2xl z-20 ${book.is_favorite ? 'text-pink-500' : 'text-white/30 hover:text-pink-300'}`}>{book.is_favorite ? '♥' : '♡'}</button>
                       <div className="text-4xl mb-2 z-10">📖</div>
                       <h4 className="font-bold text-sm leading-snug line-clamp-3 z-10">{book.title}</h4>
                       <span className="text-[10px] bg-black/30 px-2 rounded mt-2">P.{book.current_page || 0} / {book.pages.length}</span>
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
              {displayedBooks.length === 0 && <div className="text-center text-gray-400 py-20"><p className="text-4xl mb-2">📭</p><p>本がありません</p></div>}
            </div>
          )}

          {/* ストックモード */}
          {view === 'stock' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-dashed border-green-300 text-center cursor-pointer relative">
                 <input type="file" accept=".txt" onChange={uploadToStock} className="absolute inset-0 opacity-0 cursor-pointer" />
                 <p className="text-2xl mb-2">📄</p>
                 <p className="font-bold text-green-700">テキストファイルをここに追加</p>
              </div>
              <div className="grid gap-3">
                {rawTexts.map(raw => (
                  <div key={raw.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                    <div className="flex-1 min-w-0"><h4 className="font-bold text-gray-800 truncate text-lg">📄 {raw.title}</h4></div>
                    <div className="flex gap-2">
                       <button onClick={() => convertStockToBook(raw)} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow">📖 本にする</button>
                       <button onClick={() => deleteStock(raw.id)} className="text-gray-300 hover:text-red-500 px-2">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 読書モード */}
          {view === 'read' && currentBook && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#fdf6e3] p-4 border-b border-amber-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
                <div><h3 className="font-bold text-amber-900 truncate max-w-[150px] md:max-w-md">{currentBook.title}</h3><span className="text-xs text-amber-700">Page {currentBook.pages[currentPageIndex].page_number} / {currentBook.pages.length}</span></div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer bg-white px-2 py-1 rounded border border-amber-200"><input type="checkbox" checked={useVoicevox} onChange={() => setUseVoicevox(!useVoicevox)} />美声モード</label>
                  <button onClick={toggleSpeak} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow transition ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-white text-orange-600 border border-orange-200'}`}>{isSpeaking ? '🔇 停止' : '🗣️ 連続読上'}</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-[#fffbf0] p-6 md:p-12">
                <div className="max-w-3xl mx-auto">
                   <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 border-amber-200">{currentBook.pages[currentPageIndex].headline}</h2>
                   <p className="text-lg leading-loose text-gray-800 whitespace-pre-wrap font-medium">{currentBook.pages[currentPageIndex].content}</p>
                   <div className="h-20"></div>
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