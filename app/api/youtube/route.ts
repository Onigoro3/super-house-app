// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 動画ID抽出
const extractVideoId = (url: string) => {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^/?]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^/?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
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

    // 1. 字幕を取得（失敗しても止まらないようにする）
    let transcriptText = "";
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
      transcriptText = transcriptItems.map(t => t.text).join(' ').slice(0, 30000);
    } catch (e) {
      console.warn("字幕取得失敗:", e);
      transcriptText = "（字幕が取得できませんでした。動画のタイトルやURLから料理内容を推測してください）";
    }

    // 2. AIにレシピ化させる
    const prompt = `
      あなたはプロの料理研究家です。
      以下のYouTube動画（ID: ${videoId}）の情報から、レシピを作成してください。
      
      【字幕データ】
      ${transcriptText}

      【指示】
      - 字幕がある場合は、そこから材料と手順を抜き出してください。
      - 字幕がない（取得エラー）の場合は、動画IDや文脈から「どんな料理か」を推測し、その一般的なレシピを提案してください。
      - 材料の分量が不明な場合は「適量」としてください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のみを出力してください。Markdown記号は含めないでください。

      {
        "title": "料理名",
        "channel_name": "YouTube",
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
    
    // クリーニング
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("YouTube Analyze Error:", error);
    return NextResponse.json({ error: `分析エラー: ${error.message}` }, { status: 500 });
  }
}