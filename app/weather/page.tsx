// app/weather/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type DailyWeather = {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
};

export default function WeatherApp() {
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [weeklyWeather, setWeeklyWeather] = useState<DailyWeather[]>([]);
  const [locationName, setLocationName] = useState('現在地');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 天気アイコン変換
  const getWeatherIcon = (code: number) => {
    if (code === 0) return '☀';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫';
    if (code <= 67) return '☔';
    if (code <= 77) return '⛄';
    if (code <= 82) return '☂';
    if (code >= 95) return '⚡';
    return '☁';
  };

  const getWeatherLabel = (code: number) => {
    if (code === 0) return '快晴';
    if (code <= 3) return '晴れ/曇';
    if (code <= 48) return '霧';
    if (code <= 67) return '雨';
    if (code <= 77) return '雪';
    if (code <= 82) return 'にわか雨';
    if (code >= 95) return '雷雨';
    return '曇り';
  };

  // 天気データ取得 (Open-Meteo)
  const fetchWeather = async (lat: number, lon: number, name: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await res.json();

      setCurrentWeather(data.current_weather);

      const daily = data.daily;
      const formattedWeekly = daily.time.map((date: string, index: number) => ({
        date,
        maxTemp: daily.temperature_2m_max[index],
        minTemp: daily.temperature_2m_min[index],
        weatherCode: daily.weathercode[index],
      }));

      setWeeklyWeather(formattedWeekly);
      setLocationName(name);
    } catch (error) {
      alert('天気データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ★改良版：現在地取得（OpenStreetMapで住所特定）
  const handleCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      alert('位置情報が使えません');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // 逆ジオコーディング (OpenStreetMap Nominatim)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          const data = await res.json();
          
          // 住所を組み立てる (例: 大阪府 堺市)
          const addr = data.address;
          // 市町村 > 区 > 都道府県 の順で探す
          const city = addr.city || addr.town || addr.village || addr.ward || '';
          const state = addr.province || addr.state || '';
          
          const displayName = `📍 ${state} ${city} (現在地)`;
          fetchWeather(latitude, longitude, displayName);

        } catch (e) {
          // 失敗したら座標だけ表示
          fetchWeather(latitude, longitude, '📍 現在地');
        }
      },
      () => {
        fetchWeather(35.6895, 139.6917, '東京 (デフォルト)');
      }
    );
  };

  // ★最強版：地名検索 (OpenStreetMap Nominatim)
  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);

    try {
      // 全角スペースを半角に変換
      const q = searchQuery.replace(/　/g, ' ').trim();

      // OpenStreetMapで検索 (日本の住所に強い)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();

      if (!data || data.length === 0) {
        alert('場所が見つかりませんでした。\n「大阪市」や「堺市」のように入力してみてください。');
        setLoading(false);
        return;
      }

      const location = data[0];
      // 検索した通りの名前を表示（またはAPIから返ってきた名前）
      // data[0].display_name は長すぎるので、入力した名前をそのまま使うか、短縮して表示
      const displayName = `🔎 ${q}`; 
      
      fetchWeather(parseFloat(location.lat), parseFloat(location.lon), displayName);
      setSearchQuery('');
      
    } catch (error) {
      alert('検索エラーが発生しました');
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCurrentLocation();
  }, []);

  return (
    <div className="min-h-screen bg-sky-100 flex flex-col text-gray-800">
      <header className="bg-sky-500 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">☀ 天気予報</h1>
        </div>
      </header>

      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="地名 (例: 堺市 / 大阪 堺)" 
              className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">🔍 検索</button>
          </div>
          <div className="flex justify-end">
             <button onClick={handleCurrentLocation} className="text-sm text-sky-600 font-bold hover:underline flex items-center gap-1">
               📍 現在地に戻る
             </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">読み込み中...</div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-400 to-sky-300 p-6 rounded-2xl text-white shadow-lg text-center">
              {/* ここに地名が表示されます */}
              <h2 className="text-2xl font-bold mb-2">{locationName}</h2>
              {currentWeather && (
                <div>
                  <div className="text-6xl mb-2">{getWeatherIcon(currentWeather.weathercode)}</div>
                  <p className="text-xl font-bold mb-4">{getWeatherLabel(currentWeather.weathercode)}</p>
                  <div className="text-5xl font-bold tracking-tighter">{currentWeather.temperature}<span className="text-2xl">°C</span></div>
                  <p className="text-sm opacity-80 mt-2">風速: {currentWeather.windspeed} km/h</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h3 className="p-4 font-bold text-gray-700 border-b bg-gray-50">📅 週間予報</h3>
              <div className="divide-y">
                {weeklyWeather.map((day, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="w-24 text-sm font-bold text-gray-600">
                      {new Date(day.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-2xl">{getWeatherIcon(day.weatherCode)}</span>
                      <span className="text-sm text-gray-500">{getWeatherLabel(day.weatherCode)}</span>
                    </div>
                    <div className="flex gap-4 text-sm font-bold">
                      <span className="text-red-500">{day.maxTemp}°</span>
                      <span className="text-blue-500">{day.minTemp}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}