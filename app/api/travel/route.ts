// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport } = await req.json();
    console.log(`旅行計画: ${destination} ${duration} (${transport})`);

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件に基づいて、最高に楽しめる旅行プラン（旅のしおり）を作成してください。

      【旅行条件】
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算目安: 1人あたり${budget}円
      - 旅行のテーマ: ${theme}
      - 主な移動手段: ${transport}

      【ルール】
      - Google検索機能を使って、実在する観光地、飲食店、最新のイベント情報を調べて組み込んでください。
      - 移動手段（${transport}）を考慮した、無理のない移動ルートにしてください。
      - 各スポットについて「前の場所からの概算距離(km)」と「移動時間」も算出してください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。余計な文章は不要です。

      {
        "title": "旅行のタイトル（例：車で行く！白浜満喫ドライブ旅）",
        "concept": "この旅のコンセプトや見どころ",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { 
                "time": "10:00", 
                "name": "場所名", 
                "desc": "詳細や楽しみ方", 
                "cost": "約1,000円",
                "distance": "約15km"  // ★ここを追加（前の場所からの距離、または拠点からの距離）
              },
              { "time": "12:00", "name": "ランチ：〇〇", "desc": "...", "cost": "...", "distance": "約5km" }
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
    console.error("Travel Plan Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}