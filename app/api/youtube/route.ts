// app/api/youtube/route.ts
import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    // 動画IDを取り出す
    // URLの形 (v=xxxxx) に対応
    const videoId = url.split('v=')[1]?.split('&')[0];
    if (!videoId) throw new Error('動画URLが正しく認識できませんでした');

    // ★修正ポイント：lang指定を外して、自動生成字幕も取れるようにする
    // configなしで呼ぶと、利用可能な字幕（デフォルト）を自動で取ってきます
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('字幕データが見つかりませんでした');
    }

    // 文字列に結合（長すぎる場合はカットする処理を入れても良いですが、まずはそのまま）
    const fullText = transcriptItems.map(item => item.text).join(' ');

    // Gemini AIに分析させる
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      あなたはプロの料理家です。以下のYouTube動画の字幕テキストから、レシピ情報を抽出してJSON形式で出力してください。
      
      【重要なお願い】
      - 字幕は誤字脱字が含まれるため、文脈から正しい食材や手順を推測して補正してください。
      - 手順は「下処理」や「火加減」などのコツを補足し、初心者にもわかるように具体的に書いてください。
      
      出力フォーマット(JSON):
      {
        "title": "料理名（動画タイトルから推測、または魅力的な名前）",
        "ingredients": ["材料1 分量", "材料2 分量"],
        "steps": ["手順1", "手順2", "手順3"]
      }

      字幕テキスト:
      ${fullText.slice(0, 15000)} 
    `;
    // ※文字数制限対策で念のため先頭15000文字に制限

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON部分だけ抽出
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error) {
    console.error("YouTube Error:", error);
    return NextResponse.json(
      { error: '字幕が取得できませんでした。字幕機能がオフの動画か、YouTube側の制限の可能性があります。' }, 
      { status: 500 }
    );
  }
}