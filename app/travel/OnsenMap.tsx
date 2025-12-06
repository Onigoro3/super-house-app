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
  website?: string; // HP用
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function OnsenMap() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [onsens, setOnsens] = useState<OnsenSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(''); // 検索用

  // 現在地取得
  const handleCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      alert('位置情報が使えません');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        fetchOnsens(latitude, longitude);
      },
      (err) => {
        setCenter([35.6812, 139.7671]); // デフォルト東京
        fetchOnsens(35.6812, 139.7671);
      }
    );
  };

  useEffect(() => {
    handleCurrentLocation();
  }, []);

  // 場所検索機能
  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const q = searchQuery.replace(/　/g, ' ').trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();

      if (!data || data.length === 0) {
        alert('場所が見つかりませんでした');
        setLoading(false);
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      
      setCenter([lat, lon]);
      fetchOnsens(lat, lon); // 新しい場所で温泉検索
      setSearchQuery('');
      
    } catch (e) {
      alert('検索エラー');
      setLoading(false);
    }
  };

  const fetchOnsens = async (lat: number, lon: number) => {
    try {
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
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        const tags = el.tags || {};
        const name = tags.name || tags['name:ja'] || tags['name:en'] || '入浴施設';
        const hours = tags.opening_hours || '不明';
        const fee = tags.fee || tags.charge || tags.cost || '不明';
        const website = tags.website || tags['contact:website'] || tags.url; // URL取得

        return { id: el.id, lat, lon, name, hours, fee, website };
      }).filter((s: any) => s.lat && s.lon);

      const uniqueSpots = spots.filter((v: OnsenSpot, i: number, a: OnsenSpot[]) => 
        a.findIndex(t => (t.name === v.name && Math.abs(t.lat - v.lat) < 0.001)) === i
      );

      setOnsens(uniqueSpots);
    } catch (e) {
      console.error(e);
      alert('データ取得失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500">検索中...</div>;
  if (!center) return <div className="h-full flex items-center justify-center text-red-500">位置情報が必要です</div>;

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
      
      {/* ★検索バー (地図の上に配置) */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex gap-2">
        <input 
          type="text" 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          placeholder="場所検索 (例: 箱根、大阪駅)" 
          className="flex-1 p-2 rounded-lg border border-gray-300 shadow-sm outline-none text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} className="bg-blue-600 text-white px-3 rounded-lg shadow-sm font-bold text-sm">🔍</button>
        <button onClick={handleCurrentLocation} className="bg-white text-gray-600 px-3 rounded-lg shadow-sm font-bold text-xl border border-gray-300">📍</button>
      </div>

      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='© Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
        <MapUpdater center={center} />
        <Marker position={center}><Popup>中心地点</Popup></Marker>

        {onsens.map((onsen) => (
          <Marker key={onsen.id} position={[onsen.lat, onsen.lon]} icon={onsenIcon}>
            <Popup>
              <div className="text-center p-1 min-w-[180px]">
                <h3 className="font-bold text-base mb-2 text-gray-800 border-b pb-1">{onsen.name}</h3>
                
                <div className="text-left text-xs text-gray-600 mb-3 space-y-1">
                  <p>🕒 営業: {onsen.hours}</p>
                  <p>💰 料金: {onsen.fee}</p>
                </div>

                <div className="flex flex-col gap-2">
                  {/* ★ナビボタン */}
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&origin=${onsen.lat},${onsen.lon}`}
                    target="_blank" rel="noreferrer"
                    className="bg-green-600 text-white font-bold text-sm px-4 py-2 rounded-lg shadow hover:bg-green-700 block text-center no-underline"
                  >
                    🚗 ナビ開始
                  </a>
                  
                  {/* ★HPボタン (なければGoogle検索) */}
                  {onsen.website ? (
                    <a 
                      href={onsen.website}
                      target="_blank" rel="noreferrer"
                      className="bg-blue-500 text-white font-bold text-sm px-4 py-2 rounded-lg shadow hover:bg-blue-600 block text-center no-underline"
                    >
                      🌐 公式HPを見る
                    </a>
                  ) : (
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(onsen.name + " 温泉")}`}
                      target="_blank" rel="noreferrer"
                      className="bg-gray-100 text-gray-600 font-bold text-sm px-4 py-2 rounded-lg shadow hover:bg-gray-200 block text-center no-underline border border-gray-300"
                    >
                      🔍 Googleで検索
                    </a>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      <div className="absolute bottom-6 right-2 z-[1000] bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-100">
        <p className="text-xs font-bold text-gray-600">周辺の温泉</p>
        <p className="text-xl font-bold text-red-500 text-center">{onsens.length}<span className="text-xs text-gray-400 ml-1">件</span></p>
      </div>
    </div>
  );
}