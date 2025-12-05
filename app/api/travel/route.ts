// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, days, budget, people, theme } = await req.json();
    console.log(`旅行計画: ${destination} ${days}日間`);

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件に基づいて、最高に楽しめる旅行プラン（旅のしおり）を作成してください。

      【旅行条件】
      - 行き先: ${destination}
      - 期間: ${days}日間
      - 人数: ${people}人
      - 予算目安: 1人あたり${budget}円
      - 旅行のテーマ・希望: ${theme}

      【ルール】
      - Google検索機能を使って、実在する観光地、飲食店、最新のイベント情報を調べて組み込んでください。
      - 移動時間や営業時間も考慮した、無理のないスケジュールにしてください。
      - 各スポットの「概算費用」と「滞在時間」も記載してください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。余計な文章は不要です。

      {
        "title": "旅行のタイトル（例：秋の京都 満喫の旅）",
        "concept": "この旅のコンセプトや見どころ",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { "time": "10:00", "name": "場所名", "desc": "詳細や楽しみ方", "cost": "約1,000円" },
              { "time": "12:00", "name": "ランチ：〇〇食堂", "desc": "おすすめメニューなど", "cost": "約1,500円" }
            ]
          },
          { "day": 2, "spots": [...] }
        ]
      }
    `;

    // 検索ツール付きの最新モデルを使用
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