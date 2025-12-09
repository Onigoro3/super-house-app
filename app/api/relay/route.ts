import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { title, context } = await req.json();

    const prompt = `
      小説の続きを書いてください。
      タイトル: ${title}
      直前の文脈: "${context}"
      
      ルール:
      - 100〜300文字程度
      - 文脈を汲んで面白く展開させる
      - 日本語
    `;

    // ★修正: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ text: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}