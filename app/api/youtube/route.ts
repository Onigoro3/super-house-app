// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ★動画IDを抽出する関数（Shorts対応版）
const extractVideoId = (url: string) => {
  const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    // 1. 動画IDを取り出す
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "YouTubeのURLとして認識できませんでした" }, { status: 400 });
    }

    // 2. 字幕を取得
    let transcriptText = "";
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      // 文字数制限（長すぎるとエラーになるので先頭2万文字くらいに制限）
      transcriptText = transcriptItems.map(t => t.text).join(' ').slice(0, 20000);
    } catch (e) {
      console.error("Transcript Error:", e);
      return NextResponse.json({ error: "この動画には字幕がないか、読み取れませんでした。" }, { status: 400 });
    }

    // 3. AIにレシピ化させる
    const prompt = `
      以下のYouTube動画の字幕データから、料理のレシピ情報を抽出してください。
      
      【字幕データ】
      ${transcriptText}
      
      【ルール】
      - 料理名、材料リスト、手順を抜き出してください。
      - 材料は分量がわかれば記載してください。
      - 手順は簡潔にまとめてください。
      
      【出力フォーマット(JSONのみ)】
      {
        "title": "料理名",
        "channel_name": "動画から推測できるチャンネル名（不明ならYouTube動画）",
        "ingredients": ["材料1", "材料2"],
        "steps": ["手順1", "手順2"]
      }
    `;

    // ★修正: 最新モデル gemini-2.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("YouTube Analyze Error:", error);
    return NextResponse.json({ error: `分析エラー: ${error.message}` }, { status: 500 });
  }
}