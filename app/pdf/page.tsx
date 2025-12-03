// app/pdf/page.tsx
'use client';
import Link from 'next/link';

export default function PDFApp() {
  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">📄 PDF編集アプリ</h1>
        <Link href="/" className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold">
          🔙 ホームへ戻る
        </Link>
      </div>
      
      <div className="bg-white p-10 rounded-2xl shadow-lg text-center w-full max-w-2xl">
        <p className="text-gray-500 text-lg">ここにPDF編集機能のコードを貼り付ければ動きます！</p>
        <div className="mt-8 text-6xl">🛠️</div>
      </div>
    </div>
  );
}