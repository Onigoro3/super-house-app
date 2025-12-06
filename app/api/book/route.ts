// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, type } = await req.json(); // type: 'study'(参考書) or 'story'(絵本/物語)
    console.log(`執筆開始: ${topic} (${type})`);

    const prompt = `
      あなたはプロのブックライターです。
      以下のテーマで、読者が楽しく学べる「${type === 'story' ? '物語・絵本' : '入門書・参考書'}」を執筆してください。

      【テーマ】
      ${topic}

      【ルール】
      - 全5〜8ページ構成にしてください。
      - 読者が飽きないように、分かりやすく、興味深い内容にしてください。
      - ${type === 'study' ? '専門用語には解説を入れ、最後にまとめを入れてください。' : '起承転結を意識し、情景が浮かぶように書いてください。'}

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。

      {
        "title": "本のタイトル（キャッチーに）",
        "pages": [
          { "page_number": 1, "headline": "ページの小見出し", "content": "本文（300文字程度）..." },
          { "page_number": 2, "headline": "次の小見出し", "content": "本文..." }
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