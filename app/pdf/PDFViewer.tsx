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

  // ★追加: テキスト編集モード管理
  const [isEditingText, setIsEditingText] = useState(false);

  const snap = (val: number) => {
    if (!showGrid) return val;
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  };

  const handlePageClick = (e: React.MouseEvent) => {
    if (dragState.mode) return;

    if (!tool) {
      const target = e.target as HTMLElement;
      if (target === e.currentTarget || target.className.includes('grid-layer')) {
        setSelectedId(null);
        setIsEditingText(false);
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
    if (tool === 'text') setIsEditingText(true);
    setTool(null);
  };

  // PC用マウスダウン
  const handleMouseDown = (e: React.MouseEvent, id: number, mode: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    startDrag(e.clientX, e.clientY, id, mode, handle);
  };

  // スマホ用タッチスタート
  const handleTouchStart = (e: React.TouchEvent, id: number, mode: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    // テキスト編集中以外の移動時はスクロールを防ぐ
    if (mode === 'move' && !isEditingText) {
       // e.preventDefault()はReactの合成イベントでは非推奨な場合があるため、CSSのtouch-actionで制御します
    }
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, id, mode, handle);
  };

  // 共通ドラッグ開始処理
  const startDrag = (clientX: number, clientY: number, id: number, mode: 'move' | 'resize', handle?: string) => {
    if (tool) return;
    if (isEditingText && selectedId === id && mode === 'move') return;

    onHistoryPush();
    setSelectedId(id);
    const annot = annotations.find(a => a.id === id);
    if (!annot) return;

    setDragState({
      mode,
      startX: clientX,
      startY: clientY,
      startLeft: annot.x,
      startTop: annot.y,
      startWidth: annot.width || 0,
      startHeight: annot.height || 0,
      handle
    });
  };

  // ドラッグ終了（スナップ処理）
  const handleDragEnd = () => {
    if (dragState.mode && selectedId && showGrid) {
      setAnnotations(prev => prev.map(a => {
        if (a.id !== selectedId) return a;
        return {
          ...a,
          x: snap(a.x),
          y: snap(a.y),
          width: a.width ? snap(a.width) : a.width,
          height: a.height ? snap(a.height) : a.height,
        };
      }));
    }
    setDragState({ ...dragState, mode: null });
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragState.mode || !selectedId) return;

      const scale = zoom / 100;
      const deltaX = (clientX - dragState.startX) / scale;
      const deltaY = (clientY - dragState.startY) / scale;

      setAnnotations((prev: Annotation[]) => prev.map(a => {
        if (a.id !== selectedId) return a;

        if (dragState.mode === 'move') {
          let newX = dragState.startLeft + deltaX;
          let newY = dragState.startTop + deltaY;
          return { ...a, x: newX, y: newY };
        } 
        else if (dragState.mode === 'resize') {
          let newW = dragState.startWidth;
          let newH = dragState.startHeight;

          if (dragState.handle?.includes('e')) newW = Math.max(10, dragState.startWidth + deltaX);
          if (dragState.handle?.includes('w')) newW = Math.max(10, dragState.startWidth - deltaX);
          if (dragState.handle?.includes('s')) newH = Math.max(10, dragState.startHeight + deltaY);
          if (dragState.handle?.includes('n')) newH = Math.max(10, dragState.startHeight - deltaY);

          return { ...a, width: newW, height: newH };
        }
        return a;
      }));
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      // ドラッグ中は画面スクロールを止める
      if (dragState.mode) e.preventDefault(); 
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    if (dragState.mode) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false }); // passive: false で preventDefault を有効化
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [dragState, selectedId, zoom, setAnnotations, showGrid]);

  // 削除処理（右クリックメニューなどは廃止）
  // 親画面の削除ボタンを使ってください

  const updateText = (id: number, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, content: text } : a));
  };

  const handleDoubleClick = (id: number) => {
    setSelectedId(id);
    setIsEditingText(true);
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
          <MemoizedPDFPage pageNumber={pageNumber} scale={scale} />

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

          {currentPageAnnotations.map((annot) => {
            const isSelected = selectedId === annot.id;
            const w = (annot.width || 60) * scale;
            const h = (annot.height || 40) * scale;
            
            return (
              <div
                key={annot.id}
                onMouseDown={(e) => handleMouseDown(e, annot.id, 'move')}
                onTouchStart={(e) => handleTouchStart(e, annot.id, 'move')}
                onDoubleClick={() => handleDoubleClick(annot.id)}
                style={{
                  position: 'absolute',
                  left: annot.x * scale,
                  top: annot.y * scale,
                  width: annot.type === 'text' ? 'auto' : w,
                  height: annot.type === 'text' ? 'auto' : h,
                  transform: annot.type === 'line' ? 'none' : 'translate(-50%, -50%)',
                  border: isSelected ? '1px dashed #3B82F6' : 'none',
                  cursor: tool ? 'crosshair' : 'move',
                  zIndex: isSelected ? 100 : 10,
                  whiteSpace: 'nowrap',
                  touchAction: 'none', // ★重要: これでスマホのスクロール干渉を防ぐ
                }}
              >
                <div className="w-full h-full relative flex items-center justify-center">
                  {annot.type === 'text' && (
                    isEditingText && isSelected ? (
                      <input
                        value={annot.content}
                        onChange={(e) => updateText(annot.id, e.target.value)}
                        onBlur={() => setIsEditingText(false)}
                        autoFocus
                        className="bg-white/80 border-none outline-none p-1 min-w-[50px]"
                        style={{ color: annot.color, fontSize: `${annot.size * scale}px`, fontFamily: 'sans-serif', fontWeight: 'bold' }}
                      />
                    ) : (
                      <div 
                        className="p-1 pointer-events-none"
                        style={{ color: annot.color, fontSize: `${annot.size * scale}px`, fontFamily: 'sans-serif', fontWeight: 'bold', minWidth: '50px', minHeight: '20px' }}
                      >
                        {annot.content || 'テキスト'}
                      </div>
                    )
                  )}
                  {annot.type === 'check' && <div style={{ color: annot.color, fontSize: `${Math.min(w, h)}px`, lineHeight: 1 }} className="pointer-events-none">✔</div>}
                  {annot.type === 'rect' && <div style={{ width: '100%', height: '100%', border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}`, pointerEvents: 'none' }}></div>}
                  {annot.type === 'circle' && <div style={{ width: '100%', height: '100%', border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}`, borderRadius: '50%', pointerEvents: 'none' }}></div>}
                  {annot.type === 'line' && (
                    <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke={annot.color} strokeWidth={Math.max(2, annot.size/3 * scale)} />
                    </svg>
                  )}
                  {annot.type === 'white' && <div className="w-full h-full bg-white border border-gray-100 pointer-events-none"></div>}
                </div>

                {isSelected && !tool && (
                  <div
                    onMouseDown={(e) => handleMouseDown(e, annot.id, 'resize', 'se')}
                    onTouchStart={(e) => handleTouchStart(e, annot.id, 'resize', 'se')}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500/50 border border-white cursor-se-resize pointer-events-auto rounded-full"
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