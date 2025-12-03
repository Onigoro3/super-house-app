// app/pdf/PDFViewer.tsx
'use client';
import { useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ★ 注釈データの型定義を強化
export type Annotation = {
  id: number;
  type: string; // 'text' | 'check' | 'rect' | 'circle' | 'line' | 'white'
  x: number;
  y: number;
  content?: string;
  page: number;
  // スタイル情報
  color: string;    // HEX (#FF0000)
  size: number;     // フォントサイズ or 線の太さ
  width?: number;   // 図形の幅 (lineの場合は終点Xの差分)
  height?: number;  // 図形の高さ (lineの場合は終点Yの差分)
};

type Props = {
  file: File | null;
  zoom: number;
  tool: string | null;
  pageNumber: number;
  // 現在の設定値を受け取る
  currentColor: string;
  currentSize: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  annotations: Annotation[];
  setAnnotations: (annots: Annotation[]) => void;
};

export default function PDFViewer({ 
  file, zoom, tool, pageNumber, 
  currentColor, currentSize,
  onLoadSuccess, annotations, setAnnotations 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // クリックしてアイテム追加
  const handlePageClick = (e: React.MouseEvent) => {
    if (!tool || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ズーム倍率を考慮して、元のサイズ(100%)の座標に変換
    const scale = zoom / 100;
    const originalX = x / scale;
    const originalY = y / scale;

    const newAnnot: Annotation = {
      id: Date.now(),
      type: tool,
      x: originalX,
      y: originalY,
      page: pageNumber,
      color: currentColor,
      size: currentSize,
      content: tool === 'text' ? 'テキスト' : '',
      // 図形のデフォルトサイズ
      width: tool === 'line' ? 100 : 60,
      height: tool === 'line' ? 0 : 40,
    };

    setAnnotations([...annotations, newAnnot]);
  };

  // 削除
  const removeAnnotation = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if(!confirm("削除しますか？")) return;
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  // テキスト編集
  const updateText = (id: number, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, content: text } : a));
  };

  const currentPageAnnotations = annotations.filter(a => a.page === pageNumber);

  return (
    <div className="shadow-2xl relative inline-block">
      <Document
        file={file}
        onLoadSuccess={onLoadSuccess}
        loading={<div className="text-white">PDFを読み込み中...</div>}
        error={<div className="text-red-300">PDFを開けませんでした</div>}
      >
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

          {/* アイテム描画レイヤー */}
          {currentPageAnnotations.map((annot) => {
            const displayX = annot.x * (zoom / 100);
            const displayY = annot.y * (zoom / 100);
            const scale = zoom / 100;

            return (
              <div
                key={annot.id}
                style={{
                  position: 'absolute',
                  left: displayX,
                  top: displayY,
                  transform: annot.type === 'line' ? 'none' : 'translate(-50%, -50%)', // 線以外は中心基準
                }}
                onContextMenu={(e) => removeAnnotation(e, annot.id)}
              >
                {/* --- 文字 --- */}
                {annot.type === 'text' && (
                  <input
                    type="text"
                    value={annot.content}
                    onChange={(e) => updateText(annot.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border border-dashed border-transparent hover:border-gray-300 focus:border-blue-500 outline-none font-bold p-1"
                    style={{ 
                      color: annot.color,
                      fontSize: `${annot.size * scale}px`,
                      minWidth: '50px'
                    }}
                  />
                )}

                {/* --- チェック --- */}
                {annot.type === 'check' && (
                  <div 
                    className="font-bold pointer-events-none" 
                    style={{ color: annot.color, fontSize: `${annot.size * scale}px` }}
                  >✔</div>
                )}

                {/* --- 四角 --- */}
                {annot.type === 'rect' && (
                  <div style={{
                    width: `${(annot.width || 60) * scale}px`,
                    height: `${(annot.height || 40) * scale}px`,
                    border: `${Math.max(1, annot.size/5 * scale)}px solid ${annot.color}`,
                  }}></div>
                )}

                {/* --- 丸 --- */}
                {annot.type === 'circle' && (
                  <div style={{
                    width: `${(annot.width || 50) * scale}px`,
                    height: `${(annot.width || 50) * scale}px`, // 正円
                    border: `${Math.max(1, annot.size/5 * scale)}px solid ${annot.color}`,
                    borderRadius: '50%'
                  }}></div>
                )}

                {/* --- 直線 (SVGで描画) --- */}
                {annot.type === 'line' && (
                  <svg width="200" height="200" style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <line 
                      x1="0" y1="0" 
                      x2={(annot.width || 100) * scale} 
                      y2={(annot.height || 0) * scale} 
                      stroke={annot.color} 
                      strokeWidth={Math.max(1, annot.size/5 * scale)} 
                    />
                  </svg>
                )}

                {/* --- 白塗り --- */}
                {annot.type === 'white' && (
                  <div className="bg-white" style={{ width: `${(annot.width || 60) * scale}px`, height: `${(annot.height || 20) * scale}px` }}></div>
                )}
              </div>
            );
          })}
        </div>
      </Document>
    </div>
  );
}