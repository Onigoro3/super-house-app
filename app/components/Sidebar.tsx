// app/components/Sidebar.tsx
'use client';

// ★変更点1: 'home' を型定義に追加
type ViewType = 'food' | 'seasoning' | 'other' | 'menu' | 'money' | 'youtube' | 'youtube_recipes' | 'ai_recipes' | 'glossary' | 'calendar';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
};

export default function Sidebar({ isOpen, onClose, currentView, onChangeView }: Props) {
  // ★変更点2: 'home' 用のボタンを一番上に追加
  // idの型を少し緩めて 'home' も許容するようにしています
  const menuItems: { id: ViewType | 'home'; label: string; icon: string }[] = [
    { id: 'home', label: 'ホーム画面へ', icon: '🔙' }, // ★ここを追加！
    { id: 'calendar', label: '献立カレンダー', icon: '📅' },
    { id: 'food', label: '食材の在庫', icon: '🍎' },
    { id: 'seasoning', label: '調味料の在庫', icon: '🧂' },
    { id: 'other', label: '日用品の在庫', icon: '🧻' },
    { id: 'menu', label: '献立・レシピ', icon: '👨‍🍳' },
    { id: 'youtube_recipes', label: 'YouTubeレシピ帳', icon: '📺' },
    { id: 'ai_recipes', label: 'AI献立レシピ帳', icon: '🤖' },
    { id: 'youtube', label: '動画分析', icon: '📹' },
    { id: 'glossary', label: '料理用語じてん', icon: '📚' },
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
            onClick={() => {
              // ★変更点3: 'home' の場合だけ特別な動き（ページ移動）をさせる
              if (item.id === 'home') {
                window.location.href = '/'; // トップページ（ランチャー）へ戻る
              } else {
                // それ以外はいつもの画面切り替え
                onChangeView(item.id as ViewType);
                onClose();
              }
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${
              // 現在選択中のメニューなら色を変える（homeは選択状態にならないので除外）
              item.id !== 'home' && currentView === item.id 
                ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span><span className="text-base">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 text-xs text-center text-gray-400 border-t">v6.0 Launcher Support</div>
    </div>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={onClose} />}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <MenuContent />
      </div>
      <div className="hidden md:block w-64 h-screen sticky top-0 shadow-lg z-10">
        <MenuContent />
      </div>
    </>
  );
}