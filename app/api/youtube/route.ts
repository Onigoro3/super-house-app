// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("エラー: GEMINI_API_KEY が設定されていません");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    // 動画ID抽出
    let videoId = '';
    try {
      if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split('?')[0];
      else if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0];
    } catch (e) { console.error("ID抽出エラー"); }

    if (!videoId) throw new Error('動画IDが見つかりませんでした');

    // YouTubeデータ取得
    const yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
    const info = await yt.getInfo(videoId);
    const transcriptData = await info.getTranscript();

    if (!transcriptData?.transcript) throw new Error('字幕がありません');

    // ★チャンネル名を取得
    const channelName = info.basic_info.author || '不明なチャンネル';

    // テキスト抽出
    const data: any = transcriptData;
    const segments = data?.transcript?.content?.body?.initial_segments;
    if (!segments) throw new Error('字幕データ解析失敗');
    const fullText = segments.map((segment: any) => segment.snippet.text).join(' ');

    // AI分析
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      あなたはプロの料理家です。以下のYouTube動画の字幕からレシピ情報を抽出してJSONで出力してください。
      表記は一般的なものに統一し、誤字は補正してください。

      出力フォーマット(JSON):
      {
        "title": "${info.basic_info.title || '料理名'}",
        "channel_name": "${channelName}", 
        "ingredients": ["材料1 分量", "材料2 分量"],
        "steps": ["手順1", "手順2"]
      }

      字幕: ${fullText.slice(0, 30000)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("Error:", error);
    let msg = error.message || 'エラー';
    if (msg.includes('404')) msg = 'AIモデルエラー(404)。モデル名を確認してください。';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}