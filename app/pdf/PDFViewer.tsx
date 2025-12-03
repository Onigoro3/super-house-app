// app/pdf/PDFViewer.tsx
'use client';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File | null;
  zoom: number;
  onLoadSuccess: (data: { numPages: number }) => void;
};

export default function PDFViewer({ file, zoom, onLoadSuccess }: Props) {
  const [pageNumber, setPageNumber] = useState<number>(1);

  return (
    <div className="flex">
      {/* メインビュー */}
      <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center relative min-h-[calc(100vh-140px)]">
        {file ? (
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
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-400 m-4 rounded-xl">
            <p className="text-4xl mb-4">📂</p>
            <p className="text-lg font-bold">PDFファイルを開いてください</p>
            <p className="text-sm mt-2">左上の「開く」ボタンから選択</p>
          </div>
        )}
      </div>
    </div>
  );
}