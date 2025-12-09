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
  
  const [view, setView] = useState<'title' | 'game'>('title');
  const [games, setGames] = useState<GameData[]>([]);
  const [currentGame, setCurrentGame] = useState<GameData | null>(null);

  // ゲーム内ステート
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState<GameStatus>({ hp: 100, inventory: [] });
  const [inputAction, setInputAction] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  
  // 編集用
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

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

  const startGame = async (genre: string) => {
    const title = prompt("物語のタイトルを決めてください", `${genre}の冒険`);
    if (!title) return;

    const initialLog: Log = { role: 'gm', text: `【${genre}】の物語が始まります...\nあなたは今、どのような状況ですか？（状況を自由に書くか、「おまかせ」と入力してください）` };
    
    const { data, error } = await supabase.from('adventure_games').insert([{
      title, genre, history: [initialLog], status: { hp: 100, inventory: [] }
    }]).select().single();

    if (!error && data) {
      await fetchGames(); // リスト更新
      loadGameData(data);
    }
  };

  const loadGameData = (game: GameData) => {
    setCurrentGame(game);
    setLogs(game.history || []);
    setStatus(game.status || { hp: 100, inventory: [] });
    setChoices([]);
    setView('game');
  };

  // ★削除機能
  const deleteGame = async (id: number) => {
    if (!confirm("本当にこの冒険の記録を消しますか？")) return;
    await supabase.from('adventure_games').delete().eq('id', id);
    fetchGames();
  };

  // ★リネーム機能
  const startEditing = (game: GameData) => {
    setEditingId(game.id);
    setEditTitle(game.title);
  };
  const saveTitle = async (id: number) => {
    if (!editTitle.trim()) return;
    await supabase.from('adventure_games').update({ title: editTitle }).eq('id', id);
    setEditingId(null);
    fetchGames();
  };

  const handleAction = async (actionText: string = inputAction) => {
    if (!actionText.trim() || !currentGame) return;
    
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
          history: newLogs,
          currentStatus: status
        }),
      });
      
      const data = await res.json();
      
      // レスポンス処理
      const gmText = data.text || "（応答がありませんでした）";
      const gmLog: Log = { role: 'gm', text: gmText };
      const updatedLogs = [...newLogs, gmLog];
      const newStatus = data.new_status || status;
      
      setLogs(updatedLogs);
      setStatus(newStatus);
      setChoices(data.choices || []);

      // オートセーブ
      await supabase.from('adventure_games').update({
        history: updatedLogs,
        status: newStatus,
        is_game_over: data.game_over || false
      }).eq('id', currentGame.id);
      
      if (data.game_over) {
        alert("物語が終了しました。タイトルへ戻ります。");
        setView('title');
        fetchGames();
      }
    } catch (e) {
      alert("通信エラーが発生しました。");
    } finally {
      setIsThinking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">LOADING...</div>;
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
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8">
          <div className="text-center space-y-4 mt-8">
            <h2 className="text-4xl font-bold animate-pulse">PRESS START</h2>
            <p className="text-green-700">Select Scenario to Begin</p>
          </div>

          {/* 新規作成ボタン */}
          <div className="w-full max-w-md grid grid-cols-2 gap-3">
            {['ファンタジー', 'SF・宇宙', 'ホラー・脱出', 'ミステリー', 'サバイバル', '異世界転生'].map(genre => (
              <button key={genre} onClick={() => startGame(genre)} className="border border-green-600 p-3 rounded hover:bg-green-900 transition text-left text-sm">
                ▶ {genre}
              </button>
            ))}
          </div>

          {/* ロード画面（履歴リスト） */}
          {games.length > 0 && (
            <div className="w-full max-w-md space-y-4 mt-4 pb-20">
              <h3 className="border-b border-green-800 pb-1 text-sm text-green-600">LOAD GAME</h3>
              <div className="space-y-2">
                {games.map(game => (
                  <div key={game.id} className="border border-green-900 p-3 rounded flex flex-col gap-2 hover:bg-green-900/20 transition cursor-pointer" onClick={() => loadGameData(game)}>
                    
                    {/* タイトル行 */}
                    <div className="flex justify-between items-center">
                      {editingId === game.id ? (
                        <div className="flex gap-2 w-full" onClick={e => e.stopPropagation()}>
                          <input 
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            className="bg-black border border-green-500 text-green-400 p-1 text-sm w-full"
                            autoFocus
                          />
                          <button onClick={() => saveTitle(game.id)} className="text-green-400 border border-green-500 px-2 text-xs">OK</button>
                        </div>
                      ) : (
                        <div className="font-bold text-lg text-green-300 truncate">{game.title}</div>
                      )}
                    </div>

                    {/* 情報行 */}
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-green-700">
                        {game.genre} | HP:{game.status?.hp} | {new Date(game.created_at).toLocaleDateString()}
                      </div>
                      
                      {/* 操作ボタン */}
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEditing(game)} className="text-xs text-gray-500 hover:text-green-400">RENAME</button>
                        <button onClick={() => deleteGame(game.id)} className="text-xs text-gray-500 hover:text-red-500">DELETE</button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ゲーム画面 --- */}
      {view === 'game' && currentGame && (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* ステータスバー */}
          <div className="bg-green-900/20 border-b border-green-800 p-2 flex justify-between items-center text-xs sm:text-sm px-4">
            <div className="flex gap-4">
              <span>HP: <span className={`font-bold ${status.hp < 30 ? 'text-red-500 animate-pulse' : 'text-green-300'}`}>{status.hp}</span></span>
            </div>
            <div className="flex gap-2 overflow-x-auto max-w-[60%] no-scrollbar">
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
                    ? 'bg-green-900/30 text-green-100 border border-green-700' 
                    : 'text-green-400'
                }`}>
                  {log.role === 'gm' && <span className="block text-[10px] text-green-800 mb-1">GAME MASTER</span>}
                  {log.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="text-green-800 animate-pulse pl-2">
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
                placeholder="行動を入力..."
                className="flex-1 bg-transparent border-none outline-none text-green-100 font-mono text-base placeholder-green-900"
                autoFocus
              />
              <button onClick={() => handleAction()} disabled={!inputAction.trim() || isThinking} className="bg-green-800 text-black px-4 rounded font-bold hover:bg-green-600 disabled:opacity-30">
                ENTER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}