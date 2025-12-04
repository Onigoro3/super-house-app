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
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  
  // 編集用
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [movingId, setMovingId] = useState<number | null>(null);
  const [newFolder, setNewFolder] = useState('');

  const fetchDocs = async () => {
    // データが重いのでfile_data以外を取得
    const { data } = await supabase.from('documents').select('id, title, folder_name, updated_at').order('updated_at', { ascending: false });
    if (data) setDocs(data);
  };

  useEffect(() => { fetchDocs(); }, []);

  // フォルダごとにグループ化
  const groupedDocs = docs.reduce((acc, doc) => {
    const folder = doc.folder_name || '未分類';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(doc);
    return acc;
  }, {} as Record<string, Doc[]>);

  const toggleFolder = (folder: string) => setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));

  // 操作ロジック
  const deleteDoc = async (id: number) => {
    if (!confirm('本当に削除しますか？\n復元できません。')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchDocs();
  };

  const saveRename = async (id: number) => {
    if (!editTitle.trim()) return;
    await supabase.from('documents').update({ title: editTitle }).eq('id', id);
    setEditingId(null);
    fetchDocs();
  };

  const saveMove = async (id: number) => {
    if (!newFolder.trim()) return;
    await supabase.from('documents').update({ folder_name: newFolder }).eq('id', id);
    setMovingId(null);
    fetchDocs();
  };

  return (
    <div className="p-4 space-y-8 pb-24">
      <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-100 text-center">
        <h2 className="text-2xl font-bold text-blue-800 mb-1">🗂️ 書類管理マネージャー</h2>
        <p className="text-sm text-gray-500">保存したPDFの整理・編集ができます</p>
      </div>

      <div className="space-y-4">
        {Object.keys(groupedDocs).length === 0 && <p className="text-center text-gray-400 py-10">保存された書類はありません</p>}

        {Object.entries(groupedDocs).map(([folder, folderDocs]) => (
          <div key={folder} className="border rounded-2xl overflow-hidden shadow-sm bg-white">
            {/* フォルダヘッダー */}
            <button 
              onClick={() => toggleFolder(folder)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <h3 className="font-bold text-lg text-gray-800">{folder}</h3>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{folderDocs.length}</span>
              </div>
              <span className={`text-2xl text-gray-400 transition ${openFolders[folder] ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* ファイルリスト */}
            {openFolders[folder] && (
              <div className="divide-y">
                {folderDocs.map(doc => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-blue-50 transition">
                    <div className="flex-1 mr-4">
                      {editingId === doc.id ? (
                        <div className="flex gap-2">
                          <input 
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            className="border p-1 rounded w-full text-black" 
                            autoFocus
                          />
                          <button onClick={() => saveRename(doc.id)} className="bg-blue-600 text-white px-2 rounded text-xs whitespace-nowrap">確定</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link href={`/pdf?id=${doc.id}`} className="font-bold text-gray-800 hover:text-blue-600 hover:underline truncate block">
                            📄 {doc.title}
                          </Link>
                          <button onClick={() => { setEditingId(doc.id); setEditTitle(doc.title); }} className="text-gray-400 hover:text-blue-500 text-xs">✏️</button>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(doc.updated_at).toLocaleString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {movingId === doc.id ? (
                        <div className="flex gap-1 items-center">
                          <input 
                            placeholder="移動先フォルダ" 
                            value={newFolder} 
                            onChange={e => setNewFolder(e.target.value)}
                            className="border p-1 rounded text-xs w-24 text-black"
                          />
                          <button onClick={() => saveMove(doc.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">移動</button>
                          <button onClick={() => setMovingId(null)} className="text-gray-400 text-xs">×</button>
                        </div>
                      ) : (
                        <button onClick={() => { setMovingId(doc.id); setNewFolder(folder); }} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">📂 移動</button>
                      )}
                      
                      <Link href={`/pdf?id=${doc.id}`} className="text-xs bg-blue-600 text-white px-3 py-2 rounded font-bold hover:bg-blue-700 shadow">
                        編集する
                      </Link>
                      
                      <button onClick={() => deleteDoc(doc.id)} className="text-gray-300 hover:text-red-500 text-xl px-2">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}