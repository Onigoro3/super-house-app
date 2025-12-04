// app/chat/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type Message = {
  id: number;
  role: 'user' | 'bot';
  text: string;
};

export default function ChatApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'bot', text: 'おかえりなさいませ。\n天気や在庫のことなど、何なりとお聞きください。' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // ★追加: 位置情報
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    
    // ★追加: 起動時に位置情報を取得しておく
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => console.error("位置情報取得エラー", err)
      );
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

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
        // ★修正: メッセージと一緒に位置情報も送る
        body: JSON.stringify({ 
          message: userMsg.text,
          location: location 
        }),
      });
      
      const data = await res.json();
      
      const botMsg: Message = { id: Date.now() + 1, role: 'bot', text: data.reply || data.error };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: '申し訳ございません、通信エラーが発生いたしました。' }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-10 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホーム
          </Link>
          <h1 className="text-xl font-bold">🤵 執事AI <span className="text-xs font-normal opacity-70">Sebastian</span></h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-400 p-4 rounded-2xl rounded-bl-none border border-gray-600 animate-pulse">
              考え中...
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendMessage()}
            placeholder="執事に話しかける..."
            className="flex-1 p-3 rounded-xl bg-gray-900 border border-gray-600 text-white focus:outline-none focus:border-indigo-500"
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            送信
          </button>
        </div>
      </div>

    </div>
  );
}