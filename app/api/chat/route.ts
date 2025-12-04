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

    // 2. 天気データを取得
    let weatherInfo = "（位置情報なし）";
    if (location) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
        );
        const wData = await res.json();
        if (wData.current_weather && wData.daily) {
          const current = wData.current_weather;
          const daily = wData.daily;
          weatherInfo = `現在: ${getWeatherLabel(current.weathercode)}, 気温 ${current.temperature}℃ (最高:${daily.temperature_2m_max[0]}℃ / 最低:${daily.temperature_2m_min[0]}℃)`;
        }
      } catch (e) {
        console.error("Weather Fetch Error", e);
      }
    }

    // 3. プロンプト作成
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const systemPrompt = `
      あなたは、この家の専属執事「セバスチャン」です。
      丁寧で落ち着いた口調（「〜でございます」）で話してください。

      【家の状況】
      ■ 日時: ${now}
      ■ 天気: ${weatherInfo}
      ■ 在庫: ${inventoryText}
      ■ 履歴: ${recipeText}

      【ルール】
      - 天気や在庫の質問には、上記のデータを使って正確に答えてください。
      - それ以外の質問（ニュースや観光地など）は、あなたの知識で答えてください。
    `;

    // ★安全装置ロジック
    let responseText = "";
    
    try {
      // 作戦A: 検索ツールを使って回答を試みる
      // (gemini-1.5-flash はGoogle検索に対応していますが、APIキーの設定によっては失敗することがあります)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: [{ googleSearch: {} } as any] 
      });
      
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "承知いたしました。" }] },
        ],
      });

      const result = await chat.sendMessage(message);
      responseText = result.response.text();

    } catch (searchError: any) {
      console.warn("Google検索に失敗しました。標準モードに切り替えます。", searchError);
      
      // 作戦B: 検索なしで回答する（フォールバック）
      // これなら確実に動きます
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n※現在、外部検索機能が一時的に利用できません。あなたの持つ知識の範囲で答えてください。" }] },
          { role: "model", parts: [{ text: "承知いたしました。" }] },
        ],
      });

      const result = await chat.sendMessage(message);
      responseText = result.response.text();
    }

    return NextResponse.json({ reply: responseText });

  } catch (error: any) {
    console.error("Critical Chat Error:", error);
    // 何が起きたか画面に表示する
    return NextResponse.json({ error: `システムエラーが発生しました: ${error.message}` }, { status: 500 });
  }
}