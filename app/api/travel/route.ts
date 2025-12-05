// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport } = await req.json();
    console.log(`旅行計画: ${destination} ${duration}`);

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件に基づいて、旅行プラン（旅のしおり）を作成してください。

      【旅行条件】
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算目安: 1人あたり${budget}円
      - 移動手段: ${transport}
      - **出発地: 大阪府 堺市**

      【重要ルール】
      1. **距離計算:** 各スポットへの距離は、必ず**「大阪府堺市」からの移動距離（km）**、または前のスポットからの距離を計算して記載してください。
      2. **URL:** 各スポットの公式サイト、またはGoogleマップなどの参考URLを必ず含めてください。
      3. 実在する店舗や施設をGoogle検索して提案してください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。

      {
        "title": "旅行タイトル",
        "concept": "コンセプト",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { 
                "time": "10:00", 
                "name": "場所名", 
                "desc": "詳細", 
                "cost": "約1,000円", 
                "distance": "堺市から約〇km",
                "url": "https://..."
              }
            ]
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} } as any]
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Travel Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}