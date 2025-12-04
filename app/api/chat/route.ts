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

    // 1. 家のデータを取得（在庫・レシピ）
    const { data: items } = await supabase.from('items').select('name, quantity').eq('status', 'ok');
    const { data: recipes } = await supabase.from('recipes').select('title').order('created_at', { ascending: false }).limit(5);
    
    const inventoryText = items?.map(i => `${i.name}(${i.quantity})`).join(', ') || 'なし';
    const recipeText = recipes?.map(r => r.title).join(', ') || 'なし';

    // 2. 天気データを取得（位置情報がある場合）
    // ※AIが検索する前に、確実な現在地データをプロンプトに入れておくことで精度を高めます
    let weatherInfo = "（位置情報なし）";
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
          ・今日の最高: ${daily.temperature_2m_max[0]}℃, 最低: ${daily.temperature_2m_min[0]}℃
        `;
      } catch (e) {
        console.error("Weather Fetch Error", e);
      }
    }

    // 3. 日時
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // 4. 執事への指示書（Google検索を促す）
    const systemPrompt = `
      あなたは、この家の専属執事「セバスチャン」です。
      丁寧で落ち着いた口調（「〜でございます」）で話してください。

      【家の状況】
      ■ 日時: ${now}
      ■ 現在地の正確な天気データ: ${weatherInfo}
      ■ 冷蔵庫の在庫: ${inventoryText}
      ■ 最近の献立: ${recipeText}

      【あなたの能力: Google検索】
      あなたはGoogle検索ツールを持っています。
      **「ニュース」「観光地」「最新情報」「レシピ検索」** など、家の中のデータで分からないことは、**必ずGoogle検索を行ってから**、その検索結果に基づいて正確に答えてください。
      知ったかぶり（ハルシネーション）は禁止です。

      【回答ルール】
      - 天気について聞かれたら、上記の「正確な天気データ」を優先して答えてください。
      - ニュースや観光地については、Google検索の結果を要約して伝えてください。
      - 在庫にある食材を使ったレシピを聞かれたら、在庫データとGoogle検索を組み合わせて提案してください。
    `;

    // ★修正ポイント: 安定版モデル 'gemini-1.5-flash' を使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // ★重要: Google検索ツールを有効化
      tools: [
        { googleSearch: {} } as any
      ]
    });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "承知いたしました。Google検索を活用し、正確な情報をお伝えします。" }] },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ reply: response });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "申し訳ございません。通信エラー、または検索中に問題が発生しました。" }, { status: 500 });
  }
}