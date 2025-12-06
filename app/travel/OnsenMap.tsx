// app/travel/OnsenMap.tsx
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

// 温泉アイコン（赤色）
const onsenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type OnsenSpot = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  hours: string;
  fee: string;
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function OnsenMap() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [onsens, setOnsens] = useState<OnsenSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      alert('位置情報が使えません');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        fetchOnsens(latitude, longitude);
      },
      (err) => {
        // 取得失敗時は東京駅周辺
        setCenter([35.6812, 139.7671]);
        fetchOnsens(35.6812, 139.7671);
      }
    );
  }, []);

  // Overpass APIを使って周辺の温泉を徹底的に検索
  const fetchOnsens = async (lat: number, lon: number) => {
    try {
      // 半径5km以内。node(点), way(建物), relation(施設) 全てを対象にする
      // public_bath, hot_spring, spa, water_park などを網羅
      const query = `
        [out:json];
        (
          node["natural"="hot_spring"](around:5000, ${lat}, ${lon});
          way["natural"="hot_spring"](around:5000, ${lat}, ${lon});
          
          node["amenity"="public_bath"](around:5000, ${lat}, ${lon});
          way["amenity"="public_bath"](around:5000, ${lat}, ${lon});
          
          node["leisure"="water_park"](around:5000, ${lat}, ${lon});
          way["leisure"="water_park"](around:5000, ${lat}, ${lon});

          node["tourism"="spa"](around:5000, ${lat}, ${lon});
          way["tourism"="spa"](around:5000, ${lat}, ${lon});
        );
        out center;
      `;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();

      const spots = data.elements.map((el: any) => {
        // way/relationの場合はcenter座標を使う
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        
        // 情報の取得
        const tags = el.tags || {};
        const name = tags.name || tags['name:ja'] || tags['name:en'] || '入浴施設';
        const hours = tags.opening_hours || '不明';
        const fee = tags.fee || tags.charge || tags.cost || '不明';

        return { id: el.id, lat, lon, name, hours, fee };
      }).filter((s: any) => s.lat && s.lon); // 座標が取れなかったデータは除外

      // 重複削除（同じ場所で点と建物が重複している場合など）
      const uniqueSpots = spots.filter((v: OnsenSpot, i: number, a: OnsenSpot[]) => 
        a.findIndex(t => (t.name === v.name && Math.abs(t.lat - v.lat) < 0.001)) === i
      );

      setOnsens(uniqueSpots);
    } catch (e) {
      console.error(e);
      alert('温泉データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500">現在地から温泉を探しています...</div>;
  if (!center) return <div className="h-full flex items-center justify-center text-red-500">位置情報が必要です</div>;

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        
        {/* Googleマップのタイルを使用 */}
        <TileLayer
          attribution='© Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        
        <MapUpdater center={center} />

        {/* 現在地マーカー */}
        <Marker position={center}>
          <Popup>現在地</Popup>
        </Marker>

        {/* 温泉マーカー */}
        {onsens.map((onsen) => (
          <Marker key={onsen.id} position={[onsen.lat, onsen.lon]} icon={onsenIcon}>
            <Popup>
              <div className="text-center p-2 min-w-[150px]">
                <h3 className="font-bold text-base mb-2 text-gray-800 border-b pb-1">{onsen.name}</h3>
                
                <div className="text-left text-xs text-gray-600 mb-3 space-y-1">
                  <p>🕒 営業: {onsen.hours}</p>
                  <p>💰 料金: {onsen.fee}</p>
                </div>

                <a 
                  href={`https://www.google.com/maps/dir/?api=1&origin=${onsen.lat},${onsen.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-green-600 text-white font-bold text-sm px-4 py-2 rounded-lg shadow hover:bg-green-700 block text-center no-underline"
                >
                  🚗 ナビ開始
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-100">
        <p className="text-xs font-bold text-gray-600">半径5km以内の温泉</p>
        <p className="text-xl font-bold text-red-500 text-center">{onsens.length}<span className="text-xs text-gray-400 ml-1">件</span></p>
      </div>
    </div>
  );
}