// app/pdf/PDFViewer.tsx
'use client';
import { useRef } from 'react';
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
  page: number; // ページ番号を追加
};

type Props = {
  file: File | null;
  zoom: number;
  tool: string | null;
  pageNumber: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  // 親からデータをもらう設定
  annotations: Annotation[];
  setAnnotations: (annots: Annotation[]) => void;
};

export default function PDFViewer({ file, zoom, tool, pageNumber, onLoadSuccess, annotations, setAnnotations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // クリックしてアイテム追加
  const handlePageClick = (e: React.MouseEvent) => {
    if (!tool || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ズーム倍率を考慮して、元のサイズ(100%)の座標に変換して保存
    const scale = zoom / 100;
    const originalX = x / scale;
    const originalY = y / scale;

    const newAnnot: Annotation = {
      id: Date.now(),
      type: tool,
      x: originalX,
      y: originalY,
      content: tool === 'text' ? 'テキスト' : '',
      page: pageNumber, // 今のページ番号を記録
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

  // 今のページにあるアイテムだけを表示
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

          {/* 書き込みアイテムの表示 */}
          {currentPageAnnotations.map((annot) => (
            <div
              key={annot.id}
              style={{
                position: 'absolute',
                // 表示するときはズーム倍率を掛ける
                left: annot.x * (zoom / 100),
                top: annot.y * (zoom / 100),
                transform: 'translate(-50%, -50%)',
              }}
              onContextMenu={(e) => removeAnnotation(e, annot.id)}
            >
              {annot.type === 'text' && (
                <input
                  type="text"
                  value={annot.content}
                  onChange={(e) => updateText(annot.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border border-dashed border-gray-300 hover:border-blue-500 focus:border-blue-500 outline-none text-red-600 font-bold p-1 rounded"
                  style={{ 
                    minWidth: '100px',
                    fontSize: `${16 * (zoom / 100)}px` // 文字サイズもズームに合わせる
                  }}
                />
              )}
              {annot.type === 'check' && (
                <div className="text-red-600 font-bold pointer-events-none" style={{ fontSize: `${24 * (zoom / 100)}px` }}>✔</div>
              )}
              {annot.type === 'white' && (
                <div className="bg-white border border-gray-200" style={{ width: `${60 * (zoom / 100)}px`, height: `${20 * (zoom / 100)}px` }}></div>
              )}
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}