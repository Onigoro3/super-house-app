// app/travel/OnsenMap.tsx
'use client';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// アイコン設定（Leafletのバグ対策）
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
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14); // ★ズームレベルを14に変更（より詳細に）
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

  // Overpass APIを使って周辺の温泉を検索
  const fetchOnsens = async (lat: number, lon: number) => {
    try {
      // 半径5000m以内の hot_spring(温泉) と public_bath(銭湯) を検索
      const query = `
        [out:json];
        (
          node["natural"="hot_spring"](around:5000, ${lat}, ${lon});
          node["amenity"="public_bath"](around:5000, ${lat}, ${lon});
          node["leisure"="water_park"](around:5000, ${lat}, ${lon});
        );
        out body;
      `;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();

      const spots = data.elements.map((el: any) => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags.name || el.tags['name:ja'] || el.tags['name:en'] || '温泉施設',
      }));

      setOnsens(spots);
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
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        
        {/* ★ここを変更: Googleマップのタイルを使用 */}
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        
        <MapUpdater center={center} />

        {/* 現在地マーカー (青) */}
        <Marker position={center}>
          <Popup>現在地</Popup>
        </Marker>

        {/* 温泉マーカー (赤) */}
        {onsens.map((onsen) => (
          <Marker key={onsen.id} position={[onsen.lat, onsen.lon]} icon={onsenIcon}>
            <Popup>
              <div className="text-center p-1">
                <p className="font-bold text-sm mb-2 text-gray-800">{onsen.name}</p>
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&origin=${onsen.lat},${onsen.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded shadow block hover:bg-blue-700 no-underline"
                >
                  Googleマップでナビ開始
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