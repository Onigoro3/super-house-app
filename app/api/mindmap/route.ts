// app/api/mindmap/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const prompt = `
      以下のテキストの内容を構造化し、マインドマップ（ツリー図）のデータに変換してください。
      React Flowというライブラリで使用する JSON形式 で出力してください。

      【ルール】
      - 中心となるトピックを親ノードとし、そこから派生させてください。
      - ノードの位置（position）は、ツリー状に広がるように適当に計算して配置してください（x: 0, y: 0 を中心に）。
      - colors: 重要なノードは赤や青など色をつけてください。

      【出力フォーマット(JSON)】
      {
        "nodes": [
          { "id": "1", "data": { "label": "中心テーマ" }, "position": { "x": 0, "y": 0 }, "type": "input", "style": { "background": "#ffcccc" } },
          { "id": "2", "data": { "label": "サブ要素" }, "position": { "x": 100, "y": 100 } }
        ],
        "edges": [
          { "id": "e1-2", "source": "1", "target": "2", "animated": true }
        ]
      }

      【対象テキスト】
      ${text.slice(0, 10000)}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}