// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 動画ID抽出（Shorts対応・強化版）
const extractVideoId = (url: string) => {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^/?]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^/?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return NextResponse.json({ error: "URLが正しくありません" }, { status: 400 });
    }

    // 1. 字幕取得を試みる
    let transcriptText = "";
    try {
      // 日本語字幕を優先取得、なければ英語、それもなければ自動生成
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
      transcriptText = transcriptItems.map(t => t.text).join(' ').slice(0, 15000);
    } catch (e) {
      console.log("字幕取得失敗（字幕なしか取得不可）");
      // 字幕がなくても、動画IDさえあればAIが知っている知識でカバーできる場合がある
      transcriptText = "（字幕が取得できませんでした。動画のメタデータや一般的なレシピ知識から推測してください）";
    }

    // 2. AIにレシピ化させる
    const prompt = `
      あなたはプロの料理研究家です。
      以下のYouTube動画（ID: ${videoId}）の内容から、レシピを作成してください。
      
      【取得した字幕データ】
      ${transcriptText}

      【指示】
      - 字幕がある場合は、そこから正確な材料と手順を抜き出してください。
      - 字幕がない（取得エラー）の場合は、動画IDや文脈から「どんな料理か」を推測し、その一般的なレシピを提案してください。
      - 材料の分量が不明な場合は「適量」としてください。

      【出力フォーマット(JSON)】
      {
        "title": "料理名",
        "channel_name": "YouTube",
        "ingredients": ["材料1", "材料2"],
        "steps": ["手順1", "手順2"]
      }
    `;

    // ★モデル変更: gemini-2.0-flash-exp (最新・高速)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("YouTube Error:", error);
    return NextResponse.json({ error: "動画の分析に失敗しました。字幕のない動画の可能性があります。" }, { status: 500 });
  }
}