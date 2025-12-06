// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type, length } = await req.json();

    const pageCountInstruction = length === 'long' 
      ? "Create about 15 to 20 pages." 
      : "Create 5 to 8 pages.";

    const prompt = `
      You are a professional book writer.
      Please write a book in **JAPANESE** based on the following theme.
      
      【Theme】
      ${topic}

      【Type】
      ${type === 'story' ? 'Children\'s Picture Book (Story)' : 'Introductory Book (Study)'}

      【Rules】
      1. Write the content in **JAPANESE**.
      2. ${pageCountInstruction}
      3. No images or image prompts required. Focus on text content.

      【Output JSON Format】
      STRICTLY output in the following JSON format:

      {
        "title": "Book Title (in Japanese)",
        "pages": [
          { 
            "page_number": 1, 
            "headline": "Page Headline (in Japanese)", 
            "content": "Page Content (in Japanese)"
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