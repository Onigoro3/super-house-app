// app/components/Sidebar.tsx
'use client';

type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money';

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
    { id: 'money', label: '資産管理', icon: '💰' },
  ];

  return (
    <>
      {/* 背景の黒い膜（クリックで閉じる） */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* メニュー本体 */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b flex justify-between items-center bg-indigo-600 text-white">
          <h2 className="font-bold text-lg">メニュー</h2>
          <button onClick={onClose} className="text-2xl">✕</button>
        </div>
        
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChangeView(item.id);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${
                currentView === item.id 
                  ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 text-center text-xs text-gray-400 border-t">
          Super House App v2.0
        </div>
      </div>
    </>
  );
}