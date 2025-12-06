// app/picture-book/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type PageData = {
  page_number: number;
  content: string;
  image_prompt: string;
};

type PictureBook = {
  id: number;
  title: string;
  topic: string;
  pages: PageData[];
};

export default function PictureBookApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'shelf' | 'create' | 'read'>('shelf');
  const [books, setBooks] = useState<PictureBook[]>([]);
  const [currentBook, setCurrentBook] = useState<PictureBook | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingPDF, setIsSavingPDF] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false);
      if (session) fetchBooks();
    });
    return () => stopSpeaking();
  }, []);

  const fetchBooks = async () => {
    const { data } = await supabase.from('picture_books').select('*').order('created_at', { ascending: false });
    if (data) setBooks(data);
  };

  const generateBook = async () => {
    if (!topic) return alert("どんな絵本にするか教えてください");
    setIsGenerating(true);
    try {
      const res = await fetch('/api/picture-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成エラー');
      
      const { error } = await supabase.from('picture_books').insert([{
        title: data.title, topic: topic, pages: data.pages
      }]);
      
      if (!error) {
        alert(`『${data.title}』が完成しました！`);
        setTopic(''); fetchBooks(); setView('shelf');
      }
    } catch (e: any) { 
      alert(e.message || "絵本の作成に失敗しました"); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const openBook = (book: PictureBook) => {
    setCurrentBook(book); setPageIndex(0); setView('read'); stopSpeaking();
  };

  const deleteBook = async (id: number) => {
    if (!confirm("この絵本を削除しますか？")) return;
    await supabase.from('picture_books').delete().eq('id', id);
    fetchBooks();
  };

  const getImageUrl = (prompt: string, seed: number) => {
    const safePrompt = encodeURIComponent(prompt.substring(0, 150));
    return `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=768&nologo=true&seed=${seed}`;
  };

  // ★ PDF保存機能（並列ダウンロードで高速化）
  const savePDF = async () => {
    if (!currentBook) return;
    setIsSavingPDF(true);
    
    try {
      // 1. 必要なリソースを「全て同時に」取得開始する（並列処理）
      const [
        { PDFDocument, rgb, StandardFonts },
        { default: fontkit },
        fontBytes,
        imagesData // 全ページの画像データ配列
      ] = await Promise.all([
        import('pdf-lib'),
        import('@pdf-lib/fontkit'),
        // フォント取得（失敗してもnullを返すだけで止まらないようにする）
        fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer()).catch(() => null),
        // ★全ページの画像を一括取得
        Promise.all(currentBook.pages.map(async (page, i) => {
           try {
             const url = getImageUrl(page.image_prompt, (currentBook.id * 100) + i);
             const res = await fetch(url!);
             if (!res.ok) throw new Error('Image fetch failed');
             return await res.arrayBuffer();
           } catch (e) {
             console.warn(`Page ${i+1} image failed`);
             return null; // 失敗時はnull
           }
        }))
      ]);

      // 2. PDFドキュメント作成
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      let customFont;
      if (fontBytes) {
        customFont = await pdfDoc.embedFont(fontBytes);
      } else {
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        alert("日本語フォントが読み込めませんでした（標準フォントを使用します）");
      }

      // 3. ページ生成（データは既に手元にあるので一瞬で終わる）
      for (let i = 0; i < currentBook.pages.length; i++) {
        const pageData = currentBook.pages[i];
        const imgBuffer = imagesData[i];
        
        const page = pdfDoc.addPage([595, 842]); // A4
        const { width, height } = page.getSize();

        // 画像の埋め込み
        if (imgBuffer) {
          try {
            const image = await pdfDoc.embedJpg(imgBuffer);
            page.drawImage(image, {
              x: (width - 500) / 2,
              y: height - 400,
              width: 500,
              height: 350,
            });
          } catch (e) {
            console.error("画像埋め込みエラー", e);
          }
        }

        // テキスト描画
        const text = pageData.content;
        const fontSize = 18;
        let y = height - 450;
        let currentLine = "";
        
        for (let j = 0; j < text.length; j++) {
           const char = text[j];
           if (currentLine.length > 25) {
             page.drawText(currentLine, { x: 50, y, size: fontSize, font: customFont, color: rgb(0,0,0) });
             currentLine = "";
             y -= 30;
           }
           currentLine += char;
        }
        page.drawText(currentLine, { x: 50, y, size: fontSize, font: customFont, color: rgb(0,0,0) });
        page.drawText(`- ${i + 1} -`, { x: width / 2 - 10, y: 30, size: 12, font: customFont, color: rgb(0.5, 0.5, 0.5) });
      }

      // 4. 保存＆ダウンロード
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${currentBook.title}.pdf`;
      link.click();

    } catch (e) {
      console.error(e);
      alert('PDFの作成に失敗しました。');
    } finally {
      setIsSavingPDF(false);
    }
  };

  const speakCurrentPage = async () => {
    if (!currentBook) return;
    const text = currentBook.pages[pageIndex].content;
    setIsSpeaking(true);
    try {
      const url = `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(text)}&speaker=2`;
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => setIsSpeaking(false);
      }
    } catch (e) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    if (audioRef.current) { audioRef.current.pause(); }
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
  };

  const changePage = (idx: number) => { stopSpeaking(); setPageIndex(idx); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-pink-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col h-screen text-gray-800 font-sans">
      <audio ref={audioRef} className="hidden" />

      <header className="bg-pink-500 text-white p-4 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-pink-600 hover:bg-pink-700 px-3 py-1 rounded-lg font-bold text-xs transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">🎨 AI絵本メーカー</h1>
        </div>
        {view === 'read' && (
           <div className="flex gap-2">
             <button onClick={savePDF} disabled={isSavingPDF} className="text-xs bg-white text-pink-600 px-3 py-1 rounded font-bold shadow hover:bg-pink-100">
               {isSavingPDF ? '作成中(高速)...' : '📄 PDF保存'}
             </button>
             <button onClick={() => setView('shelf')} className="text-xs bg-pink-600 px-3 py-1 rounded">本棚へ</button>
           </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          
          {view === 'shelf' && (
            <div className="space-y-8 pb-20">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 text-center">
                <h2 className="font-bold text-lg text-pink-600 mb-4">✨ どんな絵本を作る？</h2>
                <div className="flex gap-2 max-w-lg mx-auto">
                  <input 
                    type="text" value={topic} onChange={e => setTopic(e.target.value)} 
                    placeholder="例：魔法の森の冒険" 
                    className="flex-1 border-2 border-pink-200 p-3 rounded-xl focus:border-pink-400 outline-none transition"
                  />
                  <button onClick={generateBook} disabled={isGenerating} className="bg-pink-500 text-white px-6 rounded-xl font-bold shadow hover:bg-pink-600 disabled:bg-gray-300">
                    {isGenerating ? '作成中...' : '作る！'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {books.map(book => (
                  <div key={book.id} className="group relative">
                    <div onClick={() => openBook(book)} className="aspect-[4/3] bg-white rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform overflow-hidden border-4 border-white">
                      {book.pages[0]?.image_prompt ? (
                        <img 
                          src={getImageUrl(book.pages[0].image_prompt, (book.id * 100))} 
                          alt="cover" className="w-full h-full object-cover" loading="lazy" 
                        />
                      ) : (
                        <div className="w-full h-full bg-pink-100 flex items-center justify-center text-4xl">🎨</div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-white">
                        <h4 className="font-bold text-sm truncate">{book.title}</h4>
                      </div>
                    </div>
                    <button onClick={() => deleteBook(book.id)} className="absolute -top-2 -right-2 bg-gray-500 text-white w-6 h-6 rounded-full text-xs shadow">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'read' && currentBook && (
            <div className="flex flex-col h-full bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-pink-200">
              <div className="flex-1 bg-gray-100 relative overflow-hidden">
                <img 
                  key={pageIndex} 
                  src={getImageUrl(currentBook.pages[pageIndex].image_prompt, (currentBook.id * 100) + pageIndex)} 
                  alt="挿絵" 
                  className="w-full h-full object-contain bg-black" 
                />
                <button onClick={() => changePage(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0} className="absolute left-0 top-0 bottom-0 w-16 hover:bg-black/20 text-white text-3xl disabled:hidden">◀</button>
                <button onClick={() => changePage(Math.min(currentBook.pages.length - 1, pageIndex + 1))} disabled={pageIndex === currentBook.pages.length - 1} className="absolute right-0 top-0 bottom-0 w-16 hover:bg-black/20 text-white text-3xl disabled:hidden">▶</button>
              </div>
              <div className="bg-white p-6 min-h-[150px] flex flex-col justify-center items-center text-center relative border-t-2 border-pink-100">
                <p className="text-xl font-bold text-gray-800 leading-relaxed font-sans">{currentBook.pages[pageIndex].content}</p>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <span className="text-xs text-gray-400 mt-2 block">{pageIndex + 1} / {currentBook.pages.length}</span>
                  <button onClick={() => isSpeaking ? stopSpeaking() : speakCurrentPage()} className="bg-pink-100 text-pink-600 p-2 rounded-full hover:bg-pink-200 transition">{isSpeaking ? '🔇' : '🗣️'}</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}