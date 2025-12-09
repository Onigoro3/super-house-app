// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    console.log(`旅行計画生成（全テーマ対応）: ${startPoint} -> ${destination}, テーマ: ${theme}`);

    // ★修正: テーマに応じた特別指示を作成
    // 温泉以外でも、必ず「おすすめスポット」を提案させる
    let specialInstruction = "";
    
    if (theme.includes("温泉") || theme.includes("サウナ")) {
      specialInstruction = `
      【★温泉・サウナ特化モード】
      行き先周辺の高評価な温泉・温浴施設を5つリストアップし、「♨️ おすすめ温泉5選」として詳細欄にURL付きで記載してください。
      `;
    } else if (theme) {
      specialInstruction = `
      【★テーマ特化モード: ${theme}】
      行き先周辺で、テーマ「${theme}」に合ったおすすめスポットを5つリストアップし、「✨ おすすめスポット5選 (${theme})」として詳細欄にURL付きで記載してください。
      `;
    } else {
      specialInstruction = `
      【★一般観光モード】
      行き先周辺の定番・人気観光スポットを5つリストアップし、「✨ おすすめ観光スポット5選」として詳細欄にURL付きで記載してください。
      `;
    }

    const prompt = `
      あなたはプロのトラベルコンシェルジュです。
      以下の条件で旅行プランを作成し、JSON形式で出力してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 移動: ${transport}
      - 予算: ${budget}円
      - テーマ: ${theme || "おまかせ"}

      【ルール】
      1. ${startPoint}からの概算距離を計算して記載。
      2. 各スポットのURLを記載（公式サイトまたはGoogleマップ検索URL）。
      3. **重要:** ${specialInstruction}
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
                "desc": "詳細説明（ここにおすすめ5選をリストアップ）", 
                "cost": "約1,000円", 
                "distance": "約10km", 
                "url": "https://..." 
              }
            ]
          }
        ]
      }
    `;

    // モデル設定 (高速な1.5-flashを使用)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // JSONモードは使わずテキストで受け取り、後でパースする（互換性重視）
    });

    // タイムアウト対策（9秒）
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 9000));
    const aiPromise = model.generateContent(prompt);
    
    // 競走
    const result: any = await Promise.race([aiPromise, timeoutPromise]);
    let text = result.response.text();

    // クリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // JSONパース
    let data;
    try {
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
    let msg = "プラン作成に失敗しました。";
    if (error.message === "Timeout") msg = "検索に時間がかかりすぎました。もう一度お試しください。";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}