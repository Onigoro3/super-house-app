import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const text = transcript.map(t => t.text).join(' ').slice(0, 10000);

    const prompt = `
      以下の動画字幕からレシピを抽出してください。
      
      字幕: ${text}
      
      出力(JSON):
      { "title": "料理名", "channel_name": "チャンネル名(推測)", "ingredients": ["材料1", "材料2"], "steps": ["手順1", "手順2"] }
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
    return NextResponse.json({ error: "字幕が見つかりませんでした" }, { status: 500 });
  }
}