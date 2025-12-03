// app/pdf/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Annotation } from './PDFViewer';

const PDFViewer = dynamic(() => import('./PDFViewer'), { 
  ssr: false,
  loading: () => <div className="text-gray-500 p-10 text-center">Loading...</div>
});

export default function PDFEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#000000'); // 初期黒
  const [currentSize, setCurrentSize] = useState(16); 
  const [useJitter, setUseJitter] = useState(false); 
  const [showGrid, setShowGrid] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPageNumber(1);
      setAnnotations([]);
      setHistory([]);
    }
  };

  const pushHistory = () => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(annotations))]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setAnnotations(previous);
    setHistory(prev => prev.slice(0, -1));
    setSelectedId(null);
  };

  const deleteSelection = () => {
    if (!selectedId) return;
    pushHistory();
    setAnnotations(annotations.filter(a => a.id !== selectedId));
    setSelectedId(null);
  };

  const updateSelection = (updates: Partial<Annotation> | ((prev: Annotation) => Partial<Annotation>)) => {
    if (!selectedId) return;
    // 連続変更を防ぐため履歴はここではなく操作完了時にとるのが理想だが、簡易実装
    setAnnotations(prev => prev.map(a => {
      if (a.id !== selectedId) return a;
      const diff = typeof updates === 'function' ? updates(a) : updates;
      return { ...a, ...diff };
    }));
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    updateSelection({ color });
  };

  const handleSizeChange = (size: number) => {
    setCurrentSize(size);
    updateSelection({ size });
  };

  // HEX(#RRGGBB) -> RGB(0-1) 変換
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  };

  const savePDF = async () => {
    if (!file) return;
    setIsSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit);
      const fontBytes = await fetch('https://fonts.gstatic.com/s/zenmarugothic/v14/0nZcGD-wO7t1lJ94d80uCk2S_dPyw4E.ttf').then(res => res.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      for (const annot of annotations) {
        const pageIndex = annot.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { height } = page.getSize();
          
          const jitterX = useJitter ? (Math.random() - 0.5) * 4 : 0;
          const jitterY = useJitter ? (Math.random() - 0.5) * 4 : 0;
          const jitterRot = (useJitter && annot.type === 'text') ? (Math.random() - 0.5) * 5 : 0;

          const w = annot.width || 60;
          const h = annot.height || 40;
          const topLeftX = annot.type === 'line' ? annot.x : annot.x - w/2;
          const topLeftY = annot.type === 'line' ? annot.y : annot.y - h/2;
          const pdfX = topLeftX + jitterX;
          const pdfY = height - topLeftY + jitterY;

          const c = hexToRgb(annot.color);
          const drawColor = rgb(c.r, c.g, c.b);

          if (annot.type === 'text' && annot.content) {
            page.drawText(annot.content, { x: pdfX, y: pdfY - annot.size, size: annot.size, font: customFont, color: drawColor, rotate: degrees(jitterRot) });
          } else if (annot.type === 'check') {
            page.drawText('✔', { x: pdfX, y: pdfY - annot.size, size: annot.size, font: customFont, color: drawColor });
          } else if (annot.type === 'rect') {
            page.drawRectangle({ x: pdfX, y: pdfY - h, width: w, height: h, borderColor: drawColor, borderWidth: Math.max(2, annot.size/3) });
          } else if (annot.type === 'circle') {
            page.drawEllipse({ x: pdfX + w/2, y: pdfY - h/2, xScale: w/2, yScale: h/2, borderColor: drawColor, borderWidth: Math.max(2, annot.size/3) });
          } else if (annot.type === 'line') {
            page.drawLine({ start: { x: pdfX, y: pdfY }, end: { x: pdfX + w, y: pdfY - h }, color: drawColor, thickness: Math.max(2, annot.size/3) });
          } else if (annot.type === 'white') {
            page.drawRectangle({ x: pdfX, y: pdfY - h, width: w, height: h, color: rgb(1, 1, 1) });
          }
        }
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `edited_${file.name}`;
      link.click();
    } catch (e) { alert('保存エラー'); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      <header className="bg-indigo-600 text-white p-3 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4"><Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 rounded text-sm transition">🔙</Link><h1 className="text-lg font-bold">📄 PDF Editor <span className="text-xs opacity-70">Lv.Max</span></h1></div>
        <div className="text-sm truncate max-w-[200px]">{file ? file.name : ''}</div>
      </header>

      <div className="bg-white border-b p-2 flex gap-2 items-center shadow-sm overflow-x-auto whitespace-nowrap h-14">
        <div className="flex gap-1 border-r pr-2 items-center">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold text-xs">📂 開く<input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" /></label>
          <button onClick={savePDF} disabled={!file || isSaving} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-2 py-1 rounded font-bold text-xs">{isSaving ? '...' : '💾 保存'}</button>
        </div>

        <div className="flex gap-1 border-r pr-2 items-center">
          <button onClick={undo} disabled={history.length===0} className="px-2 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50">↶ 元に戻す</button>
          <button onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'text' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>T 文字</button>
          <button onClick={() => setSelectedTool(selectedTool === 'check' ? null : 'check')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'check' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>✔</button>
          <select onChange={(e) => setSelectedTool(e.target.value)} value={['rect', 'circle', 'line'].includes(selectedTool || '') ? selectedTool! : 'shape'} className="bg-gray-100 border rounded px-1 text-xs h-7"><option value="shape" disabled>図形</option><option value="rect">□ 四角</option><option value="circle">〇 丸</option><option value="line">／ 線</option></select>
          <button onClick={() => setSelectedTool(selectedTool === 'white' ? null : 'white')} className={`px-2 py-1 rounded font-bold text-xs ${selectedTool === 'white' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>白塗り</button>
        </div>

        <div className="flex gap-2 items-center border-r pr-2">
          {/* ★カラーピッカー追加 */}
          <div className="flex items-center gap-1 border rounded p-1 bg-gray-50">
             <span className="text-xs font-bold text-gray-500">色:</span>
             <input 
               type="color" 
               value={currentColor} 
               onChange={(e) => handleColorChange(e.target.value)}
               className="w-6 h-6 border-none bg-transparent cursor-pointer p-0"
             />
          </div>
          <input type="number" value={currentSize} onChange={(e) => handleSizeChange(Number(e.target.value))} className="w-10 border rounded text-center text-xs p-1" title="サイズ/太さ" />
          
          {/* 微調整ボタン */}
          {selectedId && (
            <div className="flex gap-1 bg-gray-50 p-1 rounded">
              <button onClick={() => updateSelection(prev => ({ width: (prev.width||0) - 5 }))} className="px-1 text-[10px] bg-white border rounded">幅-</button>
              <button onClick={() => updateSelection(prev => ({ width: (prev.width||0) + 5 }))} className="px-1 text-[10px] bg-white border rounded">幅+</button>
              <button onClick={() => updateSelection(prev => ({ height: (prev.height||0) - 5 }))} className="px-1 text-[10px] bg-white border rounded">高-</button>
              <button onClick={() => updateSelection(prev => ({ height: (prev.height||0) + 5 }))} className="px-1 text-[10px] bg-white border rounded">高+</button>
              <button onClick={deleteSelection} className="px-1 text-[10px] bg-red-100 text-red-600 border border-red-200 rounded ml-1">削除</button>
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={() => setShowGrid(!showGrid)} className={`px-2 py-1 text-xs font-bold rounded ${showGrid ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}># グリッド</button>
          <label className="flex items-center gap-1 cursor-pointer bg-gray-50 px-2 py-1 rounded"><input type="checkbox" checked={useJitter} onChange={(e) => setUseJitter(e.target.checked)} /><span className="text-xs font-bold text-gray-600">📳 ジッター</span></label>
          <button onClick={() => setZoom(Math.max(20, zoom - 10))} className="w-6 h-6 bg-gray-200 rounded">-</button><span className="text-xs font-mono w-8 text-center">{zoom}%</span><button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-6 h-6 bg-gray-200 rounded">+</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
          {file ? (
            <PDFViewer 
              file={file} zoom={zoom} tool={selectedTool} setTool={setSelectedTool} pageNumber={pageNumber}
              currentColor={currentColor} currentSize={currentSize} showGrid={showGrid} 
              onLoadSuccess={({ numPages }) => setNumPages(numPages)} 
              annotations={annotations} setAnnotations={setAnnotations}
              selectedId={selectedId} setSelectedId={setSelectedId}
              onHistoryPush={pushHistory} 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl"><p className="text-4xl mb-4">📂</p><p className="text-lg font-bold">PDFファイルを開いてください</p></div>
          )}
        </div>
        {file && numPages > 0 && <div className="w-32 bg-white border-l p-2 hidden md:block overflow-y-auto"><div className="space-y-2">{Array.from(new Array(numPages), (el, index) => (<div key={index} onClick={() => setPageNumber(index + 1)} className={`cursor-pointer border rounded p-1 text-xs text-center transition ${pageNumber === index + 1 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'bg-gray-50 hover:bg-gray-100'}`}>{index + 1}</div>))}</div></div>}
      </div>
    </div>
  );
}