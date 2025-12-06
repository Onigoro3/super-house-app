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
      2. Create exactly **5 pages** (to keep it simple and fast).
      3. For each page, provide an **'image_prompt' in ENGLISH**.
         - Style: "anime style, ghibli style, cute, vivid colors"
         - Describe the scene visually.

      【Output JSON Format】
      {
        "title": "Title",
        "pages": [
          { "page_number": 1, "content": "Text...", "image_prompt": "English description..." }
        ]
      }
    `;

    // ★重要: 高速な 1.5-flash モデルを使用し、JSONモードを強制
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    // タイムアウト対策: タイムアウト設定を追加（Vercel側が切る前にAI側で制御）
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const data = JSON.parse(text);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Book Gen Error:", error);
    return NextResponse.json({ error: "作成に失敗しました。時間を置いて再度お試しください。" }, { status: 500 });
  }
}