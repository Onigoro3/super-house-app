// app/components/DocumentManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// PDF表示用コンポーネントを動的読み込み
const PDFViewer = dynamic(() => import('../pdf/PDFViewer'), { 
  ssr: false,
  loading: () => <div className="p-4 text-center text-gray-500">PDF読み込み中...</div>
});

type Doc = {
  id: number;
  title: string;
  folder_name: string;
  updated_at: string;
  file_data: string;
};

export default function DocumentManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('すべて');
  const [folders, setFolders] = useState<string[]>([]);
  
  // 編集用ステート
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null);
  const [editFolderText, setEditFolderText] = useState('');

  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState('');

  // プレビュー用
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const fetchDocs = async () => {
    const { data } = await supabase.from('documents').select('*').order('updated_at', { ascending: false });
    if (data) {
      setDocs(data);
      const uniqueFolders = Array.from(new Set(data.map(d => d.folder_name || '未分類'))).sort();
      const defaultFolders = ['PDF編集', 'AI献立', 'YouTube献立', '未分類'];
      setFolders(Array.from(new Set([...defaultFolders, ...uniqueFolders])));
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  // プレビュー表示
  const openPreview = (doc: Doc) => {
    try {
      const byteCharacters = atob(doc.file_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const file = new File([blob], doc.title, { type: 'application/pdf' });
      
      setPreviewFile(file);
      setPreviewDoc(doc);
    } catch (e) {
      alert('ファイルの読み込みに失敗しました');
    }
  };

  // フォルダ操作
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

  const deleteFolder = async (folderName: string) => {
    if (confirm(`フォルダ「${folderName}」を削除しますか？\n（中のファイルは「未分類」に移動します）`)) {
      await supabase.from('documents').update({ folder_name: '未分類' }).eq('folder_name', folderName);
      if (selectedFolder === folderName) setSelectedFolder('すべて');
      fetchDocs();
    }
  };

  // ファイル操作
  const deleteDoc = async (id: number) => {
    if (!confirm('本当に削除しますか？')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchDocs();
    if (previewDoc?.id === id) setPreviewDoc(null);
  };

  const saveDocRename = async (id: number) => {
    if (!editTitle.trim()) return;
    await supabase.from('documents').update({ title: editTitle }).eq('id', id);
    setEditingId(null);
    fetchDocs();
  };

  const moveDoc = async (id: number) => {
    if (!moveTargetFolder.trim()) return;
    await supabase.from('documents').update({ folder_name: moveTargetFolder }).eq('id', id);
    setMovingId(null);
    fetchDocs();
  };

  const filteredDocs = selectedFolder === 'すべて' 
    ? docs 
    : docs.filter(d => (d.folder_name || '未分類') === selectedFolder);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-6">
      
      {/* 左サイドバー：フォルダ一覧 */}
      <div className="w-full md:w-64 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col shrink-0">
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-blue-800">📂 フォルダ</h3>
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

              <div className={`flex px-2 gap-1 ${editingFolderName === folder ? 'hidden' : 'opacity-0 group-hover:opacity-100 transition'}`}>
                <button onClick={() => { setEditingFolderName(folder); setEditFolderText(folder); }} className="text-gray-400 hover:text-blue-500 text-xs">✏️</button>
                <button onClick={() => deleteFolder(folder)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右メインエリア */}
      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
        
        {/* ファイル一覧 */}
        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col ${previewDoc ? 'h-1/3' : 'h-full'}`}>
          <div className="p-4 border-b bg-gray-50 flex justify-between">
            <h2 className="font-bold text-gray-800">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredDocs.map(doc => (
                  <div key={doc.id} className={`border rounded-lg p-3 hover:shadow transition bg-white flex flex-col gap-2 ${previewDoc?.id === doc.id ? 'ring-2 ring-blue-500' : ''}`}>
                    
                    {/* ファイル名ヘッダー */}
                    <div className="flex justify-between items-center">
                      {editingId === doc.id ? (
                        <div className="flex gap-2 flex-1">
                          <input 
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            className="border rounded px-1 text-sm w-full font-bold"
                            autoFocus
                          />
                          <button onClick={() => saveDocRename(doc.id)} className="text-xs bg-blue-500 text-white px-2 rounded">OK</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xl">📄</span>
                          <div className="font-bold text-gray-800 truncate cursor-pointer hover:text-blue-600" onClick={() => openPreview(doc)}>
                            {doc.title}
                          </div>
                          <button onClick={() => { setEditingId(doc.id); setEditTitle(doc.title); }} className="text-gray-300 hover:text-blue-500 text-xs ml-2">✏️</button>
                        </div>
                      )}
                    </div>

                    {/* 操作フッター */}
                    <div className="flex justify-between items-center text-xs mt-1 pt-2 border-t">
                      <div className="flex gap-2 items-center">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{doc.folder_name || '未分類'}</span>
                        
                        {movingId === doc.id ? (
                          <div className="flex gap-1">
                            <select 
                              value={moveTargetFolder} 
                              onChange={e => setMoveTargetFolder(e.target.value)}
                              className="border rounded w-24"
                            >
                              <option value="">移動先...</option>
                              {folders.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <button onClick={() => moveDoc(doc.id)} className="bg-green-500 text-white px-1 rounded">Go</button>
                            <button onClick={() => setMovingId(null)} className="text-gray-400">×</button>
                          </div>
                        ) : (
                          <button onClick={() => setMovingId(doc.id)} className="text-blue-500 hover:underline">移動</button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => openPreview(doc)} className="text-indigo-600 font-bold hover:underline">👁️ 表示</button>
                        <Link href={`/pdf?id=${doc.id}`} className="text-blue-600 hover:underline">編集</Link>
                        <button onClick={() => deleteDoc(doc.id)} className="text-red-400 hover:text-red-600 ml-1">🗑️</button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* プレビューエリア */}
        {previewDoc && previewFile && (
          <div className="flex-1 bg-gray-800 rounded-xl border shadow-lg overflow-hidden flex flex-col relative min-h-[300px]">
            <div className="bg-gray-900 text-white p-2 px-4 flex justify-between items-center">
              <span className="font-bold truncate">プレビュー: {previewDoc.title}</span>
              <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-white">✕ 閉じる</button>
            </div>
            <div className="flex-1 overflow-hidden relative bg-gray-500">
              <PDFViewer 
                file={previewFile} 
                zoom={100} 
                tool={null} setTool={() => {}} 
                pageNumber={1} 
                currentColor="#000000" currentSize={0} 
                currentFont="gothic.ttf" // ★ここを追加しました
                showGrid={false}
                onLoadSuccess={() => {}} 
                annotations={[]} setAnnotations={() => {}} 
                selectedId={null} setSelectedId={() => {}} 
                onHistoryPush={() => {}}
              />
              <Link href={`/pdf?id=${previewDoc.id}`} className="absolute bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-blue-700 z-50">
                📝 本格編集する
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}