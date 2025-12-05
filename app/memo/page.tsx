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
};

export default function MemoApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  
  // 編集中のメモ（リアルタイム更新用）
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  
  // 保存状態の表示 ('保存済み', '保存中...', '変更あり')
  const [saveStatus, setSaveStatus] = useState<string>('保存済み');
  
  // マップ用
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [isThinking, setIsThinking] = useState(false);
  
  // 自動保存用タイマー
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // ★変更: メモ作成時はタイトルを聞かずに即作成
  const createItem = async (isFolder: boolean) => {
    let title = "新規メモ";
    if (isFolder) {
      const input = prompt("フォルダ名を入力");
      if (!input) return;
      title = input;
    }

    // 即座にDB登録
    const { data, error } = await supabase.from('memos').insert([{
      title, 
      is_folder: isFolder, 
      parent_id: currentFolderId, 
      content: '' 
    }]).select().single();

    if (!error && data) {
      await fetchMemos();
      // メモなら即座に開く
      if (!isFolder) openMemo(data);
    }
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
    }
  };

  // ★変更: 自動保存ロジック (テキスト変更時などに呼ばれる)
  const handleContentChange = (newContent: string) => {
    if (!selectedMemo) return;

    // 1行目をタイトルにする（最大30文字）
    const firstLine = newContent.split('\n')[0].trim();
    const newTitle = firstLine.substring(0, 30) || '無題のメモ';

    // ローカルステートを即更新（画面の反応を良くするため）
    const updatedMemo = { ...selectedMemo, content: newContent, title: newTitle };
    setSelectedMemo(updatedMemo);
    
    // リスト側の表示も更新（DB保存前だがUI反映）
    setMemos(prev => prev.map(m => m.id === selectedMemo.id ? { ...m, title: newTitle, content: newContent } : m));

    setSaveStatus('変更あり...');

    // デバウンス処理（最後の入力から1秒後に保存）
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('保存中...');
      
      const mapData = { nodes, edges }; // 最新のマップデータも一緒に保存
      
      await supabase.from('memos').update({ 
        content: newContent,
        title: newTitle,
        map_data: mapData
      }).eq('id', selectedMemo.id);
      
      setSaveStatus('保存済み');
      // fetchMemos(); // ここで再取得するとUIがチラつくのでしない
    }, 1000);
  };

  // マップ変更時も自動保存をトリガーしたい場合
  useEffect(() => {
    if (!selectedMemo) return;
    // ノードやエッジが変わったら保存タイマーをセット（内容は変えずマップだけ保存）
    // ※テキスト入力との競合を避けるため、ここは簡易的な自動保存のみ
    if (nodes.length > 0 || edges.length > 0) {
        // handleContentChangeを経由せず直接DB更新を予約しても良いが
        // ここでは簡易的に「手動保存」ボタンを残すか、テキスト入力時の保存に任せる運用とします
        // (マップ操作だけで自動保存させると頻度が高すぎるため)
    }
  }, [nodes, edges]);

  // 手動保存（強制保存用）
  const forceSave = async () => {
    if (!selectedMemo) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('保存中...');
    const mapData = { nodes, edges };
    await supabase.from('memos').update({ 
      content: selectedMemo.content,
      title: selectedMemo.title, 
      map_data: mapData
    }).eq('id', selectedMemo.id);
    setSaveStatus('保存済み');
  };

  const generateMap = async () => {
    if (!selectedMemo?.content) return alert("本文がありません");
    setIsThinking(true); setViewMode('map');
    try {
      const res = await fetch('/api/mindmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: selectedMemo.content }) });
      const data = await res.json();
      if (data.nodes && data.edges) { 
        setNodes(data.nodes); setEdges(data.edges); 
        // 保存
        await supabase.from('memos').update({ map_data: data }).eq('id', selectedMemo.id);
      }
    } catch (e) { alert("図解生成失敗"); } finally { setIsThinking(false); }
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  // --- サイドバー（スマホ対応） ---
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-50 text-gray-800 border-r">
      <div className="p-3 border-b bg-white shadow-sm">
        <div className="flex gap-2 mb-2">
          {/* ★ボタン: タイトル入力なしで即作成 */}
          <button onClick={() => createItem(false)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700">＋ メモ</button>
          <button onClick={() => createItem(true)} className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-yellow-600">＋ フォルダ</button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1 px-1">
          <button onClick={() => setCurrentFolderId(null)} className="hover:underline font-bold">🏠 TOP</button>
          {parentFolder && (
            <>
              <span>&gt;</span>
              <button onClick={() => setCurrentFolderId(parentFolder.parent_id)} className="hover:underline">..</button>
              <span>&gt;</span>
              <span className="font-bold text-gray-800 truncate max-w-[100px]">{parentFolder.title}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {currentList.length === 0 && <p className="text-xs text-center text-gray-400 mt-10">メモがありません</p>}
        {currentList.map(m => (
          <div 
            key={m.id} 
            className={`flex justify-between items-center p-3 rounded-xl cursor-pointer border transition ${selectedMemo?.id === m.id ? 'bg-blue-100 border-blue-300 shadow-inner' : 'bg-white border-gray-200 shadow-sm hover:bg-gray-50'}`} 
            onClick={() => openMemo(m)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-xl">{m.is_folder ? '📁' : '📝'}</span>
              <span className={`text-sm truncate ${m.is_folder ? 'font-bold' : ''}`}>{m.title || '無題'}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteItem(m.id); }} className="text-gray-300 hover:text-red-500 p-2 text-xs">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen text-gray-800">
      
      <header className="bg-gray-900 text-white p-3 flex justify-between items-center shadow-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          {/* スマホ用メニューボタン（ハンバーガー） - サイドバー表示状態を管理するstateが必要ですが、今回はPCレイアウト優先でシンプルに */}
           <Link href="/" className="bg-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-600">🔙 ホーム</Link>
           <h1 className="font-bold text-sm md:text-lg">🧠 Brain Note</h1>
        </div>
        
        {/* 保存状態表示 */}
        {selectedMemo && (
           <span className={`text-xs ${saveStatus === '保存済み' ? 'text-gray-400' : 'text-yellow-400 animate-pulse'}`}>
             {saveStatus}
           </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* サイドバー (PC:常時, スマホ:簡易表示) */}
        <div className="w-64 hidden md:block h-full shrink-0">
          <SidebarContent />
        </div>
        {/* スマホはとりあえず全画面エディタにするか、上部に切り替えボタンを置くなどが一般的ですが、
            今回は左側20%をリスト、右側をエディタのような簡易分割、もしくはドロワー実装が必要です。
            既存コードを活かし、PCと同じく左側にリストを表示します（スマホでは狭くなります） */}
        <div className="w-24 md:hidden h-full shrink-0 border-r bg-white">
            {/* スマホ用簡易リスト表示（アイコンのみなど）も可能ですが、今回はSidebarContentをそのまま流用 */}
            <SidebarContent />
        </div>

        {/* メインエリア */}
        <div className="flex-1 flex flex-col bg-white relative overflow-hidden">
          {selectedMemo ? (
            <>
              {/* ツールバー */}
              <div className="border-b p-2 flex justify-between items-center bg-gray-50 shrink-0">
                {/* タイトルは自動更新なので入力欄は削除、代わりに表示のみ */}
                <div className="font-bold text-lg text-gray-800 truncate flex-1 px-2">
                  {selectedMemo.title}
                </div>

                <div className="flex gap-2 shrink-0">
                  <div className="bg-white border rounded flex overflow-hidden">
                    <button onClick={() => setViewMode('text')} className={`px-3 py-1 text-xs font-bold ${viewMode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>書く</button>
                    <button onClick={() => setViewMode('map')} className={`px-3 py-1 text-xs font-bold ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>図解</button>
                  </div>
                  <button onClick={generateMap} disabled={isThinking} className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-purple-700">
                    {isThinking ? '...' : '✨ AI図解'}
                  </button>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 relative overflow-hidden">
                {/* テキストモード */}
                <textarea
                  className={`w-full h-full p-6 md:p-10 outline-none resize-none text-gray-800 leading-relaxed text-base md:text-lg ${viewMode === 'map' ? 'hidden' : 'block'}`}
                  value={selectedMemo.content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="ここに入力... 1行目がタイトルになります"
                />

                {/* マップモード */}
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
              <p className="text-lg font-bold">メモを選択するか<br/>新しく作成してください</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}