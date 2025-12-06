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
    } catch (e: any) { alert(e.message || "絵本の作成に失敗しました"); } finally { setIsGenerating(false); }
  };

  const openBook = (book: PictureBook) => { setCurrentBook(book); setPageIndex(0); setView('read'); stopSpeaking(); };
  const deleteBook = async (id: number) => { if (!confirm("削除しますか？")) return; await supabase.from('picture_books').delete().eq('id', id); fetchBooks(); };

  const getImageUrl = (prompt: string, seed: number) => {
    const safePrompt = encodeURIComponent(prompt.substring(0, 150));
    return `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=768&nologo=true&seed=${seed}`;
  };

  // ★テキスト保存
  const downloadText = () => {
    if (!currentBook) return;
    const content = `『${currentBook.title}』\n\n` + currentBook.pages.map(p => `[ページ${p.page_number}]\n${p.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentBook.title}.txt`;
    link.click();
  };

  // ★現在表示中の画像を保存
  const downloadCurrentImage = async () => {
    if (!currentBook) return;
    const page = currentBook.pages[pageIndex];
    const url = getImageUrl(page.image_prompt, (currentBook.id * 100) + pageIndex);
    if (!url) return;

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${currentBook.title}_p${pageIndex + 1}.jpg`;
      link.click();
    } catch (e) {
      alert("画像のダウンロードに失敗しました");
    }
  };

  // ★PDF保存（レイアウト修正版）
  const savePDF = async () => {
    if (!currentBook) return;
    setIsSavingPDF(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      let customFont;
      try {
        const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
      } catch (e) {
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        alert("日本語フォントが読み込めませんでした。");
      }

      for (let i = 0; i < currentBook.pages.length; i++) {
        const pageData = currentBook.pages[i];
        let page = pdfDoc.addPage([595, 842]); // A4
        const { width, height } = page.getSize();

        // 画像配置
        try {
          const imgUrl = getImageUrl(pageData.image_prompt, (currentBook.id * 100) + i);
          const imgBytes = await fetch(imgUrl!).then(res => res.arrayBuffer());
          const image = await pdfDoc.embedJpg(imgBytes);
          
          // 画像サイズ調整 (幅500px, 比率維持)
          const imgDims = image.scaleToFit(500, 350);
          page.drawImage(image, {
            x: (width - imgDims.width) / 2,
            y: height - imgDims.height - 50, // 上部マージン
            width: imgDims.width,
            height: imgDims.height,
          });
        } catch (e) { console.error("画像エラー", e); }

        // テキスト配置 (高度な折り返し処理)
        const text = pageData.content;
        const fontSize = 16;
        const lineHeight = fontSize * 1.6;
        const maxWidth = 500; // テキストエリア幅
        let textY = height - 430; // 画像の下からスタート

        // 段落ごとに処理
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
          let currentLine = "";
          for (let j = 0; j < paragraph.length; j++) {
            const char = paragraph[j];
            const textWidth = customFont.widthOfTextAtSize(currentLine + char, fontSize);
            
            if (textWidth > maxWidth) {
              // 行を描画
              page.drawText(currentLine, { x: 50, y: textY, size: fontSize, font: customFont, color: rgb(0,0,0) });
              currentLine = char;
              textY -= lineHeight;
              
              // ページ下端チェック（溢れたら次ページへ）
              if (textY < 50) {
                page = pdfDoc.addPage([595, 842]);
                textY = height - 50;
              }
            } else {
              currentLine += char;
            }
          }
          // 残りの文字を描画
          if (currentLine) {
            page.drawText(currentLine, { x: 50, y: textY, size: fontSize, font: customFont, color: rgb(0,0,0) });
            textY -= lineHeight;
          }
          // 段落間の余白
          textY -= lineHeight * 0.5; 
          
          // ページ下端チェック
          if (textY < 50) {
            page = pdfDoc.addPage([595, 842]);
            textY = height - 50;
          }
        }

        // ページ番号
        page.drawText(`- ${i + 1} -`, { x: width / 2 - 10, y: 30, size: 12, font: customFont, color: rgb(0.5, 0.5, 0.5) });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${currentBook.title}.pdf`;
      link.click();
    } catch (e) { alert('PDF作成失敗'); } finally { setIsSavingPDF(false); }
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
      u.lang = 'ja-JP'; u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };
  const stopSpeaking = () => { setIsSpeaking(false); if (audioRef.current) audioRef.current.pause(); if (typeof window !== 'undefined') window.speechSynthesis.cancel(); };
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
        {view === 'read' && <button onClick={() => setView('shelf')} className="text-sm bg-pink-600 px-3 py-1 rounded">本棚へ</button>}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          
          {view === 'shelf' && (
            <div className="space-y-8 pb-20">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 text-center">
                <h2 className="font-bold text-lg text-pink-600 mb-4">✨ どんな絵本を作る？</h2>
                <div className="flex gap-2 max-w-lg mx-auto">
                  <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：魔法の森の冒険" className="flex-1 border-2 border-pink-200 p-3 rounded-xl focus:border-pink-400 outline-none transition" />
                  <button onClick={generateBook} disabled={isGenerating} className="bg-pink-500 text-white px-6 rounded-xl font-bold shadow hover:bg-pink-600 disabled:bg-gray-300">{isGenerating ? '作成中...' : '作る！'}</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {books.map(book => (
                  <div key={book.id} className="group relative">
                    <div onClick={() => openBook(book)} className="aspect-[4/3] bg-white rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform overflow-hidden border-4 border-white">
                      {book.pages[0]?.image_prompt ? (
                        <img src={getImageUrl(book.pages[0].image_prompt, (book.id * 100))} alt="cover" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-pink-100 flex items-center justify-center text-4xl">🎨</div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-white"><h4 className="font-bold text-sm truncate">{book.title}</h4></div>
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
                <img key={pageIndex} src={getImageUrl(currentBook.pages[pageIndex].image_prompt, (currentBook.id * 100) + pageIndex)} alt="挿絵" className="w-full h-full object-contain bg-black" />
                <button onClick={() => changePage(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0} className="absolute left-0 top-0 bottom-0 w-16 hover:bg-black/20 text-white text-3xl disabled:hidden">◀</button>
                <button onClick={() => changePage(Math.min(currentBook.pages.length - 1, pageIndex + 1))} disabled={pageIndex === currentBook.pages.length - 1} className="absolute right-0 top-0 bottom-0 w-16 hover:bg-black/20 text-white text-3xl disabled:hidden">▶</button>
                
                {/* ★画像保存ボタン */}
                <button onClick={downloadCurrentImage} className="absolute top-4 right-4 bg-white/80 text-gray-700 px-3 py-1 rounded-full text-xs font-bold shadow hover:bg-white">🖼️ 画像保存</button>
              </div>
              <div className="bg-white p-4 min-h-[160px] flex flex-col justify-center items-center text-center relative border-t-2 border-pink-100">
                <p className="text-lg font-bold text-gray-800 leading-relaxed font-sans">{currentBook.pages[pageIndex].content}</p>
                
                <div className="absolute bottom-3 right-3 flex gap-2 items-center">
                  <span className="text-xs text-gray-400 mr-2">{pageIndex + 1} / {currentBook.pages.length}</span>
                  {/* ★テキスト保存ボタン */}
                  <button onClick={downloadText} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">📄 TXT</button>
                  {/* ★PDF保存ボタン */}
                  <button onClick={savePDF} disabled={isSavingPDF} className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded font-bold hover:bg-pink-200">{isSavingPDF ? '...' : '📑 PDF'}</button>
                  
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