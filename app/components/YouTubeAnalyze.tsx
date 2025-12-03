// app/components/YouTubeAnalyze.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type AnalyzedRecipe = {
  title: string;
  channel_name: string; // ★追加
  ingredients: string[];
  steps: string[];
};

export default function YouTubeAnalyze() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<AnalyzedRecipe | null>(null);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

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

  const saveRecipe = async () => {
    if (!recipe) return;
    const { error } = await supabase.from('recipes').insert([{
      title: recipe.title,
      channel_name: recipe.channel_name || 'その他', // ★保存
      url: url,
      ingredients: recipe.ingredients,
      steps: recipe.steps
    }]);
    if (error) { alert('保存失敗'); console.error(error); } else { setIsSaved(true); alert('保存しました！'); }
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-4xl mx-auto"> {/* ★PC用に幅調整 */}
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
              <button onClick={saveRecipe} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold shadow hover:bg-blue-700 mb-4">💾 このレシピを保存する</button>
            ) : (
              <div className="w-full bg-green-100 text-green-700 py-2 rounded-lg font-bold text-center mb-4 border border-green-300">✅ 保存済み</div>
            )}
            <div className="grid md:grid-cols-2 gap-6"> {/* ★PCで2列表示 */}
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