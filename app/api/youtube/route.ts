// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキーの確認
if (!process.env.GEMINI_API_KEY) {
  console.error("エラー: GEMINI_API_KEY が設定されていません");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    console.log("分析開始 URL:", url);

    // 1. 動画IDの抽出
    let videoId = '';
    try {
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('v=')) {
        videoId = url.split('v=')[1]?.split('&')[0];
      }
    } catch (e) { console.error("ID抽出エラー"); }

    if (!videoId) throw new Error('動画IDが見つかりませんでした');

    // 2. Innertube初期化
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });

    // 3. 動画情報・字幕取得
    console.log("字幕取得中...");
    const info = await yt.getInfo(videoId);
    const transcriptData = await info.getTranscript();

    if (!transcriptData || !transcriptData.transcript) {
      throw new Error('字幕がありません');
    }

    // 4. テキスト結合
    // データ構造が深いため、any型を使って安全に取り出します
    const data: any = transcriptData;
    const segments = data?.transcript?.content?.body?.initial_segments;

    if (!segments) {
      throw new Error('字幕データの構造が予期しない形式です');
    }

    const fullText = segments.map((segment: any) => {
      return segment.snippet.text;
    }).join(' ');
    
    console.log("字幕取得成功 文字数:", fullText.length);

    // 5. Gemini AI分析
    // ★修正ポイント: モデル名を最新の 'gemini-2.5-flash' に変更
    // (これがダメな場合は 'gemini-flash-latest' も試せます)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      あなたはプロの料理家です。以下のYouTube動画の字幕からレシピ情報を抽出してJSONで出力してください。
      
      出力フォーマット(JSON):
      {
        "title": "${info.basic_info.title || '料理名'}",
        "ingredients": ["材料1 分量", "材料2 分量"],
        "steps": ["手順1", "手順2"]
      }

      字幕: ${fullText.slice(0, 30000)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const resultData = JSON.parse(jsonStr);

    return NextResponse.json(resultData);

  } catch (error: any) {
    console.error("エラー詳細:", error);
    
    let msg = error.message || '不明なエラー';
    if (msg.includes('404')) msg = 'AIモデルが古いか無効です(404)。モデル名を変更する必要があります。';
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}