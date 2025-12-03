// app/pdf/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('./PDFViewer'), { 
  ssr: false,
  loading: () => <div className="text-gray-500 p-10 text-center">Loading PDF Engine...</div>
});

export default function PDFEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState(100);
  // 選択中のツール ('text', 'check', 'white', null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPageNumber(1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      
      {/* ヘッダー */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">📄 PDF Editor <span className="text-xs font-normal opacity-80">(Web版)</span></h1>
        </div>
        <div className="text-sm">{file ? `📄 ${file.name}` : 'ファイル未選択'}</div>
      </header>

      {/* ツールバー */}
      <div className="bg-white border-b p-2 flex gap-4 items-center shadow-sm overflow-x-auto">
        <div className="flex gap-1 border-r pr-4">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded font-bold text-sm flex items-center gap-1">
            📂 開く
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
          {/* 保存機能は次回実装 */}
          <button className="bg-gray-100 text-gray-400 px-3 py-2 rounded font-bold text-sm cursor-not-allowed">💾 保存(未実装)</button>
        </div>

        <div className="flex gap-1 border-r pr-4">
          <button onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'text' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>T 文字</button>
          <button onClick={() => setSelectedTool(selectedTool === 'check' ? null : 'check')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'check' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>✔ チェック</button>
          <button onClick={() => setSelectedTool(selectedTool === 'white' ? null : 'white')} className={`px-3 py-2 rounded font-bold text-sm transition ${selectedTool === 'white' ? 'bg-gray-800 text-white shadow-inner' : 'bg-gray-50 hover:bg-gray-200'}`}>⬜ 白塗り</button>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">-</button>
          <span className="text-sm font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">+</button>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* PDF表示コンポーネント (toolを渡す) */}
        <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
          {file ? (
            <PDFViewer 
              file={file} 
              zoom={zoom}
              tool={selectedTool} // ★ここが重要
              pageNumber={pageNumber} // ★ページ番号を渡す
              onLoadSuccess={({ numPages }) => setNumPages(numPages)} 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl">
              <p className="text-4xl mb-4">📂</p>
              <p className="text-lg font-bold">PDFファイルを開いてください</p>
            </div>
          )}
        </div>

        {/* 右サイドバー */}
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