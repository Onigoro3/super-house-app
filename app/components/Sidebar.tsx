// app/components/Sidebar.tsx
'use client';

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money' | 'youtube' | 'recipebook';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
};

export default function Sidebar({ isOpen, onClose, currentView, onChangeView }: Props) {
  const menuItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'food', label: '食材の在庫', icon: '🍎' },
    { id: 'seasoning', label: '調味料の在庫', icon: '🧂' },
    { id: 'other', label: '日用品の在庫', icon: '🧻' },
    { id: 'menu', label: '献立・レシピ', icon: '👨‍🍳' },
    { id: 'recipebook', label: '保存レシピ帳', icon: '📖' },
    { id: 'youtube', label: '動画分析', icon: '📺' },
    { id: 'money', label: '資産管理', icon: '💰' },
  ];

  const MenuContent = () => (
    <div className="h-full flex flex-col bg-white border-r">
      <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white md:bg-white md:text-indigo-600">
        <h2 className="font-bold text-xl md:text-2xl">Super House</h2>
        <button onClick={onClose} className="text-2xl md:hidden">✕</button>
      </div>
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { onChangeView(item.id); onClose(); }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${currentView === item.id ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <span className="text-xl">{item.icon}</span><span className="text-base">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 text-xs text-center text-gray-400 border-t">v2.5 PC/Mobile</div>
    </div>
  );

  return (
    <>
      {/* スマホ用オーバーレイ（黒い膜） */}
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={onClose} />}
      
      {/* スマホ用サイドバー（スライド式） */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <MenuContent />
      </div>

      {/* PC用サイドバー（常時表示） */}
      <div className="hidden md:block w-64 h-screen sticky top-0 shadow-lg z-10">
        <MenuContent />
      </div>
    </>
  );
}