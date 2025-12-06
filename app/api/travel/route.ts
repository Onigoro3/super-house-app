// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport } = await req.json();
    console.log(`旅行計画: ${destination} ${duration} (${theme})`);

    // サウナ特化モードの判定
    const isSaunaMode = theme.includes("サウナ");
    let specialInstruction = "";

    if (isSaunaMode) {
      specialInstruction = `
      【★サウナ特化モード発動】
      ユーザーはサウナ愛好家です。
      - 行き先周辺の「評価の高いサウナ施設」をGoogle検索して組み込んでください。
      - 施設の説明には、可能な限り「サウナ室の温度」「水風呂の温度」「外気浴スペースの有無」「ロウリュの有無」を記載してください。
      - 「サ飯（サウナ後の食事）」のおすすめ店も提案してください。
      `;
    }

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件に基づいて、最高に楽しめる旅行プラン（旅のしおり）を作成してください。

      【旅行条件】
      - 行き先: ${destination}
      - 期間・時間帯: ${duration}
      - 人数: ${people}人
      - 予算目安: 1人あたり${budget}円
      - 旅行のテーマ: ${theme}
      - 移動手段: ${transport}
      - 出発地: 大阪府 堺市

      【重要ルール】
      1. **距離:** 各スポットへの「堺市からの移動距離(km)」または前のスポットからの距離を記載。
      2. **URL:** 公式サイトやGoogleマップのURLを必ず含める。
      3. **時間帯:** 「${duration}」という条件に合わせて開始時刻を調整すること（例: 夕方プランなら17:00開始など）。
      4. 実在するスポットを検索して提案すること。

      ${specialInstruction}

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。

      {
        "title": "タイトル",
        "concept": "コンセプト",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { 
                "time": "18:00", 
                "name": "場所名", 
                "desc": "詳細（サウナなら温度情報なども）", 
                "cost": "約1,000円", 
                "distance": "約15km",
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