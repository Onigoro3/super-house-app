// app/travel/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type Spot = { time: string; name: string; desc: string; cost: string; distance: string; url: string; };
type DayPlan = { day: number; spots: Spot[]; };
type TravelPlan = { title: string; concept: string; schedule: DayPlan[]; };
type SavedPlan = { id: number; title: string; destination: string; plan_data: TravelPlan; created_at: string; };

export default function TravelApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('日帰り');
  const [budget, setBudget] = useState('30000');
  const [people, setPeople] = useState('2');
  const [theme, setTheme] = useState('');
  const [transport, setTransport] = useState('車');
  
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [historyList, setHistoryList] = useState<SavedPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); if (session) fetchHistory(); });
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase.from('travel_plans').select('*').order('created_at', { ascending: false });
    if (data) setHistoryList(data);
  };

  const generatePlan = async () => {
    if (!destination) return alert('行き先を入力してください');
    setIsGenerating(true); setPlan(null);
    try {
      const res = await fetch('/api/travel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination, duration, budget, people, theme, transport }), });
      if (!res.ok) throw new Error('生成エラー');
      setPlan(await res.json());
    } catch (e) { alert('プラン作成失敗'); } finally { setIsGenerating(false); }
  };

  const savePlanToHistory = async () => {
    if (!plan) return;
    const { error } = await supabase.from('travel_plans').insert([{ title: plan.title, destination: destination, plan_data: plan }]);
    if (error) alert('保存失敗'); else { alert('保存しました！'); fetchHistory(); }
  };
  const deleteHistory = async (id: number) => { if (!confirm('削除しますか？')) return; await supabase.from('travel_plans').delete().eq('id', id); fetchHistory(); };
  const loadHistory = (saved: SavedPlan) => { setPlan(saved.plan_data); setDestination(saved.destination); setActiveTab('new'); };

  const savePDF = async () => {
    if (!plan) return; setIsSaving(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.create(); pdfDoc.registerFontkit(fontkit);
      let customFont; try { const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer()); customFont = await pdfDoc.embedFont(fontBytes); } catch (e) { customFont = await pdfDoc.embedFont(StandardFonts.Helvetica); }
      let page = pdfDoc.addPage([595, 842]); const { height } = page.getSize(); let y = height - 50;
      page.drawText(plan.title, { x: 50, y, size: 20, font: customFont, color: rgb(0, 0.6, 0.6) }); y -= 30;
      page.drawText(`コンセプト: ${plan.concept}`, { x: 50, y, size: 10, font: customFont, color: rgb(0.4, 0.4, 0.4) }); y -= 40;
      for (const day of plan.schedule) {
        if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
        page.drawText(`【 ${day.day}日目 】`, { x: 50, y, size: 14, font: customFont, color: rgb(0, 0, 0) }); y -= 25;
        for (const spot of day.spots) {
          if (y < 80) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
          page.drawText(`${spot.time}  ${spot.name}`, { x: 60, y, size: 12, font: customFont, color: rgb(0, 0, 0) }); y -= 15;
          const meta = `費用: ${spot.cost}  /  距離: ${spot.distance}`; page.drawText(meta, { x: 300, y: y + 15, size: 9, font: customFont, color: rgb(0.5, 0.5, 0.5) });
          if (spot.url) { page.drawText(`URL: ${spot.url}`, { x: 60, y, size: 9, font: customFont, color: rgb(0, 0, 1) }); y -= 12; }
          const desc = spot.desc; const maxLen = 45;
          for (let i = 0; i < desc.length; i += maxLen) { page.drawText(desc.substring(i, i + maxLen), { x: 80, y, size: 9, font: customFont, color: rgb(0.3, 0.3, 0.3) }); y -= 12; } y -= 15;
        } y -= 20;
      }
      const pdfBytes = await pdfDoc.save(); const base64String = Buffer.from(pdfBytes).toString('base64');
      await supabase.from('documents').insert([{ title: `${plan.title}.pdf`, folder_name: '旅行計画', file_data: base64String }]); alert('PDF保存完了！');
    } catch (e) { alert('保存エラー'); } finally { setIsSaving(false); }
  };

  // ★ Googleマップでルートを開く関数
  const openGoogleMapsRoute = (spots: Spot[]) => {
    if (spots.length < 1) return;
    const origin = "大阪府堺市";
    const destination = spots[spots.length - 1].name;
    const waypoints = spots.slice(0, -1).map(s => s.name).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=${transport === '車' ? 'driving' : 'transit'}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col h-screen text-gray-800">
      <header className="bg-teal-600 text-white p-3 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-3"><Link href="/" className="bg-teal-700 hover:bg-teal-800 px-3 py-1 rounded-lg font-bold text-xs transition">🔙 ホーム</Link><h1 className="text-lg font-bold">✈ お出かけ</h1></div>
      </header>

      {/* スマホ対応タブ */}
      <div className="flex bg-teal-700 p-1 sticky top-0 z-10">
        <button onClick={() => setActiveTab('new')} className={`flex-1 py-2 text-sm font-bold transition ${activeTab === 'new' ? 'bg-white text-teal-700' : 'text-teal-100'}`}>✨ 作成</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-sm font-bold transition ${activeTab === 'history' ? 'bg-white text-teal-700' : 'text-teal-100'}`}>📜 履歴</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-md mx-auto space-y-6"> {/* スマホ向けに幅調整 */}
          
          {activeTab === 'new' && (
            <>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-teal-100 flex flex-col gap-4">
                <div><label className="text-xs font-bold text-gray-500">行き先</label><input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="例：京都" className="w-full border p-2 rounded-lg bg-gray-50" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-gray-500">期間</label><select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50"><option>日帰り</option><option>夕方から</option><option>1泊2日</option><option>2泊3日</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">移動</label><select value={transport} onChange={e => setTransport(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50"><option>車</option><option>電車</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">人数</label><select value={people} onChange={e => setPeople(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50">{[1,2,3,4,5,6].map(p => <option key={p} value={p}>{p}人</option>)}</select></div>
                  <div><label className="text-xs font-bold text-gray-500">予算</label><input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50" /></div>
                </div>
                <div><label className="text-xs font-bold text-gray-500">テーマ</label><input type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="例：温泉" className="w-full border p-2 rounded-lg bg-gray-50" /></div>
                <button onClick={generatePlan} disabled={isGenerating} className={`w-full py-3 rounded-xl font-bold text-white shadow ${isGenerating ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'}`}>{isGenerating ? '作成中...' : '✨ プラン作成'}</button>
              </div>

              {plan && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-fadeIn mb-10">
                  <div className="bg-teal-600 text-white p-4 text-center relative">
                    <h2 className="text-lg font-bold mb-1 leading-tight">{plan.title}</h2>
                    <p className="opacity-90 text-xs">{plan.concept}</p>
                    <div className="flex justify-center gap-2 mt-3">
                      <button onClick={savePlanToHistory} className="bg-white/20 text-white px-3 py-1 rounded text-xs border border-white/50">💾 保存</button>
                      <button onClick={savePDF} disabled={isSaving} className="bg-white text-teal-700 px-3 py-1 rounded text-xs shadow">{isSaving ? '...' : '📄 PDF'}</button>
                    </div>
                  </div>
                  <div className="p-4 space-y-6">
                    {plan.schedule.map((day) => (
                      <div key={day.day} className="relative pl-4 border-l-2 border-teal-200">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-gray-800 text-lg">{day.day}日目</h3>
                          {/* ★Googleマップボタン */}
                          <button onClick={() => openGoogleMapsRoute(day.spots)} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-100">
                            🗺️ 地図でルートを見る
                          </button>
                        </div>
                        <div className="space-y-4">
                          {day.spots.map((spot, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-12 font-mono text-gray-400 font-bold text-xs pt-1">{spot.time}</div>
                              <div className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div className="flex flex-col gap-1 mb-1">
                                  <h4 className="font-bold text-teal-800 text-sm flex flex-wrap items-center gap-2">
                                    {spot.name} 
                                    {spot.url && spot.url.startsWith('http') && <a href={spot.url} target="_blank" className="text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded border border-blue-200">Link</a>}
                                  </h4>
                                  <div className="flex gap-2 text-[10px] text-gray-500">
                                    <span>💰 {spot.cost}</span>
                                    {spot.distance && <span className="text-teal-600 font-bold">🚗 {spot.distance}</span>}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{spot.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {/* 履歴タブ */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {historyList.length === 0 && <p className="text-center text-gray-400 py-10">履歴なし</p>}
              {historyList.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border flex justify-between items-center" onClick={() => loadHistory(item)}>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{item.title}</h3>
                    <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()} - {item.destination}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }} className="text-gray-300 hover:text-red-500 p-2">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}