// app/pdf/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// 型定義のインポート（PDFViewerと合わせる）
import type { Annotation } from './PDFViewer';

const PDFViewer = dynamic(() => import('./PDFViewer'), { 
  ssr: false,
  loading: () => <div className="text-gray-500 p-10 text-center">Loading PDF Engine...</div>
});

export default function PDFEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // ★書き込みデータをここで管理
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPageNumber(1);
      setAnnotations([]); // ファイルが変わったらリセット
    }
  };

  // ★ PDF保存処理（日本語対応）
  const savePDF = async () => {
    if (!file) return;
    setIsSaving(true);

    try {
      // 1. 元のPDFを読み込む
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // 2. 日本語フォントを読み込む (Zen Maru Gothicを使用)
      pdfDoc.registerFontkit(fontkit);
      const fontBytes = await fetch('https://fonts.gstatic.com/s/zenmarugothic/v14/0nZcGD-wO7t1lJ94d80uCk2S_dPyw4E.ttf').then(res => res.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);

      // 3. 全ページを取得
      const pages = pdfDoc.getPages();

      // 4. 書き込みデータをPDFに描画
      for (const annot of annotations) {
        // ページ番号は1始まりなので -1 する
        const pageIndex = annot.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { height } = page.getSize();
          
          // PDF座標系への変換 (PDFは左下が原点、Webは左上が原点)
          const pdfX = annot.x;
          const pdfY = height - annot.y; // Y座標を反転

          if (annot.type === 'text' && annot.content) {
            page.drawText(annot.content, {
              x: pdfX - 20, // 位置微調整
              y: pdfY - 5,
              size: 16,
              font: customFont,
              color: rgb(0.8, 0, 0), // 赤色
            });
          } else if (annot.type === 'check') {
            page.drawText('✔', {
              x: pdfX - 10,
              y: pdfY - 10,
              size: 24,
              font: customFont,
              color: rgb(0.8, 0, 0),
            });
          } else if (annot.type === 'white') {
            page.drawRectangle({
              x: pdfX - 30,
              y: pdfY - 10,
              width: 60,
              height: 20,
              color: rgb(1, 1, 1), // 白
            });
          }
        }
      }

      // 5. 保存してダウンロード
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
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
      
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">📄 PDF Editor <span className="text-xs font-normal opacity-80">(Web版)</span></h1>
        </div>
        <div className="text-sm">{file ? `📄 ${file.name}` : 'ファイル未選択'}</div>
      </header>

      <div className="bg-white border-b p-2 flex gap-4 items-center shadow-sm overflow-x-auto">
        <div className="flex gap-1 border-r pr-4">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded font-bold text-sm flex items-center gap-1">
            📂 開く
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
          {/* ★保存ボタン実装 */}
          <button 
            onClick={savePDF} 
            disabled={!file || isSaving}
            className={`px-3 py-2 rounded font-bold text-sm flex items-center gap-1 ${!file ? 'bg-gray-100 text-gray-400' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
          >
            {isSaving ? '保存中...' : '💾 保存'}
          </button>
        </div>

        <div className="flex gap-1 border-r pr-4">
          <button onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'text' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>T 文字</button>
          <button onClick={() => setSelectedTool(selectedTool === 'check' ? null : 'check')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'check' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>✔ チェック</button>
          <button onClick={() => setSelectedTool(selectedTool === 'white' ? null : 'white')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'white' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>⬜ 白塗り</button>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={() => setZoom(Math.max(20, zoom - 10))} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">-</button>
          <span className="text-sm font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">+</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
          {file ? (
            <PDFViewer 
              file={file} 
              zoom={zoom}
              tool={selectedTool}
              pageNumber={pageNumber}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              annotations={annotations}       // ★追加
              setAnnotations={setAnnotations} // ★追加
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl">
              <p className="text-4xl mb-4">📂</p>
              <p className="text-lg font-bold">PDFファイルを開いてください</p>
            </div>
          )}
        </div>

        {file && numPages > 0 && (
          <div className="w-48 bg-white border-l p-4 hidden md:block overflow-y-auto">
            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 text-sm">ページ ({numPages})</h3>
            <div className="space-y-2">
              {Array.from(new Array(numPages), (el, index) => (
                <div 
                  key={index} 
                  onClick={() => setPageNumber(index + 1)}
                  className={`cursor-pointer group border-2 rounded p-2 transition ${pageNumber === index + 1 ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:bg-gray-100'}`}
                >
                  <div className="aspect-[210/297] bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-1 shadow-sm">
                    Page {index + 1}
                  </div>
                  <p className={`text-center text-xs ${pageNumber === index + 1 ? 'text-indigo-600 font-bold' : 'text-gray-600'}`}>
                    {index + 1}ページ
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}