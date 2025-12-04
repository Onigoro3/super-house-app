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
  // ★修正: 変数をここで定義しておく（スコープ対策）
  let message = "";
  let location = null;

  try {
    const body = await req.json();
    message = body.message;
    location = body.location;

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

      【あなたの能力】
      あなたはGoogle検索機能を持っています。
      ユーザーの質問に対して、家の中のデータで答えられない場合（ニュース、観光地、一般的な知識など）は、**必ずGoogle検索を行って**最新情報を元に答えてください。
    `;

    // 最新モデルを使用 (検索ツール有効化)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [
        { googleSearch: {} } as any
      ]
    });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "承知いたしました。最新モデルにて、正確な情報をお伝えします。" }] },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ reply: response });

  } catch (error: any) {
    console.error("Chat Error:", error);
    
    // エラー時のフォールバック（検索なしで答える）
    try {
      // メッセージが空の場合はフォールバックできないのでエラーを返す
      if (!message) throw new Error("メッセージが読み取れませんでした");

      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await fallbackModel.generateContent([
        `システムエラーが発生したため検索機能が使えません。以下の質問に、あなたの知識の範囲で答えてください。\n質問: ${message}`
      ]);
      return NextResponse.json({ reply: result.response.text() + "\n(※検索機能が一時的に利用できないため、知識ベースで回答しました)" });
    } catch (e: any) {
      return NextResponse.json({ error: `システムエラーが発生しました: ${error.message}` }, { status: 500 });
    }
  }
}