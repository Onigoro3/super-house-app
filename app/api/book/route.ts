// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type, length, previousContent } = await req.json();
    
    let prompt = "";

    // ★ 続きを書くモード（後編）
    if (previousContent) {
      prompt = `
        You are a professional book writer.
        Please write the **CONTINUATION (Part 2)** of the following story/book.
        
        【Theme】 ${topic}
        【Type】 ${type === 'story' ? 'Story' : 'Study Book'}
        
        【Previous Context (End of Part 1)】
        "${previousContent}..."

        【Rules】
        1. Write in **JAPANESE**.
        2. Create about 20 pages to conclude or continue the story properly.
        3. Start from page 21.
        4. No images required.

        【Output JSON Format】
        {
          "pages": [
            { "page_number": 21, "headline": "Headline", "content": "Content..." },
            ...
          ]
        }
      `;
    } 
    // ★ 新規作成モード（前編または完結）
    else {
      const pageCountInstruction = length === 'super_long' 
        ? "Create exactly 20 pages (Part 1 of a long story). End with a cliffhanger or 'To be continued'." 
        : (length === 'long' ? "Create about 15-20 pages." : "Create 5-8 pages.");

      prompt = `
        You are a professional book writer.
        Please write a book in **JAPANESE**.
        
        【Theme】 ${topic}
        【Type】 ${type === 'story' ? 'Children\'s Picture Book' : 'Introductory Book'}

        【Rules】
        1. Write in **JAPANESE**.
        2. ${pageCountInstruction}
        3. No images required.

        【Output JSON Format】
        {
          "title": "Book Title",
          "pages": [
            { "page_number": 1, "headline": "Headline", "content": "Content..." },
            ...
          ]
        }
      `;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}