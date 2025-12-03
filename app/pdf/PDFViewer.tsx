// app/pdf/PDFViewer.tsx
'use client';
import { useRef, useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type Annotation = {
  id: number;
  type: string;
  x: number;
  y: number;
  content?: string;
  page: number;
  color: string;
  size: number;
  width?: number;
  height?: number;
};

type Props = {
  file: File | null;
  zoom: number;
  tool: string | null;
  pageNumber: number;
  currentColor: string;
  currentSize: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  annotations: Annotation[];
  setAnnotations: (annots: Annotation[]) => void;
  // 親に選択中のアイテムを伝える
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
};

export default function PDFViewer({ 
  file, zoom, tool, pageNumber, 
  currentColor, currentSize,
  onLoadSuccess, annotations, setAnnotations,
  selectedId, setSelectedId
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ドラッグ移動用の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 背景クリック（アイテム追加 or 選択解除）
  const handlePageClick = (e: React.MouseEvent) => {
    // ドラッグ終了直後のクリックイベントは無視
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    // ツールが選択されていない場合は、選択解除のみ
    if (!tool) {
      setSelectedId(null);
      return;
    }

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = zoom / 100;

    const newAnnot: Annotation = {
      id: Date.now(),
      type: tool,
      x: x / scale,
      y: y / scale,
      page: pageNumber,
      color: currentColor, // 現在の色
      size: currentSize,   // 現在のサイズ
      content: tool === 'text' ? 'テキスト' : '',
      width: tool === 'line' ? 100 : 60,
      height: tool === 'line' ? 0 : 40,
    };

    setAnnotations([...annotations, newAnnot]);
    setSelectedId(newAnnot.id); // 追加したものを即選択
  };

  // アイテム削除
  const removeAnnotation = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if(!confirm("削除しますか？")) return;
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // テキスト編集
  const updateText = (id: number, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, content: text } : a));
  };

  // --- ドラッグ処理 ---
  const handleMouseDown = (e: React.MouseEvent, id: number) => {
    if (tool) return; // ツール使用中は移動しない
    e.stopPropagation(); // 親のクリックイベントを止める
    setSelectedId(id);
    setIsDragging(true);

    // クリック位置とアイテム位置のズレを記録
    const annot = annotations.find(a => a.id === id);
    if (annot && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = zoom / 100;
      setDragOffset({
        x: mouseX - annot.x * scale,
        y: mouseY - annot.y * scale
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scale = zoom / 100;

    // 新しい座標を計算
    const newX = (mouseX - dragOffset.x) / scale;
    const newY = (mouseY - dragOffset.y) / scale;

    setAnnotations(annotations.map(a => 
      a.id === selectedId ? { ...a, x: newX, y: newY } : a
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative ${tool ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={zoom / 100} 
            renderTextLayer={false} 
            renderAnnotationLayer={false} 
            className="bg-white"
          />

          {currentPageAnnotations.map((annot) => {
            const scale = zoom / 100;
            const isSelected = selectedId === annot.id;
            
            return (
              <div
                key={annot.id}
                onMouseDown={(e) => handleMouseDown(e, annot.id)}
                onContextMenu={(e) => removeAnnotation(e, annot.id)}
                style={{
                  position: 'absolute',
                  left: annot.x * scale,
                  top: annot.y * scale,
                  transform: annot.type === 'line' ? 'none' : 'translate(-50%, -50%)',
                  cursor: tool ? 'crosshair' : 'move',
                  // 選択中は青い枠を表示
                  outline: isSelected ? '2px dashed #3B82F6' : 'none',
                  outlineOffset: '4px',
                  zIndex: isSelected ? 10 : 1
                }}
              >
                {/* --- テキスト --- */}
                {annot.type === 'text' && (
                  <input
                    type="text"
                    value={annot.content}
                    onChange={(e) => updateText(annot.id, e.target.value)}
                    className="bg-transparent border-none outline-none font-bold p-1"
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

                {/* --- 図形 --- */}
                {annot.type === 'rect' && (
                  <div style={{
                    width: `${(annot.width || 60) * scale}px`,
                    height: `${(annot.height || 40) * scale}px`,
                    border: `${Math.max(1, annot.size/5 * scale)}px solid ${annot.color}`,
                  }}></div>
                )}
                
                {annot.type === 'circle' && (
                  <div style={{
                    width: `${(annot.width || 50) * scale}px`,
                    height: `${(annot.width || 50) * scale}px`,
                    border: `${Math.max(1, annot.size/5 * scale)}px solid ${annot.color}`,
                    borderRadius: '50%'
                  }}></div>
                )}

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