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
      あなたはプロのブックライター兼アートディレクターです。
      以下のテーマで、読者が楽しく学べる「${type === 'story' ? '物語・絵本' : '入門書・参考書'}」を執筆してください。

      【テーマ】
      ${topic}

      【ルール】
      - 全5〜8ページ構成。
      - ${type === 'study' ? '専門用語には解説を入れ、最後にまとめを入れてください。' : '起承転結を意識し、情景が浮かぶように書いてください。'}
      - **重要: 各ページの挿絵のイメージを「英語」で作成してください（画像生成AI用）。**
        - 絵本なら: "cute watercolor style illustration of..."（かわいい水彩画風...）
        - 参考書なら: "simple diagram style illustration of..."（シンプルな図解風...）
        - 具体的に何が描かれているか描写してください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。

      {
        "title": "本のタイトル",
        "pages": [
          { 
            "page_number": 1, 
            "headline": "見出し", 
            "content": "本文...", 
            "image_prompt": "A cute cat sitting on a bench in a park, sunny day, watercolor style" 
          },
          { "page_number": 2, ... }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Book Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}