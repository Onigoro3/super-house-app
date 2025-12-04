// app/pdf/page.tsx
'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Annotation } from './PDFViewer';

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false, loading: () => <div className="text-gray-500 p-10 text-center">Loading...</div> });

const COLORS = [
  { name: '黒', value: '#000000', r:0, g:0, b:0 },
  { name: '赤', value: '#EF4444', r:0.93, g:0.26, b:0.26 },
  { name: '青', value: '#3B82F6', r:0.23, g:0.51, b:0.96 },
  { name: '緑', value: '#10B981', r:0.06, g:0.72, b:0.48 },
];

function PDFEditorContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('id'); // URLからIDを取得

  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#000000'); 
  const [currentSize, setCurrentSize] = useState(16); 
  const [currentFont, setCurrentFont] = useState('gothic.ttf');
  const [useJitter, setUseJitter] = useState(false); 
  const [showGrid, setShowGrid] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  // 保存モーダル用
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [saveFolderName, setSaveFolderName] = useState('メイン'); // ★フォルダ
  const [savePassword, setSavePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // ★起動時にクラウドから読み込み
  useEffect(() => {
    if (docId) {
      setIsLoadingCloud(true);
      const loadFromCloud = async () => {
        const { data, error } = await supabase.from('documents').select('*').eq('id', docId).single();
        if (error || !data) {
          alert('書類が見つかりませんでした');
        } else {
          // Base64 -> File変換
          try {
            const byteCharacters = atob(data.file_data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const loadedFile = new File([blob], data.title, { type: 'application/pdf' });
            
            setFile(loadedFile);
            setSaveFileName(data.title);
            setSaveFolderName(data.folder_name);
          } catch (e) { alert('ファイル読み込みエラー'); }
        }
        setIsLoadingCloud(false);
      };
      loadFromCloud();
    }
  }, [docId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSaveFileName(selectedFile.name);
      setPageNumber(1); setAnnotations([]); setHistory([]);
    }
  };

  // 履歴・編集操作（省略せず記載）
  const pushHistory = () => { setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(annotations))]); };
  const undo = () => { if (history.length === 0) return; setAnnotations(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); setSelectedId(null); };
  const deleteSelection = () => { if (!selectedId) return; pushHistory(); setAnnotations(annotations.filter(a => a.id !== selectedId)); setSelectedId(null); };
  const updateSelection = (updates: any) => { if (!selectedId) return; setAnnotations(prev => prev.map(a => a.id === selectedId ? { ...a, ...updates } : a)); };
  const handleColorChange = (color: string) => { setCurrentColor(color); updateSelection({ color }); };
  const handleSizeChange = (size: number) => { setCurrentSize(size); updateSelection({ size }); };
  const handleFontChange = (font: string) => { setCurrentFont(font); updateSelection({ font }); };

  // ★ 保存実行
  const executeSave = async (target: 'download' | 'cloud') => {
    if (!file) return;
    setIsSaving(true);

    try {
      // ライブラリの動的読み込み
      const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc: any = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit);
      
      // フォント読み込み
      const fontMap: Record<string, any> = {};
      const fontFiles = ['gothic.ttf', 'mincho.ttf', 'brush.ttf'];
      for (const f of fontFiles) {
        try {
          const fontBytes = await fetch(window.location.origin + '/fonts/' + f).then(res => res.arrayBuffer());
          fontMap[f] = await pdfDoc.embedFont(fontBytes);
        } catch (e) {}
      }
      const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // 描画処理
      const pages = pdfDoc.getPages();
      for (const annot of annotations) {
        const pageIndex = annot.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { height } = page.getSize();
          const jitterX = useJitter ? (Math.random() - 0.5) * 4 : 0;
          const jitterY = useJitter ? (Math.random() - 0.5) * 4 : 0;
          const jitterRot = (useJitter && annot.type === 'text') ? (Math.random() - 0.5) * 5 : 0;
          const w = annot.width || 60; const h = annot.height || 40;
          const topLeftX = annot.type === 'line' ? annot.x : annot.x - w/2;
          const topLeftY = annot.type === 'line' ? annot.y : annot.y - h/2;
          const pdfX = topLeftX + jitterX; const pdfY = height - topLeftY + jitterY;
          
          const r = parseInt(annot.color.slice(1, 3), 16)/255;
          const g = parseInt(annot.color.slice(3, 5), 16)/255;
          const b = parseInt(annot.color.slice(5, 7), 16)/255;
          const drawColor = rgb(r, g, b);

          if (annot.type === 'text' && annot.content) {
            const fontToUse = fontMap[annot.font || 'gothic.ttf'] || standardFont;
            page.drawText(annot.content, { x: pdfX, y: pdfY - annot.size, size: annot.size, font: fontToUse, color: drawColor, rotate: degrees(jitterRot) });
          } else if (annot.type === 'check') {
            const fontToUse = fontMap['gothic.ttf'] || standardFont;
            page.drawText('✔', { x: pdfX, y: pdfY - annot.size, size: annot.size, font: fontToUse, color: drawColor });
          } else if (['rect', 'white'].includes(annot.type)) {
             const isWhite = annot.type === 'white';
             page.drawRectangle({ x: pdfX, y: pdfY - h, width: w, height: h, borderColor: isWhite?undefined:drawColor, borderWidth: isWhite?0:Math.max(2, annot.size/3), color: isWhite?rgb(1,1,1):undefined });
          } else if (annot.type === 'circle') {
             page.drawEllipse({ x: pdfX + w/2, y: pdfY - h/2, xScale: w/2, yScale: h/2, borderColor: drawColor, borderWidth: Math.max(2, annot.size/3) });
          } else if (annot.type === 'line') {
             page.drawLine({ start: { x: pdfX, y: pdfY }, end: { x: pdfX + w, y: pdfY - h }, color: drawColor, thickness: Math.max(2, annot.size/3) });
          }
        }
      }

      if (savePassword) {
        try { pdfDoc.encrypt({ userPassword: savePassword, ownerPassword: savePassword, permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false, fillingForms: false, contentAccessibility: false, documentAssembly: false } }); } catch (e) { alert("パスワード設定失敗"); }
      }

      // 保存処理の分岐
      const pdfBytes = await pdfDoc.save();
      const base64String = Buffer.from(pdfBytes).toString('base64'); // DB用

      if (target === 'cloud') {
        // ★ Supabaseへ保存
        const { error } = await supabase.from('documents').upsert({
          id: docId ? parseInt(docId) : undefined, // IDがあれば上書き
          title: saveFileName,
          folder_name: saveFolderName,
          file_data: base64String
        });

        if (error) throw error;
        alert('クラウドに保存しました！');
      } else {
        // ★ ダウンロード
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = saveFileName;
        link.click();
      }

      setShowSaveModal(false);
    } catch (e: any) { console.error(e); alert(`保存エラー: ${e.message}`); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      <header className="bg-indigo-600 text-white p-3 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4"><Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 rounded text-sm transition">🔙</Link><h1 className="text-lg font-bold">📄 PDF Editor</h1></div>
        <div className="text-sm truncate max-w-[200px]">{file ? file.name : ''}</div>
      </header>

      <div className="bg-white border-b p-2 flex gap-2 items-center shadow-sm overflow-x-auto whitespace-nowrap h-14">
        <div className="flex gap-1 border-r pr-2 items-center">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold text-xs flex items-center gap-1">📂 開く<input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" /></label>
          <button onClick={() => executeSave('download')} disabled={!file || isSaving} className="bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded font-bold text-xs">💾 DL</button>
          <button onClick={() => setShowSaveModal(true)} disabled={!file || isSaving} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-bold text-xs">☁ 保存</button>
        </div>
        
        {/* 編集ツール類（前回と同じ） */}
        <div className="flex gap-1 border-r pr-2 items-center">
          <button onClick={undo} disabled={history.length===0} className="px-2 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50">↶</button>
          <button onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'text' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>T</button>
          <button onClick={() => setSelectedTool(selectedTool === 'check' ? null : 'check')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'check' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>✔</button>
          <select onChange={(e) => setSelectedTool(e.target.value)} value={['rect', 'circle', 'line'].includes(selectedTool || '') ? selectedTool! : 'shape'} className="bg-gray-100 border rounded px-1 text-xs h-7"><option value="shape" disabled>図形</option><option value="rect">□</option><option value="circle">〇</option><option value="line">／</option></select>
          <button onClick={() => setSelectedTool(selectedTool === 'white' ? null : 'white')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'white' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>白</button>
        </div>
        <div className="flex gap-2 items-center border-r pr-2">
          <div className="flex items-center gap-1 border rounded p-1 bg-gray-50"><input type="color" value={currentColor} onChange={(e) => handleColorChange(e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer p-0" /></div>
          <input type="number" value={currentSize} onChange={(e) => handleSizeChange(Number(e.target.value))} className="w-10 border rounded text-center text-xs p-1" />
          <select value={currentFont} onChange={(e) => handleFontChange(e.target.value)} className="bg-gray-100 border rounded px-1 text-xs h-7"><option value="gothic.ttf">ゴ</option><option value="mincho.ttf">明</option><option value="brush.ttf">筆</option></select>
          {selectedId && (<div className="flex gap-1 bg-gray-50 p-1 rounded"><button onClick={deleteSelection} className="px-1 text-[10px] bg-red-100 text-red-600 border border-red-200 rounded ml-1">削除</button></div>)}
        </div>
        <div className="flex gap-2 items-center"><button onClick={() => setShowGrid(!showGrid)} className={`px-2 py-1 text-xs font-bold rounded ${showGrid ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>#</button><label className="flex items-center gap-1 cursor-pointer bg-gray-50 px-2 py-1 rounded"><input type="checkbox" checked={useJitter} onChange={(e) => setUseJitter(e.target.checked)} /><span className="text-xs font-bold text-gray-600">📳</span></label><button onClick={() => setZoom(Math.max(20, zoom - 10))} className="w-6 h-6 bg-gray-200 rounded">-</button><span className="text-xs font-mono w-8 text-center">{zoom}%</span><button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-6 h-6 bg-gray-200 rounded">+</button></div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {isLoadingCloud ? <div className="w-full h-full flex items-center justify-center text-white bg-gray-800">クラウドから読み込み中...</div> : (
          <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
            {file ? <PDFViewer file={file} zoom={zoom} tool={selectedTool} setTool={setSelectedTool} pageNumber={pageNumber} currentColor={currentColor} currentSize={currentSize} currentFont={currentFont} showGrid={showGrid} onLoadSuccess={({ numPages }) => setNumPages(numPages)} annotations={annotations} setAnnotations={setAnnotations} selectedId={selectedId} setSelectedId={setSelectedId} onHistoryPush={pushHistory} /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl"><p className="text-4xl mb-4">📂</p><p className="text-lg font-bold">PDFファイルを開いてください</p></div>}
          </div>
        )}
        {file && numPages > 0 && <div className="w-32 bg-white border-l p-2 hidden md:block overflow-y-auto"><div className="space-y-2">{Array.from(new Array(numPages), (el, index) => (<div key={index} onClick={() => setPageNumber(index + 1)} className={`cursor-pointer border rounded p-1 text-xs text-center transition ${pageNumber === index + 1 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'bg-gray-50 hover:bg-gray-100'}`}>{index + 1}</div>))}</div></div>}
      </div>

      {/* 保存モーダル（クラウド対応） */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">クラウドに保存</h3>
            <label className="block text-sm font-bold text-gray-700 mb-1">書類名</label>
            <input type="text" value={saveFileName} onChange={e => setSaveFileName(e.target.value)} className="w-full border p-2 rounded mb-4" />
            
            <label className="block text-sm font-bold text-gray-700 mb-1">フォルダ名</label>
            <input type="text" value={saveFolderName} onChange={e => setSaveFolderName(e.target.value)} list="folders" className="w-full border p-2 rounded mb-6" />
            <datalist id="folders"><option value="メイン"/><option value="仕事"/><option value="家事"/></datalist>

            <div className="flex gap-3">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded font-bold">キャンセル</button>
              <button onClick={() => executeSave('cloud')} disabled={isSaving} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">{isSaving ? '送信中...' : '保存する'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Suspenseでラップしてexport (useSearchParamsを使うため)
export default function PDFEditorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PDFEditorContent />
    </Suspense>
  );
}