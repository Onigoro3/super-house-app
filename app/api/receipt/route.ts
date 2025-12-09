import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { imageBase64, mode } = await req.json();
    const base64Data = imageBase64.split(',')[1];
    
    // ★修正: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = mode === 'money' 
      ? `レシート画像を解析し、JSONで出力せよ: [{ "name": "店名", "price": 合計金額(数値), "date": "YYYY-MM-DD", "category": "食費" }]`
      : `レシート画像を解析し、食材リストをJSONで出力せよ: [{ "name": "商品名", "quantity": "個数", "category": "food" }]`;

    const result = await model.generateContent([
      prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);
    
    const text = result.response.text();
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}