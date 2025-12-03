// app/pdf/PDFViewer.tsx
'use client';
import { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Annotation = {
  id: number;
  type: string; // 'text' | 'check' | 'white'
  x: number;
  y: number;
  content?: string;
};

type Props = {
  file: File | null;
  zoom: number;
  tool: string | null;
  pageNumber: number;
  onLoadSuccess: (data: { numPages: number }) => void;
};

export default function PDFViewer({ file, zoom, tool, pageNumber, onLoadSuccess }: Props) {
  // ページごとの書き込みデータを管理 { 1: [...], 2: [...] }
  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // クリックしてアイテム追加
  const handlePageClick = (e: React.MouseEvent) => {
    if (!tool || !containerRef.current) return;

    // クリック位置の計算（左上からの相対座標）
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newAnnot: Annotation = {
      id: Date.now(),
      type: tool,
      x,
      y,
      content: tool === 'text' ? 'テキスト' : '' // デフォルト文字
    };

    setAnnotations(prev => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), newAnnot]
    }));
  };

  // アイテム削除（右クリック）
  const removeAnnotation = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // メニューを出さない
    if(!confirm("削除しますか？")) return;
    setAnnotations(prev => ({
      ...prev,
      [pageNumber]: prev[pageNumber].filter(a => a.id !== id)
    }));
  };

  // テキスト編集
  const updateText = (id: number, text: string) => {
    setAnnotations(prev => ({
      ...prev,
      [pageNumber]: prev[pageNumber].map(a => a.id === id ? { ...a, content: text } : a)
    }));
  };

  // 現在のページにあるアイテム
  const currentAnnotations = annotations[pageNumber] || [];

  return (
    <div className="shadow-2xl relative inline-block">
      <Document
        file={file}
        onLoadSuccess={onLoadSuccess}
        loading={<div className="text-white">PDFを読み込み中...</div>}
        error={<div className="text-red-300">PDFを開けませんでした</div>}
      >
        {/* PDFページと書き込みレイヤーをまとめる枠 */}
        <div 
          ref={containerRef} 
          onClick={handlePageClick}
          className={`relative ${tool ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={zoom / 100} 
            renderTextLayer={false} 
            renderAnnotationLayer={false} 
            className="bg-white"
          />

          {/* ★書き込みアイテムの表示レイヤー */}
          {currentAnnotations.map((annot) => (
            <div
              key={annot.id}
              style={{
                position: 'absolute',
                left: annot.x,
                top: annot.y,
                transform: 'translate(-50%, -50%)', // 中心を合わせる
              }}
              onContextMenu={(e) => removeAnnotation(e, annot.id)}
            >
              {/* 文字ツール */}
              {annot.type === 'text' && (
                <input
                  type="text"
                  value={annot.content}
                  onChange={(e) => updateText(annot.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()} // 親のクリックイベントを止める
                  className="bg-transparent border border-dashed border-gray-300 hover:border-blue-500 focus:border-blue-500 outline-none text-red-600 font-bold p-1 rounded"
                  style={{ minWidth: '100px' }}
                />
              )}

              {/* チェックマーク */}
              {annot.type === 'check' && (
                <div className="text-3xl text-red-600 font-bold pointer-events-none">✔</div>
              )}

              {/* 白塗り */}
              {annot.type === 'white' && (
                <div className="w-12 h-4 bg-white border border-gray-200"></div>
              )}
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}