// app/components/YouTubeAnalyze.tsx
'use client';
import { useState } from 'react';

type AnalyzedRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
};

export default function YouTubeAnalyze() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<AnalyzedRecipe | null>(null);
  const [error, setError] = useState('');

  const analyzeVideo = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setRecipe(null);

    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error('分析失敗');
      const data = await res.json();
      setRecipe(data);
    } catch (err) {
      setError('エラー：字幕があるYouTube動画か確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-red-50 p-6 rounded-xl border-2 border-red-100 text-center">
        <h2 className="text-2xl font-bold text-red-700 mb-2">📺 動画レシピ分析</h2>
        <p className="text-sm text-gray-600 mb-4">YouTubeのURLを貼るとレシピ化します</p>
        
        <input 
          type="text" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="border p-3 rounded-lg w-full text-black mb-3"
        />
        <button 
          onClick={analyzeVideo} 
          disabled={loading || !url}
          className={`w-full py-3 rounded-lg font-bold text-white shadow transition ${
            loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {loading ? 'AIが動画を見ています...' : '分析する！'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {recipe && (
        <div className="bg-white border rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
          <div className="bg-red-600 text-white p-4 font-bold text-lg text-center">
            {recipe.title}
          </div>
          <div className="p-5 space-y-6">
            <div>
              <h3 className="font-bold text-gray-700 border-l-4 border-green-500 pl-3 mb-3">🥬 材料</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-700 border-l-4 border-orange-500 pl-3 mb-3">🔥 作り方</h3>
              <ol className="list-decimal pl-5 space-y-3 text-gray-700">
                {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}