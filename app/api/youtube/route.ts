// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    console.log("分析開始 URL:", url);

    // 動画ID抽出 (短縮URL youtu.be にも対応)
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else {
      videoId = url.split('v=')[1]?.split('&')[0];
    }

    if (!videoId) {
      console.error("動画ID抽出失敗");
      throw new Error('URLから動画IDが見つかりませんでした');
    }
    console.log("動画ID:", videoId);

    // ★修正ポイント：3段階で字幕を探す
    let transcriptItems = null;

    // 作戦1: 日本語('ja')を指定して取る
    try {
      console.log("作戦1: 日本語字幕を探します...");
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' });
    } catch (e) {
      console.log("作戦1失敗。次は指定なしで探します。");
    }

    // 作戦2: 指定なし（デフォルト/自動生成）で取る
    if (!transcriptItems) {
      try {
        transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      } catch (e) {
        console.log("作戦2失敗。");
      }
    }

    // 作戦3: 英語('en')でもいいから取る
    if (!transcriptItems) {
      try {
        console.log("作戦3: 英語字幕を探します...");
        transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      } catch (e) {
        console.log("作戦3失敗。");
      }
    }

    // 全部ダメだった場合
    if (!transcriptItems || transcriptItems.length === 0) {
      console.error("字幕取得 完全失敗");
      throw new Error('字幕が見つかりませんでした。');
    }

    console.log("字幕取得成功！文字数:", transcriptItems.length);

    // 文字列結合
    const fullText = transcriptItems.map(item => item.text).join(' ');

    // Gemini AI分析
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      あなたはプロの料理家です。以下のYouTube動画の字幕から、レシピ情報を抽出してJSON形式で出力してください。
      字幕には誤字が含まれる可能性があるため、文脈から正しい食材や手順を推測して補正してください。
      
      出力フォーマット(JSON):
      {
        "title": "料理名",
        "ingredients": ["材料1 分量", "材料2 分量"],
        "steps": ["手順1", "手順2", "手順3"]
      }

      字幕テキスト:
      ${fullText.slice(0, 20000)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    // VS Codeのターミナルに詳細なエラーを表示
    console.error("================ エラー発生 ================");
    console.error(error);
    console.error("===========================================");
    
    return NextResponse.json(
      { error: `エラー: ${error.message || '不明なエラー'}` }, 
      { status: 500 }
    );
  }
}