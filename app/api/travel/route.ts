import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';
    
    const isOnsen = theme.includes("温泉") || theme.includes("サウナ");
    const special = isOnsen ? "行き先周辺の高評価な温泉・サウナを5つリストアップし、URL付きで提案してください。" : "";

    const prompt = `
      トラベルコンシェルジュとして旅行プランを作成してください。
      条件: ${startPoint}発 ${destination}行き, ${duration}, ${people}人, 予算${budget}円, 移動${transport}, テーマ${theme}
      ルール:
      1. ${startPoint}からの距離を計算して記載。
      2. スポットのURLを必ず含める。
      3. ${special}
      4. JSON形式のみ出力。
      
      Output JSON Schema:
      {
        "title": "Title", "concept": "Concept",
        "schedule": [
          { "day": 1, "spots": [ { "time": "10:00", "name": "Name", "desc": "Desc", "cost": "1000yen", "distance": "10km", "url": "http..." } ] }
        ]
      }
    `;

    // ★修正: gemini-2.5-flash
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}