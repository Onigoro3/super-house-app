// app/memo/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  created_at: string; // ★修正：ここを追加しました
};

export default function MemoApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  
  // UI制御
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // メニュー開閉
  const [saveStatus, setSaveStatus] = useState<string>('保存済み');

  // マップ用
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [isThinking, setIsThinking] = useState(false);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 初期化 & 自動オープン ---
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        // メモ一覧を取得
        const { data } = await supabase.from('memos').select('*').order('is_folder', { ascending: false }).order('created_at', { ascending: false });
        
        if (data) {
          setMemos(data);
          
          // 直近の「メモ（フォルダ以外）」を探す
          const recentMemo = data.find(m => !m.is_folder);
          
          if (recentMemo) {
            // 最新のメモがあればそれを開く
            openMemo(recentMemo);
          } else {
            // メモが1つもなければ、勝手に新規作成して開く
            await createInitialMemo();
          }
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  // データ再読み込み（リスト更新用）
  const fetchMemos = async () => {
    const { data } = await supabase.from('memos').select('*').order('is_folder', { ascending: false }).order('created_at', { ascending: false });
    if (data) setMemos(data);
  };

  // 初期化用の新規作成（タイトル入力なし）
  const createInitialMemo = async () => {
    const { data, error } = await supabase.from('memos').insert([{
      title: '新規メモ', is_folder: false, parent_id: null, content: '' 
    }]).select().single();
    
    if (!error && data) {
      await fetchMemos();
      openMemo(data);
    }
  };

  // 通常の新規作成（メニューから）
  const createItem = async (isFolder: boolean) => {
    let title = "新規メモ";
    if (isFolder) {
      const input = prompt("フォルダ名を入力");
      if (!input) return;
      title = input;
    }

    const { data, error } = await supabase.from('memos').insert([{
      title, 
      is_folder: isFolder, 
      parent_id: currentFolderId, 
      content: '' 
    }]).select().single();

    if (!error && data) {
      await fetchMemos();
      if (!isFolder) {
        openMemo(data);
        setIsSidebarOpen(false); // 作ったらメニューを閉じてエディタへ
      }
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from('memos').delete().eq('id', id);
    // もし今開いているメモを消したら、別のメモを開くか新規作成
    if (selectedMemo?.id === id) {
      const nextMemo = memos.find(m => !m.is_folder && m.id !== id);
      if (nextMemo) openMemo(nextMemo);
      else createInitialMemo();
    }
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
      // スマホ・PC問わずメニューを閉じる
      setIsSidebarOpen(false);
    }
  };

  // 自動保存＆タイトル更新
  const handleContentChange = (newContent: string) => {
    if (!selectedMemo) return;

    const firstLine = newContent.split('\n')[0].trim();
    const newTitle = firstLine.substring(0, 30) || '新規メモ';

    const updatedMemo = { ...selectedMemo, content: newContent, title: newTitle };
    setSelectedMemo(updatedMemo);
    
    // リスト側の表示用キャッシュ更新
    setMemos(prev => prev.map(m => m.id === selectedMemo.id ? { ...m, title: newTitle, content: newContent } : m));

    setSaveStatus('書き込み中...');

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('保存中...');
      const mapData = { nodes, edges };
      await supabase.from('memos').update({ 
        content: newContent,
        title: newTitle,
        map_data: mapData
      }).eq('id', selectedMemo.id);
      setSaveStatus('保存済み');
    }, 1000);
  };

  const generateMap = async () => {
    if (!selectedMemo?.content) return alert("本文がありません");
    setIsThinking(true); setViewMode('map');
    try {
      const res = await fetch('/api/mindmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: selectedMemo.content }) });
      const data = await res.json();
      if (data.nodes && data.edges) { 
        setNodes(data.nodes); setEdges(data.edges); 
        await supabase.from('memos').update({ map_data: data }).eq('id', selectedMemo.id);
      }
    } catch (e) { alert("図解生成失敗"); } finally { setIsThinking(false); }
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // 現在のフォルダの中身
  const currentList = memos.filter(m => m.parent_id === currentFolderId);
  const parentFolder = memos.find(m => m.id === currentFolderId);

  return (
    <div className="min-h-screen bg-white flex flex-col h-screen text-gray-800 relative">
      
      {/* ヘッダー */}
      <header className="bg-gray-900 text-white p-3 flex justify-between items-center shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* 三本線メニューボタン */}
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded hover:bg-gray-800">
            <div className="w-5 h-0.5 bg-white mb-1"></div>
            <div className="w-5 h-0.5 bg-white mb-1"></div>
            <div className="w-5 h-0.5 bg-white"></div>
          </button>
          <h1 className="font-bold text-lg truncate max-w-[200px]">
            {selectedMemo ? selectedMemo.title : 'Brain Note'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${saveStatus === '保存済み' ? 'text-gray-400' : 'text-yellow-400'}`}>{saveStatus}</span>
        </div>
      </header>

      {/* メインエリア（エディタ） */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {selectedMemo ? (
          <>
             {/* ツールバー */}
            <div className="border-b p-2 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex bg-white border rounded-lg overflow-hidden shadow-sm">
                <button onClick={() => setViewMode('text')} className={`px-4 py-2 text-sm font-bold ${viewMode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>テキスト</button>
                <button onClick={() => setViewMode('map')} className={`px-4 py-2 text-sm font-bold ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>ツリー図</button>
              </div>
              <button onClick={generateMap} disabled={isThinking} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-purple-700">
                {isThinking ? '思考中...' : '✨ AI図解'}
              </button>
            </div>

            <div className="flex-1 relative">
              <textarea
                className={`w-full h-full p-6 text-lg leading-relaxed resize-none outline-none ${viewMode === 'map' ? 'hidden' : 'block'}`}
                value={selectedMemo.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="ここに入力してください..."
                autoFocus
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
          <div className="flex-1 flex items-center justify-center">読み込み中...</div>
        )}
      </div>

      {/* サイドバー（スライドメニュー） */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="bg-black/50 flex-1" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="bg-white w-80 h-full shadow-2xl flex flex-col animate-slideInRight border-l">
            
            {/* サイドバーヘッダー */}
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Link href="/" className="bg-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-600">🔙 ホーム</Link>
                <span className="font-bold">メモ一覧</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-2xl">×</button>
            </div>

            {/* 操作エリア */}
            <div className="p-3 border-b bg-gray-50">
              <div className="flex gap-2 mb-3">
                <button onClick={() => createItem(false)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700">＋ メモ</button>
                <button onClick={() => createItem(true)} className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-yellow-600">＋ フォルダ</button>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1 font-bold px-1">
                <button onClick={() => setCurrentFolderId(null)} className="hover:underline text-indigo-600">TOP</button>
                {parentFolder && (
                  <>
                    <span>/</span>
                    <button onClick={() => setCurrentFolderId(parentFolder.parent_id)} className="hover:underline text-indigo-600">..</button>
                    <span>/</span>
                    <span className="text-gray-800 truncate max-w-[120px]">{parentFolder.title}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* リスト */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {currentList.length === 0 && <p className="text-xs text-center text-gray-400 mt-10">項目がありません</p>}
              {currentList.map(m => (
                <div 
                  key={m.id} 
                  className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition ${selectedMemo?.id === m.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-100 border border-transparent'}`} 
                  onClick={() => openMemo(m)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xl">{m.is_folder ? '📁' : '📝'}</span>
                    <div className="flex flex-col overflow-hidden">
                      <span className={`text-sm truncate ${m.is_folder ? 'font-bold text-gray-800' : 'text-gray-700'}`}>{m.title || '無題'}</span>
                      {!m.is_folder && <span className="text-[10px] text-gray-400 truncate">{new Date(m.created_at || '').toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteItem(m.id); }} className="text-gray-300 hover:text-red-500 p-2">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}