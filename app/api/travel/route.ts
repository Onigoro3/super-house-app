// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    const isOnsenMode = theme.includes("温泉") || theme.includes("サウナ");
    const specialInstruction = isOnsenMode ? `
      【★温泉・サウナ特化モード】
      1. 行き先周辺で高評価の温泉・温浴施設を**5つ**ピックアップし、「♨️ おすすめ温泉5選」として詳細欄にURL付きでリストアップしてください。
      2. 夕食は地元の美味しいお店を提案してください。
      3. 帰路は${startPoint}へのルートを設定してください。
    ` : "";

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で、最高の旅行プランを作成してください。

      【旅行条件】
      - 出発地: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算: 1人あたり${budget}円
      - 移動手段: ${transport}
      - テーマ: ${theme}

      【重要ルール】
      1. **距離:** 各スポットへの「${startPoint}からの移動距離(km)」または前のスポットからの距離を計算して記載。
      2. **URL:** 各スポットの公式サイトやGoogleマップのURLを必ず含める。
      3. **時間帯:** 「${duration}」に合わせて開始時刻を調整する。
      4. 実在するスポットをGoogle検索して提案する。

      ${specialInstruction}

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のみを出力してください。Markdown記号は不要です。

      {
        "title": "タイトル",
        "concept": "コンセプト",
        "schedule": [
          {
            "day": 1,
            "spots": [
              { 
                "time": "10:00", 
                "name": "スポット名", 
                "desc": "詳細説明", 
                "cost": "約1,000円", 
                "distance": "約10km", 
                "url": "https://..."
              }
            ]
          }
        ]
      }
    `;

    // ★修正: 最新モデル gemini-2.5-flash & 安全フィルター解除
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any],
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });
    
    // タイムアウト対策（20秒に延長）
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000));
    
    const aiPromise = (async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    })();

    let text = await Promise.race([aiPromise, timeoutPromise]) as string;

    // クリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    let msg = "プラン作成に失敗しました。";
    if (error.message === "Timeout") msg = "検索に時間がかかりすぎました。もう一度お試しください。";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}