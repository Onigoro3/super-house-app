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
  setTool: (tool: string | null) => void; // ツール解除用
  pageNumber: number;
  currentColor: string;
  currentSize: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  annotations: Annotation[];
  setAnnotations: (annots: Annotation[]) => void;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
};

export default function PDFViewer({ 
  file, zoom, tool, setTool, pageNumber, 
  currentColor, currentSize,
  onLoadSuccess, annotations, setAnnotations,
  selectedId, setSelectedId
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ドラッグ・リサイズ状態管理
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'resize' | null;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    handle?: string; // 'se', 'sw' etc.
  }>({ mode: null, startX:0, startY:0, startLeft:0, startTop:0, startWidth:0, startHeight:0 });

  // 背景クリック（アイテム追加）
  const handlePageClick = (e: React.MouseEvent) => {
    // ドラッグ中やリサイズ中は無視
    if (dragState.mode) return;

    // ツール未選択なら選択解除して終了
    if (!tool) {
      // アイテム上でのクリックでなければ選択解除
      if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('react-pdf__Page')) {
        setSelectedId(null);
      }
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
      color: currentColor,
      size: currentSize,
      content: tool === 'text' ? 'テキスト' : '',
      width: tool === 'text' ? 100 : (tool === 'line' ? 100 : 60),
      height: tool === 'text' ? 30 : (tool === 'line' ? 0 : 40),
    };

    setAnnotations([...annotations, newAnnot]);
    setSelectedId(newAnnot.id);
    
    // ★重要: 配置したらツールを自動解除
    setTool(null);
  };

  // マウスダウン（ドラッグ開始）
  const handleMouseDown = (e: React.MouseEvent, id: number, mode: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    if (tool) return; // ツール使用中は操作しない

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

  // マウス移動（ドラッグ中）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.mode || !selectedId) return;

      const scale = zoom / 100;
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      setAnnotations(prev => prev.map(a => {
        if (a.id !== selectedId) return a;

        // --- 移動モード ---
        if (dragState.mode === 'move') {
          return { ...a, x: dragState.startLeft + deltaX, y: dragState.startTop + deltaY };
        }
        
        // --- リサイズモード ---
        else if (dragState.mode === 'resize') {
          let newW = dragState.startWidth;
          let newH = dragState.startHeight;
          let newX = dragState.startLeft;
          let newY = dragState.startTop;

          // ハンドルごとの挙動
          if (dragState.handle?.includes('e')) newW = Math.max(10, dragState.startWidth + deltaX);
          if (dragState.handle?.includes('s')) newH = Math.max(10, dragState.startHeight + deltaY);
          
          // 左や上へのリサイズは位置も変わる（簡易実装として右下のみ対応でも十分ですが、今回は右下リサイズのみ実装して安定させます）
          
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
  }, [dragState, selectedId, zoom, setAnnotations]);

  // アイテム削除
  const removeAnnotation = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if(!confirm("削除しますか？")) return;
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // テキスト更新
  const updateText = (id: number, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, content: text } : a));
  };

  const currentPageAnnotations = annotations.filter(a => a.page === pageNumber);

  return (
    <div className="shadow-2xl relative inline-block select-none">
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

          {currentPageAnnotations.map((annot) => {
            const scale = zoom / 100;
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
                  transform: annot.type === 'line' ? 'none' : 'translate(-50%, -50%)', // 線以外は中心基準で配置していたが、リサイズしやすくするため左上基準に変更してもよいが、既存互換性のため維持
                  // 選択枠
                  border: isSelected ? '1px dashed #3B82F6' : 'none',
                  cursor: tool ? 'crosshair' : 'move',
                  zIndex: isSelected ? 100 : 10
                }}
              >
                {/* --- コンテンツ描画 --- */}
                <div className="w-full h-full relative flex items-center justify-center">
                  
                  {annot.type === 'text' && (
                    <textarea
                      value={annot.content}
                      onChange={(e) => updateText(annot.id, e.target.value)}
                      className="w-full h-full bg-transparent border-none outline-none resize-none overflow-hidden"
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
                    <div style={{
                      width: '100%', height: '100%',
                      border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}`,
                    }}></div>
                  )}

                  {annot.type === 'circle' && (
                    <div style={{
                      width: '100%', height: '100%',
                      border: `${Math.max(2, annot.size/3 * scale)}px solid ${annot.color}`,
                      borderRadius: '50%'
                    }}></div>
                  )}

                  {annot.type === 'line' && (
                    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                      <line 
                        x1="0" y1="0" x2="100%" y2="100%" 
                        stroke={annot.color} strokeWidth={Math.max(2, annot.size/3 * scale)} 
                      />
                    </svg>
                  )}

                  {annot.type === 'white' && (
                    <div className="w-full h-full bg-white"></div>
                  )}
                </div>

                {/* --- リサイズハンドル（選択時のみ表示） --- */}
                {isSelected && !tool && (
                  <>
                    {/* 右下ハンドル */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, annot.id, 'resize', 'se')}
                      className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border border-white cursor-se-resize"
                      style={{ transform: 'translate(50%, 50%)' }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Document>
    </div>
  );
}