import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const prompt = `
      以下のテキストをReact Flow用のマインドマップJSONデータに変換してください。
      中心ノードから派生させ、位置(x,y)も適切に分散させてください。
      
      テキスト: ${text.slice(0, 5000)}
      
      出力(JSON):
      { "nodes": [{ "id": "1", "data": { "label": "..." }, "position": { "x": 0, "y": 0 } }], "edges": [...] }
    `;

    // ★修正: gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}