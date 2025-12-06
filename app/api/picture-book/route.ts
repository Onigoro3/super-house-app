// app/api/picture-book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();
    console.log(`絵本作成: ${topic}`);

    const prompt = `
      You are a professional children's book author and art director.
      Please create a heartwarming picture book in **JAPANESE** based on the theme: "${topic}".

      【Rules】
      1. Write the story in **JAPANESE** (Hiragana mainly, easy for kids).
      2. Create 8 to 10 pages.
      3. For each page, provide an **'image_prompt' in ENGLISH** for an AI image generator.
         - The image style MUST be: **"anime style, cute, vivid colors, ghibli style, high quality"**.
         - Describe the scene visually and simply.

      【Output JSON Format】
      STRICTLY output in the following JSON format:

      {
        "title": "Title in Japanese",
        "pages": [
          { 
            "page_number": 1, 
            "content": "Story text in Japanese...", 
            "image_prompt": "A cute cat playing with a ball, anime style, vivid colors, high quality" 
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