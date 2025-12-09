// app/spreadsheet/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Auth from '../components/Auth';

export default function SpreadsheetApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // データ（2次元配列）
  const [data, setData] = useState<string[][]>([
    ['品名', '数量', '単価', '合計'],
    ['りんご', '2', '100', '200'],
    ['みかん', '5', '50', '250'],
    ['', '', '', ''],
    ['合計', '', '', '450']
  ]);
  
  const [fileName, setFileName] = useState('無題のシート');
  const [selectedCell, setSelectedCell] = useState<{r:number, c:number} | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setLoading(false); 
    });
  }, []);

  // --- ファイル操作 ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // 配列として読み込み（ヘッダーなしで生データとして扱う）
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
      
      // 空のセルを空文字で埋める処理
      const formattedData = json.map(row => row.map(cell => cell !== undefined ? String(cell) : ""));
      
      setData(formattedData);
      setFileName(file.name.replace(/\.[^/.]+$/, "")); // 拡張子除去
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // リセット
  };

  const saveFile = async (type: 'xlsx' | 'csv' | 'cloud') => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    if (type === 'cloud') {
      // クラウド保存（Excel形式でBase64化）
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const { error } = await supabase.from('documents').insert([{
        title: `${fileName}.xlsx`,
        folder_name: '表計算',
        file_data: wbout
      }]);
      if (error) alert('保存に失敗しました');
      else alert('「書類管理」に保存しました！');
    } else {
      // ローカルダウンロード
      XLSX.writeFile(wb, `${fileName}.${type}`);
    }
  };

  // --- 編集操作 ---
  const updateCell = (row: number, col: number, value: string) => {
    const newData = [...data];
    newData[row][col] = value;
    setData(newData);
  };

  const addRow = () => {
    const cols = data[0]?.length || 1;
    setData([...data, Array(cols).fill('')]);
  };
  
  const addCol = () => {
    setData(data.map(row => [...row, '']));
  };

  const clearSheet = () => {
    if(confirm("シートをクリアしますか？")) {
      setData([['', '', '', ''], ['', '', '', '']]);
      setFileName('新規シート');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-green-50">Loading...</div>;
  if (!session) return <Auth onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-green-50 flex flex-col h-screen text-gray-800">
      
      {/* ヘッダー */}
      <header className="bg-green-600 text-white p-3 shadow-md flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-green-700 hover:bg-green-800 px-3 py-1 rounded-lg font-bold text-xs transition">🔙 ホーム</Link>
          <h1 className="text-xl font-bold">📊 表計算エディタ</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => saveFile('cloud')} className="text-xs bg-white text-green-700 px-3 py-1.5 rounded font-bold shadow hover:bg-green-100">☁ 保存</button>
           <button onClick={() => saveFile('xlsx')} className="text-xs bg-green-800 px-3 py-1.5 rounded hover:bg-green-900">Excel DL</button>
           <button onClick={() => saveFile('csv')} className="text-xs bg-green-800 px-3 py-1.5 rounded hover:bg-green-900">CSV DL</button>
        </div>
      </header>

      {/* ツールバー */}
      <div className="bg-white border-b p-2 flex gap-4 items-center shadow-sm overflow-x-auto shrink-0">
        <label className="flex items-center gap-1 cursor-pointer bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200 text-sm font-bold">
          📂 開く
          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
        </label>
        
        <input 
          value={fileName} 
          onChange={e => setFileName(e.target.value)} 
          className="border-b border-gray-300 focus:border-green-500 outline-none px-2 py-1 font-bold text-center w-40"
        />

        <div className="flex gap-1">
          <button onClick={addRow} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">+行</button>
          <button onClick={addCol} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">+列</button>
          <button onClick={clearSheet} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 ml-2">クリア</button>
        </div>
      </div>

      {/* スプレッドシート本体 */}
      <div className="flex-1 overflow-auto bg-gray-200 p-1">
        <div className="bg-white shadow-lg inline-block min-w-full">
          <table className="border-collapse w-full">
            <tbody>
              {/* 行番号とセル */}
              {data.map((row, rIndex) => (
                <tr key={rIndex}>
                  {/* 行ヘッダー */}
                  <td className="bg-gray-100 border border-gray-300 text-center text-xs text-gray-500 w-8 select-none">
                    {rIndex + 1}
                  </td>
                  
                  {/* データセル */}
                  {row.map((cell, cIndex) => (
                    <td key={cIndex} className="border border-gray-200 p-0 min-w-[80px]">
                      <input
                        value={cell}
                        onChange={(e) => updateCell(rIndex, cIndex, e.target.value)}
                        className={`w-full h-full p-2 outline-none focus:bg-green-50 focus:ring-2 focus:ring-green-400 focus:z-10 relative ${rIndex===0 ? 'font-bold bg-gray-50 text-center' : ''}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* 追加ボタンエリア */}
          <div className="flex">
             <button onClick={addRow} className="w-full py-2 bg-gray-50 text-gray-400 hover:bg-gray-100 text-xs border-t">＋ 行を追加</button>
          </div>
        </div>
      </div>
    </div>
  );
}