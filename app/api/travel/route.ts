// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    console.log(`旅行計画生成開始: ${startPoint} -> ${destination}`);

    // 特化モード判定
    const isOnsenMode = theme.includes("温泉") || theme.includes("サウナ");
    const specialInstruction = isOnsenMode ? `
      【★温泉・サウナ特化】
      行き先周辺の有名な温泉・温浴施設を5つリストアップし、「♨️ おすすめ温泉5選」として詳細欄に記載してください。
      （URLはあなたが知っている公式サイトやGoogle検索URLを記載してください）
    ` : "";

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で旅行プランを作成し、JSON形式で出力してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 移動: ${transport}
      - 予算: ${budget}円
      - テーマ: ${theme}

      【ルール】
      1. ${startPoint}からの概算距離を計算して記載。
      2. 各スポットのURLを記載（公式サイトまたはGoogleマップ検索URL）。
      3. ${specialInstruction}
      4. 必ず正しいJSON形式で出力すること。Markdown記号（\`\`\`json）は不要。

      【出力フォーマット(JSON)】
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
                "cost": "約1,000円", 
                "distance": "約10km", 
                "url": "https://..." 
              }
            ]
          }
        ]
      }
    `;

    // ★重要変更: 検索ツールを使わず、AIの知識のみで生成（爆速化）
    // モデルは最新かつ高速な gemini-2.0-flash を使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    // 生成実行
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // クリーニング（念のため）
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // JSONパース確認
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (e) {
      console.error("JSON Parse Error", text);
      throw new Error("AIの応答がJSON形式ではありませんでした");
    }

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    return NextResponse.json({ error: `作成エラー: ${error.message}` }, { status: 500 });
  }
}