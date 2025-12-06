// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type } = await req.json();
    console.log(`執筆開始: ${topic} (${type})`);

    const prompt = `
      You are a professional book writer.
      Please write a book in **JAPANESE** based on the following theme.
      
      【Theme】
      ${topic}

      【Type】
      ${type === 'story' ? 'Children\'s Picture Book (Story)' : 'Introductory Book (Study)'}

      【Rules】
      1. Write in **JAPANESE** (Language: Japanese).
      2. Create 5 to 8 pages.
      3. For each page, provide an **'image_prompt' in English** to generate an illustration.
         - The image prompt should describe the scene visually (e.g., "cute cat in a forest, watercolor style").
      4. If it's a story, make it engaging. If it's a study book, make it easy to understand.

      【Output JSON Format】
      STRICTLY output in the following JSON format:

      {
        "title": "Book Title (in Japanese)",
        "pages": [
          { 
            "page_number": 1, 
            "headline": "Page Headline (in Japanese)", 
            "content": "Page Content (in Japanese, about 200-300 characters)", 
            "image_prompt": "Visual description of this page in English (for AI image generator)" 
          },
          ...
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // JSON抽出
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Book Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}