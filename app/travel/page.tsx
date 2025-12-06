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
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false); 
      if (session) fetchHistory();
    });
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase.from('travel_plans').select('*').order('created_at', { ascending: false });
    if (data) setHistoryList(data);
  };

  const generatePlan = async () => {
    if (!destination) return alert('行き先を入力してください');
    setIsGenerating(true);
    setPlan(null);
    try {
      const res = await fetch('/api/travel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, duration, budget, people, theme, transport }),
      });
      if (!res.ok) throw new Error('生成エラー');
      const data = await res.json();
      setPlan(data);
    } catch (e) { alert('プラン作成に失敗しました'); } finally { setIsGenerating(false); }
  };

  const savePlanToHistory = async () => {
    if (!plan) return;
    const { error } = await supabase.from('travel_plans').insert([{ title: plan.title, destination: destination, plan_data: plan }]);
    if (error) alert('保存失敗'); else { alert('保存しました！'); fetchHistory(); }
  };
  const deleteHistory = async (id: number) => { if (!confirm('削除しますか？')) return; await supabase.from('travel_plans').delete().eq('id', id); fetchHistory(); };
  const loadHistory = (saved: SavedPlan) => { setPlan(saved.plan_data); setDestination(saved.destination); setActiveTab('new'); };

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

      page.drawText(plan.title, { x: 50, y, size: 24, font: customFont, color: rgb(0, 0.6, 0.6) });
      y -= 30;
      page.drawText(`コンセプト: ${plan.concept}`, { x: 50, y, size: 12, font: customFont, color: rgb(0.4, 0.4, 0.4) });
      y -= 40;

      for (const day of plan.schedule) {
        if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
        page.drawText(`【 ${day.day}日目 】`, { x: 50, y, size: 16, font: customFont, color: rgb(0, 0, 0) });
        y -= 25;
        for (const spot of day.spots) {
          if (y < 100) { page = pdfDoc.addPage([595, 842]); y = height - 50; }
          page.drawText(`${spot.time}  ${spot.name}`, { x: 60, y, size: 14, font: customFont, color: rgb(0, 0, 0) });
          y -= 15;
          const meta = `費用: ${spot.cost}  /  距離: ${spot.distance}`;
          page.drawText(meta, { x: 300, y: y + 15, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) });
          if (spot.url) { page.drawText(`URL: ${spot.url}`, { x: 60, y, size: 9, font: customFont, color: rgb(0, 0, 1) }); y -= 12; }
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
      await supabase.from('documents').insert([{ title: `${plan.title}.pdf`, folder_name: '旅行計画', file_data: base64String }]);
      alert('PDF保存完了！');
    } catch (e) { alert('保存エラー'); } finally { setIsSaving(false); }
  };

  if (loading) return <div>Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col h-screen text-gray-800">
      <header className="bg-teal-600 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-4"><Link href="/" className="bg-teal-700 hover:bg-teal-800 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホーム</Link><h1 className="text-xl font-bold">✈ お出かけプランナー</h1></div>
      </header>
      <div className="flex bg-teal-700 p-1">
        <button onClick={() => setActiveTab('new')} className={`flex-1 py-2 text-sm font-bold ${activeTab === 'new' ? 'bg-white text-teal-700' : 'text-teal-100 hover:bg-teal-600'}`}>✨ 新規プラン作成</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-sm font-bold ${activeTab === 'history' ? 'bg-white text-teal-700' : 'text-teal-100 hover:bg-teal-600'}`}>📜 保存したプラン</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {activeTab === 'new' && (
            <>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100">
                <h2 className="font-bold text-lg text-teal-800 mb-4">旅の条件を入力</h2>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">行き先</label><input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="例：白浜、京都" className="w-full border p-3 rounded-lg" /></div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">期間・時間</label>
                      <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-3 rounded-lg bg-white">
                        <option value="日帰り">日帰り (朝〜)</option>
                        <option value="夕方からの弾丸">夕方からの弾丸 (17時〜)</option>
                        <option value="仕事終わりの夜旅">仕事終わりの夜旅 (20時〜)</option>
                        <option value="1泊2日">1泊2日</option>
                        <option value="2泊3日">2泊3日</option>
                      </select>
                    </div>
                    <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">移動</label><select value={transport} onChange={e => setTransport(e.target.value)} className="w-full border p-3 rounded-lg bg-white"><option value="車">🚗 車</option><option value="電車">🚃 電車</option><option value="新幹線">🚅 新幹線</option></select></div>
                  </div>
                  <div className="flex gap-2">
                     <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">人数</label><select value={people} onChange={e => setPeople(e.target.value)} className="w-full border p-3 rounded-lg bg-white">{[1,2,3,4,5,6].map(p => <option key={p} value={p}>{p}人</option>)}</select></div>
                     <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">1人予算</label><input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full border p-3 rounded-lg" /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">テーマ・要望</label>
                    <input type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="例：サウナに行きたい、海鮮" className="w-full border p-3 rounded-lg" />
                    <p className="text-xs text-gray-400 mt-1">※「サウナ」と入れると詳しく検索します♨️</p>
                  </div>
                </div>
                <button onClick={generatePlan} disabled={isGenerating} className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow transition ${isGenerating ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'}`}>{isGenerating ? 'プラン作成中...' : '✨ 最高のプランを作成！'}</button>
              </div>

              {plan && (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
                  <div className="bg-teal-600 text-white p-6 text-center relative">
                    <h2 className="text-2xl font-bold mb-2">{plan.title}</h2>
                    <p className="opacity-90 text-sm">{plan.concept}</p>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={savePlanToHistory} className="bg-white/20 text-white px-3 py-1.5 rounded-lg font-bold text-xs border border-white/50">💾 履歴</button>
                      <button onClick={savePDF} disabled={isSaving} className="bg-white text-teal-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow">{isSaving ? '...' : '📄 PDF'}</button>
                    </div>
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
                                  <h4 className="font-bold text-teal-800 flex items-center gap-2">{spot.name} {spot.url && <a href={spot.url} target="_blank" rel="noreferrer" className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200">🔗Link</a>}</h4>
                                  <div className="text-right flex flex-col items-end"><span className="text-xs bg-white border px-2 py-1 rounded text-gray-500 mb-1">{spot.cost}</span>{spot.distance && <span className="text-xs text-teal-600 font-bold">🚗 {spot.distance}</span>}</div>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{spot.desc}</p>
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
          {activeTab === 'history' && (
            <div className="space-y-4">
              {historyList.length === 0 && <p className="text-center text-gray-400 py-10">保存されたプランはありません</p>}
              {historyList.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:bg-teal-50 transition">
                  <div className="cursor-pointer flex-1" onClick={() => loadHistory(item)}>
                    <h3 className="font-bold text-gray-800">{item.title}</h3>
                    <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()} - {item.destination}</p>
                  </div>
                  <button onClick={() => deleteHistory(item.id)} className="text-gray-300 hover:text-red-500 p-2">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}