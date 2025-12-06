// app/api/picture-book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();
    console.log(`絵本作成開始: ${topic}`);

    const prompt = `
      You are a professional children's book author.
      Create a heartwarming picture book in **JAPANESE** based on the theme: "${topic}".

      【Rules】
      1. Write in **JAPANESE** (Hiragana mainly).
      2. Create exactly 8 pages.
      3. For each page, provide an **'image_prompt' in ENGLISH** for AI image generation.
         - Style: "anime style, ghibli style, cute, vivid colors, high quality"
         - Describe the scene visually.

      【Output JSON Format】
      Return ONLY the JSON. No markdown formatting.

      {
        "title": "Title",
        "pages": [
          { "page_number": 1, "content": "Text...", "image_prompt": "English description..." },
          { "page_number": 2, "content": "Text...", "image_prompt": "English description..." }
        ]
      }
    `;

    // ★修正: 最新モデル 'gemini-2.5-flash' に変更
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // JSONパース
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Book Gen Error:", error);
    return NextResponse.json({ error: `作成失敗: ${error.message}` }, { status: 500 });
  }
}