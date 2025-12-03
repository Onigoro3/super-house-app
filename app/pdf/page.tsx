// app/pdf/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function PDFEditor() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // ファイル選択時の処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // ここに本来はPDF読み込み処理が入ります（pdf.jsなどを使用）
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      
      {/* 1. ヘッダー (ナビゲーション) */}
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">📄 PDF Editor <span className="text-xs font-normal opacity-80">(Web版)</span></h1>
        </div>
        <div className="text-sm">
          {fileName ? `開いているファイル: ${fileName}` : 'ファイル未選択'}
        </div>
      </header>

      {/* 2. ツールバー (Pythonアプリの機能を再現) */}
      <div className="bg-white border-b p-2 flex gap-4 items-center shadow-sm overflow-x-auto">
        {/* ファイル操作 */}
        <div className="flex gap-1 border-r pr-4">
          <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded font-bold text-sm flex items-center gap-1">
            📂 開く
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          </label>
          <button className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-2 rounded font-bold text-sm">💾 保存</button>
        </div>

        {/* 編集ツール */}
        <div className="flex gap-1 border-r pr-4">
          <button onClick={() => setSelectedTool('text')} className={`px-3 py-2 rounded font-bold text-sm ${selectedTool === 'text' ? 'bg-gray-800 text-white' : 'bg-gray-50 hover:bg-gray-200'}`}>T 文字</button>
          <button onClick={() => setSelectedTool('check')} className={`px-3 py-2 rounded font-bold text-sm ${selectedTool === 'check' ? 'bg-gray-800 text-white' : 'bg-gray-50 hover:bg-gray-200'}`}>✔ チェック</button>
          <button onClick={() => setSelectedTool('white')} className={`px-3 py-2 rounded font-bold text-sm ${selectedTool === 'white' ? 'bg-gray-800 text-white' : 'bg-gray-50 hover:bg-gray-200'}`}>⬜ 白塗り</button>
          <select className="bg-gray-50 border rounded px-2 py-1 text-sm">
            <option>図形...</option>
            <option>〇 丸</option>
            <option>□ 四角</option>
            <option>△ 三角</option>
            <option>→ 矢印</option>
          </select>
        </div>

        {/* 表示操作 */}
        <div className="flex gap-2 items-center">
          <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">-</button>
          <span className="text-sm font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(zoom + 10)} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">+</button>
        </div>
      </div>

      {/* 3. メインエリア (キャンバスとサイドバー) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* キャンバスエリア (PDF表示場所) */}
        <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative">
          <div 
            className="bg-white shadow-2xl transition-transform origin-top"
            style={{ 
              width: `${595 * (zoom / 100)}px`,  // A4サイズ比率
              height: `${842 * (zoom / 100)}px`, 
              minHeight: '842px',
              minWidth: '595px'
            }}
          >
            {fileName ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                {/* ここにPDF描画ライブラリが入ります */}
                <p>PDFプレビューエリア</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 m-4 rounded-xl">
                <p className="text-2xl mb-2">📂</p>
                <p>PDFファイルをドロップ<br/>または「開く」から選択</p>
              </div>
            )}
          </div>
        </div>

        {/* 右サイドバー (ページ一覧など) */}
        <div className="w-64 bg-white border-l p-4 hidden md:block">
          <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">ページ一覧</h3>
          <div className="space-y-4 overflow-y-auto h-full pb-20">
            {/* ダミーのページサムネイル */}
            {[1, 2, 3].map(page => (
              <div key={page} className="cursor-pointer group">
                <div className="aspect-[210/297] bg-gray-100 border-2 border-transparent group-hover:border-indigo-500 rounded shadow-sm flex items-center justify-center text-xs text-gray-400 mb-1">
                  Page {page}
                </div>
                <p className="text-center text-xs text-gray-600">{page}ページ</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="bg-white border-t p-2 text-center text-xs text-gray-500">
        Web PDF Editor v1.0
      </div>
    </div>
  );
}