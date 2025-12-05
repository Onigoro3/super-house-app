// app/api/receipt/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキーがありません");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // modeを受け取る ('stock' | 'money')
    const { imageBase64, mode } = await req.json();
    const base64Data = imageBase64.split(',')[1];
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let prompt = "";

    if (mode === 'money') {
      // ★家計簿モードの指示書
      prompt = `
        このレシート（または請求書）画像を解析して、家計簿データを抽出してください。
        
        【抽出ルール】
        - 「店名（またはサービス名）」と「合計金額」と「日付」を読み取ってください。
        - 日付が読み取れない場合は、今日の日付にしてください。
        - カテゴリは内容から推測して「食費」「日用品」「固定費」「サブスク」「娯楽」「交通費」「その他」から選んでください。
        - 合計金額だけを1件として抽出してください（個別の商品は不要）。

        出力フォーマット(JSON):
        [
          { "name": "セブンイレブン", "price": 850, "date": "2023-12-01", "category": "食費" }
        ]
      `;
    } else {
      // ★食材在庫モードの指示書（既存）
      prompt = `
        この画像を解析して、購入された（または写っている）「食材・日用品リスト」をJSON形式で抽出してください。
        
        【ルール】
        - レシートの場合は「商品名」と「個数」を読み取ってください。
        - 商品名は一般的な名称に変換してください（例：「国産豚コマ」→「豚こま肉」）。
        - カテゴリーは: food, seasoning, other から選択。

        出力フォーマット(JSON):
        [
          { "name": "キャベツ", "quantity": "1玉", "category": "food" }
        ]
      `;
    }

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Receipt Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}