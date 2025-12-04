// app/weather/RainRadar.tsx
'use client';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leafletのデフォルトアイコン対策
// (Next.jsでアイコンが消えるバグの修正)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Props = {
  lat: number;
  lon: number;
};

// 地図の中心を移動させるためのコンポーネント
function MapUpdater({ lat, lon }: { lat: number, lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 10); // ズームレベル10
  }, [lat, lon, map]);
  return null;
}

export default function RainRadar({ lat, lon }: Props) {
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // RainViewer APIから利用可能な時間を取得
  useEffect(() => {
    const fetchRadarData = async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await res.json();
        
        // 過去データ(past)と予報データ(forecast)を結合
        // data.radar.past は過去2時間分、data.radar.nowcast は未来30分分など
        const allTimestamps = [
            ...(data.radar?.past || []), 
            ...(data.radar?.nowcast || [])
        ].map((t: any) => t.time);

        setTimestamps(allTimestamps);
        
        // 現在時刻に一番近いインデックスを初期値にする
        const now = Math.floor(Date.now() / 1000);
        let closestIndex = 0;
        let minDiff = Infinity;
        
        allTimestamps.forEach((ts: number, i: number) => {
          const diff = Math.abs(ts - now);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        });
        
        setCurrentIndex(closestIndex);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchRadarData();
  }, []);

  // 時間フォーマット (15:30 などの表示)
  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // スライダー操作
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(Number(e.target.value));
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-gray-500">レーダー読み込み中...</div>;

  const currentTs = timestamps[currentIndex];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* コントローラー */}
      <div className="bg-white p-3 rounded-xl shadow-sm border flex flex-col gap-2">
        <div className="flex justify-between items-end">
            <span className="font-bold text-gray-700">☔ 雨雲レーダー</span>
            <span className="text-2xl font-mono font-bold text-blue-600">
                {currentTs ? formatTime(currentTs) : '--:--'}
            </span>
        </div>
        
        <input 
          type="range" 
          min="0" 
          max={timestamps.length - 1} 
          value={currentIndex} 
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
            <span>過去</span>
            <span>現在</span>
            <span>未来</span>
        </div>
      </div>

      {/* 地図本体 */}
      <div className="flex-1 rounded-xl overflow-hidden border shadow-sm relative z-0">
        <MapContainer 
          center={[lat, lon]} 
          zoom={10} 
          style={{ height: '100%', width: '100%' }}
        >
          {/* 背景地図 (OpenStreetMap) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* 雨雲レイヤー (RainViewer) */}
          {currentTs && (
            <TileLayer
              key={currentTs} // keyを変えることで再描画させる
              url={`https://tile.cache.rainviewer.com/v2/radar/${currentTs}/256/{z}/{x}/{y}/2/1_1.png`}
              opacity={0.6}
              zIndex={10}
            />
          )}

          <MapUpdater lat={lat} lon={lon} />
        </MapContainer>
      </div>
    </div>
  );
}