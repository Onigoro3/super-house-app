import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const getWeatherLabel = (code: number) => {
  switch (code) {
    case 0: return '快晴'; case 1: return '晴れ'; case 2: return '晴れ時々曇'; case 3: return '曇り';
    case 45: case 48: return '霧'; case 51: case 53: case 55: return '霧雨';
    case 61: case 63: return '雨'; case 65: return '大雨'; case 71: return '雪';
    case 95: return '雷雨'; default: return '不明';
  }
};

export async function POST(req: Request) {
  try {
    const { message, location, persona } = await req.json();

    // データ取得
    const { data: items } = await supabase.from('items').select('name, quantity').eq('status', 'ok');
    const { data: recipes } = await supabase.from('recipes').select('title').order('created_at', { ascending: false }).limit(5);
    const inventoryText = items?.map(i => `${i.name}(${i.quantity})`).join(', ') || 'なし';
    const recipeText = recipes?.map(r => r.title).join(', ') || 'なし';

    let weatherInfo = "（位置情報なし）";
    if (location) {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
        const wData = await res.json();
        const cur = wData.current_weather; const day = wData.daily;
        weatherInfo = `現在: ${getWeatherLabel(cur.weathercode)}, ${cur.temperature}℃ (最高:${day.temperature_2m_max[0]}℃ / 最低:${day.temperature_2m_min[0]}℃)`;
      } catch (e) {}
    }

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    
    // キャラ設定
    let role = "執事";
    let tone = "丁寧語";
    if (persona === 'maid') { role = "メイド"; tone = "「〜ですわ」等の元気な敬語"; }
    else if (persona === 'sister') { role = "姉"; tone = "タメ口"; }
    else if (persona === 'grandpa') { role = "博士"; tone = "「〜じゃ」等の老人語"; }
    else if (persona === 'kansai') { role = "オカン"; tone = "関西弁"; }

    const systemPrompt = `
      あなたは「${role}」です。${tone}で話してください。
      【状況】日時: ${now}, 天気: ${weatherInfo}, 在庫: ${inventoryText}, 履歴: ${recipeText}
      【ルール】
      - 外部情報（ニュース等）はGoogle検索して答えてください。
      - 家の情報（天気・在庫）は上記データを優先してください。
    `;

    // ★修正: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any]
    });

    const chat = model.startChat({ history: [{ role: "user", parts: [{ text: systemPrompt }] }, { role: "model", parts: [{ text: "承知いたしました。" }] }] });
    const result = await chat.sendMessage(message);
    
    return NextResponse.json({ reply: result.response.text() });

  } catch (error: any) {
    // 検索エラー時はフォールバック
    try {
      const fallback = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const res = await fallback.generateContent(`システムエラーのため検索なしで回答せよ。質問: ${JSON.stringify(req.body)}`);
      return NextResponse.json({ reply: res.response.text() });
    } catch (e) {
      return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
    }
  }
}