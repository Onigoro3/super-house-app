// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキー確認
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.error("APIキー設定エラー: GEMINI_API_KEYがありません");
const genAI = new GoogleGenerativeAI(apiKey!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    console.log(`🚀 旅行プラン作成開始: ${startPoint} -> ${destination}`);

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で旅行プランを作成し、**JSON形式のみ**で出力してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 移動: ${transport}
      - 予算: ${budget}円
      - テーマ: ${theme}

      【ルール】
      1. 各スポットの「${startPoint}からの距離」を概算で記載。
      2. スポットのURL（公式サイトやGoogleマップ検索URL）を含める。
      3. ${theme.includes('温泉') || theme.includes('サウナ') ? '周辺の温泉施設を5つリストアップし、URL付きで提案' : '観光スポットを提案'}。
      4. 余計な文章は一切書かず、以下のJSONのみを出力すること。

      Output JSON Schema:
      {
        "title": "タイトル",
        "concept": "コンセプト",
        "schedule": [
          { "day": 1, "spots": [ { "time": "10:00", "name": "Name", "desc": "Desc", "cost": "1000yen", "distance": "10km", "url": "http..." } ] }
        ]
      }
    `;

    // ★試行するモデルのリスト（優先順）
    // 2.5系が不安定な場合があるため、確実に動くラインナップに変更
    const modelsToTry = [
      "gemini-2.0-flash-exp", // 最新・爆速
      "gemini-1.5-flash",     // 定番・高速
      "gemini-1.5-pro",       // 高性能・安定
    ];

    let lastError = null;

    // ★モデルを順番に試すループ
    for (const modelName of modelsToTry) {
      try {
        console.log(`👉 モデル ${modelName} で生成を試みます...`);
        
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        // タイムアウト設定 (12秒)
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000));
        const aiPromise = model.generateContent(prompt);
        
        const result: any = await Promise.race([aiPromise, timeoutPromise]);
        const text = result.response.text();

        console.log(`✅ ${modelName} で生成成功！`);

        // JSONクリーニング（強力版）
        // 最初の '{' から 最後の '}' までを抜き出す
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("AIの応答にJSONが含まれていませんでした");
        }
        
        const cleanJson = jsonMatch[0];
        const data = JSON.parse(cleanJson);
        
        // 成功したら即リターン
        return NextResponse.json(data);

      } catch (e: any) {
        console.warn(`⚠️ ${modelName} で失敗:`, e.message);
        lastError = e;
        // 次のモデルへ...
      }
    }

    // 全モデル失敗した場合
    console.error("❌ 全モデルで失敗しました");
    throw lastError || new Error("全てのAIモデルが応答しませんでした");

  } catch (error: any) {
    console.error("Travel API Critical Error:", error);
    return NextResponse.json(
      { error: `プラン作成に失敗しました: ${error.message}` }, 
      { status: 500 }
    );
  }
}