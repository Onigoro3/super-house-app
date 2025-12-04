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
    { id: 1, role: 'bot', text: 'おかえりなさいませ。\n家の在庫やレシピのこと、何でもお聞きください。' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ログインチェック
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
  }, []);

  // メッセージ追加時に自動スクロール
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
        body: JSON.stringify({ message: userMsg.text }),
      });
      
      const data = await res.json();
      
      const botMsg: Message = { id: Date.now() + 1, role: 'bot', text: data.reply || data.error };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: '申し訳ございません、声が聞き取れませんでした（エラー）。' }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      
      {/* ヘッダー */}
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-10 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホーム
          </Link>
          <h1 className="text-xl font-bold">🤵 執事AI <span className="text-xs font-normal opacity-70">Sebastian</span></h1>
        </div>
      </header>

      {/* チャットエリア */}
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

      {/* 入力エリア */}
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