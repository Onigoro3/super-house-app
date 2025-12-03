// app/pdf/PDFViewer.tsx
'use client';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// CSSの読み込み（最新版のパス）
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ワーカー設定
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File | null;
  zoom: number;
  onLoadSuccess: (data: { numPages: number }) => void;
};

export default function PDFViewer({ file, zoom, onLoadSuccess }: Props) {
  const [pageNumber, setPageNumber] = useState<number>(1);

  return (
    <div className="shadow-2xl">
      <Document
        file={file}
        onLoadSuccess={onLoadSuccess}
        loading={<div className="text-white">PDFを読み込み中...</div>}
        error={<div className="text-red-300">PDFを開けませんでした</div>}
      >
        <Page 
          pageNumber={pageNumber} 
          scale={zoom / 100} 
          renderTextLayer={false} 
          renderAnnotationLayer={false} 
          className="bg-white"
        />
      </Document>
    </div>
  );
}