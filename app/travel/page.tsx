// app/travel/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

// 型定義（distanceを追加）
type Spot = { time: string; name: string; desc: string; cost: string; distance: string; };
type DayPlan = { day: number; spots: Spot[]; };
type TravelPlan = { title: string; concept: string; schedule: DayPlan[]; };

export default function TravelApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 入力フォーム
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('日帰り'); // 期間（文字列）
  const [budget, setBudget] = useState('30000');
  const [people, setPeople] = useState('2');
  const [theme, setTheme] = useState('');
  const [transport, setTransport] = useState('車'); // 移動手段
  
  // 結果
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // プラン生成
  const generatePlan = async () => {
    if (!destination) return alert('行き先を入力してください');
    setIsGenerating(true);
    setPlan(null);

    try {
      const res = await fetch('/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          destination, 
          duration, // 日帰り、1泊2日など
          budget, 
          people, 
          theme,
          transport // 車、電車など
        }),
      });
      if (!res.ok) throw new Error('生成エラー');
      const data = await res.json();
      setPlan(data);
    } catch (e) { alert('プラン作成に失敗しました'); } finally { setIsGenerating(false); }
  };

  // PDF保存
  const savePDF = async () => {
    if (!plan) return;
    setIsSaving(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      let customFont;
      try {
        const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
      } catch (e) { customFont = await pdfDoc.embedFont(StandardFonts.Helvetica); }

      let page = pdfDoc.addPage([595, 842]);
      const { height } = page.getSize();
      let y = height - 50;

      // タイトル
      page.drawText(plan.title, { x: 50, y, size: 24, font: customFont, color: rgb(0, 0.6, 0.6) });
      y -= 30;
      page.drawText(`コンセプト: ${plan.concept}`, { x: 50, y, size: 12, font: customFont, color: rgb(0.4, 0.4, 0.4) });
      y -= 40;

      for (const day of plan.schedule) {
        if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
        
        page.drawText(`【 ${day.day}日目 】`, { x: 50, y, size: 16, font: customFont, color: rgb(0, 0, 0) });
        y -= 25;

        for (const spot of day.spots) {
          if (y < 80) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
          
          page.drawText(`${spot.time}  ${spot.name}`, { x: 60, y, size: 14, font: customFont, color: rgb(0, 0, 0) });
          y -= 15;
          // 距離を追加
          const metaInfo = `費用: ${spot.cost}  /  移動: ${spot.distance}`;
          page.drawText(metaInfo, { x: 300, y: y + 15, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) });
          
          const desc = spot.desc;
          const maxLen = 40;
          for (let i = 0; i < desc.length; i += maxLen) {
            page.drawText(desc.substring(i, i + maxLen), { x: 80, y, size: 10, font: customFont, color: rgb(0.3, 0.3, 0.3) });
            y -= 12;
          }
          y -= 15;
        }
        y -= 20;
      }

      const pdfBytes = await pdfDoc.save();
      const base64String = Buffer.from(pdfBytes).toString('base64');

      const { error } = await supabase.from('documents').insert([{
        title: `${plan.title}.pdf`,
        folder_name: '旅行計画',
        file_data: base64String
      }]);
      if (error) throw error;
      alert('「書類管理」に旅のしおり(PDF)を保存しました！');

    } catch (e) { console.error(e); alert('保存エラー'); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col h-screen text-gray-800">
      
      <header className="bg-teal-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-teal-700 hover:bg-teal-800 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">✈ お出かけプランナー</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100">
            <h2 className="font-bold text-lg text-teal-800 mb-4">旅の条件を入力</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">行き先</label>
                <input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="例：白浜、京都" className="w-full border p-3 rounded-lg" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">期間</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-3 rounded-lg bg-white">
                    <option value="日帰り">日帰り</option>
                    <option value="1泊2日">1泊2日</option>
                    <option value="2泊3日">2泊3日</option>
                    <option value="3泊4日">3泊4日</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">移動手段</label>
                  <select value={transport} onChange={e => setTransport(e.target.value)} className="w-full border p-3 rounded-lg bg-white">
                    <option value="車">🚗 車</option>
                    <option value="電車・バス">🚃 電車・バス</option>
                    <option value="新幹線">🚅 新幹線</option>
                    <option value="飛行機">✈️ 飛行機</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">人数</label>
                    <select value={people} onChange={e => setPeople(e.target.value)} className="w-full border p-3 rounded-lg bg-white">
                      {[1,2,3,4,5,6].map(p => <option key={p} value={p}>{p}人</option>)}
                    </select>
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">1人予算</label>
                    <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="円" className="w-full border p-3 rounded-lg" />
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">テーマ・要望</label>
                <input type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="例：歴史を知りたい、海鮮が食べたい" className="w-full border p-3 rounded-lg" />
              </div>
            </div>
            <button 
              onClick={generatePlan} 
              disabled={isGenerating} 
              className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow transition ${isGenerating ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'}`}
            >
              {isGenerating ? 'AIがプランを作成中...' : '✨ 最高のプランを作成！'}
            </button>
          </div>

          {plan && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
              <div className="bg-teal-600 text-white p-6 text-center relative">
                <h2 className="text-2xl font-bold mb-2">{plan.title}</h2>
                <p className="opacity-90 text-sm">{plan.concept}</p>
                <button onClick={savePDF} disabled={isSaving} className="absolute top-4 right-4 bg-white text-teal-700 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-gray-100">
                  {isSaving ? '保存中...' : '📄 PDF保存'}
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                {plan.schedule.map((day) => (
                  <div key={day.day} className="relative pl-6 border-l-2 border-teal-200">
                    <div className="absolute -left-3 top-0 bg-teal-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{day.day}</div>
                    <h3 className="font-bold text-xl text-gray-800 mb-4">{day.day}日目</h3>
                    <div className="space-y-6">
                      {day.spots.map((spot, i) => (
                        <div key={i} className="flex gap-4 items-start group">
                          <div className="w-16 font-mono text-gray-400 font-bold pt-1 text-sm">{spot.time}</div>
                          <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 group-hover:border-teal-200 transition">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-teal-800">{spot.name}</h4>
                              <div className="text-right flex flex-col items-end">
                                <span className="text-xs bg-white border px-2 py-1 rounded text-gray-500 mb-1">{spot.cost}</span>
                                {spot.distance && <span className="text-xs text-teal-600 font-bold">🚗 {spot.distance}</span>}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">{spot.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}