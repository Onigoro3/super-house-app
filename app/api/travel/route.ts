// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキーの確認
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(apiKey!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    console.log(`旅行計画生成（安定版）: ${startPoint} -> ${destination}`);

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

    // ★修正: 最も安定・高速な 'gemini-1.5-flash' を使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // JSONモードは使わず、テキスト生成させてから抽出する（互換性のため）
    });

    // タイムアウト対策（9秒）
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 9000)
    );
    
    const aiPromise = model.generateContent(prompt);
    
    // 競走させる
    const result: any = await Promise.race([aiPromise, timeoutPromise]);
    let text = result.response.text();

    // クリーニング（念のため）
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // JSONパース確認
    let data;
    try {
      // 最初の '{' から 最後の '}' までを抜き出す（余計な文字対策）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("JSONが見つかりません");
      }
    } catch (e) {
      console.error("JSON Parse Error", text);
      throw new Error("AIの応答形式が正しくありませんでした");
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    return NextResponse.json({ error: `作成エラー: ${error.message}` }, { status: 500 });
  }
}