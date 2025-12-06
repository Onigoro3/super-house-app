// app/travel/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

// 地図コンポーネント
const OnsenMap = dynamic(() => import('./OnsenMap'), { ssr: false, loading: () => <div className="h-full bg-gray-100 flex items-center justify-center">地図読込中...</div> });
const RestaurantMap = dynamic(() => import('./RestaurantMap'), { ssr: false, loading: () => <div className="h-full bg-gray-100 flex items-center justify-center">地図読込中...</div> });

// 型定義
type Spot = { time: string; name: string; desc: string; cost: string; distance: string; url: string; };
type DayPlan = { day: number; spots: Spot[]; };
type TravelPlan = { title: string; concept: string; schedule: DayPlan[]; };
type SavedPlan = { id: number; title: string; destination: string; plan_data: TravelPlan; created_at: string; };

export default function TravelApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ★画面切り替え ('new' | 'history' | 'map' | 'food')
  const [currentView, setCurrentView] = useState<'new' | 'history' | 'map' | 'food'>('new');
  const [showMenu, setShowMenu] = useState(false); 

  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('日帰り');
  const [budget, setBudget] = useState('30000');
  const [people, setPeople] = useState('2');
  const [theme, setTheme] = useState('');
  const [transport, setTransport] = useState('車');
  const [origin, setOrigin] = useState('現在地を取得中...');

  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [historyList, setHistoryList] = useState<SavedPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false); 
      if (session) fetchHistory();
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const addr = data.address;
          const name = `${addr.province || addr.state || ''} ${addr.city || addr.town || addr.village || ''}`.trim();
          setOrigin(name || '現在地');
        } catch (e) { setOrigin('現在地 (取得失敗)'); }
      }, () => { setOrigin('大阪府 堺市 (デフォルト)'); });
    } else { setOrigin('大阪府 堺市'); }
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase.from('travel_plans').select('*').order('created_at', { ascending: false });
    if (data) setHistoryList(data);
  };

  const generatePlan = async () => {
    if (!destination) return alert('行き先を入力してください');
    setIsGenerating(true); setPlan(null);
    try {
      const res = await fetch('/api/travel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination, duration, budget, people, theme, transport, origin }), });
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
  const loadHistory = (saved: SavedPlan) => { 
    setPlan(saved.plan_data); setDestination(saved.destination); 
    setCurrentView('new'); 
    setShowMenu(false);
  };

  const savePDF = async () => {
    if (!plan) return; setIsSaving(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.create(); pdfDoc.registerFontkit(fontkit);
      let customFont; try { const fontBytes = await fetch(window.location.origin + '/fonts/gothic.ttf').then(res => res.arrayBuffer()); customFont = await pdfDoc.embedFont(fontBytes); } catch (e) { customFont = await pdfDoc.embedFont(StandardFonts.Helvetica); }
      let page = pdfDoc.addPage([595, 842]); const { height } = page.getSize(); let y = height - 50;
      const drawWrappedText = (text: string, x: number, y: number, size: number, maxWidth: number, color: any) => {
        let currentLine = ''; for (let i = 0; i < text.length; i++) { const width = customFont.widthOfTextAtSize(currentLine + text[i], size); if (width > maxWidth) { page.drawText(currentLine, { x, y, size, font: customFont, color }); currentLine = text[i]; y -= size * 1.5; } else { currentLine += text[i]; } } page.drawText(currentLine, { x, y, size, font: customFont, color }); return y;
      };
      y = drawWrappedText(plan.title, 50, y, 20, 500, rgb(0, 0.6, 0.6)); y -= 30;
      y = drawWrappedText(`コンセプト: ${plan.concept}`, 50, y, 10, 500, rgb(0.4, 0.4, 0.4)); y -= 40;
      for (const day of plan.schedule) {
        if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
        page.drawText(`【 ${day.day}日目 】`, { x: 50, y, size: 14, font: customFont, color: rgb(0, 0, 0) }); y -= 25;
        for (const spot of day.spots) {
          if (y < 80) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
          page.drawText(`${spot.time}  ${spot.name}`, { x: 60, y, size: 12, font: customFont, color: rgb(0, 0, 0) }); y -= 15;
          const meta = `費用: ${spot.cost}  /  距離: ${spot.distance}`; page.drawText(meta, { x: 300, y: y + 15, size: 9, font: customFont, color: rgb(0.5, 0.5, 0.5) });
          if (spot.url) { page.drawText(`URL: ${spot.url}`, { x: 60, y, size: 9, font: customFont, color: rgb(0, 0, 1) }); y -= 12; }
          y = drawWrappedText(spot.desc, 80, y, 9, 450, rgb(0.3, 0.3, 0.3)); y -= 20;
        } y -= 20;
      }
      const pdfBytes = await pdfDoc.save(); const base64String = Buffer.from(pdfBytes).toString('base64');
      await supabase.from('documents').insert([{ title: `${plan.title}.pdf`, folder_name: '旅行計画', file_data: base64String }]); alert('PDF保存完了！');
    } catch (e) { alert('保存エラー'); } finally { setIsSaving(false); }
  };

  const openGoogleMapsRoute = (spots: Spot[]) => { if (spots.length < 1) return; const dest = spots[spots.length - 1].name; const wp = spots.slice(0, -1).map(s => s.name).join('|'); window.open(`http://googleusercontent.com/maps.google.com/9{encodeURIComponent(dest)}&waypoints=${encodeURIComponent(wp)}&travelmode=${transport==='車'?'driving':'transit'}`, '_blank'); };
  const FormattedText = ({ text }: { text: string }) => { const parts = text.split(/(https?:\/\/[^\s]+)/g); return <span>{parts.map((p,i)=>p.match(/^https?:\/\//)?<a key={i} href={p} target="_blank" rel="noreferrer" className="text-blue-600 underline mx-1 bg-blue-50 px-1 rounded text-xs">Link</a>:<span key={i}>{p}</span>)}</span>; };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col h-screen text-gray-800 relative overflow-hidden">
      
      {/* サイドメニュー */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/50 flex-1" onClick={() => setShowMenu(false)}></div>
          <div className="bg-white w-64 h-full shadow-2xl p-4 flex flex-col animate-slideInRight">
            <h2 className="font-bold text-xl mb-6 text-teal-800 border-b pb-2">✈ メニュー</h2>
            <div className="space-y-2">
              <button onClick={() => { setCurrentView('new'); setShowMenu(false); }} className={`w-full p-3 rounded-lg font-bold text-left ${currentView === 'new' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}>✨ 新規プラン作成</button>
              <button onClick={() => { setCurrentView('history'); setShowMenu(false); }} className={`w-full p-3 rounded-lg font-bold text-left ${currentView === 'history' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}>📜 保存したプラン</button>
              <div className="border-t my-2"></div>
              <button onClick={() => { setCurrentView('map'); setShowMenu(false); }} className={`w-full p-3 rounded-lg font-bold text-left ${currentView === 'map' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}>♨️ 周辺温泉マップ</button>
              {/* ★ここに追加 */}
              <button onClick={() => { setCurrentView('food'); setShowMenu(false); }} className={`w-full p-3 rounded-lg font-bold text-left ${currentView === 'food' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>🍽️ 周辺グルメマップ</button>
            </div>
            <button onClick={() => setShowMenu(false)} className="mt-auto p-3 text-gray-400 text-center border-t">閉じる</button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-teal-600 text-white p-3 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-teal-700 hover:bg-teal-800 px-3 py-1 rounded-lg font-bold text-xs transition">🔙 ホーム</Link>
          <h1 className="text-lg font-bold">✈ お出かけ</h1>
        </div>
        <button onClick={() => setShowMenu(true)} className="p-2 rounded hover:bg-teal-700">
          <div className="w-6 h-0.5 bg-white mb-1.5"></div><div className="w-6 h-0.5 bg-white mb-1.5"></div><div className="w-6 h-0.5 bg-white"></div>
        </button>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {/* 温泉マップ */}
        {currentView === 'map' && <div className="h-full w-full animate-fadeIn"><OnsenMap /></div>}
        
        {/* ★グルメマップ */}
        {currentView === 'food' && <div className="h-full w-full animate-fadeIn"><RestaurantMap /></div>}

        {/* プラン作成 & 履歴 */}
        {(currentView === 'new' || currentView === 'history') && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
             <div className="max-w-md mx-auto space-y-6">
               {currentView === 'new' && (
                <>
                  {/* ... (入力フォームや結果表示は省略なしでそのまま) ... */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-teal-100 flex flex-col gap-4">
                    <div className="text-xs text-gray-500 flex items-center gap-1"><span>📍 出発地:</span><span className="font-bold text-teal-700">{origin}</span></div>
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
                        <p className="opacity-90 text-xs mb-2">{plan.concept}</p>
                        <div className="flex justify-center gap-2 mt-2">
                          <button onClick={savePlanToHistory} className="bg-white/20 text-white px-3 py-1 rounded text-xs border border-white/50">💾 保存</button>
                          <button onClick={savePDF} disabled={isSaving} className="bg-white text-teal-700 px-3 py-1 rounded text-xs shadow">{isSaving ? '...' : '📄 PDF'}</button>
                        </div>
                      </div>
                      <div className="p-4 space-y-6">
                        {plan.schedule.map((day) => (
                          <div key={day.day} className="relative pl-4 border-l-2 border-teal-200">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-bold text-gray-800 text-lg">{day.day}日目</h3>
                              <button onClick={() => openGoogleMapsRoute(day.spots)} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-100">🗺️ ルート</button>
                            </div>
                            <div className="space-y-4">
                              {day.spots.map((spot, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                  <div className="w-10 font-mono text-gray-400 font-bold text-xs pt-1 text-right pr-1 shrink-0">{spot.time}</div>
                                  <div className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-100 min-w-0">
                                    <div className="flex flex-col gap-1 mb-1">
                                      <div className="flex justify-between items-start flex-wrap gap-1">
                                         <h4 className="font-bold text-teal-800 text-sm flex items-center gap-2 break-all">
                                           {spot.name} 
                                           {spot.url && spot.url.startsWith('http') && <a href={spot.url} target="_blank" rel="noreferrer" className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200 whitespace-nowrap">Link</a>}
                                         </h4>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                                        <span className="bg-white border px-1.5 rounded">{spot.cost}</span>
                                        {spot.distance && <span className="text-teal-600 font-bold">🚗 {spot.distance}</span>}
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words"><FormattedText text={spot.desc} /></p>
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
               {currentView === 'history' && (
                 <div className="space-y-3">
                   {historyList.length === 0 && <p className="text-center text-gray-400 py-10">履歴なし</p>}
                   {historyList.map(item => (
                     <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border flex justify-between items-center hover:bg-teal-50 transition" onClick={() => {loadHistory(item); setShowMenu(false);}}>
                       <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-800 text-sm truncate">{item.title}</h3><p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()} - {item.destination}</p></div>
                       <button onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }} className="text-gray-300 hover:text-red-500 p-2">🗑️</button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}