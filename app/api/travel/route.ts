// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';
    
    const isOnsen = theme.includes("温泉") || theme.includes("サウナ");
    const special = isOnsen ? "行き先周辺の高評価な温泉・サウナを5つリストアップし、URL付きで提案してください。" : "";

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で、旅行プランを作成してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算: 1人あたり${budget}円
      - 移動手段: ${transport}
      - テーマ: ${theme}

      【ルール】
      1. ${startPoint}からの距離を計算して記載。
      2. スポットのURLを必ず含める。
      3. ${special}
      4. JSON形式のみ出力。
      
      【出力JSON】
      {
        "title": "旅行タイトル", 
        "concept": "コンセプト",
        "schedule": [
          { 
            "day": 1, 
            "spots": [ 
              { 
                "time": "10:00", 
                "name": "スポット名", 
                "desc": "詳細説明", 
                "cost": "約1000円", 
                "distance": "約10km", 
                "url": "https://..." 
              } 
            ] 
          }
        ]
      }
    `;

    // ★修正: 最新モデル gemini-2.5-flash & 検索ツール有効化
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      tools: [{ googleSearch: {} } as any],
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}