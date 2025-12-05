// app/memo/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';
import { 
  ReactFlow, Background, Controls, MiniMap, 
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type Memo = {
  id: number;
  title: string;
  content: string;
  is_folder: boolean;
  parent_id: number | null;
  map_data: any;
};

export default function MemoApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  
  // UI制御
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // スマホ用メニュー

  // マップ用
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    fetchMemos();
  }, []);

  const fetchMemos = async () => {
    const { data } = await supabase.from('memos').select('*').order('is_folder', { ascending: false }).order('created_at', { ascending: false });
    if (data) setMemos(data);
  };

  const currentList = memos.filter(m => m.parent_id === currentFolderId);
  const parentFolder = memos.find(m => m.id === currentFolderId);

  const createItem = async (isFolder: boolean) => {
    const title = prompt(isFolder ? "フォルダ名を入力" : "メモのタイトルを入力");
    if (!title) return;
    const { error } = await supabase.from('memos').insert([{ title, is_folder: isFolder, parent_id: currentFolderId, content: '' }]);
    if (!error) fetchMemos();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from('memos').delete().eq('id', id);
    if (selectedMemo?.id === id) setSelectedMemo(null);
    fetchMemos();
  };

  const openMemo = (memo: Memo) => {
    if (memo.is_folder) {
      setCurrentFolderId(memo.id);
    } else {
      setSelectedMemo(memo);
      if (memo.map_data) { setNodes(memo.map_data.nodes || []); setEdges(memo.map_data.edges || []); } 
      else { setNodes([]); setEdges([]); }
      setViewMode('text');
      setIsSidebarOpen(false); // スマホならメニュー閉じる
    }
  };

  const saveMemo = async () => {
    if (!selectedMemo) return;
    const mapData = { nodes, edges };
    await supabase.from('memos').update({ content: selectedMemo.content, title: selectedMemo.title, map_data: mapData }).eq('id', selectedMemo.id);
    fetchMemos(); alert('保存しました');
  };

  const generateMap = async () => {
    if (!selectedMemo?.content) return alert("本文がありません");
    setIsThinking(true); setViewMode('map');
    try {
      const res = await fetch('/api/mindmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: selectedMemo.content }) });
      const data = await res.json();
      if (data.nodes && data.edges) { setNodes(data.nodes); setEdges(data.edges); await supabase.from('memos').update({ map_data: data }).eq('id', selectedMemo.id); }
    } catch (e) { alert("図解生成失敗"); } finally { setIsThinking(false); }
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // --- サイドバーの中身（共通コンポーネント） ---
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-50 text-gray-800">
      <div className="p-4 border-b bg-white shadow-sm">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
          📂 {parentFolder ? parentFolder.title : 'すべてのメモ'}
        </h2>
        
        {/* ナビゲーション */}
        <div className="flex gap-2 mb-3">
           {parentFolder && (
             <button onClick={() => setCurrentFolderId(parentFolder.parent_id)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold">
               ⬆ 上へ戻る
             </button>
           )}
           <button onClick={() => setCurrentFolderId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold">
             🏠 TOP
           </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => createItem(false)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700">＋ メモ</button>
          <button onClick={() => createItem(true)} className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-yellow-600">＋ フォルダ</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {currentList.length === 0 && <p className="text-sm text-center text-gray-400 mt-10">ここには何もありません</p>}
        {currentList.map(m => (
          <div 
            key={m.id} 
            className={`flex justify-between items-center p-3 rounded-xl cursor-pointer border shadow-sm transition active:scale-95 ${selectedMemo?.id === m.id ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-gray-200 hover:bg-gray-100'}`} 
            onClick={() => openMemo(m)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-2xl">{m.is_folder ? '📁' : '📝'}</span>
              <span className={`text-sm truncate ${m.is_folder ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{m.title}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteItem(m.id); }} className="text-gray-300 hover:text-red-500 p-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800 overflow-hidden">
      
      {/* ヘッダー */}
      <header className="bg-gray-900 text-white p-3 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded hover:bg-gray-800">
            <div className="w-5 h-0.5 bg-white mb-1"></div><div className="w-5 h-0.5 bg-white mb-1"></div><div className="w-5 h-0.5 bg-white"></div>
          </button>
          <Link href="/" className="bg-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-600">🔙 ホーム</Link>
          <h1 className="font-bold text-sm md:text-lg">🧠 Brain Note</h1>
        </div>
        {selectedMemo && (
           <div className="flex gap-2">
             <button onClick={saveMemo} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow">💾 保存</button>
           </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* PC用サイドバー (常時表示) */}
        <div className="hidden md:block w-72 border-r bg-gray-50 shrink-0">
          <SidebarContent />
        </div>

        {/* スマホ用サイドバー (スライドメニュー) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-30 flex md:hidden">
            <div className="bg-black/50 flex-1" onClick={() => setIsSidebarOpen(false)}></div>
            <div className="bg-white w-3/4 h-full shadow-2xl animate-slideInRight">
               <SidebarContent />
            </div>
          </div>
        )}

        {/* メインエリア */}
        <div className="flex-1 flex flex-col bg-white relative">
          {selectedMemo ? (
            <>
              {/* ツールバー */}
              <div className="border-b p-3 flex flex-wrap gap-2 justify-between items-center bg-gray-50 shadow-sm z-10">
                <input 
                  value={selectedMemo.title} 
                  onChange={e => setSelectedMemo({ ...selectedMemo, title: e.target.value })}
                  className="font-bold text-lg bg-transparent outline-none flex-1 min-w-0"
                />
                <div className="flex gap-2 shrink-0">
                  <div className="bg-white border rounded-lg flex overflow-hidden shadow-sm">
                    <button onClick={() => setViewMode('text')} className={`px-3 py-1.5 text-xs font-bold ${viewMode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-600'}`}>テキスト</button>
                    <button onClick={() => setViewMode('map')} className={`px-3 py-1.5 text-xs font-bold ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>ツリー図</button>
                  </div>
                  <button onClick={generateMap} disabled={isThinking} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-purple-700">
                    {isThinking ? '...' : '✨ AI図解'}
                  </button>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  className={`w-full h-full p-4 md:p-8 outline-none resize-none text-gray-800 leading-relaxed text-base md:text-lg ${viewMode === 'map' ? 'hidden' : 'block'}`}
                  value={selectedMemo.content}
                  onChange={e => setSelectedMemo({ ...selectedMemo, content: e.target.value })}
                  placeholder="ここにアイデアを入力..."
                />
                <div className={`w-full h-full bg-gray-50 ${viewMode === 'map' ? 'block' : 'hidden'}`}>
                  <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
                    <Background />
                    <Controls />
                    <MiniMap />
                  </ReactFlow>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-lg font-bold">メモを選択してください</p>
              <p className="text-sm mt-2 md:hidden">左上のメニューボタンから<br/>メモを開くか作成できます</p>
              <button onClick={() => setIsSidebarOpen(true)} className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg md:hidden">
                メニューを開く
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}