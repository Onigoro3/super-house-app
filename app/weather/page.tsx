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

  // 天気コードをアイコンに変換する関数
  const getWeatherIcon = (code: number) => {
    if (code === 0) return '☀'; // 快晴
    if (code === 1 || code === 2 || code === 3) return '⛅'; // 晴れ〜曇り
    if (code >= 45 && code <= 48) return '🌫'; // 霧
    if (code >= 51 && code <= 67) return '☔'; // 雨
    if (code >= 71 && code <= 77) return '⛄'; // 雪
    if (code >= 80 && code <= 82) return '☂'; // にわか雨
    if (code >= 95) return '⚡'; // 雷雨
    return '☁'; // その他
  };

  // 天気コードを言葉にする関数
  const getWeatherLabel = (code: number) => {
    if (code === 0) return '快晴';
    if (code <= 3) return '晴れ/曇り';
    if (code <= 48) return '霧';
    if (code <= 67) return '雨';
    if (code <= 77) return '雪';
    if (code <= 82) return 'にわか雨';
    if (code >= 95) return '雷雨';
    return '曇り';
  };

  // 緯度経度から天気を取得する関数 (Open-Meteo API)
  const fetchWeather = async (lat: number, lon: number, name: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await res.json();

      // 現在の天気
      setCurrentWeather(data.current_weather);

      // 週間予報の整形
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

  // 現在地を取得して天気を表示
  const handleCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報に対応していません');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeather(latitude, longitude, '現在地');
      },
      (error) => {
        alert('位置情報の取得に失敗しました。設定を確認してください。');
        // 失敗したらデフォルトで東京を表示
        fetchWeather(35.6895, 139.6917, '東京 (デフォルト)');
      }
    );
  };

  // 地名検索機能 (Open-Meteo Geocoding API)
  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      // 日本語の地名から緯度経度を検索
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchQuery}&count=1&language=ja&format=json`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        alert('場所が見つかりませんでした');
        setLoading(false);
        return;
      }

      const location = data.results[0];
      fetchWeather(location.latitude, location.longitude, location.name);
      setSearchQuery(''); // 入力欄をクリア
    } catch (error) {
      alert('検索に失敗しました');
      setLoading(false);
    }
  };

  // 初回起動時に現在地を取得
  useEffect(() => {
    handleCurrentLocation();
  }, []);

  return (
    <div className="min-h-screen bg-sky-100 flex flex-col text-gray-800">
      
      {/* ヘッダー */}
      <header className="bg-sky-500 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg font-bold text-sm transition">
            🔙 ホームへ
          </Link>
          <h1 className="text-xl font-bold">☀ お天気 <span className="text-xs font-normal opacity-80">by Open-Meteo</span></h1>
        </div>
      </header>

      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        
        {/* 検索エリア */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="地名で検索 (例: 大阪、京都)" 
              className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">🔍 検索</button>
          </div>
          <button onClick={handleCurrentLocation} className="text-sm text-sky-600 font-bold text-right hover:underline">📍 現在地に戻る</button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">読み込み中...</div>
        ) : (
          <>
            {/* 現在の天気カード */}
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

            {/* 週間予報リスト */}
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