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
        alert('位置情報の取得に失敗しました');
        setLoading(false);
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
        // 名前がない場合はタグから推測、それもなければ「温泉施設」
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
    <div className="h-full w-full relative">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              <div className="text-center">
                <p className="font-bold text-sm mb-2">{onsen.name}</p>
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${onsen.lat},${onsen.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded shadow block"
                >
                  Googleマップで行く
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      <div className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded shadow opacity-90 text-xs font-bold text-red-600">
        ♨️ 半径5km以内の温泉: {onsens.length}件
      </div>
    </div>
  );
}