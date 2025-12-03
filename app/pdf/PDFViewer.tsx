// app/pdf/PDFViewer.tsx
'use client';
import React, { useRef, useState, useEffect, Dispatch, SetStateAction } from 'react';
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
  setTool: (tool: string | null) => void;
  pageNumber: number;
  currentColor: string;
  currentSize: number;
  showGrid: boolean;
  onLoadSuccess: (data: { numPages: number }) => void;
  annotations: Annotation[];
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  onHistoryPush: () => void;
};

// ★高速化の鍵：PDFページ描画部分だけを切り出して「メモ化（再描画防止）」する
const MemoizedPDFPage = React.memo(({ pageNumber, scale }: { pageNumber: number, scale: number }) => {
  return (
    <Page 
      pageNumber={pageNumber} 
      scale={scale} 
      renderTextLayer={false} 
      renderAnnotationLayer={false} 
      className="bg-white shadow-md"
    />
  );
});
MemoizedPDFPage.displayName = 'MemoizedPDFPage';

export default function PDFViewer({ 
  file, zoom, tool, setTool, pageNumber, 
  currentColor, currentSize, showGrid,
  onLoadSuccess, annotations, setAnnotations,
  selectedId, setSelectedId, onHistoryPush
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const GRID_SIZE = 20;

  const [dragState, setDragState] = useState<{
    mode: 'move' | 'resize' | null;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    handle?: string;
  }>({ mode: null, startX:0, startY:0, startLeft:0, startTop:0, startWidth:0, startHeight:0 });

  const snap = (val: number) => {
    if (!showGrid) return val;
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  };

  const handlePageClick = (e: React.MouseEvent) => {
    if (dragState.mode) return;

    if (!tool) {
      // ツールがない時は選択解除
      if (e.target === e.currentTarget || (e.target as HTMLElement).className.includes('grid-layer')) {
        setSelectedId(null);
      }
      return;
    }

    if (!containerRef.current) return;
    onHistoryPush();

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = zoom / 100;

    const finalX = showGrid ? snap(x / scale) : x / scale;
    const finalY = showGrid ? snap(y / scale) : y / scale;

    const newAnnot: Annotation = {
      id: Date.now(),
      type: tool,
      x: finalX,
      y: finalY,
      page: pageNumber,
      color: currentColor,
      size: currentSize,
      content: tool === 'text' ? 'テキスト' : '',
      width: tool === 'text' ? 100 : (tool === 'line' ? 100 : 60),
      height: tool === 'text' ? 30 : (tool === 'line' ? 0 : 40),
    };

    setAnnotations([...annotations, newAnnot]);
    setSelectedId(newAnnot.id);
    setTool(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: number, mode: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    if (tool) return;

    onHistoryPush();
    setSelectedId(id);
    const annot = annotations.find(a => a.id === id);
    if (!annot) return;

    setDragState({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: annot.x,
      startTop: annot.y,
      startWidth: annot.width || 0,
      startHeight: annot.height || 0,
      handle
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.mode || !selectedId) return;

      const scale = zoom / 100;
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      setAnnotations(prev => prev.map(a => {
        if (a.id !== selectedId) return a;

        if (dragState.mode === 'move') {
          let newX = dragState.startLeft + deltaX;
          let newY = dragState.startTop + deltaY;
          if (showGrid) { newX = snap(newX); newY = snap(newY); }
          return { ...a, x: newX, y: newY };
        } 
        else if (dragState.mode === 'resize') {
          let newW = dragState.startWidth;
          let newH = dragState.startHeight;

          // ハンドル操作
          if (dragState.handle?.includes('e')) newW = Math.max(10, dragState.startWidth + deltaX);
          if (dragState.handle?.includes('w')) newW = Math.max(10, dragState.startWidth - deltaX); // 左方向リサイズ用（簡易）
          if (dragState.handle?.includes('s')) newH = Math.max(10, dragState.startHeight + deltaY);
          if (dragState.handle?.includes('n')) newH = Math.max(10, dragState.startHeight - deltaY); // 上方向リサイズ用（簡易）

          if (showGrid) { newW = snap(newW); newH = snap(newH); }
          return { ...a, width: newW, height: newH };
        }
        return a;
      }));
    };

    const handleMouseUp = () => {
      setDragState({ ...dragState, mode: null });
    };

    if (dragState.mode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, selectedId, zoom, setAnnotations, showGrid]);

  const removeAnnotation = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if(!confirm("削除しますか？")) return;
    onHistoryPush();
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateText = (id: number, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, content: text } : a));
  };

  const currentPageAnnotations = annotations.filter(a => a.page === pageNumber);
  const scale = zoom / 100;

  return (
    <div className="shadow-2xl relative inline-block select-none bg-gray-200">
      <Document
        file={file}
        onLoadSuccess={onLoadSuccess}
        loading={<div className="text-white p-4">PDFを読み込み中...</div>}
        error={<div className="text-red-500 p-4">PDFを開けませんでした</div>}
      >
        <div 
          ref={containerRef} 
          onClick={handlePageClick}
          className={`relative ${tool ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          {/* ★高速化: メモ化したPDFページを表示 */}
          <MemoizedPDFPage pageNumber={pageNumber} scale={scale} />

          {/* ★グリッドレイヤー (PDFの上に表示するため zIndex: 1, pointerEvents: none) */}
          {showGrid && (
            <div 
              className="grid-layer"
              style={{
                position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                backgroundImage: `linear-gradient(rgba(0,0,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,255,0.2) 1px, transparent 1px)`,
                backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`
              }} 
            />
          )}

          {/* アノテーションレイヤー (zIndex: 10〜) */}
          {currentPageAnnotations.map((annot) => {
            const isSelected = selectedId === annot.id;
            const w = (annot.width || 60) * scale;
            const h = (annot.height || 40) * scale;
            
            return (
              <div
                key={annot.id}
                onMouseDown={(e) => handleMouseDown(e, annot.id, 'move')}
                onContextMenu={(e) => removeAnnotation(e, annot.id)}
                style={{
                  position: 'absolute',
                  left: annot.x * scale,
                  top: annot.y * scale,
                  width: w,
                  height: h,
                  transform: annot.type === 'line' ? 'none' : 'translate(-50%, -50%)',
                  border: isSelected ? '1px dashed #3B82F6' : 'none',
                  cursor: tool ? 'crosshair' : 'move',
                  zIndex: isSelected ? 100 : 10 // 選択中は最前面
                }}
              >
                <div className="w-full h-full relative flex items-center justify-center pointer-events-none"> {/* 中身はクリック透過 */}
                  
                  {annot.type === 'text' && (
                    <textarea
                      value={annot.content}
                      onChange={(e) => updateText(annot.id, e.target.value)}
                      className="w-full h-full bg-transparent border-none outline-none resize-none overflow-hidden pointer-events-auto" // テキスト入力は有効化
                      style={{ 
                        color: annot.color,
                        fontSize: `${annot.size * scale}px`,
                        lineHeight: 1.2,
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold'
                      }}
                    />
                  )}

                  {annot.type === 'check' && (
                    <div style={{ color: annot.color, fontSize: `${Math.min(w, h)}px`, lineHeight: 1 }}>✔</div>
                  )}

                  {annot.type === 'rect' && (
                    <div style={{ width: '100%', height: '100%', border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}` }}></div>
                  )}

                  {annot.type === 'circle' && (
                    <div style={{ width: '100%', height: '100%', border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}`, borderRadius: '50%' }}></div>
                  )}

                  {annot.type === 'line' && (
                    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke={annot.color} strokeWidth={Math.max(2, annot.size/3 * scale)} />
                    </svg>
                  )}

                  {annot.type === 'white' && (
                    <div className="w-full h-full bg-white border border-gray-100"></div>
                  )}
                </div>

                {/* リサイズハンドル */}
                {isSelected && !tool && (
                  <div
                    onMouseDown={(e) => handleMouseDown(e, annot.id, 'resize', 'se')}
                    className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border border-white cursor-se-resize pointer-events-auto"
                    style={{ transform: 'translate(50%, 50%)' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Document>
    </div>
  );
}