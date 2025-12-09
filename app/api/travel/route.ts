// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // ★ origin（出発地）を受け取る
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市'; // 万が一取れなかったら堺市
    console.log(`旅行計画: ${startPoint} -> ${destination}`);

    // ★修正: テーマに応じた特別指示を作成
    // 温泉以外でも、必ず「おすすめスポット」を提案させるように変更
    let specialInstruction = "";

    if (theme.includes("温泉") || theme.includes("サウナ")) {
      specialInstruction = `
      【★温泉・サウナ特化モード】
      ユーザーは温泉愛好家です。
      1. **温泉タイム**: 行き先周辺で高評価の温泉・温浴施設を**5つ**ピックアップし、「♨️ おすすめ温泉5選」として詳細欄にURL付きでリストアップしてください。
      2. **夕食**: 地元の美味しいお店を提案してください。
      3. **帰路**: ${startPoint}への帰路を設定してください。
      `;
    } else {
      // ★追加: 温泉以外の場合（歴史、グルメなど）
      specialInstruction = `
      【★テーマ特化モード: ${theme || 'おまかせ'}】
      1. 行き先周辺で、テーマ「${theme || '観光'}」に合ったおすすめスポットや体験を**5つ**ピックアップし、「✨ おすすめスポット5選」として詳細欄にURL付きでリストアップしてください。
      2. 夕食やランチは、その土地ならではの美味しいお店を提案してください。
      3. **帰路**: ${startPoint}への帰路を設定してください。
      `;
    }

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で、最高の旅行プランを作成してください。

      【旅行条件】
      - 出発地: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算: 1人${budget}円
      - 移動: ${transport}
      - テーマ: ${theme}

      【重要ルール】
      1. **距離計算:** 各スポットへの距離は、必ず**「${startPoint}」からの移動距離**、または前のスポットからの距離を計算して記載してください。
      2. **URL:** スポットの公式サイトやGoogleマップのURLを含めてください。
      3. **時間帯:** 「${duration}」に合わせて開始時刻を調整してください。

      ${specialInstruction}

      【出力フォーマット(JSON)】
      {
        "title": "タイトル",
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
                "distance": "${startPoint}から約〇km",
                "url": "https://..."
              }
            ]
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any]
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("Travel Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}