// app/components/DocumentManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Doc = {
  id: number;
  title: string;
  folder_name: string;
  updated_at: string;
};

export default function DocumentManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('すべて');
  const [folders, setFolders] = useState<string[]>([]);
  
  // 編集用ステート
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null);
  const [editFolderText, setEditFolderText] = useState('');

  const [movingDocId, setMovingDocId] = useState<number | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState('');

  // データ読み込み
  const fetchDocs = async () => {
    const { data } = await supabase.from('documents').select('id, title, folder_name, updated_at').order('updated_at', { ascending: false });
    if (data) {
      setDocs(data);
      // フォルダ一覧を抽出（重複排除）
      const uniqueFolders = Array.from(new Set(data.map(d => d.folder_name || '未分類'))).sort();
      // 固定フォルダを追加（空でも表示したい場合）
      const defaultFolders = ['PDF編集', 'AI献立', '未分類'];
      setFolders(Array.from(new Set([...defaultFolders, ...uniqueFolders])));
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  // --- フォルダ操作 ---
  
  // フォルダ名変更
  const renameFolder = async (oldName: string) => {
    if (!editFolderText.trim() || oldName === editFolderText) {
      setEditingFolderName(null);
      return;
    }
    if (confirm(`フォルダ「${oldName}」を「${editFolderText}」に変更しますか？`)) {
      await supabase.from('documents').update({ folder_name: editFolderText }).eq('folder_name', oldName);
      setEditingFolderName(null);
      if (selectedFolder === oldName) setSelectedFolder(editFolderText);
      fetchDocs();
    }
  };

  // フォルダ削除（中のファイルは未分類へ）
  const deleteFolder = async (folderName: string) => {
    if (confirm(`フォルダ「${folderName}」を削除しますか？\n（中のファイルは「未分類」に移動します）`)) {
      await supabase.from('documents').update({ folder_name: '未分類' }).eq('folder_name', folderName);
      if (selectedFolder === folderName) setSelectedFolder('すべて');
      fetchDocs();
    }
  };

  // --- ファイル操作 ---

  // ファイル削除
  const deleteDoc = async (id: number) => {
    if (!confirm('本当に削除しますか？\nこの操作は取り消せません。')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchDocs();
  };

  // ファイル名変更
  const saveDocRename = async (id: number) => {
    if (!editDocTitle.trim()) return;
    await supabase.from('documents').update({ title: editDocTitle }).eq('id', id);
    setEditingDocId(null);
    fetchDocs();
  };

  // フォルダ移動
  const moveDoc = async (id: number) => {
    if (!moveTargetFolder.trim()) return;
    await supabase.from('documents').update({ folder_name: moveTargetFolder }).eq('id', id);
    setMovingDocId(null);
    fetchDocs();
  };

  // 表示するドキュメントのフィルタリング
  const filteredDocs = selectedFolder === 'すべて' 
    ? docs 
    : docs.filter(d => (d.folder_name || '未分類') === selectedFolder);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-6">
      
      {/* 左サイドバー：フォルダ一覧 */}
      <div className="w-full md:w-64 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-blue-800 flex items-center gap-2">
            📂 フォルダ
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button 
            onClick={() => setSelectedFolder('すべて')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition ${selectedFolder === 'すべて' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            📦 すべての書類 ({docs.length})
          </button>
          
          <div className="border-t my-2"></div>

          {folders.map(folder => (
            <div key={folder} className={`group flex items-center justify-between rounded-lg transition ${selectedFolder === folder ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              {editingFolderName === folder ? (
                <div className="flex items-center flex-1 p-1">
                  <input 
                    value={editFolderText} 
                    onChange={e => setEditFolderText(e.target.value)}
                    className="w-full border rounded px-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => renameFolder(folder)} className="ml-1 text-green-600">✔</button>
                  <button onClick={() => setEditingFolderName(null)} className="ml-1 text-gray-400">×</button>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedFolder(folder)}
                  className={`flex-1 text-left px-3 py-2 text-sm truncate ${selectedFolder === folder ? 'text-blue-800 font-bold' : 'text-gray-700'}`}
                >
                  📁 {folder}
                </button>
              )}

              {/* フォルダ操作メニュー（ホバーで表示） */}
              <div className={`flex px-2 gap-1 ${editingFolderName === folder ? 'hidden' : 'opacity-0 group-hover:opacity-100 transition'}`}>
                <button onClick={() => { setEditingFolderName(folder); setEditFolderText(folder); }} className="text-gray-400 hover:text-blue-500 text-xs">✏️</button>
                <button onClick={() => deleteFolder(folder)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右メインエリア：ファイル一覧 */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-lg text-gray-800">
            {selectedFolder} の書類 ({filteredDocs.length})
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredDocs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p className="text-4xl mb-2">📭</p>
              <p>書類はありません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="border rounded-xl p-4 hover:shadow-md transition bg-white flex flex-col gap-3 relative group">
                  
                  {/* ファイルヘッダー */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-3xl">📄</span>
                      <div className="flex-1 min-w-0">
                        {editingDocId === doc.id ? (
                          <div className="flex gap-2">
                            <input 
                              value={editDocTitle} 
                              onChange={e => setEditDocTitle(e.target.value)} 
                              className="border rounded px-2 py-1 text-sm w-full font-bold"
                              autoFocus
                            />
                            <button onClick={() => saveDocRename(doc.id)} className="bg-blue-600 text-white px-2 rounded text-xs">OK</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Link href={`/pdf?id=${doc.id}`} className="font-bold text-gray-800 hover:text-blue-600 hover:underline truncate text-lg">
                              {doc.title}
                            </Link>
                            <button onClick={() => { setEditingDocId(doc.id); setEditDocTitle(doc.title); }} className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition">✏️</button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(doc.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* 操作フッター */}
                  <div className="flex items-center justify-between border-t pt-3 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{doc.folder_name || '未分類'}</span>
                      
                      {movingDocId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <select 
                            value={moveTargetFolder} 
                            onChange={e => setMoveTargetFolder(e.target.value)}
                            className="border rounded text-xs py-1 px-1 w-24"
                          >
                            <option value="">移動先...</option>
                            {folders.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <button onClick={() => moveDoc(doc.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">移動</button>
                          <button onClick={() => setMovingDocId(null)} className="text-gray-400 text-xs">×</button>
                        </div>
                      ) : (
                        <button onClick={() => setMovingDocId(doc.id)} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition">📂 移動</button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/pdf?id=${doc.id}`} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition">
                        編集
                      </Link>
                      <button onClick={() => deleteDoc(doc.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 px-2 rounded transition">
                        🗑️
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}