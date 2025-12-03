// app/api/receipt/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキーの確認
if (!process.env.GEMINI_API_KEY) {
  console.error("エラー: GEMINI_API_KEY が設定されていません");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    // Base64のヘッダー(data:image/jpeg;base64,など)を削除してデータ部分だけにする
    const base64Data = imageBase64.split(',')[1];

    // 画像認識に対応したモデルを使用
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
    // ※もし2.0でエラーが出たら gemini-1.5-flash に変えてください

    const prompt = `
      この画像を解析して、購入された（または写っている）「食材・日用品リスト」をJSON形式で抽出してください。
      
      【ルール】
      - レシートの場合は「商品名」と「個数」を読み取ってください。
      - 冷蔵庫の写真の場合は「食材名」を認識してください。
      - 割引、合計金額、店名などの情報は不要です。
      - 商品名は一般的な名称に変換してください（例：「国産豚コマ」→「豚こま肉」）。
      - カテゴリーは以下から最も適切なものを選んでください:
        - food: 食品（肉、野菜、卵、加工食品など）
        - seasoning: 調味料（醤油、油、塩、マヨネーズ、ドレッシングなど）
        - other: 日用品（洗剤、ペーパー、ラップ、ゴミ袋など）

      出力フォーマット(JSON):
      [
        { "name": "キャベツ", "quantity": "1玉", "category": "food" },
        { "name": "醤油", "quantity": "1本", "category": "seasoning" }
      ]
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // JSON部分を抽出
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Receipt Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}