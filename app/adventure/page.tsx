// app/adventure/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';

type Log = { role: 'user' | 'gm'; text: string; };
type GameStatus = { hp: number; inventory: string[]; };
type GameData = { id: number; title: string; genre: string; history: Log[]; status: GameStatus; is_game_over: boolean; created_at: string; };

export default function AdventureApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'title' | 'game' | 'load'>('title');
  const [games, setGames] = useState<GameData[]>([]);
  const [currentGame, setCurrentGame] = useState<GameData | null>(null);

  // ゲーム内ステート
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState<GameStatus>({ hp: 100, inventory: [] });
  const [inputAction, setInputAction] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false); 
      if (session) fetchGames();
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, isThinking]);

  const fetchGames = async () => {
    const { data } = await supabase.from('adventure_games').select('*').order('created_at', { ascending: false });
    if (data) setGames(data);
  };

  // ゲーム開始（新規）
  const startGame = async (genre: string) => {
    const title = prompt("この冒険のタイトルを決めてください（例：洞窟の秘宝）", `${genre}の冒険`);
    if (!title) return;

    const initialLog: Log = { role: 'gm', text: `【${genre}】の物語が始まります...\nあなたは今、どのような状況にいますか？（最初の状況を自由に決めるか、「おまかせ」と入力してください）` };
    
    const { data, error } = await supabase.from('adventure_games').insert([{
      title, genre, history: [initialLog], status: { hp: 100, inventory: [] }
    }]).select().single();

    if (!error && data) {
      loadGameData(data);
    }
  };

  // ゲームロード
  const loadGameData = (game: GameData) => {
    setCurrentGame(game);
    setLogs(game.history);
    setStatus(game.status);
    setChoices([]);
    setView('game');
  };

  const deleteGame = async (id: number) => {
    if (!confirm("冒険の記録を消去しますか？")) return;
    await supabase.from('adventure_games').delete().eq('id', id);
    fetchGames();
  };

  // アクション送信
  const handleAction = async (actionText: string = inputAction) => {
    if (!actionText.trim() || !currentGame) return;
    
    // ユーザーの行動をログに追加
    const userLog: Log = { role: 'user', text: actionText };
    const newLogs = [...logs, userLog];
    setLogs(newLogs);
    setInputAction('');
    setChoices([]);
    setIsThinking(true);

    try {
      const res = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genre: currentGame.genre, 
          action: actionText, 
          history: newLogs.map(l => ({ role: l.role==='gm'?'model':'user', text: l.text })),
          currentStatus: status
        }),
      });
      
      const data = await res.json();
      
      if (data.text) {
        const gmLog: Log = { role: 'gm', text: data.text };
        const updatedLogs = [...newLogs, gmLog];
        const newStatus = data.new_status || status;
        
        setLogs(updatedLogs);
        setStatus(newStatus);
        setChoices(data.choices || []);

        // オートセーブ
        await supabase.from('adventure_games').update({
          history: updatedLogs,
          status: newStatus,
          is_game_over: data.game_over
        }).eq('id', currentGame.id);
        
        if (data.game_over) {
          alert("ゲームオーバー（またはクリア）です！\nタイトルに戻ります。");
          setView('title');
        }
      }
    } catch (e) {
      alert("通信エラー：ゲームマスターとの接続が切れました");
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">LOADING SYSTEM...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col h-screen overflow-hidden selection:bg-green-900 selection:text-white">
      
      {/* ヘッダー */}
      <header className="border-b border-green-800 p-4 flex justify-between items-center z-10 bg-black">
        <div className="flex items-center gap-4">
          <Link href="/" className="border border-green-700 px-3 py-1 rounded hover:bg-green-900 text-xs transition">EXIT</Link>
          <h1 className="text-xl font-bold tracking-widest text-shadow">AI TEXT ADVENTURE</h1>
        </div>
        {view === 'game' && <button onClick={() => { setView('title'); fetchGames(); }} className="text-xs border border-green-700 px-3 py-1 rounded hover:bg-green-900">SAVE & QUIT</button>}
      </header>

      {/* --- タイトル画面 --- */}
      {view === 'title' && (
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center gap-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold animate-pulse">PRESS START</h2>
            <p className="text-green-700">ver 1.0.0 / System All Green</p>
          </div>

          <div className="w-full max-w-md space-y-4">
            <h3 className="border-b border-green-800 pb-1 text-sm">NEW GAME - シナリオ選択</h3>
            <div className="grid grid-cols-2 gap-3">
              {['ファンタジー', 'SF・宇宙', 'ホラー・脱出', 'ミステリー', 'サバイバル', '異世界転生'].map(genre => (
                <button key={genre} onClick={() => startGame(genre)} className="border border-green-600 p-3 rounded hover:bg-green-900 transition text-left">
                  ▶ {genre}
                </button>
              ))}
            </div>
          </div>

          {games.length > 0 && (
            <div className="w-full max-w-md space-y-4 mt-4">
              <h3 className="border-b border-green-800 pb-1 text-sm">LOAD GAME - 冒険の記録</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {games.map(game => (
                  <div key={game.id} className="border border-green-900 p-3 rounded flex justify-between items-center hover:bg-green-900/30 transition cursor-pointer group" onClick={() => loadGameData(game)}>
                    <div>
                      <div className="font-bold text-lg">{game.title}</div>
                      <div className="text-xs text-green-700">{game.genre} | HP:{game.status?.hp} | {new Date(game.created_at).toLocaleDateString()}</div>
                    </div>
                    {game.is_game_over ? (
                      <span className="text-red-500 text-xs border border-red-900 px-2 py-1 rounded">END</span>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); deleteGame(game.id); }} className="text-green-800 hover:text-red-500 opacity-0 group-hover:opacity-100 p-2">DEL</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ゲーム画面 --- */}
      {view === 'game' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* ステータスバー */}
          <div className="bg-green-900/20 border-b border-green-800 p-2 flex justify-between items-center text-sm px-4">
            <div className="flex gap-4">
              <span>HP: <span className={`font-bold ${status.hp < 30 ? 'text-red-500 animate-pulse' : 'text-green-300'}`}>{status.hp}</span></span>
              <span>Lv: 1</span>
            </div>
            <div className="flex gap-2 overflow-x-auto max-w-[50%] no-scrollbar">
              <span className="text-green-700">ITEM:</span>
              {status.inventory.length === 0 ? <span className="text-green-800">なし</span> : status.inventory.map((item, i) => (
                <span key={i} className="border border-green-800 px-1 rounded text-xs">{item}</span>
              ))}
            </div>
          </div>

          {/* ログエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
            {logs.map((log, i) => (
              <div key={i} className={`flex flex-col ${log.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] p-3 rounded leading-relaxed whitespace-pre-wrap ${
                  log.role === 'user' 
                    ? 'bg-green-900/40 text-green-100 border border-green-700' 
                    : 'text-green-400'
                }`}>
                  {log.role === 'gm' && <span className="block text-xs text-green-800 mb-1">GAME MASTER</span>}
                  {log.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="text-green-800 animate-pulse">
                &gt; 計算中...
              </div>
            )}
          </div>

          {/* 入力エリア */}
          <div className="p-4 border-t border-green-800 bg-black z-20">
            {/* 選択肢ヒント */}
            {!isThinking && choices.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {choices.map((c, i) => (
                  <button key={i} onClick={() => setInputAction(c)} className="shrink-0 border border-green-600 px-3 py-1 rounded text-xs hover:bg-green-900 transition text-green-300">
                    {c}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <span className="text-green-500 py-3">&gt;</span>
              <input 
                type="text" 
                value={inputAction} 
                onChange={(e) => setInputAction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAction()}
                placeholder="どうする？（例：剣で攻撃、逃げる、話しかける）"
                className="flex-1 bg-transparent border-none outline-none text-green-100 font-mono text-lg placeholder-green-900"
                autoFocus
              />
              <button onClick={() => handleAction()} disabled={!inputAction.trim() || isThinking} className="bg-green-800 text-black px-6 rounded font-bold hover:bg-green-600 disabled:opacity-30">
                ENTER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}