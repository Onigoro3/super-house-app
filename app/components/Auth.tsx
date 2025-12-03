// app/components/Auth.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isSignUp) {
        // 新規登録
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        alert('登録確認メールを送りました！メール内のリンクをクリックしてください。');
      } else {
        // ログイン
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin(); // ログイン成功時の処理
      }
    } catch (error: any) {
      alert('エラー: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm border border-gray-200">
        <h1 className="text-3xl font-extrabold text-center mb-2 text-indigo-600">Super House App</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">家族のためのスマート在庫管理</p>
        
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
          {isSignUp ? '家族アカウント登録' : 'ログイン'}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email" 
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg text-black focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="example@mail.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">パスワード</label>
            <input
              type="password" 
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg text-black focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="6文字以上"
              required
            />
          </div>
          
          <button disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md">
            {loading ? '処理中...' : isSignUp ? '登録メールを送る' : 'ログインする'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-indigo-500 hover:underline font-medium"
          >
            {isSignUp ? '← ログインに戻る' : '初めての方はこちら（新規登録）'}
          </button>
        </div>
      </div>
    </div>
  );
}