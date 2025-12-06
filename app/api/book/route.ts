// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type } = await req.json();

    const prompt = `
      You are a professional book writer.
      Please write a book in **JAPANESE** based on the following theme.
      
      【Theme】
      ${topic}

      【Type】
      ${type === 'story' ? 'Children\'s Picture Book (Story)' : 'Introductory Book (Study)'}

      【Rules】
      1. Write the content in **JAPANESE**.
      2. Create 5 to 8 pages.
      3. For each page, provide an **'image_prompt' in ENGLISH**.
         - The image prompt MUST be in English. (e.g., "cute cat in a forest, watercolor style")
         - Do not include Japanese characters in image_prompt.

      【Output JSON Format】
      {
        "title": "Book Title (in Japanese)",
        "pages": [
          { 
            "page_number": 1, 
            "headline": "Page Headline (in Japanese)", 
            "content": "Page Content (in Japanese)", 
            "image_prompt": "Visual description in English" 
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}