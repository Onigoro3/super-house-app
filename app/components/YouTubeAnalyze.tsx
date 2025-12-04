// app/components/YouTubeAnalyze.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
// PDF生成用（動的インポート用）

type AnalyzedRecipe = {
  title: string;
  channel_name: string;
  ingredients: string[];
  steps: string[];
};

export default function YouTubeAnalyze() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<AnalyzedRecipe | null>(null);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 保存中フラグ

  const analyzeVideo = async () => {
    if (!url) return;
    setLoading(true); setError(''); setRecipe(null); setIsSaved(false);
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST', body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error('分析失敗');
      const data = await res.json();
      setRecipe(data);
    } catch (err) { setError('エラー：字幕があるYouTube動画か確認してください。'); } finally { setLoading(false); }
  };

  // ★ YouTubeレシピを「レシピ帳」＆「書類管理(PDF)」の両方に保存する
  const saveRecipe = async () => {
    if (!recipe) return;
    setIsSaving(true);

    try {
      // 1. 「YouTubeレシピ帳（データベース）」に保存
      const { error: dbError } = await supabase.from('recipes').insert([{
        title: recipe.title,
        channel_name: recipe.channel_name || 'その他',
        url: url,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        source: 'youtube', // 区別用
      }]);
      if (dbError) throw dbError;

      // 2. PDFファイルを自動生成して「書類管理」に保存
      // ライブラリを動的読み込み
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      
      // フォント読み込み（public/fonts/gothic.ttf）
      let customFont;
      try {
        const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
      } catch (e) {
        console.warn('Font load failed, using standard font');
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      const page = pdfDoc.addPage([595, 842]); // A4
      const { height } = page.getSize();
      const margin = 50;
      let currentY = height - margin;

      // タイトル（赤色）
      page.drawText(recipe.title, { x: margin, y: currentY, size: 20, font: customFont, color: rgb(0.8, 0, 0) });
      currentY -= 30;

      // チャンネル名
      page.drawText(`チャンネル: ${recipe.channel_name}`, { x: margin, y: currentY, size: 12, font: customFont, color: rgb(0.5, 0.5, 0.5) });
      currentY -= 30;

      // リンク
      page.drawText(`動画URL: ${url}`, { x: margin, y: currentY, size: 10, font: customFont, color: rgb(0, 0, 1) });
      currentY -= 40;

      // 材料
      page.drawText('【材料】', { x: margin, y: currentY, size: 14, font: customFont, color: rgb(0, 0, 0) });
      currentY -= 20;
      for (const ing of recipe.ingredients) {
        page.drawText(`・${ing}`, { x: margin + 10, y: currentY, size: 12, font: customFont, color: rgb(0.2, 0.2, 0.2) });
        currentY -= 18;
      }
      currentY -= 20;

      // 作り方
      page.drawText('【作り方】', { x: margin, y: currentY, size: 14, font: customFont, color: rgb(0, 0, 0) });
      currentY -= 20;
      for (let i = 0; i < recipe.steps.length; i++) {
        const step = `${i + 1}. ${recipe.steps[i]}`;
        // 簡易的な折り返し処理
        const maxLineLength = 35;
        for (let j = 0; j < step.length; j += maxLineLength) {
          const line = step.substring(j, j + maxLineLength);
          page.drawText(line, { x: margin + 10, y: currentY, size: 12, font: customFont, color: rgb(0.2, 0.2, 0.2) });
          currentY -= 18;
        }
        currentY -= 5;
      }

      // PDFをBase64化
      const pdfBytes = await pdfDoc.save();
      // ブラウザでBufferを使うための簡易変換
      const binaryString = String.fromCharCode(...new Uint8Array(pdfBytes));
      const base64String = btoa(binaryString);

      // 書類管理(documents)へ保存
      const { error: docError } = await supabase.from('documents').insert([{
        title: `${recipe.title}.pdf`,
        folder_name: 'YouTube献立', // ★自動でこのフォルダに入ります
        file_data: base64String
      }]);

      if (docError) throw docError;

      setIsSaved(true);
      alert('「YouTubeレシピ帳」と「書類管理(YouTube献立フォルダ)」の両方に保存しました！');

    } catch (e) {
      console.error(e);
      alert('保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-4xl mx-auto">
      <div className="bg-red-50 p-6 rounded-xl border-2 border-red-100 text-center">
        <h2 className="text-2xl font-bold text-red-700 mb-2">📺 動画レシピ分析</h2>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="border p-3 rounded-lg w-full text-black mb-3" />
        <button onClick={analyzeVideo} disabled={loading || !url} className={`w-full py-3 rounded-lg font-bold text-white shadow ${loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}>
          {loading ? 'AIが動画を見ています...' : '分析する！'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {recipe && (
        <div className="bg-white border rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
          <div className="bg-red-600 text-white p-4 font-bold text-lg text-center">
            {recipe.title}
            <div className="text-sm font-normal opacity-90 mt-1">ch: {recipe.channel_name}</div>
          </div>
          <div className="p-5 space-y-6">
            {!isSaved ? (
              <button 
                onClick={saveRecipe} 
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold shadow hover:bg-blue-700 mb-4"
              >
                {isSaving ? '保存中...' : '💾 このレシピを保存する'}
              </button>
            ) : (
              <div className="w-full bg-green-100 text-green-700 py-2 rounded-lg font-bold text-center mb-4 border border-green-300">✅ 保存済み</div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-700 border-l-4 border-green-500 pl-3 mb-3">🥬 材料</h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">{recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}</ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-700 border-l-4 border-orange-500 pl-3 mb-3">🔥 作り方</h3>
                <ol className="list-decimal pl-5 space-y-3 text-gray-700">{recipe.steps.map((step, i) => <li key={i} className="leading-relaxed">{step}</li>)}</ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}