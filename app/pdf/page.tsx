// app/pdf/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// 型定義
import type { Annotation } from './PDFViewer';

const PDFViewer = dynamic(() => import('./PDFViewer'), { 
  ssr: false,
  loading: () => <div className="text-gray-500 p-10 text-center">Loading...</div>
});

// カラーパレット定義
const COLORS = [
  { name: '黒', value: '#000000', r:0, g:0, b:0 },
  { name: '赤', value: '#EF4444', r:0.93, g:0.26, b:0.26 },
  { name: '青', value: '#3B82F6', r:0.23, g:0.51, b:0.96 },
  { name: '緑', value: '#10B981', r:0.06, g:0.72, b:0.48 },
];

export default function PDFEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  
  // ツール状態
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState(COLORS[1]); // デフォルト赤
  const [currentSize, setCurrentSize] = useState(16); // デフォルトサイズ
  const [useJitter, setUseJitter] = useState(false); // ★ジッター機能

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPageNumber(1);
      setAnnotations([]); 
    }
  };

  // ★ PDF保存処理 (ジッター実装)
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
          
          // ★ジッター計算 (ONの場合、-2px〜+2px の乱数を加える)
          const jitterX = useJitter ? (Math.random() - 0.5) * 4 : 0;
          const jitterY = useJitter ? (Math.random() - 0.5) * 4 : 0;
          // 角度ジッター (文字の場合のみ少し傾ける)
          const jitterRot = (useJitter && annot.type === 'text') ? (Math.random() - 0.5) * 5 : 0;

          const pdfX = annot.x + jitterX;
          const pdfY = height - annot.y + jitterY; // Y座標反転 + ジッター

          // 色の検索 (保存用にRGB値を取得)
          const colorObj = COLORS.find(c => c.value === annot.color) || COLORS[0];
          const drawColor = rgb(colorObj.r, colorObj.g, colorObj.b);

          // 描画処理
          if (annot.type === 'text' && annot.content) {
            page.drawText(annot.content, {
              x: pdfX,
              y: pdfY - annot.size + 5, // ベースライン調整
              size: annot.size,
              font: customFont,
              color: drawColor,
              rotate: { type: 'degrees', angle: jitterRot } // 手書き風の傾き
            });
          } else if (annot.type === 'check') {
            page.drawText('✔', {
              x: pdfX,
              y: pdfY - annot.size + 5,
              size: annot.size,
              font: customFont,
              color: drawColor,
            });
          } else if (annot.type === 'rect') {
            page.drawRectangle({
              x: pdfX - (annot.width || 60)/2, // 中心基準
              y: pdfY - (annot.height || 40)/2,
              width: annot.width || 60,
              height: annot.height || 40,
              borderColor: drawColor,
              borderWidth: annot.size / 5, // サイズを太さに変換
            });
          } else if (annot.type === 'circle') {
            page.drawEllipse({
              x: pdfX,
              y: pdfY,
              xScale: (annot.width || 50)/2,
              yScale: (annot.width || 50)/2,
              borderColor: drawColor,
              borderWidth: annot.size / 5,
            });
          } else if (annot.type === 'line') {
            // 直線 (始点から終点へ)
            page.drawLine({
              start: { x: pdfX, y: pdfY },
              end: { x: pdfX + (annot.width || 100), y: pdfY - (annot.height || 0) }, // PDF座標系ではYが逆
              color: drawColor,
              thickness: annot.size / 5,
            });
          } else if (annot.type === 'white') {
            page.drawRectangle({
              x: pdfX - (annot.width || 60)/2,
              y: pdfY - (annot.height || 20)/2,
              width: annot.width || 60,
              height: annot.height || 20,
              color: rgb(1, 1, 1),
            });
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `edited_${file.name}`;
      link.click();

    } catch (e) {
      console.error(e);
      alert('保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      
      <header className="bg-indigo-600 text-white p-3 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 rounded text-sm transition">🔙</Link>
          <h1 className="text-lg font-bold">📄 PDF Editor <span className="text-xs opacity-70">Lv.15</span></h1>
        </div>
        <div className="text-sm truncate max-w-[200px]">{file ? file.name : ''}</div>
      </header>

      {/* 高機能ツールバー */}
      <div className="bg-white border-b p-2 flex gap-2 items-center shadow-sm overflow-x-auto whitespace-nowrap">
        
        {/* ファイル操作 */}
        <div className="flex gap-1 border-r pr-2">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded font-bold text-xs flex items-center gap-1">
            📂 開く
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
          <button onClick={savePDF} disabled={!file || isSaving} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-1 rounded font-bold text-xs">
            {isSaving ? '...' : '💾 保存'}
          </button>
        </div>

        {/* ツール選択 */}
        <div className="flex gap-1 border-r pr-2">
          <button onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')} className={`p-2 rounded font-bold text-xs ${selectedTool === 'text' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>T 文字</button>
          <button onClick={() => setSelectedTool(selectedTool === 'check' ? null : 'check')} className={`p-2 rounded font-bold text-xs ${selectedTool === 'check' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>✔</button>
          <select 
            onChange={(e) => setSelectedTool(e.target.value)} 
            value={['rect', 'circle', 'line'].includes(selectedTool || '') ? selectedTool! : 'shape'}
            className="bg-gray-100 border rounded px-1 text-xs"
          >
            <option value="shape" disabled>図形</option>
            <option value="rect">□ 四角</option>
            <option value="circle">〇 丸</option>
            <option value="line">／ 線</option>
          </select>
          <button onClick={() => setSelectedTool(selectedTool === 'white' ? null : 'white')} className={`p-2 rounded font-bold text-xs ${selectedTool === 'white' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>⬜</button>
        </div>

        {/* スタイル設定 */}
        <div className="flex gap-2 items-center border-r pr-2">
          {/* 色選択 */}
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button 
                key={c.value}
                onClick={() => setCurrentColor(c)}
                className={`w-5 h-5 rounded-full border ${currentColor.value === c.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          {/* サイズ選択 */}
          <input 
            type="number" 
            value={currentSize} 
            onChange={(e) => setCurrentSize(Number(e.target.value))}
            className="w-12 border rounded text-center text-xs p-1"
            title="サイズ/太さ"
          />
        </div>

        {/* 表示・ジッター */}
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1 cursor-pointer bg-gray-50 px-2 py-1 rounded">
            <input type="checkbox" checked={useJitter} onChange={(e) => setUseJitter(e.target.checked)} />
            <span className="text-xs font-bold text-gray-600">📳 ジッター(保存時)</span>
          </label>
          <button onClick={() => setZoom(Math.max(20, zoom - 10))} className="w-6 h-6 bg-gray-200 rounded">-</button>
          <span className="text-xs font-mono w-8 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-6 h-6 bg-gray-200 rounded">+</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
          {file ? (
            <PDFViewer 
              file={file} zoom={zoom} tool={selectedTool} pageNumber={pageNumber}
              currentColor={currentColor.value} currentSize={currentSize}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)} 
              annotations={annotations} setAnnotations={setAnnotations}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl">
              <p className="text-4xl mb-4">📂</p>
              <p className="text-lg font-bold">PDFファイルを開いてください</p>
            </div>
          )}
        </div>

        {file && numPages > 0 && (
          <div className="w-32 bg-white border-l p-2 hidden md:block overflow-y-auto">
            <h3 className="font-bold text-gray-700 mb-2 border-b pb-1 text-xs">P. {numPages}</h3>
            <div className="space-y-2">
              {Array.from(new Array(numPages), (el, index) => (
                <div key={index} onClick={() => setPageNumber(index + 1)} className={`cursor-pointer border rounded p-1 text-xs text-center transition ${pageNumber === index + 1 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}