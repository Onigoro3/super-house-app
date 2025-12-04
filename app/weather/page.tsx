// app/weather/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// 3時間ごとのデータ型
type HourlyWeather = {
  time: string; // "12:00" など
  temp: number;
  code: number;
};

// 日次データ型（詳細を含む）
type DailyWeather = {
  dateStr: string; // 比較用 (YYYY-MM-DD)
  displayDate: string; // 表示用 (12/4 (木))
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  hourly: HourlyWeather[]; // ★3時間ごとのデータ
};

export default function WeatherApp() {
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [weeklyWeather, setWeeklyWeather] = useState<DailyWeather[]>([]);
  const [locationName, setLocationName] = useState('現在地');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ★開いている日付の管理 (日付文字列を入れる)
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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

  const fetchWeather = async (lat: number, lon: number, name: string) => {
    setLoading(true);
    setExpandedDate(null); // リセット
    try {
      // ★ hourlyパラメータを追加 (temperature_2m, weathercode)
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weathercode&timezone=auto`
      );
      const data = await res.json();

      setCurrentWeather(data.current_weather);

      // --- データ加工 ---
      const daily = data.daily;
      const hourly = data.hourly;

      const formattedWeekly: DailyWeather[] = daily.time.map((dateStr: string, index: number) => {
        // この日の3時間ごとのデータを抽出
        const dayHourlyData: HourlyWeather[] = [];
        
        // hourly.time は "2023-12-04T00:00" のような形式
        hourly.time.forEach((timeStr: string, hIndex: number) => {
          if (timeStr.startsWith(dateStr)) {
            const dateObj = new Date(timeStr);
            const hour = dateObj.getHours();
            
            // 3時間おき (0, 3, 6, 9, 12, 15, 18, 21) だけ採用
            if (hour % 3 === 0) {
              dayHourlyData.push({
                time: `${hour}:00`,
                temp: hourly.temperature_2m[hIndex],
                code: hourly.weathercode[hIndex],
              });
            }
          }
        });

        return {
          dateStr: dateStr,
          displayDate: new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }),
          maxTemp: daily.temperature_2m_max[index],
          minTemp: daily.temperature_2m_min[index],
          weatherCode: daily.weathercode[index],
          hourly: dayHourlyData,
        };
      });

      setWeeklyWeather(formattedWeekly);
      setLocationName(name);
    } catch (error) {
      alert('天気データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

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
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          const data = await res.json();
          const addr = data.address;
          const city = addr.city || addr.town || addr.village || addr.ward || '';
          const state = addr.province || addr.state || '';
          const displayName = `📍 ${state} ${city} (現在地)`;
          fetchWeather(latitude, longitude, displayName);
        } catch (e) {
          fetchWeather(latitude, longitude, '📍 現在地');
        }
      },
      () => { fetchWeather(35.6895, 139.6917, '東京 (デフォルト)'); }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const q = searchQuery.replace(/　/g, ' ').trim();
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();

      if (!data || data.length === 0) {
        alert('場所が見つかりませんでした。');
        setLoading(false);
        return;
      }
      const location = data[0];
      const displayName = `🔎 ${q}`; 
      fetchWeather(parseFloat(location.lat), parseFloat(location.lon), displayName);
      setSearchQuery('');
    } catch (error) { alert('検索エラー'); setLoading(false); }
  };

  useEffect(() => { handleCurrentLocation(); }, []);

  // 日付タップ時の処理
  const toggleExpand = (dateStr: string) => {
    if (expandedDate === dateStr) {
      setExpandedDate(null); // 閉じる
    } else {
      setExpandedDate(dateStr); // 開く
    }
  };

  return (
    <div className="min-h-screen bg-sky-100 flex flex-col text-gray-800">
      <header className="bg-sky-500 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg font-bold text-sm transition">🔙 ホームへ</Link>
          <h1 className="text-xl font-bold">☀ 天気予報</h1>
        </div>
      </header>

      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3">
          <div className="flex gap-2">
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="地名 (例: 堺市)" className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">🔍 検索</button>
          </div>
          <div className="flex justify-end">
             <button onClick={handleCurrentLocation} className="text-sm text-sky-600 font-bold hover:underline flex items-center gap-1">📍 現在地に戻る</button>
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
              <h3 className="p-4 font-bold text-gray-700 border-b bg-gray-50">📅 週間予報 <span className="text-xs font-normal text-gray-400 ml-2">タップして詳細</span></h3>
              <div className="divide-y">
                {weeklyWeather.map((day) => (
                  <div key={day.dateStr} className="transition bg-white">
                    
                    {/* 日付の行（タップ可能） */}
                    <button 
                      onClick={() => toggleExpand(day.dateStr)}
                      className="w-full flex items-center justify-between p-4 hover:bg-sky-50 transition text-left"
                    >
                      <div className="w-24 text-sm font-bold text-gray-600 flex items-center gap-2">
                         {day.displayDate}
                         {expandedDate === day.dateStr ? <span className="text-sky-500">▲</span> : <span className="text-gray-300">▼</span>}
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-2xl">{getWeatherIcon(day.weatherCode)}</span>
                        <span className="text-sm text-gray-500">{getWeatherLabel(day.weatherCode)}</span>
                      </div>
                      <div className="flex gap-4 text-sm font-bold">
                        <span className="text-red-500">{day.maxTemp}°</span>
                        <span className="text-blue-500">{day.minTemp}°</span>
                      </div>
                    </button>

                    {/* 詳細エリア（アコーディオン） */}
                    {expandedDate === day.dateStr && (
                      <div className="bg-slate-50 p-4 border-t border-b border-slate-100 animate-fadeIn">
                        <h4 className="text-xs font-bold text-gray-500 mb-3 border-l-4 border-sky-400 pl-2">3時間ごとの予報</h4>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                          {day.hourly.map((hourData, i) => (
                            <div key={i} className="flex flex-col items-center bg-white p-2 rounded border shadow-sm">
                              <span className="text-xs text-gray-500 font-bold">{hourData.time}</span>
                              <span className="text-2xl my-1">{getWeatherIcon(hourData.code)}</span>
                              <span className="text-xs font-bold text-slate-700">{hourData.temp}°</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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