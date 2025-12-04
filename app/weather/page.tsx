// app/weather/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// ★RainRadarはブラウザ専用なのでdynamic importする (SSRエラー回避)
const RainRadar = dynamic(() => import('./RainRadar'), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400">地図を読み込み中...</div>
});

type HourlyWeather = { time: string; max: number; min: number; code: number; label: string; };
type DailyWeather = { dateStr: string; displayDate: string; weekday: string; maxTemp: number; minTemp: number; weatherCode: number; hourly: HourlyWeather[]; };

export default function WeatherApp() {
  // ビュー切り替え ('forecast' | 'radar')
  const [currentView, setCurrentView] = useState<'forecast' | 'radar'>('forecast');

  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [weeklyWeather, setWeeklyWeather] = useState<DailyWeather[]>([]);
  const [locationName, setLocationName] = useState('現在地');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  
  // ★地図用座標
  const [mapLat, setMapLat] = useState(35.6895); // 東京デフォルト
  const [mapLon, setMapLon] = useState(139.6917);

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
    switch (code) {
      case 0: return '快晴'; case 1: return '晴れ'; case 2: return '晴れ時々曇'; case 3: return '曇り';
      case 45: case 48: return '霧'; case 51: case 53: case 55: return '霧雨'; case 56: case 57: return '凍雨';
      case 61: return '小雨'; case 63: return '雨'; case 65: return '大雨'; case 66: case 67: return '氷雨';
      case 71: case 73: case 75: return '雪'; case 77: return 'あられ'; case 80: case 81: case 82: return 'にわか雨';
      case 85: case 86: return '雪/みぞれ'; case 95: return '雷雨'; case 96: case 99: return '雷雨/雹'; default: return '不明';
    }
  };

  const fetchWeather = async (lat: number, lon: number, name: string) => {
    setLoading(true);
    setExpandedDate(null);
    // 地図座標も更新
    setMapLat(lat);
    setMapLon(lon);

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weathercode&timezone=auto`);
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
            if (hour % 3 === 0) {
              const tempsInBlock = [hourly.temperature_2m[hIndex], hourly.temperature_2m[hIndex + 1], hourly.temperature_2m[hIndex + 2]].filter(t => t !== undefined);
              dayHourlyData.push({
                time: `${hour}:00`, max: Math.max(...tempsInBlock), min: Math.min(...tempsInBlock),
                code: hourly.weathercode[hIndex], label: getWeatherLabel(hourly.weathercode[hIndex])
              });
            }
          }
        });
        return {
          dateStr: dateStr, displayDate: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`, weekday: ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()],
          maxTemp: daily.temperature_2m_max[index], minTemp: daily.temperature_2m_min[index], weatherCode: daily.weathercode[index], hourly: dayHourlyData,
        };
      });
      setWeeklyWeather(formattedWeekly);
      setLocationName(name);
    } catch (error) { alert('天気データ取得失敗'); } finally { setLoading(false); }
  };

  const handleCurrentLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) { alert('位置情報不可'); setLoading(false); return; }
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
      if (!data || data.length === 0) { alert('場所不明'); setLoading(false); return; }
      const location = data[0];
      fetchWeather(parseFloat(location.lat), parseFloat(location.lon), `🔎 ${q}`);
      setSearchQuery('');
    } catch (error) { alert('検索エラー'); setLoading(false); }
  };

  useEffect(() => { handleCurrentLocation(); }, []);
  const toggleExpand = (dateStr: string) => { setExpandedDate(expandedDate === dateStr ? null : dateStr); };

  return (
    <div className="min-h-screen bg-sky-100 flex flex-col md:flex-row text-gray-800 h-screen overflow-hidden">
      
      {/* ★天気アプリ専用サイドバー */}
      <div className="w-full md:w-64 bg-white md:h-full shadow-md flex flex-row md:flex-col shrink-0 z-20">
        <div className="p-4 bg-sky-500 text-white flex items-center gap-2 md:block">
          <Link href="/" className="text-sm bg-sky-600 px-2 py-1 rounded hover:bg-sky-700 mb-2 inline-block">🔙 ホーム</Link>
          <h1 className="font-bold text-lg">☀ お天気</h1>
        </div>
        
        <div className="flex-1 flex md:flex-col p-2 gap-2 overflow-x-auto md:overflow-visible">
          <button 
            onClick={() => setCurrentView('forecast')}
            className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold transition flex items-center gap-2 ${currentView === 'forecast' ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-200' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <span className="text-xl">📅</span> 週間予報
          </button>
          <button 
            onClick={() => setCurrentView('radar')}
            className={`flex-1 md:flex-none text-left px-4 py-3 rounded-lg font-bold transition flex items-center gap-2 ${currentView === 'radar' ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-200' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <span className="text-xl">☔</span> 雨雲レーダー
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* 検索バー (共通) */}
        <div className="bg-white/80 backdrop-blur-sm p-4 shadow-sm z-10 flex gap-2 items-center absolute top-0 left-0 right-0">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="地名 (例: 大阪 堺)" className="flex-1 border p-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-400 shadow-inner bg-white" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} className="bg-sky-500 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-sky-600">検索</button>
          <button onClick={handleCurrentLocation} className="bg-gray-100 text-sky-600 px-3 py-2 rounded-lg font-bold shadow hover:bg-gray-200 text-xl" title="現在地">📍</button>
        </div>

        {/* コンテンツ表示エリア */}
        <div className="flex-1 overflow-y-auto pt-20 p-4 pb-24">
          <div className="max-w-3xl mx-auto h-full">
            
            {loading ? <div className="text-center text-gray-500 py-20">読み込み中...</div> : (
              <>
                {/* --- 週間予報ビュー --- */}
                {currentView === 'forecast' && (
                  <div className="space-y-6 animate-fadeIn">
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
                        {weeklyWeather.map((day) => (
                          <div key={day.dateStr} className="transition bg-white">
                            <button onClick={() => toggleExpand(day.dateStr)} className="w-full flex items-center justify-between p-4 hover:bg-sky-50 transition text-left">
                              <div className="w-28 font-bold text-gray-700 flex items-center gap-2"><span className="text-lg">{day.displayDate}</span><span className="text-sm text-gray-500">({day.weekday})</span></div>
                              <div className="flex-1 flex items-center gap-3"><span className="text-3xl">{getWeatherIcon(day.weatherCode)}</span><span className="text-sm text-gray-600 hidden sm:inline">{getWeatherLabel(day.weatherCode)}</span></div>
                              <div className="flex flex-col items-end"><div className="flex gap-3 text-sm font-bold"><span className="text-red-500">最高 {day.maxTemp}°</span><span className="text-blue-500">最低 {day.minTemp}°</span></div><div className="flex items-center gap-1 mt-1 text-xs text-gray-400"><span>詳細</span><span>{expandedDate === day.dateStr ? '▲' : '▼'}</span></div></div>
                            </button>
                            {expandedDate === day.dateStr && (
                              <div className="bg-slate-50 p-4 border-t border-b border-slate-100">
                                <div className="flex justify-between items-center mb-3 border-l-4 border-sky-400 pl-2"><h4 className="text-xs font-bold text-gray-500">3時間ごとの予報 (気温幅)</h4><div className="text-xs font-bold"><span className="text-red-500 mr-2">最高: {day.maxTemp}°</span><span className="text-blue-500">最低: {day.minTemp}°</span></div></div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{day.hourly.map((hourData, i) => (<div key={i} className="flex items-center justify-between bg-white p-2 px-3 rounded border shadow-sm"><div className="flex flex-col"><span className="text-xs text-gray-400 font-bold">{hourData.time}</span><span className="text-xs text-gray-800 font-bold mt-1">{hourData.label}</span></div><div className="flex flex-col items-end"><span className="text-2xl mb-1">{getWeatherIcon(hourData.code)}</span><div className="flex gap-1 text-xs font-bold"><span className="text-red-500">{hourData.max}°</span><span className="text-gray-300">/</span><span className="text-blue-500">{hourData.min}°</span></div></div></div>))}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- 雨雲レーダービュー --- */}
                {currentView === 'radar' && (
                  <div className="h-full flex flex-col gap-4 animate-fadeIn">
                    <h2 className="text-xl font-bold text-gray-700 border-l-4 border-blue-500 pl-3">
                      {locationName} 周辺の雨雲
                    </h2>
                    <div className="flex-1 min-h-[500px] bg-white rounded-2xl shadow-lg overflow-hidden border">
                      {/* 地図コンポーネント呼び出し */}
                      <RainRadar lat={mapLat} lon={mapLon} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}