// app/api/relay/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { title, context } = await req.json();

    const prompt = `
      あなたはクリエイティブな小説家です。
      ユーザーと協力して「${title}」というタイトルの小説を書いています。
      
      これまでのあらすじ（直前の文脈）:
      "${context}"

      【ルール】
      - 文脈の流れを汲んで、物語の続きを書いてください。
      - 面白くなるように、少し意外な展開や、情景描写を加えてください。
      - 長さは100〜300文字程度で、区切りの良いところで止めてください（ユーザーにバトンを渡すため）。
      - 日本語で書いてください。

      続きの文章:
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}