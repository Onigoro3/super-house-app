// app/memo/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Auth from '../components/Auth';
// ★修正: 型定義を追加インポート
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
  
  // ★修正: 型 <Node> と <Edge> を指定して初期化
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [isThinking, setIsThinking] = useState(false);

  // --- 初期化 ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    fetchMemos();
  }, []);

  const fetchMemos = async () => {
    const { data } = await supabase.from('memos').select('*').order('is_folder', { ascending: false }).order('created_at', { ascending: false });
    if (data) setMemos(data);
  };

  // --- フォルダ・メモ操作 ---
  const currentList = memos.filter(m => m.parent_id === currentFolderId);
  const parentFolder = memos.find(m => m.id === currentFolderId);

  const createItem = async (isFolder: boolean) => {
    const title = prompt(isFolder ? "フォルダ名を入力" : "メモのタイトルを入力");
    if (!title) return;
    const { error } = await supabase.from('memos').insert([{
      title, is_folder: isFolder, parent_id: currentFolderId, content: ''
    }]);
    if (!error) fetchMemos();
  };

  const deleteItem = async (id: number) => {
    if (!confirm("削除しますか？（フォルダの場合、中身も消えます）")) return;
    await supabase.from('memos').delete().eq('id', id);
    if (selectedMemo?.id === id) setSelectedMemo(null);
    fetchMemos();
  };

  // メモを開く
  const openMemo = (memo: Memo) => {
    if (memo.is_folder) {
      setCurrentFolderId(memo.id);
    } else {
      setSelectedMemo(memo);
      // 保存されたマップがあれば復元
      if (memo.map_data) {
        setNodes(memo.map_data.nodes || []);
        setEdges(memo.map_data.edges || []);
      } else {
        setNodes([]); setEdges([]);
      }
      setViewMode('text');
    }
  };

  // 保存
  const saveMemo = async () => {
    if (!selectedMemo) return;
    const mapData = { nodes, edges };
    await supabase.from('memos').update({ 
      content: selectedMemo.content,
      title: selectedMemo.title,
      map_data: mapData
    }).eq('id', selectedMemo.id);
    fetchMemos(); 
    alert('保存しました');
  };

  // AI図解生成
  const generateMap = async () => {
    if (!selectedMemo?.content) return alert("本文がありません");
    setIsThinking(true);
    setViewMode('map');

    try {
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedMemo.content })
      });
      const data = await res.json();
      
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        await supabase.from('memos').update({ map_data: data }).eq('id', selectedMemo.id);
      }
    } catch (e) { alert("図解生成に失敗しました"); }
    finally { setIsThinking(false); }
  };

  // ノード接続用（★修正: 引数の型指定）
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (loading) return <div>Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen">
      
      <header className="bg-gray-800 text-white p-3 flex items-center gap-4 shadow-md z-10">
        <Link href="/" className="bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600">🔙 ホーム</Link>
        <h1 className="font-bold text-lg">🧠 Brain Note <span className="text-xs opacity-70">最強のAIメモ帳</span></h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* 左サイドバー：ファイルツリー */}
        <div className="w-64 bg-white border-r flex flex-col shrink-0">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex gap-2 mb-2">
              <button onClick={() => createItem(false)} className="flex-1 bg-blue-600 text-white py-1 rounded text-sm font-bold hover:bg-blue-700">＋ メモ</button>
              <button onClick={() => createItem(true)} className="flex-1 bg-yellow-500 text-white py-1 rounded text-sm font-bold hover:bg-yellow-600">＋ フォルダ</button>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <button onClick={() => setCurrentFolderId(null)} className="hover:underline">TOP</button>
              {parentFolder && (
                <>
                  <span>&gt;</span>
                  <button onClick={() => setCurrentFolderId(parentFolder.parent_id)} className="hover:underline">.. (戻る)</button>
                  <span>&gt;</span>
                  <span className="font-bold text-gray-800 truncate max-w-[100px]">{parentFolder.title}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {currentList.length === 0 && <p className="text-xs text-center text-gray-400 mt-4">項目がありません</p>}
            {currentList.map(m => (
              <div key={m.id} className={`flex justify-between items-center p-2 rounded cursor-pointer group ${selectedMemo?.id === m.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`} onClick={() => openMemo(m)}>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-lg">{m.is_folder ? '📁' : '📝'}</span>
                  <span className={`text-sm truncate ${m.is_folder ? 'font-bold' : ''}`}>{m.title}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteItem(m.id); }} className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">🗑️</button>
              </div>
            ))}
          </div>
        </div>

        {/* メインエリア */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedMemo ? (
            <>
              {/* ツールバー */}
              <div className="border-b p-2 flex justify-between items-center bg-gray-50">
                <input 
                  value={selectedMemo.title} 
                  onChange={e => setSelectedMemo({ ...selectedMemo, title: e.target.value })}
                  className="font-bold text-lg bg-transparent outline-none w-1/3 text-black"
                />
                <div className="flex gap-2 items-center">
                  <div className="bg-white border rounded flex overflow-hidden">
                    <button onClick={() => setViewMode('text')} className={`px-4 py-1 text-sm font-bold ${viewMode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>テキスト</button>
                    <button onClick={() => setViewMode('map')} className={`px-4 py-1 text-sm font-bold ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>ツリー図</button>
                  </div>
                  <button onClick={generateMap} disabled={isThinking} className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-bold shadow hover:bg-purple-700">
                    {isThinking ? '思考中...' : '✨ AI図解'}
                  </button>
                  <button onClick={saveMemo} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold shadow hover:bg-green-700">💾 保存</button>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 relative overflow-hidden">
                {/* テキストモード */}
                <textarea
                  className={`w-full h-full p-8 outline-none resize-none text-gray-800 leading-relaxed text-lg ${viewMode === 'map' ? 'hidden' : 'block'}`}
                  value={selectedMemo.content}
                  onChange={e => setSelectedMemo({ ...selectedMemo, content: e.target.value })}
                  placeholder="ここにアイデアを入力..."
                />

                {/* マップモード (React Flow) */}
                <div className={`w-full h-full bg-gray-50 ${viewMode === 'map' ? 'block' : 'hidden'}`}>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                  >
                    <Background />
                    <Controls />
                    <MiniMap />
                  </ReactFlow>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              左のメニューからメモを選択してください
            </div>
          )}
        </div>

      </div>
    </div>
  );
}