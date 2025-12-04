// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 天気コード変換
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
    const { message, location } = await req.json();

    // 1. 家のデータを取得
    const { data: items } = await supabase.from('items').select('name, quantity').eq('status', 'ok');
    const { data: recipes } = await supabase.from('recipes').select('title').order('created_at', { ascending: false }).limit(5);
    
    const inventoryText = items?.map(i => `${i.name}(${i.quantity})`).join(', ') || 'なし';
    const recipeText = recipes?.map(r => r.title).join(', ') || 'なし';

    // 2. ★追加: 天気データを取得（位置情報がある場合）
    let weatherInfo = "（位置情報がないため不明）";
    if (location) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
        );
        const wData = await res.json();
        const current = wData.current_weather;
        const daily = wData.daily;
        
        weatherInfo = `
          ・現在: ${getWeatherLabel(current.weathercode)}, 気温 ${current.temperature}℃
          ・今日の最高気温: ${daily.temperature_2m_max[0]}℃, 最低気温: ${daily.temperature_2m_min[0]}℃
        `;
      } catch (e) {
        console.error("Weather Fetch Error", e);
      }
    }

    // 3. 日時取得
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // 4. 執事への指示書（天気情報を追加）
    const systemPrompt = `
      あなたは、この家の専属執事「セバスチャン」です。
      丁寧で落ち着いた口調で話してください。

      【現在の状況】
      ■ 日時: ${now}
      ■ 現在地の天気: ${weatherInfo}
      ■ 冷蔵庫の在庫: ${inventoryText}
      ■ 最近の献立履歴: ${recipeText}

      【ルール】
      - ユーザーの質問に対し、上記の【現在の状況】（特に天気と在庫）を元に正確に答えてください。
      - 天気を聞かれたら、上記データに基づいて答えてください。嘘をつかないでください。
      - 「今日は寒いですか？」などの質問には、気温データを元に判断してください。
      - 献立の相談には、在庫にあるものを優先して提案してください。
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "承知いたしました。正確な情報に基づいてお答えします。" }] },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ reply: response });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "申し訳ございません。エラーが発生いたしました。" }, { status: 500 });
  }
}