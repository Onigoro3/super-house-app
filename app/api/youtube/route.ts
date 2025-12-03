// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    // 動画IDを取り出す
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (!videoId) throw new Error('URLが正しくありません');

    // 字幕を取得
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
    const fullText = transcriptItems.map(item => item.text).join(' ');

    // Gemini AIに分析させる
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      以下の料理動画の字幕から、レシピ情報を抽出してJSON形式で返してください。
      初心者にもわかるように、具体的な手順やコツを補足して書いてください。
      
      出力フォーマット:
      {
        "title": "料理名",
        "ingredients": ["材料1 分量", "材料2 分量"],
        "steps": ["手順1", "手順2"]
      }

      字幕: ${fullText}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON部分だけ抽出
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '字幕が取得できませんでした' }, { status: 500 });
  }
}