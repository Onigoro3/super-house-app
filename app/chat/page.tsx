// app/chat/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type Message = { id: number; role: 'user' | 'bot'; text: string; };

// キャラクター定義
const PERSONAS = [
  { id: 'butler', name: '執事', icon: '🤵', desc: '丁寧・厳格' },
  { id: 'maid', name: 'メイド', icon: '🎀', desc: '元気・献身' },
  { id: 'sister', name: 'お姉さん', icon: '👩', desc: 'タメ口・親切' },
  { id: 'grandpa', name: '博士', icon: '👴', desc: '博識・穏やか' },
  { id: 'kansai', name: 'オカン', icon: '🐯', desc: '関西弁・飴' },
];

export default function ChatApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  
  // ★現在のキャラクター
  const [currentPersona, setCurrentPersona] = useState(PERSONAS[0]);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.error("GPS Error", err)
      );
    }
    // 初期メッセージ
    setMessages([{ id: 1, role: 'bot', text: 'おかえりなさいませ。\n何かご用命はございますか？' }]);
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isThinking]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.text,
          location: location,
          persona: currentPersona.id // ★キャラIDを送る
        }),
      });
      const data = await res.json();
      const botMsg: Message = { id: Date.now() + 1, role: 'bot', text: data.reply || data.error };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: 'エラーが発生しました。' }]);
    } finally { setIsThinking(false); }
  };

  const changePersona = (personaId: string) => {
    const newPersona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];
    setCurrentPersona(newPersona);
    setShowPersonaMenu(false);
    // キャラ変更時の挨拶
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      role: 'bot', 
      text: `（${newPersona.name}に交代しました）\n${
        personaId === 'maid' ? 'お帰りなさいませ、ご主人様！' : 
        personaId === 'sister' ? 'やっほー！何かあった？' : 
        personaId === 'grandpa' ? 'フォッフォッフォ、何か聞きたいことでもあるかの？' : 
        personaId === 'kansai' ? 'はいはい、どないしたん？' : 
        '承知いたしました。'
      }` 
    }]);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      
      {/* ヘッダー */}
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-10 border-b border-gray-700 relative">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-sm transition">🔙</Link>
          {/* ★キャラ変更ボタン */}
          <button 
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg transition"
          >
            <span className="text-2xl">{currentPersona.icon}</span>
            <div>
              <h1 className="text-lg font-bold leading-none">{currentPersona.name} AI</h1>
              <span className="text-xs text-gray-400">タップして変更 ▼</span>
            </div>
          </button>
        </div>

        {/* ★キャラ選択メニュー */}
        {showPersonaMenu && (
          <div className="absolute top-full right-4 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-50 w-64 animate-fadeIn">
            <div className="p-2 text-xs text-gray-400 bg-gray-900">担当者を選択</div>
            {PERSONAS.map(p => (
              <button
                key={p.id}
                onClick={() => changePersona(p.id)}
                className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-700 transition ${currentPersona.id === p.id ? 'bg-indigo-900/50 border-l-4 border-indigo-500' : ''}`}
              >
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end gap-2'}`}>
            {/* AIアイコン表示 */}
            {msg.role === 'bot' && <span className="text-2xl mb-2">{currentPersona.icon}</span>}
            
            <div className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap shadow-md ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start items-center gap-2">
            <span className="text-2xl animate-bounce">{currentPersona.icon}</span>
            <div className="bg-gray-700 text-gray-400 p-3 rounded-2xl rounded-bl-none border border-gray-600 text-xs">
              考え中...
            </div>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendMessage()}
            placeholder={`${currentPersona.name}に話しかける...`}
            className="flex-1 p-3 rounded-xl bg-gray-900 border border-gray-600 text-white focus:outline-none focus:border-indigo-500"
          />
          <button onClick={sendMessage} disabled={!input.trim() || isThinking} className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition">
            送信
          </button>
        </div>
      </div>
    </div>
  );
}