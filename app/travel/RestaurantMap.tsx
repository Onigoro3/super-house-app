// app/travel/RestaurantMap.tsx
'use client';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// アイコン設定
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 飲食店アイコン（オレンジ色）
const restIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type Spot = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  cuisine: string;
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 14); }, [center, map]);
  return null;
}

export default function RestaurantMap() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all'); // 選択中のカテゴリ

  useEffect(() => {
    if (!navigator.geolocation) { alert('位置情報不可'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        fetchSpots(latitude, longitude, 'all');
      },
      () => {
        setCenter([35.6812, 139.7671]);
        fetchSpots(35.6812, 139.7671, 'all');
      }
    );
  }, []);

  // ジャンル変更時に再検索
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (center) fetchSpots(center[0], center[1], newCat);
  };

  // Overpass APIで検索
  const fetchSpots = async (lat: number, lon: number, cat: string) => {
    setLoading(true);
    try {
      // カテゴリごとのクエリ作成
      let cuisineFilter = '';
      if (cat === 'japanese') cuisineFilter = '["cuisine"~"japanese|sushi|soba|udon|tempura|ramen"]'; // ラーメンも含める
      else if (cat === 'western') cuisineFilter = '["cuisine"~"western|burger|pizza|steak|french|american"]';
      else if (cat === 'italian') cuisineFilter = '["cuisine"~"italian|pasta|pizza"]';
      else if (cat === 'chinese') cuisineFilter = '["cuisine"="chinese"]';
      else if (cat === 'ramen') cuisineFilter = '["cuisine"="ramen"]';
      else if (cat === 'cafe') cuisineFilter = '["amenity"="cafe"]'; // カフェはamenityで検索

      // 基本クエリ（半径3km）
      // amenity=restaurant, fast_food, cafe を対象に
      let queryBody = '';
      if (cat === 'cafe') {
         queryBody = `
          node["amenity"="cafe"](around:3000, ${lat}, ${lon});
          way["amenity"="cafe"](around:3000, ${lat}, ${lon});
         `;
      } else {
         // 飲食店全体からcuisineで絞り込み
         // 指定なし(all)の場合は全レストラン
         const filter = cat === 'all' ? '' : cuisineFilter;
         queryBody = `
           node["amenity"="restaurant"]${filter}(around:3000, ${lat}, ${lon});
           way["amenity"="restaurant"]${filter}(around:3000, ${lat}, ${lon});
           node["amenity"="fast_food"]${filter}(around:3000, ${lat}, ${lon});
         `;
      }

      const query = `[out:json];(${queryBody});out center;`;
      
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();

      const foundSpots = data.elements.map((el: any) => {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        const tags = el.tags || {};
        const name = tags.name || tags['name:ja'] || '名称不明の店';
        const cuisine = tags.cuisine || '';
        return { id: el.id, lat, lon, name, cuisine };
      }).filter((s: any) => s.lat && s.lon);

      setSpots(foundSpots);
    } catch (e) {
      console.error(e);
      alert('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !center) return <div className="h-full flex items-center justify-center text-gray-500">現在地を取得中...</div>;
  if (!center) return <div className="h-full flex items-center justify-center text-red-500">位置情報が必要です</div>;

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
      
      {/* ★ジャンル選択ボタン (地図の上に配置) */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-wrap gap-2 pointer-events-none">
        {/* pointer-events-noneで下の地図操作を邪魔しないようにし、ボタンだけautoにする */}
        {[
          { id: 'all', label: '全て' },
          { id: 'japanese', label: '和食' },
          { id: 'western', label: '洋食' },
          { id: 'italian', label: 'パスタ' },
          { id: 'ramen', label: 'ラーメン' },
          { id: 'chinese', label: '中華' },
          { id: 'cafe', label: 'カフェ' },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => handleCategoryChange(btn.id)}
            className={`pointer-events-auto px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition ${
              category === btn.id ? 'bg-orange-500 text-white scale-105' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='© Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
        <MapUpdater center={center} />
        <Marker position={center}><Popup>現在地</Popup></Marker>

        {spots.map((spot) => (
          <Marker key={spot.id} position={[spot.lat, spot.lon]} icon={restIcon}>
            <Popup>
              <div className="text-center p-1 min-w-[150px]">
                <p className="font-bold text-sm mb-2 text-gray-800 border-b pb-1">{spot.name}</p>
                {spot.cuisine && <p className="text-xs text-gray-500 mb-2">ジャンル: {spot.cuisine}</p>}
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&origin=${spot.lat},${spot.lon}`}
                  target="_blank" rel="noreferrer"
                  className="bg-green-600 text-white font-bold text-sm px-4 py-2 rounded-lg shadow hover:bg-green-700 block text-center no-underline"
                >
                  🚗 ナビ開始
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {loading && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-[1000] bg-black/70 text-white px-4 py-2 rounded-full text-sm font-bold">
          検索中...
        </div>
      )}
      
      <div className="absolute bottom-6 right-2 z-[1000] bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-100">
        <p className="text-xs font-bold text-gray-600">周辺のお店</p>
        <p className="text-xl font-bold text-orange-500 text-center">{spots.length}<span className="text-xs text-gray-400 ml-1">件</span></p>
      </div>
    </div>
  );
}