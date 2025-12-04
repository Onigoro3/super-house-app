// app/weather/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// 3時間ごとのデータ型
type HourlyWeather = {
  time: string;
  temp: number;
  code: number;
  label: string; // ★追加: 天気名
};

// 日次データ型
type DailyWeather = {
  dateStr: string;
  displayDate: string;
  weekday: string; // 曜日
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  hourly: HourlyWeather[];
};

export default function WeatherApp() {
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [weeklyWeather, setWeeklyWeather] = useState<DailyWeather[]>([]);
  const [locationName, setLocationName] = useState('現在地');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // 天気コードをアイコンに変換
  const getWeatherIcon = (code: number) => {
    if (code === 0) return '☀';
    if (code === 1) return '☀';
    if (code === 2) return '⛅';
    if (code === 3) return '☁';
    if (code >= 45 && code <= 48) return '🌫';
    if (code >= 51 && code <= 55) return '🌧'; // 霧雨
    if (code >= 61 && code <= 65) return '☔'; // 雨
    if (code >= 66 && code <= 67) return '🌨'; // 氷雨
    if (code >= 71 && code <= 77) return '⛄'; // 雪
    if (code >= 80 && code <= 82) return '☂'; // にわか雨
    if (code >= 85 && code <= 86) return '❄'; // 雪/みぞれ
    if (code >= 95) return '⚡'; // 雷雨
    return '☁';
  };

  // ★詳細な天気名に変換
  const getWeatherLabel = (code: number) => {
    switch (code) {
      case 0: return '快晴';
      case 1: return '晴れ';
      case 2: return '晴れ時々曇';
      case 3: return '曇り';
      case 45: case 48: return '霧';
      case 51: case 53: case 55: return '霧雨';
      case 56: case 57: return '凍雨';
      case 61: return '小雨';
      case 63: return '雨';
      case 65: return '大雨';
      case 66: case 67: return '氷雨';
      case 71: case 73: case 75: return '雪';
      case 77: return 'あられ';
      case 80: case 81: case 82: return 'にわか雨';
      case 85: case 86: return '雪/みぞれ';
      case 95: return '雷雨';
      case 96: case 99: return '雷雨/雹';
      default: return '不明';
    }
  };

  const fetchWeather = async (lat: number, lon: number, name: string) => {
    setLoading(true);
    setExpandedDate(null);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weathercode&timezone=auto`
      );
      const data = await res.json();

      setCurrentWeather(data.current_weather);

      const daily = data.daily;
      const hourly = data.hourly;

      const formattedWeekly: DailyWeather[] = daily.time.map((dateStr: string, index: number) => {
        const dayHourlyData: HourlyWeather[] = [];
        const dateObj = new Date(dateStr);
        
        hourly.time.forEach((timeStr: string, hIndex: number) => {
          if (timeStr.startsWith(dateStr)) {
            const hour = new Date(timeStr).getHours();
            // 3時間おき (0, 3, 6...)
            if (hour % 3 === 0) {
              dayHourlyData.push({
                time: `${hour}:00`,
                temp: hourly.temperature_2m[hIndex],
                code: hourly.weathercode[hIndex],
                label: getWeatherLabel(hourly.weathercode[hIndex]) // ★詳細名を追加
              });
            }
          }
        });

        return {
          dateStr: dateStr,
          displayDate: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          weekday: ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()],
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
    if (!navigator.geolocation) { alert('位置情報が使えません'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          const data = await res.json();
          const addr = data.address;
          const city = addr.city || addr.town || addr.village || addr.ward || '';
          const state = addr.province || addr.state || '';
          fetchWeather(latitude, longitude, `📍 ${state} ${city} (現在地)`);
        } catch (e) { fetchWeather(latitude, longitude, '📍 現在地'); }
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
      if (!data || data.length === 0) { alert('場所が見つかりませんでした。'); setLoading(false); return; }
      const location = data[0];
      fetchWeather(parseFloat(location.lat), parseFloat(location.lon), `🔎 ${q}`);
      setSearchQuery('');
    } catch (error) { alert('検索エラー'); setLoading(false); }
  };

  useEffect(() => { handleCurrentLocation(); }, []);

  const toggleExpand = (dateStr: string) => {
    setExpandedDate(expandedDate === dateStr ? null : dateStr);
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
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="地名 (例: 大阪 堺市)" className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold">🔍 検索</button>
          </div>
          <div className="flex justify-end"><button onClick={handleCurrentLocation} className="text-sm text-sky-600 font-bold hover:underline flex items-center gap-1">📍 現在地に戻る</button></div>
        </div>

        {loading ? <div className="text-center text-gray-500 py-20">読み込み中...</div> : (
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
                    <button onClick={() => toggleExpand(day.dateStr)} className="w-full flex items-center justify-between p-4 hover:bg-sky-50 transition text-left">
                      <div className="w-28 font-bold text-gray-700 flex items-center gap-2">
                         <span className="text-lg">{day.displayDate}</span>
                         <span className="text-sm text-gray-500">({day.weekday})</span>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-3xl">{getWeatherIcon(day.weatherCode)}</span>
                        <span className="text-sm text-gray-600 hidden sm:inline">{getWeatherLabel(day.weatherCode)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex gap-3 text-sm font-bold">
                          <span className="text-red-500">最高 {day.maxTemp}°</span>
                          <span className="text-blue-500">最低 {day.minTemp}°</span>
                        </div>
                        <span className={`text-xs text-gray-400 mt-1 transition-transform ${expandedDate === day.dateStr ? 'rotate-180' : ''}`}>▼ 詳細</span>
                      </div>
                    </button>

                    {expandedDate === day.dateStr && (
                      <div className="bg-slate-50 p-4 border-t border-b border-slate-100 animate-fadeIn">
                        <h4 className="text-xs font-bold text-gray-500 mb-3 border-l-4 border-sky-400 pl-2">3時間ごとの予報</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {day.hourly.map((hourData, i) => (
                            <div key={i} className="flex items-center justify-between bg-white p-2 px-3 rounded border shadow-sm">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-bold">{hourData.time}</span>
                                <span className="text-xs text-gray-800 font-bold mt-1">{hourData.label}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-2xl">{getWeatherIcon(hourData.code)}</span>
                                <span className="text-sm font-bold text-slate-700">{hourData.temp}°</span>
                              </div>
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