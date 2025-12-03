// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// APIキーの確認
if (!process.env.GEMINI_API_KEY) {
  console.error("エラー: GEMINI_API_KEY が設定されていません");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { ingredients, seasoning } = await req.json();
    console.log("献立生成開始...");

    // AIへの指示書
    const prompt = `
      あなたは世界トップクラスの家庭料理シェフです。
      以下の「食材」と「調味料」を使って、家庭で美味しく作れるレシピを【10個】考案してください。

      【使用する食材】
      ${ingredients.join(', ')}

      【使える調味料】
      ${seasoning}

      【条件】
      - 初心者でもわかりやすいように、下処理や火加減のコツを具体的に書いてください。
      - 難易度は「簡単」「普通」「難しい」のいずれか。
      - カロリーは概算でOKです。
      - 和風、洋風、中華、エスニックなどバラエティ豊かにしてください。
      - 必ず以下のJSON形式のリストで出力してください。Markdownの記法（\`\`\`jsonなど）は不要です。

      出力JSONフォーマット:
      [
        {
          "title": "料理名",
          "type": "ジャンル",
          "difficulty": "簡単",
          "calories": 500,
          "ingredients": ["材料1 分量", "材料2 分量"],
          "steps": ["手順1", "手順2"]
        }
      ]
    `;

    // ★修正ポイント：成功実績のある 'gemini-2.5-flash' に変更
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON部分だけを抽出してパース
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    const data = JSON.parse(jsonStr);

    console.log("献立生成成功！");
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Menu Gen Error Details:", error);
    return NextResponse.json({ error: error.message || '献立の生成に失敗しました' }, { status: 500 });
  }
}