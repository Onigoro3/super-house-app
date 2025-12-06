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
  current_page: number;
};

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
  const [generateStatus, setGenerateStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // --- 読み上げ設定 ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [useVoicevox, setUseVoicevox] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0); 
  const [speechVolume, setSpeechVolume] = useState(1.0); 
  const [showSettings, setShowSettings] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false); // 再生中フラグ
  const currentTextRef = useRef(""); // 現在読み上げ中のテキスト

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

  // ★重要：ページが変わった時の自動再生処理
  useEffect(() => {
    if (isPlayingRef.current && currentBook) {
      // ページ遷移直後は少し待ってから再生開始（安定化のため）
      const timer = setTimeout(() => {
        playCurrentContent();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPageIndex]);

  // ★重要：速度・音量変更時のリアルタイム反映
  useEffect(() => {
    // VOICEVOXの場合（audioタグ）
    if (audioRef.current) {
      audioRef.current.playbackRate = speechRate;
      audioRef.current.volume = speechVolume;
    }
    
    // 標準音声の場合（途中変更できないため、読み直す）
    if (isPlayingRef.current && !useVoicevox && typeof window !== 'undefined' && window.speechSynthesis.speaking) {
       // 現在のテキストを新しい設定で読み直す
       window.speechSynthesis.cancel();
       speakStandard(currentTextRef.current);
    }
  }, [speechRate, speechVolume, useVoicevox]);

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (data) setBooks(data);
  };
  const fetchRawTexts = async () => {
    const { data } = await supabase.from('raw_texts').select('*').order('created_at', { ascending: false });
    if (data) setRawTexts(data);
  };

  const displayedBooks = filterMode === 'all' ? books : books.filter(b => b.is_favorite);

  const generateBook = async () => {
    if (!topic) return alert("テーマを入力してください");
    setIsGenerating(true);
    setGenerateStatus('AIが執筆中...');
    try {
      if (bookLength === 'super_long') setGenerateStatus('前編を執筆中 (1/2)...');
      const res1 = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type: bookType, length: bookLength }),
      });
      if (!res1.ok) throw new Error('生成エラー');
      const data1 = await res1.json();
      let finalPages = data1.pages;

      if (bookLength === 'super_long') {
        setGenerateStatus('後編を執筆中 (2/2)...');
        const lastContent = data1.pages[data1.pages.length - 1].content;
        const res2 = await fetch('/api/book', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, type: bookType, length: 'part2', previousContent: lastContent }),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          const startPage = data1.pages.length + 1;
          const part2Pages = data2.pages.map((p: any, i: number) => ({ ...p, page_number: startPage + i }));
          finalPages = [...finalPages, ...part2Pages];
        }
      }
      setGenerateStatus('製本中...');
      const { error } = await supabase.from('books').insert([{ title: data1.title, topic: topic, pages: finalPages, current_page: 0 }]);
      if (!error) { alert(`「${data1.title}」が出版されました！`); setTopic(''); fetchBooks(); setView('shelf'); setFilterMode('all'); }
    } catch (e) { alert("執筆に失敗しました"); } 
    finally { setIsGenerating(false); setGenerateStatus(''); }
  };

  const uploadToStock = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (ev) => { const text = ev.target?.result as string; if (!text) return; const title = file.name.replace(/\.[^/.]+$/, ""); await supabase.from('raw_texts').insert([{ title, content: text }]); alert('保存しました'); fetchRawTexts(); e.target.value = ''; }; reader.readAsText(file); };
  
  const convertStockToBook = async (raw: RawText) => {
    if (!confirm(`「${raw.title}」を本にしますか？`)) return;
    const pages: BookPage[] = [];
    const lines = raw.content.split('\n');
    let currentPageContent = "";
    let currentHeadline = raw.title;
    let pageNum = 1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#')) {
        if (currentPageContent.trim()) { pages.push({ page_number: pageNum++, headline: currentHeadline, content: currentPageContent.trim() }); currentPageContent = ""; }
        currentHeadline = line.replace(/^#+\s*/, '');
      } else {
        currentPageContent += line + "\n";
        if (currentPageContent.length > 500) { pages.push({ page_number: pageNum++, headline: currentHeadline, content: currentPageContent.trim() }); currentPageContent = ""; currentHeadline = `(続き) ${currentHeadline}`; }
      }
    }
    if (currentPageContent.trim()) { pages.push({ page_number: pageNum++, headline: currentHeadline, content: currentPageContent.trim() }); }
    if (pages.length === 0) { const chars = 300; let p=1; for(let i=0;i<raw.content.length;i+=chars){ pages.push({page_number:p,headline:p===1?raw.title:`ページ ${p}`,content:raw.content.substring(i,i+chars).trim()}); p++; } }
    
    const { error } = await supabase.from('books').insert([{ title: raw.title, topic: 'インポート', pages, current_page: 0 }]);
    if (!error) { alert('本棚に追加しました！'); fetchBooks(); setView('shelf'); } 
    else { alert('作成失敗'); }
  };

  const deleteStock = async (id: number) => { if(!confirm("削除しますか？")) return; await supabase.from('raw_texts').delete().eq('id', id); fetchRawTexts(); };

  const openBook = (book: Book) => { setCurrentBook(book); const startPage = book.current_page || 0; setCurrentPageIndex(Math.min(startPage, book.pages.length - 1)); setView('read'); stopSpeaking(); };
  const saveBookmark = async (bookId: number, pageIndex: number) => { await supabase.from('books').update({ current_page: pageIndex }).eq('id', bookId); setBooks(prev => prev.map(b => b.id === bookId ? { ...b, current_page: pageIndex } : b)); };
  const deleteBook = async (id: number) => { if (!confirm("廃棄しますか？")) return; await supabase.from('books').delete().eq('id', id); fetchBooks(); };
  const startEditing = (book: Book) => { setEditingBookId(book.id); setEditTitleText(book.title); };
  const saveTitle = async (id: number) => { if (!editTitleText.trim()) return; await supabase.from('books').update({ title: editTitleText }).eq('id', id); setEditingBookId(null); fetchBooks(); };
  const toggleFavorite = async (id: number, current: boolean, e: React.MouseEvent) => { e.stopPropagation(); setBooks(prev => prev.map(b => b.id === id ? { ...b, is_favorite: !current } : b)); await supabase.from('books').update({ is_favorite: !current }).eq('id', id); };

  // --- 読み上げロジック ---
  const cleanText = (text: string) => text.replace(/[#*_\-`]/g, '').replace(/\n/g, ' ').trim();

  // 音声終了時のハンドラ（次ページへ）
  const handleAudioEnd = () => {
    if (!isPlayingRef.current || !currentBook) return;
    
    if (currentPageIndex < currentBook.pages.length - 1) {
      // ページ番号をインクリメント（useEffectが検知して次の再生を開始する）
      setCurrentPageIndex(prev => prev + 1);
    } else {
      stopSpeaking(); // 最後まで読んだら停止
    }
  };

  // 標準音声再生
  const speakStandard = (text: string) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = speechRate; 
    u.volume = speechVolume;
    u.onend = handleAudioEnd; // 終わったら次へ
    
    window.speechSynthesis.speak(u);
  };
  
  // 現在のページを再生
  const playCurrentContent = async () => {
    if (!currentBook) return;
    const page = currentBook.pages[currentPageIndex];
    // インポート本は見出しも、AI本は本文のみ
    const textToRead = currentBook.topic === 'インポート' 
      ? cleanText(`${page.headline}。\n${page.content}`) 
      : cleanText(page.content);
    
    // 現在のテキストを保存（速度変更時の読み直し用）
    currentTextRef.current = textToRead;

    if (useVoicevox) {
      try {
        const url = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(textToRead)}&speaker=2`;
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.playbackRate = speechRate;
          audioRef.current.volume = speechVolume;
          await audioRef.current.play();
          
          audioRef.current.onended = handleAudioEnd; 
          audioRef.current.onerror = () => { 
            console.warn("VOICEVOX Error, fallback");
            speakStandard(textToRead); 
          };
        }
      } catch (e) {
        speakStandard(textToRead);
      }
    } else {
      speakStandard(textToRead);
    }
  };

  const stopSpeaking = () => {
    isPlayingRef.current = false;
    setIsSpeaking(false);
    if (audioRef.current) { 
      audioRef.current.pause(); 
      audioRef.current.currentTime = 0; 
    }
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
  };

  const toggleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      setIsSpeaking(true);
      isPlayingRef.current = true;
      playCurrentContent();
    }
  };

  const changePage = (newIndex: number) => {
    // 手動めくりの場合は一旦停止
    stopSpeaking();
    setCurrentPageIndex(newIndex);
    if (currentBook) saveBookmark(currentBook.id, newIndex);
  };

  const downloadText = () => { if (!currentBook) return; const content = `${currentBook.title}\n\n` + currentBook.pages.map(p => `[${p.headline}]\n${p.content}`).join('\n\n'); const blob = new Blob([content], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${currentBook.title}.txt`; link.click(); };
  const downloadPDF = async () => {
    if (!currentBook) return;
    setIsDownloading(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.create(); pdfDoc.registerFontkit(fontkit);
      let customFont; try { const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer()); customFont = await pdfDoc.embedFont(fontBytes); } catch (e) { customFont = await pdfDoc.embedFont(StandardFonts.Helvetica); }
      for (let i = 0; i < currentBook.pages.length; i++) {
        const bookPage = currentBook.pages[i];
        const page = pdfDoc.addPage([595, 842]);
        const { height } = page.getSize(); let y = height - 50;
        const drawWrappedText = (text: string, x: number, y: number, size: number, maxWidth: number, color: any) => { let currentLine = ''; for (let j = 0; j < text.length; j++) { const width = customFont.widthOfTextAtSize(currentLine + text[j], size); if (width > maxWidth) { page.drawText(currentLine, { x, y, size, font: customFont, color }); currentLine = text[j]; y -= size * 1.5; } else { currentLine += text[j]; } } page.drawText(currentLine, { x, y, size, font: customFont, color }); return y - (size * 1.5); };
        page.drawText(currentBook.title, { x: 50, y, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) }); page.drawText(`P.${i + 1}`, { x: 500, y, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) }); y -= 40;
        y = drawWrappedText(bookPage.headline, 50, y, 20, 500, rgb(0, 0, 0)); y -= 20; drawWrappedText(bookPage.content, 50, y, 12, 500, rgb(0, 0, 0));
      }
      const pdfBytes = await pdfDoc.save(); const blob = new Blob([pdfBytes as any], { type: 'application/pdf' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${currentBook.title}.pdf`; link.click();
    } catch (e) { alert('PDF作成失敗'); } finally { setIsDownloading(false); }
  };

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
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-amber-800 hover:bg-amber-700 px-3 py-1 rounded-lg font-bold text-sm transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">{view === 'stock' ? '📂 ストック' : (filterMode === 'all' ? '📚 AIライブラリ' : '❤ お気に入り')}</h1>
        </div>
        {view === 'read' ? (
          <button onClick={() => { setView('shelf'); stopSpeaking(); }} className="text-xs bg-amber-800 px-3 py-1 rounded hover:bg-amber-700">本棚へ</button>
        ) : (
          <button onClick={() => setShowMenu(true)} className="p-2 rounded hover:bg-amber-800 text-2xl">☰</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
          {/* 作成画面・本棚・ストック（省略なし） */}
          {view === 'create' && <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200"><div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg text-amber-900">✨ 新しい本を執筆</h2><button onClick={() => setView('shelf')} className="text-sm text-gray-400">キャンセル</button></div><div className="flex flex-col gap-4"><input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="テーマ (例: 宇宙の歴史)" className="border p-3 rounded-lg w-full bg-amber-50" /><div className="flex gap-2"><select value={bookType} onChange={e => setBookType(e.target.value)} className="border p-3 rounded-lg bg-white"><option value="study">📖 参考書</option><option value="story">🧚 絵本</option></select><select value={bookLength} onChange={e => setBookLength(e.target.value)} className="border p-3 rounded-lg bg-white"><option value="short">短編</option><option value="long">中編</option><option value="super_long">超長編</option></select><button onClick={generateBook} disabled={isGenerating} className="flex-1 py-3 rounded-lg font-bold text-white shadow bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400">{isGenerating ? generateStatus || '執筆中...' : '作成'}</button></div></div></div>}
          
          {view === 'shelf' && <div className="pb-20"><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{displayedBooks.map(book => <div key={book.id} className="group relative flex flex-col gap-2"><div onClick={() => openBook(book)} className="aspect-[3/4] bg-white rounded-r-lg shadow-lg cursor-pointer hover:-translate-y-2 transition-transform flex flex-col justify-center items-center border-l-8 border-indigo-950 text-gray-800 relative overflow-hidden p-4 text-center border-2 border-amber-100"><button onClick={(e) => toggleFavorite(book.id, book.is_favorite, e)} className={`absolute top-2 right-2 text-2xl z-20 ${book.is_favorite ? 'text-pink-500' : 'text-gray-300 hover:text-pink-300'}`}>{book.is_favorite ? '♥' : '♡'}</button><h4 className="font-bold text-lg leading-snug line-clamp-3 mb-2">{book.title}</h4><div className="w-full border-t border-gray-200 my-2"></div><span className="text-xs text-gray-500">P.{book.current_page || 0 + 1} / {book.pages.length}</span></div><div className="flex items-center justify-between px-1">{editingBookId === book.id ? <div className="flex gap-1 w-full"><input value={editTitleText} onChange={e => setEditTitleText(e.target.value)} className="w-full text-xs border rounded p-1" autoFocus /><button onClick={() => saveTitle(book.id)} className="text-green-600 font-bold">✔</button></div> : <button onClick={() => startEditing(book)} className="text-gray-400 hover:text-blue-500 text-xs flex items-center gap-1">✏️ 名前変更</button>}<button onClick={() => deleteBook(book.id)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button></div></div>)}</div>{displayedBooks.length === 0 && <div className="text-center text-gray-400 py-20"><p className="text-4xl mb-2">📭</p><p>本がありません</p></div>}</div>}
          
          {view === 'stock' && <div className="space-y-6"><div className="bg-white p-6 rounded-lg shadow-sm border-2 border-dashed border-green-300 text-center cursor-pointer relative hover:bg-green-50"><input type="file" accept=".txt" onChange={uploadToStock} className="absolute inset-0 opacity-0 cursor-pointer" /><p className="text-2xl mb-2">📄</p><p className="font-bold text-green-700">テキストファイルをここに追加</p></div><div className="grid gap-3">{rawTexts.map(raw => <div key={raw.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center"><div className="flex-1 min-w-0"><h4 className="font-bold text-gray-800 truncate text-lg">📄 {raw.title}</h4></div><div className="flex gap-2"><button onClick={() => convertStockToBook(raw)} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow">📖 本にする</button><button onClick={() => deleteStock(raw.id)} className="text-gray-300 hover:text-red-500 px-2">🗑️</button></div></div>)}</div></div>}

          {/* 読書モード */}
          {view === 'read' && currentBook && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#fdf6e3] p-4 border-b border-amber-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
                <div><h3 className="font-bold text-amber-900 truncate max-w-[150px] md:max-w-md">{currentBook.title}</h3><span className="text-xs text-amber-700">Page {currentBook.pages[currentPageIndex].page_number} / {currentBook.pages.length}</span></div>
                <div className="flex items-center gap-2">
                  <button onClick={downloadText} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">TXT</button>
                  <button onClick={downloadPDF} disabled={isDownloading} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">PDF</button>
                  <div className="w-1 h-6 bg-gray-300 mx-1"></div>
                  <button onClick={() => setShowSettings(!showSettings)} className="text-xs bg-amber-100 px-2 py-1 rounded hover:bg-amber-200">⚙</button>
                  <button onClick={toggleSpeak} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow transition ${isSpeaking ? 'bg-orange-500 text-white animate-pulse' : 'bg-white text-orange-600 border border-orange-200'}`}>{isSpeaking ? '🔇 停止' : '🗣️ 連続読上'}</button>
                </div>
              </div>

              {/* 設定パネル */}
              {showSettings && <div className="bg-[#fff9e6] p-4 border-b border-amber-200 animate-fadeIn"><div className="flex flex-wrap gap-6 items-center justify-center"><label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border border-amber-300"><input type="checkbox" checked={useVoicevox} onChange={() => setUseVoicevox(!useVoicevox)} /><span className="text-sm font-bold text-amber-800">美声モード</span></label><div className="flex items-center gap-2"><span className="text-xs font-bold text-amber-700">速度: {speechRate.toFixed(1)}</span><input type="range" min="0.5" max="2.0" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))} className="w-24 accent-amber-600" /></div><div className="flex items-center gap-2"><span className="text-xs font-bold text-amber-700">音量: {Math.round(speechVolume * 100)}%</span><input type="range" min="0" max="1.0" step="0.1" value={speechVolume} onChange={(e) => setSpeechVolume(parseFloat(e.target.value))} className="w-24 accent-amber-600" /></div></div></div>}

              <div className="flex-1 overflow-y-auto bg-[#fffbf0] p-6 md:p-12">
                <div className="max-w-3xl mx-auto text-center">
                   <h2 className="text-2xl font-bold text-gray-900 mb-8 border-b-2 border-amber-200 inline-block pb-2 px-4">{currentBook.pages[currentPageIndex].headline}</h2>
                   <p className="text-lg leading-loose text-gray-800 whitespace-pre-wrap font-medium text-left">{currentBook.pages[currentPageIndex].content}</p>
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