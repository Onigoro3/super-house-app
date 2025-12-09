import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type, length, previousContent } = await req.json();
    
    let instruction = "";
    if (previousContent) {
      instruction = `これは物語の続き（後編）です。前回のあらすじ: "${previousContent.slice(-300)}..."`;
    } else {
      const len = length === 'super_long' ? "20ページ（長編のパート1）" : (length === 'long' ? "15ページ" : "5ページ");
      instruction = `新規作成。長さ: ${len}。`;
    }

    const prompt = `
      ${type === 'story' ? '絵本作家' : '解説者'}として本を執筆してください。
      テーマ: ${topic}
      言語: 日本語
      指示: ${instruction}
      
      出力(JSON):
      {
        "title": "タイトル",
        "pages": [ { "page_number": 1, "headline": "見出し", "content": "本文..." } ]
      }
    `;

    // ★修正: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}