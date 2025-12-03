// app/components/MoneyList.tsx
'use client';
import { useState, useEffect } from 'react';

type Sub = {
  id: number;
  name: string;
  price: number;
  date: string;
};

export default function MoneyList() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('super_house_money');
    if (saved) setSubs(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('super_house_money', JSON.stringify(subs));
  }, [subs]);

  const addSub = () => {
    if (!name || !price) return;
    const newSub: Sub = { id: Date.now(), name, price: parseInt(price), date: date || '-' };
    setSubs([...subs, newSub]);
    setName('');
    setPrice('');
    setDate('');
  };

  const deleteSub = (id: number) => {
    setSubs(subs.filter(s => s.id !== id));
  };

  const total = subs.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-2xl text-white shadow-lg text-center">
        <p className="text-sm opacity-90 mb-1">毎月の固定費・サブスク合計</p>
        <p className="text-4xl font-bold tracking-tight">¥{total.toLocaleString()}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">固定費の追加</h3>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="名称 (Netflix等)" className="border p-2 rounded text-black col-span-2" />
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="金額" className="border p-2 rounded text-black" />
          <input type="text" value={date} onChange={e => setDate(e.target.value)} placeholder="引落日 (例:25日)" className="border p-2 rounded text-black" />
        </div>
        <button onClick={addSub} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 shadow">
          登録する
        </button>
      </div>

      <div className="space-y-3">
        {subs.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500">
            <div>
              <p className="font-bold text-gray-800 text-lg">{item.name}</p>
              <p className="text-xs text-gray-500">支払日: {item.date}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-700 text-lg">¥{item.price.toLocaleString()}</span>
              <button onClick={() => deleteSub(item.id)} className="text-gray-300 hover:text-red-500 text-xl">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}