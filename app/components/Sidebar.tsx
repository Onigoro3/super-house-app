'use client';

// すべての画面タイプを網羅した型定義
type ViewType = 
  | 'home' 
  | 'calendar' 
  | 'food' 
  | 'seasoning' 
  | 'other' 
  | 'menu' 
  | 'youtube_recipes' 
  | 'ai_recipes' 
  | 'youtube' 
  | 'documents' 
  | 'glossary' 
  | 'money';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
};

export default function Sidebar({ isOpen, onClose, currentView, onChangeView }: Props) {
  // メニュー項目の定義
  const menuItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'home', label: 'ホーム画面へ', icon: '🔙' },
    
    // 献立・カレンダー
    { id: 'calendar', label: '献立カレンダー', icon: '📅' },
    
    // 在庫管理
    { id: 'food', label: '食材の在庫', icon: '🍎' },
    { id: 'seasoning', label: '調味料の在庫', icon: '🧂' },
    { id: 'other', label: '日用品の在庫', icon: '🧻' },
    
    // 献立・レシピ
    { id: 'menu', label: '献立・レシピ', icon: '👨‍🍳' },
    { id: 'youtube_recipes', label: 'YouTubeレシピ帳', icon: '📺' },
    { id: 'ai_recipes', label: 'AI献立レシピ帳', icon: '🤖' },
    
    // ツール・便利機能
    { id: 'youtube', label: '動画分析', icon: '📹' },
    { id: 'documents', label: '書類管理', icon: '🗂️' }, // PDF管理ページへ
    { id: 'glossary', label: '料理用語じてん', icon: '📚' },
    
    // その他
    { id: 'money', label: '資産管理', icon: '💰' },
  ];

  const MenuContent = () => (
    <div className="h-full flex flex-col bg-white border-r">
      {/* ヘッダー部分 */}
      <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white md:bg-white md:text-indigo-600">
        <h2 className="font-bold text-xl md:text-2xl">AI献立アプリ</h2>
        <button onClick={onClose} className="text-2xl md:hidden">✕</button>
      </div>
      
      {/* メニューリスト */}
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'home') {
                // ホーム画面（ランチャー）へ移動
                window.location.href = '/';
              } else if (item.id === 'documents') {
                // 書類管理ページへ移動
                window.location.href = '/documents';
              } else if (window.location.pathname !== '/house') {
                // もし書類管理ページなど(/house以外)にいて、他のメニューを押した場合は
                // メインアプリ(/house)に戻ってそのビューを表示する仕組みが必要ですが、
                // 簡易的にメインページへリダイレクトします
                window.location.href = '/house'; 
              } else {
                // 通常の画面切り替え
                onChangeView(item.id as ViewType);
                onClose();
              }
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${
              currentView === item.id 
                ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-base">{item.label}</span>
          </button>
        ))}
      </nav>
      
      {/* フッター */}
      <div className="p-4 text-xs text-center text-gray-400 border-t">
        v7.0 Super House OS
      </div>
    </div>
  );

  return (
    <>
      {/* スマホ用オーバーレイ */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* スマホ用メニュー（スライドイン） */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <MenuContent />
      </div>

      {/* PC用メニュー（常時表示） */}
      <div className="hidden md:block w-64 h-screen sticky top-0 shadow-lg z-10">
        <MenuContent />
      </div>
    </>
  );
}