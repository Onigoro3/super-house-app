// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport } = await req.json();
    console.log(`旅行計画: ${destination} ${duration} (${theme})`);

    // ★温泉特化モードの判定
    const isOnsenMode = theme.includes("温泉") || theme.includes("サウナ"); // 温泉かサウナで発動
    let specialInstruction = "";

    if (isOnsenMode) {
      specialInstruction = `
      【★温泉・サウナ特化モード発動】
      ユーザーは温泉（またはサウナ）旅行を計画しています。
      以下の構成でスケジュールを組んでください。

      1. **温泉タイム**: 
         - 行き先周辺で評価の高い温泉・温浴施設を**5つ**ピックアップしてください。
         - スポット名は「♨️ おすすめ温泉5選（お好きな場所へ）」としてください。
         - 「詳細（desc）」欄に、5つの施設名、特徴（泉質やサウナ温度）、**URL**を箇条書きで記載してください。
      
      2. **夕食**: 
         - 温泉の後に行ける、地元の美味しいお店を提案してください。
      
      3. **帰路**: 
         - 自宅（大阪・堺）への帰路を設定してください。

      全体の流れは「温泉エリア到着 → 温泉（5選から選択） → 夕食 → 帰路」としてください。
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
      1. **距離:** 各スポットへの「堺市からの移動距離(km)」または前のスポットからの距離を計算して記載。
      2. **URL:** 各スポットの公式サイトやGoogleマップのURLを必ず含める。
      3. **時間帯:** 「${duration}」に合わせて開始時刻を調整する（例: 夕方プランなら17:00開始）。
      4. 実在するスポットをGoogle検索して提案する。

      ${specialInstruction}

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。

      {
        "title": "タイトル（例：堺から行く！〇〇温泉 癒やしの旅）",
        "concept": "コンセプト",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { 
                "time": "18:00", 
                "name": "スポット名", 
                "desc": "詳細（温泉モードの場合はここに5つの候補とURLを書く）", 
                "cost": "約1,000円", 
                "distance": "約15km",
                "url": "https://...（代表的なURL）"
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