// app/weather/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// 天気データの型定義
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

  // 天気コードをアイコンに変換
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

  // 緯度経度から天気を取得 (Open-Meteo API)
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

  // ★改良版：現在地取得（地名も取る）
  const handleCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報に対応していません');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // 逆ジオコーディング（緯度経度から住所名を特定）
        // 無料の BigDataCloud API を使用
        let displayLocation = '現在地';
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ja`
          );
          const data = await res.json();
          // 都道府県 + 市町村 を組み立てる
          const pref = data.principalSubdivision || '';
          const city = data.locality || data.city || '';
          if (pref || city) {
            displayLocation = `📍 ${pref} ${city}`;
          }
        } catch (e) {
          console.error("地名取得失敗", e);
        }

        fetchWeather(latitude, longitude, displayLocation);
      },
      (error) => {
        fetchWeather(35.6895, 139.6917, '東京 (デフォルト)');
      }
    );
  };

  // ★改良版：地名検索機能
  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);

    try {
      // 1. 入力テキストをきれいにする
      // 全角スペース、改行、タブを半角スペースに変換し、前後の空白を削除
      let cleanQuery = searchQuery.replace(/[\u3000\n\r\t]/g, ' ').trim();
      
      // 2. まずそのまま検索してみる
      let res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=1&language=ja&format=json`);
      let data = await res.json();

      // 3. ヒットしなければ、スペースで区切って「最後の単語（より詳細な地名）」で再トライ
      // 例：「大阪 堺市」でダメなら「堺市」で検索する
      if (!data.results || data.results.length === 0) {
        const parts = cleanQuery.split(' ');
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1]; // 一番後ろの単語
          res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lastPart)}&count=1&language=ja&format=json`);
          data = await res.json();
        }
      }

      if (!data.results || data.results.length === 0) {
        alert('場所が見つかりませんでした。\n「市町村名」だけで検索してみてください。');
        setLoading(false);
        return;
      }

      const location = data.results[0];
      // 日本の住所表記がある場合はそれを使う（admin1が都道府県）
      const displayName = `${location.admin1 || ''} ${location.name}`;
      
      fetchWeather(location.latitude, location.longitude, displayName);
      setSearchQuery(''); // 入力欄をクリア
      
    } catch (error) {
      alert('検索に失敗しました');
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
          <h1 className="text-xl font-bold">☀ お天気 <span className="text-xs font-normal opacity-80">Open-Meteo</span></h1>
        </div>
      </header>

      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              // 改行にも対応するためtextareaにしても良いが、enterキー検索の利便性を考えてinputのまま
              placeholder="地名 (例: 大阪 堺市)" 
              className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">🔍 検索</button>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-xs text-gray-400">※市町村名を入れると正確です</span>
             <button onClick={handleCurrentLocation} className="text-sm text-sky-600 font-bold hover:underline">📍 現在地に戻る</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">読み込み中...</div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-400 to-sky-300 p-6 rounded-2xl text-white shadow-lg text-center">
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